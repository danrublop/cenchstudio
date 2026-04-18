// Loads a TalkingHead avatar as a picture-in-picture overlay inside a 3D world.
//
// The worlds (studio-room, meadow, void-space) render Three.js scenes that
// already own the GL context, so we can't drop TalkingHead's internal
// renderer into their scene graph without a rewrite. Until that lands, this
// helper floats the avatar in a corner of the wrapper — matching how the
// 2D sceneTemplate uses TalkingHead for PIP avatars — so `WorldAvatarConfig`
// entries actually render, lip-sync, and play narration instead of silently
// noop'ing.
//
// Contract:
//   createWorldAvatar(hostEl, avatarCfg, tl, {
//     ttsEndpoint?: string | null,      // baked into TalkingHead; null disables server TTS
//     duration?: number,                // scene duration in seconds; drives fakeLipsync length
//     glbUrlDefault?: string,           // fallback model if avatarCfg.glbUrl is missing
//     index?: number,                   // avatar index — spaces PIPs when multiple avatars exist
//   }) -> Promise<{ element, head, destroy } | null>

const TALKING_HEAD_MODULE = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs'
const DEFAULT_GLB = '/avatars/brunette.glb'

function buildWrapper(index) {
  const wrap = document.createElement('div')
  wrap.className = 'cench-world-avatar'
  // Stack multiple avatars left-to-right across the bottom-right corner.
  const rightOffset = 24 + index * 300
  wrap.style.cssText = [
    'position:absolute',
    'bottom:24px',
    'right:' + rightOffset + 'px',
    'width:280px',
    'height:280px',
    'border-radius:50%',
    'overflow:hidden',
    'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
    'opacity:0',
    'pointer-events:none',
    'z-index:10',
  ].join(';')
  return wrap
}

function buildFallback(mood) {
  const fb = document.createElement('div')
  const color = mood === 'professional' ? '#0ea5e9' : mood === 'energetic' ? '#f59e0b' : '#6366f1'
  const emoji = mood === 'professional' ? '👔' : mood === 'energetic' ? '⚡' : '😊'
  fb.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'background:' + color,
    'color:white',
    'font-size:64px',
    'font-family:system-ui,sans-serif',
  ].join(';')
  const emojiEl = document.createElement('div')
  emojiEl.textContent = emoji
  const label = document.createElement('div')
  label.style.cssText = 'font-size:10px;opacity:0.7;margin-top:8px;'
  label.textContent = 'Loading 3D...'
  fb.appendChild(emojiEl)
  fb.appendChild(label)
  return fb
}

export async function createWorldAvatar(hostEl, avatarCfg, tl, opts) {
  opts = opts || {}
  const ttsEndpoint = opts.ttsEndpoint || null
  const duration = typeof opts.duration === 'number' ? opts.duration : 10
  const glbUrlDefault = opts.glbUrlDefault || DEFAULT_GLB
  const index = typeof opts.index === 'number' ? opts.index : 0

  if (!hostEl || !avatarCfg) return null

  const script = avatarCfg.script || {}
  const wrap = buildWrapper(index)
  const fallback = buildFallback(script.character || avatarCfg.mood || 'friendly')
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;inset:0;z-index:2;'

  wrap.appendChild(fallback)
  wrap.appendChild(container)
  hostEl.appendChild(wrap)

  const enterAt = typeof script.enterAt === 'number' ? script.enterAt : 0
  const exitAt = typeof script.exitAt === 'number' ? script.exitAt : null

  // Always fade in on entrance so the fallback is visible even if TalkingHead
  // fails — a broken avatar is less confusing than silent invisibility.
  if (tl && typeof tl.to === 'function') {
    tl.to(wrap, { opacity: 1, duration: 0.4 }, enterAt)
    if (exitAt != null) tl.to(wrap, { opacity: 0, duration: 0.4 }, exitAt)
  } else {
    wrap.style.opacity = '1'
  }

  let head = null
  try {
    const mod = await import(TALKING_HEAD_MODULE)
    const TalkingHead = mod.TalkingHead
    if (typeof TalkingHead !== 'function') throw new Error('TalkingHead export missing')

    // The world restored `__nativeRAF`/`__nativeCAF` before this runs, but guard
    // again in case a future controller re-wraps them while we boot.
    if (window.__nativeRAF) window.requestAnimationFrame = window.__nativeRAF
    if (window.__nativeCAF) window.cancelAnimationFrame = window.__nativeCAF
    window.__rafUnlocked = true

    head = new TalkingHead(container, {
      ttsEndpoint: ttsEndpoint,
      ttsLang: 'en-US',
      cameraView: script.view || 'upper',
      cameraRotateEnable: false,
      avatarSpeakingEyeContact: typeof script.eyeContact === 'number' ? script.eyeContact : 0.7,
      avatarIdleEyeContact: typeof script.eyeContact === 'number' ? Math.max(0, script.eyeContact - 0.2) : 0.5,
    })

    const glbUrl = avatarCfg.glbUrl || glbUrlDefault
    await head.showAvatar({
      url: glbUrl,
      body: 'F',
      lipsyncLang: 'en',
      lipsyncHeadMovement: script.lipsyncHeadMovement !== false,
    })

    fallback.style.display = 'none'
    head.setMood(avatarCfg.mood || script.mood || 'neutral')

    // Speak the narration (if any). Prefer server TTS via ttsEndpoint; fall
    // back to fakeLipsync so the mouth moves even without a TTS provider.
    const lines = Array.isArray(script.lines) ? script.lines : []
    const narration = lines
      .map(function (l) {
        return l && l.text ? String(l.text) : ''
      })
      .join(' ')
      .trim()

    if (narration) {
      try {
        if (ttsEndpoint && typeof head.speakText === 'function') {
          head.speakText(narration)
        } else if (script.fakeLipsync !== false && typeof head.streamStart === 'function') {
          // TalkingHead's fake-lipsync mode: drive visemes without audio
          head.streamStart({ sampleRate: 22050, mood: avatarCfg.mood, lipsyncType: 'viseme' })
          setTimeout(function () {
            try {
              head.streamStop && head.streamStop()
            } catch (e) {}
          }, Math.max(1000, duration * 1000))
        }
      } catch (err) {
        console.warn('[world-avatar] speak failed:', err && err.message ? err.message : err)
      }
    }
  } catch (err) {
    console.warn('[world-avatar] init failed, showing fallback:', err && err.message ? err.message : err)
    // Fallback already visible; nothing else to do.
  }

  return {
    element: wrap,
    head: head,
    destroy: function () {
      try {
        wrap.remove()
      } catch (e) {}
    },
  }
}
