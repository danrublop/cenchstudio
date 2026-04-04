/**
 * Cench Analytics SDK
 *
 * Lightweight embeddable SDK for tracking interaction events from
 * Cench Studio interactive videos. Works standalone or auto-tracks
 * events from embedded Cench player iframes via postMessage.
 *
 * Usage:
 *   <script src="https://your-domain.com/sdk/cench-analytics.js"></script>
 *   <script>
 *     Cench.init({ projectId: 'your-project-id' });
 *     // Events from embedded iframes are tracked automatically.
 *     // Or track manually:
 *     Cench.track('interaction_fired', { interactionId: '...', type: 'hotspot' });
 *   </script>
 */
(function (global) {
  'use strict';

  var FLUSH_INTERVAL = 2000; // ms
  var ENDPOINT = '/api/analytics/track';

  var config = { projectId: null, endpoint: null, debug: false };
  var sessionId = generateId();
  var queue = [];
  var timer = null;

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function resolveEndpoint() {
    if (config.endpoint) return config.endpoint;
    // If the SDK is loaded from the same origin as Cench, use relative path.
    // Otherwise, try to infer from the script src.
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || '';
        if (src.indexOf('cench-analytics') !== -1) {
          var url = new URL(src);
          return url.origin + '/api/analytics/track';
        }
      }
    } catch (e) { /* ignore */ }
    return ENDPOINT;
  }

  function enqueue(event, data) {
    if (!config.projectId) {
      if (config.debug) console.warn('[Cench] Not initialized. Call Cench.init({ projectId }) first.');
      return;
    }
    queue.push({
      projectId: config.projectId,
      sessionId: sessionId,
      event: event,
      data: data || {},
    });
    scheduleFlush();
  }

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(flush, FLUSH_INTERVAL);
  }

  function flush() {
    timer = null;
    if (queue.length === 0) return;
    var batch = queue.splice(0);
    var endpoint = resolveEndpoint();

    for (var i = 0; i < batch.length; i++) {
      var payload = JSON.stringify(batch[i]);
      // Use sendBeacon if available (works on page unload), otherwise fetch
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
      } else {
        try {
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          });
        } catch (e) {
          if (config.debug) console.error('[Cench] Failed to send event:', e);
        }
      }
    }
  }

  // Listen for postMessage events from embedded Cench player iframes
  function handleMessage(event) {
    var msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.source !== 'cench-player') return;
    // Only accept messages from same origin or from origins matching the SDK script src
    var trustedOrigin = resolveEndpoint().replace('/api/analytics/track', '');
    if (event.origin !== window.location.origin && event.origin !== trustedOrigin) {
      if (config.debug) console.warn('[Cench] Rejected postMessage from untrusted origin:', event.origin);
      return;
    }
    if (msg.projectId && !config.projectId) {
      config.projectId = msg.projectId;
    }
    if (msg.event) {
      enqueue(msg.event, msg.data);
    }
  }

  // Flush on page unload
  function handleUnload() {
    flush();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  var Cench = {
    /**
     * Initialize the SDK.
     * @param {{ projectId: string, endpoint?: string, debug?: boolean }} opts
     */
    init: function (opts) {
      if (!opts || !opts.projectId) {
        console.error('[Cench] init() requires { projectId }');
        return;
      }
      config.projectId = opts.projectId;
      config.endpoint = opts.endpoint || null;
      config.debug = !!opts.debug;

      if (typeof window !== 'undefined') {
        window.addEventListener('message', handleMessage);
        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') flush();
        });
      }

      if (config.debug) console.log('[Cench] Initialized for project:', config.projectId);
    },

    /**
     * Set or override the session ID.
     * @param {string} id
     */
    identify: function (id) {
      sessionId = id;
    },

    /**
     * Track a generic event.
     * @param {string} event - Event name (e.g., 'interaction_fired')
     * @param {object} [data] - Optional event data
     */
    track: function (event, data) {
      enqueue(event, data);
    },

    /**
     * Shorthand: track a scene view.
     * @param {string} sceneId
     * @param {object} [extra]
     */
    sceneView: function (sceneId, extra) {
      enqueue('scene_viewed', Object.assign({ sceneId: sceneId }, extra || {}));
    },

    /**
     * Shorthand: track an interaction firing.
     * @param {string} interactionId
     * @param {string} type - e.g., 'hotspot', 'choice', 'quiz'
     * @param {object} [extra]
     */
    interactionFired: function (interactionId, type, extra) {
      enqueue('interaction_fired', Object.assign({ interactionId: interactionId, type: type }, extra || {}));
    },

    /** Force flush the event queue immediately. */
    flush: flush,

    /** Get the current session ID. */
    getSessionId: function () { return sessionId; },
  };

  // Expose globally
  if (typeof global !== 'undefined') global.Cench = Cench;
  if (typeof module !== 'undefined' && module.exports) module.exports = Cench;

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
