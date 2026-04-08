/**
 * Cench iMessage Agent — Entry Point
 *
 * Boots the Photon imessage-kit SDK, registers plugins,
 * and starts watching for incoming messages.
 *
 * Usage:
 *   npm start          — run with imessage-kit (requires macOS + Full Disk Access)
 *   MOCK=1 npm start   — run in mock mode (stdin/stdout, no iMessage)
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { handleMessage, type MessageSender, type IncomingMessage } from './bot.js'
import { closeDb, pruneHistory, pruneTapbacks } from './conversation-store.js'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(THIS_DIR, '../../public')

// ── Configuration ──────────────────────────────────────────────────────────

const POLL_INTERVAL = 2000 // ms between message polls
const USE_MOCK = process.env.MOCK === '1' || process.env.MOCK === 'true'
const ALLOW_SELF = process.env.ALLOW_SELF === '1' // Allow own messages (for testing)

// ── File Cleanup ──────────────────────────────────────────────────────────

const FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

async function prunePublicFiles(): Promise<number> {
  const { readdir, stat, unlink } = await import('fs/promises')
  let pruned = 0
  const cutoff = Date.now() - FILE_MAX_AGE_MS

  // Prune old TTS files from public/audio/
  try {
    const audioDir = path.join(PUBLIC_DIR, 'audio')
    const files = await readdir(audioDir)
    for (const f of files) {
      if (!f.startsWith('imsg-tts-') && !f.startsWith('test-tts-')) continue
      const fullPath = path.join(audioDir, f)
      const s = await stat(fullPath).catch(() => null)
      if (s && s.mtimeMs < cutoff) {
        await unlink(fullPath).catch(() => {})
        pruned++
      }
    }
  } catch {
    /* audio dir may not exist */
  }

  // Prune old test scene HTML files from public/scenes/
  try {
    const scenesDir = path.join(PUBLIC_DIR, 'scenes')
    const files = await readdir(scenesDir)
    for (const f of files) {
      if (!f.startsWith('test-imessage-')) continue
      const fullPath = path.join(scenesDir, f)
      const s = await stat(fullPath).catch(() => null)
      if (s && s.mtimeMs < cutoff) {
        await unlink(fullPath).catch(() => {})
        pruned++
      }
    }
  } catch {
    /* scenes dir may not exist */
  }

  return pruned
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬 Cench iMessage Agent starting...')
  const studioUrl = process.env.CENCH_STUDIO_URL || 'http://localhost:3000'
  const renderUrl = process.env.RENDER_SERVER_URL || 'http://localhost:3001'
  console.log(`   Studio: ${studioUrl}`)
  console.log(`   Render: ${renderUrl}`)
  console.log(`   Mode:   ${USE_MOCK ? 'MOCK (stdin/stdout)' : 'iMessage (Photon SDK)'}`)
  console.log('')

  // ── Startup checks ──────────────────────────────────────────────────
  const issues: string[] = []

  // Check Studio server
  try {
    const res = await fetch(`${studioUrl}/api/projects`, { signal: AbortSignal.timeout(3000) })
    if (res.status >= 500) issues.push(`Cench Studio returned ${res.status} — is it running? (npm run dev)`)
  } catch {
    issues.push(`Cench Studio is not reachable at ${studioUrl} — start it with: npm run dev`)
  }
  // Note: ANTHROPIC_API_KEY is needed in the Studio server's .env, not here

  // Check render server
  try {
    const res = await fetch(`${renderUrl}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) issues.push(`Render server returned ${res.status}`)
  } catch {
    issues.push(`Render server is not reachable at ${renderUrl} — start it with: cd render-server && node index.js`)
  }

  if (issues.length > 0) {
    console.log('⚠️  Setup issues:')
    issues.forEach((issue) => console.log(`   - ${issue}`))
    console.log('')
    console.log('   The agent will start but generation will fail until these are resolved.')
    console.log('')
  } else {
    console.log('✅ All checks passed\n')
  }

  // Prune old data on startup
  const pruned = pruneHistory()
  const prunedTapbacks = pruneTapbacks()
  const prunedFiles = await prunePublicFiles()
  if (pruned > 0 || prunedTapbacks > 0 || prunedFiles > 0) {
    console.log(`🧹 Pruned ${pruned} old messages, ${prunedTapbacks} old tapbacks, ${prunedFiles} old files`)
  }

  if (USE_MOCK) {
    await startMockMode()
  } else {
    await startIMessageMode()
  }
}

// ── iMessage Mode (Photon SDK) ─────────────────────────────────────────────

async function startIMessageMode() {
  // Dynamic import so the app can start in mock mode without the SDK installed
  let IMessageSDK: any
  try {
    const mod = await import('@photon-ai/imessage-kit')
    IMessageSDK = mod.IMessageSDK ?? mod.default
  } catch {
    console.error(
      '❌ @photon-ai/imessage-kit not installed.\n' +
        '   Run: npm install @photon-ai/imessage-kit\n' +
        '   Or use MOCK=1 npm start for development.',
    )
    process.exit(1)
  }

  const sdk = new IMessageSDK({
    watcher: {
      pollInterval: POLL_INTERVAL,
      excludeOwnMessages: !ALLOW_SELF,
      unreadOnly: false,
    },
    debug: process.env.DEBUG === '1',
  })

  // Register plugins
  try {
    const { createTapbackPlugin } = await import('./plugins/tapback-tracker.js')
    const { createThreadContextPlugin } = await import('./plugins/thread-context.js')
    const { createCommandParserPlugin, registerCommand } = await import('./plugins/command-parser.js')
    const { createSelfChatPlugin, addSelfIdentity } = await import('./plugins/self-chat-detector.js')
    const { createDataLayerPlugin } = await import('./plugins/data-layer.js')
    const { createUnsentTrackerPlugin } = await import('./plugins/unsent-tracker.js')
    const { createContactTaggerPlugin } = await import('./plugins/contact-tagger.js')
    const { createNotesBridgePlugin } = await import('./plugins/notes-bridge.js')
    const { createAgentCommandsPlugin } = await import('./plugins/agent-commands.js')

    // Pre-seed self identity if provided via env
    if (process.env.SELF_ID) {
      process.env.SELF_ID.split(',').forEach((id) => addSelfIdentity(id.trim()))
    }

    // Register slash commands (handled by bot.ts, registered here for command-parser awareness)
    registerCommand('/chart', async () => undefined, 'Create a data visualization')
    registerCommand('/briefing', async () => undefined, 'Get your daily briefing')
    registerCommand('/clear', async () => undefined, 'Clear conversation history')

    if (typeof sdk.use === 'function') {
      // 1. Foundation: data layer (other plugins can use it)
      const dataPlugin = createDataLayerPlugin()
      sdk.use(dataPlugin)

      // 2. Core plugins
      sdk.use(createSelfChatPlugin())
      sdk.use(createTapbackPlugin())
      sdk.use(createThreadContextPlugin())
      sdk.use(
        createCommandParserPlugin({
          onReply: (to, text) => sdk.send(to, text),
        }),
      )

      // 3. New SDK contribution plugins
      sdk.use(createUnsentTrackerPlugin())
      sdk.use(createContactTaggerPlugin({ autoTagNew: ['new'] }))
      sdk.use(createNotesBridgePlugin({ defaultFolder: 'Cench Agent' }))
      sdk.use(
        createAgentCommandsPlugin({
          sendReply: (to, text) => sdk.send(to, text),
          dataLayer: dataPlugin.dataLayer,
        }),
      )
    }
  } catch (err) {
    console.warn('⚠️ Could not load plugins:', err)
  }

  // Create sender adapter
  const sender: MessageSender = {
    sendText: async (to, text) => {
      await sdk.send(to, text)
    },
    sendFile: async (to, filePath, caption) => {
      if (typeof sdk.sendFile === 'function') {
        await sdk.sendFile(to, filePath, caption)
      } else if (typeof sdk.send === 'function') {
        // Fallback: can't send files, notify user
        await sdk.send(to, caption ?? "video is ready but file sending isn't supported by this SDK version")
      }
    },
    sendReaction: async (_to, guid, reaction) => {
      try {
        const handle = sdk.message({ guid } as any)
        if (handle?.react) {
          await handle.react(reaction)
        }
      } catch {
        // Reaction not supported by this SDK version — silent fallback
      }
    },
  }

  // Start watching
  console.log('👁️ Watching for iMessages...')
  console.log(`   sender keys: ${Object.keys(sender).join(', ')}\n`)

  // Dedup: prevent processing the same message twice from polling artifacts
  const processedGuids = new Set<string>()
  const MAX_PROCESSED_GUIDS = 500

  await sdk.startWatching({
    onDirectMessage: (msg: any) => {
      // Skip reactions — handled by tapback plugin
      if (msg.isReaction) return

      const senderAddr = msg.sender ?? ''
      const text = msg.text ?? ''
      const isFromMe = msg.isFromMe ?? false

      // Debug: log all messages so we can see what's coming through
      if (process.env.DEBUG === '1') {
        console.log(`[debug] msg: isFromMe=${isFromMe} sender=${senderAddr} text=${text?.slice(0, 50)}`)
      }

      const incoming: IncomingMessage = {
        sender: senderAddr,
        text,
        isFromMe,
        isSelfChat: msg.isSelfChat ?? false,
        chatId: msg.chatId,
        guid: msg.guid,
      }

      // Dedup by GUID
      if (incoming.guid) {
        if (processedGuids.has(incoming.guid)) return
        processedGuids.add(incoming.guid)
        if (processedGuids.size > MAX_PROCESSED_GUIDS) {
          const first = processedGuids.values().next().value!
          processedGuids.delete(first)
        }
      }

      // Process if: (a) not from me, or (b) ALLOW_SELF for self-testing
      if ((!isFromMe || ALLOW_SELF) && incoming.text) {
        console.log(`📨 ${incoming.sender}: ${incoming.text}`)
        handleMessage(incoming, sender).catch((err) => {
          console.error(`❌ Error handling message from ${incoming.sender}:`, err)
        })
      }
    },
    onGroupMessage: (_msg: any) => {
      // Skip group messages for now — only handle DMs
    },
  })

  // Graceful shutdown
  const cleanup = async () => {
    console.log('\n🛑 Shutting down...')
    if (typeof sdk.stopWatching === 'function') sdk.stopWatching()
    if (typeof sdk.close === 'function') await sdk.close()
    closeDb()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

// ── Mock Mode (stdin/stdout for development) ───────────────────────────────

async function startMockMode() {
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const MOCK_CONTACT = 'mock-user@imessage.test'

  const sender: MessageSender = {
    sendText: async (_to, text) => {
      console.log(`\n💬 Bot: ${text}\n`)
    },
    sendFile: async (_to, filePath, caption) => {
      console.log(`\n📎 Bot sends file: ${filePath}`)
      if (caption) console.log(`   Caption: ${caption}`)
      console.log('')
    },
    sendReaction: async (_to, _guid, reaction) => {
      console.log(`\n👍 Bot reacted: ${reaction}\n`)
    },
  }

  console.log("📱 Mock mode — type messages as if you're texting via iMessage.")
  console.log('   Prefix with @cench or use /commands (just like real iMessage).')
  console.log('   Type "quit" to exit.\n')

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const text = input.trim()
      if (!text) {
        prompt()
        return
      }
      if (text === 'quit' || text === 'exit') {
        closeDb()
        rl.close()
        process.exit(0)
      }

      const msg: IncomingMessage = {
        sender: MOCK_CONTACT,
        text,
        isFromMe: false,
        guid: `mock-${Date.now()}`,
      }

      await handleMessage(msg, sender).catch(console.error)
      prompt()
    })
  }

  prompt()
}

// ── Boot ───────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
