/**
 * Test Command — renders a hardcoded scene to MP4 and sends it.
 * Tests the full pipeline (scene write → TTS via macOS say → render → iMessage send) without any API calls.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderToMp4, downloadMp4, type SceneSummary } from '../cench-client.js'
import { createProgressReporter } from '../utils/progress.js'
import type { CommandContext, CommandResult } from './types.js'

const execFileAsync = promisify(execFile)
const STUDIO_URL = process.env.CENCH_STUDIO_URL || 'http://localhost:3000'
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(THIS_DIR, '../../../public')

const TEST_SCENE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0a0a1a; }
    .container { width: 1920px; height: 1080px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
    .title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 96px; font-weight: 800; color: #fff; text-align: center; opacity: 0; letter-spacing: -2px; }
    .subtitle { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 36px; color: #888; margin-top: 24px; opacity: 0; }
    .circle { position: absolute; border-radius: 50%; opacity: 0; }
    .c1 { width: 200px; height: 200px; background: #4f8ef7; top: 150px; left: 200px; }
    .c2 { width: 140px; height: 140px; background: #f5c842; bottom: 200px; right: 300px; }
    .c3 { width: 100px; height: 100px; background: #e84545; top: 300px; right: 500px; }
    .bar { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 0; height: 6px; background: linear-gradient(90deg, #4f8ef7, #f5c842, #e84545); border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="circle c1"></div>
    <div class="circle c2"></div>
    <div class="circle c3"></div>
    <div class="title">Cench Works</div>
    <div class="subtitle">iMessage → Render → Send</div>
    <div class="bar"></div>
  </div>
  <script>
    // Create paused timeline — renderer controls playback via __advanceFrame
    window.__tl = gsap.timeline({ paused: true });
    var tl = window.__tl;

    // Renderer uses this to step the timeline to a specific time
    window.__advanceFrame = function(t) { tl.time(t); };
    // Resume signal for the renderer
    window.__resume = function() {};

    // Circles float in
    tl.to('.c1', { opacity: 0.3, scale: 1.2, duration: 1, ease: 'power2.out' }, 0.2)
      .to('.c2', { opacity: 0.3, scale: 1.1, duration: 1, ease: 'power2.out' }, 0.5)
      .to('.c3', { opacity: 0.3, scale: 1.3, duration: 1, ease: 'power2.out' }, 0.8)
    // Title slams in
      .to('.title', { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.7)' }, 1.0)
    // Subtitle fades in
      .to('.subtitle', { opacity: 1, duration: 0.6 }, 1.8)
    // Bar sweeps across
      .to('.bar', { width: 600, duration: 1.5, ease: 'power3.inOut' }, 2.2)
    // Circles pulse
      .to('.c1', { scale: 1.5, opacity: 0.15, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 2)
      .to('.c2', { scale: 1.4, opacity: 0.15, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 2.3)
      .to('.c3', { scale: 1.6, opacity: 0.15, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 2.6)
    // Everything fades out at the end
      .to('.container', { opacity: 0, duration: 0.8 }, 5.2);
  </script>
</body>
</html>`

export async function handleTest(ctx: CommandContext): Promise<CommandResult> {
  const { contactId, sendReply, reactToMessage } = ctx
  const progress = createProgressReporter(contactId)

  try {
    const reacted = await reactToMessage()
    if (!reacted) await sendReply('running render test, ~10s')

    // Write test scene HTML via POST /api/scene
    const sceneId = `test-imessage-${Date.now()}`
    console.log(`   [test] writing scene ${sceneId}`)

    const writeRes = await fetch(`${STUDIO_URL}/api/scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sceneId, html: TEST_SCENE_HTML }),
    })

    if (!writeRes.ok) {
      const err = await writeRes.text().catch(() => '')
      return { success: false, error: `scene write failed: ${err}` }
    }

    console.log('   [test] scene written, generating TTS...')

    // Generate TTS with macOS say command
    const ttsText =
      'Cench works. This is a test of the iMessage video pipeline. Scene generation, rendering, and delivery — all automated.'
    const ts = Date.now()
    const ttsAiff = `/tmp/cench-test-tts-${ts}.aiff`
    const ttsMp3 = `/tmp/cench-test-tts-${ts}.mp3`
    let audioLayer: SceneSummary['audioLayer'] = undefined

    try {
      await execFileAsync('say', ['-v', 'Samantha', '-o', ttsAiff, ttsText])
      await execFileAsync('ffmpeg', ['-y', '-i', ttsAiff, '-codec:a', 'libmp3lame', '-b:a', '128k', ttsMp3])
      console.log(`   [test] TTS generated: ${ttsMp3}`)

      // Get actual duration from ffprobe
      const { stdout: durationStr } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        ttsMp3,
      ])
      const duration = parseFloat(durationStr) || 5

      // Copy to public/audio/
      const { copyFile } = await import('fs/promises')
      const publicPath = `/audio/test-tts-${ts}.mp3`
      await copyFile(ttsMp3, path.join(PUBLIC_DIR, publicPath))
      audioLayer = {
        enabled: true,
        tts: { src: publicPath, duration, status: 'ready' },
      }
      console.log(`   [test] audio ready: ${publicPath} (~${duration.toFixed(1)}s)`)
    } catch (ttsErr) {
      console.warn(`   [test] TTS failed, rendering without audio: ${ttsErr}`)
    } finally {
      const { unlink } = await import('fs/promises')
      await unlink(ttsAiff).catch(() => {})
      await unlink(ttsMp3).catch(() => {})
    }

    console.log('   [test] rendering...')

    // Render to MP4
    progress.update('rendering')
    const render = await renderToMp4(
      [
        {
          id: sceneId,
          name: 'Test Scene',
          sceneType: 'motion',
          duration: 6,
          ...(audioLayer ? { audioLayer } : {}),
        },
      ],
      `test-${Date.now()}`,
      { onPhase: (phase) => progress.update(phase) },
    )

    progress.stop()

    // Download MP4
    const { tmpdir } = await import('os')
    const tempPath = `${tmpdir()}/cench-test-${Date.now()}.mp4`
    await downloadMp4(render.localPath, tempPath)

    console.log(`   [test] MP4 ready: ${tempPath}`)

    return { success: true, mp4Path: tempPath, caption: 'render test passed' }
  } catch (error) {
    progress.stop()
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`   [test] error: ${msg}`)
    return { success: false, error: `test failed: ${msg}` }
  }
}
