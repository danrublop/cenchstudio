---
id: podcast-repurpose
label: Podcast → Short-Form Video
matchHints:
  - 'turn this podcast into'
  - 'clip a podcast'
  - 'podcast highlight'
  - 'audio to video'
recommendedDurationSeconds: [30, 90]
sceneCount: [2, 5]
requires:
  - tts
compatible_playbooks:
  - clean
  - newspaper
  - dark
---

# Podcast Repurpose

Use this when the user has a long-form audio (podcast, talk, interview) and wants vertical short-form clips highlighting the best parts. This is NOT the same as "talking head" — there's no avatar. The audio IS the source of truth; visuals support it.

## Structure

1. **Opening hook** (3–5s). Title card with the speaker's most quotable line. Caption-style.
2. **Speaker + context** (6–10s). Static or gently-moving photo/illustration of the speaker, with their name + episode title. Waveform animation bound to the audio.
3. **The quote / argument** (15–40s). Word-level captions sync'd to audio. Dynamic kinetic typography that reinforces key nouns/verbs. Optional cut-ins of relevant images/stock footage every 5–8s.
4. **Callout / stat** (optional, 5–10s). If the speaker cites a number, show it big for that line.
5. **Attribution card** (4–6s). Episode link, podcast name, subscribe nudge.

## Defaults

- **Aspect ratio:** 9:16 (TikTok, Reels, Shorts). Platform profile should default to `tiktok` or `instagram-reel`.
- **Duration caps:** respect the platform profile — 60s for IG Reel, 90s for extended Reel, 60s for YouTube Shorts.
- **Renderer mix:** Motion for 1, 2, 5. React scene for 3 (so we can bind word-level captions + waveform). Optional Canvas2D for kinetic typography emphasis.
- **Audio:** Use the user-uploaded podcast audio directly — do NOT re-synthesise. Captions MUST be aligned (word-level) — if the source doesn't have them, run the audio through a transcription pass.
- **Captions:** mandatory. Auto-on. Large, high-contrast, centered. Break at natural pauses.
- **Background music:** none. The source audio is the soundtrack.

## Capability checks before building

- The project has an uploaded audio file OR a transcript the user supplied.
- A transcription tool is available if we need to align captions from raw audio. If not, warn the user — naive captions won't sync well to a real speaker.

## Failure modes to avoid

- Do NOT overlay background music — it fights the podcast audio.
- Do NOT generate a new TTS track — the source audio IS the content.
- Do NOT use static text for 40 seconds; word-level kinetic typography is the whole point.
- Don't clip in the middle of a sentence. Scene boundaries should align with speaker pauses.
