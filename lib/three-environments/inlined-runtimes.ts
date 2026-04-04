/**
 * Three.js stage + scatter helpers injected into generated scene HTML (client-safe; bundled with the app).
 * Edit this file directly when changing environments or scatter behavior.
 */
export const THREE_ENVIRONMENT_RUNTIME_SCRIPT = `/**
 * Injected into Three.js scene HTML (after window.THREE is set).
 * API:
 *   applyCenchThreeEnvironment(envId, scene, renderer, camera)
 *   updateCenchThreeEnvironment(t)  // call each frame with seconds (e.g. __tl.time())
 */
(function initCenchThreeEnvironments() {
  var THREE = window.THREE;
  if (!THREE) return;

  function det(i, seed) {
    var x = Math.sin(i * 12.9898 + (seed || 0) * 78.233) * 43758.5453123;
    return x - Math.floor(x);
  }

  function disposeGroup(g) {
    if (!g) return;
    g.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
        else obj.material.dispose();
      }
    });
  }

  function clearEnv(scene) {
    var old = scene.getObjectByName('__cenchEnvRoot');
    if (old) {
      disposeGroup(old);
      scene.remove(old);
    }
    scene.fog = null;
    if (scene.background && scene.background.isTexture) {
      /* leave user textures alone if any */
    }
    window.__cenchEnvState = { update: null, refs: {} };
  }

  window.CENCH_THREE_ENV_IDS = ['track_rolling_topdown'];

  window.applyCenchThreeEnvironment = function (envId, scene, renderer, camera) {
    if (!scene || !renderer) return;
    clearEnv(scene);

    var root = new THREE.Group();
    root.name = '__cenchEnvRoot';
    var refs = {};
    var state = window.__cenchEnvState;
    state.refs = refs;

    if (envId !== 'track_rolling_topdown') {
      console.warn('applyCenchThreeEnvironment: env "' + envId + '" is no longer available; using track_rolling_topdown');
      envId = 'track_rolling_topdown';
    }

    switch (envId) {
      case 'track_rolling_topdown': {
        scene.background = new THREE.Color(0xf1f5f9);
        renderer.setClearColor(0xeef2f6);
        var table = new THREE.Mesh(
          new THREE.PlaneGeometry(30, 18),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.06 }),
        );
        table.rotation.x = -Math.PI / 2;
        table.receiveShadow = true;
        root.add(table);
        var divMat = new THREE.MeshStandardMaterial({ color: 0xd1d9e6, roughness: 0.45, metalness: 0.12 });
        [-2.7, 0, 2.7].forEach(function (dz) {
          var div = new THREE.Mesh(new THREE.BoxGeometry(26, 0.045, 0.07), divMat);
          div.position.set(0, 0.022, dz);
          div.receiveShadow = true;
          root.add(div);
        });
        [-5.35, 5.35].forEach(function (dz) {
          var edge = new THREE.Mesh(
            new THREE.BoxGeometry(26, 0.035, 0.055),
            new THREE.MeshStandardMaterial({ color: 0xb8c5d6, roughness: 0.5, metalness: 0.08 }),
          );
          edge.position.set(0, 0.023, dz);
          root.add(edge);
        });
        function makePatternTex(kind, hexA, hexB) {
          var cnv = document.createElement('canvas');
          cnv.width = 256;
          cnv.height = 128;
          var cx = cnv.getContext('2d');
          cx.fillStyle = hexA;
          cx.fillRect(0, 0, 256, 128);
          cx.fillStyle = hexB;
          if (kind === 0) {
            for (var x = 0; x < 256; x += 32) cx.fillRect(x, 0, 14, 128);
          } else if (kind === 1) {
            for (var y = 0; y < 128; y += 20) cx.fillRect(0, y, 256, 8);
          } else if (kind === 2) {
            var r = 12;
            for (var py = 0; py < 4; py++) {
              for (var px = 0; px < 8; px++) {
                cx.beginPath();
                cx.arc(px * 32 + 16, py * 32 + 16, r, 0, Math.PI * 2);
                cx.fill();
              }
            }
          } else {
            cx.strokeStyle = hexB;
            cx.lineWidth = 6;
            for (var g = 0; g < 10; g++) {
              cx.beginPath();
              cx.moveTo(g * 28, 0);
              cx.lineTo(g * 28 + 80, 128);
              cx.stroke();
            }
          }
          var tex = new THREE.CanvasTexture(cnv);
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(3, 2);
          tex.colorSpace = THREE.SRGBColorSpace;
          return tex;
        }
        var laneZ = [-4.05, -1.35, 1.35, 4.05];
        var dirs = [-1, 1, -1, 1];
        var pals = [
          ['#f8fafc', '#e11d48'],
          ['#fff7ed', '#c2410c'],
          ['#eff6ff', '#2563eb'],
          ['#f0fdf4', '#16a34a'],
        ];
        var span = 25;
        var ballR = 0.5;
        refs.trackBalls = [];
        for (var li = 0; li < 4; li++) {
          for (var bi = 0; bi < 3; bi++) {
            var pk = (li + bi) % 4;
            var tex = makePatternTex(pk, pals[pk][0], pals[pk][1]);
            var bmat = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.32,
              metalness: 0.18,
            });
            var ball = new THREE.Mesh(new THREE.SphereGeometry(ballR, 36, 28), bmat);
            ball.castShadow = true;
            var phase = -12.5 + det(li * 9 + bi, 88) * span;
            ball.position.set(phase, ballR, laneZ[li]);
            root.add(ball);
            var spd = 2.1 + det(li * 7 + bi, 89) * 0.65;
            refs.trackBalls.push({
              mesh: ball,
              dir: dirs[li],
              speed: spd,
              phase: phase,
              r: ballR,
            });
          }
        }
        root.add(new THREE.AmbientLight(0xffffff, 0.42));
        var tKey = new THREE.DirectionalLight(0xffffff, 1.05);
        tKey.position.set(-5, 18, 10);
        tKey.castShadow = true;
        tKey.shadow.mapSize.set(2048, 2048);
        tKey.shadow.camera.near = 2;
        tKey.shadow.camera.far = 32;
        tKey.shadow.camera.left = -16;
        tKey.shadow.camera.right = 16;
        tKey.shadow.camera.top = 16;
        tKey.shadow.camera.bottom = -16;
        tKey.shadow.bias = -0.0004;
        root.add(tKey);
        var tFill = new THREE.DirectionalLight(0xe2e8f0, 0.38);
        tFill.position.set(10, 12, -8);
        root.add(tFill);
        var tRim = new THREE.DirectionalLight(0xfef9c3, 0.22);
        tRim.position.set(0, 8, -12);
        root.add(tRim);
        camera.position.set(0, 17.2, 0.01);
        camera.lookAt(0, 0, 0);
        state.update = function (t) {
          var tt = typeof t === 'number' ? t : 0;
          refs.trackBalls.forEach(function (b) {
            var u = b.phase + tt * b.dir * b.speed + 12.5;
            u = ((u % span) + span) % span;
            b.mesh.position.x = u - 12.5;
            b.mesh.rotation.z = -b.dir * (tt * b.speed / b.r);
          });
        };
        // Self-driving render loop using native RAF (bypasses playback controller
        // interception) so the background always animates continuously.
        var _envStart = Date.now();
        var _nraf = window.__nativeRAF || requestAnimationFrame;
        (function _envLoop() {
          var t = (Date.now() - _envStart) / 1000;
          state.update(t);
          renderer.render(scene, camera);
          _nraf(_envLoop);
        })();
        break;
      }
      default:
        console.warn('applyCenchThreeEnvironment: unreachable envId', envId);
    }

    scene.add(root);
  };

  window.updateCenchThreeEnvironment = function (t) {
    var st = window.__cenchEnvState;
    if (st && typeof st.update === 'function') st.update(t || 0);
  };
})();
`

