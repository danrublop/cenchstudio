/**
 * Physics Simulation Library for Cench Studio
 * MIT-licensed simulations adapted from Physics-Notebook patterns.
 *
 * Each simulation is deterministic and WVC-seekable:
 *   - State is advanced by fixed dt per step
 *   - seekTo(t) resets to initial state, replays from nearest snapshot
 *   - Snapshots every SNAPSHOT_INTERVAL seconds for fast seeking
 *   - Integrates with window.__tl (GSAP) and __advanceFrame (WVC)
 *
 * Usage:
 *   const sim = new PhysicsSims.PendulumSim(canvas, { g: 9.8, length: 2 });
 *   sim.init();
 *   sim.seekTo(3.5);  // jump to t=3.5s
 */
(function () {
  'use strict';

  // ── Shared Utilities ──────────────────────────────────────────────────────

  var TAU = 2 * Math.PI;

  /** Seeded PRNG — mulberry32 */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Linear interpolation */
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Clamp value to range */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** Treat projectile angles > 2π as degrees for user-friendly inputs */
  function normalizeAngleRad(angle) {
    var a = Number(angle);
    if (!isFinite(a)) return Math.PI / 4;
    if (Math.abs(a) > TAU) a = a * Math.PI / 180;
    return a;
  }

  /** Normalize displacement-like params. Large values are treated as pixels. */
  function normalizeDisplacementUnits(v) {
    var n = Number(v);
    if (!isFinite(n)) return 1;
    // Harmonic oscillator visuals historically use ~60 px per 1 sim unit.
    // If user provides large values (e.g. 120, 180), interpret as pixels.
    if (Math.abs(n) > 8) n = n / 60;
    return n;
  }

  // ── Base PhysicsSim Class ─────────────────────────────────────────────────

  /**
   * @constructor
   * @param {HTMLCanvasElement} canvas
   * @param {Object} config — simulation-specific parameters
   */
  function PhysicsSim(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = Object.assign({}, this.defaults || {}, config || {});
    this.dt = 1 / 120;  // 120 Hz physics step
    this.SNAPSHOT_INTERVAL = 1.0;  // snapshot every 1s
    this.simulationTime = 0;
    this.snapshots = [];
    this.initialState = null;
    this.state = {};
    this.trail = [];
    this.maxTrailLength = 500;
    this.paramChanges = [];  // scheduled parameter changes
    this._playing = false;
    this._rafId = null;
    // Scale factor: all absolute pixel sizes (bob radius, fonts, arrows) are
    // authored for a 1080-tall reference canvas. _s scales them proportionally.
    this._s = Math.min(canvas.width, canvas.height) / 1080;
  }

  PhysicsSim.prototype = {
    constructor: PhysicsSim,

    /** Initialize simulation — override in subclass */
    init: function () {
      this._initState();
      this.initialState = this._cloneState();
      this.snapshots = [this._cloneState()];
      this.simulationTime = 0;
      this.trail = [];
      this.render();
    },

    /** Internal state setup — subclass must override */
    _initState: function () {},

    /** Single physics step — subclass must override */
    step: function () {},

    /** Render current state to canvas — subclass must override */
    render: function () {},

    /** Return LaTeX equations — subclass must override */
    getEquations: function () { return []; },

    /** Deep clone the simulation state */
    _cloneState: function () {
      return {
        state: JSON.parse(JSON.stringify(this.state)),
        simulationTime: this.simulationTime,
        trail: this.trail.slice(-this.maxTrailLength).map(function (p) { return p.slice(); }),
        config: JSON.parse(JSON.stringify(this.config)),
      };
    },

    /** Restore from a snapshot */
    _loadSnapshot: function (snap) {
      this.state = JSON.parse(JSON.stringify(snap.state));
      this.simulationTime = snap.simulationTime;
      this.trail = snap.trail.map(function (p) { return p.slice(); });
      // Restore config for param changes
      if (snap.config) {
        this.config = JSON.parse(JSON.stringify(snap.config));
      }
    },

    /** Seek to exact time t (seconds). Core of WVC integration. */
    seekTo: function (t) {
      if (t <= 0) {
        this._loadSnapshot({ state: this.initialState.state, simulationTime: 0, trail: [], config: this.initialState.config });
        this.render();
        return;
      }

      // Find nearest snapshot at or before t
      var snapIdx = Math.min(
        Math.floor(t / this.SNAPSHOT_INTERVAL),
        this.snapshots.length - 1
      );
      var snap = this.snapshots[snapIdx] || this.initialState;
      this._loadSnapshot(snap);

      // Step forward from snapshot to target time
      var remaining = t - this.simulationTime;
      var steps = Math.round(remaining / this.dt);
      for (var i = 0; i < steps; i++) {
        this._applyParamChanges();
        this.step();
        this.simulationTime += this.dt;
      }
      this.simulationTime = t;  // correct floating-point drift
      this.render();
    },

    /** Pre-compute snapshots up to maxTime for fast seeking */
    precompute: function (maxTime) {
      this._loadSnapshot(this.initialState);
      this.simulationTime = 0;
      this.trail = [];
      this.snapshots = [this._cloneState()];

      var nextSnap = this.SNAPSHOT_INTERVAL;
      var totalSteps = Math.ceil(maxTime / this.dt);
      for (var i = 0; i < totalSteps; i++) {
        this._applyParamChanges();
        this.step();
        this.simulationTime += this.dt;
        if (this.simulationTime >= nextSnap) {
          this.snapshots.push(this._cloneState());
          nextSnap += this.SNAPSHOT_INTERVAL;
        }
      }
    },

    /** Apply scheduled parameter changes based on current simulationTime */
    _applyParamChanges: function () {
      var t = this.simulationTime;
      for (var i = 0; i < this.paramChanges.length; i++) {
        var ch = this.paramChanges[i];
        if (t >= ch.atTime && t <= ch.atTime + ch.transitionDuration) {
          var frac = ch.transitionDuration > 0
            ? clamp((t - ch.atTime) / ch.transitionDuration, 0, 1)
            : 1;
          this.config[ch.param] = lerp(ch.from, ch.to, frac);
        } else if (t > ch.atTime + ch.transitionDuration) {
          this.config[ch.param] = ch.to;
        }
      }
    },

    /** Schedule a parameter change */
    setParam: function (key, value) {
      this.config[key] = value;
    },

    /** Schedule a smooth parameter transition */
    scheduleParamChange: function (param, from, to, atTime, transitionDuration) {
      this.paramChanges.push({
        param: param,
        from: from,
        to: to,
        atTime: atTime,
        transitionDuration: transitionDuration || 0,
      });
    },

    /** Play with requestAnimationFrame (for preview, not WVC) */
    play: function () {
      if (this._playing) return;
      this._playing = true;
      var self = this;
      var stepsPerFrame = Math.round((1 / 60) / this.dt);
      function tick() {
        if (!self._playing) return;
        for (var i = 0; i < stepsPerFrame; i++) {
          self._applyParamChanges();
          self.step();
          self.simulationTime += self.dt;
        }
        self.render();
        self._rafId = requestAnimationFrame(tick);
      }
      self._rafId = requestAnimationFrame(tick);
    },

    /** Pause playback */
    pause: function () {
      this._playing = false;
      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    },

    /** Add a point to the trail buffer */
    _addTrail: function (x, y) {
      this.trail.push([x, y]);
      if (this.trail.length > this.maxTrailLength) this.trail.shift();
    },

    /** Draw trail on canvas */
    _drawTrail: function (color, lineWidth) {
      if (this.trail.length < 2) return;
      var ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(this.trail[0][0], this.trail[0][1]);
      for (var i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i][0], this.trail[i][1]);
      }
      ctx.strokeStyle = color || 'rgba(100,150,255,0.5)';
      ctx.lineWidth = lineWidth || 2;
      ctx.stroke();
    },

    /** Draw an arrow from (x1,y1) to (x2,y2) */
    _drawArrow: function (x1, y1, x2, y2, color, lineWidth) {
      var ctx = this.ctx;
      var headLen = 12 * this._s;
      var angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
      ctx.strokeStyle = color || '#fff';
      ctx.lineWidth = lineWidth || 2;
      ctx.stroke();
    },

    /** Clear canvas with optional background */
    _clear: function (bg) {
      var ctx = this.ctx;
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      } else {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    },
  };

  /** Helper: create subclass */
  function extend(Parent, Child, proto) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
    for (var k in proto) {
      if (proto.hasOwnProperty(k)) Child.prototype[k] = proto[k];
    }
    return Child;
  }

  // ── 1. PendulumSim ───────────────────────────────────────────────────────

  function PendulumSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
  }

  extend(PhysicsSim, PendulumSim, {
    defaults: { g: 9.8, length: 2, angle: Math.PI / 6, damping: 0, angularVelocity: 0 },

    _initState: function () {
      this.state = {
        theta: this.config.angle,
        omega: this.config.angularVelocity || 0,
      };
    },

    step: function () {
      var s = this.state, c = this.config, dt = this.dt;
      // RK4 for theta'' = -(g/L)*sin(theta) - b*omega
      function deriv(theta, omega) {
        return -(c.g / c.length) * Math.sin(theta) - c.damping * omega;
      }
      var k1v = deriv(s.theta, s.omega);
      var k1x = s.omega;
      var k2v = deriv(s.theta + 0.5 * dt * k1x, s.omega + 0.5 * dt * k1v);
      var k2x = s.omega + 0.5 * dt * k1v;
      var k3v = deriv(s.theta + 0.5 * dt * k2x, s.omega + 0.5 * dt * k2v);
      var k3x = s.omega + 0.5 * dt * k2v;
      var k4v = deriv(s.theta + dt * k3x, s.omega + dt * k3v);
      var k4x = s.omega + dt * k3v;

      s.theta += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      s.omega += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);

      // Trail: bob position
      var W = this.canvas.width, H = this.canvas.height;
      var pivotX = W * 0.5, pivotY = H * 0.2;
      var scale = Math.min(W, H) * 0.25;
      var bobX = pivotX + scale * Math.sin(s.theta);
      var bobY = pivotY + scale * Math.cos(s.theta);
      this._addTrail(bobX, bobY);
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      var pivotX = W * 0.5, pivotY = H * 0.2;
      var scale = Math.min(W, H) * 0.25;
      var bobX = pivotX + scale * Math.sin(s.theta);
      var bobY = pivotY + scale * Math.cos(s.theta);
      var bobRadius = 18 * S;

      // Trail
      this._drawTrail('rgba(100,180,255,0.3)', 2 * S);

      // Rod
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 3 * S;
      ctx.stroke();

      // Pivot
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 6 * S, 0, TAU);
      ctx.fillStyle = '#666';
      ctx.fill();

      // Bob
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobRadius, 0, TAU);
      var grad = ctx.createRadialGradient(bobX - 4 * S, bobY - 4 * S, 2 * S, bobX, bobY, bobRadius);
      grad.addColorStop(0, '#6ea8fe');
      grad.addColorStop(1, '#2563eb');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Angle arc
      if (Math.abs(s.theta) > 0.02) {
        ctx.beginPath();
        var startAngle = Math.PI / 2 - 0.001;
        var endAngle = Math.PI / 2 - s.theta;
        ctx.arc(pivotX, pivotY, 40 * S, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
        ctx.strokeStyle = 'rgba(255,200,50,0.7)';
        ctx.lineWidth = 2 * S;
        ctx.stroke();
      }

      // Info
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(14 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('\u03B8 = ' + (s.theta * 180 / Math.PI).toFixed(1) + '\u00B0', 10 * S, H - 40 * S);
      ctx.fillText('\u03C9 = ' + s.omega.toFixed(3) + ' rad/s', 10 * S, H - 22 * S);
      ctx.fillText('t = ' + this.simulationTime.toFixed(2) + ' s', 10 * S, H - 4 * S);
    },

    getEquations: function () {
      return ['pendulum_ode', 'pendulum_period', 'energy_conservation'];
    },
  });

  // ── 2. DoublePendulumSim ──────────────────────────────────────────────────

  function DoublePendulumSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
    this.trail2 = [];  // second pendulum for chaos comparison
    this.maxTrailLength = 800;
  }

  extend(PhysicsSim, DoublePendulumSim, {
    defaults: { g: 9.8, L1: 1, L2: 1, m1: 1, m2: 1, theta1: Math.PI / 2, theta2: Math.PI / 2, omega1: 0, omega2: 0 },

    _initState: function () {
      this.state = {
        t1: this.config.theta1,
        t2: this.config.theta2,
        w1: this.config.omega1 || 0,
        w2: this.config.omega2 || 0,
      };
      this.trail2 = [];
    },

    _cloneState: function () {
      var base = PhysicsSim.prototype._cloneState.call(this);
      base.trail2 = this.trail2.slice(-this.maxTrailLength).map(function (p) { return p.slice(); });
      return base;
    },

    _loadSnapshot: function (snap) {
      PhysicsSim.prototype._loadSnapshot.call(this, snap);
      this.trail2 = (snap.trail2 || []).map(function (p) { return p.slice(); });
    },

    step: function () {
      var s = this.state, c = this.config, dt = this.dt;
      var g = c.g, L1 = c.L1, L2 = c.L2, m1 = c.m1, m2 = c.m2;

      // Full Lagrangian equations for double pendulum — RK4
      function derivs(t1, t2, w1, w2) {
        var dt12 = t1 - t2;
        var sinD = Math.sin(dt12), cosD = Math.cos(dt12);
        var M = m1 + m2;

        var den1 = L1 * (M - m2 * cosD * cosD);
        var a1 = (-m2 * L1 * w1 * w1 * sinD * cosD
          - m2 * L2 * w2 * w2 * sinD
          - M * g * Math.sin(t1)
          + m2 * g * Math.sin(t2) * cosD) / den1;

        var den2 = L2 * (M - m2 * cosD * cosD);
        var a2 = (m2 * L2 * w2 * w2 * sinD * cosD
          + M * L1 * w1 * w1 * sinD
          + M * g * Math.sin(t1) * cosD
          - M * g * Math.sin(t2)) / den2;

        return [w1, w2, a1, a2];
      }

      var k1 = derivs(s.t1, s.t2, s.w1, s.w2);
      var k2 = derivs(s.t1 + 0.5 * dt * k1[0], s.t2 + 0.5 * dt * k1[1], s.w1 + 0.5 * dt * k1[2], s.w2 + 0.5 * dt * k1[3]);
      var k3 = derivs(s.t1 + 0.5 * dt * k2[0], s.t2 + 0.5 * dt * k2[1], s.w1 + 0.5 * dt * k2[2], s.w2 + 0.5 * dt * k2[3]);
      var k4 = derivs(s.t1 + dt * k3[0], s.t2 + dt * k3[1], s.w1 + dt * k3[2], s.w2 + dt * k3[3]);

      s.t1 += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      s.t2 += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      s.w1 += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      s.w2 += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

      // Trail for bob2
      var W = this.canvas.width, H = this.canvas.height;
      var ox = W * 0.5, oy = H * 0.3;
      var sc = Math.min(W, H) * 0.18;
      var x1 = ox + sc * L1 * Math.sin(s.t1);
      var y1 = oy + sc * L1 * Math.cos(s.t1);
      var x2 = x1 + sc * L2 * Math.sin(s.t2);
      var y2 = y1 + sc * L2 * Math.cos(s.t2);
      this._addTrail(x2, y2);
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      var ox = W * 0.5, oy = H * 0.3;
      var sc = Math.min(W, H) * 0.18;
      var x1 = ox + sc * c.L1 * Math.sin(s.t1);
      var y1 = oy + sc * c.L1 * Math.cos(s.t1);
      var x2 = x1 + sc * c.L2 * Math.sin(s.t2);
      var y2 = y1 + sc * c.L2 * Math.cos(s.t2);

      // Trail with fading
      if (this.trail.length > 1) {
        for (var i = 1; i < this.trail.length; i++) {
          var alpha = i / this.trail.length;
          ctx.beginPath();
          ctx.moveTo(this.trail[i - 1][0], this.trail[i - 1][1]);
          ctx.lineTo(this.trail[i][0], this.trail[i][1]);
          ctx.strokeStyle = 'rgba(255,100,100,' + (alpha * 0.6).toFixed(3) + ')';
          ctx.lineWidth = 1.5 * S;
          ctx.stroke();
        }
      }

      // Rods
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 3 * S;
      ctx.stroke();

      // Pivot
      ctx.beginPath();
      ctx.arc(ox, oy, 6 * S, 0, TAU);
      ctx.fillStyle = '#666';
      ctx.fill();

      // Bob 1
      ctx.beginPath();
      ctx.arc(x1, y1, 14 * S, 0, TAU);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Bob 2
      ctx.beginPath();
      ctx.arc(x2, y2, 14 * S, 0, TAU);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Info
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(14 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('\u03B8\u2081 = ' + (s.t1 * 180 / Math.PI).toFixed(1) + '\u00B0', 10 * S, H - 30 * S);
      ctx.fillText('\u03B8\u2082 = ' + (s.t2 * 180 / Math.PI).toFixed(1) + '\u00B0', 10 * S, H - 14 * S);
    },

    getEquations: function () {
      return ['double_pendulum_lagrangian', 'lyapunov_exponent', 'energy_conservation'];
    },
  });

  // ── 3. ProjectileSim ──────────────────────────────────────────────────────

  function ProjectileSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
  }

  extend(PhysicsSim, ProjectileSim, {
    defaults: { v0: 30, angle: Math.PI / 4, g: 9.8, drag: 0 },

    _initState: function () {
      var c = this.config;
      var angle = normalizeAngleRad(c.angle);
      c.angle = angle;
      this.state = {
        x: 0,
        y: 0,
        vx: c.v0 * Math.cos(angle),
        vy: c.v0 * Math.sin(angle),
        landed: false,
        maxH: 0,
      };
    },

    step: function () {
      var s = this.state, c = this.config, dt = this.dt;
      if (s.landed) return;

      var drag = c.drag || 0;
      var speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);

      // Euler integration with optional quadratic drag
      var ax = -drag * s.vx * speed;
      var ay = -c.g - drag * s.vy * speed;

      s.vx += ax * dt;
      s.vy += ay * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > s.maxH) s.maxH = s.y;

      if (s.y < 0 && this.simulationTime > 0.01) {
        s.y = 0;
        s.landed = true;
      }

      // Trail in canvas coords
      var W = this.canvas.width, H = this.canvas.height, S = this._s;
      var margin = 60 * S;
      var range = c.v0 * c.v0 * Math.sin(2 * c.angle) / c.g;
      var maxHeight = c.v0 * c.v0 * Math.sin(c.angle) * Math.sin(c.angle) / (2 * c.g);
      var scaleX = (W - 2 * margin) / Math.max(range * 1.1, 1);
      var scaleY = (H - 2 * margin) / Math.max(maxHeight * 1.4, 1);
      var scale = Math.min(scaleX, scaleY);
      var cx = margin + s.x * scale;
      var cy = H - margin - s.y * scale;
      this._addTrail(cx, cy);
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();
      var angle = normalizeAngleRad(c.angle);

      var margin = 60 * S;
      var range = c.v0 * c.v0 * Math.sin(2 * angle) / c.g;
      var maxHeight = c.v0 * c.v0 * Math.sin(angle) * Math.sin(angle) / (2 * c.g);
      var scaleX = (W - 2 * margin) / Math.max(range * 1.1, 1);
      var scaleY = (H - 2 * margin) / Math.max(maxHeight * 1.4, 1);
      var scale = Math.min(scaleX, scaleY);

      // Ground line
      var groundY = H - margin;
      ctx.beginPath();
      ctx.moveTo(margin - 10 * S, groundY);
      ctx.lineTo(W - margin + 10 * S, groundY);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Ideal parabola (no drag)
      ctx.beginPath();
      var tFlight = 2 * c.v0 * Math.sin(angle) / c.g;
      for (var t = 0; t <= tFlight; t += tFlight / 100) {
        var px = c.v0 * Math.cos(angle) * t;
        var py = c.v0 * Math.sin(angle) * t - 0.5 * c.g * t * t;
        var cx2 = margin + px * scale;
        var cy2 = groundY - py * scale;
        if (t === 0) ctx.moveTo(cx2, cy2);
        else ctx.lineTo(cx2, cy2);
      }
      ctx.strokeStyle = 'rgba(100,100,100,0.4)';
      ctx.lineWidth = 1 * S;
      ctx.setLineDash([4 * S, 4 * S]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Actual trail
      this._drawTrail('rgba(59,130,246,0.7)', 3 * S);

      // Current position
      var cx = margin + s.x * scale;
      var cy = groundY - s.y * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * S, 0, TAU);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Velocity vector
      var vScale = 3 * S;
      this._drawArrow(cx, cy, cx + s.vx * vScale, cy - s.vy * vScale, '#22c55e', 2 * S);

      // Annotations
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(13 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('R: ' + s.x.toFixed(1) + 'm  H: ' + s.y.toFixed(1) + 'm', 8 * S, 18 * S);
      ctx.fillText('v=' + Math.sqrt(s.vx * s.vx + s.vy * s.vy).toFixed(1) + '  t=' + this.simulationTime.toFixed(1) + 's', 8 * S, 34 * S);
    },

    getEquations: function () {
      return ['projectile_x', 'projectile_y', 'projectile_range', 'projectile_max_height'];
    },
  });

  // ── 4. OrbitalSim ─────────────────────────────────────────────────────────

  function OrbitalSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
    this.maxTrailLength = 2000;
    this.areaSweep = [];  // for Kepler's second law visualization
  }

  extend(PhysicsSim, OrbitalSim, {
    defaults: { G: 1, m1: 1000, m2: 1, eccentricity: 0.5, semiMajorAxis: 200 },

    _initState: function () {
      var c = this.config;
      var a = c.semiMajorAxis;
      var e = c.eccentricity;
      // Start at periapsis
      var rPeri = a * (1 - e);
      var vPeri = Math.sqrt(c.G * c.m1 * (1 + e) / (a * (1 - e)));

      this.state = {
        x: rPeri,
        y: 0,
        vx: 0,
        vy: vPeri,
      };
      this.areaSweep = [];
    },

    _cloneState: function () {
      var base = PhysicsSim.prototype._cloneState.call(this);
      base.areaSweep = this.areaSweep.slice();
      return base;
    },

    _loadSnapshot: function (snap) {
      PhysicsSim.prototype._loadSnapshot.call(this, snap);
      this.areaSweep = (snap.areaSweep || []).slice();
    },

    step: function () {
      var s = this.state, c = this.config, dt = this.dt;
      var G = c.G, M = c.m1;

      // RK4 for gravitational two-body
      function derivs(x, y, vx, vy) {
        var r = Math.sqrt(x * x + y * y);
        var r3 = r * r * r;
        if (r3 < 1e-10) r3 = 1e-10;
        var ax = -G * M * x / r3;
        var ay = -G * M * y / r3;
        return [vx, vy, ax, ay];
      }

      var k1 = derivs(s.x, s.y, s.vx, s.vy);
      var k2 = derivs(s.x + 0.5 * dt * k1[0], s.y + 0.5 * dt * k1[1], s.vx + 0.5 * dt * k1[2], s.vy + 0.5 * dt * k1[3]);
      var k3 = derivs(s.x + 0.5 * dt * k2[0], s.y + 0.5 * dt * k2[1], s.vx + 0.5 * dt * k2[2], s.vy + 0.5 * dt * k2[3]);
      var k4 = derivs(s.x + dt * k3[0], s.y + dt * k3[1], s.vx + dt * k3[2], s.vy + dt * k3[3]);

      s.x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      s.y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      s.vx += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      s.vy += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

      // Trail in canvas coords (scaled)
      var W = this.canvas.width, H = this.canvas.height;
      var cx = W * 0.5 + s.x * this._s;
      var cy = H * 0.5 - s.y * this._s;
      this._addTrail(cx, cy);

      // Area sweep tracking (for Kepler's second law)
      this.areaSweep.push({ x: s.x, y: s.y, t: this.simulationTime });
      if (this.areaSweep.length > 5000) this.areaSweep.shift();
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      var centerX = W * 0.5;
      var centerY = H * 0.5;

      // Orbital trail
      this._drawTrail('rgba(100,200,255,0.4)', 1.5 * S);

      // Ideal ellipse (dashed)
      var a = c.semiMajorAxis * S;
      var e = c.eccentricity;
      var b = a * Math.sqrt(1 - e * e);
      var focalOffset = a * e;
      ctx.beginPath();
      ctx.ellipse(centerX - focalOffset, centerY, a, b, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 1 * S;
      ctx.setLineDash([4 * S, 4 * S]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central body (star/planet)
      var starR = 14 * S;
      ctx.beginPath();
      ctx.arc(centerX, centerY, starR, 0, TAU);
      var starGrad = ctx.createRadialGradient(centerX - 2 * S, centerY - 2 * S, 2 * S, centerX, centerY, starR);
      starGrad.addColorStop(0, '#fde047');
      starGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = starGrad;
      ctx.fill();

      // Orbiting body
      var orbX = centerX + s.x * S;
      var orbY = centerY - s.y * S;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 6 * S, 0, TAU);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 * S;
      ctx.stroke();

      // Velocity vector
      var vScale = 5 * S;
      this._drawArrow(orbX, orbY, orbX + s.vx * vScale, orbY - s.vy * vScale, '#22c55e', 2 * S);

      // Distance line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(orbX, orbY);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1 * S;
      ctx.setLineDash([3 * S, 3 * S]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Info
      var r = Math.sqrt(s.x * s.x + s.y * s.y);
      var v = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(13 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('r=' + r.toFixed(0) + '  v=' + v.toFixed(1) + '  e=' + c.eccentricity.toFixed(2), 8 * S, 18 * S);
    },

    getEquations: function () {
      return ['newtons_gravity', 'keplers_third', 'vis_viva', 'escape_velocity'];
    },
  });

  // ── 5. WaveInterferenceSim ────────────────────────────────────────────────

  function WaveInterferenceSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
    this.imageData = null;
  }

  extend(PhysicsSim, WaveInterferenceSim, {
    defaults: { frequency: 2, wavelength: 40, source_separation: 200, phase_diff: 0, amplitude: 1 },

    _initState: function () {
      this.state = { t: 0 };
      this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    },

    step: function () {
      this.state.t += this.dt;
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config;
      var W = this.canvas.width, H = this.canvas.height;
      var data = this.imageData.data;

      var cx = W * 0.5, cy = H * 0.5;
      var sep2 = c.source_separation * 0.5;
      var s1x = cx - sep2, s1y = cy;
      var s2x = cx + sep2, s2y = cy;
      var wl = c.wavelength;
      var freq = c.frequency;
      var t = s.t;
      var k = TAU / wl;
      var omega = TAU * freq;
      var pd = c.phase_diff;

      // Render interference pattern at lower resolution for performance
      var step = 3;
      for (var py = 0; py < H; py += step) {
        for (var px = 0; px < W; px += step) {
          var r1 = Math.sqrt((px - s1x) * (px - s1x) + (py - s1y) * (py - s1y));
          var r2 = Math.sqrt((px - s2x) * (px - s2x) + (py - s2y) * (py - s2y));

          var wave1 = Math.sin(k * r1 - omega * t) / Math.max(1, Math.sqrt(r1) * 0.1);
          var wave2 = Math.sin(k * r2 - omega * t + pd) / Math.max(1, Math.sqrt(r2) * 0.1);
          var combined = (wave1 + wave2) * 0.5;

          // Color: blue for positive, red for negative, black for zero
          var r, g, b;
          if (combined > 0) {
            r = 20; g = Math.floor(50 + combined * 200); b = Math.floor(100 + combined * 155);
          } else {
            r = Math.floor(100 - combined * 155); g = 20; b = Math.floor(50 - combined * 50);
          }

          // Fill block
          for (var dy = 0; dy < step && py + dy < H; dy++) {
            for (var dx = 0; dx < step && px + dx < W; dx++) {
              var idx = ((py + dy) * W + (px + dx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(this.imageData, 0, 0);

      // Source markers
      var S = this._s;
      ctx.beginPath();
      ctx.arc(s1x, s1y, 6 * S, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s2x, s2y, 6 * S, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Info
      ctx.fillStyle = '#fff';
      ctx.font = Math.round(13 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('\u03BB=' + c.wavelength.toFixed(0) + '  f=' + c.frequency.toFixed(1) + 'Hz  d=' + c.source_separation.toFixed(0), 8 * S, 16 * S);
    },

    getEquations: function () {
      return ['wave_superposition', 'constructive_interference', 'destructive_interference'];
    },
  });

  // ── 6. DoubleSlitSim ──────────────────────────────────────────────────────

  function DoubleSlitSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
  }

  extend(PhysicsSim, DoubleSlitSim, {
    defaults: { wavelength: 500e-9, slit_separation: 0.1e-3, slit_width: 0.02e-3, screen_distance: 1 },

    _initState: function () {
      this.state = { t: 0, particles: [], particleCount: 0 };
    },

    step: function () {
      var s = this.state, c = this.config;
      s.t += this.dt;

      // Add particles probabilistically based on intensity distribution
      var stepsPerFrame = 3;
      for (var i = 0; i < stepsPerFrame; i++) {
        // Sample from intensity distribution using rejection sampling
        var yRange = 0.01; // +/- range on screen in meters
        var yTrial = (Math.random() - 0.5) * 2 * yRange;
        var sinTheta = yTrial / Math.sqrt(yTrial * yTrial + c.screen_distance * c.screen_distance);

        // Double slit intensity: interference * diffraction envelope
        var dPhase = Math.PI * c.slit_separation * sinTheta / c.wavelength;
        var aPhase = Math.PI * c.slit_width * sinTheta / c.wavelength;
        var interference = Math.cos(dPhase);
        var diffraction = Math.abs(aPhase) < 1e-10 ? 1 : Math.sin(aPhase) / aPhase;
        var intensity = interference * interference * diffraction * diffraction;

        if (Math.random() < intensity) {
          s.particles.push(yTrial);
          s.particleCount++;
        }
      }

      // Cap particles
      if (s.particles.length > 5000) {
        s.particles = s.particles.slice(-5000);
      }
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      // Layout: barrier on left, screen on right
      var barrierX = W * 0.3;
      var screenX = W * 0.75;
      var slitCenterY = H * 0.5;
      var slitSepPx = 120 * S;
      var slitWidthPx = 10 * S;
      var barrierW = 8 * S;

      // Draw barrier
      ctx.fillStyle = '#444';
      ctx.fillRect(barrierX - barrierW / 2, 0, barrierW, slitCenterY - slitSepPx / 2 - slitWidthPx / 2);
      ctx.fillRect(barrierX - barrierW / 2, slitCenterY - slitSepPx / 2 + slitWidthPx / 2, barrierW, slitSepPx - slitWidthPx);
      ctx.fillRect(barrierX - barrierW / 2, slitCenterY + slitSepPx / 2 + slitWidthPx / 2, barrierW, H);

      // Draw wavefronts from source
      var t = s.t;
      var waveSpeed = 200 * S;
      var wlPx = 30 * S;
      ctx.strokeStyle = 'rgba(100,180,255,0.15)';
      ctx.lineWidth = 1.5 * S;
      for (var r = 0; r < barrierX; r += wlPx) {
        var phase = r - waveSpeed * t;
        if (phase < 0) phase = ((phase % wlPx) + wlPx) % wlPx;
        var drawR = phase;
        while (drawR < barrierX + 200) {
          ctx.beginPath();
          ctx.arc(50, slitCenterY, drawR, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
          drawR += wlPx;
        }
      }

      // Draw diffracted wavefronts from each slit
      var slit1Y = slitCenterY - slitSepPx / 2;
      var slit2Y = slitCenterY + slitSepPx / 2;
      ctx.strokeStyle = 'rgba(100,200,100,0.1)';
      for (var wr = 0; wr < W; wr += wlPx) {
        var wPhase = wr - waveSpeed * t;
        if (wPhase < 0) wPhase = ((wPhase % wlPx) + wlPx) % wlPx;
        var dr = wPhase;
        while (dr < W) {
          ctx.beginPath();
          ctx.arc(barrierX, slit1Y, dr, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(barrierX, slit2Y, dr, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.stroke();
          dr += wlPx;
        }
      }

      // Draw screen
      ctx.fillStyle = '#222';
      ctx.fillRect(screenX, 0, 3 * S, H);

      // Draw accumulated particles on screen
      var yScale = (H * 0.8) / 0.02;
      var dotSize = Math.max(1, 2 * S);
      for (var i = 0; i < s.particles.length; i++) {
        var py = slitCenterY - s.particles[i] * yScale;
        ctx.fillStyle = 'rgba(100,200,255,0.4)';
        ctx.fillRect(screenX + 6 * S + Math.random() * 50 * S, py, dotSize, dotSize);
      }

      // Draw intensity curve
      ctx.beginPath();
      var curveX = screenX + 60 * S;
      for (var y = 0; y < H; y++) {
        var yMeters = -(y - slitCenterY) / yScale;
        var sinTh = yMeters / Math.sqrt(yMeters * yMeters + c.screen_distance * c.screen_distance);
        var dp = Math.PI * c.slit_separation * sinTh / c.wavelength;
        var ap = Math.PI * c.slit_width * sinTh / c.wavelength;
        var intrf = Math.cos(dp);
        var diff = Math.abs(ap) < 1e-10 ? 1 : Math.sin(ap) / ap;
        var I = intrf * intrf * diff * diff;
        var xPlot = curveX + I * 80 * S;
        if (y === 0) ctx.moveTo(xPlot, y);
        else ctx.lineTo(xPlot, y);
      }
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Labels
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(13 * S) + 'px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('n=' + s.particleCount + '  \u03BB=' + (c.wavelength * 1e9).toFixed(0) + 'nm  d=' + (c.slit_separation * 1e3).toFixed(3) + 'mm', 8 * S, 16 * S);
    },

    getEquations: function () {
      return ['double_slit_intensity', 'constructive_interference', 'de_broglie'];
    },
  });

  // ── 7. ElectricFieldSim ───────────────────────────────────────────────────

  function ElectricFieldSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
  }

  extend(PhysicsSim, ElectricFieldSim, {
    defaults: {
      charges: [
        { x: 0.35, y: 0.5, q: 1 },
        { x: 0.65, y: 0.5, q: -1 },
      ],
    },

    _initState: function () {
      this.state = { t: 0 };
      this._computeFieldLines();
    },

    _computeFieldLines: function () {
      var c = this.config;
      var W = this.canvas.width, H = this.canvas.height;
      this._fieldLines = [];

      // Generate field lines starting from positive charges
      var charges = c.charges;
      var numLines = 16;

      for (var ci = 0; ci < charges.length; ci++) {
        if (charges[ci].q <= 0) continue;

        var cx = charges[ci].x * W;
        var cy = charges[ci].y * H;

        for (var li = 0; li < numLines; li++) {
          var angle = (li / numLines) * TAU;
          var startR = 20;
          var px = cx + startR * Math.cos(angle);
          var py = cy + startR * Math.sin(angle);
          var line = [{ x: px, y: py }];

          // Trace field line by following E direction
          var stepSize = 5;
          for (var step = 0; step < 300; step++) {
            var Ex = 0, Ey = 0;
            for (var j = 0; j < charges.length; j++) {
              var qx = charges[j].x * W;
              var qy = charges[j].y * H;
              var dx = px - qx;
              var dy = py - qy;
              var r2 = dx * dx + dy * dy;
              if (r2 < 100) { step = 999; break; }  // too close, stop
              var r3 = Math.pow(r2, 1.5);
              Ex += charges[j].q * dx / r3;
              Ey += charges[j].q * dy / r3;
            }
            var Emag = Math.sqrt(Ex * Ex + Ey * Ey);
            if (Emag < 1e-10) break;
            px += stepSize * Ex / Emag;
            py += stepSize * Ey / Emag;

            if (px < -50 || px > W + 50 || py < -50 || py > H + 50) break;
            line.push({ x: px, y: py });
          }
          this._fieldLines.push(line);
        }
      }
    },

    step: function () {
      this.state.t += this.dt;
    },

    render: function () {
      var ctx = this.ctx, c = this.config;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      // Draw equipotential lines (background)
      var charges = c.charges;
      var step = 6;
      for (var py = 0; py < H; py += step) {
        for (var px = 0; px < W; px += step) {
          var V = 0;
          for (var ci = 0; ci < charges.length; ci++) {
            var dx = px - charges[ci].x * W;
            var dy = py - charges[ci].y * H;
            var r = Math.sqrt(dx * dx + dy * dy);
            if (r < 5) r = 5;
            V += charges[ci].q / r;
          }
          // Map potential to subtle color
          var intensity = Math.atan(V * 50) / Math.PI + 0.5; // 0 to 1
          var r2 = Math.floor(intensity * 40);
          var b2 = Math.floor((1 - intensity) * 40);
          ctx.fillStyle = 'rgb(' + r2 + ',10,' + b2 + ')';
          ctx.fillRect(px, py, step, step);
        }
      }

      // Draw field lines
      for (var fi = 0; fi < this._fieldLines.length; fi++) {
        var line = this._fieldLines[fi];
        if (line.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (var li = 1; li < line.length; li++) {
          ctx.lineTo(line[li].x, line[li].y);
        }
        ctx.strokeStyle = 'rgba(200,200,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrowhead at midpoint
        if (line.length > 10) {
          var mid = Math.floor(line.length * 0.4);
          var p0 = line[mid - 1], p1 = line[mid];
          var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x - 10 * Math.cos(angle - 0.4), p1.y - 10 * Math.sin(angle - 0.4));
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x - 10 * Math.cos(angle + 0.4), p1.y - 10 * Math.sin(angle + 0.4));
          ctx.strokeStyle = 'rgba(200,200,255,0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw charges
      var S = this._s;
      for (var ci2 = 0; ci2 < charges.length; ci2++) {
        var ch = charges[ci2];
        var qx = ch.x * W, qy = ch.y * H;
        var radius = (16 + Math.abs(ch.q) * 4) * S;

        ctx.beginPath();
        ctx.arc(qx, qy, radius, 0, TAU);
        if (ch.q > 0) {
          var grad = ctx.createRadialGradient(qx - 2 * S, qy - 2 * S, 2 * S, qx, qy, radius);
          grad.addColorStop(0, '#ff6b6b');
          grad.addColorStop(1, '#c0392b');
          ctx.fillStyle = grad;
        } else {
          var grad2 = ctx.createRadialGradient(qx - 2 * S, qy - 2 * S, 2 * S, qx, qy, radius);
          grad2.addColorStop(0, '#74b9ff');
          grad2.addColorStop(1, '#2980b9');
          ctx.fillStyle = grad2;
        }
        ctx.fill();

        // +/- label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + Math.round(18 * S) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch.q > 0 ? '+' : '\u2013', qx, qy);
      }

      ctx.textBaseline = 'alphabetic';

      // Info
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(13 * S) + 'px monospace';
      ctx.textAlign = 'left';
      for (var ci3 = 0; ci3 < charges.length; ci3++) {
        ctx.fillText('q' + (ci3 + 1) + '=' + (charges[ci3].q > 0 ? '+' : '') + charges[ci3].q.toFixed(1), 8 * S, (16 + ci3 * 16) * S);
      }
    },

    getEquations: function () {
      return ['coulombs_law', 'electric_field_point', 'electric_potential', 'gauss_law'];
    },
  });

  // ── 8. HarmonicOscillatorSim ──────────────────────────────────────────────

  function HarmonicOscillatorSim(canvas, config) {
    PhysicsSim.call(this, canvas, config);
    this.phaseTrail = [];
    this.maxTrailLength = 600;
  }

  extend(PhysicsSim, HarmonicOscillatorSim, {
    defaults: { mass: 1, k: 10, damping: 0.1, driving_frequency: 0, driving_amplitude: 0, x0: 1, v0: 0 },

    _initState: function () {
      this.config.x0 = normalizeDisplacementUnits(this.config.x0);
      this.config.v0 = normalizeDisplacementUnits(this.config.v0 || 0);
      this.state = {
        x: this.config.x0 || 1,
        v: this.config.v0 || 0,
      };
      this.phaseTrail = [];
    },

    _cloneState: function () {
      var base = PhysicsSim.prototype._cloneState.call(this);
      base.phaseTrail = this.phaseTrail.slice(-this.maxTrailLength).map(function (p) { return p.slice(); });
      return base;
    },

    _loadSnapshot: function (snap) {
      PhysicsSim.prototype._loadSnapshot.call(this, snap);
      this.phaseTrail = (snap.phaseTrail || []).map(function (p) { return p.slice(); });
    },

    step: function () {
      var s = this.state, c = this.config, dt = this.dt;
      var t = this.simulationTime;

      // Driven, damped harmonic oscillator: mx'' + bx' + kx = F0*cos(wd*t)
      function accel(x, v, time) {
        var force = -c.k * x - c.damping * v;
        if (c.driving_amplitude > 0 && c.driving_frequency > 0) {
          force += c.driving_amplitude * Math.cos(c.driving_frequency * time);
        }
        return force / c.mass;
      }

      // RK4
      var k1v = accel(s.x, s.v, t);
      var k1x = s.v;
      var k2v = accel(s.x + 0.5 * dt * k1x, s.v + 0.5 * dt * k1v, t + 0.5 * dt);
      var k2x = s.v + 0.5 * dt * k1v;
      var k3v = accel(s.x + 0.5 * dt * k2x, s.v + 0.5 * dt * k2v, t + 0.5 * dt);
      var k3x = s.v + 0.5 * dt * k2v;
      var k4v = accel(s.x + dt * k3x, s.v + dt * k3v, t + dt);
      var k4x = s.v + dt * k3v;

      s.x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      s.v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);

      // Phase space trail
      this.phaseTrail.push([s.x, s.v]);
      if (this.phaseTrail.length > this.maxTrailLength) this.phaseTrail.shift();
    },

    render: function () {
      var ctx = this.ctx, s = this.state, c = this.config, S = this._s;
      var W = this.canvas.width, H = this.canvas.height;
      this._clear();

      // Dynamic ranges keep the system readable even when params are extreme.
      var xRange = Math.max(1.2, Math.abs(c.x0 || 0), Math.abs(s.x || 0));
      var vRange = Math.max(1.2, Math.abs(c.v0 || 0), Math.abs(s.v || 0));
      for (var iRange = Math.max(0, this.phaseTrail.length - 160); iRange < this.phaseTrail.length; iRange++) {
        var pRange = this.phaseTrail[iRange];
        xRange = Math.max(xRange, Math.abs(pRange[0]));
        vRange = Math.max(vRange, Math.abs(pRange[1]));
      }
      xRange *= 1.2;
      vRange *= 1.25;

      // ── Left half: spring-mass system ──
      var springLeft = W * 0.05;
      var springRight = W * 0.45;
      var springY = H * 0.35;
      var eqX = (springLeft + springRight) * 0.5;
      var springHalfSpan = (springRight - springLeft) * 0.42;
      var pxPerUnit = springHalfSpan / Math.max(xRange, 0.001);
      var massX = eqX + s.x * pxPerUnit;
      var minMassX = springLeft + 28 * S;
      var maxMassX = springRight - 28 * S;
      massX = clamp(massX, minMassX, maxMassX);
      var massW = 50 * S, massH = 40 * S;

      // Wall
      var wallW = 8 * S, wallH = 80 * S;
      ctx.fillStyle = '#555';
      ctx.fillRect(springLeft - wallW, springY - wallH / 2, wallW, wallH);
      for (var hy = springY - wallH / 2; hy < springY + wallH / 2; hy += 10 * S) {
        ctx.beginPath();
        ctx.moveTo(springLeft - wallW, hy);
        ctx.lineTo(springLeft - wallW - 12 * S, hy + 8 * S);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1 * S;
        ctx.stroke();
      }

      // Spring (zigzag)
      var coils = 10;
      var sLen = massX - massW / 2 - springLeft;
      var coilW = sLen / coils;
      var coilH = 14 * S;
      ctx.beginPath();
      ctx.moveTo(springLeft, springY);
      for (var i = 0; i < coils; i++) {
        var cx2 = springLeft + (i + 0.25) * coilW;
        var cx3 = springLeft + (i + 0.75) * coilW;
        ctx.lineTo(cx2, springY - coilH);
        ctx.lineTo(cx3, springY + coilH);
      }
      ctx.lineTo(massX - massW / 2, springY);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // Mass block
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(massX - massW / 2, springY - massH / 2, massW, massH);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 * S;
      ctx.strokeRect(massX - massW / 2, springY - massH / 2, massW, massH);

      // Equilibrium marker
      ctx.beginPath();
      ctx.setLineDash([3 * S, 3 * S]);
      ctx.moveTo(eqX, springY - 50 * S);
      ctx.lineTo(eqX, springY + 50 * S);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1 * S;
      ctx.stroke();
      ctx.setLineDash([]);

      // Displacement arrow
      if (Math.abs(s.x) > 0.05) {
        this._drawArrow(eqX, springY + 45 * S, massX, springY + 45 * S, '#f97316', 2 * S);
      }

      // ── Right half: phase space plot ──
      var plotLeft = W * 0.55, plotTop = H * 0.1;
      var plotW = W * 0.38, plotH = H * 0.45;

      // Axes
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1 * S;
      ctx.beginPath();
      ctx.moveTo(plotLeft, plotTop + plotH / 2);
      ctx.lineTo(plotLeft + plotW, plotTop + plotH / 2);
      ctx.moveTo(plotLeft + plotW / 2, plotTop);
      ctx.lineTo(plotLeft + plotW / 2, plotTop + plotH);
      ctx.stroke();

      ctx.fillStyle = '#888';
      ctx.font = Math.round(11 * S) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('x', plotLeft + plotW - 8 * S, plotTop + plotH / 2 + 14 * S);
      ctx.fillText('v', plotLeft + plotW / 2 + 14 * S, plotTop + 10 * S);

      // Phase trail
      if (this.phaseTrail.length > 1) {
        var xScale = (plotW * 0.45) / Math.max(xRange, 0.001);
        var vScale = (plotH * 0.45) / Math.max(vRange, 0.001);
        var pcx = plotLeft + plotW / 2;
        var pcy = plotTop + plotH / 2;

        ctx.beginPath();
        for (var i2 = 0; i2 < this.phaseTrail.length; i2++) {
          var pt = this.phaseTrail[i2];
          var ppx = pcx + pt[0] * xScale;
          var ppy = pcy - pt[1] * vScale;
          if (i2 === 0) ctx.moveTo(ppx, ppy);
          else ctx.lineTo(ppx, ppy);
        }
        ctx.strokeStyle = 'rgba(100,200,100,0.6)';
        ctx.lineWidth = 1.5 * S;
        ctx.stroke();

        // Current point
        var cur = this.phaseTrail[this.phaseTrail.length - 1];
        ctx.beginPath();
        ctx.arc(pcx + cur[0] * xScale, pcy - cur[1] * vScale, 4 * S, 0, TAU);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }

      // ── Bottom: x(t) time series ──
      var tsTop = H * 0.65, tsH = H * 0.25;
      var tsLeft = W * 0.08, tsW = W * 0.85;

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1 * S;
      ctx.beginPath();
      ctx.moveTo(tsLeft, tsTop + tsH / 2);
      ctx.lineTo(tsLeft + tsW, tsTop + tsH / 2);
      ctx.stroke();

      // Plot recent displacement history from trail
      if (this.phaseTrail.length > 1) {
        var tWindow = 5;
        var samplesPerSec = Math.round(1 / this.dt);
        var totalSamples = Math.min(this.phaseTrail.length, Math.round(tWindow * samplesPerSec / 2));
        var tsXScale = (tsH * 0.38) / Math.max(xRange, 0.001);
        ctx.beginPath();
        for (var i3 = 0; i3 < totalSamples; i3++) {
          var idx = this.phaseTrail.length - totalSamples + i3;
          if (idx < 0) continue;
          var xVal = this.phaseTrail[idx][0];
          var tpx = tsLeft + (i3 / totalSamples) * tsW;
          var tpy = tsTop + tsH / 2 - xVal * tsXScale;
          if (i3 === 0) ctx.moveTo(tpx, tpy);
          else ctx.lineTo(tpx, tpy);
        }
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 * S;
        ctx.stroke();
      }

      // Info
      ctx.fillStyle = '#ccc';
      ctx.font = Math.round(12 * S) + 'px monospace';
      ctx.textAlign = 'left';
      var omega0 = Math.sqrt(c.k / c.mass);
      ctx.fillText('x=' + s.x.toFixed(2) + '  v=' + s.v.toFixed(2) + '  \u03C9\u2080=' + omega0.toFixed(1) + '  t=' + this.simulationTime.toFixed(1), 8 * S, H - 6 * S);
    },

    getEquations: function () {
      return ['shm_ode', 'shm_solution', 'resonance_freq', 'damped_oscillator', 'driven_oscillator'];
    },
  });

  // ── GSAP/WVC Integration Helper ───────────────────────────────────────────

  /**
   * Register a simulation with the scene's GSAP timeline.
   * This is the bridge between physics sims and WVC's virtual time.
   *
   * @param {PhysicsSim} sim — initialized simulation instance
   * @param {number} duration — scene duration in seconds
   * @param {Object} [opts] — { startAt: 0, tl: window.__tl }
   */
  function registerWithTimeline(sim, duration, opts) {
    opts = opts || {};
    var tl = opts.tl || window.__tl;
    var startAt = opts.startAt || 0;

    if (!tl) {
      console.warn('[PhysicsSims] No GSAP timeline found. Sim will not be seekable.');
      return;
    }

    // Precompute snapshots for the full duration
    sim.precompute(duration);

    // Create a GSAP tween that drives the simulation via seekTo
    var proxy = { t: 0 };
    tl.to(proxy, {
      t: duration,
      duration: duration,
      ease: 'none',
      onUpdate: function () {
        sim.seekTo(proxy.t);
      },
    }, startAt);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  window.PhysicsSims = {
    // Base class
    PhysicsSim: PhysicsSim,

    // Simulations
    PendulumSim: PendulumSim,
    DoublePendulumSim: DoublePendulumSim,
    ProjectileSim: ProjectileSim,
    OrbitalSim: OrbitalSim,
    WaveInterferenceSim: WaveInterferenceSim,
    DoubleSlitSim: DoubleSlitSim,
    ElectricFieldSim: ElectricFieldSim,
    HarmonicOscillatorSim: HarmonicOscillatorSim,

    // Integration
    registerWithTimeline: registerWithTimeline,

    // Utility
    mulberry32: mulberry32,
  };
})();
