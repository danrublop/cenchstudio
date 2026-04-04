/**
 * Physics Equation Database for Cench Studio
 * Pre-validated LaTeX equations with plain-language descriptions.
 * The agent injects these into scenes rather than writing LaTeX from scratch.
 *
 * Usage in scene HTML:
 *   const eq = PhysicsEquations.pendulum_period;
 *   // eq.latex  → LaTeX string for MathJax
 *   // eq.description → plain English
 *   // eq.variables → { symbol: 'description (units)' }
 */
(function () {
  'use strict';

  window.PhysicsEquations = {

    // ── Mechanics: Pendulum ─────────────────────────────────────────────────

    pendulum_period: {
      latex: 'T = 2\\pi\\sqrt{\\frac{L}{g}}',
      description: 'Period of a simple pendulum (small angle approximation)',
      variables: { T: 'period (s)', L: 'length (m)', g: 'gravitational acceleration (m/s\u00B2)' },
      category: 'mechanics',
    },
    pendulum_ode: {
      latex: '\\ddot{\\theta} = -\\frac{g}{L}\\sin\\theta',
      description: 'Exact equation of motion for a simple pendulum',
      variables: { '\\theta': 'angle from vertical (rad)', g: 'gravitational acceleration (m/s\u00B2)', L: 'length (m)' },
      category: 'mechanics',
    },
    pendulum_damped: {
      latex: '\\ddot{\\theta} = -\\frac{g}{L}\\sin\\theta - b\\dot{\\theta}',
      description: 'Damped pendulum equation of motion',
      variables: { b: 'damping coefficient (1/s)', '\\theta': 'angle (rad)' },
      category: 'mechanics',
    },

    // ── Mechanics: Double Pendulum ──────────────────────────────────────────

    double_pendulum_lagrangian: {
      latex: 'L = \\frac{1}{2}(m_1+m_2)L_1^2\\dot{\\theta}_1^2 + \\frac{1}{2}m_2 L_2^2\\dot{\\theta}_2^2 + m_2 L_1 L_2 \\dot{\\theta}_1\\dot{\\theta}_2\\cos(\\theta_1-\\theta_2) + (m_1+m_2)gL_1\\cos\\theta_1 + m_2 g L_2\\cos\\theta_2',
      description: 'Lagrangian of the double pendulum system',
      variables: { m_1: 'mass 1 (kg)', m_2: 'mass 2 (kg)', L_1: 'length 1 (m)', L_2: 'length 2 (m)' },
      category: 'mechanics',
    },
    lyapunov_exponent: {
      latex: '\\lambda = \\lim_{t\\to\\infty} \\frac{1}{t} \\ln\\frac{|\\delta\\mathbf{Z}(t)|}{|\\delta\\mathbf{Z}(0)|}',
      description: 'Lyapunov exponent — measures rate of divergence of nearby trajectories',
      variables: { '\\lambda': 'Lyapunov exponent (1/s)', '\\delta\\mathbf{Z}': 'phase-space separation' },
      category: 'mechanics',
    },

    // ── Mechanics: Projectile ───────────────────────────────────────────────

    projectile_x: {
      latex: 'x(t) = v_0\\cos(\\theta)\\cdot t',
      description: 'Horizontal position in projectile motion (no air resistance)',
      variables: { v_0: 'initial speed (m/s)', '\\theta': 'launch angle (rad)', t: 'time (s)' },
      category: 'mechanics',
    },
    projectile_y: {
      latex: 'y(t) = v_0\\sin(\\theta)\\cdot t - \\frac{1}{2}gt^2',
      description: 'Vertical position in projectile motion',
      variables: { g: 'gravitational acceleration (m/s\u00B2)' },
      category: 'mechanics',
    },
    projectile_range: {
      latex: 'R = \\frac{v_0^2 \\sin(2\\theta)}{g}',
      description: 'Range of a projectile on flat ground',
      variables: { R: 'range (m)' },
      category: 'mechanics',
    },
    projectile_max_height: {
      latex: 'H = \\frac{v_0^2 \\sin^2(\\theta)}{2g}',
      description: 'Maximum height of a projectile',
      variables: { H: 'max height (m)' },
      category: 'mechanics',
    },
    projectile_time_of_flight: {
      latex: 'T = \\frac{2v_0\\sin(\\theta)}{g}',
      description: 'Total time of flight for a projectile',
      variables: { T: 'time of flight (s)' },
      category: 'mechanics',
    },

    // ── Mechanics: Orbital ──────────────────────────────────────────────────

    newtons_gravity: {
      latex: 'F = G\\frac{m_1 m_2}{r^2}',
      description: "Newton's law of universal gravitation",
      variables: { G: 'gravitational constant (6.674\u00D710\u207B\u00B9\u00B9 N\u00B7m\u00B2/kg\u00B2)', r: 'distance between centers (m)' },
      category: 'mechanics',
    },
    keplers_third: {
      latex: 'T^2 = \\frac{4\\pi^2}{GM}a^3',
      description: "Kepler's third law \u2014 orbital period vs semi-major axis",
      variables: { T: 'orbital period (s)', a: 'semi-major axis (m)', M: 'central mass (kg)' },
      category: 'mechanics',
    },
    vis_viva: {
      latex: 'v^2 = GM\\left(\\frac{2}{r} - \\frac{1}{a}\\right)',
      description: 'Vis-viva equation \u2014 orbital speed at any point',
      variables: { v: 'orbital speed (m/s)', r: 'current distance (m)', a: 'semi-major axis (m)' },
      category: 'mechanics',
    },
    escape_velocity: {
      latex: 'v_e = \\sqrt{\\frac{2GM}{r}}',
      description: 'Escape velocity from a gravitational field',
      variables: { v_e: 'escape velocity (m/s)' },
      category: 'mechanics',
    },

    // ── Waves ───────────────────────────────────────────────────────────────

    wave_equation: {
      latex: '\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\frac{\\partial^2 u}{\\partial x^2}',
      description: 'One-dimensional wave equation',
      variables: { u: 'displacement', c: 'wave speed (m/s)' },
      category: 'waves',
    },
    wave_superposition: {
      latex: 'y = A_1\\sin(kx - \\omega t) + A_2\\sin(kx - \\omega t + \\phi)',
      description: 'Superposition of two waves with phase difference',
      variables: { A: 'amplitude', k: 'wave number (1/m)', '\\omega': 'angular frequency (rad/s)', '\\phi': 'phase difference (rad)' },
      category: 'waves',
    },
    constructive_interference: {
      latex: '\\Delta = d\\sin\\theta = m\\lambda, \\quad m = 0, \\pm1, \\pm2, \\ldots',
      description: 'Condition for constructive interference (double slit)',
      variables: { d: 'slit separation (m)', '\\lambda': 'wavelength (m)', m: 'order number' },
      category: 'waves',
    },
    destructive_interference: {
      latex: '\\Delta = d\\sin\\theta = \\left(m + \\tfrac{1}{2}\\right)\\lambda',
      description: 'Condition for destructive interference',
      variables: {},
      category: 'waves',
    },

    // ── Quantum / Double Slit ───────────────────────────────────────────────

    double_slit_intensity: {
      latex: 'I(\\theta) = I_0 \\cos^2\\!\\left(\\frac{\\pi d \\sin\\theta}{\\lambda}\\right) \\operatorname{sinc}^2\\!\\left(\\frac{\\pi a \\sin\\theta}{\\lambda}\\right)',
      description: 'Full intensity pattern from double slit (interference \u00D7 diffraction envelope)',
      variables: { d: 'slit separation (m)', a: 'slit width (m)', '\\lambda': 'wavelength (m)', I_0: 'peak intensity' },
      category: 'quantum',
    },
    de_broglie: {
      latex: '\\lambda = \\frac{h}{p} = \\frac{h}{mv}',
      description: 'de Broglie wavelength \u2014 matter wave relation',
      variables: { h: "Planck's constant (6.626\u00D710\u207B\u00B3\u2074 J\u00B7s)", p: 'momentum (kg\u00B7m/s)' },
      category: 'quantum',
    },

    // ── Electromagnetism ────────────────────────────────────────────────────

    coulombs_law: {
      latex: 'F = k_e\\frac{q_1 q_2}{r^2}',
      description: "Coulomb's law \u2014 electrostatic force between point charges",
      variables: { k_e: "Coulomb's constant (8.99\u00D710\u2079 N\u00B7m\u00B2/C\u00B2)", q: 'charge (C)', r: 'distance (m)' },
      category: 'electromagnetism',
    },
    electric_field_point: {
      latex: '\\vec{E} = k_e\\frac{q}{r^2}\\hat{r}',
      description: 'Electric field from a point charge',
      variables: { '\\vec{E}': 'electric field (N/C)', '\\hat{r}': 'unit vector from charge' },
      category: 'electromagnetism',
    },
    electric_potential: {
      latex: 'V = k_e\\frac{q}{r}',
      description: 'Electric potential from a point charge',
      variables: { V: 'electric potential (V)' },
      category: 'electromagnetism',
    },
    gauss_law: {
      latex: '\\oint \\vec{E} \\cdot d\\vec{A} = \\frac{Q_{\\text{enc}}}{\\varepsilon_0}',
      description: "Gauss's law \u2014 electric flux through a closed surface",
      variables: { Q: 'enclosed charge (C)', '\\varepsilon_0': 'permittivity of free space' },
      category: 'electromagnetism',
    },

    // ── Simple Harmonic Motion ──────────────────────────────────────────────

    shm_ode: {
      latex: '\\ddot{x} = -\\frac{k}{m}x',
      description: 'Simple harmonic oscillator equation of motion',
      variables: { k: 'spring constant (N/m)', m: 'mass (kg)', x: 'displacement (m)' },
      category: 'mechanics',
    },
    shm_solution: {
      latex: 'x(t) = A\\cos(\\omega_0 t + \\phi)',
      description: 'General solution for simple harmonic motion',
      variables: { A: 'amplitude (m)', '\\omega_0': 'natural frequency (rad/s)', '\\phi': 'initial phase (rad)' },
      category: 'mechanics',
    },
    resonance_freq: {
      latex: '\\omega_0 = \\sqrt{\\frac{k}{m}}',
      description: 'Natural (resonance) frequency of a spring-mass system',
      variables: {},
      category: 'mechanics',
    },
    damped_oscillator: {
      latex: 'm\\ddot{x} + b\\dot{x} + kx = 0',
      description: 'Damped harmonic oscillator',
      variables: { b: 'damping coefficient (kg/s)' },
      category: 'mechanics',
    },
    driven_oscillator: {
      latex: 'm\\ddot{x} + b\\dot{x} + kx = F_0\\cos(\\omega_d t)',
      description: 'Driven (forced) harmonic oscillator',
      variables: { F_0: 'driving force amplitude (N)', '\\omega_d': 'driving frequency (rad/s)' },
      category: 'mechanics',
    },
    resonance_amplitude: {
      latex: 'A(\\omega_d) = \\frac{F_0/m}{\\sqrt{(\\omega_0^2 - \\omega_d^2)^2 + (b\\omega_d/m)^2}}',
      description: 'Steady-state amplitude of a driven oscillator',
      variables: {},
      category: 'mechanics',
    },

    // ── Energy ──────────────────────────────────────────────────────────────

    energy_conservation: {
      latex: 'E = \\frac{1}{2}mv^2 + mgh = \\text{const}',
      description: 'Conservation of mechanical energy',
      variables: { E: 'total energy (J)', m: 'mass (kg)', v: 'speed (m/s)', h: 'height (m)' },
      category: 'mechanics',
    },
    kinetic_energy: {
      latex: 'KE = \\frac{1}{2}mv^2',
      description: 'Kinetic energy',
      variables: {},
      category: 'mechanics',
    },
    potential_energy_gravity: {
      latex: 'PE = mgh',
      description: 'Gravitational potential energy near surface',
      variables: {},
      category: 'mechanics',
    },
    potential_energy_spring: {
      latex: 'PE = \\frac{1}{2}kx^2',
      description: 'Elastic potential energy of a spring',
      variables: {},
      category: 'mechanics',
    },

    // ── Thermodynamics ──────────────────────────────────────────────────────

    ideal_gas: {
      latex: 'PV = nRT',
      description: 'Ideal gas law',
      variables: { P: 'pressure (Pa)', V: 'volume (m\u00B3)', n: 'amount of substance (mol)', R: 'gas constant (8.314 J/(mol\u00B7K))', T: 'temperature (K)' },
      category: 'thermodynamics',
    },
    first_law_thermo: {
      latex: '\\Delta U = Q - W',
      description: 'First law of thermodynamics',
      variables: { '\\Delta U': 'change in internal energy (J)', Q: 'heat added (J)', W: 'work done by system (J)' },
      category: 'thermodynamics',
    },
    entropy: {
      latex: '\\Delta S = \\int \\frac{dQ_{\\text{rev}}}{T}',
      description: 'Entropy change for a reversible process',
      variables: { S: 'entropy (J/K)' },
      category: 'thermodynamics',
    },

    // ── Fundamental ─────────────────────────────────────────────────────────

    newtons_second: {
      latex: '\\vec{F} = m\\vec{a}',
      description: "Newton's second law of motion",
      variables: { '\\vec{F}': 'net force (N)', m: 'mass (kg)', '\\vec{a}': 'acceleration (m/s\u00B2)' },
      category: 'mechanics',
    },
    momentum: {
      latex: '\\vec{p} = m\\vec{v}',
      description: 'Linear momentum',
      variables: { '\\vec{p}': 'momentum (kg\u00B7m/s)' },
      category: 'mechanics',
    },
    impulse_momentum: {
      latex: '\\vec{F}\\Delta t = \\Delta\\vec{p}',
      description: 'Impulse-momentum theorem',
      variables: {},
      category: 'mechanics',
    },
  };

  /**
   * Look up equations by category.
   * @param {string} category - e.g. 'mechanics', 'waves', 'electromagnetism', 'quantum', 'thermodynamics'
   * @returns {Object} subset of PhysicsEquations matching the category
   */
  window.PhysicsEquations.byCategory = function (category) {
    var result = {};
    var eqs = window.PhysicsEquations;
    for (var key in eqs) {
      if (eqs.hasOwnProperty(key) && typeof eqs[key] === 'object' && eqs[key].category === category) {
        result[key] = eqs[key];
      }
    }
    return result;
  };
})();