export const THREE_SCATTER_RUNTIME_SCRIPT = `/**
 * 3D data scatter — vanilla Three.js helper inspired by the CorticoAI 3d-react-demo
 * (React + react-three-fiber scatterplot style). Original demo: MIT License —
 * https://github.com/CorticoAI/3d-react-demo
 *
 * Injected in the Three template after stage environments. API:
 *   createCenchDataScatterplot(scene, options)
 *   updateCenchDataScatterplot(t)
 */
(function initCenchDataScatterplot() {
  var THREE = window.THREE;
  if (!THREE) return;

  function disposeGroup(g) {
    if (!g) return;
    g.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
        else obj.material.dispose();
      }
    });
  }

  window.createCenchDataScatterplot = function (scene, options) {
    var old = scene.getObjectByName('__cenchScatterRoot');
    if (old) {
      disposeGroup(old);
      scene.remove(old);
    }
    window.__cenchScatterState = { update: null };

    var opts = options || {};
    var raw = opts.points;
    if (!raw || !raw.length) {
      console.warn('createCenchDataScatterplot: no points');
      return;
    }

    var orbitSpeed = typeof opts.orbitSpeed === 'number' ? opts.orbitSpeed : 0.12;
    var pointRadius = typeof opts.pointRadius === 'number' ? opts.pointRadius : 0.14;
    var axisExtent = typeof opts.axisExtent === 'number' ? opts.axisExtent : 7;

    var root = new THREE.Group();
    root.name = '__cenchScatterRoot';

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    var i;
    for (i = 0; i < raw.length; i++) {
      var p = raw[i];
      var px = Number(p.x), py = Number(p.y), pz = Number(p.z);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var cz = (minZ + maxZ) / 2;
    var dx = maxX - minX || 1;
    var dy = maxY - minY || 1;
    var dz = maxZ - minZ || 1;
    var maxSpan = Math.max(dx, dy, dz);
    var scale = (axisExtent * 0.42) / maxSpan;

    var count = raw.length;
    var geo = new THREE.IcosahedronGeometry(pointRadius, 1);
    var mat = new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.45 });
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;

    var dummy = new THREE.Object3D();
    var col = new THREE.Color();
    var zNorm = 0;
    for (i = 0; i < count; i++) {
      var q = raw[i];
      var x = (Number(q.x) - cx) * scale;
      var y = (Number(q.y) - cy) * scale;
      var z = (Number(q.z) - cz) * scale;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      zNorm = maxZ > minZ ? (Number(q.z) - minZ) / (maxZ - minZ) : 0.5;
      col.setHSL(0.55 + zNorm * 0.35, 0.75, 0.52);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);

    var ax = axisExtent * 0.5;
    function axisLine(x0, y0, z0, x1, y1, z1, hex) {
      var g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x0, y0, z0),
        new THREE.Vector3(x1, y1, z1),
      ]);
      var m = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.75 });
      return new THREE.Line(g, m);
    }
    root.add(axisLine(0, 0, 0, ax, 0, 0, 0xf87171));
    root.add(axisLine(0, 0, 0, 0, ax, 0, 0x4ade80));
    root.add(axisLine(0, 0, 0, 0, 0, ax, 0x60a5fa));

    var grid = new THREE.GridHelper(axisExtent * 1.2, 14, 0x334155, 0x1e293b);
    grid.position.y = -axisExtent * 0.35;
    root.add(grid);

    root.position.set(0, axisExtent * 0.08, 0);

    scene.add(root);

    window.__cenchScatterState = {
      update: function (t) {
        root.rotation.y = t * orbitSpeed;
        root.rotation.x = Math.sin(t * 0.2) * 0.04;
      },
    };
  };

  window.updateCenchDataScatterplot = function (t) {
    var st = window.__cenchScatterState;
    if (st && typeof st.update === 'function') st.update(t || 0);
  };
})();
`
