/**
 * Universal playback controller injected into every scene HTML.
 *
 * Creates window.__tl (a paused GSAP master timeline).
 * Scene code adds animations to window.__tl.
 * Parent app controls playback via postMessage.
 *
 * Must be injected AFTER GSAP loads and scene globals are set,
 * but BEFORE scene-specific code runs.
 */

export const PLAYBACK_CONTROLLER = `
(function() {
  // ── performance.now() interception ──────────────────────
  // Canvas2D scenes compute animation time via:
  //   getT() = (performance.now() - startWall) / 1000
  // When RAF is blocked (paused), elapsed wall-clock time
  // shouldn't count toward animation time. We subtract
  // cumulative paused duration from performance.now().
  var _perfNow = performance.now.bind(performance);
  var _pauseOffset = 0;
  var _pauseStart = _perfNow(); // starts paused

  performance.now = function() {
    return _perfNow() - _pauseOffset;
  };

  // ── RAF interception ─────────────────────────────────────
  // Prevent old canvas2d/three.js scenes from auto-starting
  // their requestAnimationFrame loops. We capture the callback
  // and only start it when the parent sends 'play'.
  var _realRAF = window.requestAnimationFrame.bind(window);
  var _realCAF = window.cancelAnimationFrame.bind(window);
  var _realSetTimeout = window.setTimeout.bind(window);
  var _realClearTimeout = window.clearTimeout.bind(window);
  var _realSetInterval = window.setInterval.bind(window);
  var _realClearInterval = window.clearInterval.bind(window);
  // Expose native RAF so overlay widgets (TalkingHead) can bypass interception.
  // When __rafUnlocked is set, _blockRAF skips re-intercepting RAF so
  // TalkingHead's Three.js animation loop keeps running during pause.
  window.__nativeRAF = _realRAF;
  window.__nativeCAF = _realCAF;
  window.__rafUnlocked = false;
  var _pendingRAFCallbacks = [];
  var _rafBlocked = true;  // starts blocked
  var _currentRAFId = null;
  var _timersBlocked = true; // starts blocked (playback paused)
  var _nextQueuedTimerId = 1;
  var _queuedTimeouts = [];
  var _queuedTimeoutMap = {};
  var _activeTimeouts = {};
  var _activeIntervals = {};

  function _flushQueuedTimeouts() {
    if (_timersBlocked || _queuedTimeouts.length === 0) return;
    var queue = _queuedTimeouts.slice();
    _queuedTimeouts = [];
    queue.forEach(function(item) {
      if (!item || !_queuedTimeoutMap[item.id]) return;
      delete _queuedTimeoutMap[item.id];
      var realId = _realSetTimeout(function() {
        delete _activeTimeouts[item.id];
        if (_timersBlocked) {
          _queuedTimeoutMap[item.id] = item;
          _queuedTimeouts.push(item);
          return;
        }
        try { item.cb(); } catch(e) {}
      }, Math.max(0, item.delay || 0));
      _activeTimeouts[item.id] = realId;
    });
  }

  window.setTimeout = function(cb, delay) {
    if (typeof cb !== 'function') {
      return _realSetTimeout(cb, delay);
    }
    var id = _nextQueuedTimerId++;
    var item = { id: id, cb: cb, delay: Number(delay) || 0 };
    if (_timersBlocked) {
      _queuedTimeoutMap[id] = item;
      _queuedTimeouts.push(item);
      return -id;
    }
    var realId = _realSetTimeout(function() {
      delete _activeTimeouts[id];
      if (_timersBlocked) {
        _queuedTimeoutMap[id] = item;
        _queuedTimeouts.push(item);
        return;
      }
      try { cb(); } catch(e) {}
    }, Math.max(0, item.delay));
    _activeTimeouts[id] = realId;
    return id;
  };

  window.clearTimeout = function(id) {
    var absId = Math.abs(Number(id));
    if (!absId) {
      _realClearTimeout(id);
      return;
    }
    if (_queuedTimeoutMap[absId]) {
      delete _queuedTimeoutMap[absId];
      _queuedTimeouts = _queuedTimeouts.filter(function(item) { return item.id !== absId; });
      return;
    }
    if (_activeTimeouts[absId]) {
      _realClearTimeout(_activeTimeouts[absId]);
      delete _activeTimeouts[absId];
      return;
    }
    _realClearTimeout(id);
  };

  window.setInterval = function(cb, delay) {
    if (typeof cb !== 'function') {
      return _realSetInterval(cb, delay);
    }
    var id = _nextQueuedTimerId++;
    var realId = _realSetInterval(function() {
      if (_timersBlocked) return;
      try { cb(); } catch(e) {}
    }, Math.max(1, Number(delay) || 0));
    _activeIntervals[id] = realId;
    return id;
  };

  window.clearInterval = function(id) {
    var absId = Math.abs(Number(id));
    if (absId && _activeIntervals[absId]) {
      _realClearInterval(_activeIntervals[absId]);
      delete _activeIntervals[absId];
      return;
    }
    _realClearInterval(id);
  };

  window.requestAnimationFrame = function(cb) {
    if (_rafBlocked) {
      // Queue the callback — multiple consumers (scene code + TalkingHead) may register
      var queueId = -(_pendingRAFCallbacks.length + 1);
      _pendingRAFCallbacks.push(cb);
      return queueId;
    }
    _currentRAFId = _realRAF(cb);
    return _currentRAFId;
  };
  window.cancelAnimationFrame = function(id) {
    if (id < 0) {
      // Remove from pending queue
      var idx = (-id) - 1;
      if (idx < _pendingRAFCallbacks.length) _pendingRAFCallbacks[idx] = null;
      return;
    }
    _currentRAFId = null;
    _realCAF(id);
  };

  function _unblockRAF() {
    // Accumulate paused duration so performance.now() skips it
    if (_pauseStart !== null) {
      _pauseOffset += _perfNow() - _pauseStart;
      _pauseStart = null;
    }
    _rafBlocked = false;
    _timersBlocked = false;
    // Restore native RAF for GSAP and future calls
    window.requestAnimationFrame = _realRAF;
    window.cancelAnimationFrame = _realCAF;
    // Reset the time origin for old canvas2d code that uses
    // window.startWall. (Local const startWall is handled by
    // the performance.now() interception above.)
    if (typeof window.startWall !== 'undefined') {
      window.startWall = performance.now();
    }
    // Also reset _startTime (used by some old Zdog/Three scenes)
    if (typeof window._startTime !== 'undefined') {
      window._startTime = performance.now();
    }
    _flushQueuedTimeouts();
    // Kick off all queued callbacks (scene code + TalkingHead, etc.)
    var queued = _pendingRAFCallbacks.slice();
    _pendingRAFCallbacks = [];
    queued.forEach(function(cb) { if (cb) _realRAF(cb); });
    // Also call legacy __resume if scene code defined it
    if (window.__resume && window.__resume !== _legacyResume) {
      try { window.__resume(); } catch(e) {}
    }
  }

  function _blockRAF() {
    // Record pause start for performance.now() offset tracking
    if (_pauseStart === null) {
      _pauseStart = _perfNow();
    }
    _timersBlocked = true;
    // If RAF was permanently unlocked (TalkingHead present), skip blocking
    // so the 3D avatar animation loop keeps running during pause
    if (window.__rafUnlocked) {
      // Still call legacy pause handlers
      if (window.__pause && window.__pause !== _legacyPause) {
        try { window.__pause(); } catch(e) {}
      }
      return;
    }
    _rafBlocked = true;
    // Cancel any in-flight RAF
    if (_currentRAFId) { _realCAF(_currentRAFId); _currentRAFId = null; }
    // Override RAF again to block new calls
    _pendingRAFCallbacks = [];
    window.requestAnimationFrame = function(cb) {
      var queueId = -(_pendingRAFCallbacks.length + 1);
      _pendingRAFCallbacks.push(cb);
      return queueId;
    };
    // Also call legacy __pause if scene code defined it
    if (window.__pause && window.__pause !== _legacyPause) {
      try { window.__pause(); } catch(e) {}
    }
  }

  // ── Master timeline ──────────────────────────────────────
  // Starts paused. Nothing plays until parent sends 'play'.
  var masterTL = gsap.timeline({
    paused: true,
    onComplete: function() {
      postToParent({ type: 'ended' });
    },
    onUpdate: function() {
      postToParent({
        type: 'timeupdate',
        currentTime: masterTL.time(),
      });
    },
  });

  // Guarantee timeline duration matches scene duration.
  // Scene code may not fill the full duration, but the timeline
  // should always report the correct total length.
  // Avatar / edge cases: if DURATION is missing or NaN, seek/play/scrub all break (duration 0).
  var _rawDur =
    typeof DURATION === 'number' && !isNaN(DURATION) && DURATION > 0
      ? DURATION
      : typeof window.DURATION === 'number' && !isNaN(window.DURATION) && window.DURATION > 0
        ? window.DURATION
        : 8;
  var _cenchDuration = Math.max(0.1, _rawDur);
  masterTL.to({}, { duration: _cenchDuration }, 0);

  // Public API for scene code
  window.__tl = masterTL;

  // ── Multi-track audio integration ───────────────────────
  var ttsAudio = null;
  var sfxElements = [];
  var musicAudio = null;
  var legacyAudio = [];

  window.addEventListener('load', function() {
    ttsAudio = document.getElementById('scene-tts') || document.getElementById('scene-audio');
    sfxElements = Array.from(document.querySelectorAll('[data-track="sfx"]'));
    musicAudio = document.getElementById('scene-music');
    legacyAudio = Array.from(document.querySelectorAll('audio')).filter(function(a) {
      return !a.dataset.track && a.id !== 'scene-tts' && a.id !== 'scene-audio' && a.id !== 'scene-music';
    });

    // Set initial volumes (Layers panel / audioLayer.volume on TTS + legacy track)
    if (ttsAudio) {
      var ttsVol = parseFloat(ttsAudio.dataset.volume || '1');
      ttsAudio.volume = Number.isFinite(ttsVol) ? Math.min(1, Math.max(0, ttsVol)) : 1;
      var ttsOff = parseFloat(ttsAudio.dataset.startOffset || '0');
      if (Number.isFinite(ttsOff) && ttsOff > 0) {
        try { ttsAudio.currentTime = ttsOff; } catch(e) {}
      }
    }
    if (musicAudio) {
      musicAudio.volume = parseFloat(musicAudio.dataset.volume || '0.12');
    }
    sfxElements.forEach(function(el) {
      el.volume = parseFloat(el.dataset.volume || '0.8');
    });

    // Schedule SFX triggers on the GSAP timeline
    if (window.__tl) {
      sfxElements.forEach(function(el) {
        var triggerAt = parseFloat(el.dataset.triggerAt || '0');
        window.__tl.call(function() {
          el.currentTime = 0;
          el.play().catch(function(){});
        }, null, triggerAt);
      });
    }

    // Music ducking: reduce music volume during TTS playback
    if (musicAudio && ttsAudio && musicAudio.dataset.duck === 'true') {
      var normalVol = parseFloat(musicAudio.dataset.volume || '0.12');
      var duckLevel = parseFloat(musicAudio.dataset.duckLevel || '0.2');
      var duckVol = normalVol * duckLevel;
      ttsAudio.addEventListener('play', function() { musicAudio.volume = duckVol; });
      ttsAudio.addEventListener('pause', function() { musicAudio.volume = normalVol; });
      ttsAudio.addEventListener('ended', function() { musicAudio.volume = normalVol; });
    }

    // Web Speech API fallback
    var ttsConfig = document.getElementById('scene-tts-config');
    if (ttsConfig && !ttsAudio) {
      window.__webSpeechConfig = {
        provider: ttsConfig.dataset.provider,
        text: ttsConfig.dataset.text,
        voice: ttsConfig.dataset.voice,
      };
    }

    // Initial sync: refs exist now; timeline starts paused — keep media paused too
    try { syncMedia(false); } catch(e) {}
  });

  function syncMedia(playing) {
    // TTS
    if (ttsAudio) {
      try {
        if (playing) {
          ttsAudio.play().catch(function(err) {
            console.warn('[cench-playback] TTS play() failed (sandbox/autoplay?):', err);
          });
        } else {
          ttsAudio.pause();
        }
      } catch(e) {}
    }

    // Web Speech API fallback
    if (!ttsAudio && window.__webSpeechConfig && window.speechSynthesis) {
      if (playing) {
        if (!window.__webSpeechActive) {
          var u = new SpeechSynthesisUtterance(window.__webSpeechConfig.text);
          if (window.__webSpeechConfig.voice) {
            var voices = speechSynthesis.getVoices();
            var match = voices.find(function(v) { return v.name === window.__webSpeechConfig.voice; });
            if (match) u.voice = match;
          }
          speechSynthesis.speak(u);
          window.__webSpeechActive = true;
          u.onend = function() { window.__webSpeechActive = false; };
        }
      } else {
        speechSynthesis.cancel();
        window.__webSpeechActive = false;
      }
    }

    // Puter.js fallback
    if (!ttsAudio && window.__webSpeechConfig && window.__webSpeechConfig.provider === 'puter' && window.puter) {
      if (playing && !window.__puterAudioPlaying) {
        window.puter.ai.txt2speech(window.__webSpeechConfig.text, {
          provider: 'openai',
          voice: window.__webSpeechConfig.voice || 'nova',
        }).then(function(audioEl) {
          audioEl.play();
          window.__puterAudioPlaying = true;
          audioEl.onended = function() { window.__puterAudioPlaying = false; };
        }).catch(function(){});
      }
    }

    // Music
    if (musicAudio) {
      try {
        if (playing) musicAudio.play().catch(function(){});
        else musicAudio.pause();
      } catch(e) {}
    }

    // SFX are triggered by GSAP timeline callbacks, not play/pause
    // But stop them on pause
    if (!playing) {
      sfxElements.forEach(function(el) {
        try { el.pause(); } catch(e) {}
      });
    }

    // Legacy audio elements
    legacyAudio.forEach(function(a) {
      try {
        if (playing) a.play().catch(function(){});
        else a.pause();
      } catch(e) {}
    });

    // Videos (avatar, veo3 layers)
    var videos = document.querySelectorAll('video');
    videos.forEach(function(v) {
      try {
        if (playing) v.play().catch(function(){});
        else v.pause();
      } catch(e) {}
    });

    // CSS animations (legacy SVG scenes)
    var cssCtrl = document.getElementById('__gsap_css_ctrl');
    if (!cssCtrl) {
      cssCtrl = document.createElement('style');
      cssCtrl.id = '__gsap_css_ctrl';
      document.head.appendChild(cssCtrl);
    }
    cssCtrl.textContent = playing
      ? '*, *::before, *::after { animation-play-state: running !important; }'
      : '*, *::before, *::after { animation-play-state: paused !important; }';
    // After play(), WAAPI owns playback — CSS paused alone does not freeze animations.
    if (!playing) {
      _pauseCSSAnimations();
    }
  }

  // ── CSS animation control via Web Animations API ─────────
  // SVG scenes use CSS @keyframes which can't be seeked by GSAP.
  // The Web Animations API gives us seekable Animation objects.
  // After seeking (which calls anim.pause()), we MUST call anim.play()
  // to resume — CSS animation-play-state alone can't override API pause.
  function _pauseCSSAnimations() {
    if (!document.getAnimations) return;
    function pauseEach(list) {
      list.forEach(function(anim) {
        try {
          anim.pause();
        } catch(e) {}
      });
    }
    var anims = document.getAnimations();
    pauseEach(anims);
    if (anims.length === 0) {
      _realRAF(function() {
        pauseEach(document.getAnimations ? document.getAnimations() : []);
      });
    }
  }

  function _seekCSSAnimations(timeMs) {
    if (!document.getAnimations) return;
    var anims = document.getAnimations();
    if (anims.length > 0) {
      anims.forEach(function(anim) {
        try {
          anim.currentTime = timeMs;
          anim.pause();
        } catch(e) {}
      });
    } else {
      // Animations may not exist yet (iframe just became visible).
      // Retry after the browser renders a frame.
      _realRAF(function() {
        var retryAnims = document.getAnimations ? document.getAnimations() : [];
        retryAnims.forEach(function(anim) {
          try {
            anim.currentTime = timeMs;
            anim.pause();
          } catch(e) {}
        });
      });
    }
  }

  function _resumeCSSAnimations() {
    if (!document.getAnimations) return;
    var anims = document.getAnimations();
    if (anims.length > 0) {
      anims.forEach(function(anim) {
        try { anim.play(); } catch(e) {}
      });
    } else {
      _realRAF(function() {
        var retryAnims = document.getAnimations ? document.getAnimations() : [];
        retryAnims.forEach(function(anim) {
          try { anim.play(); } catch(e) {}
        });
      });
    }
  }

  // ── postMessage bridge ───────────────────────────────────
  function postToParent(msg) {
    try {
      window.parent.postMessage(
        Object.assign({
          source: 'cench-scene',
          sceneId: typeof SCENE_ID !== 'undefined' ? SCENE_ID : null,
        }, msg),
        '*'
      );
    } catch(e) {}
  }

  function refreshMediaRefs() {
    if (!ttsAudio) {
      ttsAudio = document.getElementById('scene-tts') || document.getElementById('scene-audio');
      if (ttsAudio) {
        var rv = parseFloat(ttsAudio.dataset.volume || '1');
        ttsAudio.volume = Number.isFinite(rv) ? Math.min(1, Math.max(0, rv)) : 1;
        var ro = parseFloat(ttsAudio.dataset.startOffset || '0');
        if (Number.isFinite(ro) && ro > 0) { try { ttsAudio.currentTime = ro; } catch(e) {} }
      }
    }
    if (!musicAudio) {
      musicAudio = document.getElementById('scene-music');
      if (musicAudio) {
        musicAudio.volume = parseFloat(musicAudio.dataset.volume || '0.12');
      }
    }
  }

  window.addEventListener('message', function(event) {
    if (!event.data || event.data.target !== 'cench-scene') return;
    // Ignore messages for other scenes
    if (
      event.data.sceneId &&
      typeof SCENE_ID !== 'undefined' &&
      event.data.sceneId !== SCENE_ID
    ) return;

    refreshMediaRefs();

    var cmd = event.data;

    switch (cmd.type) {

      case 'play':
        if (masterTL.time() >= masterTL.duration()) {
          masterTL.seek(0);
          _seekCSSAnimations(0);
          if (ttsAudio) {
            var rOff = parseFloat(ttsAudio.dataset.startOffset || '0');
            try { ttsAudio.currentTime = Number.isFinite(rOff) ? rOff : 0; } catch(e) {}
          }
        }
        _unblockRAF();   // let legacy RAF loops run
        gsap.ticker.wake();  // ensure ticker is active after pause
        masterTL.play();
        syncMedia(true);
        _resumeCSSAnimations();  // Must call anim.play() via API — CSS rule alone can't override API pause
        // Avatar sync — restore active mood + start speech on first play
        if (window.__avatarHead) {
          try {
            window.__avatarHead.setMood(window.__avatarMood || 'happy');
            if (!window.__avatarSpeechStarted && window.__avatarStartSpeech) {
              window.__avatarStartSpeech();
              window.__avatarSpeechStarted = true;
            }
          } catch(e) {}
        }
        postToParent({ type: 'playing' });
        break;

      case 'pause':
        _blockRAF();     // stop legacy RAF loops
        masterTL.pause();
        syncMedia(false);  // CSS animation-play-state: paused handles SVG scenes
        // Avatar sync — go idle (still breathes/blinks, stops speaking)
        if (window.__avatarHead) {
          try {
            if (window.__avatarHead.stopSpeaking) window.__avatarHead.stopSpeaking();
            window.__avatarHead.setMood('neutral');
            // Allow speech to restart on next play (stopSpeaking clears the queue)
            window.__avatarSpeechStarted = false;
          } catch(e) {}
        }
        postToParent({
          type: 'paused',
          currentTime: masterTL.time(),
        });
        break;

      case 'seek':
        var seekTime = Math.max(0, Math.min(cmd.time, masterTL.duration()));
        masterTL.seek(seekTime);
        // Force GSAP to re-evaluate all tweens and fire onUpdate
        masterTL.progress(masterTL.progress());
        // Belt-and-suspenders: call draw() directly for canvas2d scenes
        if (typeof window.draw === 'function') {
          try { window.draw(seekTime); } catch(e) {}
        }
        // Three.js / 3d_world / void / studio: RAF is blocked while paused, so one shot per seek
        if (typeof window.__updateScene === 'function') {
          try { window.__updateScene(seekTime); } catch(e) {}
        }
        // Sync all audio to seek position (optional startOffset skips into the file)
        if (ttsAudio) {
          var sOff = parseFloat(ttsAudio.dataset.startOffset || '0');
          var ttsT = seekTime + (Number.isFinite(sOff) ? sOff : 0);
          try { ttsAudio.currentTime = Math.max(0, ttsT); } catch(e) {}
        }
        if (musicAudio) { try { musicAudio.currentTime = seekTime; } catch(e) {} }
        sfxElements.forEach(function(el) {
          try { el.pause(); el.currentTime = 0; } catch(e) {}
        });
        legacyAudio.forEach(function(a) {
          try { a.currentTime = seekTime; } catch(e) {}
        });
        document.querySelectorAll('video').forEach(function(v) {
          try { v.currentTime = seekTime; } catch(e) {}
        });
        // Seek CSS animations (SVG scenes with @keyframes)
        _seekCSSAnimations(seekTime * 1000);
        // Pause after seeking (parent can send 'play' after if desired)
        if (!masterTL.isActive()) {
          masterTL.pause();
        }
        syncMedia(false);
        postToParent({
          type: 'seeked',
          currentTime: masterTL.time(),
        });
        break;

      case 'reset':
        _blockRAF();
        masterTL.seek(0).pause();
        _seekCSSAnimations(0);
        if (ttsAudio) {
          var zOff = parseFloat(ttsAudio.dataset.startOffset || '0');
          try { ttsAudio.currentTime = Number.isFinite(zOff) ? zOff : 0; } catch(e) {}
        }
        if (musicAudio) { try { musicAudio.currentTime = 0; } catch(e) {} }
        legacyAudio.forEach(function(a) {
          var lo = parseFloat(a.dataset.startOffset || '0');
          try { a.currentTime = Number.isFinite(lo) ? lo : 0; } catch(e) {}
        });
        syncMedia(false);
        // Avatar sync — reset to idle, allow speech restart
        if (window.__avatarHead) {
          try {
            if (window.__avatarHead.stopSpeaking) window.__avatarHead.stopSpeaking();
            window.__avatarHead.setMood('neutral');
            window.__avatarSpeechStarted = false;
          } catch(e) {}
        }
        postToParent({ type: 'reset' });
        break;

      // ── Avatar live control (from settings panel) ──────────
      case 'avatar_command':
        if (window.__avatarHead) {
          try {
            var h = window.__avatarHead;
            switch (cmd.command) {
              case 'setMood':
                h.setMood(cmd.mood);
                window.__avatarMood = cmd.mood;
                break;
              case 'playGesture':
                h.playGesture(cmd.gesture, cmd.duration || 2, cmd.mirror);
                break;
              case 'setView':
                if (h.setView) h.setView(cmd.view);
                break;
              case 'playAnimation':
                if (h.playAnimation) h.playAnimation(cmd.url, null, cmd.duration || 10, cmd.index || 0);
                break;
              case 'stopAnimation':
                if (h.stopAnimation) h.stopAnimation();
                break;
              case 'lookAt':
                if (h.lookAt) h.lookAt(cmd.x, cmd.y, cmd.duration || 1000);
                break;
            }
          } catch(e) { console.warn('[Playback] avatar_command error:', e); }
        }
        break;

      case 'get_state':
        postToParent({
          type: 'state',
          currentTime: masterTL.time(),
          duration: masterTL.duration(),
          status: masterTL.isActive()
            ? 'playing'
            : masterTL.time() >= masterTL.duration()
            ? 'ended'
            : 'paused',
        });
        break;
    }
  });

  // ── Signal ready after all scripts execute ───────────────
  window.addEventListener('load', function() {
    _realSetTimeout(function() {
      postToParent({
        type: 'ready',
        duration: masterTL.duration(),
        sceneId: typeof SCENE_ID !== 'undefined' ? SCENE_ID : null,
      });
    }, 50);
  });

  // ── Legacy compatibility ─────────────────────────────────
  // Old code may call __pause/__resume directly.
  // Store refs so _blockRAF/_unblockRAF can detect our own functions.
  var _legacyPause = function() { _blockRAF(); masterTL.pause(); syncMedia(false); };
  var _legacyResume = function() { _unblockRAF(); masterTL.play(); syncMedia(true); };
  window.__pause = _legacyPause;
  window.__resume = _legacyResume;

  // SVG (and other CSS @keyframes) scenes: each rule uses the animation shorthand,
  // which sets animation-play-state back to running and wins over the scene's
  // weak universal paused rule. Without this, animations run at load while the
  // GSAP master timeline is still paused. Match initial state to paused timeline
  // until parent sends play.
  syncMedia(false);

})();
`
