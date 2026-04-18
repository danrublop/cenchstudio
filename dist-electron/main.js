"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc5) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc5 = __getOwnPropDesc(from, key)) || desc5.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/agents/budget-tracker.ts
var budget_tracker_exports = {};
__export(budget_tracker_exports, {
  __resetBudgets: () => __resetBudgets,
  getBudgetSnapshot: () => getBudgetSnapshot,
  reconcileSpend: () => reconcileSpend,
  recordActualSpend: () => recordActualSpend,
  releaseSpend: () => releaseSpend,
  reserveSpend: () => reserveSpend,
  sweepStaleReservations: () => sweepStaleReservations
});
function getOrCreate(projectId) {
  let p = projects2.get(projectId);
  if (!p) {
    p = new ProjectBudget();
    projects2.set(projectId, p);
  }
  return p;
}
function reserveSpend(projectId, api, estimateUsd) {
  return getOrCreate(projectId).reserve(api, estimateUsd);
}
function reconcileSpend(projectId, reservationId, actualUsd) {
  const p = projects2.get(projectId);
  if (!p) return null;
  return p.reconcile(reservationId, actualUsd);
}
function releaseSpend(projectId, reservationId) {
  const p = projects2.get(projectId);
  if (!p) return null;
  return p.release(reservationId);
}
function recordActualSpend(projectId, costUsd) {
  getOrCreate(projectId).addActual(costUsd);
}
function getBudgetSnapshot(projectId) {
  const p = projects2.get(projectId);
  if (!p) {
    return { actualUsd: 0, reservedUsd: 0, committedUsd: 0, reservationCount: 0 };
  }
  return p.snapshot();
}
function sweepStaleReservations(maxAgeMs = 10 * 60 * 1e3) {
  let swept = 0;
  for (const p of projects2.values()) swept += p.sweepStale(maxAgeMs);
  return swept;
}
function __resetBudgets() {
  projects2.clear();
}
var ProjectBudget, projects2;
var init_budget_tracker = __esm({
  "lib/agents/budget-tracker.ts"() {
    "use strict";
    ProjectBudget = class {
      actual = 0;
      reservations = /* @__PURE__ */ new Map();
      counter = 0;
      reserve(api, estimateUsd) {
        const id = `${Date.now().toString(36)}-${(++this.counter).toString(36)}`;
        const r = { id, api, estimateUsd: Math.max(0, estimateUsd), createdAt: Date.now() };
        this.reservations.set(id, r);
        return r;
      }
      reconcile(reservationId, actualUsd) {
        const r = this.reservations.get(reservationId);
        if (!r) return null;
        this.reservations.delete(reservationId);
        this.actual += Math.max(0, actualUsd);
        return r;
      }
      release(reservationId) {
        const r = this.reservations.get(reservationId);
        if (!r) return null;
        this.reservations.delete(reservationId);
        return r;
      }
      addActual(costUsd) {
        this.actual += Math.max(0, costUsd);
      }
      snapshot() {
        let reserved = 0;
        for (const r of this.reservations.values()) reserved += r.estimateUsd;
        return {
          actualUsd: this.actual,
          reservedUsd: reserved,
          committedUsd: this.actual + reserved,
          reservationCount: this.reservations.size
        };
      }
      /** Remove reservations older than `maxAgeMs` — guards against leaks when
       *  a tool handler forgets to reconcile/release. */
      sweepStale(maxAgeMs) {
        const cutoff = Date.now() - maxAgeMs;
        let swept = 0;
        for (const [id, r] of this.reservations.entries()) {
          if (r.createdAt < cutoff) {
            this.reservations.delete(id);
            swept += 1;
          }
        }
        return swept;
      }
    };
    projects2 = /* @__PURE__ */ new Map();
  }
});

// lib/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  decrypt: () => decrypt,
  encrypt: () => encrypt,
  hashPassword: () => hashPassword,
  isEncryptionConfigured: () => isEncryptionConfigured,
  verifyPassword: () => verifyPassword
});
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      `ENCRYPTION_KEY is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return buf;
}
function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = (0, import_crypto2.randomBytes)(IV_LENGTH);
  const cipher = (0, import_crypto2.createCipheriv)(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}
function decrypt(encryptedBase64) {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = (0, import_crypto2.createDecipheriv)(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
function isEncryptionConfigured() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return false;
  try {
    const buf = Buffer.from(key, "hex");
    return buf.length === 32;
  } catch {
    return false;
  }
}
function hashPassword(password) {
  const salt = (0, import_crypto2.randomBytes)(SALT_LENGTH);
  const derived = (0, import_crypto2.scryptSync)(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}
function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  const derived = (0, import_crypto2.scryptSync)(password, salt, SCRYPT_KEYLEN);
  if (derived.length !== storedHash.length) return false;
  return (0, import_crypto2.timingSafeEqual)(derived, storedHash);
}
var import_crypto2, ALGORITHM, IV_LENGTH, TAG_LENGTH, SCRYPT_KEYLEN, SALT_LENGTH;
var init_crypto = __esm({
  "lib/crypto.ts"() {
    "use strict";
    import_crypto2 = require("crypto");
    ALGORITHM = "aes-256-gcm";
    IV_LENGTH = 12;
    TAG_LENGTH = 16;
    SCRYPT_KEYLEN = 64;
    SALT_LENGTH = 16;
  }
});

// lib/audio/sanitize.ts
function validateTextLength(text2) {
  if (text2.length > MAX_TTS_TEXT_LENGTH) {
    throw new Error(`Text too long: ${text2.length} characters (max ${MAX_TTS_TEXT_LENGTH})`);
  }
}
function validateQueryLength(query) {
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new Error(`Query too long: ${query.length} characters (max ${MAX_SEARCH_QUERY_LENGTH})`);
  }
}
function sanitizeSceneId(sceneId) {
  return sceneId.replace(/[^a-zA-Z0-9\-]/g, "");
}
function safeAudioFilename(prefix, sceneId, ext = "mp3") {
  const safe = sanitizeSceneId(sceneId);
  const rand = import_crypto3.default.randomBytes(4).toString("hex");
  return `${prefix}-${safe}-${Date.now()}-${rand}.${ext}`;
}
var import_crypto3, MAX_TTS_TEXT_LENGTH, MAX_SEARCH_QUERY_LENGTH;
var init_sanitize = __esm({
  "lib/audio/sanitize.ts"() {
    "use strict";
    import_crypto3 = __toESM(require("crypto"));
    MAX_TTS_TEXT_LENGTH = 1e4;
    MAX_SEARCH_QUERY_LENGTH = 500;
  }
});

// lib/audio/captions.ts
function charAlignmentToWords(align) {
  const words = [];
  const n = align.characters.length;
  if (n === 0) return words;
  let buf = "";
  let start = align.character_start_times_seconds[0];
  let end = align.character_end_times_seconds[0];
  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed.length > 0) {
      words.push({ text: trimmed, start, end });
    }
    buf = "";
  };
  for (let i = 0; i < n; i++) {
    const ch = align.characters[i];
    const charStart = align.character_start_times_seconds[i];
    const charEnd = align.character_end_times_seconds[i];
    if (/\s/.test(ch)) {
      flush();
      start = charEnd;
      end = charEnd;
      continue;
    }
    if (buf.length === 0) {
      start = charStart;
      end = charEnd;
    } else {
      end = charEnd;
    }
    buf += ch;
  }
  flush();
  return words;
}
function groupWordsIntoCues(words, opts = {}) {
  const maxWords = opts.maxWordsPerCue ?? 7;
  const maxSeconds = opts.maxSecondsPerCue ?? 3.5;
  const maxGap = opts.maxGapSeconds ?? 0.5;
  const cues = [];
  let current = null;
  let wordCount = 0;
  for (const w of words) {
    if (!current) {
      current = { ...w };
      wordCount = 1;
      continue;
    }
    const wouldExceedWords = wordCount + 1 > maxWords;
    const wouldExceedTime = w.end - current.start > maxSeconds;
    const wouldExceedGap = w.start - current.end > maxGap;
    const endsSentence = /[.!?]$/.test(current.text);
    if (wouldExceedWords || wouldExceedTime || wouldExceedGap || endsSentence) {
      cues.push(current);
      current = { ...w };
      wordCount = 1;
    } else {
      current.text += ` ${w.text}`;
      current.end = w.end;
      wordCount += 1;
    }
  }
  if (current) cues.push(current);
  return cues;
}
function pad(n, width) {
  return n.toString().padStart(width, "0");
}
function formatSrtTimestamp(seconds) {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor(total % 3600 / 60);
  const secs = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1e3);
  return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}
function formatVttTimestamp(seconds) {
  return formatSrtTimestamp(seconds).replace(",", ".");
}
function buildSrt(cues) {
  return cues.map((cue, i) => `${i + 1}
${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}
${cue.text}`).join("\n\n") + "\n";
}
function buildVtt(cues) {
  const body = cues.map((cue) => `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}
${cue.text}`).join("\n\n");
  return `WEBVTT

${body}
`;
}
function buildCaptionBundle(align, opts) {
  const words = charAlignmentToWords(align);
  const cues = groupWordsIntoCues(words, opts);
  return {
    srt: buildSrt(cues),
    vtt: buildVtt(cues),
    words,
    cues
  };
}
function buildNaiveCaptions(text2, durationSeconds, opts) {
  const tokens = text2.split(/\s+/).filter((w) => w.length > 0);
  if (tokens.length === 0 || !isFinite(durationSeconds) || durationSeconds <= 0) {
    return { srt: "", vtt: "WEBVTT\n\n", words: [], cues: [] };
  }
  const perWord = durationSeconds / tokens.length;
  const words = tokens.map((t, i) => ({
    text: t,
    start: i * perWord,
    end: (i + 1) * perWord
  }));
  const cues = groupWordsIntoCues(words, opts);
  return {
    srt: buildSrt(cues),
    vtt: buildVtt(cues),
    words,
    cues
  };
}
var init_captions = __esm({
  "lib/audio/captions.ts"() {
    "use strict";
  }
});

// lib/audio/paths.ts
function getAudioDir() {
  return process.env.CENCH_AUDIO_DIR || import_node_path7.default.join(process.cwd(), "public", "audio");
}
function audioUrlFor(filename) {
  const raw = process.env.CENCH_AUDIO_URL_BASE || "/audio/";
  const base = raw.endsWith("/") ? raw : `${raw}/`;
  return `${base}${filename}`;
}
function isLocalAudioUrl(url) {
  return url.startsWith("/audio/") || url.startsWith("cench://audio/");
}
var import_node_path7;
var init_paths = __esm({
  "lib/audio/paths.ts"() {
    "use strict";
    import_node_path7 = __toESM(require("node:path"));
  }
});

// lib/audio/providers/elevenlabs-tts.ts
var elevenlabs_tts_exports = {};
__export(elevenlabs_tts_exports, {
  elevenlabsTTS: () => elevenlabsTTS
});
function getApiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}
var import_promises6, import_path, API_BASE, DEFAULT_VOICE_ID, DEFAULT_MODEL, elevenlabsTTS;
var init_elevenlabs_tts = __esm({
  "lib/audio/providers/elevenlabs-tts.ts"() {
    "use strict";
    import_promises6 = __toESM(require("fs/promises"));
    import_path = __toESM(require("path"));
    init_sanitize();
    init_captions();
    init_paths();
    API_BASE = "https://api.elevenlabs.io/v1";
    DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
    DEFAULT_MODEL = "eleven_turbo_v2_5";
    elevenlabsTTS = {
      id: "elevenlabs",
      name: "ElevenLabs",
      type: "server",
      requiresKey: "ELEVENLABS_API_KEY",
      async generate(params) {
        const apiKey = getApiKey();
        const voiceId = params.voiceId || DEFAULT_VOICE_ID;
        const model = params.model || DEFAULT_MODEL;
        const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            text: params.text,
            model_id: model,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs TTS error (${response.status}): ${errorText}`);
        }
        const payload = await response.json();
        const audioBuffer = Buffer.from(payload.audio_base64, "base64");
        const audioDir = getAudioDir();
        await import_promises6.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const filePath = import_path.default.join(audioDir, filename);
        await import_promises6.default.writeFile(filePath, audioBuffer);
        const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        const result = {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "elevenlabs"
        };
        const alignment = payload.normalized_alignment ?? payload.alignment;
        if (alignment && alignment.characters.length > 0) {
          const bundle = buildCaptionBundle(alignment);
          const base = filename.replace(/\.mp3$/, "");
          const srtName = `${base}.srt`;
          const vttName = `${base}.vtt`;
          await Promise.all([
            import_promises6.default.writeFile(import_path.default.join(audioDir, srtName), bundle.srt, "utf8"),
            import_promises6.default.writeFile(import_path.default.join(audioDir, vttName), bundle.vtt, "utf8")
          ]);
          result.captions = {
            srtUrl: audioUrlFor(srtName),
            vttUrl: audioUrlFor(vttName),
            kind: "aligned",
            words: bundle.words
          };
        }
        return result;
      },
      async listVoices() {
        const apiKey = getApiKey();
        const response = await fetch(`${API_BASE}/voices`, {
          headers: {
            "xi-api-key": apiKey
          }
        });
        if (!response.ok) {
          throw new Error(`ElevenLabs voices error (${response.status}): ${await response.text()}`);
        }
        const data = await response.json();
        return data.voices.map((v) => ({
          id: v.voice_id,
          name: v.name,
          language: v.labels?.language || "en",
          gender: v.labels?.gender,
          previewUrl: v.preview_url || null
        }));
      }
    };
  }
});

// lib/audio/providers/openai-tts.ts
var openai_tts_exports = {};
__export(openai_tts_exports, {
  openaiTTS: () => openaiTTS
});
function getApiKey2() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}
var import_promises7, import_path2, API_URL, DEFAULT_MODEL2, DEFAULT_VOICE, VOICES, openaiTTS;
var init_openai_tts = __esm({
  "lib/audio/providers/openai-tts.ts"() {
    "use strict";
    import_promises7 = __toESM(require("fs/promises"));
    import_path2 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    API_URL = "https://api.openai.com/v1/audio/speech";
    DEFAULT_MODEL2 = "tts-1";
    DEFAULT_VOICE = "alloy";
    VOICES = [
      { id: "alloy", name: "Alloy", language: "en", gender: "neutral" },
      { id: "ash", name: "Ash", language: "en", gender: "male" },
      { id: "ballad", name: "Ballad", language: "en", gender: "male" },
      { id: "coral", name: "Coral", language: "en", gender: "female" },
      { id: "echo", name: "Echo", language: "en", gender: "male" },
      { id: "fable", name: "Fable", language: "en", gender: "male" },
      { id: "nova", name: "Nova", language: "en", gender: "female" },
      { id: "onyx", name: "Onyx", language: "en", gender: "male" },
      { id: "sage", name: "Sage", language: "en", gender: "female" },
      { id: "shimmer", name: "Shimmer", language: "en", gender: "female" }
    ];
    openaiTTS = {
      id: "openai-tts",
      name: "OpenAI TTS",
      type: "server",
      requiresKey: "OPENAI_API_KEY",
      async generate(params) {
        const apiKey = getApiKey2();
        const model = params.model || DEFAULT_MODEL2;
        const voice = params.voiceId || DEFAULT_VOICE;
        const body = {
          model,
          voice,
          input: params.text,
          response_format: "mp3"
        };
        if (params.instructions && model === "gpt-4o-mini-tts") {
          body.instructions = params.instructions;
        }
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI TTS error (${response.status}): ${errorText}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const audioDir = getAudioDir();
        await import_promises7.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const filePath = import_path2.default.join(audioDir, filename);
        await import_promises7.default.writeFile(filePath, audioBuffer);
        const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "openai-tts"
        };
      },
      async listVoices() {
        return VOICES;
      }
    };
  }
});

// lib/audio/providers/gemini-tts.ts
var gemini_tts_exports = {};
__export(gemini_tts_exports, {
  geminiTTS: () => geminiTTS
});
function createWavHeader(pcmDataLength, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmDataLength;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(dataSize + headerSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}
async function generateViaGeminiAPI(params, apiKey) {
  const model = params.model || DEFAULT_MODEL3;
  const voiceName = params.voiceId || DEFAULT_VOICE2;
  let inputText = params.text;
  if (params.instructions) {
    inputText = `[${params.instructions}] ${params.text}`;
  }
  const body = {
    contents: [{ parts: [{ text: inputText }] }],
    generationConfig: {
      response_modalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    }
  };
  if (params.speakers && params.speakers.length > 0) {
    const speakerVoiceConfigs = params.speakers.map((s) => ({
      speaker: s.speaker,
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: s.voiceName
        }
      }
    }));
    body.generationConfig.speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs
      }
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini TTS error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const audioPart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!audioPart?.inlineData) {
    throw new Error("Gemini TTS returned no audio data");
  }
  const pcmData = Buffer.from(audioPart.inlineData.data, "base64");
  const sampleRate = 24e3;
  const numChannels = 1;
  const bitsPerSample = 16;
  const wavHeader = createWavHeader(pcmData.length, sampleRate, numChannels, bitsPerSample);
  return Buffer.concat([wavHeader, pcmData]);
}
async function generateViaGoogleCloudTTS(params, apiKey) {
  const voiceId = params.voiceId || "en-US-Studio-O";
  const languageCode = voiceId.split("-").slice(0, 2).join("-") || "en-US";
  let inputText = params.text;
  if (params.instructions) {
    inputText = `[${params.instructions}] ${params.text}`;
  }
  const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: inputText },
      voice: {
        languageCode,
        name: voiceId
      },
      audioConfig: {
        audioEncoding: "MP3"
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Cloud TTS (Gemini) error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return Buffer.from(data.audioContent, "base64");
}
var import_promises8, import_path3, DEFAULT_MODEL3, DEFAULT_VOICE2, GEMINI_VOICES, geminiTTS;
var init_gemini_tts = __esm({
  "lib/audio/providers/gemini-tts.ts"() {
    "use strict";
    import_promises8 = __toESM(require("fs/promises"));
    import_path3 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    DEFAULT_MODEL3 = "gemini-2.5-flash-preview-tts";
    DEFAULT_VOICE2 = "Kore";
    GEMINI_VOICES = [
      { id: "Kore", name: "Kore", language: "en", gender: "female" },
      { id: "Charon", name: "Charon", language: "en", gender: "male" },
      { id: "Fenrir", name: "Fenrir", language: "en", gender: "male" },
      { id: "Aoede", name: "Aoede", language: "en", gender: "female" },
      { id: "Puck", name: "Puck", language: "en", gender: "male" },
      { id: "Leda", name: "Leda", language: "en", gender: "female" },
      { id: "Orus", name: "Orus", language: "en", gender: "male" }
    ];
    geminiTTS = {
      id: "gemini-tts",
      name: "Gemini TTS",
      type: "server",
      requiresKey: "GEMINI_API_KEY",
      async generate(params) {
        const geminiKey = process.env.GEMINI_API_KEY;
        const googleKey = process.env.GOOGLE_TTS_API_KEY;
        if (!geminiKey && !googleKey) {
          throw new Error("Either GEMINI_API_KEY or GOOGLE_TTS_API_KEY must be set for Gemini TTS");
        }
        const audioDir = getAudioDir();
        await import_promises8.default.mkdir(audioDir, { recursive: true });
        let audioBuffer;
        let extension;
        if (geminiKey) {
          audioBuffer = await generateViaGeminiAPI(params, geminiKey);
          extension = "wav";
        } else {
          audioBuffer = await generateViaGoogleCloudTTS(params, googleKey);
          extension = "mp3";
        }
        const filename = safeAudioFilename("tts", params.sceneId, extension);
        const filePath = import_path3.default.join(audioDir, filename);
        await import_promises8.default.writeFile(filePath, audioBuffer);
        let durationEstimate;
        if (extension === "wav") {
          const pcmBytes = audioBuffer.length - 44;
          const bytesPerSecond = 24e3 * 1 * 2;
          durationEstimate = pcmBytes / bytesPerSecond;
        } else {
          durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        }
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "gemini-tts"
        };
      },
      async listVoices() {
        return GEMINI_VOICES;
      }
    };
  }
});

// lib/audio/providers/google-tts.ts
var google_tts_exports = {};
__export(google_tts_exports, {
  googleTTS: () => googleTTS
});
function getApiKey3() {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error("GOOGLE_TTS_API_KEY is not set");
  return key;
}
var import_promises9, import_path4, API_BASE2, DEFAULT_VOICE3, DEFAULT_LANGUAGE, googleTTS;
var init_google_tts = __esm({
  "lib/audio/providers/google-tts.ts"() {
    "use strict";
    import_promises9 = __toESM(require("fs/promises"));
    import_path4 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    API_BASE2 = "https://texttospeech.googleapis.com/v1";
    DEFAULT_VOICE3 = "en-US-Neural2-F";
    DEFAULT_LANGUAGE = "en-US";
    googleTTS = {
      id: "google-tts",
      name: "Google Cloud TTS",
      type: "server",
      requiresKey: "GOOGLE_TTS_API_KEY",
      async generate(params) {
        const apiKey = getApiKey3();
        const voiceId = params.voiceId || DEFAULT_VOICE3;
        const languageCode = voiceId.split("-").slice(0, 2).join("-") || DEFAULT_LANGUAGE;
        const response = await fetch(`${API_BASE2}/text:synthesize?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: { text: params.text },
            voice: {
              languageCode,
              name: voiceId
            },
            audioConfig: {
              audioEncoding: "MP3"
            }
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Google TTS error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        const audioBuffer = Buffer.from(data.audioContent, "base64");
        const audioDir = getAudioDir();
        await import_promises9.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const filePath = import_path4.default.join(audioDir, filename);
        await import_promises9.default.writeFile(filePath, audioBuffer);
        const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "google-tts"
        };
      },
      async listVoices() {
        const apiKey = getApiKey3();
        const response = await fetch(`${API_BASE2}/voices?key=${apiKey}`);
        if (!response.ok) {
          throw new Error(`Google TTS voices error (${response.status}): ${await response.text()}`);
        }
        const data = await response.json();
        return data.voices.map((v) => ({
          id: v.name,
          name: v.name,
          language: v.languageCodes[0] || "en-US",
          gender: v.ssmlGender?.toLowerCase()
        }));
      }
    };
  }
});

// lib/audio/providers/openai-edge-tts.ts
var openai_edge_tts_exports = {};
__export(openai_edge_tts_exports, {
  openaiEdgeTTS: () => openaiEdgeTTS
});
function getBaseUrl() {
  return process.env.EDGE_TTS_URL || "http://localhost:5050";
}
var import_promises10, import_path5, DEFAULT_VOICE4, EDGE_VOICES, openaiEdgeTTS;
var init_openai_edge_tts = __esm({
  "lib/audio/providers/openai-edge-tts.ts"() {
    "use strict";
    import_promises10 = __toESM(require("fs/promises"));
    import_path5 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    DEFAULT_VOICE4 = "en-US-AndrewNeural";
    EDGE_VOICES = [
      { id: "en-US-AndrewNeural", name: "Andrew", language: "en-US", gender: "male" },
      { id: "en-US-AriaNeural", name: "Aria", language: "en-US", gender: "female" },
      { id: "en-US-AvaNeural", name: "Ava", language: "en-US", gender: "female" },
      { id: "en-US-BrianNeural", name: "Brian", language: "en-US", gender: "male" },
      { id: "en-US-ChristopherNeural", name: "Christopher", language: "en-US", gender: "male" },
      { id: "en-US-EmmaNeural", name: "Emma", language: "en-US", gender: "female" },
      { id: "en-US-EricNeural", name: "Eric", language: "en-US", gender: "male" },
      { id: "en-US-GuyNeural", name: "Guy", language: "en-US", gender: "male" },
      { id: "en-US-JennyNeural", name: "Jenny", language: "en-US", gender: "female" },
      { id: "en-US-MichelleNeural", name: "Michelle", language: "en-US", gender: "female" },
      { id: "en-US-RogerNeural", name: "Roger", language: "en-US", gender: "male" },
      { id: "en-US-SteffanNeural", name: "Steffan", language: "en-US", gender: "male" },
      { id: "en-GB-RyanNeural", name: "Ryan (UK)", language: "en-GB", gender: "male" },
      { id: "en-GB-SoniaNeural", name: "Sonia (UK)", language: "en-GB", gender: "female" },
      { id: "en-GB-LibbyNeural", name: "Libby (UK)", language: "en-GB", gender: "female" },
      { id: "en-AU-NatashaNeural", name: "Natasha (AU)", language: "en-AU", gender: "female" },
      { id: "en-AU-WilliamNeural", name: "William (AU)", language: "en-AU", gender: "male" }
    ];
    openaiEdgeTTS = {
      id: "openai-edge-tts",
      name: "Edge TTS (Local)",
      type: "server",
      requiresKey: null,
      async generate(params) {
        const baseUrl = getBaseUrl();
        const voice = params.voiceId || DEFAULT_VOICE4;
        const response = await fetch(`${baseUrl}/v1/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "tts-1",
            voice,
            input: params.text
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge TTS error (${response.status}): ${errorText}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const audioDir = getAudioDir();
        await import_promises10.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const filePath = import_path5.default.join(audioDir, filename);
        await import_promises10.default.writeFile(filePath, audioBuffer);
        const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "openai-edge-tts"
        };
      },
      async listVoices() {
        const baseUrl = getBaseUrl();
        try {
          const response = await fetch(`${baseUrl}/v1/voices`, {
            signal: AbortSignal.timeout(3e3)
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map((v) => ({
                id: v.ShortName || v.id || v.name || "",
                name: v.name || v.ShortName || v.id || "",
                language: v.Locale || "en-US",
                gender: v.Gender?.toLowerCase()
              }));
            }
          }
        } catch {
        }
        return EDGE_VOICES;
      }
    };
  }
});

// lib/audio/providers/pocket-tts.ts
var pocket_tts_exports = {};
__export(pocket_tts_exports, {
  pocketTTS: () => pocketTTS
});
function getBaseUrl2() {
  return process.env.POCKET_TTS_URL || "http://localhost:8000";
}
var import_promises11, import_path6, DEFAULT_VOICE5, POCKET_VOICES, VOICE_URLS, pocketTTS;
var init_pocket_tts = __esm({
  "lib/audio/providers/pocket-tts.ts"() {
    "use strict";
    import_promises11 = __toESM(require("fs/promises"));
    import_path6 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    DEFAULT_VOICE5 = "alba";
    POCKET_VOICES = [
      { id: "alba", name: "Alba", language: "en", gender: "female" },
      { id: "marius", name: "Marius", language: "en", gender: "male" },
      { id: "javert", name: "Javert", language: "en", gender: "male" },
      { id: "jean", name: "Jean", language: "en", gender: "male" },
      { id: "fantine", name: "Fantine", language: "en", gender: "female" },
      { id: "cosette", name: "Cosette", language: "en", gender: "female" },
      { id: "eponine", name: "Eponine", language: "en", gender: "female" },
      { id: "azelma", name: "Azelma", language: "en", gender: "female" }
    ];
    VOICE_URLS = {
      alba: "hf://kyutai/tts-voices/alba.wav",
      marius: "hf://kyutai/tts-voices/marius.wav",
      javert: "hf://kyutai/tts-voices/javert.wav",
      jean: "hf://kyutai/tts-voices/jean.wav",
      fantine: "hf://kyutai/tts-voices/fantine.wav",
      cosette: "hf://kyutai/tts-voices/cosette.wav",
      eponine: "hf://kyutai/tts-voices/eponine.wav",
      azelma: "hf://kyutai/tts-voices/azelma.wav"
    };
    pocketTTS = {
      id: "pocket-tts",
      name: "Pocket TTS (Local)",
      type: "server",
      requiresKey: null,
      async generate(params) {
        const baseUrl = getBaseUrl2();
        const voice = params.voiceId || DEFAULT_VOICE5;
        const formData = new FormData();
        formData.append("text", params.text);
        const isBuiltIn = voice in VOICE_URLS;
        if (!isBuiltIn && voice) {
          formData.append("voice_url", voice);
        }
        const response = await fetch(`${baseUrl}/tts`, {
          method: "POST",
          body: formData
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pocket TTS error (${response.status}): ${errorText}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const audioDir = getAudioDir();
        await import_promises11.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "wav");
        const filePath = import_path6.default.join(audioDir, filename);
        await import_promises11.default.writeFile(filePath, audioBuffer);
        const headerSize = 44;
        const durationEstimate = Math.max(0, audioBuffer.length - headerSize) / 48e3;
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "pocket-tts"
        };
      },
      async listVoices() {
        return POCKET_VOICES;
      },
      async cloneVoice(params) {
        const audioDir = import_path6.default.join(getAudioDir(), "voices");
        await import_promises11.default.mkdir(audioDir, { recursive: true });
        const voiceId = `cloned-${Date.now().toString(36)}`;
        const voicePath = import_path6.default.join(audioDir, `${voiceId}.wav`);
        await import_promises11.default.writeFile(voicePath, params.audioBuffer);
        return {
          voiceId,
          name: params.name
        };
      }
    };
  }
});

// lib/audio/providers/voxcpm-tts.ts
var voxcpm_tts_exports = {};
__export(voxcpm_tts_exports, {
  voxcpmTTS: () => voxcpmTTS
});
function getBaseUrl3() {
  return process.env.VOXCPM_URL || "http://localhost:8100";
}
var import_promises12, import_path7, DEFAULT_VOICE6, voxcpmTTS;
var init_voxcpm_tts = __esm({
  "lib/audio/providers/voxcpm-tts.ts"() {
    "use strict";
    import_promises12 = __toESM(require("fs/promises"));
    import_path7 = __toESM(require("path"));
    init_sanitize();
    init_paths();
    DEFAULT_VOICE6 = "default";
    voxcpmTTS = {
      id: "voxcpm",
      name: "VoxCPM2 (Local GPU)",
      type: "server",
      requiresKey: null,
      async generate(params) {
        const baseUrl = getBaseUrl3();
        const voice = params.voiceId || DEFAULT_VOICE6;
        const response = await fetch(`${baseUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: params.text,
            voice_id: voice,
            mode: "standard",
            language: "en"
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`VoxCPM error (${response.status}): ${errorText}`);
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const audioDir = getAudioDir();
        await import_promises12.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const filePath = import_path7.default.join(audioDir, filename);
        await import_promises12.default.writeFile(filePath, audioBuffer);
        const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
        return {
          audioUrl: audioUrlFor(filename),
          duration: Math.round(durationEstimate * 10) / 10,
          provider: "voxcpm"
        };
      },
      async listVoices() {
        const baseUrl = getBaseUrl3();
        try {
          const response = await fetch(`${baseUrl}/v1/voices`, {
            signal: AbortSignal.timeout(3e3)
          });
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              return data.map((v) => ({
                id: v.voice_id || v.id || v.name || "",
                name: v.name || v.id || "",
                language: v.language || "en",
                gender: v.gender?.toLowerCase()
              }));
            }
          }
        } catch {
        }
        return [];
      },
      async cloneVoice(params) {
        const baseUrl = getBaseUrl3();
        const formData = new FormData();
        formData.append("name", params.name);
        formData.append("audio", new Blob([new Uint8Array(params.audioBuffer)]), "reference.wav");
        if (params.transcript) formData.append("transcript", params.transcript);
        formData.append("mode", params.mode || "controllable");
        const response = await fetch(`${baseUrl}/v1/voices/clone`, {
          method: "POST",
          body: formData
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`VoxCPM clone error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        return {
          voiceId: data.voice_id || params.name,
          name: data.name || params.name
        };
      },
      async designVoice(params) {
        const baseUrl = getBaseUrl3();
        const response = await fetch(`${baseUrl}/v1/voices/design`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: params.description,
            sample_text: params.sampleText
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`VoxCPM voice design error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        return {
          voiceId: data.voice_id || "designed-voice",
          name: data.name || "Designed Voice",
          previewUrl: data.preview_url
        };
      }
    };
  }
});

// lib/audio/providers/native-tts.ts
var native_tts_exports = {};
__export(native_tts_exports, {
  nativeTTS: () => nativeTTS
});
function sanitizeText(text2) {
  return text2.replace(/[\x00-\x1f]/g, " ");
}
function sanitizeVoiceId(id) {
  const cleaned = id.replace(/[^a-zA-Z0-9 \-_.]/g, "");
  if (cleaned !== id) {
    console.warn(`[native-tts] Stripped unsafe characters from voiceId: "${id}" -> "${cleaned}"`);
  }
  return cleaned;
}
async function ffmpegConvert(input, output) {
  await execFileAsync("ffmpeg", ["-y", "-i", input, "-ar", "44100", "-ac", "1", "-b:a", "128k", output], {
    timeout: 3e4
  });
}
function estimateDuration(mp3Bytes) {
  return Math.round(mp3Bytes * 8 / (128 * 1e3) * 10) / 10;
}
async function generateMac(params, outMp3) {
  const voice = sanitizeVoiceId(params.voiceId || "Samantha");
  const tmpAiff = import_path8.default.join(import_os.default.tmpdir(), `native-tts-${Date.now()}.aiff`);
  try {
    await execFileAsync("say", ["-v", voice, "-o", tmpAiff, sanitizeText(params.text)], { timeout: 6e4 });
    await ffmpegConvert(tmpAiff, outMp3);
    const stat = await import_promises13.default.stat(outMp3);
    return estimateDuration(stat.size);
  } finally {
    await import_promises13.default.unlink(tmpAiff).catch(() => {
    });
  }
}
async function listVoicesMac() {
  const { stdout } = await execFileAsync("say", ["-v", "?"], { timeout: 1e4 });
  return stdout.split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^(.+?)\s{2,}(\S+)\s+#\s*(.*)$/);
    if (!match) return null;
    const [, name, langRaw, description] = match;
    const lang = langRaw.replace("_", "-");
    return {
      id: name.trim(),
      name: `${name.trim()} \u2014 ${description.trim()}`,
      language: lang
    };
  }).filter((v) => v !== null);
}
async function generateWin(params, outMp3) {
  const voice = sanitizeVoiceId(params.voiceId || "");
  const tmpWav = import_path8.default.join(import_os.default.tmpdir(), `native-tts-${Date.now()}.wav`);
  const escapedText = sanitizeText(params.text).replace(/'/g, "''");
  const selectVoice = voice ? `$synth.SelectVoice('${voice.replace(/'/g, "''")}')` : "";
  const ps = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    selectVoice,
    `$synth.SetOutputToWaveFile('${tmpWav.replace(/'/g, "''")}')`,
    `$synth.Speak('${escapedText}')`,
    "$synth.Dispose()"
  ].filter(Boolean).join("; ");
  try {
    await execFileAsync("powershell", ["-NoProfile", "-Command", ps], { timeout: 6e4 });
    await ffmpegConvert(tmpWav, outMp3);
    const stat = await import_promises13.default.stat(outMp3);
    return estimateDuration(stat.size);
  } finally {
    await import_promises13.default.unlink(tmpWav).catch(() => {
    });
  }
}
async function listVoicesWin() {
  const ps = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$synth.GetInstalledVoices() | ForEach-Object {",
    "  $v = $_.VoiceInfo",
    '  "$($v.Name)|$($v.Culture.Name)|$($v.Gender)"',
    "}",
    "$synth.Dispose()"
  ].join("; ");
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", ps], { timeout: 1e4 });
  return stdout.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, lang, gender] = line.split("|");
    return {
      id: name,
      name,
      language: lang || "en-US",
      gender: gender?.toLowerCase()
    };
  });
}
var import_child_process, import_util, import_promises13, import_path8, import_os, execFileAsync, nativeTTS;
var init_native_tts = __esm({
  "lib/audio/providers/native-tts.ts"() {
    "use strict";
    import_child_process = require("child_process");
    import_util = require("util");
    import_promises13 = __toESM(require("fs/promises"));
    import_path8 = __toESM(require("path"));
    import_os = __toESM(require("os"));
    init_sanitize();
    init_paths();
    execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
    nativeTTS = {
      id: "native-tts",
      name: "System Voice",
      type: "server",
      requiresKey: null,
      async generate(params) {
        const platform = process.platform;
        if (platform !== "darwin" && platform !== "win32") {
          throw new Error("Native TTS is only available on macOS and Windows");
        }
        const audioDir = getAudioDir();
        await import_promises13.default.mkdir(audioDir, { recursive: true });
        const filename = safeAudioFilename("tts", params.sceneId, "mp3");
        const outMp3 = import_path8.default.join(audioDir, filename);
        const duration = platform === "darwin" ? await generateMac(params, outMp3) : await generateWin(params, outMp3);
        return {
          audioUrl: audioUrlFor(filename),
          duration,
          provider: "native-tts"
        };
      },
      async listVoices() {
        if (process.platform === "darwin") return listVoicesMac();
        if (process.platform === "win32") return listVoicesWin();
        return [];
      }
    };
  }
});

// lib/audio/providers/web-speech.ts
var web_speech_exports = {};
__export(web_speech_exports, {
  webSpeechTTS: () => webSpeechTTS
});
var webSpeechTTS;
var init_web_speech = __esm({
  "lib/audio/providers/web-speech.ts"() {
    "use strict";
    webSpeechTTS = {
      id: "web-speech",
      name: "Web Speech API",
      type: "client",
      requiresKey: null,
      async generate(params) {
        const text2 = encodeURIComponent(params.text);
        const voiceId = params.voiceId ? encodeURIComponent(params.voiceId) : "";
        const url = voiceId ? `web-speech://${text2}?voice=${voiceId}` : `web-speech://${text2}`;
        return {
          audioUrl: url,
          duration: null,
          provider: "web-speech"
        };
      },
      async listVoices() {
        return [];
      }
    };
  }
});

// lib/audio/providers/puter-tts.ts
var puter_tts_exports = {};
__export(puter_tts_exports, {
  puterTTS: () => puterTTS
});
var OPENAI_VOICES, puterTTS;
var init_puter_tts = __esm({
  "lib/audio/providers/puter-tts.ts"() {
    "use strict";
    OPENAI_VOICES = [
      { id: "alloy", name: "Alloy", gender: "neutral" },
      { id: "echo", name: "Echo", gender: "male" },
      { id: "nova", name: "Nova", gender: "female" },
      { id: "shimmer", name: "Shimmer", gender: "female" },
      { id: "fable", name: "Fable", gender: "male" },
      { id: "onyx", name: "Onyx", gender: "male" }
    ];
    puterTTS = {
      id: "puter",
      name: "Puter TTS",
      type: "client",
      requiresKey: null,
      async generate(params) {
        const text2 = encodeURIComponent(params.text);
        const provider = params.model || "openai";
        const voiceId = params.voiceId || "nova";
        const url = `puter-tts://${text2}?provider=${encodeURIComponent(provider)}&voice=${encodeURIComponent(voiceId)}`;
        return {
          audioUrl: url,
          duration: null,
          provider: "puter"
        };
      },
      async listVoices() {
        return OPENAI_VOICES.map((v) => ({
          id: v.id,
          name: v.name,
          language: "en",
          gender: v.gender,
          previewUrl: null
        }));
      }
    };
  }
});

// lib/audio/providers/elevenlabs-sfx.ts
var elevenlabs_sfx_exports = {};
__export(elevenlabs_sfx_exports, {
  elevenlabsSFX: () => elevenlabsSFX
});
function getApiKey4() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}
async function generateSFX(prompt, duration) {
  const apiKey = getApiKey4();
  const response = await fetch(`${API_BASE3}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: duration || 3,
      prompt_influence: 0.3
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs SFX generation error (${response.status}): ${errorText}`);
  }
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioDir = getAudioDir();
  await import_promises14.default.mkdir(audioDir, { recursive: true });
  const timestamp2 = Date.now();
  const rand = import_crypto4.default.randomBytes(4).toString("hex");
  const filename = `sfx-generated-${timestamp2}-${rand}.mp3`;
  const filePath = import_path9.default.join(audioDir, filename);
  await import_promises14.default.writeFile(filePath, audioBuffer);
  const durationEstimate = audioBuffer.length * 8 / (128 * 1e3);
  const localUrl = audioUrlFor(filename);
  return {
    id: `elevenlabs-sfx-${timestamp2}`,
    name: prompt,
    audioUrl: localUrl,
    duration: Math.round(durationEstimate * 10) / 10,
    provider: "elevenlabs-sfx",
    previewUrl: localUrl
  };
}
var import_promises14, import_path9, import_crypto4, API_BASE3, elevenlabsSFX;
var init_elevenlabs_sfx = __esm({
  "lib/audio/providers/elevenlabs-sfx.ts"() {
    "use strict";
    import_promises14 = __toESM(require("fs/promises"));
    import_path9 = __toESM(require("path"));
    import_crypto4 = __toESM(require("crypto"));
    init_paths();
    API_BASE3 = "https://api.elevenlabs.io/v1";
    elevenlabsSFX = {
      id: "elevenlabs-sfx",
      name: "ElevenLabs Sound Effects",
      requiresKey: "ELEVENLABS_API_KEY",
      async search(query, _limit, _options) {
        const result = await generateSFX(query);
        return [result];
      },
      generate: generateSFX
    };
  }
});

// lib/audio/sfx-license.ts
function isCommercialFriendlyFreesoundLicense(license) {
  if (!license || typeof license !== "string") return false;
  const l = license.toLowerCase();
  if (l.includes("noncommercial") || l.includes("non-commercial") || l.includes("by-nc") || l.includes("/by-nc")) {
    return false;
  }
  if (l.includes("sampling+") || l.includes("sampling plus")) return false;
  if (l.includes("publicdomain/zero") || l.includes("creativecommons.org/publicdomain/zero") || l.includes("creative commons 0") || l === "cc0") {
    return true;
  }
  if (l.includes("creativecommons.org/licenses/by/") && !l.includes("nc")) return true;
  return false;
}
var PIXABAY_SFX_LICENSE_NOTE, FREESOUND_LICENSE_NOTE;
var init_sfx_license = __esm({
  "lib/audio/sfx-license.ts"() {
    "use strict";
    PIXABAY_SFX_LICENSE_NOTE = "Pixabay License \u2014 free for commercial use; see https://pixabay.com/service/license/";
    FREESOUND_LICENSE_NOTE = "Freesound: we only list CC0 and CC BY sounds here for commercial-friendly use; CC BY requires attribution to the author. Verify on the sound\u2019s Freesound page before shipping.";
  }
});

// lib/audio/providers/freesound.ts
var freesound_exports = {};
__export(freesound_exports, {
  freesoundSFX: () => freesoundSFX
});
function getApiKey5() {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) throw new Error("FREESOUND_API_KEY is not set");
  return key;
}
var API_BASE4, freesoundSFX;
var init_freesound = __esm({
  "lib/audio/providers/freesound.ts"() {
    "use strict";
    init_sfx_license();
    API_BASE4 = "https://freesound.org/apiv2";
    freesoundSFX = {
      id: "freesound",
      name: "Freesound",
      requiresKey: "FREESOUND_API_KEY",
      async search(query, limit = 10, options) {
        const apiKey = getApiKey5();
        const commercialOnly = options?.commercialOnly ?? false;
        const page = Math.max(1, options?.page ?? 1);
        const pageSize = Math.min(150, Math.max(limit * (commercialOnly ? 4 : 1), limit));
        const params = new URLSearchParams({
          query,
          page: String(page),
          page_size: String(pageSize),
          fields: "id,name,previews,duration,license",
          token: apiKey
        });
        const response = await fetch(`${API_BASE4}/search/text/?${params}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Freesound search error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        let mapped = data.results.map((result) => ({
          id: String(result.id),
          name: result.name,
          audioUrl: result.previews["preview-hq-mp3"],
          duration: Math.round(result.duration * 10) / 10,
          provider: "freesound",
          previewUrl: result.previews["preview-hq-mp3"],
          license: result.license
        }));
        if (commercialOnly) {
          mapped = mapped.filter((r) => isCommercialFriendlyFreesoundLicense(r.license));
        }
        return mapped.slice(0, limit);
      }
    };
  }
});

// lib/audio/providers/pixabay.ts
var pixabay_exports = {};
__export(pixabay_exports, {
  pixabaySFX: () => pixabaySFX
});
function getApiKey6() {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("PIXABAY_API_KEY is not set");
  return key;
}
var API_BASE5, pixabaySFX;
var init_pixabay = __esm({
  "lib/audio/providers/pixabay.ts"() {
    "use strict";
    init_sfx_license();
    API_BASE5 = "https://pixabay.com/api/audio/";
    pixabaySFX = {
      id: "pixabay",
      name: "Pixabay SFX",
      requiresKey: "PIXABAY_API_KEY",
      async search(query, limit = 10, options) {
        const apiKey = getApiKey6();
        const perPage = Math.min(200, limit || 10);
        const page = Math.max(1, options?.page ?? 1);
        const params = new URLSearchParams({
          key: apiKey,
          q: query,
          per_page: String(perPage),
          page: String(page),
          safesearch: "true",
          audio_type: "sfx"
        });
        try {
          const response = await fetch(`${API_BASE5}?${params}`);
          if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
              return [];
            }
            const errorText = await response.text();
            throw new Error(`Pixabay SFX search error (${response.status}): ${errorText}`);
          }
          const data = await response.json();
          return data.hits.map((hit) => ({
            id: String(hit.id),
            name: hit.title,
            audioUrl: hit.audio,
            duration: hit.duration,
            provider: "pixabay",
            previewUrl: hit.audio,
            license: PIXABAY_SFX_LICENSE_NOTE
          }));
        } catch (err) {
          if (err instanceof TypeError && err.message.includes("fetch")) {
            return [];
          }
          throw err;
        }
      }
    };
  }
});

// lib/audio/providers/pixabay-music.ts
var pixabay_music_exports = {};
__export(pixabay_music_exports, {
  pixabayMusic: () => pixabayMusic
});
function getApiKey7() {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("PIXABAY_API_KEY is not set");
  return key;
}
var API_BASE6, pixabayMusic;
var init_pixabay_music = __esm({
  "lib/audio/providers/pixabay-music.ts"() {
    "use strict";
    API_BASE6 = "https://pixabay.com/api/audio/";
    pixabayMusic = {
      id: "pixabay-music",
      name: "Pixabay Music",
      requiresKey: "PIXABAY_API_KEY",
      async search(query, limit) {
        const apiKey = getApiKey7();
        const perPage = limit || 10;
        const params = new URLSearchParams({
          key: apiKey,
          q: query,
          per_page: String(perPage),
          safesearch: "true"
        });
        try {
          const response = await fetch(`${API_BASE6}?${params}`);
          if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
              return [];
            }
            const errorText = await response.text();
            throw new Error(`Pixabay Music search error (${response.status}): ${errorText}`);
          }
          const data = await response.json();
          return data.hits.map((hit) => ({
            id: String(hit.id),
            name: hit.title,
            audioUrl: hit.audio,
            duration: hit.duration,
            provider: "pixabay-music",
            previewUrl: hit.audio
          }));
        } catch (err) {
          if (err instanceof TypeError && err.message.includes("fetch")) {
            return [];
          }
          throw err;
        }
      }
    };
  }
});

// lib/audio/providers/freesound-music.ts
var freesound_music_exports = {};
__export(freesound_music_exports, {
  freesoundMusic: () => freesoundMusic
});
function getApiKey8() {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) throw new Error("FREESOUND_API_KEY is not set");
  return key;
}
var API_BASE7, freesoundMusic;
var init_freesound_music = __esm({
  "lib/audio/providers/freesound-music.ts"() {
    "use strict";
    API_BASE7 = "https://freesound.org/apiv2";
    freesoundMusic = {
      id: "freesound-music",
      name: "Freesound Music",
      requiresKey: "FREESOUND_API_KEY",
      async search(query, limit) {
        const apiKey = getApiKey8();
        const pageSize = limit || 10;
        const params = new URLSearchParams({
          query: `${query} music background`,
          page_size: String(pageSize),
          filter: "duration:[30 TO 300]",
          fields: "id,name,previews,duration,license",
          token: apiKey
        });
        const response = await fetch(`${API_BASE7}/search/text/?${params}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Freesound Music search error (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        return data.results.map((result) => ({
          id: String(result.id),
          name: result.name,
          audioUrl: result.previews["preview-hq-mp3"],
          duration: Math.round(result.duration * 10) / 10,
          provider: "freesound-music",
          previewUrl: result.previews["preview-hq-mp3"]
        }));
      }
    };
  }
});

// electron/main.ts
var import_path12 = __toESM(require("path"));
var import_child_process3 = require("child_process");
var import_util3 = require("util");
var import_electron6 = require("electron");
var import_promises19 = __toESM(require("fs/promises"));
var import_fs = __toESM(require("fs"));
var import_url = require("url");
var import_dotenv = require("dotenv");

// electron/ipc/settings.ts
function listProviders() {
  return {
    providers: {
      tts: [
        { id: "elevenlabs", name: "ElevenLabs", available: !!process.env.ELEVENLABS_API_KEY },
        { id: "openai-tts", name: "OpenAI TTS", available: !!process.env.OPENAI_API_KEY },
        { id: "gemini-tts", name: "Gemini TTS", available: !!process.env.GEMINI_API_KEY },
        { id: "google-tts", name: "Google Cloud TTS", available: !!process.env.GOOGLE_TTS_API_KEY },
        { id: "openai-edge-tts", name: "Edge TTS (local)", available: !!process.env.EDGE_TTS_URL },
        { id: "pocket-tts", name: "Pocket TTS (local)", available: !!process.env.POCKET_TTS_URL },
        { id: "voxcpm", name: "VoxCPM2 (local GPU)", available: !!process.env.VOXCPM_URL },
        {
          id: "native-tts",
          name: "System Voice",
          available: process.platform === "darwin" || process.platform === "win32"
        },
        { id: "puter", name: "Puter.js", available: true },
        { id: "web-speech", name: "Web Speech API", available: true }
      ],
      sfx: [
        { id: "elevenlabs-sfx", name: "ElevenLabs SFX", available: !!process.env.ELEVENLABS_API_KEY },
        { id: "freesound", name: "Freesound", available: !!process.env.FREESOUND_API_KEY },
        { id: "pixabay", name: "Pixabay", available: !!process.env.PIXABAY_API_KEY }
      ],
      music: [
        { id: "pixabay-music", name: "Pixabay Music", available: !!process.env.PIXABAY_API_KEY },
        { id: "freesound-music", name: "Freesound Music", available: !!process.env.FREESOUND_API_KEY }
      ]
    },
    media: [
      { id: "veo3", name: "Veo3 Video", category: "video", available: !!process.env.GOOGLE_AI_KEY },
      { id: "kling", name: "Kling 2.1", category: "video", available: !!process.env.FAL_KEY },
      { id: "runway", name: "Runway Gen-4", category: "video", available: !!process.env.RUNWAY_API_KEY },
      { id: "googleImageGen", name: "Google Imagen", category: "image", available: !!process.env.GOOGLE_AI_KEY },
      { id: "imageGen", name: "FAL Image Gen", category: "image", available: !!process.env.FAL_KEY },
      { id: "dall-e", name: "DALL-E 3", category: "image", available: !!process.env.OPENAI_API_KEY },
      { id: "heygen", name: "HeyGen Avatars", category: "avatar", available: !!process.env.HEYGEN_API_KEY },
      { id: "talkinghead", name: "TalkingHead (Free)", category: "avatar", available: true },
      { id: "musetalk", name: "MuseTalk", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "fabric", name: "Fabric 1.0", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "aurora", name: "Aurora", category: "avatar", available: !!process.env.FAL_KEY },
      { id: "backgroundRemoval", name: "Background Removal", category: "utility", available: true },
      { id: "unsplash", name: "Unsplash", category: "utility", available: true }
    ]
  };
}
function register(ipcMain2) {
  ipcMain2.handle("cench:settings.listProviders", async () => listProviders());
}

// lib/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// lib/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  accountsRelations: () => accountsRelations,
  agentTypeEnum: () => agentTypeEnum,
  agentUsage: () => agentUsage,
  analyticsEvents: () => analyticsEvents,
  apiSpend: () => apiSpend,
  assets: () => assets,
  avatarConfigs: () => avatarConfigs,
  avatarConfigsRelations: () => avatarConfigsRelations,
  avatarVideos: () => avatarVideos,
  avatarVideosRelations: () => avatarVideosRelations,
  clipSourceTypeEnum: () => clipSourceTypeEnum,
  conversations: () => conversations,
  conversationsRelations: () => conversationsRelations,
  generatedMedia: () => generatedMedia,
  generationLogs: () => generationLogs,
  githubLinks: () => githubLinks,
  githubLinksRelations: () => githubLinksRelations,
  interactions: () => interactions,
  layerTypeEnum: () => layerTypeEnum,
  layers: () => layers,
  layersRelations: () => layersRelations,
  mediaCache: () => mediaCache,
  mediaStatusEnum: () => mediaStatusEnum,
  messages: () => messages,
  messagesRelations: () => messagesRelations,
  outputModeEnum: () => outputModeEnum,
  permissionRules: () => permissionRules,
  permissionRulesRelations: () => permissionRulesRelations,
  permissionSessions: () => permissionSessions,
  planEnum: () => planEnum,
  projectAssets: () => projectAssets,
  projectAssetsRelations: () => projectAssetsRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  publishedProjects: () => publishedProjects,
  sceneEdges: () => sceneEdges,
  sceneNodes: () => sceneNodes,
  sceneNodesRelations: () => sceneNodesRelations,
  sceneTemplates: () => sceneTemplates,
  scenes: () => scenes,
  scenesRelations: () => scenesRelations,
  sessions: () => sessions,
  sessionsRelations: () => sessionsRelations,
  snapshots: () => snapshots,
  storageModeEnum: () => storageModeEnum,
  threeDComponents: () => threeDComponents,
  timelineClips: () => timelineClips,
  timelineClipsRelations: () => timelineClipsRelations,
  timelineTracks: () => timelineTracks,
  timelineTracksRelations: () => timelineTracksRelations,
  trackTypeEnum: () => trackTypeEnum,
  userMemory: () => userMemory,
  userMemoryRelations: () => userMemoryRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  verificationTokens: () => verificationTokens,
  workspaces: () => workspaces,
  workspacesRelations: () => workspacesRelations
});
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_orm = require("drizzle-orm");
var outputModeEnum = (0, import_pg_core.pgEnum)("output_mode", ["mp4", "interactive"]);
var storageModeEnum = (0, import_pg_core.pgEnum)("storage_mode", ["local", "cloud"]);
var layerTypeEnum = (0, import_pg_core.pgEnum)("layer_type", [
  "canvas2d",
  "svg",
  "d3",
  "three",
  "zdog",
  "lottie",
  "html",
  "assets",
  "group",
  "avatar",
  "veo3",
  "image",
  "sticker"
]);
var agentTypeEnum = (0, import_pg_core.pgEnum)("agent_type", ["router", "director", "scene-maker", "editor", "dop", "planner"]);
var mediaStatusEnum = (0, import_pg_core.pgEnum)("media_status", ["pending", "generating", "processing", "ready", "error"]);
var planEnum = (0, import_pg_core.pgEnum)("plan", ["free", "pro", "team"]);
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  name: (0, import_pg_core.text)("name"),
  emailVerified: (0, import_pg_core.timestamp)("email_verified", { mode: "date" }),
  image: (0, import_pg_core.text)("image"),
  avatarUrl: (0, import_pg_core.text)("avatar_url"),
  plan: planEnum("plan").default("free"),
  defaultStorageMode: storageModeEnum("default_storage_mode").default("local"),
  preferences: (0, import_pg_core.jsonb)("preferences").default({}),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
});
var accounts = (0, import_pg_core.pgTable)(
  "accounts",
  {
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: (0, import_pg_core.text)("type").$type().notNull(),
    provider: (0, import_pg_core.text)("provider").notNull(),
    providerAccountId: (0, import_pg_core.text)("provider_account_id").notNull(),
    refresh_token: (0, import_pg_core.text)("refresh_token"),
    access_token: (0, import_pg_core.text)("access_token"),
    expires_at: (0, import_pg_core.integer)("expires_at"),
    token_type: (0, import_pg_core.text)("token_type"),
    scope: (0, import_pg_core.text)("scope"),
    id_token: (0, import_pg_core.text)("id_token"),
    session_state: (0, import_pg_core.text)("session_state")
  },
  (t) => ({
    compoundKey: (0, import_pg_core.primaryKey)({ columns: [t.provider, t.providerAccountId] })
  })
);
var sessions = (0, import_pg_core.pgTable)("sessions", {
  sessionToken: (0, import_pg_core.text)("session_token").primaryKey(),
  userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: (0, import_pg_core.timestamp)("expires", { mode: "date" }).notNull()
});
var verificationTokens = (0, import_pg_core.pgTable)(
  "verification_tokens",
  {
    identifier: (0, import_pg_core.text)("identifier").notNull(),
    token: (0, import_pg_core.text)("token").notNull(),
    expires: (0, import_pg_core.timestamp)("expires", { mode: "date" }).notNull()
  },
  (t) => ({
    compoundKey: (0, import_pg_core.primaryKey)({ columns: [t.identifier, t.token] })
  })
);
var userMemory = (0, import_pg_core.pgTable)(
  "user_memory",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: (0, import_pg_core.text)("category").notNull(),
    key: (0, import_pg_core.text)("key").notNull(),
    value: (0, import_pg_core.text)("value").notNull(),
    confidence: (0, import_pg_core.real)("confidence").default(0.5).notNull(),
    sourceRunId: (0, import_pg_core.text)("source_run_id"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("user_memory_user_idx").on(t.userId),
    userKeyIdx: (0, import_pg_core.uniqueIndex)("user_memory_user_key_idx").on(t.userId, t.category, t.key)
  })
);
var workspaces = (0, import_pg_core.pgTable)(
  "workspaces",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    color: (0, import_pg_core.text)("color"),
    icon: (0, import_pg_core.text)("icon"),
    brandKit: (0, import_pg_core.jsonb)("brand_kit").$type().default(null),
    globalStyle: (0, import_pg_core.jsonb)("global_style").$type().default(null),
    settings: (0, import_pg_core.jsonb)("settings").$type().default({}),
    isDefault: (0, import_pg_core.boolean)("is_default").default(false),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("workspaces_user_idx").on(t.userId),
    defaultIdx: (0, import_pg_core.index)("workspaces_default_idx").on(t.userId, t.isDefault)
  })
);
var projects = (0, import_pg_core.pgTable)(
  "projects",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id, { onDelete: "cascade" }),
    workspaceId: (0, import_pg_core.uuid)("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    sceneGraphStartSceneId: (0, import_pg_core.uuid)("scene_graph_start_scene_id"),
    outputMode: outputModeEnum("output_mode").default("mp4"),
    storageMode: storageModeEnum("storage_mode").default("local"),
    globalStyle: (0, import_pg_core.jsonb)("global_style").$type().default({
      presetId: null,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      bodyFontOverride: null,
      strokeColorOverride: null
    }),
    // Planner / storyboard review durability (Cursor-like plan review)
    storyboardProposed: (0, import_pg_core.jsonb)("storyboard_proposed").$type().default(null),
    storyboardEdited: (0, import_pg_core.jsonb)("storyboard_edited").$type().default(null),
    storyboardApplied: (0, import_pg_core.jsonb)("storyboard_applied").$type().default(null),
    pausedAgentRun: (0, import_pg_core.jsonb)("paused_agent_run").$type().default(null),
    /** Full run checkpoint for resuming interrupted multi-scene builds */
    runCheckpoint: (0, import_pg_core.jsonb)("run_checkpoint").$type().default(null),
    /** Per-project agent configuration (model, tools, hooks, permissions overrides) */
    agentConfig: (0, import_pg_core.jsonb)("agent_config").$type().default(null),
    mp4Settings: (0, import_pg_core.jsonb)("mp4_settings").$type().default({
      resolution: "1080p",
      fps: 30,
      format: "mp4",
      aspectRatio: "16:9"
    }),
    interactiveSettings: (0, import_pg_core.jsonb)("interactive_settings").$type().default({
      playerTheme: "dark",
      showProgressBar: true,
      showSceneNav: false,
      allowFullscreen: true,
      brandColor: "#e84545",
      customDomain: null,
      password: null
    }),
    apiPermissions: (0, import_pg_core.jsonb)("api_permissions").default({}),
    audioSettings: (0, import_pg_core.jsonb)("audio_settings").$type().default({
      defaultTTSProvider: "auto",
      defaultSFXProvider: "auto",
      defaultMusicProvider: "auto",
      defaultVoiceId: null,
      defaultVoiceName: null,
      webSpeechVoice: null,
      puterProvider: "openai",
      openaiTTSModel: "tts-1",
      openaiTTSVoice: "alloy",
      geminiTTSModel: "gemini-2.5-flash-preview-tts",
      geminiVoice: null,
      edgeTTSUrl: null,
      pocketTTSUrl: null,
      voxcpmUrl: null,
      globalMusicDucking: true,
      globalMusicDuckLevel: 0.2
    }),
    audioProviderEnabled: (0, import_pg_core.jsonb)("audio_provider_enabled").$type().default({}),
    mediaGenEnabled: (0, import_pg_core.jsonb)("media_gen_enabled").$type().default({}),
    watermark: (0, import_pg_core.jsonb)("watermark").$type().default(null),
    brandKit: (0, import_pg_core.jsonb)("brand_kit").$type().default(null),
    version: (0, import_pg_core.integer)("version").default(1).notNull(),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    lastOpenedAt: (0, import_pg_core.timestamp)("last_opened_at").defaultNow(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("projects_user_idx").on(t.userId),
    archivedIdx: (0, import_pg_core.index)("projects_archived_idx").on(t.userId, t.isArchived),
    updatedIdx: (0, import_pg_core.index)("projects_updated_idx").on(t.userId, t.updatedAt),
    workspaceIdx: (0, import_pg_core.index)("projects_workspace_idx").on(t.workspaceId)
  })
);
var projectAssets = (0, import_pg_core.pgTable)(
  "project_assets",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    filename: (0, import_pg_core.text)("filename").notNull(),
    storagePath: (0, import_pg_core.text)("storage_path").notNull(),
    publicUrl: (0, import_pg_core.text)("public_url").notNull(),
    type: (0, import_pg_core.text)("type").notNull(),
    // 'image' | 'video' | 'svg'
    mimeType: (0, import_pg_core.text)("mime_type").notNull(),
    sizeBytes: (0, import_pg_core.integer)("size_bytes").notNull(),
    width: (0, import_pg_core.integer)("width"),
    height: (0, import_pg_core.integer)("height"),
    durationSeconds: (0, import_pg_core.real)("duration_seconds"),
    name: (0, import_pg_core.text)("name").notNull(),
    tags: (0, import_pg_core.text)("tags").array().notNull().default([]),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    extractedColors: (0, import_pg_core.text)("extracted_colors").array().notNull().default([]),
    // Generation provenance — nullable; only populated for AI-generated assets.
    // Why: enables query_media_library / reuse_asset / regenerate_asset and powers
    // the Gallery "generated" filter with prompt + cost tooltips.
    source: (0, import_pg_core.text)("source").default("upload").notNull(),
    // 'upload' | 'generated'
    prompt: (0, import_pg_core.text)("prompt"),
    provider: (0, import_pg_core.text)("provider"),
    model: (0, import_pg_core.text)("model"),
    costCents: (0, import_pg_core.integer)("cost_cents"),
    parentAssetId: (0, import_pg_core.uuid)("parent_asset_id"),
    referenceAssetIds: (0, import_pg_core.jsonb)("reference_asset_ids").$type(),
    enhanceTags: (0, import_pg_core.jsonb)("enhance_tags").$type(),
    // Content-hash dedup + provenance for ingested / research-sourced media.
    /** SHA256(file bytes), first 16 hex chars. Lets us dedupe repeat uploads and research-downloaded assets. */
    contentHash: (0, import_pg_core.text)("content_hash"),
    /** Original URL when the asset was pulled from the web (Pexels, yt-dlp, Archive.org, etc). */
    sourceUrl: (0, import_pg_core.text)("source_url"),
    /** Timestamp of last CLIP classification pass (Phase B). Null = not yet indexed. */
    classificationTimestamp: (0, import_pg_core.timestamp)("classification_timestamp"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("project_assets_project_idx").on(t.projectId),
    typeIdx: (0, import_pg_core.index)("project_assets_type_idx").on(t.projectId, t.type),
    sourceIdx: (0, import_pg_core.index)("project_assets_source_idx").on(t.projectId, t.source),
    contentHashIdx: (0, import_pg_core.index)("project_assets_content_hash_idx").on(t.contentHash)
  })
);
var scenes = (0, import_pg_core.pgTable)(
  "scenes",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name"),
    position: (0, import_pg_core.integer)("position").notNull(),
    duration: (0, import_pg_core.real)("duration").default(8).notNull(),
    bgColor: (0, import_pg_core.text)("bg_color").default("#fffef9"),
    styleOverride: (0, import_pg_core.jsonb)("style_override").$type().default({}),
    transition: (0, import_pg_core.jsonb)("transition").$type().default({
      type: "none",
      duration: 0.5
    }),
    audioLayer: (0, import_pg_core.jsonb)("audio_layer").$type(),
    videoLayer: (0, import_pg_core.jsonb)("video_layer").$type(),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    gridConfig: (0, import_pg_core.jsonb)("grid_config"),
    cameraMotion: (0, import_pg_core.jsonb)("camera_motion"),
    worldConfig: (0, import_pg_core.jsonb)("world_config"),
    sceneBlob: (0, import_pg_core.jsonb)("scene_blob").$type().default(null),
    avatarConfigId: (0, import_pg_core.uuid)("avatar_config_id").references(() => avatarConfigs.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("scenes_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("scenes_position_idx").on(t.projectId, t.position)
  })
);
var generatedMedia = (0, import_pg_core.pgTable)(
  "generated_media",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    type: (0, import_pg_core.text)("type").notNull(),
    promptHash: (0, import_pg_core.text)("prompt_hash").notNull(),
    prompt: (0, import_pg_core.text)("prompt"),
    model: (0, import_pg_core.text)("model"),
    url: (0, import_pg_core.text)("url"),
    status: mediaStatusEnum("status").default("pending"),
    metadata: (0, import_pg_core.jsonb)("metadata").default({}),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    externalJobId: (0, import_pg_core.text)("external_job_id"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    hashIdx: (0, import_pg_core.uniqueIndex)("media_hash_idx").on(t.promptHash),
    userIdx: (0, import_pg_core.index)("media_user_idx").on(t.userId),
    statusIdx: (0, import_pg_core.index)("media_status_idx").on(t.status)
  })
);
var layers = (0, import_pg_core.pgTable)(
  "layers",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    parentLayerId: (0, import_pg_core.uuid)("parent_layer_id"),
    type: layerTypeEnum("type").notNull(),
    label: (0, import_pg_core.text)("label"),
    zIndex: (0, import_pg_core.integer)("z_index").default(0).notNull(),
    visible: (0, import_pg_core.boolean)("visible").default(true).notNull(),
    opacity: (0, import_pg_core.real)("opacity").default(1).notNull(),
    blendMode: (0, import_pg_core.text)("blend_mode").default("normal"),
    startAt: (0, import_pg_core.real)("start_at").default(0).notNull(),
    duration: (0, import_pg_core.real)("duration"),
    generatedCode: (0, import_pg_core.text)("generated_code"),
    elements: (0, import_pg_core.jsonb)("elements").$type().default([]),
    assetPlacements: (0, import_pg_core.jsonb)("asset_placements").$type().default([]),
    prompt: (0, import_pg_core.text)("prompt"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    generatedAt: (0, import_pg_core.timestamp)("generated_at"),
    layerConfig: (0, import_pg_core.jsonb)("layer_config"),
    mediaId: (0, import_pg_core.uuid)("media_id").references(() => generatedMedia.id, { onDelete: "set null" }),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    sceneIdx: (0, import_pg_core.index)("layers_scene_idx").on(t.sceneId),
    typeIdx: (0, import_pg_core.index)("layers_type_idx").on(t.sceneId, t.type),
    zIndexIdx: (0, import_pg_core.index)("layers_zindex_idx").on(t.sceneId, t.zIndex)
  })
);
var sceneEdges = (0, import_pg_core.pgTable)(
  "scene_edges",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    fromSceneId: (0, import_pg_core.uuid)("from_scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    toSceneId: (0, import_pg_core.uuid)("to_scene_id").references(() => scenes.id, { onDelete: "cascade" }),
    condition: (0, import_pg_core.jsonb)("condition").$type().default({
      type: "auto",
      interactionId: null,
      variableName: null,
      variableValue: null
    }),
    position: (0, import_pg_core.jsonb)("position")
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("edges_project_idx").on(t.projectId)
  })
);
var sceneNodes = (0, import_pg_core.pgTable)(
  "scene_nodes",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    position: (0, import_pg_core.jsonb)("position").notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("nodes_project_idx").on(t.projectId),
    sceneUniqueIdx: (0, import_pg_core.uniqueIndex)("nodes_project_scene_unique_idx").on(t.projectId, t.sceneId)
  })
);
var interactions = (0, import_pg_core.pgTable)(
  "interactions",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    sceneId: (0, import_pg_core.uuid)("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    type: (0, import_pg_core.text)("type").notNull(),
    config: (0, import_pg_core.jsonb)("config").$type().notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    sceneIdx: (0, import_pg_core.index)("interactions_scene_idx").on(t.sceneId)
  })
);
var assets = (0, import_pg_core.pgTable)(
  "assets",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    name: (0, import_pg_core.text)("name").notNull(),
    category: (0, import_pg_core.text)("category"),
    tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
    description: (0, import_pg_core.text)("description"),
    type: (0, import_pg_core.text)("type").default("canvas"),
    canvasDrawFn: (0, import_pg_core.text)("canvas_draw_fn"),
    svgData: (0, import_pg_core.text)("svg_data"),
    defaultWidth: (0, import_pg_core.integer)("default_width").default(200),
    defaultHeight: (0, import_pg_core.integer)("default_height").default(200),
    bounds: (0, import_pg_core.jsonb)("bounds"),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(true),
    isPublic: (0, import_pg_core.boolean)("is_public").default(false),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    useCount: (0, import_pg_core.integer)("use_count").default(0),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    categoryIdx: (0, import_pg_core.index)("assets_category_idx").on(t.category),
    publicIdx: (0, import_pg_core.index)("assets_public_idx").on(t.isPublic),
    searchIdx: (0, import_pg_core.index)("assets_search_idx").using(
      "gin",
      import_drizzle_orm.sql`to_tsvector('english', ${t.name} || ' ' || coalesce(${t.description}, ''))`
    )
  })
);
var threeDComponents = (0, import_pg_core.pgTable)("three_d_components", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  category: (0, import_pg_core.text)("category"),
  tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
  description: (0, import_pg_core.text)("description"),
  buildFn: (0, import_pg_core.text)("build_fn"),
  thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
  animates: (0, import_pg_core.boolean)("animates").default(true),
  isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});
var sceneTemplates = (0, import_pg_core.pgTable)(
  "scene_templates",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    name: (0, import_pg_core.text)("name").notNull(),
    description: (0, import_pg_core.text)("description"),
    category: (0, import_pg_core.text)("category"),
    tags: (0, import_pg_core.jsonb)("tags").$type().default([]),
    layers: (0, import_pg_core.jsonb)("layers").$type().default([]),
    duration: (0, import_pg_core.real)("duration").default(8),
    styleOverride: (0, import_pg_core.jsonb)("style_override").$type().default({}),
    placeholders: (0, import_pg_core.jsonb)("placeholders").$type().default([]),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    isBuiltIn: (0, import_pg_core.boolean)("is_built_in").default(false),
    isPublic: (0, import_pg_core.boolean)("is_public").default(false),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    useCount: (0, import_pg_core.integer)("use_count").default(0),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    categoryIdx: (0, import_pg_core.index)("templates_category_idx").on(t.category),
    publicIdx: (0, import_pg_core.index)("templates_public_idx").on(t.isPublic)
  })
);
var snapshots = (0, import_pg_core.pgTable)(
  "snapshots",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    operation: (0, import_pg_core.text)("operation").notNull(),
    diff: (0, import_pg_core.jsonb)("diff").notNull(),
    agentMessage: (0, import_pg_core.text)("agent_message"),
    agentType: agentTypeEnum("agent_type"),
    stackIndex: (0, import_pg_core.integer)("stack_index").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("snapshots_project_idx").on(t.projectId),
    stackIdx: (0, import_pg_core.index)("snapshots_stack_idx").on(t.projectId, t.stackIndex)
  })
);
var apiSpend = (0, import_pg_core.pgTable)(
  "api_spend",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    projectId: (0, import_pg_core.text)("project_id"),
    api: (0, import_pg_core.text)("api").notNull(),
    costUsd: (0, import_pg_core.real)("cost_usd").notNull(),
    description: (0, import_pg_core.text)("description"),
    metadata: (0, import_pg_core.jsonb)("metadata").default({}),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    userIdx: (0, import_pg_core.index)("spend_user_idx").on(t.userId),
    monthIdx: (0, import_pg_core.index)("spend_month_idx").on(t.userId, import_drizzle_orm.sql`date_trunc('month', ${t.createdAt})`),
    apiCreatedIdx: (0, import_pg_core.index)("spend_api_created_idx").on(t.api, t.createdAt)
  })
);
var publishedProjects = (0, import_pg_core.pgTable)(
  "published_projects",
  {
    id: (0, import_pg_core.text)("id").primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
    manifest: (0, import_pg_core.jsonb)("manifest").$type(),
    version: (0, import_pg_core.integer)("version").default(1).notNull(),
    isPasswordProtected: (0, import_pg_core.boolean)("is_password_protected").default(false),
    passwordHash: (0, import_pg_core.text)("password_hash"),
    isActive: (0, import_pg_core.boolean)("is_active").default(true),
    viewCount: (0, import_pg_core.integer)("view_count").default(0),
    customDomain: (0, import_pg_core.text)("custom_domain"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("published_project_idx").on(t.projectId),
    activeIdx: (0, import_pg_core.index)("published_active_idx").on(t.isActive)
  })
);
var analyticsEvents = (0, import_pg_core.pgTable)(
  "analytics_events",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    publishedProjectId: (0, import_pg_core.text)("published_project_id").references(() => publishedProjects.id, { onDelete: "cascade" }),
    sessionId: (0, import_pg_core.text)("session_id").notNull(),
    eventType: (0, import_pg_core.text)("event_type").notNull(),
    sceneId: (0, import_pg_core.text)("scene_id"),
    interactionId: (0, import_pg_core.text)("interaction_id"),
    data: (0, import_pg_core.jsonb)("data").default({}),
    userAgent: (0, import_pg_core.text)("user_agent"),
    country: (0, import_pg_core.text)("country"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("analytics_project_idx").on(t.publishedProjectId),
    eventTypeIdx: (0, import_pg_core.index)("analytics_event_type_idx").on(t.publishedProjectId, t.eventType),
    sessionIdx: (0, import_pg_core.index)("analytics_session_idx").on(t.sessionId),
    createdIdx: (0, import_pg_core.index)("analytics_created_idx").on(t.createdAt)
  })
);
var conversations = (0, import_pg_core.pgTable)(
  "conversations",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: (0, import_pg_core.text)("title").notNull().default("New chat"),
    isPinned: (0, import_pg_core.boolean)("is_pinned").default(false),
    isArchived: (0, import_pg_core.boolean)("is_archived").default(false),
    totalInputTokens: (0, import_pg_core.integer)("total_input_tokens").default(0),
    totalOutputTokens: (0, import_pg_core.integer)("total_output_tokens").default(0),
    totalCostUsd: (0, import_pg_core.real)("total_cost_usd").default(0),
    lastMessageAt: (0, import_pg_core.timestamp)("last_message_at").defaultNow(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("conv_project_idx").on(t.projectId),
    lastMsgIdx: (0, import_pg_core.index)("conv_last_msg_idx").on(t.projectId, t.lastMessageAt)
  })
);
var messages = (0, import_pg_core.pgTable)(
  "messages",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    conversationId: (0, import_pg_core.uuid)("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    role: (0, import_pg_core.text)("role").notNull(),
    content: (0, import_pg_core.text)("content").notNull(),
    agentType: agentTypeEnum("agent_type"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    thinkingContent: (0, import_pg_core.text)("thinking_content"),
    toolCalls: (0, import_pg_core.jsonb)("tool_calls").default([]),
    /** Chronologically ordered segments (text + tool call refs) for interleaved display */
    contentSegments: (0, import_pg_core.jsonb)("content_segments"),
    /** Message status: 'streaming' while agent is running, 'complete' when done, 'aborted' if interrupted */
    status: (0, import_pg_core.text)("status").notNull().default("complete"),
    inputTokens: (0, import_pg_core.integer)("input_tokens"),
    outputTokens: (0, import_pg_core.integer)("output_tokens"),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    generationLogId: (0, import_pg_core.uuid)("generation_log_id").references(() => generationLogs.id, { onDelete: "set null" }),
    userRating: (0, import_pg_core.integer)("user_rating"),
    durationMs: (0, import_pg_core.integer)("duration_ms"),
    apiCalls: (0, import_pg_core.integer)("api_calls"),
    position: (0, import_pg_core.integer)("position").notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    convIdx: (0, import_pg_core.index)("msg_conv_idx").on(t.conversationId),
    projectIdx: (0, import_pg_core.index)("msg_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("msg_position_idx").on(t.conversationId, t.position),
    createdIdx: (0, import_pg_core.index)("msg_created_idx").on(t.conversationId, t.createdAt)
  })
);
var mediaCache = (0, import_pg_core.pgTable)(
  "media_cache",
  {
    hash: (0, import_pg_core.text)("hash").primaryKey(),
    api: (0, import_pg_core.text)("api").notNull(),
    filePath: (0, import_pg_core.text)("file_path").notNull(),
    prompt: (0, import_pg_core.text)("prompt"),
    model: (0, import_pg_core.text)("model"),
    config: (0, import_pg_core.text)("config"),
    /** SHA256 of file bytes (16 chars). Different from the primary `hash` which is a hash of
     *  request params — this hashes the actual file so we can dedupe identical media fetched from
     *  different queries or different providers. Null for legacy rows. */
    contentHash: (0, import_pg_core.text)("content_hash"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    contentHashIdx: (0, import_pg_core.index)("media_cache_content_hash_idx").on(t.contentHash)
  })
);
var permissionSessions = (0, import_pg_core.pgTable)("permission_sessions", {
  api: (0, import_pg_core.text)("api").primaryKey(),
  decision: (0, import_pg_core.text)("decision").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
});
var agentUsage = (0, import_pg_core.pgTable)(
  "agent_usage",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.text)("project_id").notNull(),
    agentType: (0, import_pg_core.text)("agent_type").notNull(),
    modelId: (0, import_pg_core.text)("model_id").notNull(),
    inputTokens: (0, import_pg_core.integer)("input_tokens").default(0).notNull(),
    outputTokens: (0, import_pg_core.integer)("output_tokens").default(0).notNull(),
    apiCalls: (0, import_pg_core.integer)("api_calls").default(1).notNull(),
    toolCalls: (0, import_pg_core.integer)("tool_calls").default(0).notNull(),
    costUsd: (0, import_pg_core.real)("cost_usd").default(0).notNull(),
    durationMs: (0, import_pg_core.integer)("duration_ms").default(0).notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("agent_usage_project_idx").on(t.projectId),
    agentIdx: (0, import_pg_core.index)("agent_usage_agent_idx").on(t.agentType),
    monthIdx: (0, import_pg_core.index)("agent_usage_month_idx").on(t.createdAt)
  })
);
var generationLogs = (0, import_pg_core.pgTable)(
  "generation_logs",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    layerId: (0, import_pg_core.uuid)("layer_id").references(() => layers.id, { onDelete: "set null" }),
    // Generation context
    userPrompt: (0, import_pg_core.text)("user_prompt").notNull(),
    systemPromptHash: (0, import_pg_core.text)("system_prompt_hash"),
    systemPromptSnapshot: (0, import_pg_core.text)("system_prompt_snapshot"),
    injectedRules: (0, import_pg_core.jsonb)("injected_rules").$type(),
    stylePresetId: (0, import_pg_core.text)("style_preset_id"),
    agentType: (0, import_pg_core.text)("agent_type"),
    modelUsed: (0, import_pg_core.text)("model_used"),
    thinkingMode: (0, import_pg_core.text)("thinking_mode"),
    // Output
    sceneType: (0, import_pg_core.text)("scene_type"),
    generatedCodeLength: (0, import_pg_core.integer)("generated_code_length"),
    // Thinking
    thinkingContent: (0, import_pg_core.text)("thinking_content"),
    // Performance
    generationTimeMs: (0, import_pg_core.integer)("generation_time_ms"),
    inputTokens: (0, import_pg_core.integer)("input_tokens"),
    outputTokens: (0, import_pg_core.integer)("output_tokens"),
    thinkingTokens: (0, import_pg_core.integer)("thinking_tokens"),
    costUsd: (0, import_pg_core.real)("cost_usd"),
    // Quality signals (updated after generation)
    userAction: (0, import_pg_core.text)("user_action"),
    timeToActionMs: (0, import_pg_core.integer)("time_to_action_ms"),
    editDistance: (0, import_pg_core.integer)("edit_distance"),
    userRating: (0, import_pg_core.integer)("user_rating"),
    exportSucceeded: (0, import_pg_core.boolean)("export_succeeded"),
    exportErrorMessage: (0, import_pg_core.text)("export_error_message"),
    // Analysis
    qualityScore: (0, import_pg_core.real)("quality_score"),
    analysisNotes: (0, import_pg_core.text)("analysis_notes"),
    // Run tracing — full structured timeline for debugging
    runId: (0, import_pg_core.text)("run_id"),
    runTrace: (0, import_pg_core.jsonb)("run_trace"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("gen_log_project_idx").on(t.projectId),
    modelIdx: (0, import_pg_core.index)("gen_log_model_idx").on(t.modelUsed),
    presetIdx: (0, import_pg_core.index)("gen_log_preset_idx").on(t.stylePresetId),
    actionIdx: (0, import_pg_core.index)("gen_log_action_idx").on(t.userAction),
    createdIdx: (0, import_pg_core.index)("gen_log_created_idx").on(t.createdAt),
    runIdIdx: (0, import_pg_core.index)("gen_log_run_id_idx").on(t.runId)
  })
);
var avatarConfigs = (0, import_pg_core.pgTable)(
  "avatar_configs",
  {
    id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // Which provider to use
    // 'talkinghead' | 'musetalk' | 'fabric' | 'aurora' | 'heygen'
    provider: (0, import_pg_core.text)("provider").notNull().default("talkinghead"),
    // Provider-specific config stored as JSON
    config: (0, import_pg_core.jsonb)("config").notNull().default({}),
    // Display
    name: (0, import_pg_core.text)("name").notNull().default("Default Avatar"),
    thumbnailUrl: (0, import_pg_core.text)("thumbnail_url"),
    // Whether this is the project default
    isDefault: (0, import_pg_core.boolean)("is_default").notNull().default(false),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("avatar_configs_project_idx").on(t.projectId),
    defaultIdx: (0, import_pg_core.index)("avatar_configs_default_idx").on(t.projectId, t.isDefault)
  })
);
var avatarVideos = (0, import_pg_core.pgTable)(
  "avatar_videos",
  {
    id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    sceneId: (0, import_pg_core.uuid)("scene_id").references(() => scenes.id, { onDelete: "set null" }),
    avatarConfigId: (0, import_pg_core.uuid)("avatar_config_id").references(() => avatarConfigs.id, { onDelete: "set null" }),
    provider: (0, import_pg_core.text)("provider").notNull(),
    status: (0, import_pg_core.text)("status").notNull().default("pending"),
    // 'pending' | 'generating' | 'ready' | 'error'
    // Input
    text: (0, import_pg_core.text)("text").notNull(),
    audioUrl: (0, import_pg_core.text)("audio_url"),
    sourceImageUrl: (0, import_pg_core.text)("source_image_url"),
    // Output
    videoUrl: (0, import_pg_core.text)("video_url"),
    durationSeconds: (0, import_pg_core.real)("duration_seconds"),
    errorMessage: (0, import_pg_core.text)("error_message"),
    // Cost tracking
    costUsd: (0, import_pg_core.real)("cost_usd"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("avatar_videos_project_idx").on(t.projectId),
    sceneIdx: (0, import_pg_core.index)("avatar_videos_scene_idx").on(t.sceneId),
    statusIdx: (0, import_pg_core.index)("avatar_videos_status_idx").on(t.status)
  })
);
var permissionRules = (0, import_pg_core.pgTable)(
  "permission_rules",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scope: (0, import_pg_core.text)("scope").$type().notNull(),
    workspaceId: (0, import_pg_core.uuid)("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: (0, import_pg_core.uuid)("project_id").references(() => projects.id, { onDelete: "cascade" }),
    conversationId: (0, import_pg_core.uuid)("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    decision: (0, import_pg_core.text)("decision").$type().notNull(),
    api: (0, import_pg_core.text)("api").notNull(),
    specifier: (0, import_pg_core.jsonb)("specifier").$type().default(null),
    costCapUsd: (0, import_pg_core.real)("cost_cap_usd"),
    expiresAt: (0, import_pg_core.timestamp)("expires_at"),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    createdBy: (0, import_pg_core.text)("created_by").$type().notNull().default("user-settings"),
    notes: (0, import_pg_core.text)("notes")
  },
  (t) => ({
    userScopeIdx: (0, import_pg_core.index)("permission_rules_user_scope_idx").on(t.userId, t.scope),
    projectIdx: (0, import_pg_core.index)("permission_rules_project_idx").on(t.projectId),
    workspaceIdx: (0, import_pg_core.index)("permission_rules_workspace_idx").on(t.workspaceId),
    conversationIdx: (0, import_pg_core.index)("permission_rules_conversation_idx").on(t.conversationId, t.expiresAt)
  })
);
var userMemoryRelations = (0, import_drizzle_orm.relations)(userMemory, ({ one }) => ({
  user: one(users, { fields: [userMemory.userId], references: [users.id] })
}));
var permissionRulesRelations = (0, import_drizzle_orm.relations)(permissionRules, ({ one }) => ({
  user: one(users, { fields: [permissionRules.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [permissionRules.workspaceId], references: [workspaces.id] }),
  project: one(projects, { fields: [permissionRules.projectId], references: [projects.id] }),
  conversation: one(conversations, {
    fields: [permissionRules.conversationId],
    references: [conversations.id]
  })
}));
var workspacesRelations = (0, import_drizzle_orm.relations)(workspaces, ({ one, many }) => ({
  user: one(users, { fields: [workspaces.userId], references: [users.id] }),
  projects: many(projects)
}));
var projectsRelations = (0, import_drizzle_orm.relations)(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  scenes: many(scenes),
  sceneEdges: many(sceneEdges),
  sceneNodes: many(sceneNodes),
  snapshots: many(snapshots),
  conversations: many(conversations),
  messages: many(messages),
  publishedProjects: many(publishedProjects),
  assets: many(projectAssets),
  avatarConfigs: many(avatarConfigs),
  avatarVideos: many(avatarVideos)
}));
var projectAssetsRelations = (0, import_drizzle_orm.relations)(projectAssets, ({ one }) => ({
  project: one(projects, { fields: [projectAssets.projectId], references: [projects.id] })
}));
var scenesRelations = (0, import_drizzle_orm.relations)(scenes, ({ one, many }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
  layers: many(layers),
  interactions: many(interactions),
  avatarConfig: one(avatarConfigs, { fields: [scenes.avatarConfigId], references: [avatarConfigs.id] })
}));
var sceneNodesRelations = (0, import_drizzle_orm.relations)(sceneNodes, ({ one }) => ({
  project: one(projects, { fields: [sceneNodes.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [sceneNodes.sceneId], references: [scenes.id] })
}));
var layersRelations = (0, import_drizzle_orm.relations)(layers, ({ one, many }) => ({
  scene: one(scenes, { fields: [layers.sceneId], references: [scenes.id] }),
  parent: one(layers, {
    fields: [layers.parentLayerId],
    references: [layers.id],
    relationName: "layer_parent"
  }),
  children: many(layers, { relationName: "layer_parent" }),
  media: one(generatedMedia, {
    fields: [layers.mediaId],
    references: [generatedMedia.id]
  })
}));
var conversationsRelations = (0, import_drizzle_orm.relations)(conversations, ({ one, many }) => ({
  project: one(projects, { fields: [conversations.projectId], references: [projects.id] }),
  messages: many(messages)
}));
var messagesRelations = (0, import_drizzle_orm.relations)(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  project: one(projects, { fields: [messages.projectId], references: [projects.id] })
}));
var avatarConfigsRelations = (0, import_drizzle_orm.relations)(avatarConfigs, ({ one, many }) => ({
  project: one(projects, { fields: [avatarConfigs.projectId], references: [projects.id] }),
  videos: many(avatarVideos)
}));
var avatarVideosRelations = (0, import_drizzle_orm.relations)(avatarVideos, ({ one }) => ({
  project: one(projects, { fields: [avatarVideos.projectId], references: [projects.id] }),
  scene: one(scenes, { fields: [avatarVideos.sceneId], references: [scenes.id] }),
  avatarConfig: one(avatarConfigs, { fields: [avatarVideos.avatarConfigId], references: [avatarConfigs.id] })
}));
var clipSourceTypeEnum = (0, import_pg_core.pgEnum)("clip_source_type", ["scene", "video", "image", "audio", "title"]);
var trackTypeEnum = (0, import_pg_core.pgEnum)("track_type", ["video", "audio", "overlay"]);
var timelineTracks = (0, import_pg_core.pgTable)(
  "timeline_tracks",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: (0, import_pg_core.text)("name").notNull(),
    type: trackTypeEnum("type").notNull(),
    position: (0, import_pg_core.integer)("position").notNull().default(0),
    muted: (0, import_pg_core.boolean)("muted").default(false).notNull(),
    locked: (0, import_pg_core.boolean)("locked").default(false).notNull(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.index)("timeline_tracks_project_idx").on(t.projectId),
    positionIdx: (0, import_pg_core.index)("timeline_tracks_position_idx").on(t.projectId, t.position)
  })
);
var timelineClips = (0, import_pg_core.pgTable)(
  "timeline_clips",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
    trackId: (0, import_pg_core.uuid)("track_id").notNull().references(() => timelineTracks.id, { onDelete: "cascade" }),
    sourceType: clipSourceTypeEnum("source_type").notNull(),
    sourceId: (0, import_pg_core.text)("source_id").notNull(),
    label: (0, import_pg_core.text)("label").default("").notNull(),
    startTime: (0, import_pg_core.real)("start_time").notNull(),
    duration: (0, import_pg_core.real)("duration").notNull(),
    trimStart: (0, import_pg_core.real)("trim_start").default(0).notNull(),
    trimEnd: (0, import_pg_core.real)("trim_end"),
    speed: (0, import_pg_core.real)("speed").default(1).notNull(),
    opacity: (0, import_pg_core.real)("opacity").default(1).notNull(),
    position: (0, import_pg_core.jsonb)("position").$type().default({ x: 0, y: 0 }).notNull(),
    scale: (0, import_pg_core.jsonb)("scale").$type().default({ x: 1, y: 1 }).notNull(),
    rotation: (0, import_pg_core.real)("rotation").default(0).notNull(),
    filters: (0, import_pg_core.jsonb)("filters").$type().default([]).notNull(),
    keyframes: (0, import_pg_core.jsonb)("keyframes").$type().default([]).notNull(),
    transition: (0, import_pg_core.jsonb)("transition").$type(),
    createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    trackIdx: (0, import_pg_core.index)("timeline_clips_track_idx").on(t.trackId),
    sourceIdx: (0, import_pg_core.index)("timeline_clips_source_idx").on(t.sourceType, t.sourceId),
    startIdx: (0, import_pg_core.index)("timeline_clips_start_idx").on(t.trackId, t.startTime)
  })
);
var timelineTracksRelations = (0, import_drizzle_orm.relations)(timelineTracks, ({ one, many }) => ({
  project: one(projects, { fields: [timelineTracks.projectId], references: [projects.id] }),
  clips: many(timelineClips)
}));
var timelineClipsRelations = (0, import_drizzle_orm.relations)(timelineClips, ({ one }) => ({
  track: one(timelineTracks, { fields: [timelineClips.trackId], references: [timelineTracks.id] })
}));
var githubLinks = (0, import_pg_core.pgTable)(
  "github_links",
  {
    id: (0, import_pg_core.uuid)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
    projectId: (0, import_pg_core.uuid)("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    repoFullName: (0, import_pg_core.text)("repo_full_name").notNull(),
    // e.g. "user/repo"
    defaultBranch: (0, import_pg_core.text)("default_branch").notNull().default("main"),
    accessToken: (0, import_pg_core.text)("access_token").notNull(),
    // AES-256-GCM encrypted via lib/crypto.ts
    refreshToken: (0, import_pg_core.text)("refresh_token"),
    // AES-256-GCM encrypted via lib/crypto.ts
    tokenExpiresAt: (0, import_pg_core.timestamp)("token_expires_at"),
    lastPushedSha: (0, import_pg_core.text)("last_pushed_sha"),
    lastPulledSha: (0, import_pg_core.text)("last_pulled_sha"),
    linkedAt: (0, import_pg_core.timestamp)("linked_at").defaultNow().notNull(),
    updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
  },
  (t) => ({
    projectIdx: (0, import_pg_core.uniqueIndex)("github_links_project_idx").on(t.projectId),
    repoIdx: (0, import_pg_core.index)("github_links_repo_idx").on(t.repoFullName)
  })
);
var githubLinksRelations = (0, import_drizzle_orm.relations)(githubLinks, ({ one }) => ({
  project: one(projects, { fields: [githubLinks.projectId], references: [projects.id] })
}));
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaces: many(workspaces),
  projects: many(projects),
  userMemory: many(userMemory)
}));
var accountsRelations = (0, import_drizzle_orm.relations)(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}));
var sessionsRelations = (0, import_drizzle_orm.relations)(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

// lib/db/index.ts
var import_drizzle_orm2 = require("drizzle-orm");
var _pool = null;
var _db = null;
function initDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.\nFor local mode: copy .env.example to .env.local and run npm run db:start\nFor cloud mode: add your Neon/Supabase connection string to .env.local"
    );
  }
  const pool = new import_pg.Pool({
    connectionString: url,
    max: process.env.STORAGE_MODE === "cloud" ? 10 : 5,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 5e3,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: true }
  });
  pool.on("error", (err) => {
    console.error("Unexpected Postgres pool error:", err);
  });
  const database = (0, import_node_postgres.drizzle)(pool, {
    schema: schema_exports,
    logger: process.env.NODE_ENV === "development"
  });
  if (_db) {
    void pool.end();
    return _db;
  }
  _pool = pool;
  _db = database;
  return _db;
}
var db = new Proxy({}, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb(), prop, receiver);
  },
  // Required so Auth.js Drizzle adapter's `is(db, PgDatabase)` check — which
  // walks the prototype chain via Object.getPrototypeOf — sees the real
  // PgDatabase prototype instead of the empty Proxy target's Object.prototype.
  getPrototypeOf() {
    return Reflect.getPrototypeOf(initDb());
  },
  has(_target, prop) {
    return Reflect.has(initDb(), prop);
  }
});
async function logSpend(projectId, api, costUsd, description, reservationId) {
  await db.insert(apiSpend).values({
    projectId,
    api,
    costUsd,
    description
  });
  try {
    const tracker = await Promise.resolve().then(() => (init_budget_tracker(), budget_tracker_exports));
    if (reservationId) {
      const reconciled = tracker.reconcileSpend(projectId, reservationId, costUsd);
      if (!reconciled) tracker.recordActualSpend(projectId, costUsd);
    } else {
      tracker.recordActualSpend(projectId, costUsd);
    }
  } catch (trackerErr) {
    console.warn(`[logSpend] budget tracker update failed for project=${projectId} api=${api}`, trackerErr);
  }
}
async function getSessionSpend(api) {
  const [row] = await db.select({ total: import_drizzle_orm2.sql`coalesce(sum(${apiSpend.costUsd}), 0)` }).from(apiSpend).where(import_drizzle_orm2.sql`${apiSpend.api} = ${api} AND ${apiSpend.createdAt} > now() - interval '1 day'`);
  return row.total;
}
async function getMonthlySpend(api) {
  const [row] = await db.select({ total: import_drizzle_orm2.sql`coalesce(sum(${apiSpend.costUsd}), 0)` }).from(apiSpend).where(import_drizzle_orm2.sql`${apiSpend.api} = ${api} AND ${apiSpend.createdAt} > date_trunc('month', now())`);
  return row.total;
}
async function getSessionPermission(api) {
  const row = await db.query.permissionSessions.findFirst({
    where: (0, import_drizzle_orm2.eq)(permissionSessions.api, api),
    columns: { decision: true }
  });
  return row?.decision ?? null;
}
async function setSessionPermission(api, decision) {
  await db.insert(permissionSessions).values({ api, decision }).onConflictDoUpdate({
    target: permissionSessions.api,
    set: { decision }
  });
}
async function getAgentUsageSummary(projectId) {
  const empty = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalApiCalls: 0,
    totalToolCalls: 0,
    byAgent: {}
  };
  try {
    const whereClause = projectId ? import_drizzle_orm2.sql`WHERE ${agentUsage.projectId} = ${projectId}` : import_drizzle_orm2.sql``;
    const totalsResult = await db.execute(import_drizzle_orm2.sql`
      SELECT
        coalesce(sum(input_tokens), 0) as "totalInputTokens",
        coalesce(sum(output_tokens), 0) as "totalOutputTokens",
        coalesce(sum(cost_usd), 0) as "totalCostUsd",
        coalesce(sum(api_calls), 0) as "totalApiCalls",
        coalesce(sum(tool_calls), 0) as "totalToolCalls"
      FROM agent_usage ${whereClause}
    `);
    const totals = totalsResult?.rows?.[0] ?? totalsResult?.[0] ?? {};
    const byAgentRows = await db.execute(import_drizzle_orm2.sql`
      SELECT
        agent_type,
        sum(input_tokens) as "inputTokens",
        sum(output_tokens) as "outputTokens",
        sum(cost_usd) as "costUsd",
        count(*) as count
      FROM agent_usage ${whereClause}
      GROUP BY agent_type
    `);
    const byAgent = {};
    for (const row of byAgentRows?.rows ?? byAgentRows ?? []) {
      byAgent[row.agent_type] = {
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        costUsd: Number(row.costUsd),
        count: Number(row.count)
      };
    }
    const t = totals?.rows?.[0] ?? totals ?? {};
    return {
      totalInputTokens: Number(t.totalInputTokens ?? 0),
      totalOutputTokens: Number(t.totalOutputTokens ?? 0),
      totalCostUsd: Number(t.totalCostUsd ?? 0),
      totalApiCalls: Number(t.totalApiCalls ?? 0),
      totalToolCalls: Number(t.totalToolCalls ?? 0),
      byAgent
    };
  } catch (e) {
    console.error("[DB] getAgentUsageSummary failed (table may not exist):", e);
    return empty;
  }
}

// lib/db/queries/conversations.ts
var import_drizzle_orm3 = require("drizzle-orm");
async function getProjectConversations(projectId) {
  const convs = await db.select().from(conversations).where((0, import_drizzle_orm3.eq)(conversations.projectId, projectId)).orderBy((0, import_drizzle_orm3.desc)(conversations.lastMessageAt));
  if (convs.length === 0) return [];
  const convIds = convs.map((c) => c.id);
  const inClause = import_drizzle_orm3.sql.join(
    convIds.map((id) => import_drizzle_orm3.sql`${id}`),
    import_drizzle_orm3.sql`, `
  );
  const lastMessages = await db.execute(import_drizzle_orm3.sql`
    SELECT DISTINCT ON (conversation_id)
      conversation_id, role, content
    FROM messages
    WHERE conversation_id IN (${inClause})
    ORDER BY conversation_id, position DESC
  `);
  const msgMap = /* @__PURE__ */ new Map();
  for (const row of lastMessages?.rows ?? lastMessages ?? []) {
    msgMap.set(row.conversation_id, { role: row.role, content: row.content });
  }
  return convs.map((conv) => {
    const lastMsg = msgMap.get(conv.id);
    return { ...conv, messages: lastMsg ? [lastMsg] : [] };
  });
}
async function createConversation(data) {
  const [conv] = await db.insert(conversations).values({
    projectId: data.projectId,
    title: data.title ?? "New chat"
  }).returning();
  return conv;
}
async function updateConversation(id, updates) {
  const [conv] = await db.update(conversations).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(conversations.id, id)).returning();
  return conv;
}
async function deleteConversation(id) {
  await db.delete(conversations).where((0, import_drizzle_orm3.eq)(conversations.id, id));
}
async function getConversationMessages(conversationId, limit = 200) {
  return db.query.messages.findMany({
    where: (0, import_drizzle_orm3.eq)(messages.conversationId, conversationId),
    orderBy: (0, import_drizzle_orm3.asc)(messages.position),
    limit
  });
}
async function addMessage(data) {
  const status = data.status ?? "complete";
  return db.transaction(async (tx) => {
    const idFragment = data.id ? import_drizzle_orm3.sql`${data.id}::uuid` : import_drizzle_orm3.sql`gen_random_uuid()`;
    const insertResult = await tx.execute(import_drizzle_orm3.sql`
      INSERT INTO messages (
        id, conversation_id, project_id, role, content, status, agent_type, model_used,
        thinking_content, tool_calls, content_segments, input_tokens, output_tokens, cost_usd,
        duration_ms, api_calls, user_rating, generation_log_id, position
      ) VALUES (
        ${idFragment},
        ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
        ${status},
        ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
        ${data.thinkingContent ?? null}, ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
        ${data.contentSegments ? import_drizzle_orm3.sql`${JSON.stringify(data.contentSegments)}::jsonb` : import_drizzle_orm3.sql`null`},
        ${data.inputTokens ?? null}, ${data.outputTokens ?? null}, ${data.costUsd ?? null},
        ${data.durationMs ?? null}, ${data.apiCalls ?? null}, ${data.userRating ?? null},
        ${data.generationLogId ?? null},
        (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
      ) RETURNING *
    `);
    const message = insertResult.rows?.[0] ?? insertResult[0];
    if (status !== "streaming") {
      await tx.update(conversations).set({
        lastMessageAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date(),
        totalCostUsd: import_drizzle_orm3.sql`total_cost_usd + ${data.costUsd ?? 0}`,
        totalInputTokens: import_drizzle_orm3.sql`total_input_tokens + ${data.inputTokens ?? 0}`,
        totalOutputTokens: import_drizzle_orm3.sql`total_output_tokens + ${data.outputTokens ?? 0}`
      }).where((0, import_drizzle_orm3.eq)(conversations.id, data.conversationId));
    } else {
      await tx.update(conversations).set({ lastMessageAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(conversations.id, data.conversationId));
    }
    const row = message?.rows?.[0] ?? message?.[0] ?? message;
    return row;
  });
}
async function updateMessage(messageId, updates) {
  const setClauses = [];
  if (updates.content !== void 0) setClauses.push(import_drizzle_orm3.sql`content = ${updates.content}`);
  if (updates.status !== void 0) setClauses.push(import_drizzle_orm3.sql`status = ${updates.status}`);
  if (updates.agentType !== void 0) setClauses.push(import_drizzle_orm3.sql`agent_type = ${updates.agentType}::agent_type`);
  if (updates.modelUsed !== void 0) setClauses.push(import_drizzle_orm3.sql`model_used = ${updates.modelUsed}`);
  if (updates.thinkingContent !== void 0) setClauses.push(import_drizzle_orm3.sql`thinking_content = ${updates.thinkingContent}`);
  if (updates.toolCalls !== void 0) setClauses.push(import_drizzle_orm3.sql`tool_calls = ${JSON.stringify(updates.toolCalls)}::jsonb`);
  if (updates.contentSegments !== void 0)
    setClauses.push(import_drizzle_orm3.sql`content_segments = ${JSON.stringify(updates.contentSegments)}::jsonb`);
  if (updates.inputTokens !== void 0) setClauses.push(import_drizzle_orm3.sql`input_tokens = ${updates.inputTokens}`);
  if (updates.outputTokens !== void 0) setClauses.push(import_drizzle_orm3.sql`output_tokens = ${updates.outputTokens}`);
  if (updates.costUsd !== void 0) setClauses.push(import_drizzle_orm3.sql`cost_usd = ${updates.costUsd}`);
  if (updates.durationMs !== void 0) setClauses.push(import_drizzle_orm3.sql`duration_ms = ${updates.durationMs}`);
  if (updates.apiCalls !== void 0) setClauses.push(import_drizzle_orm3.sql`api_calls = ${updates.apiCalls}`);
  if (updates.generationLogId !== void 0) setClauses.push(import_drizzle_orm3.sql`generation_log_id = ${updates.generationLogId}`);
  if (setClauses.length === 0) return;
  const setFragment = import_drizzle_orm3.sql.join(setClauses, import_drizzle_orm3.sql`, `);
  return db.transaction(async (tx) => {
    await tx.execute(import_drizzle_orm3.sql`UPDATE messages SET ${setFragment} WHERE id = ${messageId}::uuid`);
    if (updates.status === "complete" && (updates.costUsd || updates.inputTokens || updates.outputTokens)) {
      const rowResult = await tx.execute(import_drizzle_orm3.sql`SELECT conversation_id FROM messages WHERE id = ${messageId}::uuid`);
      const row = rowResult.rows?.[0] ?? rowResult[0];
      const convId = row?.conversation_id;
      if (convId) {
        await tx.update(conversations).set({
          updatedAt: /* @__PURE__ */ new Date(),
          totalCostUsd: import_drizzle_orm3.sql`total_cost_usd + ${updates.costUsd ?? 0}`,
          totalInputTokens: import_drizzle_orm3.sql`total_input_tokens + ${updates.inputTokens ?? 0}`,
          totalOutputTokens: import_drizzle_orm3.sql`total_output_tokens + ${updates.outputTokens ?? 0}`
        }).where((0, import_drizzle_orm3.eq)(conversations.id, convId));
      }
    }
  });
}
async function upsertMessage(data) {
  const status = data.status ?? "aborted";
  await db.execute(import_drizzle_orm3.sql`
    INSERT INTO messages (
      id, conversation_id, project_id, role, content, status,
      agent_type, model_used, thinking_content, tool_calls, content_segments,
      position
    ) VALUES (
      ${data.id}::uuid, ${data.conversationId}, ${data.projectId}, ${data.role}, ${data.content},
      ${status},
      ${data.agentType ?? null}::agent_type, ${data.modelUsed ?? null},
      ${data.thinkingContent ?? null},
      ${JSON.stringify(data.toolCalls ?? [])}::jsonb,
      ${data.contentSegments ? import_drizzle_orm3.sql`${JSON.stringify(data.contentSegments)}::jsonb` : import_drizzle_orm3.sql`null`},
      (SELECT coalesce(max(position), -1) + 1 FROM messages WHERE conversation_id = ${data.conversationId})
    )
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      status = EXCLUDED.status,
      tool_calls = EXCLUDED.tool_calls,
      content_segments = EXCLUDED.content_segments,
      thinking_content = EXCLUDED.thinking_content,
      agent_type = EXCLUDED.agent_type,
      model_used = EXCLUDED.model_used
    WHERE messages.status = 'streaming'
      AND messages.conversation_id = ${data.conversationId}
  `);
}
async function updateMessageRating(conversationId, messageId, userRating) {
  await db.update(messages).set({ userRating }).where((0, import_drizzle_orm3.eq)(messages.id, messageId));
}
async function clearConversationMessages(conversationId) {
  await db.delete(messages).where((0, import_drizzle_orm3.eq)(messages.conversationId, conversationId));
  await db.update(conversations).set({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm3.eq)(conversations.id, conversationId));
}

// electron/ipc/_helpers.ts
var import_drizzle_orm4 = require("drizzle-orm");
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertValidUuid(id, label = "id") {
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    throw new IpcValidationError(`${label} must be a valid UUID`);
  }
  return id;
}
var IpcValidationError = class extends Error {
  code = "VALIDATION";
};
var IpcNotFoundError = class extends Error {
  code = "NOT_FOUND";
};
var IpcConflictError = class extends Error {
  code = "CONFLICT";
};
async function loadProjectOrThrow(projectId) {
  assertValidUuid(projectId, "projectId");
  const project = await db.query.projects.findFirst({
    where: (0, import_drizzle_orm4.eq)(projects.id, projectId)
  });
  if (!project) {
    throw new IpcNotFoundError(`Project ${projectId} not found`);
  }
  return project;
}
async function loadConversationOrThrow(conversationId) {
  assertValidUuid(conversationId, "conversationId");
  const conv = await db.query.conversations.findFirst({
    where: (0, import_drizzle_orm4.eq)(conversations.id, conversationId)
  });
  if (!conv) {
    throw new IpcNotFoundError(`Conversation ${conversationId} not found`);
  }
  return conv;
}
async function loadWorkspaceOrThrow(workspaceId) {
  assertValidUuid(workspaceId, "workspaceId");
  const ws = await db.query.workspaces.findFirst({
    where: (0, import_drizzle_orm4.eq)(workspaces.id, workspaceId)
  });
  if (!ws) {
    throw new IpcNotFoundError(`Workspace ${workspaceId} not found`);
  }
  return ws;
}

// electron/ipc/conversations.ts
var MAX_TITLE_LENGTH = 500;
var MAX_CONTENT_LENGTH = 5e5;
async function list(projectId) {
  await loadProjectOrThrow(projectId);
  return { conversations: await getProjectConversations(projectId) };
}
async function create(args) {
  await loadProjectOrThrow(args.projectId);
  if (args.title !== void 0) {
    if (typeof args.title !== "string" || args.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`);
    }
  }
  return { conversation: await createConversation({ projectId: args.projectId, title: args.title }) };
}
async function get(id) {
  const conv = await loadConversationOrThrow(id);
  const messages2 = await getConversationMessages(id);
  return { conversation: conv, messages: messages2 };
}
async function update(id, updates) {
  await loadConversationOrThrow(id);
  const patch = {};
  if (updates.title !== void 0) {
    if (typeof updates.title !== "string" || updates.title.length > MAX_TITLE_LENGTH) {
      throw new IpcValidationError(`title must be a string under ${MAX_TITLE_LENGTH} chars`);
    }
    patch.title = updates.title;
  }
  if (updates.isPinned !== void 0) {
    if (typeof updates.isPinned !== "boolean") {
      throw new IpcValidationError("isPinned must be a boolean");
    }
    patch.isPinned = updates.isPinned;
  }
  if (updates.isArchived !== void 0) {
    if (typeof updates.isArchived !== "boolean") {
      throw new IpcValidationError("isArchived must be a boolean");
    }
    patch.isArchived = updates.isArchived;
  }
  if (Object.keys(patch).length === 0) {
    throw new IpcValidationError("No valid fields to update");
  }
  const conversation = await updateConversation(id, patch);
  return { conversation };
}
async function remove(id) {
  await loadConversationOrThrow(id);
  await deleteConversation(id);
  return { success: true };
}
async function listMessages(id) {
  await loadConversationOrThrow(id);
  return { messages: await getConversationMessages(id) };
}
async function addMessageIpc(args) {
  const conv = await loadConversationOrThrow(args.conversationId);
  assertValidUuid(args.projectId, "projectId");
  if (args.projectId !== conv.projectId) {
    throw new IpcValidationError("projectId does not match conversation");
  }
  if (args.role !== "user" && args.role !== "assistant") {
    throw new IpcValidationError('role must be "user" or "assistant"');
  }
  if (typeof args.content !== "string") {
    throw new IpcValidationError("content must be a string");
  }
  if (args.content.length > MAX_CONTENT_LENGTH) {
    throw new IpcValidationError(`content exceeds ${MAX_CONTENT_LENGTH} character limit`);
  }
  if (args.userRating !== void 0 && args.userRating !== null) {
    const r = Number(args.userRating);
    if (!Number.isInteger(r) || r < -1 || r > 1) {
      throw new IpcValidationError("userRating must be -1, 0, or 1");
    }
  }
  if (args._method === "PUT" && args.messageId) {
    await upsertMessage({
      id: args.messageId,
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role ?? "assistant",
      content: args.content ?? "",
      status: args.status ?? "aborted",
      agentType: args.agentType,
      modelUsed: args.modelUsed,
      thinkingContent: args.thinkingContent,
      toolCalls: args.toolCalls,
      contentSegments: args.contentSegments
    });
    return { success: true };
  }
  const message = await addMessage({
    id: args.id,
    conversationId: args.conversationId,
    projectId: args.projectId,
    role: args.role,
    content: args.content,
    status: args.status,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls,
    contentSegments: args.contentSegments,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    userRating: args.userRating ?? void 0,
    generationLogId: args.generationLogId
  });
  return { message };
}
async function updateMessageIpc(args) {
  await loadConversationOrThrow(args.conversationId);
  assertValidUuid(args.messageId, "messageId");
  const ratingOnly = "userRating" in args && Object.keys(args).filter((k) => k !== "conversationId" && k !== "messageId" && k !== "userRating").length === 0;
  if (ratingOnly) {
    if (args.userRating !== void 0 && args.userRating !== null) {
      const r = Number(args.userRating);
      if (!Number.isInteger(r) || r < -1 || r > 1) {
        throw new IpcValidationError("userRating must be -1, 0, or 1");
      }
    }
    await updateMessageRating(args.conversationId, args.messageId, args.userRating ?? null);
    return { success: true };
  }
  await updateMessage(args.messageId, {
    content: args.content,
    status: args.status,
    agentType: args.agentType,
    modelUsed: args.modelUsed,
    thinkingContent: args.thinkingContent,
    toolCalls: args.toolCalls,
    contentSegments: args.contentSegments,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    apiCalls: args.apiCalls,
    generationLogId: args.generationLogId
  });
  return { success: true };
}
async function clearMessages(id) {
  await loadConversationOrThrow(id);
  await clearConversationMessages(id);
  return { success: true };
}
function register2(ipcMain2) {
  ipcMain2.handle("cench:conversations.list", (_e, projectId) => list(projectId));
  ipcMain2.handle("cench:conversations.create", (_e, args) => create(args));
  ipcMain2.handle("cench:conversations.get", (_e, id) => get(id));
  ipcMain2.handle(
    "cench:conversations.update",
    (_e, args) => update(args.id, args.updates)
  );
  ipcMain2.handle("cench:conversations.delete", (_e, id) => remove(id));
  ipcMain2.handle("cench:conversations.listMessages", (_e, id) => listMessages(id));
  ipcMain2.handle("cench:conversations.addMessage", (_e, args) => addMessageIpc(args));
  ipcMain2.handle("cench:conversations.updateMessage", (_e, args) => updateMessageIpc(args));
  ipcMain2.handle("cench:conversations.clearMessages", (_e, id) => clearMessages(id));
}

// electron/ipc/usage.ts
async function getSummary(projectId) {
  if (projectId) assertValidUuid(projectId, "projectId");
  return getAgentUsageSummary(projectId);
}
function register3(ipcMain2) {
  ipcMain2.handle("cench:usage.getSummary", (_e, projectId) => getSummary(projectId));
}

// lib/db/queries/generation-logs.ts
var import_drizzle_orm5 = require("drizzle-orm");
function truncateForDB(text2, maxBytes) {
  if (!text2 || text2.length <= maxBytes) return text2;
  return text2.slice(0, maxBytes);
}
var MAX_THINKING_CONTENT = 500 * 1024;
var MAX_USER_PROMPT = 100 * 1024;
var MAX_ANALYSIS_NOTES = 100 * 1024;
async function updateGenerationLog(id, updates) {
  const truncated = {
    ...updates,
    thinkingContent: truncateForDB(updates.thinkingContent, MAX_THINKING_CONTENT),
    analysisNotes: truncateForDB(updates.analysisNotes, MAX_ANALYSIS_NOTES),
    updatedAt: /* @__PURE__ */ new Date()
  };
  await db.update(generationLogs).set(truncated).where((0, import_drizzle_orm5.eq)(generationLogs.id, id));
}
async function getGenerationLogs(opts = {}) {
  const conditions = [];
  if (opts.projectId) conditions.push((0, import_drizzle_orm5.eq)(generationLogs.projectId, opts.projectId));
  if (opts.sceneId) conditions.push((0, import_drizzle_orm5.eq)(generationLogs.sceneId, opts.sceneId));
  if (opts.hasQualityScore) conditions.push((0, import_drizzle_orm5.isNotNull)(generationLogs.qualityScore));
  return db.select().from(generationLogs).where(conditions.length > 0 ? (0, import_drizzle_orm5.and)(...conditions) : void 0).orderBy((0, import_drizzle_orm5.desc)(generationLogs.createdAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
}
var ALLOWED_DIMENSIONS = /* @__PURE__ */ new Set([
  "scene_type",
  "model_used",
  "thinking_mode",
  "style_preset_id",
  "agent_type"
]);
async function getQualityByDimension(dimension, projectId) {
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`);
  }
  const whereClause = projectId ? import_drizzle_orm5.sql`WHERE quality_score >= 0 AND project_id = ${projectId}` : import_drizzle_orm5.sql`WHERE quality_score >= 0`;
  const rows = await db.execute(import_drizzle_orm5.sql`
    SELECT
      ${import_drizzle_orm5.sql.raw(dimension)} as dimension_value,
      AVG(quality_score) as avg_quality,
      COUNT(*) as total_count,
      SUM(CASE WHEN user_action = 'regenerated' THEN 1 ELSE 0 END) as regen_count,
      SUM(CASE WHEN user_action = 'kept' THEN 1 ELSE 0 END) as kept_count,
      SUM(CASE WHEN user_action = 'edited' THEN 1 ELSE 0 END) as edited_count,
      AVG(cost_usd) as avg_cost
    FROM generation_logs
    ${whereClause}
    GROUP BY ${import_drizzle_orm5.sql.raw(dimension)}
    ORDER BY AVG(quality_score) DESC
  `);
  return rows;
}

// lib/generation-logs/score.ts
function computeQualityScore(log) {
  if (!log.userAction) return -1;
  let score = 0.5;
  switch (log.userAction) {
    case "kept":
      score += 0.3;
      break;
    case "edited":
      score += 0.1;
      break;
    case "regenerated":
      score -= 0.4;
      break;
    case "deleted":
      score -= 0.5;
      break;
  }
  if (log.timeToActionMs != null) {
    if (log.userAction === "regenerated" && log.timeToActionMs < 5e3) {
      score -= 0.2;
    }
    if (log.userAction === "kept" && log.timeToActionMs > 3e4) {
      score += 0.1;
    }
  }
  if (log.editDistance != null && log.generatedCodeLength) {
    const relativeEdit = log.editDistance / log.generatedCodeLength;
    if (relativeEdit > 0.6)
      score -= 0.4;
    else if (relativeEdit > 0.3)
      score -= 0.2;
    else if (relativeEdit < 0.05) score += 0.1;
  }
  if (log.userRating != null) {
    score += (log.userRating - 3) * 0.1;
  }
  if (log.exportSucceeded === false) score -= 0.3;
  if (log.exportSucceeded === true) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

// electron/ipc/generation-log.ts
var VALID_USER_ACTIONS = [
  "kept",
  "regenerated",
  "edited",
  "deleted",
  "rated-positive",
  "rated-negative",
  "exported",
  "published"
];
var VALID_DIMENSIONS = ["scene_type", "model_used", "thinking_mode", "style_preset_id", "agent_type"];
var MAX_QUERY_RESULTS = 500;
async function update2(args) {
  assertValidUuid(args.logId, "logId");
  if (args.userAction && !VALID_USER_ACTIONS.includes(args.userAction)) {
    throw new IpcValidationError(`userAction must be one of: ${VALID_USER_ACTIONS.join(", ")}`);
  }
  if (args.timeToActionMs != null && (typeof args.timeToActionMs !== "number" || args.timeToActionMs < 0 || !Number.isFinite(args.timeToActionMs))) {
    throw new IpcValidationError("timeToActionMs must be a non-negative number");
  }
  if (args.editDistance != null && (typeof args.editDistance !== "number" || args.editDistance < 0 || !Number.isInteger(args.editDistance))) {
    throw new IpcValidationError("editDistance must be a non-negative integer");
  }
  if (args.userRating != null && (typeof args.userRating !== "number" || args.userRating < 0 || args.userRating > 5)) {
    throw new IpcValidationError("userRating must be between 0 and 5");
  }
  const updates = {};
  if (args.userAction) updates.userAction = args.userAction;
  if (args.timeToActionMs != null) updates.timeToActionMs = args.timeToActionMs;
  if (args.editDistance != null) updates.editDistance = args.editDistance;
  if (args.userRating != null) updates.userRating = args.userRating;
  if (args.exportSucceeded != null) updates.exportSucceeded = args.exportSucceeded;
  if (args.exportErrorMessage) updates.exportErrorMessage = args.exportErrorMessage;
  if (args.userAction) {
    const score = computeQualityScore({
      userAction: args.userAction,
      timeToActionMs: args.timeToActionMs,
      editDistance: args.editDistance,
      generatedCodeLength: args.generatedCodeLength,
      userRating: args.userRating,
      exportSucceeded: args.exportSucceeded
    });
    if (score >= 0) updates.qualityScore = score;
  }
  await updateGenerationLog(args.logId, updates);
  return { success: true };
}
async function list2(args) {
  if (args.projectId) assertValidUuid(args.projectId, "projectId");
  if (args.sceneId) assertValidUuid(args.sceneId, "sceneId");
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_QUERY_RESULTS);
  const offset = Math.max(args.offset ?? 0, 0);
  const logs = await getGenerationLogs({
    projectId: args.projectId,
    sceneId: args.sceneId,
    limit,
    offset
  });
  return { logs };
}
async function listByDimension(args) {
  if (!VALID_DIMENSIONS.includes(args.dimension)) {
    throw new IpcValidationError(`dimension must be one of: ${VALID_DIMENSIONS.join(", ")}`);
  }
  if (args.projectId) assertValidUuid(args.projectId, "projectId");
  const data = await getQualityByDimension(args.dimension, args.projectId);
  return { data };
}
function register4(ipcMain2) {
  ipcMain2.handle("cench:generationLog.update", (_e, args) => update2(args));
  ipcMain2.handle("cench:generationLog.list", (_e, args) => list2(args));
  ipcMain2.handle(
    "cench:generationLog.listByDimension",
    (_e, args) => listByDimension(args)
  );
}

// electron/ipc/permissions.ts
var TRACKED_APIS = ["heygen", "veo3", "imageGen", "backgroundRemoval", "elevenLabs", "unsplash"];
async function getSpend() {
  const result = {};
  for (const api of TRACKED_APIS) {
    result[api] = {
      sessionSpend: await getSessionSpend(api),
      monthlySpend: await getMonthlySpend(api)
    };
  }
  return result;
}
async function perform(args) {
  if (args.action === "log_spend") {
    if (!args.api) throw new IpcValidationError("api is required");
    if (typeof args.costUsd !== "number" || !Number.isFinite(args.costUsd)) {
      throw new IpcValidationError("costUsd must be a finite number");
    }
    if (args.projectId) assertValidUuid(args.projectId, "projectId");
    await logSpend(args.projectId ?? "", args.api, args.costUsd, args.description ?? "");
    return { ok: true };
  }
  if (args.action === "set_session_permission") {
    if (!args.api || !args.decision) throw new IpcValidationError("api and decision required");
    await setSessionPermission(args.api, args.decision);
    return { ok: true };
  }
  if (args.action === "get_session_permission") {
    if (!args.api) throw new IpcValidationError("api required");
    const decision = await getSessionPermission(args.api);
    return { decision };
  }
  throw new IpcValidationError(`Unknown permissions action: ${args.action}`);
}
function register5(ipcMain2) {
  ipcMain2.handle("cench:permissions.getSpend", () => getSpend());
  ipcMain2.handle("cench:permissions.perform", (_e, args) => perform(args));
}

// electron/ipc/skills.ts
var import_electron = require("electron");
var import_node_path = __toESM(require("node:path"));
var import_promises = __toESM(require("node:fs/promises"));
function getSkillRoots() {
  if (import_electron.app.isPackaged) {
    const base = import_node_path.default.join(process.resourcesPath, "skill-data");
    return {
      cench: import_node_path.default.join(base, "cench"),
      library: import_node_path.default.join(base, "library")
    };
  }
  const repoRoot = import_node_path.default.resolve(__dirname, "..");
  return {
    cench: import_node_path.default.join(repoRoot, ".claude/skills/cench"),
    library: import_node_path.default.join(repoRoot, "lib/skills/library")
  };
}
async function readSkillFile(args) {
  if (!args.source || !args.file) {
    throw new IpcValidationError("source and file are required");
  }
  const roots = getSkillRoots();
  const root = roots[args.source];
  if (!root) {
    throw new IpcValidationError(`Unknown source: ${args.source}`);
  }
  const resolved = import_node_path.default.resolve(root, args.file);
  if (!resolved.startsWith(root + import_node_path.default.sep) && resolved !== root) {
    throw new IpcValidationError("Invalid file path (path traversal)");
  }
  let finalPath = resolved;
  try {
    finalPath = await import_promises.default.realpath(resolved);
    if (!finalPath.startsWith(root + import_node_path.default.sep) && finalPath !== root) {
      throw new IpcValidationError("Invalid file path (symlink escape)");
    }
  } catch (err) {
    if (err instanceof IpcValidationError) throw err;
  }
  try {
    const content = await import_promises.default.readFile(finalPath, "utf-8");
    return { content, file: args.file, source: args.source };
  } catch {
    throw new IpcNotFoundError(`Skill file not found: ${args.source}/${args.file}`);
  }
}
function register6(ipcMain2) {
  ipcMain2.handle("cench:skills.readFile", (_e, args) => readSkillFile(args));
}

// electron/ipc/projects.ts
var import_electron2 = require("electron");
var import_node_path2 = __toESM(require("node:path"));
var import_promises2 = __toESM(require("node:fs/promises"));
var import_drizzle_orm7 = require("drizzle-orm");

// lib/charts/compile.ts
var CHART_PANEL_CONFIG_KEYS = /* @__PURE__ */ new Set([
  "chartPanelBackground",
  "chartPanelOpacity",
  "chartPanelBorderRadius",
  "chartPanelBoxShadow"
]);
function withReadableDefaults(layer) {
  const raw = layer.config || {};
  if (layer.chartType === "plotly" || layer.chartType === "recharts") return { ...raw };
  const readableOptOut = raw.readableDefaults === false;
  if (readableOptOut) return raw;
  const merged = {
    ...raw,
    // Keep typography and labels readable by default unless user explicitly overrides.
    fontFamily: raw.fontFamily,
    fontSize: raw.fontSize ?? 18,
    title: raw.title ?? layer.name,
    showGrid: raw.showGrid ?? true,
    showValues: raw.showValues ?? true,
    // Match cench-charts resolveConfig default (avoid huge legends / layout surprises).
    showLegend: raw.showLegend ?? false,
    axisLabelSize: raw.axisLabelSize ?? 24,
    dataLabelSize: raw.dataLabelSize ?? 20,
    contrastMode: raw.contrastMode ?? "auto"
  };
  const axisLike = ["bar", "horizontalBar", "stackedBar", "groupedBar", "line", "area", "scatter"].includes(
    layer.chartType
  );
  if (axisLike) {
    merged.xLabel = raw.xLabel ?? "Category";
    merged.yLabel = raw.yLabel ?? "Value";
  }
  return merged;
}
function chartSdkConfig(layer) {
  const merged = withReadableDefaults(layer);
  const out = { ...merged };
  for (const k of CHART_PANEL_CONFIG_KEYS) delete out[k];
  delete out.plotlyLayout;
  delete out.plotlyConfig;
  delete out.rechartsVariant;
  return out;
}
function panelDivOpen(layer) {
  const lid = layer.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const rawPanel = layer.config || {};
  const panelBg = typeof rawPanel.chartPanelBackground === "string" && rawPanel.chartPanelBackground.trim() ? rawPanel.chartPanelBackground.trim() : "transparent";
  const panelOp = typeof rawPanel.chartPanelOpacity === "number" && Number.isFinite(rawPanel.chartPanelOpacity) && rawPanel.chartPanelOpacity >= 0 && rawPanel.chartPanelOpacity <= 1 ? rawPanel.chartPanelOpacity : 1;
  const panelRad = typeof rawPanel.chartPanelBorderRadius === "number" && Number.isFinite(rawPanel.chartPanelBorderRadius) ? Math.max(0, rawPanel.chartPanelBorderRadius) : 0;
  const panelSh = typeof rawPanel.chartPanelBoxShadow === "string" && rawPanel.chartPanelBoxShadow.trim() ? rawPanel.chartPanelBoxShadow.trim() : "none";
  return `
{
  const el = document.createElement('div');
  el.id = 'chart-layer-${lid}';
  el.style.position = 'absolute';
  el.style.left = '${layer.layout.x}%';
  el.style.top = '${layer.layout.y}%';
  el.style.width = '${layer.layout.width}%';
  el.style.height = '${layer.layout.height}%';
  el.style.overflow = 'hidden';
  el.style.background = ${JSON.stringify(panelBg)};
  el.style.opacity = ${JSON.stringify(String(panelOp))};
  el.style.borderRadius = ${JSON.stringify(`${panelRad}px`)};
  el.style.boxShadow = ${JSON.stringify(panelSh)};
  chartRoot.appendChild(el);
`.trim();
}
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
var PLOTLY_DEFAULT_MARGIN = { l: 48, r: 24, t: 48, b: 48 };
function mergePlotlyLayoutForCompile(userLayout, fontFamilyFromConfig) {
  const user = userLayout && isPlainObject(userLayout) ? userLayout : {};
  const userMargin = isPlainObject(user.margin) ? user.margin : {};
  const userFont = isPlainObject(user.font) ? user.font : {};
  const { margin: _dropM, font: _dropF, ...userTop } = user;
  const baseFont = {
    ...fontFamilyFromConfig ? { family: fontFamilyFromConfig } : {},
    ...userFont
  };
  const mergedMargin = { ...PLOTLY_DEFAULT_MARGIN, ...userMargin };
  const out = {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    ...userTop,
    margin: mergedMargin
  };
  if (Object.keys(baseFont).length > 0) {
    out.font = baseFont;
  }
  return out;
}
function compilePlotlyLayerBlock(layer) {
  const open = panelDivOpen(layer);
  const raw = layer.data;
  let traces = [];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw;
    if (Array.isArray(o.traces)) traces = o.traces;
  } else if (Array.isArray(raw)) {
    traces = raw;
  }
  const conf = layer.config || {};
  const fontFamily = typeof conf.fontFamily === "string" && conf.fontFamily.trim() ? conf.fontFamily.trim() : void 0;
  const userLayout = isPlainObject(conf.plotlyLayout) ? conf.plotlyLayout : {};
  const plotlyLayout = mergePlotlyLayoutForCompile(userLayout, fontFamily);
  const userPlotCfg = typeof conf.plotlyConfig === "object" && conf.plotlyConfig !== null && !Array.isArray(conf.plotlyConfig) ? conf.plotlyConfig : {};
  const plotlyConfig = {
    staticPlot: true,
    responsive: true,
    displayModeBar: false,
    ...userPlotCfg
  };
  const tracesLit = JSON.stringify(traces);
  const layoutLit = JSON.stringify(plotlyLayout);
  const configLit = JSON.stringify(plotlyConfig);
  return `
${open}
  if (typeof Plotly === 'undefined') {
    console.warn('Plotly.js not loaded; chart layer skipped');
  } else {
    Plotly.newPlot(el.id, ${tracesLit}, ${layoutLit}, ${configLit});
  }
}
`.trim();
}
function chartLayersUsePlotly(layers2) {
  return !!(layers2 && layers2.some((l) => l.chartType === "plotly"));
}
function chartLayersUseRecharts(layers2) {
  return !!(layers2 && layers2.some((l) => l.chartType === "recharts"));
}
function buildRechartsSpec(layer) {
  const raw = layer.config || {};
  const v = raw.rechartsVariant;
  const variant = v === "line" || v === "area" ? v : "bar";
  const data = Array.isArray(layer.data) ? layer.data : [];
  const colors = Array.isArray(raw.colors) ? raw.colors : void 0;
  return {
    variant,
    categoryKey: typeof raw.categoryKey === "string" ? raw.categoryKey : "label",
    valueKey: typeof raw.valueKey === "string" ? raw.valueKey : "value",
    data,
    colors,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : layer.name,
    titleSize: typeof raw.titleSize === "number" && Number.isFinite(raw.titleSize) ? raw.titleSize : void 0,
    showGrid: raw.showGrid !== false
  };
}
function compileRechartsLayerBlock(layer) {
  const open = panelDivOpen(layer);
  const spec = buildRechartsSpec(layer);
  const specStr = JSON.stringify(spec).replace(/</g, "\\u003c");
  const specJsLiteral = JSON.stringify(specStr);
  return `
${open}
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.setAttribute('data-cench-recharts', '1');
  var _spec = document.createElement('script');
  _spec.type = 'application/json';
  _spec.className = 'cench-recharts-json';
  _spec.textContent = ${specJsLiteral};
  el.appendChild(_spec);
}
`.trim();
}
function compileD3SceneFromLayers(layers2) {
  const safeLayers = (layers2 || []).filter(Boolean);
  const blocks = safeLayers.map((layer) => {
    if (layer.chartType === "plotly") {
      return compilePlotlyLayerBlock(layer);
    }
    if (layer.chartType === "recharts") {
      return compileRechartsLayerBlock(layer);
    }
    const cfg = JSON.stringify(chartSdkConfig(layer));
    const open = panelDivOpen(layer);
    const data = layer.data === void 0 || layer.data === null ? "[]" : typeof layer.data === "object" ? JSON.stringify(layer.data) : JSON.stringify(layer.data);
    const animateCall = layer.timing?.animated ? ".animate(window.__tl)" : "";
    return `
${open}
  CenchCharts.${layer.chartType}('#' + el.id, ${data}, ${cfg})${animateCall};
}
`.trim();
  });
  const indented = blocks.map(
    (b) => b.split("\n").map((line) => line ? `  ${line}` : line).join("\n")
  ).join("\n");
  const sceneCode = `
const chartRoot = document.getElementById('chart');
if (chartRoot) {
  while (chartRoot.firstChild) chartRoot.removeChild(chartRoot.firstChild);
  chartRoot.style.position = 'relative';
  chartRoot.style.width = '100%';
  chartRoot.style.height = '100%';
${indented}
}
`.trim();
  return {
    sceneCode,
    d3Data: { chartLayers: safeLayers.map((l) => ({ id: l.id, chartType: l.chartType, data: l.data })) }
  };
}

// lib/charts/normalize-scenes.ts
function autoGridLayouts(layers2) {
  const n = layers2.length;
  if (n <= 1) return layers2;
  const presets = n === 2 ? [
    { x: 4, y: 12, width: 44, height: 76 },
    { x: 52, y: 12, width: 44, height: 76 }
  ] : n === 3 ? [
    { x: 4, y: 10, width: 44, height: 36 },
    { x: 52, y: 10, width: 44, height: 36 },
    { x: 28, y: 54, width: 44, height: 36 }
  ] : [
    { x: 4, y: 10, width: 44, height: 36 },
    { x: 52, y: 10, width: 44, height: 36 },
    { x: 4, y: 54, width: 44, height: 36 },
    { x: 52, y: 54, width: 44, height: 36 }
  ];
  return layers2.map((l, i) => ({ ...l, layout: presets[i] ?? l.layout }));
}
function normalizeScenesForPersistence(scenes2) {
  return (scenes2 || []).map((scene) => {
    if (scene.sceneType !== "d3") {
      return { ...scene, chartLayers: [], d3Data: null };
    }
    const layers2 = Array.isArray(scene.chartLayers) ? scene.chartLayers : [];
    if (layers2.length === 0) return scene;
    const normalizedLayers = layers2.length <= 4 ? autoGridLayouts(layers2) : layers2;
    const compiled = compileD3SceneFromLayers(normalizedLayers);
    return {
      ...scene,
      chartLayers: normalizedLayers,
      sceneCode: compiled.sceneCode,
      d3Data: compiled.d3Data
    };
  });
}

// lib/db/project-scene-storage.ts
function readProjectSceneBlob(description) {
  if (!description) {
    return { scenes: [], sceneGraph: null, zdogLibrary: [] };
  }
  try {
    const parsed = JSON.parse(description);
    return {
      scenes: parsed.scenes || [],
      sceneGraph: parsed.sceneGraph || null,
      zdogLibrary: parsed.zdogLibrary || [],
      timeline: parsed.timeline || null
    };
  } catch {
    return { scenes: [], sceneGraph: null, zdogLibrary: [] };
  }
}
function writeProjectSceneBlob(existingDescription, updates) {
  let existingData = {};
  if (existingDescription) {
    try {
      existingData = JSON.parse(existingDescription);
    } catch {
      existingData = {};
    }
  }
  const result = {
    ...existingData,
    scenes: updates.scenes !== void 0 ? updates.scenes : existingData.scenes || [],
    sceneGraph: updates.sceneGraph !== void 0 ? updates.sceneGraph : existingData.sceneGraph || null
  };
  if (updates.zdogLibrary !== void 0) result.zdogLibrary = updates.zdogLibrary;
  if (updates.zdogStudioLibrary !== void 0) result.zdogStudioLibrary = updates.zdogStudioLibrary;
  if (updates.timeline !== void 0) result.timeline = updates.timeline;
  return JSON.stringify(result);
}

// lib/db/project-scene-table.ts
var import_drizzle_orm6 = require("drizzle-orm");
var import_crypto = require("crypto");

// lib/transitions.ts
var TRANSITION_CATALOG = [
  { id: "none", label: "Cut", category: "Basics", xfade: null },
  { id: "crossfade", label: "Crossfade", category: "Basics", xfade: "fade" },
  { id: "dissolve", label: "Dissolve", category: "Basics", xfade: "dissolve" },
  { id: "fade-black", label: "Fade through black", category: "Basics", xfade: "fadeblack" },
  { id: "fade-white", label: "Fade through white", category: "Basics", xfade: "fadewhite" },
  { id: "wipe-left", label: "Wipe left", category: "Wipe", xfade: "wipeleft" },
  { id: "wipe-right", label: "Wipe right", category: "Wipe", xfade: "wiperight" },
  { id: "wipe-up", label: "Wipe up", category: "Wipe", xfade: "wipeup" },
  { id: "wipe-down", label: "Wipe down", category: "Wipe", xfade: "wipedown" },
  { id: "wipe-tl", label: "Wipe corner TL", category: "Wipe", xfade: "wipetl" },
  { id: "wipe-tr", label: "Wipe corner TR", category: "Wipe", xfade: "wipetr" },
  { id: "wipe-bl", label: "Wipe corner BL", category: "Wipe", xfade: "wipebl" },
  { id: "wipe-br", label: "Wipe corner BR", category: "Wipe", xfade: "wipebr" },
  { id: "slide-left", label: "Slide left", category: "Slide", xfade: "slideleft" },
  { id: "slide-right", label: "Slide right", category: "Slide", xfade: "slideright" },
  { id: "slide-up", label: "Slide up", category: "Slide", xfade: "slideup" },
  { id: "slide-down", label: "Slide down", category: "Slide", xfade: "slidedown" },
  { id: "smooth-left", label: "Smooth left", category: "Smooth", xfade: "smoothleft" },
  { id: "smooth-right", label: "Smooth right", category: "Smooth", xfade: "smoothright" },
  { id: "smooth-up", label: "Smooth up", category: "Smooth", xfade: "smoothup" },
  { id: "smooth-down", label: "Smooth down", category: "Smooth", xfade: "smoothdown" },
  { id: "circle-open", label: "Iris open", category: "Shape", xfade: "circleopen" },
  { id: "circle-close", label: "Iris close", category: "Shape", xfade: "circleclose" },
  { id: "radial", label: "Radial", category: "Shape", xfade: "radial" },
  { id: "vert-open", label: "Vertical open", category: "Shape", xfade: "vertopen" },
  { id: "horz-open", label: "Horizontal open", category: "Shape", xfade: "horzopen" },
  { id: "cover-left", label: "Cover left", category: "Cover / reveal", xfade: "coverleft" },
  { id: "cover-right", label: "Cover right", category: "Cover / reveal", xfade: "coverright" },
  { id: "reveal-left", label: "Reveal left", category: "Cover / reveal", xfade: "revealleft" },
  { id: "reveal-right", label: "Reveal right", category: "Cover / reveal", xfade: "revealright" },
  { id: "diag-tl", label: "Diagonal TL", category: "Diagonal", xfade: "diagtl" },
  { id: "diag-tr", label: "Diagonal TR", category: "Diagonal", xfade: "diagtr" },
  { id: "diag-bl", label: "Diagonal BL", category: "Diagonal", xfade: "diagbl" },
  { id: "diag-br", label: "Diagonal BR", category: "Diagonal", xfade: "diagbr" },
  { id: "zoom-in", label: "Zoom in", category: "Depth", xfade: "zoomin" },
  { id: "distance", label: "Distance", category: "Depth", xfade: "distance" }
];
var TRANSITION_UI_GROUPS = (() => {
  const order = [];
  const map = /* @__PURE__ */ new Map();
  for (const row of TRANSITION_CATALOG) {
    if (!map.has(row.category)) {
      order.push(row.category);
      map.set(row.category, []);
    }
    map.get(row.category).push({ id: row.id, label: row.label });
  }
  return order.map((category) => ({ category, items: map.get(category) }));
})();
var ALL_TRANSITION_IDS = TRANSITION_CATALOG.map((r) => r.id);
var VALID = new Set(ALL_TRANSITION_IDS);
function isValidTransition(s) {
  return VALID.has(s);
}
function normalizeTransition(raw) {
  if (typeof raw === "string" && isValidTransition(raw)) return raw;
  if (raw && typeof raw === "object" && "type" in raw) {
    const t = raw.type;
    if (typeof t === "string" && isValidTransition(t)) return t;
  }
  return "none";
}

// lib/db/project-scene-table.ts
var UUID_RE2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function buildFallbackSceneFromRow(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    prompt: "",
    summary: "",
    svgContent: "",
    duration: row.duration ?? 8,
    bgColor: row.bgColor ?? "#ffffff",
    thumbnail: row.thumbnailUrl ?? null,
    videoLayer: row.videoLayer ?? { enabled: false, src: null, opacity: 1, trimStart: 0, trimEnd: null },
    audioLayer: row.audioLayer ?? {
      enabled: false,
      src: null,
      volume: 1,
      fadeIn: false,
      fadeOut: false,
      startOffset: 0
    },
    textOverlays: [],
    svgObjects: [],
    primaryObjectId: null,
    svgBranches: [],
    activeBranchId: null,
    transition: normalizeTransition(row.transition?.type ?? "none"),
    usage: null,
    sceneType: "svg",
    canvasCode: "",
    canvasBackgroundCode: "",
    sceneCode: "",
    reactCode: "",
    sceneHTML: "",
    sceneStyles: "",
    lottieSource: "",
    d3Data: null,
    chartLayers: [],
    physicsLayers: [],
    interactions: [],
    variables: [],
    aiLayers: [],
    messages: [],
    styleOverride: row.styleOverride ?? {},
    cameraMotion: row.cameraMotion ?? null,
    worldConfig: row.worldConfig ?? null
  };
}
function isUuid(value) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function normalizeEdgeCondition(cond) {
  const c = cond && typeof cond === "object" ? cond : {};
  return {
    type: c.type ?? "auto",
    interactionId: c.interactionId ?? null,
    variableName: c.variableName ?? null,
    variableValue: c.variableValue ?? null
  };
}
function edgeSemanticKey(edge) {
  return `${edge.fromSceneId}::${edge.toSceneId}::${JSON.stringify(edge.condition)}`;
}
async function writeProjectScenesToTables(projectId, projectScenes, sceneGraph) {
  await db.transaction(async (tx) => {
    await writeProjectScenesToTablesTx(tx, projectId, projectScenes, sceneGraph);
  });
}
async function writeProjectScenesToTablesTx(tx, projectId, projectScenes, sceneGraph) {
  const incomingSceneIds = projectScenes.map((s) => s.id);
  const uuidSceneIds = incomingSceneIds.filter((id) => UUID_RE2.test(id));
  if (uuidSceneIds.length > 0) {
    const crossProjectRows = await tx.select({ id: scenes.id }).from(scenes).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.ne)(scenes.projectId, projectId), (0, import_drizzle_orm6.inArray)(scenes.id, uuidSceneIds))).limit(1);
    if (crossProjectRows.length > 0) {
      throw new Error(`scene id collision across projects for id ${crossProjectRows[0].id}`);
    }
  }
  await tx.update(projects).set({ sceneGraphStartSceneId: sceneGraph?.startSceneId || null, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm6.eq)(projects.id, projectId));
  if (uuidSceneIds.length > 0) {
    await tx.delete(scenes).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(scenes.projectId, projectId), (0, import_drizzle_orm6.notInArray)(scenes.id, uuidSceneIds)));
  } else {
    await tx.delete(scenes).where((0, import_drizzle_orm6.eq)(scenes.projectId, projectId));
  }
  const uuidScenes = projectScenes.filter((s) => UUID_RE2.test(s.id));
  if (uuidScenes.length > 0) {
    await tx.insert(scenes).values(
      uuidScenes.map((s, idx) => ({
        id: s.id,
        projectId,
        name: s.name ?? "",
        position: idx,
        duration: s.duration ?? 8,
        bgColor: s.bgColor ?? "#ffffff",
        styleOverride: s.styleOverride ?? {},
        transition: { type: normalizeTransition(s.transition), duration: 0.5 },
        audioLayer: s.audioLayer ?? null,
        videoLayer: s.videoLayer ?? null,
        thumbnailUrl: s.thumbnail ?? null,
        cameraMotion: s.cameraMotion ?? null,
        worldConfig: s.worldConfig ?? null,
        sceneBlob: s,
        updatedAt: /* @__PURE__ */ new Date()
      }))
    ).onConflictDoUpdate({
      target: scenes.id,
      set: {
        // Keep projectId immutable on conflicts to avoid cross-project reassignment.
        name: import_drizzle_orm6.sql`excluded.name`,
        position: import_drizzle_orm6.sql`excluded.position`,
        duration: import_drizzle_orm6.sql`excluded.duration`,
        bgColor: import_drizzle_orm6.sql`excluded.bg_color`,
        styleOverride: import_drizzle_orm6.sql`excluded.style_override`,
        transition: import_drizzle_orm6.sql`excluded.transition`,
        audioLayer: import_drizzle_orm6.sql`excluded.audio_layer`,
        videoLayer: import_drizzle_orm6.sql`excluded.video_layer`,
        thumbnailUrl: import_drizzle_orm6.sql`excluded.thumbnail_url`,
        cameraMotion: import_drizzle_orm6.sql`excluded.camera_motion`,
        worldConfig: import_drizzle_orm6.sql`excluded.world_config`,
        sceneBlob: import_drizzle_orm6.sql`excluded.scene_blob`,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
  }
  const nodes = sceneGraph?.nodes ?? [];
  const incomingNodeSceneIds = nodes.map((n) => n.id);
  if (incomingNodeSceneIds.length > 0) {
    await tx.delete(sceneNodes).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(sceneNodes.projectId, projectId), (0, import_drizzle_orm6.notInArray)(sceneNodes.sceneId, incomingNodeSceneIds)));
    await tx.insert(sceneNodes).values(
      nodes.map((n) => ({
        projectId,
        sceneId: n.id,
        position: n.position ?? { x: 0, y: 0 }
      }))
    ).onConflictDoUpdate({
      target: [sceneNodes.projectId, sceneNodes.sceneId],
      set: { position: import_drizzle_orm6.sql`excluded.position` }
    });
  } else {
    await tx.delete(sceneNodes).where((0, import_drizzle_orm6.eq)(sceneNodes.projectId, projectId));
  }
  const existingEdges = await tx.select({
    id: sceneEdges.id,
    fromSceneId: sceneEdges.fromSceneId,
    toSceneId: sceneEdges.toSceneId,
    condition: sceneEdges.condition
  }).from(sceneEdges).where((0, import_drizzle_orm6.eq)(sceneEdges.projectId, projectId));
  const existingBySemantic = /* @__PURE__ */ new Map();
  for (const ee of existingEdges) {
    const key = edgeSemanticKey({
      fromSceneId: ee.fromSceneId ?? "",
      toSceneId: ee.toSceneId ?? "",
      condition: normalizeEdgeCondition(ee.condition)
    });
    const list7 = existingBySemantic.get(key) ?? [];
    list7.push(ee.id);
    existingBySemantic.set(key, list7);
  }
  const edges = sceneGraph?.edges ?? [];
  const edgeRows = edges.map((e) => {
    const normalizedCondition = normalizeEdgeCondition(e.condition);
    let edgeId = isUuid(e.id) ? e.id : null;
    if (!edgeId) {
      const key = edgeSemanticKey({
        fromSceneId: e.fromSceneId,
        toSceneId: e.toSceneId,
        condition: normalizedCondition
      });
      const existing = existingBySemantic.get(key);
      edgeId = existing?.shift() ?? null;
    }
    return {
      id: edgeId ?? (0, import_crypto.randomUUID)(),
      projectId,
      fromSceneId: e.fromSceneId,
      toSceneId: e.toSceneId,
      condition: normalizedCondition
    };
  });
  const incomingEdgeIds = edgeRows.map((e) => e.id);
  if (incomingEdgeIds.length > 0) {
    await tx.delete(sceneEdges).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(sceneEdges.projectId, projectId), (0, import_drizzle_orm6.notInArray)(sceneEdges.id, incomingEdgeIds)));
    await tx.insert(sceneEdges).values(edgeRows).onConflictDoUpdate({
      target: sceneEdges.id,
      set: {
        fromSceneId: import_drizzle_orm6.sql`excluded.from_scene_id`,
        toSceneId: import_drizzle_orm6.sql`excluded.to_scene_id`,
        condition: import_drizzle_orm6.sql`excluded.condition`
      }
    });
  } else {
    await tx.delete(sceneEdges).where((0, import_drizzle_orm6.eq)(sceneEdges.projectId, projectId));
  }
}
async function readProjectScenesFromTables(projectId) {
  const rows = await db.query.scenes.findMany({
    where: (0, import_drizzle_orm6.eq)(scenes.projectId, projectId),
    orderBy: (s, { asc: asc2 }) => [asc2(s.position)]
  });
  if (!rows || rows.length === 0) return null;
  const edgeRows = await db.query.sceneEdges.findMany({
    where: (0, import_drizzle_orm6.eq)(sceneEdges.projectId, projectId)
  });
  const nodeRows = await db.query.sceneNodes.findMany({
    where: (0, import_drizzle_orm6.eq)(sceneNodes.projectId, projectId)
  });
  const [projectRow] = await db.select({ startSceneId: projects.sceneGraphStartSceneId }).from(projects).where((0, import_drizzle_orm6.eq)(projects.id, projectId)).limit(1);
  const outScenes = rows.map((r) => {
    const blob = r.sceneBlob;
    if (blob && typeof blob === "object") return blob;
    return buildFallbackSceneFromRow(r);
  });
  const outGraph = {
    nodes: nodeRows.length > 0 ? nodeRows.map((n) => ({
      id: n.sceneId,
      position: n.position ?? { x: 0, y: 0 }
    })) : outScenes.map((s, i) => ({ id: s.id, position: { x: i * 300, y: 100 } })),
    edges: edgeRows.map((e) => ({
      id: e.id,
      fromSceneId: e.fromSceneId,
      toSceneId: e.toSceneId,
      condition: e.condition ?? { type: "auto", interactionId: null, variableName: null, variableValue: null }
    })),
    startSceneId: projectRow?.startSceneId ?? outScenes[0]?.id ?? ""
  };
  return { scenes: outScenes, sceneGraph: outGraph };
}

// electron/ipc/projects.ts
var MAX_PROJECTS_PER_PAGE = 100;
var MAX_SCENES = 200;
var MAX_LOGO_ASSET_IDS = 32;
var MAX_GLOBAL_STYLE_SIZE = 16 * 1024;
var MAX_SETTINGS_SIZE = 16 * 1024;
var SCRYPT_HASH_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;
var DEFAULT_BRAND_KIT = {
  brandName: null,
  logoAssetIds: [],
  palette: [],
  fontPrimary: null,
  fontSecondary: null,
  guidelines: null
};
async function list3(args = {}) {
  const paginated = args.limit !== void 0 || args.cursor !== void 0;
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MAX_PROJECTS_PER_PAGE);
  const conditions = [];
  if (args.workspaceId === "none") {
    conditions.push((0, import_drizzle_orm7.isNull)(projects.workspaceId));
  } else if (args.workspaceId) {
    assertValidUuid(args.workspaceId, "workspaceId");
    conditions.push((0, import_drizzle_orm7.eq)(projects.workspaceId, args.workspaceId));
  }
  if (args.cursor) {
    const cursorDate = new Date(args.cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push((0, import_drizzle_orm7.lt)(projects.updatedAt, cursorDate));
    }
  }
  const rows = await db.select({
    id: projects.id,
    name: projects.name,
    description: projects.description,
    outputMode: projects.outputMode,
    thumbnailUrl: projects.thumbnailUrl,
    workspaceId: projects.workspaceId,
    updatedAt: projects.updatedAt,
    createdAt: projects.createdAt
  }).from(projects).where(conditions.length > 0 ? (0, import_drizzle_orm7.and)(...conditions) : void 0).orderBy((0, import_drizzle_orm7.desc)(projects.updatedAt)).limit(paginated ? limit + 1 : limit);
  if (!paginated) return rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].updatedAt?.toISOString() ?? null : null;
  return { items, nextCursor };
}
async function create2(args) {
  if (args.id) assertValidUuid(args.id, "id");
  if (args.workspaceId) assertValidUuid(args.workspaceId, "workspaceId");
  if (args.outputMode && !["mp4", "interactive"].includes(args.outputMode)) {
    throw new IpcValidationError(`Invalid outputMode: ${args.outputMode}`);
  }
  if (args.scenes && !Array.isArray(args.scenes)) {
    throw new IpcValidationError("scenes must be an array");
  }
  if (args.scenes && args.scenes.length > MAX_SCENES) {
    throw new IpcValidationError(`scenes array exceeds ${MAX_SCENES} item limit`);
  }
  if (Array.isArray(args.sceneGraph?.nodes) && args.sceneGraph.nodes.length > MAX_SCENES) {
    throw new IpcValidationError(`sceneGraph.nodes exceeds ${MAX_SCENES} item limit`);
  }
  if (args.globalStyle !== void 0 && JSON.stringify(args.globalStyle).length > MAX_GLOBAL_STYLE_SIZE) {
    throw new IpcValidationError("globalStyle exceeds size limit");
  }
  if (args.mp4Settings !== void 0 && JSON.stringify(args.mp4Settings).length > MAX_SETTINGS_SIZE) {
    throw new IpcValidationError("mp4Settings exceeds size limit");
  }
  if (args.interactiveSettings !== void 0 && JSON.stringify(args.interactiveSettings).length > MAX_SETTINGS_SIZE) {
    throw new IpcValidationError("interactiveSettings exceeds size limit");
  }
  const [project] = await db.insert(projects).values({
    ...args.id ? { id: args.id } : {},
    userId: null,
    workspaceId: args.workspaceId || null,
    name: (args.name || "Untitled Project").slice(0, 255),
    outputMode: args.outputMode || "mp4",
    globalStyle: args.globalStyle || {
      presetId: null,
      paletteOverride: null,
      bgColorOverride: null,
      fontOverride: null,
      bodyFontOverride: null,
      strokeColorOverride: null
    },
    mp4Settings: args.mp4Settings || void 0,
    interactiveSettings: args.interactiveSettings || void 0,
    apiPermissions: args.apiPermissions || {},
    audioSettings: args.audioSettings || void 0,
    audioProviderEnabled: args.audioProviderEnabled || {},
    mediaGenEnabled: args.mediaGenEnabled || {},
    description: JSON.stringify({
      scenes: args.scenes || [],
      sceneGraph: args.sceneGraph || null,
      timeline: args.timeline || null
    })
  }).returning();
  return project;
}
async function get2(projectId) {
  const project = await loadProjectOrThrow(projectId);
  const tableBacked = await readProjectScenesFromTables(projectId);
  const blobBacked = readProjectSceneBlob(project.description);
  if (!tableBacked && blobBacked.scenes.length > 0) {
    try {
      await writeProjectScenesToTables(projectId, blobBacked.scenes, blobBacked.sceneGraph);
    } catch (e) {
      console.error("[projects.get] lazy table backfill failed:", e);
    }
  }
  return {
    ...project,
    scenes: tableBacked?.scenes ?? blobBacked.scenes,
    sceneGraph: tableBacked?.sceneGraph ?? blobBacked.sceneGraph,
    zdogLibrary: blobBacked.zdogLibrary,
    timeline: blobBacked.timeline
  };
}
async function update3({ projectId, updates }) {
  assertValidUuid(projectId, "projectId");
  if (updates.scenes !== void 0) {
    if (!Array.isArray(updates.scenes)) {
      throw new IpcValidationError("scenes must be an array");
    }
    if (updates.scenes.length > MAX_SCENES) {
      throw new IpcValidationError(`scenes array exceeds ${MAX_SCENES} item limit`);
    }
  }
  if (updates.sceneGraph !== void 0 && Array.isArray(updates.sceneGraph?.nodes) && (updates.sceneGraph.nodes.length ?? 0) > MAX_SCENES) {
    throw new IpcValidationError(`sceneGraph.nodes exceeds ${MAX_SCENES} item limit`);
  }
  const updateData = { updatedAt: /* @__PURE__ */ new Date() };
  if (updates.workspaceId !== void 0) updateData.workspaceId = updates.workspaceId || null;
  if (updates.name !== void 0) updateData.name = updates.name;
  if (updates.outputMode !== void 0) {
    if (!["mp4", "interactive"].includes(String(updates.outputMode))) {
      throw new IpcValidationError(`Invalid outputMode: ${updates.outputMode}`);
    }
    updateData.outputMode = updates.outputMode;
  }
  if (updates.globalStyle !== void 0) {
    if (JSON.stringify(updates.globalStyle).length > MAX_GLOBAL_STYLE_SIZE) {
      throw new IpcValidationError("globalStyle exceeds size limit");
    }
    updateData.globalStyle = updates.globalStyle;
  }
  if (updates.mp4Settings !== void 0) {
    if (JSON.stringify(updates.mp4Settings).length > MAX_SETTINGS_SIZE) {
      throw new IpcValidationError("mp4Settings exceeds size limit");
    }
    updateData.mp4Settings = updates.mp4Settings;
  }
  if (updates.interactiveSettings !== void 0) {
    const settings = updates.interactiveSettings;
    if (settings?.password && !SCRYPT_HASH_RE.test(settings.password)) {
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
      settings.password = hashPassword2(settings.password);
    }
    updateData.interactiveSettings = settings;
  }
  for (const key of [
    "apiPermissions",
    "audioSettings",
    "audioProviderEnabled",
    "mediaGenEnabled",
    "thumbnailUrl",
    "watermark",
    "brandKit",
    "storyboardProposed",
    "storyboardEdited",
    "storyboardApplied",
    "pausedAgentRun",
    "runCheckpoint"
  ]) {
    if (updates[key] !== void 0) updateData[key] = updates[key];
  }
  const [existing] = await db.select({ description: projects.description, version: projects.version }).from(projects).where((0, import_drizzle_orm7.eq)(projects.id, projectId));
  if (!existing) throw new IpcNotFoundError(`Project ${projectId} not found`);
  const currentVersion = existing.version ?? 1;
  let normalizedScenes = null;
  if (updates.scenes !== void 0 || updates.sceneGraph !== void 0 || updates.timeline !== void 0) {
    normalizedScenes = updates.scenes !== void 0 ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeScenesForPersistence(updates.scenes)
    ) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readProjectSceneBlob(existing.description).scenes
    );
    updateData.description = writeProjectSceneBlob(existing.description, {
      scenes: normalizedScenes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sceneGraph: updates.sceneGraph !== void 0 ? updates.sceneGraph : void 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timeline: updates.timeline !== void 0 ? updates.timeline : void 0
    });
  }
  updateData.version = currentVersion + 1;
  const [project] = await db.update(projects).set(updateData).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(projects.id, projectId), (0, import_drizzle_orm7.eq)(projects.version, currentVersion))).returning();
  if (!project) {
    throw new IpcConflictError("Project was modified concurrently. Please retry.");
  }
  if ((updates.scenes !== void 0 || updates.sceneGraph !== void 0) && normalizedScenes) {
    try {
      const graphToWrite = updates.sceneGraph !== void 0 ? updates.sceneGraph : readProjectSceneBlob(existing.description).sceneGraph;
      await writeProjectScenesToTables(projectId, normalizedScenes, graphToWrite);
    } catch (e) {
      console.error("[projects.update] table sync failed \u2014 blob is source of truth:", e);
    }
  }
  return project;
}
function resolveScenesDir() {
  return import_electron2.app.isPackaged ? import_node_path2.default.join(import_electron2.app.getPath("userData"), "scenes") : import_node_path2.default.join(process.cwd(), "public", "scenes");
}
function resolvePublishedDir(projectId) {
  const base = import_electron2.app.isPackaged ? import_node_path2.default.join(import_electron2.app.getPath("userData"), "published") : import_node_path2.default.join(process.cwd(), "public", "published");
  return import_node_path2.default.join(base, projectId);
}
async function remove2(projectId) {
  const project = await loadProjectOrThrow(projectId);
  await db.delete(projects).where((0, import_drizzle_orm7.eq)(projects.id, projectId));
  const cleanup = async () => {
    const scenesDir = resolveScenesDir();
    const publishedDir = resolvePublishedDir(projectId);
    if (project.description) {
      try {
        const parsed = readProjectSceneBlob(project.description);
        const sceneIds = (parsed.scenes || []).map((s) => s.id);
        await Promise.allSettled(sceneIds.map((sid) => import_promises2.default.unlink(import_node_path2.default.join(scenesDir, `${sid}.html`)).catch(() => {
        })));
      } catch {
      }
    }
    await import_promises2.default.rm(publishedDir, { recursive: true, force: true }).catch(() => {
    });
  };
  cleanup().catch((err) => console.error(`[projects.remove] Cleanup failed for ${projectId}:`, err));
  return { ok: true };
}
async function listAssets(args) {
  await loadProjectOrThrow(args.projectId);
  const conditions = [(0, import_drizzle_orm7.eq)(projectAssets.projectId, args.projectId)];
  if (args.type && ["image", "video", "svg"].includes(args.type)) {
    conditions.push((0, import_drizzle_orm7.eq)(projectAssets.type, args.type));
  }
  if (args.source === "upload" || args.source === "generated") {
    conditions.push((0, import_drizzle_orm7.eq)(projectAssets.source, args.source));
  }
  const assets2 = await db.select().from(projectAssets).where((0, import_drizzle_orm7.and)(...conditions)).orderBy((0, import_drizzle_orm7.desc)(projectAssets.createdAt));
  return { assets: assets2 };
}
async function getBrandKit(projectId) {
  assertValidUuid(projectId, "projectId");
  const [project] = await db.select({ brandKit: projects.brandKit }).from(projects).where((0, import_drizzle_orm7.eq)(projects.id, projectId));
  if (!project) throw new IpcNotFoundError(`Project ${projectId} not found`);
  return { brandKit: project.brandKit ?? DEFAULT_BRAND_KIT };
}
async function updateBrandKit(args) {
  assertValidUuid(args.projectId, "projectId");
  const [project] = await db.select({ brandKit: projects.brandKit }).from(projects).where((0, import_drizzle_orm7.eq)(projects.id, args.projectId));
  if (!project) throw new IpcNotFoundError(`Project ${args.projectId} not found`);
  const current = project.brandKit ?? { ...DEFAULT_BRAND_KIT };
  const updated = { ...current };
  const { updates } = args;
  if (typeof updates.brandName === "string" || updates.brandName === null) {
    updated.brandName = updates.brandName;
  }
  if (Array.isArray(updates.logoAssetIds)) {
    if (updates.logoAssetIds.length > MAX_LOGO_ASSET_IDS) {
      throw new IpcValidationError(`logoAssetIds exceeds ${MAX_LOGO_ASSET_IDS} item limit`);
    }
    for (const id of updates.logoAssetIds) {
      if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new IpcValidationError("logoAssetIds entries must be valid UUIDs");
      }
    }
    if (updates.logoAssetIds.length > 0) {
      const existing = await db.select({ id: projectAssets.id }).from(projectAssets).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(projectAssets.projectId, args.projectId), (0, import_drizzle_orm7.inArray)(projectAssets.id, updates.logoAssetIds)));
      const existingIds = new Set(existing.map((a) => a.id));
      updated.logoAssetIds = updates.logoAssetIds.filter((id) => existingIds.has(id));
    } else {
      updated.logoAssetIds = [];
    }
  }
  if (Array.isArray(updates.palette)) {
    updated.palette = updates.palette.filter((c) => typeof c === "string").slice(0, 8);
  }
  if (typeof updates.fontPrimary === "string" || updates.fontPrimary === null) {
    updated.fontPrimary = updates.fontPrimary;
  }
  if (typeof updates.fontSecondary === "string" || updates.fontSecondary === null) {
    updated.fontSecondary = updates.fontSecondary;
  }
  if (typeof updates.guidelines === "string" || updates.guidelines === null) {
    updated.guidelines = updates.guidelines;
  }
  await db.update(projects).set({ brandKit: updated }).where((0, import_drizzle_orm7.eq)(projects.id, args.projectId));
  return { brandKit: updated };
}
function register7(ipcMain2) {
  ipcMain2.handle("cench:projects.list", (_e, args) => list3(args ?? {}));
  ipcMain2.handle("cench:projects.create", (_e, args) => create2(args));
  ipcMain2.handle("cench:projects.get", (_e, projectId) => get2(projectId));
  ipcMain2.handle("cench:projects.update", (_e, args) => update3(args));
  ipcMain2.handle("cench:projects.delete", (_e, projectId) => remove2(projectId));
  ipcMain2.handle(
    "cench:projects.listAssets",
    (_e, args) => listAssets(args)
  );
  ipcMain2.handle("cench:projects.getBrandKit", (_e, projectId) => getBrandKit(projectId));
  ipcMain2.handle(
    "cench:projects.updateBrandKit",
    (_e, args) => updateBrandKit(args)
  );
}

// lib/db/queries/workspaces.ts
var import_drizzle_orm8 = require("drizzle-orm");
async function getUserWorkspaces(userId) {
  const ownerFilter = userId ? (0, import_drizzle_orm8.eq)(workspaces.userId, userId) : (0, import_drizzle_orm8.isNull)(workspaces.userId);
  const rows = await db.select({
    id: workspaces.id,
    name: workspaces.name,
    description: workspaces.description,
    color: workspaces.color,
    icon: workspaces.icon,
    isDefault: workspaces.isDefault,
    isArchived: workspaces.isArchived,
    updatedAt: workspaces.updatedAt,
    projectCount: import_drizzle_orm8.sql`count(${projects.id})::int`
  }).from(workspaces).leftJoin(projects, (0, import_drizzle_orm8.eq)(projects.workspaceId, workspaces.id)).where(ownerFilter).groupBy(workspaces.id).orderBy((0, import_drizzle_orm8.desc)(workspaces.updatedAt));
  return rows;
}
async function getWorkspace(workspaceId) {
  return db.query.workspaces.findFirst({
    where: (0, import_drizzle_orm8.eq)(workspaces.id, workspaceId)
  });
}
async function createWorkspace(data) {
  if (data.isDefault && data.userId) {
    await db.update(workspaces).set({ isDefault: false }).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(workspaces.userId, data.userId), (0, import_drizzle_orm8.eq)(workspaces.isDefault, true)));
  }
  const [workspace] = await db.insert(workspaces).values(data).returning();
  return workspace;
}
async function updateWorkspace(workspaceId, data) {
  if (data.isDefault) {
    const existing = await getWorkspace(workspaceId);
    if (existing?.userId) {
      await db.update(workspaces).set({ isDefault: false }).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(workspaces.userId, existing.userId), (0, import_drizzle_orm8.eq)(workspaces.isDefault, true)));
    }
  }
  const [workspace] = await db.update(workspaces).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm8.eq)(workspaces.id, workspaceId)).returning();
  return workspace;
}
async function deleteWorkspace(workspaceId) {
  await db.delete(workspaces).where((0, import_drizzle_orm8.eq)(workspaces.id, workspaceId));
}
async function assignProjectsToWorkspace(workspaceId, projectIds) {
  if (projectIds.length === 0) return;
  await db.update(projects).set({ workspaceId, updatedAt: /* @__PURE__ */ new Date() }).where(import_drizzle_orm8.sql`${projects.id} = ANY(${projectIds})`);
}
async function removeProjectsFromWorkspace(projectIds) {
  if (projectIds.length === 0) return;
  await db.update(projects).set({ workspaceId: null, updatedAt: /* @__PURE__ */ new Date() }).where(import_drizzle_orm8.sql`${projects.id} = ANY(${projectIds})`);
}

// electron/ipc/workspaces.ts
var import_drizzle_orm9 = require("drizzle-orm");
var MAX_NAME = 255;
var MAX_PROJECTS_PER_ASSIGN = 100;
async function list4() {
  return getUserWorkspaces(null);
}
async function get3(workspaceId) {
  assertValidUuid(workspaceId, "workspaceId");
  const row = await getWorkspace(workspaceId);
  if (!row) throw new IpcValidationError(`Workspace ${workspaceId} not found`);
  return row;
}
async function create3(args) {
  if (!args.name || typeof args.name !== "string" || args.name.trim().length === 0) {
    throw new IpcValidationError("name is required");
  }
  return createWorkspace({
    userId: null,
    name: args.name.trim().slice(0, MAX_NAME),
    description: args.description ?? null,
    color: args.color ?? null,
    icon: args.icon ?? null,
    isDefault: args.isDefault ?? false
  });
}
async function update4({ workspaceId, updates }) {
  await loadWorkspaceOrThrow(workspaceId);
  const patch = {};
  if (updates.name !== void 0) patch.name = String(updates.name).trim().slice(0, MAX_NAME);
  if (updates.description !== void 0) patch.description = updates.description;
  if (updates.color !== void 0) patch.color = updates.color;
  if (updates.icon !== void 0) patch.icon = updates.icon;
  if (updates.brandKit !== void 0) patch.brandKit = updates.brandKit;
  if (updates.globalStyle !== void 0) patch.globalStyle = updates.globalStyle;
  if (updates.settings !== void 0) patch.settings = updates.settings;
  if (updates.isDefault !== void 0) patch.isDefault = updates.isDefault;
  return updateWorkspace(workspaceId, patch);
}
async function remove3(workspaceId) {
  await loadWorkspaceOrThrow(workspaceId);
  await deleteWorkspace(workspaceId);
  return { success: true };
}
async function validateProjectIds(projectIds, label = "projectIds") {
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    throw new IpcValidationError(`${label} must be a non-empty array`);
  }
  if (projectIds.length > MAX_PROJECTS_PER_ASSIGN) {
    throw new IpcValidationError(`Maximum ${MAX_PROJECTS_PER_ASSIGN} projects per request`);
  }
  const ids = projectIds.map((id) => assertValidUuid(id, "projectId"));
  const found = await db.select({ id: projects.id }).from(projects).where((0, import_drizzle_orm9.inArray)(projects.id, ids));
  if (found.length !== ids.length) {
    const foundSet = new Set(found.map((r) => r.id));
    const missing = ids.filter((id) => !foundSet.has(id));
    throw new IpcValidationError(`Unknown projectIds: ${missing.slice(0, 3).join(", ")}`);
  }
  return ids;
}
async function assignProjects(args) {
  await loadWorkspaceOrThrow(args.workspaceId);
  const ids = await validateProjectIds(args.projectIds);
  await assignProjectsToWorkspace(args.workspaceId, ids);
  return { success: true };
}
async function unassignProjects(args) {
  const ids = await validateProjectIds(args.projectIds);
  await removeProjectsFromWorkspace(ids);
  return { success: true };
}
function register8(ipcMain2) {
  ipcMain2.handle("cench:workspaces.list", () => list4());
  ipcMain2.handle("cench:workspaces.get", (_e, workspaceId) => get3(workspaceId));
  ipcMain2.handle("cench:workspaces.create", (_e, args) => create3(args));
  ipcMain2.handle("cench:workspaces.update", (_e, args) => update4(args));
  ipcMain2.handle("cench:workspaces.delete", (_e, workspaceId) => remove3(workspaceId));
  ipcMain2.handle(
    "cench:workspaces.assignProjects",
    (_e, args) => assignProjects(args)
  );
  ipcMain2.handle("cench:workspaces.unassignProjects", (_e, args) => unassignProjects(args));
}

// electron/ipc/publish.ts
var import_electron3 = require("electron");
var import_node_path3 = __toESM(require("node:path"));
var import_promises3 = __toESM(require("node:fs/promises"));
var import_node_fs = __toESM(require("node:fs"));
function scenesSourceDir() {
  return import_electron3.app.isPackaged ? import_node_path3.default.join(import_electron3.app.getPath("userData"), "scenes") : import_node_path3.default.join(process.cwd(), "public", "scenes");
}
function publishBase() {
  return import_electron3.app.isPackaged ? import_node_path3.default.join(import_electron3.app.getPath("userData"), "published") : import_node_path3.default.join(process.cwd(), "public", "published");
}
function uploadsDir() {
  return import_electron3.app.isPackaged ? import_node_path3.default.join(import_electron3.app.getPath("userData"), "uploads") : import_node_path3.default.join(process.cwd(), "public", "uploads");
}
async function publish(args) {
  if (!args.project?.id || !args.scenes?.length) {
    throw new IpcValidationError("Missing project or scenes");
  }
  await loadProjectOrThrow(args.project.id);
  const publishDir = import_node_path3.default.join(publishBase(), args.project.id);
  const scenesDir = import_node_path3.default.join(publishDir, "scenes");
  const assetsDir = import_node_path3.default.join(publishDir, "assets");
  await import_promises3.default.mkdir(scenesDir, { recursive: true });
  await import_promises3.default.mkdir(assetsDir, { recursive: true });
  const publishedScenes = [];
  const missingSceneIds = [];
  const srcScenesDir = scenesSourceDir();
  for (const scene of args.scenes) {
    assertValidUuid(scene.id, "scene.id");
    const srcPath = import_node_path3.default.resolve(import_node_path3.default.join(srcScenesDir, `${scene.id}.html`));
    const destPath = import_node_path3.default.resolve(import_node_path3.default.join(scenesDir, `${scene.id}.html`));
    if (!srcPath.startsWith(srcScenesDir + import_node_path3.default.sep) || !destPath.startsWith(scenesDir + import_node_path3.default.sep)) {
      throw new IpcValidationError("Invalid scene id (path escape)");
    }
    try {
      await import_promises3.default.access(srcPath);
    } catch {
      console.warn(`[publish] Scene HTML missing: ${scene.id}.html`);
      missingSceneIds.push(scene.id);
      continue;
    }
    try {
      await import_promises3.default.copyFile(srcPath, destPath);
    } catch (e) {
      console.error(`[publish] Failed to copy scene HTML for ${scene.id}:`, e);
      missingSceneIds.push(scene.id);
      continue;
    }
    publishedScenes.push({
      id: scene.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: scene.sceneType ?? "svg",
      duration: scene.duration,
      htmlUrl: `/published/${args.project.id}/scenes/${scene.id}.html`,
      htmlContent: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      interactions: scene.interactions ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variables: scene.variables ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transition: normalizeTransition(scene.transition)
    });
  }
  if (missingSceneIds.length > 0) {
    throw new IpcValidationError(
      `Failed to publish: ${missingSceneIds.length} scene(s) are missing HTML files. Regenerate them and try again.`
    );
  }
  const uploads = uploadsDir();
  if (import_node_fs.default.existsSync(uploads)) {
    try {
      const files = await import_promises3.default.readdir(uploads);
      for (const file of files) {
        const src = import_node_path3.default.join(uploads, file);
        const dest = import_node_path3.default.join(assetsDir, file);
        try {
          const stat = await import_promises3.default.stat(src);
          if (stat.isFile()) await import_promises3.default.copyFile(src, dest);
        } catch {
        }
      }
    } catch (e) {
      console.warn("[publish] uploads copy failed:", e);
    }
  }
  const manifestPath = import_node_path3.default.join(publishDir, "manifest.json");
  let version = 1;
  try {
    const existing = JSON.parse(await import_promises3.default.readFile(manifestPath, "utf-8"));
    version = (existing.version ?? 0) + 1;
  } catch {
  }
  const manifest = {
    id: args.project.id,
    version,
    name: args.project.name || "Untitled Project",
    playerOptions: {
      theme: args.project.interactiveSettings?.playerTheme ?? "dark",
      showProgressBar: args.project.interactiveSettings?.showProgressBar ?? true,
      showSceneNav: args.project.interactiveSettings?.showSceneNav ?? false,
      allowFullscreen: args.project.interactiveSettings?.allowFullscreen ?? true,
      brandColor: args.project.interactiveSettings?.brandColor ?? "#e84545",
      autoplay: true
    },
    sceneGraph: args.project.sceneGraph,
    scenes: publishedScenes
  };
  await import_promises3.default.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { publishedUrl: `/v/${args.project.id}`, version };
}
function register9(ipcMain2) {
  ipcMain2.handle("cench:publish.run", (_e, args) => publish(args));
}

// electron/ipc/scene.ts
var import_electron4 = require("electron");
var import_node_path4 = __toESM(require("node:path"));
var import_promises4 = __toESM(require("node:fs/promises"));
var import_drizzle_orm10 = require("drizzle-orm");

// lib/dimensions.ts
var DIMENSION_TABLE = {
  "16:9": {
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    "4k": { width: 3840, height: 2160 }
  },
  "9:16": {
    "720p": { width: 720, height: 1280 },
    "1080p": { width: 1080, height: 1920 },
    "4k": { width: 2160, height: 3840 }
  },
  "1:1": {
    "720p": { width: 720, height: 720 },
    "1080p": { width: 1080, height: 1080 },
    "4k": { width: 2160, height: 2160 }
  },
  "4:5": {
    "720p": { width: 720, height: 900 },
    "1080p": { width: 1080, height: 1350 },
    "4k": { width: 2160, height: 2700 }
  }
};
function resolveProjectDimensions(aspectRatio, resolution) {
  const ratio = aspectRatio ?? "16:9";
  const res = resolution ?? "1080p";
  return DIMENSION_TABLE[ratio]?.[res] ?? { width: 1920, height: 1080 };
}
var DEFAULT_DIMENSIONS = { width: 1920, height: 1080 };

// lib/providers/selector.ts
var DEFAULT_WEIGHTS = {
  quality: 1,
  reliability: 0.9,
  latency: 0.3,
  control: 0.4,
  continuity: 0.2,
  cost: 0.4,
  taskFit: 1.5
};
var LOCAL_MODE_WEIGHTS = {
  quality: 0.3,
  reliability: 0.5,
  latency: 0.3,
  control: 0.2,
  continuity: 0.1,
  cost: 2.5,
  taskFit: 0.8
};
function selectBestProvider(profiles, ctx, weights = DEFAULT_WEIGHTS) {
  const excluded = new Set(ctx.excludeIds ?? []);
  const available = profiles.filter((p) => {
    if (excluded.has(p.id)) return false;
    if (ctx.enabled && ctx.enabled[p.id] === false) return false;
    if (ctx.requiresServerOutput && p.clientOnly) return false;
    try {
      return p.available(ctx);
    } catch {
      return false;
    }
  });
  if (available.length === 0) return { chosen: null, ranking: [] };
  const costs = available.map((p) => {
    try {
      return p.costUsd(ctx);
    } catch {
      return 0;
    }
  });
  const maxCost = Math.max(...costs, 1e-4);
  const ranking = available.map((p, i) => {
    const cost = costs[i];
    const normalisedCost = 1 - cost / maxCost;
    const taskFit = p.taskFit ? Math.max(0, Math.min(100, p.taskFit(ctx))) : 50;
    const continuity = ctx.lastProviderId === p.id ? 100 : 0;
    const components = {
      quality: p.quality,
      reliability: p.reliability,
      latency: p.latency,
      control: p.control,
      continuity,
      cost: normalisedCost * 100,
      taskFit
    };
    const score = components.quality * weights.quality + components.reliability * weights.reliability + components.latency * weights.latency + components.control * weights.control + components.continuity * weights.continuity + components.cost * weights.cost + components.taskFit * weights.taskFit;
    return {
      id: p.id,
      score,
      components,
      costUsd: cost,
      reason: p.reasonHint ?? `${p.name}`
    };
  });
  ranking.sort((a, b) => b.score - a.score);
  const top = ranking[0];
  const runnerUp = ranking[1];
  let reason = `${available.find((p) => p.id === top.id)?.name ?? top.id}`;
  if (runnerUp) {
    const diffs = Object.keys(top.components).map((k) => [k, top.components[k] - runnerUp.components[k]]);
    diffs.sort((a, b) => b[1] - a[1]);
    const [winningAxis, gap] = diffs[0];
    if (gap > 5) reason = `${reason}: better ${winningAxis}`;
  }
  ranking[0].reason = reason;
  return { chosen: ranking[0], ranking };
}

// lib/permissions.ts
var API_COST_SCALARS = {
  heygen: { perCall: 0.5 },
  veo3: { perCall: 1.25, perSecond: 0.2 },
  kling: { perCall: 0.45, perSecond: 0.09 },
  runway: { perCall: 0.9, perSecond: 0.18 },
  imageGen: { perCall: 0.04 },
  imageEnhance: { perCall: 0.03 },
  backgroundRemoval: { perCall: 0.01 },
  elevenLabs: { perCall: 0.06, per1KChars: 0.3 },
  unsplash: { perCall: 0 },
  googleTts: { perCall: 4e-3, per1KChars: 0.04 },
  googleImageGen: { perCall: 0.03 },
  openaiTts: { perCall: 0.015, per1KChars: 0.022 },
  geminiTts: { perCall: 0.01, per1KChars: 0.015 },
  freesound: { perCall: 0 },
  pixabay: { perCall: 0 },
  falAvatar: { perCall: 0.1 }
};

// lib/providers/tts-profiles.ts
var hasEnv = (ctx, key) => {
  const env = ctx.env ?? (typeof process !== "undefined" ? process.env : {});
  return !!env?.[key];
};
var isPlatform = (ctx, platform) => {
  const p = ctx.platform ?? (typeof process !== "undefined" ? process.platform : "");
  return p === platform;
};
var ttsCost = (api) => (ctx) => {
  const len = ctx.textLength ?? 0;
  const scalar = API_COST_SCALARS[api];
  if (!scalar) return 0;
  if (scalar.per1KChars && len > 0) {
    return Math.max(scalar.perCall, scalar.per1KChars * len / 1e3);
  }
  return scalar.perCall;
};
var TTS_PROFILES = [
  {
    id: "elevenlabs",
    category: "tts",
    name: "ElevenLabs",
    quality: 95,
    reliability: 90,
    latency: 70,
    control: 85,
    available: (ctx) => hasEnv(ctx, "ELEVENLABS_API_KEY"),
    costUsd: ttsCost("elevenLabs"),
    taskFit: (ctx) => ctx.task === "narration" || ctx.task === "voiceover" ? 90 : 75,
    reasonHint: "ElevenLabs (best voice quality, aligned captions)"
  },
  {
    id: "openai-tts",
    category: "tts",
    name: "OpenAI TTS",
    quality: 80,
    reliability: 92,
    latency: 80,
    control: 70,
    available: (ctx) => hasEnv(ctx, "OPENAI_API_KEY"),
    costUsd: ttsCost("openaiTts"),
    taskFit: () => 70,
    reasonHint: "OpenAI TTS (fast, reliable, instruction-aware)"
  },
  {
    id: "gemini-tts",
    category: "tts",
    name: "Gemini TTS",
    quality: 78,
    reliability: 85,
    latency: 75,
    control: 65,
    available: (ctx) => hasEnv(ctx, "GEMINI_API_KEY"),
    costUsd: ttsCost("geminiTts"),
    taskFit: () => 65,
    reasonHint: "Gemini TTS"
  },
  {
    id: "google-tts",
    category: "tts",
    name: "Google Cloud TTS",
    quality: 72,
    reliability: 95,
    latency: 85,
    control: 60,
    available: (ctx) => hasEnv(ctx, "GOOGLE_TTS_API_KEY"),
    costUsd: ttsCost("googleTts"),
    taskFit: () => 60,
    reasonHint: "Google Cloud TTS"
  },
  {
    id: "voxcpm",
    category: "tts",
    name: "VoxCPM2 (Local GPU)",
    quality: 70,
    reliability: 60,
    latency: 60,
    control: 70,
    available: (ctx) => hasEnv(ctx, "VOXCPM_URL"),
    costUsd: () => 0,
    taskFit: () => 55,
    reasonHint: "VoxCPM2 local GPU (free)"
  },
  {
    id: "pocket-tts",
    category: "tts",
    name: "Pocket TTS (Local)",
    quality: 60,
    reliability: 70,
    latency: 70,
    control: 55,
    available: (ctx) => hasEnv(ctx, "POCKET_TTS_URL"),
    costUsd: () => 0,
    taskFit: () => 55,
    reasonHint: "Pocket TTS local (free)"
  },
  {
    id: "openai-edge-tts",
    category: "tts",
    name: "Edge TTS (Local)",
    quality: 58,
    reliability: 75,
    latency: 78,
    control: 45,
    available: (ctx) => hasEnv(ctx, "EDGE_TTS_URL"),
    costUsd: () => 0,
    taskFit: () => 55,
    reasonHint: "Edge TTS local (free)"
  },
  {
    id: "native-tts",
    category: "tts",
    name: "System Voice",
    quality: 50,
    reliability: 95,
    latency: 95,
    control: 35,
    available: (ctx) => isPlatform(ctx, "darwin") || isPlatform(ctx, "win32"),
    costUsd: () => 0,
    taskFit: () => 40,
    reasonHint: "System voice (free, instant)"
  },
  {
    id: "puter",
    category: "tts",
    name: "Puter.js (Browser)",
    quality: 45,
    reliability: 70,
    latency: 60,
    control: 30,
    available: () => true,
    costUsd: () => 0,
    taskFit: () => 35,
    reasonHint: "Puter browser TTS (free, preview only)",
    clientOnly: true
  },
  {
    id: "web-speech",
    category: "tts",
    name: "Web Speech (Browser)",
    quality: 35,
    reliability: 60,
    latency: 95,
    control: 25,
    available: () => true,
    costUsd: () => 0,
    taskFit: () => 30,
    reasonHint: "Web Speech API (free, browser only)",
    clientOnly: true
  }
];

// lib/audio/resolve-best-tts-provider.ts
function getBestTTSProvider(settings, localMode) {
  if (settings?.defaultTTSProvider && settings.defaultTTSProvider !== "auto") {
    return settings.defaultTTSProvider;
  }
  const env = { ...process.env };
  if (settings?.pocketTTSUrl) env.POCKET_TTS_URL = settings.pocketTTSUrl;
  if (settings?.voxcpmUrl) env.VOXCPM_URL = settings.voxcpmUrl;
  if (settings?.edgeTTSUrl) env.EDGE_TTS_URL = settings.edgeTTSUrl;
  const weights = localMode ? LOCAL_MODE_WEIGHTS : DEFAULT_WEIGHTS;
  const out = selectBestProvider(
    TTS_PROFILES,
    { localMode: !!localMode, env, platform: process.platform, task: "narration" },
    weights
  );
  return out.chosen?.id ?? "web-speech";
}

// lib/three-environments/inlined-runtimes.ts
var THREE_ENVIRONMENT_RUNTIME_SCRIPT = `/**
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

  window.CENCH_THREE_ENV_IDS = [
    'track_rolling_topdown',
    'studio_white',
    'cinematic_fog',
    'iso_playful',
    'tech_grid',
    'nature_sunset',
    'data_lab',
  ];

  window.applyCenchThreeEnvironment = function (envId, scene, renderer, camera) {
    if (!scene || !renderer) return;
    clearEnv(scene);

    var root = new THREE.Group();
    root.name = '__cenchEnvRoot';
    var refs = {};
    var state = window.__cenchEnvState;
    state.refs = refs;

    if (window.CENCH_THREE_ENV_IDS.indexOf(envId) === -1) {
      console.warn('applyCenchThreeEnvironment: unknown env "' + envId + '" \u2014 falling back to studio_white');
      envId = 'studio_white';
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

      case 'studio_white': {
        scene.background = new THREE.Color(0xf7f8fa);
        renderer.setClearColor(0xf7f8fa);
        // Curved cyclorama: huge sphere open at the bottom, soft gradient
        var cycloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
        var cyclo = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55), cycloMat);
        cyclo.position.y = -0.5;
        root.add(cyclo);
        var floor = new THREE.Mesh(
          new THREE.CircleGeometry(40, 64),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        root.add(floor);
        var hemi = new THREE.HemisphereLight(0xffffff, 0xe8eef5, 0.85);
        root.add(hemi);
        var sKey = new THREE.DirectionalLight(0xffffff, 1.6);
        sKey.position.set(-6, 10, 6);
        sKey.castShadow = true;
        sKey.shadow.mapSize.set(2048, 2048);
        sKey.shadow.camera.left = -12;
        sKey.shadow.camera.right = 12;
        sKey.shadow.camera.top = 12;
        sKey.shadow.camera.bottom = -12;
        sKey.shadow.bias = -0.0005;
        root.add(sKey);
        var sFill = new THREE.DirectionalLight(0xd9e6ff, 0.45);
        sFill.position.set(8, 4, 6);
        root.add(sFill);
        state.update = function () {};
        break;
      }

      case 'cinematic_fog': {
        scene.background = new THREE.Color(0x0a0d12);
        renderer.setClearColor(0x0a0d12);
        scene.fog = new THREE.FogExp2(0x0a0d12, 0.04);
        var cfFloor = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x0e131a, roughness: 0.35, metalness: 0.25 }),
        );
        cfFloor.rotation.x = -Math.PI / 2;
        cfFloor.receiveShadow = true;
        root.add(cfFloor);
        root.add(new THREE.AmbientLight(0x222a36, 0.25));
        var cKey = new THREE.SpotLight(0xfff1d6, 4.2, 40, Math.PI / 7, 0.45, 1.2);
        cKey.position.set(-6, 14, 7);
        cKey.target.position.set(0, 0, 0);
        cKey.castShadow = true;
        cKey.shadow.mapSize.set(2048, 2048);
        cKey.shadow.bias = -0.0005;
        root.add(cKey);
        root.add(cKey.target);
        var cRim = new THREE.DirectionalLight(0x6aaeff, 0.9);
        cRim.position.set(2, 3, -8);
        root.add(cRim);
        state.update = function () {};
        break;
      }

      case 'iso_playful': {
        scene.background = new THREE.Color(0xfef3c7);
        renderer.setClearColor(0xfef3c7);
        var ipFloor = new THREE.Mesh(
          new THREE.PlaneGeometry(80, 80),
          new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 1.0, metalness: 0 }),
        );
        ipFloor.rotation.x = -Math.PI / 2;
        ipFloor.receiveShadow = true;
        root.add(ipFloor);
        var ipHemi = new THREE.HemisphereLight(0xffffff, 0xfdba74, 0.9);
        root.add(ipHemi);
        var ipKey = new THREE.DirectionalLight(0xfff3c4, 1.1);
        ipKey.position.set(-8, 12, 6);
        ipKey.castShadow = true;
        ipKey.shadow.mapSize.set(1024, 1024);
        ipKey.shadow.camera.left = -12;
        ipKey.shadow.camera.right = 12;
        ipKey.shadow.camera.top = 12;
        ipKey.shadow.camera.bottom = -12;
        ipKey.shadow.bias = -0.0008;
        root.add(ipKey);
        state.update = function () {};
        break;
      }

      case 'tech_grid': {
        scene.background = new THREE.Color(0x030712);
        renderer.setClearColor(0x030712);
        scene.fog = new THREE.FogExp2(0x030712, 0.02);
        // Shader-based grid floor (neon lines, horizon fade)
        var tgGeo = new THREE.PlaneGeometry(200, 200);
        var tgMat = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(0x22d3ee) },
            uDim:   { value: new THREE.Color(0x0b1622) },
            uFar:   { value: 80 },
          },
          vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.0); wp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
          fragmentShader: 'varying vec3 wp; uniform vec3 uColor; uniform vec3 uDim; uniform float uFar; float grid(float s){ vec2 g = abs(fract(wp.xz/s - 0.5) - 0.5)/fwidth(wp.xz/s); float l = min(g.x, g.y); return 1.0 - min(l, 1.0);} void main(){ float g1 = grid(1.0); float g2 = grid(10.0); float d = 1.0 - min(length(wp.xz)/uFar, 1.0); vec3 c = mix(uDim, uColor, max(g1*0.5, g2)); gl_FragColor = vec4(c, max(g1*0.35, g2) * pow(d, 1.4)); if(gl_FragColor.a <= 0.005) discard; }',
          transparent: true,
          side: THREE.DoubleSide,
        });
        var tgFloor = new THREE.Mesh(tgGeo, tgMat);
        tgFloor.rotation.x = -Math.PI / 2;
        tgFloor.frustumCulled = false;
        root.add(tgFloor);
        root.add(new THREE.AmbientLight(0x1a2238, 0.35));
        var tgKey = new THREE.DirectionalLight(0x22d3ee, 1.0);
        tgKey.position.set(-5, 8, 5);
        root.add(tgKey);
        var tgRim = new THREE.DirectionalLight(0xa78bfa, 1.0);
        tgRim.position.set(5, 4, -6);
        root.add(tgRim);
        // Stars
        var sgeo = new THREE.BufferGeometry();
        var sCount = 600;
        var spos = new Float32Array(sCount * 3);
        for (var si = 0; si < sCount; si++) {
          var r = 60 + det(si, 3) * 40;
          var th = det(si, 4) * Math.PI * 2;
          var ph = Math.acos(1 - 2 * det(si, 5));
          spos[si * 3] = r * Math.sin(ph) * Math.cos(th);
          spos[si * 3 + 1] = r * Math.cos(ph) * 0.5 + 8;
          spos[si * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        }
        sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
        var stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8 }));
        root.add(stars);
        state.update = function (t) {
          tgMat.uniforms.uColor.value.setHSL(0.52 + 0.03 * Math.sin(t * 0.6), 0.8, 0.55);
        };
        break;
      }

      case 'nature_sunset': {
        // Gradient sky dome
        var nsSkyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            top: { value: new THREE.Color(0x1d4ed8) },
            mid: { value: new THREE.Color(0xf97316) },
            bot: { value: new THREE.Color(0xfed7aa) },
          },
          vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.0); wp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
          fragmentShader: 'varying vec3 wp; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(wp).y; float a = smoothstep(-0.2, 0.15, h); float b = smoothstep(0.15, 0.6, h); vec3 c = mix(bot, mid, a); c = mix(c, top, b); gl_FragColor = vec4(c, 1.0); }',
        });
        var nsSky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), nsSkyMat);
        root.add(nsSky);
        scene.fog = new THREE.FogExp2(0xfed7aa, 0.015);
        var nsGround = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95, metalness: 0 }),
        );
        nsGround.rotation.x = -Math.PI / 2;
        nsGround.receiveShadow = true;
        root.add(nsGround);
        var nsHemi = new THREE.HemisphereLight(0xfed7aa, 0x3f6212, 0.7);
        root.add(nsHemi);
        var nsSun = new THREE.DirectionalLight(0xfed7aa, 2.2);
        nsSun.position.set(-12, 4, -10);
        nsSun.castShadow = true;
        nsSun.shadow.mapSize.set(2048, 2048);
        nsSun.shadow.bias = -0.0005;
        root.add(nsSun);
        state.update = function () {};
        break;
      }

      case 'data_lab': {
        scene.background = new THREE.Color(0xffffff);
        renderer.setClearColor(0xffffff);
        // Circular shadow-catcher (ShadowMaterial: transparent, receives shadows only)
        var dlShadow = new THREE.Mesh(
          new THREE.CircleGeometry(12, 64),
          new THREE.ShadowMaterial({ opacity: 0.18 }),
        );
        dlShadow.rotation.x = -Math.PI / 2;
        dlShadow.receiveShadow = true;
        root.add(dlShadow);
        root.add(new THREE.HemisphereLight(0xffffff, 0xf1f5f9, 0.7));
        var dlKey = new THREE.DirectionalLight(0xffffff, 1.5);
        dlKey.position.set(-4, 10, 5);
        dlKey.castShadow = true;
        dlKey.shadow.mapSize.set(1024, 1024);
        dlKey.shadow.camera.left = -10;
        dlKey.shadow.camera.right = 10;
        dlKey.shadow.camera.top = 10;
        dlKey.shadow.camera.bottom = -10;
        dlKey.shadow.bias = -0.0005;
        root.add(dlKey);
        state.update = function () {};
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
`;
var THREE_SCATTER_RUNTIME_SCRIPT = `/**
 * 3D data scatter \u2014 vanilla Three.js helper inspired by the CorticoAI 3d-react-demo
 * (React + react-three-fiber scatterplot style). Original demo: MIT License \u2014
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
`;
var THREE_HELPERS_RUNTIME_SCRIPT = `/* Cench three-helpers cookbook */
(function initCenchThreeHelpers() {
  var THREE = window.THREE;
  if (!THREE) return;

  // \u2500\u2500 Tone-map presets (r183 supports aces, cineon, reinhard, linear, agx, neutral) \u2500\u2500
  window.CENCH_TONE_MAPS = {
    aces:     THREE.ACESFilmicToneMapping,
    cineon:   THREE.CineonToneMapping,
    reinhard: THREE.ReinhardToneMapping,
    linear:   THREE.LinearToneMapping,
    agx:      typeof THREE.AgXToneMapping !== 'undefined' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping,
    neutral:  typeof THREE.NeutralToneMapping !== 'undefined' ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping,
    none:     THREE.NoToneMapping,
  };

  // \u2500\u2500 Custom shader passes (inline GLSL, small and cheap) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function makeChromaticAberrationPass(amount) {
    return new ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: amount != null ? amount : 0.0035 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; void main(){ vec2 o = (vUv - 0.5) * amount; float r = texture2D(tDiffuse, vUv + o).r; float g = texture2D(tDiffuse, vUv).g; float b = texture2D(tDiffuse, vUv - o).b; float a = texture2D(tDiffuse, vUv).a; gl_FragColor = vec4(r, g, b, a); }',
    });
  }
  function makeColorGradePass(opts) {
    opts = opts || {};
    return new ShaderPass({
      uniforms: {
        tDiffuse:   { value: null },
        exposure:   { value: opts.exposure != null ? opts.exposure : 1.0 },
        contrast:   { value: opts.contrast != null ? opts.contrast : 1.0 },
        saturation: { value: opts.saturation != null ? opts.saturation : 1.0 },
        brightness: { value: opts.brightness != null ? opts.brightness : 0.0 },
        tint:       { value: new THREE.Color(opts.tint || 0xffffff) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float exposure; uniform float contrast; uniform float saturation; uniform float brightness; uniform vec3 tint; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb *= exposure; c.rgb += brightness; c.rgb *= tint; c.rgb = (c.rgb - 0.5) * contrast + 0.5; float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, saturation); gl_FragColor = c; }',
    });
  }
  function makePixelatePass(pixelSize) {
    var ps = pixelSize != null ? pixelSize : 4.0;
    return new ShaderPass({
      uniforms: {
        tDiffuse:  { value: null },
        pixelSize: { value: ps },
        resolution: { value: new THREE.Vector2(window.WIDTH || 1920, window.HEIGHT || 1080) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float pixelSize; uniform vec2 resolution; varying vec2 vUv; void main(){ vec2 grid = resolution / pixelSize; vec2 uv = floor(vUv * grid) / grid; gl_FragColor = texture2D(tDiffuse, uv); }',
    });
  }
  function makeScanlinePass(intensity, density) {
    return new ShaderPass({
      uniforms: {
        tDiffuse:  { value: null },
        intensity: { value: intensity != null ? intensity : 0.25 },
        density:   { value: density != null ? density : 1.8 },
        resolution: { value: new THREE.Vector2(window.WIDTH || 1920, window.HEIGHT || 1080) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float intensity; uniform float density; uniform vec2 resolution; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float s = sin(vUv.y * resolution.y * density * 3.14159) * 0.5 + 0.5; c.rgb *= 1.0 - intensity * (1.0 - s); gl_FragColor = c; }',
    });
  }

  // \u2500\u2500 createCenchPostFX: one-call, opinionated composer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // opts keys: bloom, ssao, outline, dof, filmGrain, chromaticAberration,
  //            colorGrade, pixelate, scanlines, afterimage  \u2014 each can be
  //            false, true, or a config object. Returns { composer, render,
  //            passes, dispose }.
  window.createCenchPostFX = function (renderer, scene, camera, opts) {
    opts = opts || {};
    try {
      var composer = new EffectComposer(renderer);
      composer.setSize(window.WIDTH || 1920, window.HEIGHT || 1080);
      var passes = {};
      composer.addPass(new RenderPass(scene, camera));

      if (opts.ssao) {
        var ss = typeof opts.ssao === 'object' ? opts.ssao : {};
        var ssao = new SSAOPass(scene, camera, window.WIDTH || 1920, window.HEIGHT || 1080);
        if (ss.kernelRadius != null) ssao.kernelRadius = ss.kernelRadius;
        if (ss.minDistance != null) ssao.minDistance = ss.minDistance;
        if (ss.maxDistance != null) ssao.maxDistance = ss.maxDistance;
        composer.addPass(ssao); passes.ssao = ssao;
      }

      if (opts.bloom) {
        var b = typeof opts.bloom === 'object' ? opts.bloom : {};
        var bp = new UnrealBloomPass(
          new THREE.Vector2(window.WIDTH || 1920, window.HEIGHT || 1080),
          b.strength != null ? b.strength : 0.4,
          b.radius != null ? b.radius : 0.4,
          b.threshold != null ? b.threshold : 0.85,
        );
        composer.addPass(bp); passes.bloom = bp;
      }

      if (opts.dof) {
        var d = typeof opts.dof === 'object' ? opts.dof : {};
        var bokeh = new BokehPass(scene, camera, {
          focus: d.focus != null ? d.focus : 10,
          aperture: d.aperture != null ? d.aperture : 0.002,
          maxblur: d.maxblur != null ? d.maxblur : 0.01,
        });
        composer.addPass(bokeh); passes.dof = bokeh;
      }

      if (opts.outline && typeof OutlinePass !== 'undefined') {
        var o = typeof opts.outline === 'object' ? opts.outline : {};
        var out = new OutlinePass(
          new THREE.Vector2(window.WIDTH || 1920, window.HEIGHT || 1080),
          scene, camera,
        );
        out.edgeStrength = o.edgeStrength != null ? o.edgeStrength : 3.0;
        out.edgeGlow = o.edgeGlow != null ? o.edgeGlow : 0.5;
        out.edgeThickness = o.edgeThickness != null ? o.edgeThickness : 1.0;
        if (o.visibleEdgeColor) out.visibleEdgeColor.set(o.visibleEdgeColor);
        if (o.hiddenEdgeColor) out.hiddenEdgeColor.set(o.hiddenEdgeColor);
        if (Array.isArray(o.selectedObjects)) out.selectedObjects = o.selectedObjects;
        composer.addPass(out); passes.outline = out;
      }

      if (opts.afterimage && typeof AfterimagePass !== 'undefined') {
        var ai = typeof opts.afterimage === 'object' ? opts.afterimage : {};
        var after = new AfterimagePass(ai.damp != null ? ai.damp : 0.92);
        composer.addPass(after); passes.afterimage = after;
      }

      if (opts.chromaticAberration) {
        var ca = typeof opts.chromaticAberration === 'object' ? opts.chromaticAberration : {};
        var cap = makeChromaticAberrationPass(ca.amount);
        composer.addPass(cap); passes.chromaticAberration = cap;
      }

      if (opts.colorGrade) {
        var cg = typeof opts.colorGrade === 'object' ? opts.colorGrade : {};
        var cgp = makeColorGradePass(cg);
        composer.addPass(cgp); passes.colorGrade = cgp;
      }

      if (opts.pixelate) {
        var pz = typeof opts.pixelate === 'object' ? opts.pixelate : {};
        var pzp = makePixelatePass(pz.pixelSize);
        composer.addPass(pzp); passes.pixelate = pzp;
      }

      if (opts.scanlines) {
        var sc = typeof opts.scanlines === 'object' ? opts.scanlines : {};
        var scp = makeScanlinePass(sc.intensity, sc.density);
        composer.addPass(scp); passes.scanlines = scp;
      }

      if (opts.filmGrain && typeof FilmPass !== 'undefined') {
        var f = typeof opts.filmGrain === 'object' ? opts.filmGrain : {};
        var fp = new FilmPass(
          f.intensity != null ? f.intensity : 0.35,
          f.grayscale ? 1 : 0,
        );
        composer.addPass(fp); passes.filmGrain = fp;
      }

      if (opts.glitch && typeof GlitchPass !== 'undefined') {
        var g = typeof opts.glitch === 'object' ? opts.glitch : {};
        var gp = new GlitchPass();
        if (g.goWild) gp.goWild = true;
        composer.addPass(gp); passes.glitch = gp;
      }

      composer.addPass(new OutputPass());

      return {
        composer: composer,
        passes: passes,
        render: function () { composer.render(); },
        dispose: function () { composer.passes.forEach(function (p) { if (p.dispose) p.dispose(); }); },
      };
    } catch (e) {
      console.warn('createCenchPostFX failed, falling back to direct render:', e);
      return { render: function () { renderer.render(scene, camera); }, passes: {} };
    }
  };

  // \u2500\u2500 Named presets for createCenchPostFX \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.CENCH_POSTFX_PRESETS = {
    bloom:     { bloom: { strength: 0.6, radius: 0.5, threshold: 0.8 } },
    cinematic: { bloom: { strength: 0.35, radius: 0.45, threshold: 0.85 }, dof: { focus: 10, aperture: 0.0018, maxblur: 0.012 }, colorGrade: { exposure: 1.05, contrast: 1.08, saturation: 1.05 } },
    cyberpunk: { bloom: { strength: 1.1, radius: 0.8, threshold: 0.55 }, chromaticAberration: { amount: 0.006 }, scanlines: { intensity: 0.22, density: 1.6 }, colorGrade: { saturation: 1.25, contrast: 1.1, tint: 0xffccff } },
    vintage:   { filmGrain: { intensity: 0.45 }, colorGrade: { exposure: 0.95, contrast: 1.08, saturation: 0.75, tint: 0xffe8bf }, chromaticAberration: { amount: 0.002 } },
    dream:     { bloom: { strength: 0.85, radius: 0.9, threshold: 0.4 }, dof: { focus: 8, aperture: 0.003, maxblur: 0.02 }, colorGrade: { exposure: 1.1, saturation: 0.9, brightness: 0.04 } },
    matrix:    { bloom: { strength: 0.65, radius: 0.6, threshold: 0.7 }, scanlines: { intensity: 0.2 }, colorGrade: { tint: 0xa7f3d0, saturation: 1.3, contrast: 1.15 } },
    retroPixel:{ pixelate: { pixelSize: 6 }, colorGrade: { saturation: 1.2, contrast: 1.05 } },
    ghibli:    { bloom: { strength: 0.45, radius: 0.7, threshold: 0.75 }, colorGrade: { exposure: 1.05, saturation: 1.12, tint: 0xfff4d6 } },
    noir:      { filmGrain: { intensity: 0.45, grayscale: true }, colorGrade: { saturation: 0.05, contrast: 1.25 }, bloom: { strength: 0.2, radius: 0.3, threshold: 0.9 } },
    sharpCorporate: { ssao: { kernelRadius: 6, minDistance: 0.003, maxDistance: 0.08 }, colorGrade: { contrast: 1.04, exposure: 1.02 } },
  };

  window.createCenchPostFXPreset = function (renderer, scene, camera, presetName, overrides) {
    var base = window.CENCH_POSTFX_PRESETS[presetName];
    if (!base) {
      console.warn('createCenchPostFXPreset: unknown preset "' + presetName + '"');
      base = window.CENCH_POSTFX_PRESETS.bloom;
    }
    var merged = Object.assign({}, base, overrides || {});
    return window.createCenchPostFX(renderer, scene, camera, merged);
  };

  // \u2500\u2500 addCinematicLighting: tuned 3-point (or 4-point) rig by style \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.addCinematicLighting = function (scene, style, opts) {
    style = style || 'corporate';
    opts = opts || {};
    var group = new THREE.Group();
    group.name = '__cenchLightingRig';
    var cfgs = {
      corporate: { amb: [0xffffff, 0.4], key: [0xfff6e0, 1.5, [-5,8,5]],  fill: [0xd0e8ff, 0.5, [6,2,4]],  rim: [0xffe0d0, 0.7, [0,4,-9]] },
      dramatic:  { amb: [0x222233, 0.2], key: [0xffefd5, 2.8, [-6,10,6]], fill: [0x3355aa, 0.25, [8,2,4]], rim: [0xff7a40, 1.4, [2,3,-10]] },
      playful:   { amb: [0xfff0c4, 0.55], key: [0xffd6a5, 1.4, [-5,10,4]], fill: [0xbae6fd, 0.65, [7,3,5]], rim: [0xfca5a5, 0.6, [0,5,-8]] },
      product:   { amb: [0xffffff, 0.3], key: [0xffffff, 1.6, [-5,9,5]],  fill: [0xffffff, 0.7, [6,3,4]],  rim: [0xffffff, 1.0, [0,5,-8]] },
      cyberpunk: { amb: [0x1a1a2e, 0.25], key: [0x22d3ee, 1.5, [-6,6,6]], fill: [0xa78bfa, 1.0, [6,3,4]],  rim: [0xf472b6, 1.4, [0,4,-9]] },
      nature:    { amb: [0xe6edf5, 0.5], key: [0xfed7aa, 1.8, [-8,8,-4]], fill: [0xbae6fd, 0.5, [7,4,5]],  rim: [0xfcd34d, 0.65, [-2,2,-9]] },
      softbox:   { amb: [0xffffff, 0.6], key: [0xffffff, 0.85, [-4,6,5]], fill: [0xffffff, 0.75, [5,3,4]], rim: [0xffffff, 0.5, [0,3,-8]] },
    };
    var c = cfgs[style] || cfgs.corporate;
    var amb = new THREE.AmbientLight(c.amb[0], c.amb[1]);
    group.add(amb);
    function dir(cfg, cast) {
      var l = new THREE.DirectionalLight(cfg[0], cfg[1]);
      l.position.set(cfg[2][0], cfg[2][1], cfg[2][2]);
      if (cast) {
        l.castShadow = true;
        l.shadow.mapSize.set(2048, 2048);
        l.shadow.camera.left = -12; l.shadow.camera.right = 12;
        l.shadow.camera.top = 12; l.shadow.camera.bottom = -12;
        l.shadow.bias = -0.0005;
      }
      return l;
    }
    var key = dir(c.key, opts.shadows !== false);
    var fill = dir(c.fill, false);
    var rim = dir(c.rim, false);
    group.add(key); group.add(fill); group.add(rim);
    if (opts.hemisphere) {
      var h = new THREE.HemisphereLight(opts.hemisphere[0] || 0xffffff, opts.hemisphere[1] || 0x202030, opts.hemisphere[2] != null ? opts.hemisphere[2] : 0.4);
      group.add(h);
    }
    group.__refs = { ambient: amb, key: key, fill: fill, rim: rim };
    scene.add(group);
    return group;
  };

  // \u2500\u2500 addGroundPlane: shadow-catcher, infinite, circle-fade, or grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.addGroundPlane = function (scene, opts) {
    opts = opts || {};
    var mode = opts.mode || 'infinite';
    var y = opts.y != null ? opts.y : 0;
    var color = opts.color || 0xf3f4f6;
    var mesh;
    if (mode === 'shadow') {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(opts.size || 200, opts.size || 200),
        new THREE.ShadowMaterial({ opacity: opts.opacity != null ? opts.opacity : 0.25 }),
      );
    } else if (mode === 'circle') {
      mesh = new THREE.Mesh(
        new THREE.CircleGeometry(opts.radius || 20, 64),
        new THREE.MeshStandardMaterial({ color: color, roughness: opts.roughness != null ? opts.roughness : 0.9, metalness: opts.metalness != null ? opts.metalness : 0 }),
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(opts.size || 200, opts.size || 200),
        new THREE.MeshStandardMaterial({ color: color, roughness: opts.roughness != null ? opts.roughness : 0.9, metalness: opts.metalness != null ? opts.metalness : 0 }),
      );
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = opts.receiveShadow !== false;
    scene.add(mesh);
    return mesh;
  };

  // \u2500\u2500 loadPBRSet: diffuse+normal+roughness+metalness+ao \u2192 MeshStandardMaterial
  window.loadPBRSet = function (urlPrefix, opts) {
    opts = opts || {};
    var loader = new THREE.TextureLoader();
    function tex(suffix, colorSpace, repeat) {
      var t = loader.load(urlPrefix + '_' + suffix + '.' + (opts.ext || 'jpg'));
      if (colorSpace) t.colorSpace = colorSpace;
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
      if (repeat) t.repeat.set(repeat, repeat);
      return t;
    }
    var r = opts.repeat != null ? opts.repeat : 1;
    var MatCtor = opts.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    var mat = new MatCtor({
      map: tex('diffuse', THREE.SRGBColorSpace, r),
      normalMap: tex('normal', null, r),
      roughnessMap: tex('roughness', null, r),
      metalnessMap: tex('metalness', null, r),
      aoMap: tex('ao', null, r),
      roughness: opts.roughness != null ? opts.roughness : 1.0,
      metalness: opts.metalness != null ? opts.metalness : 1.0,
    });
    if (opts.clearcoat != null && opts.physical) mat.clearcoat = opts.clearcoat;
    if (opts.transmission != null && opts.physical) mat.transmission = opts.transmission;
    if (opts.normalScale) mat.normalScale.set(opts.normalScale, opts.normalScale);
    return mat;
  };

  // \u2500\u2500 loadHDREnvironment: equirect HDR \u2192 scene.environment via PMREM \u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.loadHDREnvironment = function (url, scene, renderer, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (typeof RGBELoader === 'undefined') {
        console.warn('loadHDREnvironment: RGBELoader not available; using synthetic fallback');
        if (typeof window.setupEnvironment === 'function') window.setupEnvironment(scene, renderer);
        return resolve(null);
      }
      new RGBELoader().load(url, function (hdr) {
        try {
          var pmrem = new THREE.PMREMGenerator(renderer);
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          var envMap = pmrem.fromEquirectangular(hdr).texture;
          scene.environment = envMap;
          if (opts.background) scene.background = envMap;
          hdr.dispose();
          pmrem.dispose();
          resolve(envMap);
        } catch (e) {
          reject(e);
        }
      }, undefined, reject);
    });
  };

  // \u2500\u2500 createInstancedField: layouts = grid | circle | sphere | jitter \u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.createInstancedField = function (opts) {
    opts = opts || {};
    var geometry = opts.geometry || new THREE.SphereGeometry(0.25, 16, 12);
    var material = opts.material || new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.1 });
    var count = opts.count || 64;
    var seed = opts.seed || 42;
    var rng = window.mulberry32 ? window.mulberry32(seed) : Math.random;
    var layout = opts.layout || 'grid';
    var mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = !!opts.receiveShadow;
    var dummy = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      switch (layout) {
        case 'grid': {
          var side = Math.ceil(Math.sqrt(count));
          var sp = opts.spacing || 1.4;
          var gx = (i % side) - (side - 1) / 2;
          var gz = Math.floor(i / side) - (side - 1) / 2;
          dummy.position.set(gx * sp, 0, gz * sp);
          break;
        }
        case 'circle': {
          var rad = opts.radius || 5;
          var th = (i / count) * Math.PI * 2;
          dummy.position.set(Math.cos(th) * rad, 0, Math.sin(th) * rad);
          break;
        }
        case 'sphere': {
          var rs = opts.radius || 5;
          var phi = Math.acos(1 - 2 * (i + 0.5) / count);
          var th2 = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
          dummy.position.set(
            rs * Math.sin(phi) * Math.cos(th2),
            rs * Math.cos(phi),
            rs * Math.sin(phi) * Math.sin(th2),
          );
          break;
        }
        case 'jitter': {
          var bx = opts.box || [10, 10, 10];
          if (typeof bx === 'number') bx = [bx, bx, bx];
          dummy.position.set((rng() - 0.5) * bx[0], (rng() - 0.5) * bx[1], (rng() - 0.5) * bx[2]);
          break;
        }
      }
      if (opts.randomRotation) dummy.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
      if (opts.randomScale) {
        var sr = opts.scaleRange || [0.75, 1.25];
        dummy.scale.setScalar(sr[0] + rng() * (sr[1] - sr[0]));
      }
      if (typeof opts.transform === 'function') opts.transform(dummy, i, rng);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (typeof opts.color === 'function' && mesh.setColorAt) {
        var col = opts.color(i, rng);
        if (col) mesh.setColorAt(i, col instanceof THREE.Color ? col : new THREE.Color(col));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  };

  // \u2500\u2500 createPositionalAudio: AudioListener on camera + PositionalAudio \u2500\u2500\u2500\u2500\u2500\u2500
  window.createPositionalAudio = function (camera, url, opts) {
    opts = opts || {};
    if (!camera) return null;
    if (!camera.__cenchAudioListener) {
      camera.__cenchAudioListener = new THREE.AudioListener();
      camera.add(camera.__cenchAudioListener);
    }
    var audio = new THREE.PositionalAudio(camera.__cenchAudioListener);
    var loader = new THREE.AudioLoader();
    loader.load(url, function (buf) {
      audio.setBuffer(buf);
      audio.setRefDistance(opts.refDistance != null ? opts.refDistance : 1);
      audio.setRolloffFactor(opts.rolloffFactor != null ? opts.rolloffFactor : 1);
      audio.setVolume(opts.volume != null ? opts.volume : 0.5);
      audio.setLoop(opts.loop !== false);
      if (opts.autoplay !== false) {
        try { audio.play(); } catch (e) { /* autoplay blocked \u2014 caller should trigger on user gesture */ }
      }
    });
    return audio;
  };
})();
`;

// lib/canvas-renderer/inlined.ts
var CANVAS_RENDERER_CODE = `
// \u2500\u2500 Cench Studio Canvas2D Drawing Engine \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Auto-injected by the scene template. All functions are global.

// \u2500\u2500 Drawing Tool Configurations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

var DRAWING_TOOLS = {
  marker: {
    id: 'marker',
    name: 'Marker',
    description: 'Broad, consistent strokes with slight wobble. Bold and readable.',
    roughness: 0.6,
    bowing: 0.4,
    defaultWidth: 6,
    pressureProfile: { peakAt: 0.35, minWidth: 0.55, sharpness: 1.8 },
    alphaJitter: 0.04,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 1,
    lineDash: [],
    lineCap: 'round',
  },
  pen: {
    id: 'pen',
    name: 'Pen',
    description: 'Fine, precise strokes with natural hand-drawn character.',
    roughness: 0.4,
    bowing: 0.25,
    defaultWidth: 2.5,
    pressureProfile: { peakAt: 0.4, minWidth: 0.25, sharpness: 2.5 },
    alphaJitter: 0.02,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 2,
    lineDash: [],
    lineCap: 'round',
  },
  chalk: {
    id: 'chalk',
    name: 'Chalk',
    description: 'Rough, textured strokes with grain \u2014 perfect for chalkboard scenes.',
    roughness: 1.8,
    bowing: 0.6,
    defaultWidth: 8,
    pressureProfile: { peakAt: 0.5, minWidth: 0.3, sharpness: 1.4 },
    alphaJitter: 0.18,
    textureStyle: 'chalk',
    textureIntensity: 0.6,
    smoothIterations: 0,
    lineDash: [],
    lineCap: 'round',
  },
  brush: {
    id: 'brush',
    name: 'Brush',
    description: 'Wide, tapered brush strokes with strong pressure variation.',
    roughness: 0.9,
    bowing: 0.5,
    defaultWidth: 14,
    pressureProfile: { peakAt: 0.3, minWidth: 0.08, sharpness: 3.2 },
    alphaJitter: 0.08,
    textureStyle: 'grain',
    textureIntensity: 0.3,
    smoothIterations: 3,
    lineDash: [],
    lineCap: 'round',
  },
  highlighter: {
    id: 'highlighter',
    name: 'Highlighter',
    description: 'Broad, semi-transparent strokes for emphasis.',
    roughness: 0.3,
    bowing: 0.15,
    defaultWidth: 18,
    pressureProfile: { peakAt: 0.5, minWidth: 0.7, sharpness: 1.2 },
    alphaJitter: 0.03,
    textureStyle: 'none',
    textureIntensity: 0,
    smoothIterations: 2,
    lineDash: [],
    lineCap: 'square',
  },
};

// \u2500\u2500 Seeded PRNG \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// \u2500\u2500 Pressure Curve \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function strokePressure(t, opts) {
  opts = opts || {};
  var peakAt = opts.peakAt !== undefined ? opts.peakAt : 0.4;
  var minWidth = opts.minWidth !== undefined ? opts.minWidth : 0.25;
  var sharpness = opts.sharpness !== undefined ? opts.sharpness : 2.5;

  var distFromPeak = Math.abs(t - peakAt);
  var maxDist = Math.max(peakAt, 1 - peakAt);
  var normalized = Math.min(distFromPeak / maxDist, 1);
  var pressure = 1 - (1 - minWidth) * Math.pow(normalized, sharpness);
  return Math.max(minWidth, Math.min(1, pressure));
}

// \u2500\u2500 Alpha Jitter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function jitteredAlpha(baseAlpha, t, rand, intensity) {
  if (intensity <= 0) return baseAlpha;
  var jitter = (rand() - 0.5) * 2 * intensity;
  return Math.max(0.1, Math.min(1, baseAlpha + jitter));
}

// \u2500\u2500 Pressure-Sensitive Stroke \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function drawSegmentWithPressure(ctx, points, baseWidth, color, pressureOpts, rand, alphaJitter) {
  if (points.length < 2) return;
  pressureOpts = pressureOpts || {};
  alphaJitter = alphaJitter || 0;

  var total = points.length - 1;

  for (var i = 0; i < total; i++) {
    var t = i / Math.max(total - 1, 1);
    var tNext = (i + 1) / Math.max(total - 1, 1);

    var widthMid = strokePressure((t + tNext) / 2, pressureOpts) * baseWidth;
    var alpha = jitteredAlpha(1, t, rand, alphaJitter);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = widthMid;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[i][0], points[i][1]);
    ctx.lineTo(points[i + 1][0], points[i + 1][1]);
    ctx.stroke();
    ctx.restore();
  }
}

// \u2500\u2500 Path Smoothing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function chaikinSmooth(points, iterations, ratio, closed) {
  if (iterations === undefined) iterations = 2;
  if (ratio === undefined) ratio = 0.25;
  if (closed === undefined) closed = false;

  if (points.length < 3 || iterations <= 0) return points;

  var pts = points.slice();

  for (var iter = 0; iter < iterations; iter++) {
    var newPts = [];
    var len = closed ? pts.length : pts.length - 1;

    if (!closed) {
      newPts.push(pts[0]);
    }

    for (var i = 0; i < len; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % pts.length];

      var q = [
        a[0] + ratio * (b[0] - a[0]),
        a[1] + ratio * (b[1] - a[1]),
      ];
      var r = [
        b[0] - ratio * (b[0] - a[0]),
        b[1] - ratio * (b[1] - a[1]),
      ];

      newPts.push(q, r);
    }

    if (!closed) {
      newPts.push(pts[pts.length - 1]);
    }

    pts = newPts;
  }

  return pts;
}

// \u2500\u2500 Tool Resolution \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function applyTool(opts) {
  opts = opts || {};
  var toolId = opts.tool || 'pen';
  var toolConfig = DRAWING_TOOLS[toolId] || DRAWING_TOOLS['pen'];

  return {
    color: opts.color || '#000000',
    width: opts.width !== undefined ? opts.width : toolConfig.defaultWidth,
    roughness: opts.roughness !== undefined ? opts.roughness : toolConfig.roughness,
    bowing: opts.bowing !== undefined ? opts.bowing : (toolConfig.bowing || 0.4),
    seed: opts.seed !== undefined ? opts.seed : 42,
    fill: opts.fill !== undefined ? opts.fill : null,
    fillAlpha: opts.fillAlpha !== undefined ? opts.fillAlpha : 0.15,
    tool: toolId,
    pressureOpts: opts.pressureOpts || toolConfig.pressureProfile,
    alphaJitter: opts.alphaJitter !== undefined ? opts.alphaJitter : (toolConfig.alphaJitter || 0),
    smooth: opts.smooth !== undefined ? opts.smooth : (toolConfig.smoothIterations > 0),
    smoothIterations: opts.smoothIterations !== undefined ? opts.smoothIterations : toolConfig.smoothIterations,
    lineDash: opts.lineDash || (toolConfig.lineDash || []),
    lineCap: opts.lineCap || (toolConfig.lineCap || 'round'),
    toolConfig: toolConfig,
  };
}

// \u2500\u2500 Texture Cache \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

var _textureCache = {};

function generateTextureCanvas(width, height, seed, opts) {
  var style = opts.style || 'none';
  if (style === 'none') return null;

  var intensity = opts.intensity !== undefined ? opts.intensity : 0.3;
  var rand = mulberry32(seed);

  var offscreen;
  try {
    offscreen = new OffscreenCanvas(width, height);
  } catch (e) {
    offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
  }

  var octx = offscreen.getContext('2d');
  var imageData = octx.createImageData(width, height);
  var data = imageData.data;

  for (var i = 0; i < data.length; i += 4) {
    var noiseVal = 0;

    if (style === 'grain') {
      noiseVal = rand() * intensity;
    } else if (style === 'paper') {
      var coarse = rand() * 0.6;
      var fine = rand() * 0.4;
      noiseVal = (coarse + fine) * intensity * 0.5;
    } else if (style === 'chalk') {
      var v = rand();
      noiseVal = v < 0.12 ? v * intensity * 2 : 0;
    }

    var luminance = Math.floor(noiseVal * 255);
    data[i] = luminance;
    data[i + 1] = luminance;
    data[i + 2] = luminance;
    data[i + 3] = Math.floor(intensity * 60);
  }

  octx.putImageData(imageData, 0, 0);
  return offscreen;
}

function applyTextureOverlay(targetCanvas, textureStyle, seed) {
  if (textureStyle === 'none') return;

  var key = textureStyle + ':' + seed + ':' + targetCanvas.width + ':' + targetCanvas.height;

  var texture;
  if (_textureCache[key]) {
    texture = _textureCache[key];
  } else {
    var toolEntry = DRAWING_TOOLS[textureStyle];
    var intensity = toolEntry ? toolEntry.textureIntensity : 0.3;
    texture = generateTextureCanvas(targetCanvas.width, targetCanvas.height, seed, {
      style: textureStyle,
      intensity: intensity,
    });
    _textureCache[key] = texture;
  }

  if (!texture) return;

  var ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(texture, 0, 0);
  ctx.restore();
}

// \u2500\u2500 Internal: Hand-drawn Point Generation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function _wobbleLine(x1, y1, x2, y2, roughness, bowing, numPoints, rand) {
  var pts = [];
  var dx = x2 - x1;
  var dy = y2 - y1;
  var len = Math.sqrt(dx * dx + dy * dy);

  var perpX = -dy / len;
  var perpY = dx / len;

  var bowAmount = bowing * len * 0.06;

  for (var i = 0; i <= numPoints; i++) {
    var t = i / numPoints;
    var bx = x1 + t * dx;
    var by = y1 + t * dy;

    var bowFactor = 4 * t * (1 - t) * bowAmount;
    var wobbleMag = roughness * Math.max(1, len * 0.008);
    var wx = (rand() - 0.5) * 2 * wobbleMag;
    var wy = (rand() - 0.5) * 2 * wobbleMag;

    pts.push([
      bx + perpX * bowFactor + wx,
      by + perpY * bowFactor + wy,
    ]);
  }

  return pts;
}

function _wobbleCircle(cx, cy, radius, roughness, numPoints, rand) {
  var pts = [];
  for (var i = 0; i <= numPoints; i++) {
    var angle = (i / numPoints) * Math.PI * 2;
    var wobbleMag = roughness * Math.max(1, radius * 0.04);
    var r = radius + (rand() - 0.5) * 2 * wobbleMag;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return pts;
}

// \u2500\u2500 Internal: Animated Point Rendering \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function _animatePoints(ctx, allPoints, baseWidth, color, pressureOpts, rand, alphaJitter, duration, lineDash, lineCap) {
  lineDash = lineDash || [];
  lineCap = lineCap || 'round';

  return new Promise(function (resolve) {
    var total = allPoints.length;
    if (total < 2) { resolve(); return; }

    var startTime = performance.now();
    var drawnUpTo = 0;

    function frame() {
      var elapsed = performance.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var targetIndex = Math.floor(progress * (total - 1)) + 1;

      if (targetIndex > drawnUpTo) {
        var segStart = Math.max(0, drawnUpTo - 1);
        var segPoints = allPoints.slice(segStart, targetIndex + 1);

        ctx.save();
        ctx.setLineDash(lineDash);
        ctx.lineCap = lineCap;

        for (var i = 0; i < segPoints.length - 1; i++) {
          var globalT = (segStart + i) / Math.max(total - 2, 1);
          var globalTNext = (segStart + i + 1) / Math.max(total - 2, 1);
          var widthMid = strokePressure((globalT + globalTNext) / 2, pressureOpts) * baseWidth;
          var alpha = jitteredAlpha(1, globalT, rand, alphaJitter);

          ctx.globalAlpha = alpha;
          ctx.lineWidth = widthMid;
          ctx.strokeStyle = color;
          ctx.lineCap = lineCap;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(segPoints[i][0], segPoints[i][1]);
          ctx.lineTo(segPoints[i + 1][0], segPoints[i + 1][1]);
          ctx.stroke();
        }

        ctx.restore();
        drawnUpTo = targetIndex;
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// \u2500\u2500 Simple Delay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// \u2500\u2500 Drawing Primitives \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function animateRoughLine(ctx, x1, y1, x2, y2, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 600;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);
  var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  var numPoints = Math.max(8, Math.floor(len / 6));

  var points = _wobbleLine(x1, y1, x2, y2, resolved.roughness, resolved.toolConfig.bowing, numPoints, rand);

  if (resolved.smooth && resolved.smoothIterations > 0) {
    points = chaikinSmooth(points, resolved.smoothIterations);
  }

  return _animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  );
}

function animateRoughCircle(ctx, cx, cy, diameter, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 800;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);
  var radius = diameter / 2;
  var numPoints = Math.max(32, Math.floor(radius * 0.5));

  var points = _wobbleCircle(cx, cy, radius, resolved.roughness, numPoints, rand);

  if (resolved.smooth && resolved.smoothIterations > 0) {
    points = chaikinSmooth(points, resolved.smoothIterations, 0.25, true);
  }

  if (resolved.fill) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = resolved.fill;
    ctx.globalAlpha = resolved.fillAlpha;
    ctx.fill();
    ctx.restore();
  }

  return _animatePoints(
    ctx, points, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  );
}

function animateRoughRect(ctx, x, y, w, h, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 700;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);

  var corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];

  var allPoints = [];
  var edgeSeed = mulberry32(resolved.seed + 1);

  for (var i = 0; i < corners.length - 1; i++) {
    var ax = corners[i][0], ay = corners[i][1];
    var bx = corners[i + 1][0], by = corners[i + 1][1];
    var edgeLen = Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
    var numPoints = Math.max(4, Math.floor(edgeLen / 8));

    var edgePoints = _wobbleLine(ax, ay, bx, by, resolved.roughness, resolved.toolConfig.bowing * 0.4, numPoints, edgeSeed);

    if (allPoints.length > 0) {
      allPoints = allPoints.concat(edgePoints.slice(1));
    } else {
      allPoints = edgePoints;
    }
  }

  if (resolved.smooth && resolved.smoothIterations > 0) {
    allPoints = chaikinSmooth(allPoints, Math.max(1, resolved.smoothIterations - 1));
  }

  if (resolved.fill) {
    ctx.save();
    ctx.fillStyle = resolved.fill;
    ctx.globalAlpha = resolved.fillAlpha;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  return _animatePoints(
    ctx, allPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  );
}

function animateRoughPolygon(ctx, points, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 900;

  if (points.length < 3) return Promise.resolve();

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);

  var closed = points.concat([points[0]]);
  var allPoints = [];
  var edgeSeed = mulberry32(resolved.seed + 7);

  for (var i = 0; i < closed.length - 1; i++) {
    var ax = closed[i][0], ay = closed[i][1];
    var bx = closed[i + 1][0], by = closed[i + 1][1];
    var edgeLen = Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
    var numPts = Math.max(3, Math.floor(edgeLen / 8));

    var edgePoints = _wobbleLine(ax, ay, bx, by, resolved.roughness, resolved.toolConfig.bowing * 0.3, numPts, edgeSeed);

    if (allPoints.length > 0) {
      allPoints = allPoints.concat(edgePoints.slice(1));
    } else {
      allPoints = edgePoints;
    }
  }

  if (resolved.smooth && resolved.smoothIterations > 0) {
    allPoints = chaikinSmooth(allPoints, resolved.smoothIterations, 0.25, true);
  }

  if (resolved.fill) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j][0], points[j][1]);
    }
    ctx.closePath();
    ctx.fillStyle = resolved.fill;
    ctx.globalAlpha = resolved.fillAlpha;
    ctx.fill();
    ctx.restore();
  }

  return _animatePoints(
    ctx, allPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  );
}

function animateRoughCurve(ctx, points, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 700;

  if (points.length < 2) return Promise.resolve();

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);

  var iterations = Math.max(2, resolved.smoothIterations + 1);
  var smoothed = chaikinSmooth(points, iterations);

  var wobbled = smoothed.map(function (p) {
    var wobbleMag = resolved.roughness * 3;
    return [
      p[0] + (rand() - 0.5) * wobbleMag,
      p[1] + (rand() - 0.5) * wobbleMag,
    ];
  });

  return _animatePoints(
    ctx, wobbled, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    duration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  );
}

function animateRoughArrow(ctx, x1, y1, x2, y2, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 700;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);

  var shaftDuration = duration * 0.8;
  var headDuration = duration * 0.2;

  var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  var numPoints = Math.max(8, Math.floor(len / 6));

  var shaftPoints = _wobbleLine(x1, y1, x2, y2, resolved.roughness, resolved.toolConfig.bowing, numPoints, rand);

  if (resolved.smooth && resolved.smoothIterations > 0) {
    shaftPoints = chaikinSmooth(shaftPoints, resolved.smoothIterations);
  }

  return _animatePoints(
    ctx, shaftPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    resolved.toolConfig.alphaJitter,
    shaftDuration,
    resolved.toolConfig.lineDash,
    resolved.toolConfig.lineCap
  ).then(function () {
    var headRand = mulberry32(resolved.seed + 100);
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var headSize = Math.max(12, resolved.width * 3.5);
    var spread = Math.PI / 6;

    var leftX = x2 - Math.cos(angle - spread) * headSize;
    var leftY = y2 - Math.sin(angle - spread) * headSize;
    var rightX = x2 - Math.cos(angle + spread) * headSize;
    var rightY = y2 - Math.sin(angle + spread) * headSize;

    var leftPoints = _wobbleLine(x2, y2, leftX, leftY, resolved.roughness * 0.8, 0, 4, headRand);
    var rightPoints = _wobbleLine(x2, y2, rightX, rightY, resolved.roughness * 0.8, 0, 4, headRand);
    var headPoints = leftPoints.concat(rightPoints.slice(1));

    var headPressure = Object.assign({}, resolved.pressureOpts, { minWidth: 0.5 });

    return _animatePoints(
      ctx, headPoints, resolved.width, resolved.color,
      headPressure, headRand,
      resolved.toolConfig.alphaJitter,
      headDuration,
      [],
      'round'
    );
  });
}

function animateLine(ctx, x1, y1, x2, y2, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 500;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);
  var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  var numPoints = Math.max(8, Math.floor(len / 4));

  var points = [];
  for (var i = 0; i <= numPoints; i++) {
    var t = i / numPoints;
    points.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
  }

  return _animatePoints(ctx, points, resolved.width, resolved.color, resolved.pressureOpts, rand, 0, duration, [], 'round');
}

function animateCircle(ctx, cx, cy, r, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 600;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);
  var numPoints = Math.max(32, Math.floor(r * 0.5));

  var points = [];
  for (var i = 0; i <= numPoints; i++) {
    var angle = (i / numPoints) * Math.PI * 2;
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  if (resolved.fill) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = resolved.fill;
    ctx.globalAlpha = resolved.fillAlpha;
    ctx.fill();
    ctx.restore();
  }

  return _animatePoints(ctx, points, resolved.width, resolved.color, resolved.pressureOpts, rand, 0, duration, [], 'round');
}

function animateArrow(ctx, x1, y1, x2, y2, opts, duration) {
  opts = opts || {};
  duration = duration !== undefined ? duration : 500;

  var resolved = applyTool(opts);
  var rand = mulberry32(resolved.seed);

  var shaftDuration = duration * 0.8;
  var headDuration = duration * 0.2;

  var len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  var numPoints = Math.max(8, Math.floor(len / 4));

  var shaftPoints = [];
  for (var i = 0; i <= numPoints; i++) {
    var t = i / numPoints;
    shaftPoints.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
  }

  return _animatePoints(
    ctx, shaftPoints, resolved.width, resolved.color,
    resolved.pressureOpts, rand,
    0,
    shaftDuration,
    [],
    'round'
  ).then(function () {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var headSize = Math.max(12, resolved.width * 3.5);
    var spread = Math.PI / 6;

    ctx.save();
    ctx.strokeStyle = resolved.color;
    ctx.lineWidth = resolved.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x2 - Math.cos(angle - spread) * headSize, y2 - Math.sin(angle - spread) * headSize);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(angle + spread) * headSize, y2 - Math.sin(angle + spread) * headSize);
    ctx.stroke();
    ctx.restore();

    return wait(headDuration);
  });
}

// \u2500\u2500 Text Rendering \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Text ALWAYS appears instantly as a complete unit. Never character by character.

function drawText(ctx, text, x, y, opts) {
  opts = opts || {};
  var size = opts.size !== undefined ? opts.size : 32;
  var color = opts.color || '#000000';
  var weight = opts.weight || 'normal';
  var align = opts.align || 'left';
  var fontFamily = opts.font || 'sans-serif';
  var delay = opts.delay || 0;

  function render() {
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + fontFamily;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  if (delay > 0) {
    setTimeout(render, delay);
  } else {
    render();
  }
}

// \u2500\u2500 Fade-in Fill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function fadeInFill(ctx, drawFn, color, alpha, duration) {
  return new Promise(function (resolve) {
    var startTime = performance.now();

    function frame() {
      var elapsed = performance.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);

      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = eased * alpha;
      drawFn(ctx);
      ctx.restore();

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// \u2500\u2500 Asset Drawing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function drawAsset(ctx, assetId, opts) {
  opts = opts || {};
  var x = opts.x !== undefined ? opts.x : 0;
  var y = opts.y !== undefined ? opts.y : 0;
  var width = opts.width !== undefined ? opts.width : 100;
  var height = opts.height !== undefined ? opts.height : 100;
  var opacity = opts.opacity !== undefined ? opts.opacity : 1;

  var assets = (window.__cenchAssets) || {};
  var img = assets[assetId];

  if (img && img instanceof HTMLImageElement && img.complete) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(img, x, y, width, height);
    ctx.restore();
    return Promise.resolve();
  }

  ctx.save();
  ctx.globalAlpha = opacity * 0.3;
  ctx.fillStyle = '#888888';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = opacity * 0.6;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('asset:' + assetId, x + width / 2, y + height / 2);
  ctx.restore();

  return Promise.resolve();
}
// \u2500\u2500 Progress-Based Drawing (for GSAP proxy pattern) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// These draw a stroke at 0-1 completion. Used with GSAP timeline:
//   const proxy = { p: 0 };
//   window.__tl.to(proxy, { p: 1, duration: 0.8, onUpdate: draw }, 0);
//   function draw() { drawRoughLineAtProgress(ctx, ...proxy.p, opts); }

function _renderPointsAtProgress(ctx, allPoints, progress, baseWidth, color, pressureOpts, rand, alphaJitter, lineDash, lineCap) {
  lineDash = lineDash || [];
  lineCap = lineCap || 'round';
  var total = allPoints.length;
  if (total < 2 || progress <= 0) return;
  var p = Math.min(1, progress);
  var targetIndex = Math.floor(p * (total - 1)) + 1;

  ctx.save();
  ctx.setLineDash(lineDash);
  ctx.lineCap = lineCap;

  for (var i = 0; i < targetIndex - 1 && i < total - 1; i++) {
    var globalT = i / Math.max(total - 2, 1);
    var globalTNext = (i + 1) / Math.max(total - 2, 1);
    var widthMid = strokePressure((globalT + globalTNext) / 2, pressureOpts) * baseWidth;
    var alpha = jitteredAlpha(1, globalT, rand, alphaJitter);

    ctx.globalAlpha = alpha;
    ctx.lineWidth = widthMid;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(allPoints[i][0], allPoints[i][1]);
    ctx.lineTo(allPoints[i + 1][0], allPoints[i + 1][1]);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRoughLineAtProgress(ctx, x1, y1, x2, y2, progress, opts) {
  if (progress <= 0) return;
  opts = opts || {};
  var resolved = applyTool(opts);
  var rand = mulberry32(opts.seed || 1);
  var numPts = Math.max(8, Math.floor(Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1)) / 6));
  var pts = _wobbleLine(x1, y1, x2, y2, resolved.roughness, resolved.bowing, numPts, rand);
  if (resolved.smooth) pts = chaikinSmooth(pts, resolved.smoothIterations, 0.25, false);
  _renderPointsAtProgress(ctx, pts, progress, resolved.width, resolved.color, resolved.pressureOpts, rand, resolved.alphaJitter, resolved.lineDash, resolved.lineCap);

  if (opts.fill && progress >= 1) {
    ctx.save();
    ctx.globalAlpha = opts.fillAlpha || 0.15;
    ctx.fillStyle = opts.fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRoughCircleAtProgress(ctx, cx, cy, diameter, progress, opts) {
  if (progress <= 0) return;
  opts = opts || {};
  var resolved = applyTool(opts);
  var rand = mulberry32(opts.seed || 1);
  var radius = diameter / 2;
  var numPts = Math.max(24, Math.floor(radius * 0.8));
  var pts = _wobbleCircle(cx, cy, radius, resolved.roughness, numPts, rand);
  if (resolved.smooth) pts = chaikinSmooth(pts, resolved.smoothIterations, 0.25, true);
  _renderPointsAtProgress(ctx, pts, progress, resolved.width, resolved.color, resolved.pressureOpts, rand, resolved.alphaJitter, resolved.lineDash, resolved.lineCap);

  if (opts.fill && progress >= 1) {
    ctx.save();
    ctx.globalAlpha = opts.fillAlpha || 0.15;
    ctx.fillStyle = opts.fill;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRoughRectAtProgress(ctx, x, y, w, h, progress, opts) {
  if (progress <= 0) return;
  opts = opts || {};
  var resolved = applyTool(opts);
  var rand = mulberry32(opts.seed || 1);
  var corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  var allPts = [];
  for (var i = 0; i < corners.length - 1; i++) {
    var seg = _wobbleLine(corners[i][0], corners[i][1], corners[i+1][0], corners[i+1][1], resolved.roughness, resolved.bowing, 8, rand);
    allPts = allPts.concat(seg);
  }
  if (resolved.smooth) allPts = chaikinSmooth(allPts, resolved.smoothIterations, 0.25, false);
  _renderPointsAtProgress(ctx, allPts, progress, resolved.width, resolved.color, resolved.pressureOpts, rand, resolved.alphaJitter, resolved.lineDash, resolved.lineCap);

  if (opts.fill && progress >= 1) {
    ctx.save();
    ctx.globalAlpha = opts.fillAlpha || 0.15;
    ctx.fillStyle = opts.fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

function drawRoughArrowAtProgress(ctx, x1, y1, x2, y2, progress, opts) {
  if (progress <= 0) return;
  // Draw shaft at full progress, head appears at end
  var shaftProgress = Math.min(1, progress / 0.85);
  drawRoughLineAtProgress(ctx, x1, y1, x2, y2, shaftProgress, opts);

  if (progress > 0.85) {
    opts = opts || {};
    var resolved = applyTool(opts);
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var headLen = Math.min(30, Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1)) * 0.15);
    var headProgress = (progress - 0.85) / 0.15;
    var a1x = x2 - headLen * Math.cos(angle - 0.4) * headProgress;
    var a1y = y2 - headLen * Math.sin(angle - 0.4) * headProgress;
    var a2x = x2 - headLen * Math.cos(angle + 0.4) * headProgress;
    var a2y = y2 - headLen * Math.sin(angle + 0.4) * headProgress;

    ctx.save();
    ctx.strokeStyle = resolved.color;
    ctx.lineWidth = resolved.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a1x, a1y); ctx.lineTo(x2, y2); ctx.lineTo(a2x, a2y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTextAtProgress(ctx, text, x, y, progress, opts) {
  if (progress <= 0) return;
  opts = opts || {};
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress);
  ctx.font = (opts.weight || 'bold') + ' ' + (opts.size || 48) + 'px ' + (opts.font || FONT || 'Caveat');
  ctx.fillStyle = opts.color || STROKE_COLOR || '#1a1a2e';
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// \u2500\u2500 End Cench Studio Canvas2D Drawing Engine \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;

// lib/styles/presets.ts
var STYLE_PRESETS = {
  whiteboard: {
    id: "whiteboard",
    name: "Whiteboard",
    description: "Hand-drawn marker on white board. Natural, educational feel.",
    emoji: "\u{1F4CB}",
    palette: ["#1a1a2e", "#e84545", "#16a34a", "#2563eb"],
    bgColor: "#fffef9",
    bgStyle: "paper",
    font: "Caveat",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 1.5,
    defaultTool: "marker",
    strokeColorOverride: null,
    textureStyle: "grain",
    textureIntensity: 0.04,
    textureBlendMode: "multiply",
    axisColor: "#4a4a52",
    gridColor: "#e5e5e8",
    agentGuidance: `Use canvas2d with animateRough* functions.
Prefer organic, hand-drawn shapes over geometric precision.
Use wait() between elements for natural drawing pacing.
Text is Caveat font, always instant (never animated).
Arrows and labels are the primary annotation tools.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 4, max: 8 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  chalkboard: {
    id: "chalkboard",
    name: "Chalkboard",
    description: "White chalk on dark green board. Classroom aesthetic.",
    emoji: "\u{1F58A}\uFE0F",
    palette: ["#fffef9", "#86efac", "#fbbf24", "#f87171"],
    bgColor: "#2d4a3e",
    bgStyle: "chalkboard",
    font: "Caveat",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 2.5,
    defaultTool: "chalk",
    strokeColorOverride: "#fffef9",
    textureStyle: "chalk",
    textureIntensity: 0.12,
    textureBlendMode: "screen",
    axisColor: "#fffef988",
    gridColor: "#fffef922",
    agentGuidance: `Use canvas2d with chalk tool.
Background is dark green \u2014 all strokes default to white (#fffef9).
Use PALETTE[0] (#fffef9) as the primary stroke color.
Use PALETTE[1-3] sparingly for emphasis only.
Rough, textured strokes are correct \u2014 this is chalk on a board.
Large text, generous spacing. Think classroom lecture.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 5 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: true, showProgressBar: true, playerTheme: "dark" }
  },
  blueprint: {
    id: "blueprint",
    name: "Blueprint",
    description: "Technical diagram on dark blue. Precise, engineering feel.",
    emoji: "\u{1F4D0}",
    palette: ["#93c5fd", "#60a5fa", "#fffef9", "#fbbf24"],
    bgColor: "#1e3a5f",
    bgStyle: "grid",
    font: "DM Mono",
    bodyFont: null,
    preferredRenderer: "motion",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: "#93c5fd",
    textureStyle: "none",
    textureIntensity: 0,
    textureBlendMode: "multiply",
    axisColor: "#93c5fd88",
    gridColor: "#93c5fd22",
    agentGuidance: `Default to Motion (HTML/CSS + GSAP): clean diagrams, cards, arrows, monospace labels \u2014 blueprint look without SVG.
Reserve canvas2d for chalky/organic or heavily procedural frames only.
SVG is rare \u2014 only when you need a single self-contained vector graphic with template stroke classes and nothing else fits.
Monospace font (DM Mono) for measurements. Light lines on dark blue grid.
Content type always wins \u2014 data is D3, 3D is Three.js.`,
    export: { resolution: "1080p", fps: 24, format: "mp4" },
    agent: {
      thinkingMode: "deep",
      planFirst: true,
      confirmBeforeBigChanges: true,
      preferredSceneCount: { min: 2, max: 4 }
    },
    density: {
      elementsPerScene: { min: 6, max: 12 },
      labelEverything: true,
      breathingRoom: false,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: false, playerTheme: "dark" }
  },
  clean: {
    id: "clean",
    name: "Clean",
    description: "Minimal, polished presentation style. Professional.",
    emoji: "\u2728",
    palette: ["#1a1a2e", "#e84545", "#16a34a", "#2563eb"],
    bgColor: "#ffffff",
    bgStyle: "plain",
    font: "Georgia",
    bodyFont: null,
    preferredRenderer: "motion",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "none",
    textureIntensity: 0,
    textureBlendMode: "multiply",
    axisColor: "#6b7280",
    gridColor: "#f3f4f6",
    agentGuidance: `Default to Motion: polished layouts, typography, cards, step lists, and UI-like explainers (Georgia, minimal chrome).
Use canvas2d only for expressive hand-drawn or generative visuals \u2014 not for default explainers.
SVG is rare (edge cases). Professional, minimal; light fills on shapes via CSS.
Content type always wins \u2014 data is D3, 3D is Three.js.`,
    export: { resolution: "1080p", fps: 60, format: "mp4" },
    agent: {
      thinkingMode: "off",
      planFirst: false,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 8 }
    },
    density: {
      elementsPerScene: { min: 2, max: 5 },
      labelEverything: false,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  "data-story": {
    id: "data-story",
    name: "Data Story",
    description: "Dark background, optimized for charts and data visualization.",
    emoji: "\u{1F4CA}",
    palette: ["#60a5fa", "#34d399", "#f59e0b", "#f87171"],
    bgColor: "#0f0f13",
    bgStyle: "plain",
    font: "DM Mono",
    bodyFont: null,
    preferredRenderer: "auto",
    roughnessLevel: 0.3,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "grain",
    textureIntensity: 0.03,
    textureBlendMode: "screen",
    axisColor: "#4a4a5a",
    gridColor: "#2a2a3a",
    agentGuidance: `Prefer D3 for data scenes.
For non-data explainer frames: default to Motion (layouts, callouts, transitions). Canvas2d for expressive or procedural visuals only. SVG rarely.
Dark background \u2014 elements light/bright. Monospace for numbers.
Chart animations: bars grow, lines draw L\u2192R. PALETTE for series only.
Content type always wins \u2014 data is D3, 3D is Three.js.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 7 }
    },
    density: {
      elementsPerScene: { min: 1, max: 3 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
  },
  newspaper: {
    id: "newspaper",
    name: "Newspaper",
    description: "Editorial, monochrome. Text-heavy, journalistic.",
    emoji: "\u{1F4F0}",
    palette: ["#1a1a1a", "#404040", "#737373", "#d4d4d4"],
    bgColor: "#f5f0e0",
    bgStyle: "paper",
    font: "Georgia",
    bodyFont: null,
    preferredRenderer: "motion",
    roughnessLevel: 0.5,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "paper",
    textureIntensity: 0.08,
    textureBlendMode: "multiply",
    axisColor: "#404040",
    gridColor: "#d4d4d4",
    agentGuidance: `Default to Motion for editorial layouts: headlines, columns, pull quotes, and supporting diagram-like blocks in HTML/CSS.
Text-first; Georgia serif; monochrome grays.
Canvas2d only if you need hand-drawn illustration energy. SVG rarely.
Paper texture is automatic \u2014 do not fight it in scene code.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: false,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  neon: {
    id: "neon",
    name: "Neon",
    description: "Dark background, glowing neon colors. Futuristic, tech.",
    emoji: "\u26A1",
    palette: ["#f0ece0", "#00ff88", "#ff0080", "#00cfff"],
    bgColor: "#0a0a0f",
    bgStyle: "plain",
    font: "DM Mono",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0.8,
    defaultTool: "brush",
    strokeColorOverride: null,
    textureStyle: "grain",
    textureIntensity: 0.05,
    textureBlendMode: "screen",
    axisColor: "#00ff8844",
    gridColor: "#00ff8811",
    agentGuidance: `Dark background \u2014 use bright PALETTE colors for all strokes.
Brush tool for expressive, glowing stroke feel.
Use glow effect: draw each stroke twice \u2014 once thick at low opacity,
once thin at full opacity \u2014 to simulate neon glow.
Monospace font. Tech/futuristic tone.
Use PALETTE[1] (green) for primary content.
Use PALETTE[2] (pink) and PALETTE[3] (cyan) for accents.
WHEN TO OVERRIDE: If the project already has 2+ Canvas2D scenes, use SVG or Motion for the next scene. Content type always wins \u2014 data is always D3, 3D is always Three.js.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: false,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: false,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
  },
  kraft: {
    id: "kraft",
    name: "Kraft Paper",
    description: "Brown paper, warm and tactile. Artisan, hand-made feel.",
    emoji: "\u{1F4E6}",
    palette: ["#1c0a00", "#92400e", "#b45309", "#d97706"],
    bgColor: "#c4a882",
    bgStyle: "kraft",
    font: "Caveat",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 2,
    defaultTool: "marker",
    strokeColorOverride: "#1c0a00",
    textureStyle: "paper",
    textureIntensity: 0.15,
    textureBlendMode: "multiply",
    axisColor: "#92400e88",
    gridColor: "#92400e22",
    agentGuidance: `Warm brown palette on kraft paper background.
Caveat font \u2014 handwritten, artisan feel.
Dark ink strokes on warm paper. No bright colors.
Heavy texture. This should look like something drawn with a
marker on brown packaging paper.
WHEN TO OVERRIDE: If the project already has 2+ Canvas2D scenes, use SVG for the next visual scene. Content type always wins \u2014 data is always D3, 3D is always Three.js.`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 5 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: false,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
  },
  threeblueonebrown: {
    id: "threeblueonebrown",
    name: "3B1B",
    emoji: "\u{1F535}",
    description: "3Blue1Brown \u2014 mathematical precision on deep navy.",
    bgColor: "#0d1117",
    palette: ["#6495ED", "#9B59B6", "#F39C12", "#AAAAAA"],
    font: "Sora",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "none",
    textureIntensity: 0,
    textureBlendMode: "multiply",
    bgStyle: "plain",
    axisColor: "#444444",
    gridColor: "#1E2A3A",
    agentGuidance: `COLORS \u2014 color encodes meaning, always
- Background: deep navy (#0d1117) \u2014 this specific shade, not pure black
- Blue (#6495ED): the PRIMARY concept being explained. The thing itself.
- Purple (#9B59B6): extensions, related concepts, transformations of the primary
- Gold (#F39C12): the KEY RESULT or KEY INSIGHT. Use once per scene maximum.
- Grey (#AAAAAA): supporting elements, axis labels, annotations that aren't the focus
- White (#FFFFFF): text only, never shapes

TYPOGRAPHY
- Title: 52px / 500 / white / -0.01em tracking
- Equation: 36px / 400 / white / center-aligned / generous vertical padding
- Annotation: 24px / 400 / #AAAAAA / left-aligned near the element it describes
- Label: 24px / 500 / color-matched to element / never more than 4 words

ANIMATION \u2014 DRAWING IS THE ANIMATION
- Elements do not fade in. They draw themselves.
- Shapes: stroke traces first (0.8s, power2.inOut), then fill fades in (0.3s)
- Lines and arrows: draw left to right or start to end, 0.6-1.2s depending on length
- Text: fade up 16px, 0.4s, power3.out \u2014 text is secondary to the drawings
- Equations: appear character group by character group, 0.06s stagger per term
- Never bounce. Never spring. Mathematical precision in motion.

CHARTS AND GRAPHS
- Axes draw themselves first, then data appears
- Grid: subtle, #1E2A3A, both axes at 0.5px
- Primary data series: blue. Secondary: purple. Key value: gold dot or annotation.
- Axes: no border box \u2014 open frame. Labels in grey (#AAAAAA), 24px.
- Prefer showing the mathematical relationship visually over chart labels

SPATIAL RHYTHM
- Generous \u2014 math needs to breathe
- 80px margins minimum
- Equation gets its own visual zone \u2014 don't crowd it with other elements
- One concept per scene. If two concepts, show their relationship explicitly.

PROHIBITIONS
- No drop shadows
- No gradients on shapes (flat fills only, or stroke-only)
- No decorative elements that don't encode meaning
- No more than 4 colors in a single scene
- No rounded UI-style corners on mathematical shapes \u2014 use geometric precision
- Never use red (looks like an error/warning, breaks mathematical color semantics)`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "deep",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 2, max: 5 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
  },
  feynman: {
    id: "feynman",
    name: "Feynman",
    emoji: "\u270F\uFE0F",
    description: "Feynman lecture notes \u2014 cream paper, hand-drawn physics.",
    bgColor: "#f5f0e8",
    palette: ["#1a1a1a", "#8B4513", "#1a4a2e", "#8B0000"],
    font: "Caveat",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 2.2,
    defaultTool: "pen",
    strokeColorOverride: "#1a1a1a",
    textureStyle: "paper",
    textureIntensity: 0.1,
    textureBlendMode: "multiply",
    bgStyle: "paper",
    axisColor: "#4a4a4a",
    gridColor: "#d4c9b0",
    agentGuidance: `COLORS
- Background: aged cream (#f5f0e8) \u2014 like worn lecture paper
- Ink black (#1a1a1a): all primary content \u2014 diagrams, equations, main text
- Brown (#8B4513): secondary annotations, arrows pointing to things, "see also" notes
- Dark green (#1a4a2e): corrections, alternative paths, "or equivalently" annotations
- Deep red (#8B0000): critical warnings, key results circled, "IMPORTANT" markers \u2014 use sparingly

TYPOGRAPHY \u2014 HANDWRITTEN FEEL IS EVERYTHING
- Caveat is loaded \u2014 use it everywhere
- Title: 44px / Caveat / #1a1a1a \u2014 looks like written on the board
- Body: 32px / Caveat / #1a1a1a / 1.9 leading (handwriting needs air)
- Equation: 28px / Caveat / centered on the page \u2014 equations are big and clear
- Annotation: 24px / Caveat / brown \u2014 smaller, squeezed in the margin

ANIMATION \u2014 THINGS ARE BEING WRITTEN IN REAL TIME
- Diagrams draw with stroke animation: 1.0-1.5s, power1.inOut (human writing pace)
- Arrows appear after the thing they point to (0.3s delay after target)
- Circles/boxes drawn around things: quick (0.4s) \u2014 like circling for emphasis
- Underlines draw left to right: 0.3s after the text they underline
- Nothing appears instantly \u2014 everything takes the time a human hand would take

DIAGRAMS
- Roughness level 2.2 means shapes look hand-drawn \u2014 lean into this
- Lines have natural variation \u2014 this is correct, not a bug
- Arrows: slightly curved, not perfectly straight
- Physics diagrams: label every force, every vector, every angle \u2014 Feynman labeled everything

CHARTS
- Graphs are sketched, not rendered
- Axes drawn as arrows (not just lines) \u2014 Feynman style
- Grid: light pencil (#d4c9b0, dashed)
- Data as dots connected by a curve drawn by hand, not pixel-perfect
- Label axes with units always, in Caveat font

SPATIAL RHYTHM
- Organic, not grid-aligned \u2014 like actual lecture notes
- Things are where they make sense, not on a rigid layout
- Margin notes are valid \u2014 annotations can be outside the main flow
- 60px margins minimum but content can drift

PROHIBITIONS
- No pixel-perfect circles or lines (roughness handles this \u2014 don't fight it)
- No flat digital fills \u2014 use stroke-only or very light fills
- No sans-serif fonts (Caveat everywhere, always)
- No dark backgrounds \u2014 this is paper
- No clean modern UI elements (buttons, cards with borders, etc.)`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 4, max: 8 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  cinematic: {
    id: "cinematic",
    name: "Cinematic",
    emoji: "\u{1F39E}\uFE0F",
    description: "BBC documentary / premium production \u2014 dark, restrained.",
    bgColor: "#080808",
    palette: ["#FFFFFF", "#00D4FF", "#FF6B35", "#333333"],
    font: "Manrope",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "grain",
    textureIntensity: 0.04,
    textureBlendMode: "overlay",
    bgStyle: "plain",
    axisColor: "#444444",
    gridColor: "#1A1A1A",
    agentGuidance: `COLORS
- Background: near-black (#080808) \u2014 NOT pure black, the grain needs something to work against
- White (#FFFFFF): primary text and primary visual elements
- Cyan (#00D4FF): THE single accent color. One accent element per scene. One highlight. One key number.
- Orange (#FF6B35): contrast moments only \u2014 a second data series, a warning, a counter-element. Never alongside cyan in the same scene.
- Dark grey (#333333): secondary elements, supporting text, subtle dividers

ONE ACCENT RULE
Each scene uses either cyan OR orange, never both. The accent is the single thing that matters most in that scene. Everything else is white or grey.

TYPOGRAPHY
- Titles: 56px / 300 weight (LIGHT \u2014 cinematic titles are never bold) / white / -0.02em tracking
- Subhead: 28px / 300 / #AAAAAA / 0 tracking
- Body: 32px / 400 / #CCCCCC / 1.8 leading
- Data callout: 72px / 200 weight / white / tabular-nums (huge, confident, minimal)
- Caption: 24px / 400 / #666666 / letter-spacing 0.04em

ANIMATION \u2014 RESTRAINT IS THE AESTHETIC
- Elements emerge from darkness: fade from opacity 0, scale from 0.98 to 1 (barely perceptible scale)
- Duration: 0.7s, power2.out \u2014 unhurried
- Stagger between elements: 0.4s (long gaps \u2014 each element breathes)
- The accent color element: arrives LAST, after everything else has settled
- Charts: lines draw left to right at 1.0s, no fill animation \u2014 just the line
- Exit: faster than entrance, 0.3s fade to opacity 0

GRAIN TEXTURE
- The grain texture (0.04 intensity, overlay) gives film quality
- Do NOT add additional texture effects in the scene code \u2014 the template handles this

CHARTS
- Ultra-minimal \u2014 cinematic doesn't do dashboards
- Single line charts preferred: 1.5px white or accent-colored line, no fill
- No chart borders, no grid lines (or barely-visible at 0.05 opacity)
- Data labels on the line, not in a legend
- One data series per chart \u2014 if you need two, reconsider whether a chart is the right choice

SPATIAL RHYTHM
- Asymmetric \u2014 key element off-center feels more cinematic than centered
- Large type paired with lots of empty dark space
- 80px margins, but content often lives in one half of the frame
- Text bottom-third placement for key moments (documentary lower-third convention)

PROHIBITIONS
- No bounce, spring, or elastic easing (ever, in any form)
- No rounded UI elements
- No emoji
- No more than 2 elements in motion at the same time
- No white backgrounds on any element (cards, panels, etc.)
- No gradients`,
    export: { resolution: "1080p", fps: 24, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 1, max: 3 },
      labelEverything: false,
      breathingRoom: true,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
  },
  pencil: {
    id: "pencil",
    name: "Pencil",
    emoji: "\u270F\uFE0F",
    description: "Graphite sketchbook \u2014 thinking in progress.",
    bgColor: "#f8f7f4",
    palette: ["#2b2b2b", "#555555", "#888888", "#c8c8c8"],
    font: "Caveat",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 2.8,
    defaultTool: "pen",
    strokeColorOverride: "#2b2b2b",
    textureStyle: "paper",
    textureIntensity: 0.08,
    textureBlendMode: "multiply",
    bgStyle: "paper",
    axisColor: "#555555",
    gridColor: "#d8d8d8",
    agentGuidance: `COLORS \u2014 GREYSCALE ONLY, NO EXCEPTIONS
- Background: off-white paper (#f8f7f4)
- Dark (#2b2b2b): primary lines, text, key shapes \u2014 the 2B pencil
- Mid-dark (#555555): secondary elements, annotations, supporting lines \u2014 the HB pencil
- Mid (#888888): light construction lines, guide marks, underdrawn elements
- Light (#c8c8c8): barely-there guide lines, erased marks, very secondary elements
No color. Ever. This is greyscale by principle.

PENCIL WEIGHT CONVENTION (professional illustrators use this)
- Heavy (2b color, strokeWidth 2.5): final lines, key shapes, text
- Medium (555, strokeWidth 1.5): secondary elements, labels
- Light (888, strokeWidth 0.8): construction lines, guides, background grid
- Ghost (c8c, strokeWidth 0.5): barely visible \u2014 used for scale, reference

HATCHING AND SHADING
- For fills, use hatching: parallel lines drawn close together, not solid fills
- Cross-hatching for darker areas: two layers of parallel lines at 45\xB0 to each other
- Never use solid dark fills \u2014 always hatch
- Roughness 2.8 means the hatching lines wobble naturally \u2014 this is correct

TYPOGRAPHY
- Caveat at all sizes: 40px title, 32px body, 24px annotation
- All text in dark (#2b2b2b), as if written by hand

ANIMATION \u2014 SKETCHING IN REAL TIME
- Everything draws as if a hand is holding the pencil
- Lines: stroke animation, 0.8-1.5s depending on length, power1.inOut
- Hatching: lines appear one by one with 0.05s stagger
- The experience: watching someone work through a problem on paper

CHARTS
- Drawn on graph paper \u2014 use grid bgStyle, light grey grid lines (#d8d8d8)
- Axes: drawn as lines with arrowheads at ends (not just borders)
- Data: plotted as \xD7 marks or dots, connected by a hand-drawn line
- Bar chart: bars outlined with pencil, filled with hatching

PROHIBITIONS
- No color (greyscale only \u2014 this is the defining rule)
- No solid fills (always hatch)
- No digital-looking precision (the roughness is intentional)
- No clean sans-serif fonts`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 5 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  risograph: {
    id: "risograph",
    name: "Risograph",
    emoji: "\u{1F5A8}\uFE0F",
    description: "Limited color print \u2014 analog grain, deliberate misregister.",
    bgColor: "#f2ede4",
    palette: ["#e84855", "#0067A5", "#1a1a1a", "#f2ede4"],
    font: "Space Mono",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0.5,
    defaultTool: "marker",
    strokeColorOverride: null,
    textureStyle: "grain",
    textureIntensity: 0.12,
    textureBlendMode: "multiply",
    bgStyle: "paper",
    axisColor: "#1a1a1a",
    gridColor: "#d4c9b0",
    agentGuidance: `COLORS \u2014 TWO INK COLORS ONLY, EXACTLY LIKE REAL RISOGRAPH
- Paper: cream (#f2ede4) \u2014 this IS a color, it shows through where inks don't print
- Red ink (#e84855): first color pass
- Blue ink (#0067A5): second color pass
- Overlap: where red and blue overlap, they mix to create a brownish-purple \u2014 achieve with globalCompositeOperation 'multiply' or layer at 0.85 opacity
- Black (#1a1a1a): use ONLY for text \u2014 risograph black is a third ink, use sparingly

MISREGISTER \u2014 THE SIGNATURE EFFECT
Real risograph prints have slight misalignment between color passes. Simulate this:
- The blue layer should be offset 2-3px in x and y from where you'd expect
- Consistent offset within a scene \u2014 pick a direction and stick with it
- Applies to both shapes AND text that has a colored outline or shadow

HALFTONE FOR TINTS
Instead of opacity, simulate tints with dot patterns:
- Full ink: solid fill
- 50% tint: dots at 6px spacing
- 25% tint: dots at 10px spacing
- No CSS opacity for ink simulation (use dot pattern instead)

TYPOGRAPHY
- Space Mono everywhere \u2014 looks like a typewriter, fitting for print aesthetic
- Title: 48px / 700 / black (#1a1a1a) \u2014 set in black ink
- Body: 32px / 400 / black
- Pulled quote or callout: 32px / 700 / red or blue (one ink color, not black)
- Labels: 24px / 400 / ALL CAPS / 0.08em tracking

ANIMATION
- Ink appears: elements stamp in with a very slight scale (1.05 \u2192 1, 0.15s, power2.out)
- The two color layers appear separately: red first (0.3s), then blue with 0.2s offset
- Misregister is applied on the blue layer's entrance
- Text typesets in: characters appear left to right, 0.04s stagger

CHARTS
- Bold, graphic, poster-style \u2014 not data-dashboard style
- Large areas of solid color, not thin lines
- Bar charts: thick bars, red or blue, halftone for secondary bars
- Prefer visual metaphor over precise chart when possible

SPATIAL RHYTHM
- Bold and graphic \u2014 fill the space
- Large type, large shapes
- 40px margins (tighter than minimal presets \u2014 risograph is bold)

PROHIBITIONS
- No gradients (risograph doesn't do gradients \u2014 use halftone dots instead)
- No more than 2 ink colors per scene (plus black for text)
- No smooth opacity transitions \u2014 only solid or halftone
- No thin delicate lines \u2014 risograph is bold`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 5 }
    },
    density: {
      elementsPerScene: { min: 2, max: 5 },
      labelEverything: false,
      breathingRoom: false,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  retro_terminal: {
    id: "retro_terminal",
    name: "Terminal",
    emoji: "\u2328\uFE0F",
    description: "Amber phosphor CRT \u2014 1970s oscilloscope aesthetic.",
    bgColor: "#0a0800",
    palette: ["#FFB000", "#FF8C00", "#CC7000", "#1a1400"],
    font: "Space Mono",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: "#FFB000",
    textureStyle: "lines",
    textureIntensity: 0.07,
    textureBlendMode: "overlay",
    bgStyle: "plain",
    axisColor: "#CC7000",
    gridColor: "#1a1000",
    agentGuidance: `COLORS \u2014 AMBER MONOCHROME ONLY
- Void black (#0a0800): background \u2014 not pure black, has a warm undertone
- Bright amber (#FFB000): primary \u2014 text, active elements, key data (phosphor at full brightness)
- Medium amber (#FF8C00): secondary elements, supporting text, axis labels
- Dim amber (#CC7000): inactive elements, grid lines, ghost elements (phosphor fading)
- Near-black (#1a1400): panel backgrounds, subtle dividers \u2014 almost invisible
No other colors. This is a monochrome phosphor display.

PHOSPHOR GLOW
Amber phosphor CRTs have a characteristic soft glow:
- Primary elements: text-shadow or box-shadow '#FFB000' at 0.35 opacity, 0 offset, 6px blur
- Keep glow subtle \u2014 you're suggesting phosphor, not neon
- Only ONE glow effect per scene \u2014 the most important element

SCANLINES
The texture (lines, 0.07 intensity) simulates CRT scanlines \u2014 do NOT add more texture effects.
Horizontal lines at regular intervals are already handled.

TYPOGRAPHY \u2014 MONOSPACE EVERYTHING
- Space Mono at all sizes \u2014 this is non-negotiable
- Title: 40px / 700 / bright amber \u2014 uppercase always
- Body: 28px / 400 / medium amber
- Data readout: 56px / 400 / bright amber / tabular-nums \u2014 big phosphor numbers
- Label: 24px / 400 / dim amber / ALL CAPS / 0.1em tracking
- Prompt character (>_ style): use before title text

ANIMATION \u2014 TERMINAL BEHAVIOR
- Text prints character by character: 0.05s per character (fast but visible)
- Cursor blinks at end of typed text: blinking underscore or block, 500ms interval
- Elements don't slide or scale \u2014 they APPEAR (snap in) like a terminal drawing
- Exceptions: waveforms and oscilloscope traces draw left-to-right (0.8s)
- Screen flicker on major transitions: brief opacity dip (0.7) then back to 1, 0.08s

CHARTS \u2014 OSCILLOSCOPE STYLE
- Line charts are the native chart type (waveforms)
- Grid: subtle (#1a1000), both axes \u2014 like graph paper on a CRT screen
- Line: 1.5px bright amber, draw left to right
- No bar charts \u2014 use numerical readouts instead
- Data labels as terminal-style readouts: "FREQ: 440Hz" format
- Axes labeled in monospace, ALL CAPS

SPATIAL RHYTHM
- Terminal-style left alignment \u2014 everything starts from the left
- No centered elements (terminals don't center-align)
- 60px left margin, 40px top margin
- Line structure \u2014 content builds downward like terminal output

PROHIBITIONS
- No color other than amber shades
- No rounded corners on anything
- No smooth animations (snap-in only, except waveform draws)
- No serif fonts, no sans-serif (monospace only)
- No gradients`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: false,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 5 }
    },
    density: {
      elementsPerScene: { min: 2, max: 4 },
      labelEverything: true,
      breathingRoom: false,
      annotationStyle: "minimal"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: false, playerTheme: "dark" }
  },
  science_journal: {
    id: "science_journal",
    name: "Journal",
    emoji: "\u{1F52C}",
    description: "Nature / Science magazine \u2014 publication-quality figures.",
    bgColor: "#FFFFFF",
    palette: ["#1a1a2e", "#e94560", "#16213e", "#888888"],
    font: "Georgia",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 0,
    defaultTool: "pen",
    strokeColorOverride: null,
    textureStyle: "none",
    textureIntensity: 0,
    textureBlendMode: "multiply",
    bgStyle: "plain",
    axisColor: "#333333",
    gridColor: "#e0e0e0",
    agentGuidance: `COLORS
- Background: pure white (#FFFFFF)
- Navy (#1a1a2e): primary data series, headlines, key elements
- Red (#e94560): accent \u2014 the one highlighted data point, the significant result, p<0.05 marker
- Dark navy (#16213e): secondary data series, body text
- Grey (#888888): axis labels, figure captions, supporting text, grid lines

TYPOGRAPHY \u2014 PUBLICATION STANDARD
- Figure title: 28px / Georgia / 700 / navy \u2014 always present, always top-left
- Axis label: 24px / Sora / 400 / #333333 \u2014 sans-serif for chart labels (readability)
- Axis value: 24px / Sora / 400 / #666666
- Body text: 32px / Georgia / 400 / #1a1a2e / 1.7 leading
- Figure caption: 24px / Georgia / italic / #444444 \u2014 always below the figure
- Source/credit: 24px / Sora / 400 / #888888 / bottom-right always

FIGURE NUMBERING \u2014 MANDATORY
Every scene that contains a chart or diagram has:
- "Fig. N" label: 24px / Sora / 500 / #888888 / top-left or bottom-left
- Caption below: 24px / Georgia / italic \u2014 one sentence explaining what is shown
- Source line: 24px / Sora / #888888 \u2014 where this data/concept comes from

CHARTS \u2014 PUBLICATION QUALITY
- No chart junk (Tufte principle): remove every element that doesn't carry information
- Axes: bottom and left only (no top/right border \u2014 open chart frame)
- Axis lines: 1px #333333
- Grid lines: horizontal only, 0.5px #e0e0e0 (barely visible)
- Primary series: navy (#1a1a2e), 2px line or solid bar
- Secondary series: #16213e at 0.6 opacity
- Significance marker: red (#e94560) \u2014 asterisk, bracket, or highlighted point
- Error bars: thin (0.8px) lines with horizontal caps \u2014 always show uncertainty
- Legend: inside the chart area, not outside (saves space)

ANIMATION
- Conservative \u2014 scientific figures don't perform
- Charts draw axes first (0.4s), then data appears (0.6s), then labels (0.3s)
- All easing: power1.out \u2014 gentle, not showy
- No bounce, no spring

SPATIAL RHYTHM
- Publication column width: figures are typically 80-90% of page width
- 48px margins
- Figure + caption treated as a unit \u2014 they always travel together
- White space between figure and caption: 12px exactly

PROHIBITIONS
- No 3D charts (ever \u2014 they distort data)
- No pie charts (use bar chart instead)
- No decorative chart elements (backgrounds, shadows, gradients on bars)
- No animation that lasts over 0.8s per element
- No emoji
- No rounded corners on chart elements`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "deep",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 1, max: 3 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "light" }
  },
  pastel_edu: {
    id: "pastel_edu",
    name: "Classroom",
    emoji: "\u{1F34E}",
    description: "Friendly educational \u2014 Khan Academy warmth.",
    bgColor: "#FAFAFA",
    palette: ["#E74C3C", "#1ABC9C", "#3498DB", "#F39C12"],
    font: "Nunito",
    bodyFont: null,
    preferredRenderer: "canvas2d",
    roughnessLevel: 1,
    defaultTool: "marker",
    strokeColorOverride: null,
    textureStyle: "none",
    textureIntensity: 0,
    textureBlendMode: "multiply",
    bgStyle: "plain",
    axisColor: "#AAAAAA",
    gridColor: "#F0F0F0",
    agentGuidance: `COLORS \u2014 EACH COLOR HAS A ROLE, KEEP IT CONSISTENT
- Background: near-white (#FAFAFA) \u2014 warm, not clinical white
- Red (#E74C3C): primary concept, the main thing being learned
- Teal (#1ABC9C): correct answers, positive outcomes, "this works"
- Blue (#3498DB): information, context, explanations, secondary concepts
- Orange (#F39C12): emphasis, "pay attention", callouts, numbers to remember
All four colors are friendly and distinct \u2014 no dark or threatening colors.

FRIENDLY COLOR RULES
- Every major concept gets its own color and keeps it throughout the scene
- If "force" is red in scene 1, it's red in every scene
- Color = memory hook \u2014 the student associates color with concept

TYPOGRAPHY \u2014 ROUNDED AND APPROACHABLE
- Nunito is loaded \u2014 use it everywhere (rounded letterforms feel friendly)
- Title: 48px / 700 / #333333 \u2014 confident but not intimidating
- Body: 32px / 400 / #555555 / 1.8 leading \u2014 generous line height
- Highlighted word: inline color matching its concept color
- Callout box: 28px / 600 / white text on concept-color background / 12px border-radius
- Equation: 28px / 600 / #333333 \u2014 equations should be big enough to read easily

ANIMATION \u2014 PLAYFUL BUT NOT DISTRACTING
- Elements bounce in: scale 0 \u2192 1.1 \u2192 1, duration 0.5s, back.out(1.5) easing
- Text fades up 24px, 0.4s \u2014 livelier than serious presets
- Stagger between list items: 0.1s (noticeable, feels lively)
- Correct answer reveal: scale 1 \u2192 1.15 \u2192 1 with teal color flash, 0.3s
- Charts: bars grow from baseline with bounce \u2014 each bar bounces individually

CHARTS
- Bright, clear, labeled
- Grid: light grey (#F0F0F0) horizontal only
- Bars: full concept color, 8px border-radius (rounded bars feel friendly)
- Labels on top of bars, 24px / 600 / matching color
- Axes: thin grey (#AAAAAA), with clear unit labels
- Always include a chart title above: 26px / 600 / #333333

CALLOUT BOXES \u2014 USE GENEROUSLY
- Key term: colored background, white text, 8px radius, 12px 16px padding
- Remember box: orange background, white text
- Example box: blue background
- Warning: red background

SPATIAL RHYTHM
- Friendly density \u2014 not sparse but not overwhelming
- 64px margins
- Space between sections: 40px
- Content often slightly left-of-center (like a teacher at a whiteboard)

PROHIBITIONS
- No dark backgrounds on any element
- No thin lines \u2014 minimum 2px strokes, prefer 3px
- No tiny text \u2014 minimum 24px even for captions
- No long paragraphs \u2014 max 2 lines of body text per scene
- No complex charts \u2014 if it needs a legend, simplify it`,
    export: { resolution: "1080p", fps: 30, format: "mp4" },
    agent: {
      thinkingMode: "adaptive",
      planFirst: true,
      confirmBeforeBigChanges: false,
      preferredSceneCount: { min: 3, max: 6 }
    },
    density: {
      elementsPerScene: { min: 3, max: 6 },
      labelEverything: true,
      breathingRoom: true,
      annotationStyle: "detailed"
    },
    interactive: { autoAddGates: false, autoAddQuizzes: true, showProgressBar: true, playerTheme: "light" }
  }
};
var NEUTRAL_BASELINE = {
  id: "whiteboard",
  // sentinel — never displayed
  name: "Custom",
  description: "No preset. Full style autonomy \u2014 the generator decides.",
  emoji: "\u{1F3A8}",
  palette: ["#f0ece0", "#e84545", "#4595e8", "#45e87a"],
  bgColor: "#181818",
  bgStyle: "plain",
  font: "Figtree",
  bodyFont: null,
  preferredRenderer: "auto",
  roughnessLevel: 0,
  defaultTool: "pen",
  strokeColorOverride: null,
  textureStyle: "none",
  textureIntensity: 0,
  textureBlendMode: "multiply",
  axisColor: "#888888",
  gridColor: "#333333",
  agentGuidance: "No style preset is active. You have full creative control over colors, fonts, backgrounds, layout, and rendering approach. Choose what best fits the content. Do not default to whiteboard or chalkboard aesthetics unless the user asks for them.",
  export: { resolution: "1080p", fps: 30, format: "mp4" },
  agent: {
    thinkingMode: "adaptive",
    planFirst: true,
    confirmBeforeBigChanges: false,
    preferredSceneCount: { min: 3, max: 8 }
  },
  density: {
    elementsPerScene: { min: 3, max: 8 },
    labelEverything: false,
    breathingRoom: true,
    annotationStyle: "minimal"
  },
  interactive: { autoAddGates: false, autoAddQuizzes: false, showProgressBar: true, playerTheme: "dark" }
};
function getPreset(id) {
  if (!id) return NEUTRAL_BASELINE;
  return STYLE_PRESETS[id] ?? NEUTRAL_BASELINE;
}
function resolveStyle(presetId, overrides = {}) {
  const preset = getPreset(presetId);
  const effectivePalette = overrides.paletteOverride ?? preset.palette;
  return {
    ...preset,
    palette: effectivePalette,
    bgColor: overrides.bgColorOverride ?? preset.bgColor,
    font: overrides.fontOverride ?? preset.font,
    bodyFont: overrides.bodyFontOverride ?? preset.bodyFont,
    strokeColor: overrides.strokeColorOverride ?? preset.strokeColorOverride ?? effectivePalette[0]
  };
}

// lib/styles/scene-presets.ts
function resolveSceneStyle(sceneOverride, globalStyle) {
  const base = resolveStyle(globalStyle.presetId, globalStyle);
  return {
    ...base,
    palette: sceneOverride.palette ?? base.palette,
    bgColor: sceneOverride.bgColor ?? base.bgColor,
    font: sceneOverride.font ?? base.font,
    bodyFont: sceneOverride.bodyFont ?? base.bodyFont,
    roughnessLevel: sceneOverride.roughnessLevel ?? base.roughnessLevel,
    defaultTool: sceneOverride.defaultTool ?? base.defaultTool,
    textureStyle: sceneOverride.textureStyle ?? base.textureStyle,
    textureIntensity: sceneOverride.textureIntensity ?? base.textureIntensity,
    textureBlendMode: sceneOverride.textureBlendMode ?? base.textureBlendMode,
    bgStyle: sceneOverride.bgStyle ?? base.bgStyle,
    axisColor: sceneOverride.axisColor ?? base.axisColor,
    gridColor: sceneOverride.gridColor ?? base.gridColor,
    strokeColor: sceneOverride.strokeColorOverride ?? base.strokeColor
  };
}

// lib/fonts/catalog.ts
var FONT_CATALOG = [
  // ── Sans-serif ──────────────────────────────────────────────
  {
    id: "satoshi",
    family: "Satoshi",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: null,
    fallback: "system-ui, sans-serif"
  },
  {
    id: "figtree",
    family: "Figtree",
    category: "sans-serif",
    weights: [300, 400, 500, 600, 700],
    googleFontsId: "Figtree",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "sora",
    family: "Sora",
    category: "sans-serif",
    weights: [300, 400, 500, 600, 700],
    googleFontsId: "Sora",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "manrope",
    family: "Manrope",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Manrope",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "bricolage-grotesque",
    family: "Bricolage Grotesque",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Bricolage+Grotesque",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "nunito",
    family: "Nunito",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Nunito",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "poppins",
    family: "Poppins",
    category: "sans-serif",
    weights: [300, 400, 500, 600, 700],
    googleFontsId: "Poppins",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "work-sans",
    family: "Work Sans",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Work+Sans",
    fallback: "system-ui, sans-serif"
  },
  // ── Serif ───────────────────────────────────────────────────
  {
    id: "bitter",
    family: "Bitter",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Bitter",
    fallback: "Georgia, serif"
  },
  {
    id: "vollkorn",
    family: "Vollkorn",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Vollkorn",
    fallback: "Georgia, serif"
  },
  {
    id: "merriweather",
    family: "Merriweather",
    category: "serif",
    weights: [400, 700],
    googleFontsId: "Merriweather",
    fallback: "Georgia, serif"
  },
  {
    id: "source-serif-4",
    family: "Source Serif 4",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Source+Serif+4",
    fallback: "Georgia, serif"
  },
  // ── Handwritten ─────────────────────────────────────────────
  {
    id: "caveat",
    family: "Caveat",
    category: "handwritten",
    weights: [400, 500, 600, 700],
    googleFontsId: "Caveat",
    fallback: "cursive"
  },
  {
    id: "patrick-hand",
    family: "Patrick Hand",
    category: "handwritten",
    weights: [400],
    googleFontsId: "Patrick+Hand",
    fallback: "cursive"
  },
  {
    id: "kalam",
    family: "Kalam",
    category: "handwritten",
    weights: [400, 700],
    googleFontsId: "Kalam",
    fallback: "cursive"
  },
  {
    id: "architects-daughter",
    family: "Architects Daughter",
    category: "handwritten",
    weights: [400],
    googleFontsId: "Architects+Daughter",
    fallback: "cursive"
  },
  // ── Monospace ───────────────────────────────────────────────
  {
    id: "dm-mono",
    family: "DM Mono",
    category: "monospace",
    weights: [400, 500],
    googleFontsId: "DM+Mono",
    fallback: "monospace"
  },
  {
    id: "jetbrains-mono",
    family: "JetBrains Mono",
    category: "monospace",
    weights: [400, 500, 600, 700],
    googleFontsId: "JetBrains+Mono",
    fallback: "monospace"
  },
  {
    id: "space-mono",
    family: "Space Mono",
    category: "monospace",
    weights: [400, 700],
    googleFontsId: "Space+Mono",
    fallback: "monospace"
  },
  {
    id: "fira-code",
    family: "Fira Code",
    category: "monospace",
    weights: [400, 500, 600, 700],
    googleFontsId: "Fira+Code",
    fallback: "monospace"
  },
  // ── Display ─────────────────────────────────────────────────
  {
    id: "bebas-neue",
    family: "Bebas Neue",
    category: "display",
    weights: [400],
    googleFontsId: "Bebas+Neue",
    fallback: "Impact, sans-serif"
  },
  {
    id: "righteous",
    family: "Righteous",
    category: "display",
    weights: [400],
    googleFontsId: "Righteous",
    fallback: "Impact, sans-serif"
  },
  {
    id: "fredoka",
    family: "Fredoka",
    category: "display",
    weights: [400, 500, 600, 700],
    googleFontsId: "Fredoka",
    fallback: "sans-serif"
  },
  {
    id: "permanent-marker",
    family: "Permanent Marker",
    category: "display",
    weights: [400],
    googleFontsId: "Permanent+Marker",
    fallback: "cursive"
  },
  // ── System ──────────────────────────────────────────────────
  {
    id: "georgia",
    family: "Georgia",
    category: "system",
    weights: [400, 700],
    googleFontsId: null,
    fallback: "serif"
  },
  {
    id: "system-mono",
    family: "monospace",
    category: "system",
    weights: [400],
    googleFontsId: null,
    fallback: ""
  }
];
var LEGACY_FONTS = [
  {
    id: "inter",
    family: "Inter",
    category: "sans-serif",
    weights: [300, 400, 500, 600, 700],
    googleFontsId: "Inter",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "outfit",
    family: "Outfit",
    category: "sans-serif",
    weights: [300, 400, 500, 600, 700],
    googleFontsId: "Outfit",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "plus-jakarta-sans",
    family: "Plus Jakarta Sans",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Plus+Jakarta+Sans",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "space-grotesk",
    family: "Space Grotesk",
    category: "sans-serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Space+Grotesk",
    fallback: "system-ui, sans-serif"
  },
  {
    id: "playfair-display",
    family: "Playfair Display",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Playfair+Display",
    fallback: "Georgia, serif"
  },
  {
    id: "lora",
    family: "Lora",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleFontsId: "Lora",
    fallback: "Georgia, serif"
  }
];
var FONT_PAIRINGS = [
  {
    id: "impact-friendly",
    name: "Impact + Friendly",
    heading: "Bebas Neue",
    body: "Nunito",
    mood: ["bold", "approachable", "educational"]
  },
  {
    id: "editorial-clean",
    name: "Editorial + Clean",
    heading: "Merriweather",
    body: "Work Sans",
    mood: ["editorial", "professional", "documentary"]
  },
  {
    id: "geometric-warmth",
    name: "Geometric + Warmth",
    heading: "Sora",
    body: "Bitter",
    mood: ["modern", "warm", "trustworthy"]
  },
  {
    id: "handmade-modern",
    name: "Handmade + Modern",
    heading: "Caveat",
    body: "Figtree",
    mood: ["casual", "creative", "whiteboard"]
  },
  {
    id: "bold-precise",
    name: "Bold + Precise",
    heading: "Righteous",
    body: "Manrope",
    mood: ["energetic", "technical", "startup"]
  },
  {
    id: "display-grotesk",
    name: "Display + Grotesk",
    heading: "Fredoka",
    body: "Bricolage Grotesque",
    mood: ["playful", "distinctive", "kids"]
  },
  {
    id: "classic-sans",
    name: "Classic + Sans",
    heading: "Vollkorn",
    body: "Sora",
    mood: ["scholarly", "elegant", "data"]
  },
  {
    id: "marker-clean",
    name: "Marker + Clean",
    heading: "Permanent Marker",
    body: "Work Sans",
    mood: ["raw", "informal", "sketch"]
  },
  {
    id: "mono-serif",
    name: "Mono + Serif",
    heading: "JetBrains Mono",
    body: "Source Serif 4",
    mood: ["technical", "code", "developer"]
  },
  {
    id: "grotesk-text",
    name: "Grotesk + Text",
    heading: "Bricolage Grotesque",
    body: "Nunito",
    mood: ["quirky", "friendly", "explainer"]
  }
];
var FONT_PAIRING_IDS = FONT_PAIRINGS.map((p) => p.id);
var _allFonts = [...FONT_CATALOG, ...LEGACY_FONTS];
var _byId = new Map(_allFonts.map((f) => [f.id, f]));
var _byFamily = new Map(_allFonts.map((f) => [f.family, f]));
var FONT_FAMILIES = FONT_CATALOG.map((f) => f.family);
function buildWeightSpec(font) {
  const weights = font.weights.sort((a, b) => a - b).join(";");
  return `family=${font.googleFontsId}:wght@${weights}`;
}
function resolveSceneFontFamily(familyOrId) {
  if (!familyOrId?.trim()) return "Nunito";
  const font = _byFamily.get(familyOrId) ?? _byId.get(familyOrId);
  return font?.family ?? familyOrId;
}
function sceneFontCssStack(familyOrId) {
  const font = _byFamily.get(familyOrId ?? "") ?? _byId.get(familyOrId ?? "");
  const primary = font?.family ?? (familyOrId?.trim() || "Nunito");
  const tail = font?.fallback ? `, ${font.fallback}` : ", system-ui, sans-serif";
  return `'${primary.replace(/'/g, "\\'")}'${tail}`;
}
function buildFontLink(familyOrId) {
  if (!familyOrId?.trim()) return "";
  const font = _byFamily.get(familyOrId) ?? _byId.get(familyOrId);
  if (!font || !font.googleFontsId) return "";
  const url = `https://fonts.googleapis.com/css2?${buildWeightSpec(font)}&display=swap`;
  return `<link href="${url}" rel="stylesheet">`;
}
function buildMultiFontLink(families) {
  const specs = families.map((f) => _byFamily.get(f)).filter((f) => !!f && !!f.googleFontsId).map(buildWeightSpec);
  if (specs.length === 0) return "";
  const url = `https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap`;
  return `<link href="${url}" rel="stylesheet">`;
}

// lib/scene-html/gsap-head.ts
var GSAP_HEAD = `
  <!-- GSAP (free, commercial use \u2014 all plugins free as of 3.13) -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/DrawSVGPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/MorphSVGPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/MotionPathPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/SplitText.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/TextPlugin.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14/dist/CustomEase.min.js"></script>
  <script>gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, SplitText, TextPlugin, CustomEase);</script>
  <!-- Lottie-web for LottieFiles animations -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
  <!-- CenchMotion component library -->
  <script src="/sdk/cench-motion.js"></script>
  <!-- CenchCamera cinematic camera motion -->
  <script src="/sdk/cench-camera.js"></script>
  <!-- CenchInteract interaction components -->
  <script src="/sdk/interaction-components.js"></script>
`;

// lib/scene-html/playback-controller.ts
var PLAYBACK_CONTROLLER = `
(function() {
  // \u2500\u2500 performance.now() interception \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  // \u2500\u2500 RAF interception \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      // Queue the callback \u2014 multiple consumers (scene code + TalkingHead) may register
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

  // \u2500\u2500 Master timeline \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

  // \u2500\u2500 Multi-track audio integration \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

    // Initial sync: refs exist now; timeline starts paused \u2014 keep media paused too
    try { syncMedia(false); } catch(e) {}
  });

  function syncMedia(playing) {
    // TTS
    if (ttsAudio) {
      try {
        if (playing) {
          ttsAudio.play().catch(function(err) {
            console.warn('[cench-playback] TTS play() failed (sandbox/autoplay?):', err);
            try {
              window.parent.postMessage({
                type: 'cench:audio-error',
                error: (err && err.message) || 'Audio playback failed',
                track: 'tts'
              }, '*');
            } catch(pe) {}
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
    // After play(), WAAPI owns playback \u2014 CSS paused alone does not freeze animations.
    if (!playing) {
      _pauseCSSAnimations();
    }
  }

  // \u2500\u2500 CSS animation control via Web Animations API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // SVG scenes use CSS @keyframes which can't be seeked by GSAP.
  // The Web Animations API gives us seekable Animation objects.
  // After seeking (which calls anim.pause()), we MUST call anim.play()
  // to resume \u2014 CSS animation-play-state alone can't override API pause.
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

  // \u2500\u2500 postMessage bridge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
        _resumeCSSAnimations();  // Must call anim.play() via API \u2014 CSS rule alone can't override API pause
        // Avatar sync \u2014 restore active mood + start speech on first play
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
        // Avatar sync \u2014 go idle (still breathes/blinks, stops speaking)
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
        // Avatar sync \u2014 reset to idle, allow speech restart
        if (window.__avatarHead) {
          try {
            if (window.__avatarHead.stopSpeaking) window.__avatarHead.stopSpeaking();
            window.__avatarHead.setMood('neutral');
            window.__avatarSpeechStarted = false;
          } catch(e) {}
        }
        postToParent({ type: 'reset' });
        break;

      // \u2500\u2500 Avatar live control (from settings panel) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

      // \u2500\u2500 Variable & interaction bridge (Phase 1b) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      case 'set_variable':
        if (cmd.name) {
          if (!window.__CENCH_VARIABLES) window.__CENCH_VARIABLES = {};
          window.__CENCH_VARIABLES[cmd.name] = cmd.value;
          // Dispatch custom event so React hooks (useVariable) can react
          try {
            window.dispatchEvent(new CustomEvent('cench:variable-changed', {
              detail: { name: cmd.name, value: cmd.value, source: 'parent' }
            }));
          } catch(e) {}
        }
        break;

      case 'get_variables':
        postToParent({
          type: 'variables_state',
          variables: window.__CENCH_VARIABLES || {},
        });
        break;

      case 'fire_trigger':
        // Parent fires a named trigger into the scene
        if (cmd.name) {
          try {
            window.dispatchEvent(new CustomEvent('cench:trigger', {
              detail: { name: cmd.name, payload: cmd.payload }
            }));
          } catch(e) {}
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

      case 'set-bg':
        if (cmd.color) {
          console.log('[Scene] set-bg received:', cmd.color);
          document.body.style.backgroundColor = cmd.color;
          // Walk down from #react-root to find the first element with an explicit
          // background (the AbsoluteFill wrapper that covers the scene)
          var rRoot = document.getElementById('react-root');
          if (rRoot) {
            var walker = rRoot;
            for (var d = 0; d < 6; d++) {
              var child = walker.firstElementChild;
              if (!child) break;
              var cs = window.getComputedStyle(child);
              var bg = cs.backgroundColor || cs.background;
              // If this element has a non-transparent background, override it
              if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                child.style.background = cmd.color;
                break;
              }
              walker = child;
            }
          }
          // Also update #scene-camera background for non-React scenes
          var cam = document.getElementById('scene-camera');
          if (cam) cam.style.backgroundColor = cmd.color;
        }
        break;
    }
  });

  // \u2500\u2500 Signal ready after all scripts execute \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.addEventListener('load', function() {
    _realSetTimeout(function() {
      postToParent({
        type: 'ready',
        duration: masterTL.duration(),
        sceneId: typeof SCENE_ID !== 'undefined' ? SCENE_ID : null,
      });
    }, 50);
  });

  // \u2500\u2500 Expose postToParent for CenchReact hooks \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // React hooks (useVariable, useInteraction, useTrigger) call this
  // to send events across the iframe boundary.
  window.__cenchPostToParent = postToParent;

  // Initialize variable store
  if (!window.__CENCH_VARIABLES) window.__CENCH_VARIABLES = {};

  // \u2500\u2500 Legacy compatibility \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
`;

// lib/scene-html/element-registry.ts
var ELEMENT_REGISTRY = `
(function() {
  // \u2500\u2500 Element registry \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.__elements = {};
  window.__selected = null;

  window.__register = function(element) {
    window.__elements[element.id] = element;
  };

  // \u2500\u2500 Hit detection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.__hitTest = function(x, y) {
    var elements = Object.values(window.__elements);
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      if (!el.bbox || el.visible === false) continue;
      if (
        x >= el.bbox.x && x <= el.bbox.x + el.bbox.w &&
        y >= el.bbox.y && y <= el.bbox.y + el.bbox.h
      ) {
        return el;
      }
    }
    return null;
  };

  function __physicsCardBodyScale() {
    var bodyStyle = document.body.style.transform || '';
    var m = bodyStyle.match(/scale\\(([^)]+)\\)/);
    if (m) return parseFloat(m[1]);
    return Math.min(window.innerWidth / (typeof WIDTH !== 'undefined' ? WIDTH : 1920), window.innerHeight / (typeof HEIGHT !== 'undefined' ? HEIGHT : 1080));
  }

  var __PHYSICS_CARD_PRESETS = {
    glass_dark: { bg: 'rgba(8,12,22,0.72)', border: 'rgba(255,255,255,0.18)', shadow: '0 14px 45px rgba(0,0,0,0.28)', text: '#ffffff', blur: 3 },
    glass_light: { bg: 'rgba(255,255,255,0.78)', border: 'rgba(0,0,0,0.12)', shadow: '0 14px 45px rgba(0,0,0,0.2)', text: '#0f172a', blur: 3 },
    neon: { bg: 'rgba(5,10,30,0.8)', border: 'rgba(56,189,248,0.55)', shadow: '0 0 0 1px rgba(56,189,248,0.4), 0 14px 45px rgba(56,189,248,0.24)', text: '#dbeafe', blur: 2 },
    chalk: { bg: 'rgba(22,25,35,0.86)', border: 'rgba(203,213,225,0.35)', shadow: '0 10px 30px rgba(0,0,0,0.35)', text: '#e2e8f0', blur: 1 },
  };

  function __setCardVar(root, name, val) {
    if (val === null || val === undefined || val === 'none' || val === '') root.style.removeProperty(name);
    else root.style.setProperty(name, String(val));
  }

  function __patchPhysicsCardDOM(element, property, value) {
    var root = document.getElementById('physics-explain-card-root');
    var canvas = element.canvasId ? document.getElementById(element.canvasId) : null;
    if (property === 'simScale' && canvas) {
      canvas.style.setProperty('--sim-scale', String(value));
      return;
    }
    if (property === 'visible') {
      if (root) root.style.display = value ? '' : 'none';
      return;
    }
    if (property === 'opacity') {
      if (root) root.style.setProperty('--card-opacity', String(value));
      return;
    }
    if (!root) return;
    if (property === 'cardPreset') {
      var pr = __PHYSICS_CARD_PRESETS[value] || __PHYSICS_CARD_PRESETS.glass_dark;
      root.style.setProperty('--card-bg', pr.bg);
      root.style.setProperty('--card-border', pr.border);
      root.style.setProperty('--card-shadow', pr.shadow);
      root.style.setProperty('--card-text', pr.text);
      root.style.setProperty('--card-blur', pr.blur + 'px');
      return;
    }
    if (property === 'cardX') root.style.left = value + '%';
    else if (property === 'cardY') root.style.top = value + '%';
    else if (property === 'cardWidth') root.style.width = value + '%';
    else if (property === 'cardBg') __setCardVar(root, '--card-bg', value);
    else if (property === 'cardBorder') __setCardVar(root, '--card-border', value);
    else if (property === 'cardShadow') __setCardVar(root, '--card-shadow', value);
    else if (property === 'cardText') __setCardVar(root, '--card-text', value);
    else if (property === 'cardBlur') root.style.setProperty('--card-blur', value + 'px');
    else if (property === 'cardRadius') root.style.setProperty('--card-radius', value + 'px');
    else if (property === 'cardPadding') root.style.setProperty('--card-padding', value + 'px');
    else if (property === 'titleSize') root.style.setProperty('--card-title-size', value + 'px');
    else if (property === 'bodySize') root.style.setProperty('--card-body-size', value + 'px');
    else if (property === 'equationSize') root.style.setProperty('--card-equation-size', value + 'px');
    else if (property === 'textAlign') root.style.setProperty('--card-text-align', String(value));
    else if (property === 'titleColor') {
      var t = document.querySelector('.scene-title');
      if (t) {
        if (value === null || value === 'none' || value === '') t.style.removeProperty('color');
        else t.style.color = String(value);
      }
    }
    else if (property === 'bodyColor') {
      var n = document.querySelector('.narration-text');
      if (n) {
        if (value === null || value === 'none' || value === '') n.style.removeProperty('color');
        else n.style.color = String(value);
      }
    }
  }

  // \u2500\u2500 Click handler \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  document.addEventListener('click', function(e) {
    // The scene body uses transform:scale(s) via fitToViewport().
    // e.clientX/Y are in the *scaled* viewport, so we need to
    // convert back to 1920x1080 scene coordinates.
    // Use the body's current CSS transform scale factor.
    var body = document.body;
    var bodyStyle = body.style.transform || '';
    var scaleMatch = bodyStyle.match(/scale\\(([^)]+)\\)/);
    var bodyScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    // If no body transform, fall back to viewport ratio
    if (!bodyScale || isNaN(bodyScale)) {
      bodyScale = Math.min(window.innerWidth / (typeof WIDTH !== 'undefined' ? WIDTH : 1920), window.innerHeight / (typeof HEIGHT !== 'undefined' ? HEIGHT : 1080));
    }
    var x = e.clientX / bodyScale;
    var y = e.clientY / bodyScale;

    var hit = window.__hitTest(x, y);

    if (hit) {
      window.__selected = hit.id;
      showSelectionHighlight(hit);
      window.parent.postMessage({
        source: 'cench-scene',
        type: 'element_selected',
        elementId: hit.id,
        element: JSON.parse(JSON.stringify(hit)),
      }, '*');
    } else {
      window.__selected = null;
      clearSelectionHighlight();
      window.parent.postMessage({
        source: 'cench-scene',
        type: 'element_deselected',
      }, '*');
    }
  });

  // \u2500\u2500 Selection highlight overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var highlightCanvas = null;

  function showSelectionHighlight(element) {
    if (!element.bbox) return;

    if (!highlightCanvas) {
      highlightCanvas = document.createElement('canvas');
      highlightCanvas.width = (typeof WIDTH !== 'undefined' ? WIDTH : 1920);
      highlightCanvas.height = (typeof HEIGHT !== 'undefined' ? HEIGHT : 1080);
      highlightCanvas.style.cssText =
        'position:absolute;inset:0;pointer-events:none;z-index:9999;';
      // Scale with the body
      var bodyTransform = document.body.style.transform;
      if (bodyTransform) {
        highlightCanvas.style.transformOrigin = 'top left';
      }
      document.body.appendChild(highlightCanvas);
    }

    var ctx = highlightCanvas.getContext('2d');
    var __w = (typeof WIDTH !== 'undefined' ? WIDTH : 1920);
    var __h = (typeof HEIGHT !== 'undefined' ? HEIGHT : 1080);
    ctx.clearRect(0, 0, __w, __h);

    var bx = element.bbox.x;
    var by = element.bbox.y;
    var bw = element.bbox.w;
    var bh = element.bbox.h;
    var pad = 8;

    // Dashed selection box
    ctx.strokeStyle = '#e84545';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);

    // Corner handles
    ctx.fillStyle = '#e84545';
    ctx.setLineDash([]);
    var corners = [
      [bx - pad, by - pad],
      [bx + bw + pad, by - pad],
      [bx - pad, by + bh + pad],
      [bx + bw + pad, by + bh + pad],
    ];
    corners.forEach(function(c) {
      ctx.fillRect(c[0] - 4, c[1] - 4, 8, 8);
    });

    // Element label
    ctx.fillStyle = '#e84545';
    ctx.font = '20px DM Mono, monospace';
    ctx.fillText(element.label || element.id, bx - pad, by - pad - 8);
  }

  function clearSelectionHighlight() {
    if (highlightCanvas) {
      var ctx = highlightCanvas.getContext('2d');
      ctx.clearRect(0, 0, (typeof WIDTH !== 'undefined' ? WIDTH : 1920), (typeof HEIGHT !== 'undefined' ? HEIGHT : 1080));
    }
  }

  // \u2500\u2500 Highlight from parent (when selecting in layers panel) \u2500\u2500
  window.__highlightElement = function(elementId) {
    var el = window.__elements[elementId];
    if (el) {
      window.__selected = elementId;
      showSelectionHighlight(el);
    }
  };

  window.__clearHighlight = function() {
    window.__selected = null;
    clearSelectionHighlight();
  };

  // \u2500\u2500 Property patching from parent \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.target !== 'cench-scene') return;

    if (e.data.type === 'patch_element') {
      var elementId = e.data.elementId;
      var property = e.data.property;
      var value = e.data.value;
      var element = window.__elements[elementId];
      if (!element) return;

      element[property] = value;

      if (element.type === 'physics-card') {
        __patchPhysicsCardDOM(element, property, value);
        var root = document.getElementById('physics-explain-card-root');
        if (root && window.__selected === elementId) {
          var r = root.getBoundingClientRect();
          var s = __physicsCardBodyScale();
          element.bbox = { x: r.left / s, y: r.top / s, w: r.width / s, h: r.height / s };
          showSelectionHighlight(element);
        }
        if (window.__tl && !window.__tl.isActive()) {
          try { window.__tl.seek(window.__tl.time()); } catch(ignore) {}
        }
        return;
      }

      // Re-render: for canvas2d, call redrawAll if it exists
      if (window.__redrawAll) {
        window.__redrawAll();
      }
      // For DOM elements (React scenes), patch via style
      var domEl = document.getElementById(elementId);
      if (domEl && (element.type === 'dom-text' || element.type === 'dom-container' || element.type === 'dom-image')) {
        if (property === 'text') {
          domEl.textContent = value;
        } else if (property === 'visible') {
          domEl.style.display = value ? '' : 'none';
        } else if (property === 'opacity') {
          domEl.style.opacity = String(value);
        } else if (property === 'src' && domEl.tagName === 'IMG') {
          domEl.src = value;
        } else {
          // CSS properties \u2014 camelCase keys map directly to style
          domEl.style[property] = (typeof value === 'number') ? (value + 'px') : String(value);
        }
        // Update bbox after patch
        try {
          var s = __physicsCardBodyScale();
          var r = domEl.getBoundingClientRect();
          element.bbox = { x: r.left / s, y: r.top / s, w: r.width / s, h: r.height / s };
        } catch(ignored) {}
      }
      // For SVG, apply attribute directly to the DOM node
      else if (domEl) {
        // Map element properties to DOM attributes
        if (property === 'fill' || property === 'stroke') {
          domEl.setAttribute(property, value || 'none');
        } else if (property === 'strokeWidth') {
          domEl.setAttribute('stroke-width', value);
        } else if (property === 'fillOpacity') {
          domEl.setAttribute('fill-opacity', value);
        } else if (property === 'opacity') {
          domEl.setAttribute('opacity', value);
        } else if (property === 'visible') {
          domEl.style.display = value ? '' : 'none';
        } else if (property === 'text') {
          domEl.textContent = value;
        } else if (property === 'fontSize') {
          domEl.setAttribute('font-size', value);
        } else if (property === 'fontFamily') {
          domEl.setAttribute('font-family', value);
        } else if (property === 'fontWeight') {
          domEl.setAttribute('font-weight', value);
        } else if (property === 'textAnchor') {
          domEl.setAttribute('text-anchor', value);
        } else if (['x','y','cx','cy','r','rx','ry','width','height','x1','y1','x2','y2'].indexOf(property) !== -1) {
          domEl.setAttribute(property, value);
          // Update bbox for selection highlight
          try {
            var nb = domEl.getBBox();
            element.bbox = { x: nb.x, y: nb.y, w: nb.width, h: nb.height };
          } catch(ignored) {}
        }
      }

      // Update selection highlight if this element is selected
      if (window.__selected === elementId && element.bbox) {
        showSelectionHighlight(element);
      }

      // Re-seek timeline to current time to show the change
      if (window.__tl && !window.__tl.isActive()) {
        window.__tl.seek(window.__tl.time());
      }
    }

    if (e.data.type === 'highlight_element') {
      if (e.data.elementId) {
        window.__highlightElement(e.data.elementId);
      } else {
        window.__clearHighlight();
      }
    }

    if (e.data.type === 'get_elements') {
      window.parent.postMessage({
        source: 'cench-scene',
        type: 'elements_list',
        elements: JSON.parse(JSON.stringify(window.__elements)),
      }, '*');
    }
  });

  // \u2500\u2500 Auto-register SVG elements on load \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var SVG_SCAN_TAGS = 'rect,circle,ellipse,line,polyline,polygon,path,text,g,image,use';

  window.addEventListener('load', function() {
    // Scan ALL visible SVG elements (not just those with id)
    // Skip SVGs inside #react-root \u2014 those are part of React components
    // and will be handled by the DOM scan if they have data-label
    var autoIdx = 0;
    var rRoot = document.getElementById('react-root');
    document.querySelectorAll('svg').forEach(function(svg) {
      if (rRoot && rRoot.contains(svg)) return;
      svg.querySelectorAll(SVG_SCAN_TAGS).forEach(function(el) {
        // Assign stable id if missing
        if (!el.id) {
          el.id = 'auto-' + el.tagName.toLowerCase() + '-' + (autoIdx++);
        }
        // Skip if already registered by scene code
        if (window.__elements[el.id]) return;

        // Skip invisible or tiny elements
        var bbox;
        try {
          var b = el.getBBox();
          bbox = { x: b.x, y: b.y, w: b.width, h: b.height };
          // Skip zero-size elements (markers, defs, clip-paths)
          if (bbox.w < 2 && bbox.h < 2) return;
        } catch(e) {
          return; // Can't measure = not renderable
        }

        // Skip elements inside <defs>, <clipPath>, <mask>, <pattern>
        var skip = false;
        var parent = el.parentElement;
        while (parent && parent !== svg) {
          var pTag = parent.tagName.toLowerCase();
          if (pTag === 'defs' || pTag === 'clippath' || pTag === 'mask' || pTag === 'pattern' || pTag === 'marker') { skip = true; break; }
          parent = parent.parentElement;
        }
        if (skip) return;

        var tagName = el.tagName.toLowerCase();
        var type = 'svg-shape';
        if (tagName === 'text' || tagName === 'tspan') type = 'svg-text';
        else if (tagName === 'path') type = 'svg-path';
        else if (tagName === 'rect') type = 'svg-shape';
        else if (tagName === 'circle' || tagName === 'ellipse') type = 'svg-shape';
        else if (tagName === 'line' || tagName === 'polyline' || tagName === 'polygon') type = 'svg-shape';
        else if (tagName === 'image') type = 'svg-shape';
        else if (tagName === 'g') type = 'svg-shape';

        // Build readable label
        var autoLabel = el.dataset ? el.dataset.label : null;
        if (!autoLabel) {
          if (type === 'svg-text') {
            autoLabel = (el.textContent || '').trim().slice(0, 30) || 'Text';
          } else {
            autoLabel = tagName + (el.id && !el.id.startsWith('auto-') ? '#' + el.id : ' ' + (autoIdx));
          }
        }

        // Extract computed style for inherited properties
        var cs = window.getComputedStyle(el);

        window.__register({
          id: el.id,
          type: type,
          label: autoLabel,
          bbox: bbox,
          stroke: el.getAttribute('stroke') || cs.stroke || 'none',
          strokeWidth: parseFloat(el.getAttribute('stroke-width') || cs.strokeWidth || '0'),
          fill: el.getAttribute('fill') || cs.fill || 'none',
          fillOpacity: parseFloat(el.getAttribute('fill-opacity') || '1'),
          opacity: parseFloat(el.getAttribute('opacity') || cs.opacity || '1'),
          visible: el.style.display !== 'none' && cs.display !== 'none',
          animStartTime: 0,
          animDuration: 0,
          text: (type === 'svg-text') ? (el.textContent || '') : '',
          fontSize: parseFloat(el.getAttribute('font-size') || cs.fontSize || '16'),
          fontFamily: el.getAttribute('font-family') || cs.fontFamily || '',
          x: parseFloat(el.getAttribute('x') || el.getAttribute('cx') || '0'),
          y: parseFloat(el.getAttribute('y') || el.getAttribute('cy') || '0'),
        });
      });
    });

    // \u2500\u2500 Auto-register DOM elements (React scenes) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // React 18 createRoot().render() is async \u2014 DOM may not exist at load time.
    // We use a single retry-based scan that waits for React to render.
    function __scanReactDOM(root) {
      var domIdx = 0;
      var bodyScale = __physicsCardBodyScale();
      var registered = {};
      var candidates = [];

      // Pass 1: elements with explicit data-label (highest priority)
      root.querySelectorAll('[data-label]').forEach(function(el) {
        candidates.push(el);
      });
      // Pass 2: leaf text elements
      root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li').forEach(function(el) {
        if (!el.dataset || !el.dataset.label) candidates.push(el);
      });
      // Pass 3: images
      root.querySelectorAll('img').forEach(function(el) {
        candidates.push(el);
      });

      candidates.forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;

        // Skip if an ancestor is already registered
        var ancestor = el.parentElement;
        while (ancestor && ancestor !== root) {
          if (registered[ancestor.id]) return;
          ancestor = ancestor.parentElement;
        }

        var tag = el.tagName.toLowerCase();
        var isTextTag = /^(h[1-6]|p|li|span|a|button)$/.test(tag);
        var hasLabel = el.dataset && el.dataset.label;
        var hasDirectText = (el.textContent || '').trim().length > 0;
        var isText = isTextTag || (hasLabel && hasDirectText && !(/^(img|svg|canvas|video)$/.test(tag)));
        var isImage = tag === 'img';

        if (isText && !(el.textContent || '').trim()) return;

        if (!el.id) el.id = 'cench-' + tag + '-' + (domIdx++);
        if (window.__elements[el.id]) return;

        var label = hasLabel ? el.dataset.label : null;
        if (!label) {
          if (isText) label = (el.textContent || '').trim().slice(0, 40) || tag;
          else if (isImage) { var src = el.getAttribute('src') || ''; label = src.split('/').pop().split('?')[0] || 'Image'; }
          else label = tag + ' element';
        }

        registered[el.id] = true;
        window.__register({
          id: el.id,
          type: isText ? 'dom-text' : isImage ? 'dom-image' : 'dom-container',
          label: label,
          bbox: { x: rect.left / bodyScale, y: rect.top / bodyScale, w: rect.width / bodyScale, h: rect.height / bodyScale },
          visible: true, opacity: parseFloat(cs.opacity) || 1,
          animStartTime: 0, animDuration: 0,
          text: isText ? (el.textContent || '') : '',
          color: cs.color, backgroundColor: cs.backgroundColor,
          fontSize: parseFloat(cs.fontSize) || 16, fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight, textAlign: cs.textAlign,
          padding: cs.padding, borderRadius: parseFloat(cs.borderRadius) || 0,
          gap: cs.gap || '0px', display: cs.display, flexDirection: cs.flexDirection,
          alignItems: cs.alignItems, justifyContent: cs.justifyContent,
          src: isImage ? el.getAttribute('src') : undefined, objectFit: cs.objectFit,
          width: rect.width / bodyScale, height: rect.height / bodyScale,
        });
      });
    }

    function __reportElements() {
      window.parent.postMessage({
        source: 'cench-scene',
        type: 'elements_list',
        elements: JSON.parse(JSON.stringify(window.__elements)),
      }, '*');
    }

    var rr = document.getElementById('react-root');
    if (rr) {
      // Always wait for React to render (createRoot is async)
      var attempts = 0;
      var waitForReact = setInterval(function() {
        attempts++;
        if (rr.children.length > 0 || attempts > 50) {
          clearInterval(waitForReact);
          if (rr.children.length > 0) __scanReactDOM(rr);
          __reportElements();
        }
      }, 80);
    } else {
      // No React root \u2014 just report SVG elements
      setTimeout(__reportElements, 100);
    }
  });
})();
`;

// lib/audio/normalize.ts
var DEFAULT_AUDIO_LAYER = {
  enabled: false,
  src: null,
  volume: 1,
  fadeIn: false,
  fadeOut: false,
  startOffset: 0,
  tts: null,
  sfx: [],
  music: null
};
function normalizeAudioLayer(raw) {
  if (!raw) return { ...DEFAULT_AUDIO_LAYER };
  if ("tts" in raw && raw.tts !== void 0) {
    return {
      ...raw,
      sfx: raw.sfx ?? [],
      music: raw.music ?? null
    };
  }
  return {
    ...raw,
    tts: raw.src ? {
      text: "",
      provider: "elevenlabs",
      voiceId: null,
      src: raw.src,
      status: "ready",
      duration: null,
      instructions: null
    } : null,
    sfx: [],
    music: null
  };
}

// lib/avatars/talkinghead-models.ts
var TALKING_HEAD_SAMPLE_CDN_BASE = "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars";
var TALKING_HEAD_AVATAR_MODELS = [
  { id: "brunette", label: "Brunette presenter (local)", path: "/avatars/brunette.glb" },
  { id: "mpfb", label: "MPFB professional (local)", path: "/avatars/mpfb.glb" },
  {
    id: "brunette_remote",
    label: "Brunette presenter (CDN)",
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/brunette.glb`
  },
  {
    id: "mpfb_remote",
    label: "MPFB professional (CDN)",
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/mpfb.glb`
  },
  {
    id: "brunette_t",
    label: "Brunette compact (CDN)",
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/brunette-t.glb`
  },
  {
    id: "avaturn",
    label: "Avaturn sample (CDN)",
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/avaturn.glb`
  },
  {
    id: "avatarsdk",
    label: "AvatarSDK sample (CDN)",
    path: `${TALKING_HEAD_SAMPLE_CDN_BASE}/avatarsdk.glb`
  }
];
var MODEL_IDS = new Set(TALKING_HEAD_AVATAR_MODELS.map((m) => m.id));
var PATH_BY_ID = Object.fromEntries(TALKING_HEAD_AVATAR_MODELS.map((m) => [m.id, m.path]));
var DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER = {
  friendly: "brunette",
  professional: "mpfb",
  energetic: "brunette"
};
function isTalkingHeadModelId(id) {
  return !!id && MODEL_IDS.has(id);
}
function getTalkingHeadGlbPath(modelId) {
  if (isTalkingHeadModelId(modelId)) return PATH_BY_ID[modelId];
  return PATH_BY_ID.brunette;
}
function resolveTalkingHeadModelId(narrationScript, url) {
  const fromNs = narrationScript?.avatarModelId;
  if (isTalkingHeadModelId(fromNs)) return fromNs;
  if (url) {
    const fromUrl = url.searchParams.get("model");
    if (isTalkingHeadModelId(fromUrl)) return fromUrl;
    const ch = url.searchParams.get("character") || null;
    if (ch && DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[ch]) {
      return DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[ch];
    }
  }
  const c = narrationScript?.character ?? "friendly";
  return DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[c] ?? "brunette";
}
function resolveTalkingHeadModelIdFromLayer(layer) {
  const ns = layer.narrationScript ?? layer.avatarSceneConfig?.narrationScript ?? void 0;
  let u = null;
  try {
    if (layer.talkingHeadUrl?.startsWith("talkinghead://")) {
      u = new URL(layer.talkingHeadUrl);
    }
  } catch {
    u = null;
  }
  return resolveTalkingHeadModelId(ns, u);
}

// lib/sceneTemplate.ts
function buildSceneFontLinks(style) {
  const unique = [...new Set([style.font, style.bodyFont].filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return buildFontLink(unique[0]);
  return buildMultiFontLink(unique);
}
function canvasBgTag(W = 1920, H = 1080) {
  return `<canvas id="c" width="${W}" height="${H}" style="display:block;position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;margin:0;padding:0;border:0;pointer-events:none;"></canvas>`;
}
function sceneUsesCanvasBackground(scene) {
  return !!scene.canvasBackgroundCode?.trim() && ["motion", "d3", "svg", "physics", "react"].includes(scene.sceneType ?? "");
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeJsString(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/<\/script/gi, "<\\/script");
}
function sanitizeCssBlock(s) {
  return s.replace(/<\/style/gi, "/* escaped */");
}
function safeHexToRgb(hex) {
  const h = (hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h) && !/^[0-9a-fA-F]{3}$/.test(h)) return "0,0,0";
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`;
}
function generateAudioHTML(audioLayer) {
  const al = normalizeAudioLayer(audioLayer);
  if (!al.enabled) return "";
  const parts = [];
  const vol = Math.min(1, Math.max(0, Number(al.volume)));
  const startOff = Number.isFinite(al.startOffset) && al.startOffset > 0 ? al.startOffset : 0;
  const volAttr = Number.isFinite(vol) ? vol : 1;
  const dataVol = ` data-volume="${volAttr}"`;
  const dataOff = ` data-start-offset="${startOff}"`;
  if (al.tts?.src && al.tts.status === "ready") {
    parts.push(`<audio id="scene-tts" src="${al.tts.src}" data-track="tts"${dataVol}${dataOff} preload="auto"></audio>`);
  } else if (al.tts && !al.tts.src && al.tts.status === "ready") {
    parts.push(
      `<div id="scene-tts-config" data-provider="${al.tts.provider}" data-text="${escapeAttr(al.tts.text)}" data-voice="${al.tts.voiceId ?? ""}" style="display:none"></div>`
    );
  } else if (al.src) {
    parts.push(`<audio id="scene-audio" src="${al.src}"${dataVol}${dataOff} preload="auto"></audio>`);
  }
  for (const sfx of al.sfx ?? []) {
    parts.push(
      `<audio id="sfx-${sfx.id}" src="${sfx.src}" data-track="sfx" data-trigger-at="${sfx.triggerAt}" data-volume="${sfx.volume}" preload="auto"></audio>`
    );
  }
  if (al.music?.src) {
    parts.push(
      `<audio id="scene-music" src="${al.music.src}" data-track="music" data-volume="${al.music.volume}" ${al.music.loop ? "loop" : ""} data-duck="${al.music.duckDuringTTS}" data-duck-level="${al.music.duckLevel}" preload="auto"></audio>`
    );
  }
  return parts.join("\n  ");
}
function generateAILayersHTML(layers2, audioSettings) {
  if (!layers2 || layers2.length === 0) return "";
  return layers2.filter((l) => l.status === "ready").map((layer) => {
    switch (layer.type) {
      case "avatar":
        return generateAvatarLayerHTML(layer, audioSettings);
      case "veo3":
        return generateVeo3LayerHTML(layer);
      case "image":
        return generateImageLayerHTML(layer);
      case "sticker":
        return generateStickerLayerHTML(layer);
      default:
        return "";
    }
  }).join("\n  ");
}
function generateAvatarLayerHTML(layer, audioSettings) {
  const startAt = layer.startAt ?? 0;
  const placement = layer.avatarPlacement;
  const talkingHeadUrl = layer.talkingHeadUrl;
  const ns = layer.narrationScript;
  const pipShape = ns?.pipShape ?? "circle";
  const containerEnabled = ns?.containerEnabled !== false;
  const avatarScale = ns?.avatarScale ?? 1.15;
  if (talkingHeadUrl) {
    return generateTalkingHeadHTML(layer, talkingHeadUrl, placement, audioSettings);
  }
  if (!layer.videoUrl) return "";
  const posStyle = getAvatarPlacementCSS(placement, ns?.pipSize, pipShape, containerEnabled);
  const videoStyle = `${posStyle.media}transform:scale(${avatarScale});transform-origin:center bottom;`;
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};${posStyle.container}">
  <video
    id="${layer.id}-video"
    style="${videoStyle}"
    src="${layer.videoUrl}"
    playsinline
    muted>
  </video>
  <script>
    // Sync avatar video to GSAP timeline (no autoplay)
    window.addEventListener('load', function() {
      var v = document.getElementById('${layer.id}-video');
      if (!v || !window.__tl) return;
      window.__tl.call(function() { v.play(); }, null, ${startAt});
      window.__tl.call(function() { v.pause(); }, null, ${startAt} + (v.duration || 30));
    });
  </script>
</div>`;
}
function getAvatarPlacementCSS(placement, pipSize, pipShape, containerEnabled = true) {
  if (placement === "fullscreen") {
    return {
      container: "position:absolute;inset:0;",
      media: "width:100%;height:100%;object-fit:cover;"
    };
  }
  if (placement === "fullscreen_left") {
    return {
      container: "position:absolute;left:0;bottom:0;width:40%;height:100%;",
      media: "width:100%;height:100%;object-fit:cover;"
    };
  }
  if (placement === "fullscreen_right") {
    return {
      container: "position:absolute;right:0;bottom:0;width:40%;height:100%;",
      media: "width:100%;height:100%;object-fit:cover;"
    };
  }
  const pipPositions = {
    pip_bottom_right: "bottom:40px;right:40px;",
    pip_bottom_left: "bottom:40px;left:40px;",
    pip_top_right: "top:40px;right:40px;"
  };
  const pos = pipPositions[placement ?? "pip_bottom_right"] ?? pipPositions.pip_bottom_right;
  const size = pipSize ?? 280;
  const radius = pipShape === "square" ? "0" : pipShape === "rounded" ? "16px" : "50%";
  const containerChrome = containerEnabled ? "overflow:hidden;border:3px solid rgba(255,255,255,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.4);" : "overflow:visible;border:none;box-shadow:none;background:transparent;";
  return {
    container: `position:absolute;${pos}width:${size}px;height:${size}px;border-radius:${radius};${containerChrome}`,
    media: "width:100%;height:100%;object-fit:cover;"
  };
}
function hasServerTTS() {
  return !!(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_TTS_API_KEY || process.env.EDGE_TTS_URL);
}
function talkingHeadTtsEndpointForEmbed(audioSettings) {
  if (!hasServerTTS()) return null;
  const p = getBestTTSProvider(audioSettings ?? void 0);
  if (p === "web-speech" || p === "puter") return null;
  return "/api/tts/talkinghead";
}
function talkingHeadTtsEndpointJsLiteral(audioSettings) {
  const ep = talkingHeadTtsEndpointForEmbed(audioSettings);
  return ep == null ? "null" : JSON.stringify(ep);
}
function generateTalkingHeadHTML(layer, talkingHeadUrl, placement, audioSettings) {
  const params = new URL(talkingHeadUrl);
  const audioSrc = params.searchParams.get("audio") || "";
  const ns = layer.narrationScript;
  const textFromUrl = params.searchParams.get("text") || "";
  const textFromLines = ns?.lines?.length ? ns.lines.map((l) => l.text).join(" ") : "";
  const text2 = textFromUrl || textFromLines || (layer.script || "").trim();
  const character = ns?.character ?? params.searchParams.get("character") ?? "friendly";
  const mood = ns?.mood ?? "happy";
  const view = ns?.view ?? "upper";
  const eyeContact = ns?.eyeContact ?? 0.7;
  const headMovement = ns?.lipsyncHeadMovement !== false;
  const fakeLipsync = ns?.fakeLipsync === true;
  const enterAt = ns?.enterAt ?? layer.startAt ?? 0;
  const exitAt = ns?.exitAt;
  const entrance = ns?.entranceAnimation ?? "fade";
  const exitAnim = ns?.exitAnimation ?? "fade";
  const pipShape = ns?.pipShape ?? "circle";
  const avatarScale = ns?.avatarScale ?? 1.15;
  const containerEnabled = ns?.containerEnabled !== false;
  const cBlur = ns?.containerBlur ?? 0;
  const cBorderColor = ns?.containerBorderColor ?? "#ffffff";
  const cBorderOpacity = ns?.containerBorderOpacity ?? 0.3;
  const cBorderWidth = ns?.containerBorderWidth ?? 3;
  const cShadowOpacity = ns?.containerShadowOpacity ?? 0.4;
  const cInnerGlow = ns?.containerInnerGlow ?? 0;
  const cBgOpacity = ns?.containerBgOpacity ?? 1;
  const effectivePlacement = ns?.position ?? placement;
  const posStyle = getAvatarPlacementCSS(effectivePlacement, ns?.pipSize, pipShape, containerEnabled);
  const containerId = `${layer.id}-talkinghead`;
  const fallbackId = `${layer.id}-fallback`;
  const characterEmoji = { friendly: "\u{1F60A}", professional: "\u{1F454}", energetic: "\u26A1" };
  const characterColor = { friendly: "#6366f1", professional: "#0ea5e9", energetic: "#f59e0b" };
  const emoji = characterEmoji[character] || "\u{1F399}\uFE0F";
  const bgColor = ns?.background ?? characterColor[character] ?? "#6366f1";
  const pipGlbUrl = getTalkingHeadGlbPath(resolveTalkingHeadModelIdFromLayer(layer));
  const bgRgb = safeHexToRgb(bgColor);
  const borderRgb = safeHexToRgb(cBorderColor);
  const glassBg = cBlur > 0 ? `rgba(${bgRgb},${cBgOpacity})` : bgColor;
  const glassBackdrop = cBlur > 0 ? `backdrop-filter:blur(${cBlur}px) saturate(180%);-webkit-backdrop-filter:blur(${cBlur}px) saturate(180%);` : "";
  const glassBorder = `border:${cBorderWidth}px solid rgba(${borderRgb},${cBorderOpacity});`;
  const glassShadow = [
    cShadowOpacity > 0 ? `0 8px 32px rgba(0,0,0,${cShadowOpacity})` : "",
    cInnerGlow > 0 ? `inset 0 1px 0 rgba(255,255,255,${Math.min(cInnerGlow, 1)})` : "",
    cInnerGlow > 0 ? `inset 0 0 20px 10px rgba(${bgRgb},${cInnerGlow})` : ""
  ].filter(Boolean).join(",");
  const wrapperVisualStyle = containerEnabled ? `background:${glassBg};${glassBackdrop}${glassBorder}box-shadow:${glassShadow || "none"};` : "background:transparent;border:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;";
  const contentOverflow = containerEnabled ? "overflow:hidden;border-radius:inherit;" : "overflow:visible;border-radius:0;";
  const fallbackBg = containerEnabled ? `background:linear-gradient(135deg, ${bgColor}, ${bgColor}dd);` : "background:transparent;";
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:0;z-index:${layer.zIndex};${posStyle.container}${wrapperVisualStyle}transition:opacity 0.4s;">
  <div id="${containerId}" style="width:100%;height:100%;position:absolute;inset:0;${contentOverflow}z-index:0;transform:scale(${avatarScale});transform-origin:center bottom;"></div>
  <div id="${fallbackId}" style="width:100%;height:100%;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;${fallbackBg}z-index:1;border-radius:inherit;">
    <div style="font-size:64px;line-height:1;animation:pulse-avatar 2s ease-in-out infinite;">${emoji}</div>
    <div id="${fallbackId}-status" style="font-size:10px;color:rgba(255,255,255,0.6);margin-top:8px;font-family:system-ui;letter-spacing:0.5px;">Loading 3D...</div>
  </div>
  <style>
    @keyframes pulse-avatar { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  </style>
  <script type="module">
    (async function() {
      const fallback = document.getElementById('${fallbackId}');
      const statusEl = document.getElementById('${fallbackId}-status');
      const container = document.getElementById('${containerId}');
      const wrapper = document.getElementById('${layer.id}');
      if (!container) return;

      // Wait for container to have dimensions (iframe may be display:none initially)
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        if (statusEl) statusEl.textContent = 'Waiting for visibility...';
        await new Promise((resolve) => {
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                  ro.disconnect(); resolve(); return;
                }
              }
            });
            ro.observe(container);
          } else {
            const iv = setInterval(() => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) { clearInterval(iv); resolve(); }
            }, 200);
          }
        });
      }

      try {
        if (statusEl) statusEl.textContent = 'Loading TalkingHead...';
        const mod = await import('https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs');
        const TalkingHead = mod.TalkingHead;
        if (!TalkingHead) { console.error('[TalkingHead] Not in module exports'); return; }

        if (statusEl) statusEl.textContent = 'Initializing 3D...';

        // Restore native RAF \u2014 TalkingHead's Three.js loop must not be blocked
        if (window.__nativeRAF) window.requestAnimationFrame = window.__nativeRAF;
        if (window.__nativeCAF) window.cancelAnimationFrame = window.__nativeCAF;
        window.__rafUnlocked = true;

        const head = new TalkingHead(container, {
          ttsEndpoint: ${talkingHeadTtsEndpointJsLiteral(audioSettings)},
          ttsLang: 'en-US',
          cameraView: '${view}',
          cameraRotateEnable: false,
          avatarSpeakingEyeContact: ${eyeContact},
          avatarIdleEyeContact: ${Math.max(0, eyeContact - 0.2)},
        });

        const vrmUrl = ${JSON.stringify(pipGlbUrl)};
        if (statusEl) statusEl.textContent = 'Loading avatar model...';
        await head.showAvatar({
          url: vrmUrl, body: 'F', lipsyncLang: 'en',
          lipsyncHeadMovement: ${headMovement},
        }, (e) => {
          if (statusEl && e.total) statusEl.textContent = 'Loading ' + Math.round(100 * e.loaded / e.total) + '%';
        });

        // 3D loaded \u2014 remove fallback
        if (fallback) fallback.style.display = 'none';

        // Start in neutral idle (breathing/blinking). Active mood set on play.
        head.setMood('neutral');

        // Expose for playback controller + settings panel postMessage commands
        window.__avatarHead = head;
        window.__avatarMood = '${mood}';
        window.__avatarSpeechStarted = false;

        // \u2500\u2500 Entrance / exit via GSAP timeline \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        if (window.__tl) {
          ${entrance === "scale-in" ? `wrapper.style.transform = 'scale(0)';
          window.__tl.to(wrapper, { opacity: 1, scale: 1, duration: 0.4 }, ${enterAt});` : entrance === "slide-up" ? `wrapper.style.transform = 'translateY(40px)';
          window.__tl.to(wrapper, { opacity: 1, y: 0, duration: 0.4 }, ${enterAt});` : `window.__tl.to(wrapper, { opacity: 1, duration: 0.4 }, ${enterAt});`}
          ${exitAt != null ? exitAnim === "scale-out" ? `window.__tl.to(wrapper, { opacity: 0, scale: 0, duration: 0.4 }, ${exitAt});` : exitAnim === "slide-down" ? `window.__tl.to(wrapper, { opacity: 0, y: 40, duration: 0.4 }, ${exitAt});` : `window.__tl.to(wrapper, { opacity: 0, duration: 0.4 }, ${exitAt});` : ""}
        } else {
          wrapper.style.opacity = '1';
        }

        // \u2500\u2500 Speech with lip sync: speakAudio (server/URL) drives mouth; Web Speech + jaw fallback \u2500\u2500
        function __cenchTraverseFaceMesh(root) {
          if (!root || !root.traverse) return null;
          var found = null;
          var preferred = [
            'jawOpen', 'mouthOpen', 'jaw_lower', 'Jaw_Open', 'aac', 'viseme_aa', 'viseme_A',
            'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthSmile', 'mouthFunnel',
          ];
          root.traverse(function (child) {
            if (found || !child.isMesh || !child.morphTargetDictionary) return;
            var d = child.morphTargetDictionary;
            var i, k;
            for (i = 0; i < preferred.length; i++) {
              k = preferred[i];
              if (k in d) { found = child; return; }
            }
            var names = Object.keys(d);
            for (i = 0; i < names.length; i++) {
              var n = names[i];
              var lower = n.toLowerCase();
              if (lower.indexOf('jaw') !== -1 || lower.indexOf('mouth') !== -1 || n.indexOf('viseme_') === 0) {
                found = child;
                return;
              }
            }
          });
          return found;
        }

        function __cenchFindFaceMeshForLipSync(h, domContainer) {
          var roots = [h.nodeAvatar, h.scene, h.avatar, domContainer].filter(Boolean);
          var ri;
          for (ri = 0; ri < roots.length; ri++) {
            var m = __cenchTraverseFaceMesh(roots[ri]);
            if (m) return m;
          }
          return null;
        }

        function __cenchApplyMouthJaw(md, mt, jaw) {
          var pairs = [
            ['jawOpen', jaw],
            ['mouthOpen', jaw],
            ['jaw_lower', jaw * 0.92],
            ['Jaw_Open', jaw],
            ['aac', jaw * 0.7],
            ['viseme_aa', jaw * 0.55],
            ['viseme_A', jaw * 0.5],
            ['viseme_E', jaw * 0.45],
            ['viseme_I', jaw * 0.35],
            ['viseme_O', jaw * 0.38],
            ['viseme_U', jaw * 0.32],
          ];
          for (var pi = 0; pi < pairs.length; pi++) {
            var nm = pairs[pi][0];
            var v = pairs[pi][1];
            if (nm in md) mt[md[nm]] = v;
          }
        }

        async function __cenchSpeakServerTtsToHead(endpoint, txt) {
          if (!endpoint || !txt) return false;
          try {
            var r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: txt },
                voice: { languageCode: 'en-US', name: '' },
                audioConfig: { audioEncoding: 'MP3' },
              }),
            });
            if (!r.ok) return false;
            var data = await r.json();
            if (!data.audioContent) return false;
            var binary = atob(data.audioContent);
            var len = binary.length;
            var bytes = new Uint8Array(len);
            var i;
            for (i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            var AC = window.AudioContext || window.webkitAudioContext;
            var audioCtx = new AC();
            try {
              if (audioCtx.state === 'suspended') await audioCtx.resume();
            } catch (e0) {}
            var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            var audioBuf = await audioCtx.decodeAudioData(ab);
            var words = txt.split(/\\s+/).filter(Boolean);
            if (!words.length) words = ['...'];
            var totalMs = audioBuf.duration * 1000;
            var perWord = totalMs / (words.length || 1);
            head.speakAudio({
              audio: audioBuf,
              words: words,
              wtimes: words.map(function (_, wi) { return Math.round(wi * perWord); }),
              wdurations: words.map(function () { return Math.round(perWord * 0.9); }),
            });
            return true;
          } catch (e) {
            console.warn('[TalkingHead] server TTS speakAudio failed:', e);
            return false;
          }
        }

        const textToSpeak = decodeURIComponent('${encodeURIComponent(text2)}');
        const audioUrl = decodeURIComponent('${encodeURIComponent(audioSrc)}');

        var faceMesh = __cenchFindFaceMeshForLipSync(head, container);
        const FAKE_LIPSYNC = ${fakeLipsync ? "true" : "false"};

        function fakeTalkJawOnly(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              if (Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
        }

        function speakWithBrowserTTS(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              var synth = window.speechSynthesis;
              var speaking = synth && synth.speaking;
              if (!speaking && Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
          if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (e1) {}
            try { window.speechSynthesis.resume(); } catch (e2) {}
            var u = new SpeechSynthesisUtterance(txt);
            u.lang = 'en-US';
            u.rate = 1;
            u.onend = function () { stopJaw(); };
            u.onerror = function () { /* jaw continues until endAt */ };
            window.speechSynthesis.speak(u);
          }
        }

        window.__avatarStartSpeech = async function () {
          try {
            if (FAKE_LIPSYNC) {
              fakeTalkJawOnly(textToSpeak);
              return;
            }
            if (audioUrl) {
              const resp = await fetch(audioUrl);
              const arrayBuf = await resp.arrayBuffer();
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              try {
                if (audioCtx.state === 'suspended') await audioCtx.resume();
              } catch (e3) {}
              const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
              const words = textToSpeak ? textToSpeak.split(/\\s+/) : ['...'];
              const totalMs = audioBuf.duration * 1000;
              const perWord = totalMs / (words.length || 1);
              head.speakAudio({
                audio: audioBuf,
                words: words,
                wtimes: words.map((_, i) => Math.round(i * perWord)),
                wdurations: words.map(() => Math.round(perWord * 0.9)),
              });
              return;
            }
            var ep = head.opt && head.opt.ttsEndpoint;
            if (textToSpeak && ep && (await __cenchSpeakServerTtsToHead(ep, textToSpeak))) return;
            speakWithBrowserTTS(textToSpeak);
          } catch (e) {
            console.warn('[TalkingHead] Speech error:', e);
            speakWithBrowserTTS(textToSpeak);
          }
        };

        console.log('[TalkingHead] Ready \u2014 mood=${mood}, view=${view}, eyeContact=${eyeContact}');

      } catch(e) {
        console.error('[TalkingHead] Fatal:', e);
        if (statusEl) {
          statusEl.textContent = 'Error: ' + (e.message || e);
          statusEl.style.color = 'rgba(255,100,100,0.8)';
        }
      }
    })();
  </script>
</div>`;
}
function generateVeo3LayerHTML(layer) {
  if (!layer.videoUrl) return "";
  const startAt = layer.startAt ?? 0;
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <video
    id="${layer.id}-video"
    style="position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;object-fit:cover;"
    src="${layer.videoUrl}"
    playsinline
    muted
    ${layer.loop ? "loop" : ""}>
  </video>
  <script>
    // Sync veo3 video to GSAP timeline (no autoplay)
    window.addEventListener('load', function() {
      var v = document.getElementById('${layer.id}-video');
      if (!v || !window.__tl) return;
      v.playbackRate = ${layer.playbackRate ?? 1};
      window.__tl.call(function() { v.play(); }, null, ${startAt});
    });
  </script>
</div>`;
}
function generateLayerAnimationScript(layerId, imgId, anim, startAt) {
  if (!anim || anim.type === "none") return "";
  const ease = anim.easing === "linear" ? "none" : anim.easing === "ease-in" ? "power2.in" : anim.easing === "ease-in-out" ? "power2.inOut" : "power2.out";
  const delay = startAt + (anim.delay ?? 0);
  const dur = anim.duration ?? 0.5;
  const animMap = {
    "fade-in": { initial: "opacity:0;", props: `opacity:1, duration:${dur}, ease:'${ease}'` },
    "fade-out": { initial: "", props: `opacity:0, duration:${dur}, ease:'${ease}'` },
    "slide-left": {
      initial: "opacity:0;transform:translateX(100px);",
      props: `opacity:1, x:0, duration:${dur}, ease:'${ease}'`
    },
    "slide-right": {
      initial: "opacity:0;transform:translateX(-100px);",
      props: `opacity:1, x:0, duration:${dur}, ease:'${ease}'`
    },
    "slide-up": {
      initial: "opacity:0;transform:translateY(60px);",
      props: `opacity:1, y:0, duration:${dur}, ease:'${ease}'`
    },
    "slide-down": {
      initial: "opacity:0;transform:translateY(-60px);",
      props: `opacity:1, y:0, duration:${dur}, ease:'${ease}'`
    },
    "scale-in": {
      initial: "opacity:0;transform:scale(0);",
      props: `opacity:1, scale:1, duration:${dur}, ease:'${ease}'`
    },
    "scale-out": { initial: "", props: `opacity:0, scale:0, duration:${dur}, ease:'${ease}'` },
    "spin-in": {
      initial: "opacity:0;transform:rotate(-180deg) scale(0);",
      props: `opacity:1, rotation:0, scale:1, duration:${dur}, ease:'${ease}'`
    }
  };
  const config4 = animMap[anim.type];
  if (!config4) return "";
  return `<script>
    window.addEventListener('load', function() {
      var el = document.getElementById('${imgId}');
      if (!el || !window.__tl) return;
      window.__tl.to(el, { ${config4.props} }, ${delay});
    });
  </script>`;
}
function generateImageLayerHTML(layer) {
  if (!layer.imageUrl) return "";
  const filterCSS = layer.filter ? `filter:${layer.filter};` : "";
  const anim = layer.animation;
  const initialStyle = anim && anim.type !== "none" ? getAnimInitialStyle(anim.type) : "";
  const cropStyle = layer.cropX != null ? `object-fit:cover;object-position:${layer.cropX}% ${layer.cropY ?? 50}%;overflow:hidden;` : "object-fit:contain;";
  const imgId = `${layer.id}-img`;
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    id="${imgId}"
    src="${layer.imageUrl}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);${cropStyle}${filterCSS}${initialStyle}"
  >
  ${generateLayerAnimationScript(layer.id, imgId, anim, layer.startAt ?? 0)}
</div>`;
}
function getAnimInitialStyle(type) {
  const map = {
    "fade-in": "opacity:0;",
    "slide-left": "opacity:0;transform:translateX(100px);",
    "slide-right": "opacity:0;transform:translateX(-100px);",
    "slide-up": "opacity:0;transform:translateY(60px);",
    "slide-down": "opacity:0;transform:translateY(-60px);",
    "scale-in": "opacity:0;transform:scale(0);",
    "spin-in": "opacity:0;transform:rotate(-180deg) scale(0);"
  };
  return map[type] ?? "";
}
function generateStickerLayerHTML(layer) {
  const src = layer.stickerUrl ?? layer.imageUrl;
  if (!src) return "";
  const filterCSS = layer.filter ? `filter:${layer.filter};` : "";
  const imgId = `${layer.id}-img`;
  const anim = layer.animation;
  const hasNewAnim = anim && anim.type !== "none";
  const initialStyle = hasNewAnim ? getAnimInitialStyle(anim.type) : layer.animateIn ? "opacity:0;transform:scale(0.5);" : "";
  return `<div id="${layer.id}" class="cench-studio-layer" style="opacity:${layer.opacity};z-index:${layer.zIndex};position:absolute;inset:0;">
  <img
    id="${imgId}"
    src="${src}"
    style="position:absolute;left:${layer.x - layer.width / 2}px;top:${layer.y - layer.height / 2}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);object-fit:contain;${filterCSS}${initialStyle}"
  >
  ${hasNewAnim ? generateLayerAnimationScript(layer.id, imgId, anim, layer.startAt ?? 0) : layer.animateIn ? `<script>
    window.addEventListener('load', function() {
      var img = document.getElementById('${imgId}');
      if (!img || !window.__tl) return;
      window.__tl.to(img, {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: 'power2.out',
      }, ${layer.startAt ?? 0});
    });
  </script>` : ""}
</div>`;
}
function generateCanvasHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const { canvasCode = "" } = scene;
  const useTexture = style.textureStyle !== "none";
  const useRoughJs = style.roughnessLevel > 0;
  const sceneHash = hashString(scene.id);
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      inset: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }
    canvas {
      display: block;
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      margin: 0;
      padding: 0;
      border: 0;
    }
  </style>
  ${useRoughJs ? `<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>` : ""}
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera">
  <canvas id="c" width="${W}" height="${H}"></canvas>
  <canvas id="texture-canvas" width="${W}" height="${H}"
    style="display:${useTexture ? "block" : "none"}; position:absolute; inset:0; pointer-events:none;
           mix-blend-mode:${style.textureBlendMode}; opacity:${style.textureIntensity};"></canvas>
  ${audioHTML}

  <script>
    // \u2500\u2500 Scene globals \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};
    var TOOL         = '${style.defaultTool}';
    var STROKE_COLOR = '${style.strokeColor}';

    // Seeded random
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }

    // Audio volume is handled by the playback controller
  </script>

  ${generateAILayersHTML(scene.aiLayers, audioSettings)}

  </div><!-- /scene-camera -->

  <script>
${CANVAS_RENDERER_CODE}
  </script>

  <!-- playback-controller-slot -->

  <script>
${canvasCode}
  </script>

  <script>
    // \u2500\u2500 Automatic texture overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    ${useTexture ? `
    (function applyTextureOverlay() {
      const textureCanvas = document.getElementById('texture-canvas');
      if (!textureCanvas) return;
      const ctx = textureCanvas.getContext('2d');
      function mulberry32(seed) {
        return function() {
          seed |= 0; seed = seed + 0x6D2B79F5 | 0;
          let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
      }
      const rand = mulberry32(${sceneHash});

      ${style.textureStyle === "grain" ? `
        const imageData = ctx.createImageData(${W}, ${H});
        for (let i = 0; i < imageData.data.length; i += 4) {
          const noise = rand() * 255;
          imageData.data[i]   = noise;
          imageData.data[i+1] = noise;
          imageData.data[i+2] = noise;
          imageData.data[i+3] = rand() * 255;
        }
        ctx.putImageData(imageData, 0, 0);
      ` : ""}

      ${style.textureStyle === "paper" ? `
        for (let x = 0; x < ${W}; x += 1.5) {
          for (let y = 0; y < ${H}; y += 1.5) {
            const v = rand();
            ctx.fillStyle = \`rgba(0,0,0,\${v})\`;
            ctx.fillRect(x, y, 1.5, 1.5);
          }
        }
      ` : ""}

      ${style.textureStyle === "chalk" ? `
        for (let y = 0; y < ${H}; y += 2) {
          ctx.beginPath();
          ctx.strokeStyle = \`rgba(255,255,255,\${rand() * 0.3})\`;
          ctx.lineWidth = 1 + rand() * 2;
          ctx.moveTo(0, y + rand() * 2);
          for (let x = 0; x < ${W}; x += 20) {
            ctx.lineTo(x, y + (rand() - 0.5) * 4);
          }
          ctx.stroke();
        }
      ` : ""}

      ${style.textureStyle === "lines" ? `
        for (let y = 0; y < ${H}; y += 28) {
          ctx.beginPath();
          ctx.strokeStyle = \`rgba(0,0,0,0.06)\`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(${W}, y);
          ctx.stroke();
        }
      ` : ""}
    })();
    ` : "// No texture overlay for this style preset"}
  </script>
</body>
</html>`;
}
function generateMotionHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const { sceneCode = "", sceneHTML = "", sceneStyles = "" } = scene;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  const fixedStage = sceneUsesCanvasBackground(scene);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${fixedStage ? `html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }` : `html, body { width: 100%; height: 100vh; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      inset: 0;
      transform-origin: center center;
      will-change: transform, filter;
    }`}
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  ${fixedStage ? `<script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>` : ""}
</head>
<body>
  <div id="scene-camera"${fixedStage ? "" : ' style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;"'}>
  ${sceneUsesCanvasBackground(scene) ? `${canvasBgTag(W, H)}<div id="motion-foreground" style="position:absolute;inset:0;z-index:1;width:100%;height:100%;overflow:hidden;">` : ""}
  ${sceneHTML}
  ${sceneUsesCanvasBackground(scene) ? `</div>` : ""}
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>
  <script type="module">
    var animate, stagger;
    try {
      var m = await import("https://esm.sh/motion@11");
      animate = m.animate;
      stagger = m.stagger;
    } catch(e) {
      console.warn('Motion v11 failed to load, falling back to anime.js only:', e);
    }

    ${sceneCode}
  </script>
</body>
</html>`;
}
function generateD3HTML(scene, style, audioSettings, dims) {
  const { sceneCode = "", sceneStyles = "", d3Data = null } = scene;
  const needsPlotly = chartLayersUsePlotly(scene.chartLayers);
  const needsRecharts = chartLayersUseRecharts(scene.chartLayers);
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${needsRecharts ? `<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
  }
}
</script>` : ""}
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute;
      left: 0;
      top: 0;
      width: ${W}px;
      height: ${H}px;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, filter;
    }
    #chart { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; }
    ${needsRecharts ? `[data-cench-recharts] { box-sizing: border-box; }
    [data-cench-recharts] .recharts-cartesian-grid line { stroke: var(--cench-recharts-grid, rgba(255,255,255,0.08)); }
    [data-cench-recharts] .recharts-default-legend { color: var(--cench-recharts-tick, rgba(232,228,220,0.75)); }` : ""}
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera">
  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ""}
  <div id="chart"></div>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
  <script src="/sdk/cench-charts.js"></script>
  ${needsPlotly ? '<script src="https://cdn.plot.ly/plotly-3.4.0.min.js" charset="utf-8"></script>' : ""}
  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var DATA = ${JSON.stringify(d3Data)};
    var WIDTH = ${W}, HEIGHT = ${H};
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var AXIS_COLOR   = '${style.axisColor}';
    var GRID_COLOR   = '${style.gridColor}';
    ${needsRecharts ? `(function () {
      var root = document.documentElement;
      var p = PALETTE || [];
      for (var i = 0; i < 5; i++) {
        if (p[i]) root.style.setProperty('--chart-' + (i + 1), p[i]);
      }
      root.style.setProperty('--cench-font', FONT || 'system-ui, sans-serif');
      root.style.setProperty('--cench-recharts-tick', AXIS_COLOR || 'rgba(232,228,220,0.65)');
      root.style.setProperty('--cench-recharts-grid', GRID_COLOR || 'rgba(255,255,255,0.08)');
      root.style.setProperty('--cench-recharts-title', 'rgba(240,236,224,0.95)');
    })();` : ""}

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script>
    ${sceneCode}
  </script>
  ${needsRecharts ? `<script type="module">
  import { mountCenchRechartsLayers } from '/sdk/cench-recharts-scene.mjs';
  mountCenchRechartsLayers().catch(function (e) { console.warn('[cench-recharts]', e); });
</script>` : ""}
</body>
</html>`;
}
function generateThreeHTML(scene, style, audioSettings, dims) {
  const { sceneCode = "" } = scene;
  const effectiveBgColor = style?.bgColor ?? scene.bgColor ?? "#fffef9";
  const palette = JSON.stringify(style?.palette ?? ["#1a1a2e", "#e84545", "#16a34a", "#2563eb"]);
  const duration = scene.duration ?? 8;
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.183.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.183.0/examples/jsm/",
      "three/examples/jsm/": "https://unpkg.com/three@0.183.0/examples/jsm/",
      "@pmndrs/vanilla": "https://esm.sh/@pmndrs/vanilla@1.25.0?external=three",
      "troika-three-text": "/vendor/troika-three-text.esm.js",
      "three-bvh-csg": "/vendor/three-bvh-csg.esm.js"
    }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${effectiveBgColor};
      transform-origin: top left;
    }
    canvas { display: block; }
  </style>
  <script>
    // Scale ${W}x${H} body to fit the actual viewport
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);

    // Force preserveDrawingBuffer so export can read WebGL canvas via drawImage.
    // Without this, the buffer is cleared after compositing and reads return blank.
    // Applied unconditionally \u2014 perf cost is negligible at ${W}x${H}.
    (function() {
      var origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        if (type === 'webgl' || type === 'webgl2') {
          attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
        }
        return origGetContext.call(this, type, attrs);
      };
    })();

    // Globals accessible from module scope via window.*
    window.WIDTH = ${W};
    window.HEIGHT = ${H};
    window.PALETTE = ${palette};
    window.DURATION = ${duration};
    window.SCENE_ID = '${escapeJsString(scene.id)}';

    window.MATERIALS = {
      plastic: function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.6, metalness: 0 }); },
      metal:   function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.2, metalness: 0.9 }); },
      glass:   function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), transparent: true, opacity: 0.3, roughness: 0, transmission: 0.9 }); },
      matte:   function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 1, metalness: 0 }); },
      glow:    function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), emissive: new T.Color(c), emissiveIntensity: 0.8 }); },
      clearcoat: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), clearcoat: 1.0, clearcoatRoughness: 0.1, roughness: 0.3, metalness: 0.5 }); },
      iridescent: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), iridescence: 1.0, iridescenceIOR: 1.5, roughness: 0.2, metalness: 0.8 }); },
      velvet: function(c) { var T = window.THREE; return new T.MeshPhysicalMaterial({ color: new T.Color(c), sheen: 1.0, sheenRoughness: 0.8, sheenColor: new T.Color(c), roughness: 0.9 }); },
      lowpoly: function(c) { var T = window.THREE; return new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.7, metalness: 0, flatShading: true }); },
    };

    window.mulberry32 = function(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <!-- playback-controller-slot -->

  <!-- Template setup: import THREE, define globals + setupEnvironment on window -->
  <script type="module">
    import * as THREE from 'three';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
    import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
    import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
    import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
    import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
    import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
    window.THREE = THREE;

    // Procedural studio environment map \u2014 makes all PBR materials look professional.
    // Scene code calls: setupEnvironment(scene, renderer)
    window.setupEnvironment = function(targetScene, renderer) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envScene = new THREE.Scene();

        const skyGeo = new THREE.SphereGeometry(50, 32, 16);
        const skyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            topColor:    { value: new THREE.Color(0xddeeff) },
            bottomColor: { value: new THREE.Color(0xfff8f0) },
          },
          vertexShader: \`
            varying vec3 vWorldPos;
            void main() {
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vWorldPos = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          \`,
          fragmentShader: \`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPos;
            void main() {
              float h = normalize(vWorldPos).y * 0.5 + 0.5;
              gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
            }
          \`,
        });
        envScene.add(new THREE.Mesh(skyGeo, skyMat));

        const panelGeo = new THREE.PlaneGeometry(8, 4);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(-6, 8, 5);
        panel.lookAt(0, 0, 0);
        envScene.add(panel);

        const fillGeo = new THREE.PlaneGeometry(6, 3);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xe0e8ff, side: THREE.DoubleSide });
        const fillPanel = new THREE.Mesh(fillGeo, fillMat);
        fillPanel.position.set(7, 3, 3);
        fillPanel.lookAt(0, 0, 0);
        envScene.add(fillPanel);

        const envMap = pmrem.fromScene(envScene, 0.04).texture;
        targetScene.environment = envMap;
        pmrem.dispose();
        envScene.clear();
      } catch(e) {
        console.warn('setupEnvironment failed:', e);
      }
    };

    // Safe post-processing wrapper \u2014 SYNCHRONOUS, no .then() needed.
    // Scene code calls: const pp = createPostProcessing(renderer, scene, camera, { bloom: 0.3 })
    // Then in animation loop: pp.render() instead of renderer.render(scene, camera)
    window.createPostProcessing = function(renderer, scene, camera, opts) {
      opts = opts || {};
      try {
        var composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        if (opts.bloom !== false) {
          var strength = typeof opts.bloom === 'number' ? opts.bloom : 0.3;
          composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(window.WIDTH, window.HEIGHT), strength, 0.4, 0.85
          ));
        }
        composer.addPass(new OutputPass());
        return { render: function() { composer.render(); }, composer: composer };
      } catch(e) {
        console.warn('createPostProcessing failed, using direct render:', e);
        return { render: function() { renderer.render(scene, camera); } };
      }
    };

    // Studio scene presets \u2014 one-call setup for common 3D scene configurations.
    // Scene code calls: const studio = createStudioScene('corporate')
    // Returns { scene, camera, renderer, floor, render }
    window.createStudioScene = function(style) {
      style = style || 'corporate';
      var T = THREE;
      var W = window.WIDTH, H = window.HEIGHT;
      var P = window.PALETTE;

      var renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.LinearToneMapping;
      renderer.outputColorSpace = T.SRGBColorSpace;
      document.body.appendChild(renderer.domElement);

      var scene = new T.Scene();
      var camera = new T.PerspectiveCamera(50, W / H, 0.1, 1000);
      window.__threeCamera = camera;

      var configs = {
        corporate: { camPos: [0, 3, 12], camLookAt: [0, 0, 0], exposure: 1.0, floorY: -2.5, skyTop: '#999999', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6 },
        playful:   { camPos: [10, 8, 10], camLookAt: [0, 0, 0], exposure: 1.0, floorY: -2,   skyTop: '#908880', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#c8c4be', offset: 50, exponent: 0.6 },
        cinematic: { camPos: [0, 2, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#020204', skyBot: '#0e0c14', floorCol: '#0e0c14', gridCol: '#1a1828', offset: 30, exponent: 0.5 },
        showcase:  { camPos: [0, 2, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#06050a', skyBot: '#18141e', floorCol: '#18141e', gridCol: '#221e2a', offset: 30, exponent: 0.5 },
        tech:      { camPos: [0, 4, 14],  camLookAt: [0, 0, 0], exposure: 1.0, floorY: -3,   skyTop: '#020204', skyBot: '#080810', floorCol: '#080810', gridCol: '#1a1a28', offset: 30, exponent: 0.5 },
        sky:       { camPos: [0, 3, 12],  camLookAt: [0, 0, 0], exposure: 0.5, floorY: -2.5, skyTop: null, skyBot: null, floorCol: '#c8d8c0', gridCol: '#a0b098', offset: 0, exponent: 0 },
      };
      var c = configs[style] || configs.corporate;

      renderer.toneMappingExposure = c.exposure;
      camera.position.set(c.camPos[0], c.camPos[1], c.camPos[2]);
      camera.lookAt(c.camLookAt[0], c.camLookAt[1], c.camLookAt[2]);

      // \u2500\u2500 Lighting (3-point studio for all styles) \u2500\u2500
      var isLight = (style === 'corporate' || style === 'playful');
      scene.add(new T.AmbientLight(isLight ? 0xffffff : 0x111122, isLight ? 0.3 : 0.08));
      var keyL = new T.DirectionalLight(isLight ? 0xfff6e0 : 0xffffff, isLight ? 1.0 : 0.8);
      keyL.position.set(-5, 8, 5);
      keyL.castShadow = true;
      keyL.shadow.mapSize.set(2048, 2048);
      keyL.shadow.camera.left = -15; keyL.shadow.camera.right = 15;
      keyL.shadow.camera.top = 15; keyL.shadow.camera.bottom = -15;
      keyL.shadow.bias = -0.001;
      scene.add(keyL);
      var fillL = new T.DirectionalLight(isLight ? 0xd0e8ff : 0x4444aa, isLight ? 0.35 : 0.2);
      fillL.position.set(6, 2, 4);
      scene.add(fillL);
      var rimL = new T.DirectionalLight(isLight ? 0xffe0d0 : 0xff6040, isLight ? 0.5 : 0.35);
      rimL.position.set(0, 4, -9);
      scene.add(rimL);

      // \u2500\u2500 Sky Background \u2500\u2500
      var fY = c.floorY;
      if (style === 'sky') {
        import('three/addons/objects/Sky.js').then(function(mod) {
          var skySun = new mod.Sky();
          skySun.scale.setScalar(450000);
          scene.add(skySun);
          var u = skySun.material.uniforms;
          u['turbidity'].value = 10;
          u['rayleigh'].value = 2;
          u['mieCoefficient'].value = 0.005;
          u['mieDirectionalG'].value = 0.8;
          u['sunPosition'].value.set(400000, 400000, 400000);
        }).catch(function() {});
      } else {
        // Sky gradient sphere \u2014 128 vertical segments = smooth, no banding
        var skyGeo = new T.SphereGeometry(5000, 32, 128);
        var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
        var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
        var skyMat = new T.ShaderMaterial({
          uniforms: { topColor: { value: new T.Color(c.skyTop) }, bottomColor: { value: new T.Color(c.skyBot) }, offset: { value: c.offset }, exponent: { value: c.exponent } },
          vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false
        });
        scene.add(new T.Mesh(skyGeo, skyMat));
      }

      // \u2500\u2500 Infinite Grid (inlined from Fyrestar/THREE.InfiniteGridHelper) \u2500\u2500
      var gridGeo = new T.PlaneGeometry(2, 2, 1, 1);
      var gridVS = 'varying vec3 worldPosition; uniform float uDistance; void main() { vec3 pos = position.xzy * uDistance; pos.xz += cameraPosition.xz; worldPosition = pos; gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }';
      var gridFS = 'varying vec3 worldPosition; uniform float uSize1; uniform float uSize2; uniform vec3 uColor; uniform float uDistance; float getGrid(float size) { vec2 r = worldPosition.xz / size; vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r); float line = min(grid.x, grid.y); return 1.0 - min(line, 1.0); } void main() { float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0); float g1 = getGrid(uSize1); float g2 = getGrid(uSize2); gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0)); gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2); if (gl_FragColor.a <= 0.0) discard; }';
      var gridMat = new T.ShaderMaterial({
        side: T.DoubleSide, transparent: true,
        uniforms: { uSize1: { value: 10 }, uSize2: { value: 100 }, uColor: { value: new T.Color(c.gridCol) }, uDistance: { value: 3000 } },
        vertexShader: gridVS, fragmentShader: gridFS,
        extensions: { derivatives: true }
      });
      var grid = new T.Mesh(gridGeo, gridMat);
      grid.frustumCulled = false;
      grid.position.y = fY;
      scene.add(grid);

      // \u2500\u2500 Floor \u2014 infinite with fog blend \u2500\u2500
      var floorGeo = new T.PlaneGeometry(10000, 10000);
      var floorMat = new T.MeshStandardMaterial({ color: new T.Color(c.floorCol), roughness: 1.0, metalness: 0, envMapIntensity: 0.2 });
      var floor = new T.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = fY - 0.01;
      floor.receiveShadow = true;
      scene.add(floor);
      scene.fog = new T.FogExp2(new T.Color(c.skyBot), 0.003);

      // \u2500\u2500 Environment map for PBR reflections \u2500\u2500
      window.setupEnvironment(scene, renderer);

      return {
        scene: scene, camera: camera, renderer: renderer, floor: floor,
        render: function() { renderer.render(scene, camera); }
      };
    };

    ${THREE_ENVIRONMENT_RUNTIME_SCRIPT}
    ${THREE_SCATTER_RUNTIME_SCRIPT}
    ${THREE_HELPERS_RUNTIME_SCRIPT}
  </script>

  <!-- Scene code: separate module so it can have its own imports at the top -->
  <script type="module">
    ${sceneCode}
  </script>
</body>
</html>`;
}
function generateZdogHTML(scene, style, audioSettings, dims) {
  const { sceneCode = "" } = scene;
  const bgColor = scene.bgColor || style.bgColor || "#fffef9";
  const palette = JSON.stringify(style.palette);
  const duration = scene.duration ?? 8;
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${bgColor};
      transform-origin: top left;
    }
    canvas { display: block; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  <canvas id="zdog-canvas" width="${W}" height="${H}"></canvas>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script src="https://unpkg.com/zdog@1/dist/zdog.dist.min.js"></script>
  <script>
    var WIDTH = ${W}, HEIGHT = ${H};
    var PALETTE = ${palette};
    var DURATION = ${duration};
    var FONT = '${style.font}';
    var BODY_FONT = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';

    // Seeded PRNG \u2014 use mulberry32(seed)() instead of Math.random()
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    var SCENE_ID = '${escapeJsString(scene.id)}';

    // Audio volume is handled by the playback controller
  </script>

  <!-- playback-controller-slot -->

  <script>
${sceneCode}
  </script>
</body>
</html>`;
}
function generateLottieHTML(scene, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const { bgColor = "#fffef9", lottieSource = "", svgContent = "" } = scene;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  const lottieInit = lottieSource.startsWith("http") ? `path: "${lottieSource}"` : `animationData: ${lottieSource || "{}"}`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; overflow: hidden; background: ${bgColor}; }
    #lottie-container { width: 100%; height: 100%; }
    #svg-overlay { position: absolute; inset: 0; pointer-events: none; }
    #svg-overlay svg { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  <div id="lottie-container"></div>
  <div id="svg-overlay">${svgContent}</div>
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    var SCENE_ID = '${escapeJsString(scene.id)}';
    var DURATION = ${scene.duration ?? 8};

    const anim = lottie.loadAnimation({
      container: document.getElementById('lottie-container'),
      renderer: 'svg',
      loop: false,
      autoplay: false,
      ${lottieInit}
    });

    // Force render frame 0 as soon as lottie-web builds its SVG DOM.
    // Without this, autoplay:false + paused GSAP timeline = no frame ever painted.
    anim.addEventListener('DOMLoaded', function() {
      anim.goToAndStop(0, true);
    });

    // Integrate Lottie with GSAP timeline when available
    window.addEventListener('load', () => {
      if (window.__tl) {
        const proxy = { frame: 0 };
        const totalFrames = anim.totalFrames || 1;
        window.__tl.to(proxy, {
          frame: totalFrames,
          duration: DURATION,
          ease: 'none',
          onUpdate: () => anim.goToAndStop(proxy.frame, true),
        }, 0);
        // Belt-and-suspenders: ensure frame 0 is visible while paused
        anim.goToAndStop(0, true);
      }
    });

    // Audio volume is handled by the playback controller
  </script>
</body>
</html>`;
}
function buildBgStyleCSS(style) {
  switch (style.bgStyle) {
    case "grid":
      return `
        background-image:
          linear-gradient(${style.gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${style.gridColor} 1px, transparent 1px);
        background-size: 40px 40px;`;
    case "dots":
      return `
        background-image: radial-gradient(
          circle, ${style.gridColor} 1.5px, transparent 1.5px
        );
        background-size: 40px 40px;`;
    default:
      return "";
  }
}
function generatePhysicsHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const { sceneCode = "", sceneStyles = "", sceneHTML = "" } = scene;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$','$'], ['\\\\(','\\\\)']], displayMath: [['$$','$$'], ['\\\\[','\\\\]']] },
      svg: { fontCache: 'global' },
      startup: { pageReady: function() { return MathJax.startup.defaultPageReady().then(function() { window.__mathjaxReady = true; }); } }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      font-family: ${sceneFontCssStack(style.font)};
      ${buildBgStyleCSS(style)}
    }

    /* Split layout: simulation left, text/equations right */
    .physics-layout-split {
      --sim-panel: 60%;
      --text-panel: 40%;
      display: flex; width: ${W}px; height: ${H}px;
    }
    .physics-layout-split .sim-panel {
      flex: 0 0 var(--sim-panel); height: 100%; position: relative;
      overflow: hidden;
    }
    .physics-layout-split .sim-panel canvas { display: block; width: 100%; height: 100%; }
    .physics-layout-split .text-panel {
      flex: 0 0 var(--text-panel); height: 100%; padding: 60px 50px;
      display: flex; flex-direction: column; justify-content: center;
      color: ${style.palette[0] || "#e2e8f0"};
      overflow: hidden;
      --content-scale: 1;
    }

    /* Overlay layout: centered simulation + floating explanation card */
    .physics-layout-overlay {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-overlay .sim-stage {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .physics-layout-overlay .sim-stage canvas {
      display: block;
      width: 100%; height: 100%;
      transform: scale(var(--sim-scale, 0.82));
      transform-origin: center center;
    }
    .physics-explain-card {
      position: absolute;
      transform: translate(-50%, -50%);
      background: var(--card-bg, rgba(8, 12, 22, 0.72));
      border: 1px solid var(--card-border, rgba(255,255,255,0.18));
      border-radius: var(--card-radius, 14px);
      padding: var(--card-padding, 20px 24px);
      color: var(--card-text, #fff);
      box-shadow: var(--card-shadow, 0 14px 45px rgba(0,0,0,0.28));
      backdrop-filter: blur(var(--card-blur, 3px));
      opacity: var(--card-opacity, 1);
      overflow: hidden;
      --content-scale: 1;
      max-height: 80%;
      z-index: 3;
      text-align: var(--card-text-align, left);
    }
    .physics-explain-card.physics-explain-split {
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      backdrop-filter: none;
    }
    .physics-explain-card.physics-explain-split .physics-sub-card-frame {
      position: absolute;
      inset: 0;
      border-radius: var(--card-radius, 14px);
      background: var(--card-bg, rgba(8, 12, 22, 0.72));
      border: 1px solid var(--card-border, rgba(255,255,255,0.18));
      box-shadow: var(--card-shadow, 0 14px 45px rgba(0,0,0,0.28));
      backdrop-filter: blur(var(--card-blur, 3px));
      opacity: var(--card-opacity, 1);
      pointer-events: none;
    }
    .physics-explain-card.physics-explain-split .physics-sub-text {
      position: relative;
      padding: var(--card-padding, 20px 24px);
      color: var(--card-text, #fff);
      overflow: hidden;
      max-height: 100%;
      text-align: var(--card-text-align, left);
    }
    .physics-layout-overlay.equation-focus .physics-explain-card:not(.physics-explain-split) {
      background: rgba(6, 10, 20, 0.78);
    }
    .physics-layout-overlay.equation-focus .physics-explain-split .physics-sub-card-frame {
      background: rgba(6, 10, 20, 0.78);
    }
    .physics-explain-card.center-card {
      text-align: center;
    }

    /* Fullscreen layout: sim fills canvas */
    .physics-layout-fullscreen {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-fullscreen canvas { display: block; width: 100%; height: 100%; }
    .physics-layout-fullscreen .caption-overlay {
      position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
      max-width: 80%; padding: 20px 40px;
      background: rgba(0,0,0,0.7); border-radius: 12px;
      color: #fff; font-size: calc(28px * var(--content-scale, 1)); text-align: center;
      line-height: 1.35; max-height: 35%;
      overflow: hidden;
      --content-scale: 1;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split {
      padding: 0;
      background: transparent;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split .physics-caption-frame {
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: rgba(0,0,0,0.7);
      pointer-events: none;
    }
    .physics-layout-fullscreen .caption-overlay.physics-caption-split .physics-caption-text {
      position: relative;
      padding: 20px 40px;
      font-size: calc(28px * var(--content-scale, 1));
      text-align: center;
      line-height: 1.35;
      max-height: 35%;
      overflow: hidden;
    }

    /* Equation focus layout: big equation center, sim as background */
    .physics-layout-equation {
      width: ${W}px; height: ${H}px; position: relative;
    }
    .physics-layout-equation canvas {
      position: absolute; inset: 0; opacity: 0.25; filter: blur(2px);
      width: 100%; height: 100%;
    }
    .physics-layout-equation .equation-center {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 2; color: #fff;
      padding: 70px 110px;
      text-align: center;
      overflow: hidden;
      --content-scale: 1;
    }
    .physics-layout-equation .equation-center .mjx-container {
      font-size: calc(48px * var(--content-scale, 1)) !important;
      max-width: 100%;
    }

    /* Equation styling */
    .equation-block { margin: calc(24px * var(--content-scale, 1)) 0; max-width: 100%; }
    .equation-block .mjx-container {
      font-size: calc(var(--card-equation-size, 32px) * var(--content-scale, 1)) !important;
      max-width: 100%;
      transform-origin: left center;
      display: inline-block;
    }
    .narration-text {
      font-size: calc(var(--card-body-size, 26px) * var(--content-scale, 1));
      line-height: 1.5;
      margin: calc(20px * var(--content-scale, 1)) 0;
      opacity: 0.9;
      max-width: 100%;
      overflow-wrap: anywhere;
      hyphens: auto;
    }
    .narration-text.is-clamped {
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .scene-title {
      font-size: calc(var(--card-title-size, 42px) * var(--content-scale, 1));
      font-weight: 700;
      margin-bottom: calc(20px * var(--content-scale, 1));
      line-height: 1.15;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    /* Annotation overlays */
    .physics-annotation {
      position: absolute; pointer-events: none; z-index: 10;
      font-family: ${sceneFontCssStack(style.font)};
    }
    .physics-annotation.label {
      background: rgba(0,0,0,0.8); color: #fff;
      padding: 6px 14px; border-radius: 6px; font-size: 18px;
    }
    .physics-annotation.callout {
      background: rgba(59,130,246,0.9); color: #fff;
      padding: 12px 20px; border-radius: 8px; font-size: 20px;
      max-width: 300px;
    }
    .physics-annotation.equation_popup {
      background: rgba(0,0,0,0.85); color: #fff;
      padding: 16px 24px; border-radius: 10px;
    }

    ${sanitizeCssBlock(sceneStyles)}
  </style>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">
  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ""}
  ${sceneHTML}
  ${audioHTML}
  ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div><!-- /scene-camera -->

  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }

    function overflows(el) {
      return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    }

    function fitMathBlocks(scope) {
      if (!scope) return;
      var mathEls = scope.querySelectorAll('.mjx-container');
      mathEls.forEach(function (mathEl) {
        var parent = mathEl.parentElement;
        if (!parent) return;
        mathEl.style.transform = 'scale(1)';
        var maxW = Math.max(1, parent.clientWidth - 6);
        var naturalW = Math.max(1, mathEl.scrollWidth);
        var ratio = maxW / naturalW;
        var eqScale = Math.max(0.72, Math.min(1, ratio));
        if (eqScale < 0.999) {
          mathEl.style.transform = 'scale(' + eqScale.toFixed(3) + ')';
        }
      });
    }

    function fitContainerContent(container, minScale) {
      if (!container) return;
      var scale = 1;
      minScale = typeof minScale === 'number' ? minScale : 0.78;
      container.style.setProperty('--content-scale', '1');
      fitMathBlocks(container);
      for (var i = 0; i < 10; i++) {
        if (!overflows(container)) break;
        scale = Math.max(minScale, scale - 0.03);
        container.style.setProperty('--content-scale', scale.toFixed(2));
        fitMathBlocks(container);
        if (scale <= minScale) break;
      }
      if (overflows(container)) {
        container.querySelectorAll('.narration-text').forEach(function (el) { el.classList.add('is-clamped'); });
        fitMathBlocks(container);
      } else {
        container.querySelectorAll('.narration-text').forEach(function (el) { el.classList.remove('is-clamped'); });
      }
    }

    function fitSplitLayouts() {
      var layouts = document.querySelectorAll('.physics-layout-split');
      layouts.forEach(function (layout) {
        var textPanel = layout.querySelector('.text-panel');
        if (!textPanel) return;
        var splits = [40, 45, 50];
        var fitted = false;
        for (var i = 0; i < splits.length; i++) {
          var textPct = splits[i];
          layout.style.setProperty('--text-panel', textPct + '%');
          layout.style.setProperty('--sim-panel', (100 - textPct) + '%');
          fitContainerContent(textPanel, 0.8);
          if (!overflows(textPanel)) {
            fitted = true;
            break;
          }
        }
        if (!fitted) {
          fitContainerContent(textPanel, 0.75);
        }
      });
    }

    function fitReadableContent() {
      fitSplitLayouts();
      var targets = document.querySelectorAll('.physics-layout-equation .equation-center, .physics-layout-fullscreen .caption-overlay, .physics-layout-overlay .physics-explain-card');
      targets.forEach(function (el) { fitContainerContent(el, 0.78); });
    }

    function fitPhysicsLayout() {
      fitToViewport();
      fitReadableContent();
      // Run an extra pass after fonts/equations settle.
      setTimeout(fitReadableContent, 60);
      setTimeout(fitReadableContent, 260);
      setTimeout(fitReadableContent, 800);
      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        if (window.__mathjaxReady || attempts > 10) {
          fitReadableContent();
        }
        if (window.__mathjaxReady || attempts > 10) clearInterval(timer);
      }, 250);
    }

    window.addEventListener('resize', fitToViewport);
    window.addEventListener('resize', fitReadableContent);
    document.addEventListener('DOMContentLoaded', fitPhysicsLayout);
  </script>

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
    }
  </script>

  <script src="/sdk/physics-equations.js"></script>
  <script src="/sdk/physics-sims.js"></script>

  <!-- playback-controller-slot -->

  <script>
${sceneCode}
  </script>
</body>
</html>`;
}
function generateCameraMotionScript(moves) {
  const calls = moves.map((move) => {
    const paramsStr = move.params && Object.keys(move.params).length > 0 ? JSON.stringify(move.params) : "{}";
    return `  CenchCamera.${move.type}(${paramsStr});`;
  }).join("\n");
  return `<script>
// Camera motion (added by set_camera_motion)
window.addEventListener('load', function() {
  if (typeof CenchCamera === 'undefined') return;
${calls}
});
</script>`;
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
function resolveStyleFromGlobal(globalStyle) {
  if (!globalStyle) return resolveStyle(null);
  return resolveStyle(globalStyle.presetId, globalStyle);
}
function worldTemplateFilename(environment) {
  const map = {
    meadow: "meadow.html",
    studio_room: "studio-room.html",
    void_space: "void-space.html"
  };
  return map[environment] ?? `${environment.replace(/_/g, "-")}.html`;
}
function generateWorldHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const wc = scene.worldConfig;
  if (!wc) return "<!-- No worldConfig -->";
  const environment = wc.environment || "meadow";
  const worldHtmlFile = worldTemplateFilename(environment);
  const configJSON = JSON.stringify(wc);
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (typeof window === "undefined") {
    try {
      const fs20 = require("fs");
      const pathMod = require("path");
      const templatePath = pathMod.join(process.cwd(), "public", "worlds", worldHtmlFile);
      let templateHTML = fs20.readFileSync(templatePath, "utf-8");
      const configScript = `<script>
    window.__worldConfig = ${configJSON};
    window.DURATION = ${scene.duration ?? 10};
    window.SCENE_ID = '${escapeJsString(scene.id)}';
  </script>`;
      const moduleIdx = templateHTML.indexOf('<script type="module">');
      if (moduleIdx !== -1) {
        templateHTML = templateHTML.slice(0, moduleIdx) + configScript + "\n  " + templateHTML.slice(moduleIdx);
      } else {
        templateHTML = templateHTML.replace("</body>", `${configScript}
</body>`);
      }
      templateHTML = templateHTML.replace("<head>", `<head>
  <base href="${appBaseUrl}/">`);
      return templateHTML;
    } catch {
    }
  }
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000;
      transform-origin: top left;
    }
    iframe { border: none; width: ${W}px; height: ${H}px; display: block; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <script>
    (async function() {
      var config = ${configJSON};
      var baseUrl = '${appBaseUrl}';
      var res = await fetch(baseUrl + '/worlds/${worldHtmlFile}');
      var html = await res.text();

      // Inject config before module script so it is available at parse time
      var tag = '<scr' + 'ipt>window.__worldConfig=' + JSON.stringify(config) +
        ';window.DURATION=${scene.duration ?? 10};window.SCENE_ID="${escapeJsString(scene.id)}";</scr' + 'ipt>';
      var idx = html.indexOf('<script type="module">');
      if (idx !== -1) html = html.slice(0, idx) + tag + '\\n' + html.slice(idx);
      html = html.replace('<head>', '<head>\\n<base href="' + baseUrl + '/">');

      // Render via blob URL in iframe \u2014 preserves importmap support
      var blob = new Blob([html], { type: 'text/html' });
      var frame = document.createElement('iframe');
      frame.src = URL.createObjectURL(blob);
      frame.style.cssText = 'border:none;width:${W}px;height:${H}px;';
      document.body.appendChild(frame);

      // Bridge WVC globals from iframe to parent
      frame.addEventListener('load', function() {
        var w = frame.contentWindow;
        window.__updateScene = function(t) { if (w.__updateScene) w.__updateScene(t); };
        if (w.__sceneReady) window.__sceneReady = w.__sceneReady;
        if (w.__tl) window.__tl = w.__tl;
      });
    })();
  </script>
</body>
</html>`;
}
function generateAvatarSceneHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  const panelFontStack = sceneFontCssStack(style.font);
  const avatarLayer = scene.aiLayers?.find((l) => l.type === "avatar");
  const asc2 = avatarLayer?.avatarSceneConfig;
  const ns = asc2?.narrationScript ?? avatarLayer?.narrationScript;
  const contentPanels = asc2?.contentPanels ?? [];
  const backdrop = asc2?.backdrop ?? style.bgColor;
  const avatarPosition = asc2?.avatarPosition ?? "left";
  const avatarSize = asc2?.avatarSize ?? 40;
  let avatarSceneThUrl = null;
  try {
    if (avatarLayer?.talkingHeadUrl?.startsWith("talkinghead://")) {
      avatarSceneThUrl = new URL(avatarLayer.talkingHeadUrl);
    }
  } catch {
    avatarSceneThUrl = null;
  }
  const avatarSceneGlb = getTalkingHeadGlbPath(resolveTalkingHeadModelId(ns, avatarSceneThUrl));
  const fakeLipsyncScene = ns?.fakeLipsync === true;
  const avatarCSS = avatarPosition === "center" ? `position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:${avatarSize}%;height:100%;` : avatarPosition === "right" ? `position:absolute;right:0;bottom:0;width:${avatarSize}%;height:100%;` : `position:absolute;left:0;bottom:0;width:${avatarSize}%;height:100%;`;
  const contentSide = avatarPosition === "right" ? "left" : "right";
  const contentCSS = `position:absolute;${contentSide}:60px;top:50%;transform:translateY(-50%);width:${100 - avatarSize - 10}%;max-width:800px;z-index:10;`;
  const panelsHTML = contentPanels.map((panel, i) => {
    const panelStyle = panel.style ? Object.entries(panel.style).map(([k, v]) => `${k}:${escapeAttr(v)}`).join(";") : "";
    const safeId = String(panel.id || i).replace(/[^a-zA-Z0-9\-_]/g, "");
    return `<div id="panel-${safeId}" class="content-panel" style="opacity:0;${panelStyle}">${panel.html}</div>`;
  }).join("\n    ");
  const panelAnimCode = contentPanels.map((panel, i) => {
    const rawId = String(panel.id || i).replace(/[^a-zA-Z0-9\-_]/g, "");
    const id = `panel-${rawId}`;
    const enterTime = panel.revealAt === "start" ? 0 : parseFloat(panel.revealAt) || i * 3 + 2;
    const exitTime = panel.exitAt ? parseFloat(panel.exitAt) : void 0;
    let code = `window.__tl.to(document.getElementById('${id}'), { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, ${enterTime});`;
    if (exitTime != null) {
      code += `
      window.__tl.to(document.getElementById('${id}'), { opacity: 0, y: -20, duration: 0.4 }, ${exitTime});`;
    }
    return code;
  }).join("\n      ");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${backdrop}; }
    .content-panel {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(8px);
      border-radius: 16px;
      padding: 40px;
      border: 1px solid rgba(255,255,255,0.1);
      transform: translateY(20px);
      font-family: ${panelFontStack}, system-ui, sans-serif;
      color: ${style.palette[0] === "#ffffff" || style.palette[0] === "#fff" ? "#1a1a2e" : "#f0f0f0"};
    }
    .content-panel h2 { font-size: 32px; margin-bottom: 16px; }
    .content-panel p { font-size: 20px; line-height: 1.6; opacity: 0.85; }
    .content-panel ul { font-size: 20px; line-height: 2; padding-left: 24px; }
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
      document.body.style.transformOrigin = 'top left';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
</head>
<body>
  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">

  <!-- Scene backdrop -->
  <div id="scene-backdrop" style="position:absolute;inset:0;z-index:0;background:${backdrop};"></div>

  <!-- Content panels -->
  <div id="scene-content" style="${contentCSS}">
    ${panelsHTML}
  </div>

  <!-- Avatar container -->
  <div id="avatar-container" style="${avatarCSS}z-index:5;"></div>

  ${audioHTML}

  <script>
    var SCENE_ID = '${escapeJsString(scene.id)}';
    var PALETTE = ${JSON.stringify(style.palette)};
    var DURATION = ${scene.duration};
    var WIDTH = ${W};
    var HEIGHT = ${H};
    var FONT = '${resolveSceneFontFamily(style.font).replace(/'/g, "\\'")}';
    var BODY_FONT = '${resolveSceneFontFamily(style.bodyFont || style.font).replace(/'/g, "\\'")}';
  </script>

  <!-- playback-controller-slot -->

  <!-- TalkingHead init for full-scene avatar -->
  <script type="module">
    (async function() {
      const container = document.getElementById('avatar-container');
      if (!container) return;

      // Wait for visibility
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        await new Promise((resolve) => {
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                  ro.disconnect(); resolve(); return;
                }
              }
            });
            ro.observe(container);
          } else {
            const iv = setInterval(() => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) { clearInterval(iv); resolve(); }
            }, 200);
          }
        });
      }

      try {
        const mod = await import('https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs');
        const TalkingHead = mod.TalkingHead;
        if (!TalkingHead) return;

        if (window.__nativeRAF) window.requestAnimationFrame = window.__nativeRAF;
        if (window.__nativeCAF) window.cancelAnimationFrame = window.__nativeCAF;
        window.__rafUnlocked = true;

        const mood = '${ns?.mood ?? "happy"}';
        const view = '${ns?.view ?? "mid"}';
        const eyeContact = ${ns?.eyeContact ?? 0.7};
        const headMovement = ${ns?.lipsyncHeadMovement !== false};

        const head = new TalkingHead(container, {
          ttsEndpoint: ${talkingHeadTtsEndpointJsLiteral(audioSettings)},
          ttsLang: 'en-US',
          cameraView: view,
          cameraRotateEnable: false,
          avatarSpeakingEyeContact: eyeContact,
          avatarIdleEyeContact: Math.max(0, eyeContact - 0.2),
        });

        const vrmUrl = ${JSON.stringify(avatarSceneGlb)};
        await head.showAvatar({
          url: vrmUrl, body: 'F', lipsyncLang: 'en',
          lipsyncHeadMovement: headMovement,
        });

        head.setMood('neutral');
        window.__avatarHead = head;
        window.__avatarMood = mood;
        window.__avatarSpeechStarted = false;

        // Content panel animations (added after TalkingHead init \u2014 refresh GSAP duration)
        if (window.__tl) {
          ${panelAnimCode}
          try {
            if (typeof window.__tl.invalidate === 'function') window.__tl.invalidate();
          } catch (e) {}
        }

        function __cenchTraverseFaceMesh(root) {
          if (!root || !root.traverse) return null;
          var found = null;
          var preferred = [
            'jawOpen', 'mouthOpen', 'jaw_lower', 'Jaw_Open', 'aac', 'viseme_aa', 'viseme_A',
            'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'mouthSmile', 'mouthFunnel',
          ];
          root.traverse(function (child) {
            if (found || !child.isMesh || !child.morphTargetDictionary) return;
            var d = child.morphTargetDictionary;
            var i, k;
            for (i = 0; i < preferred.length; i++) {
              k = preferred[i];
              if (k in d) { found = child; return; }
            }
            var names = Object.keys(d);
            for (i = 0; i < names.length; i++) {
              var n = names[i];
              var lower = n.toLowerCase();
              if (lower.indexOf('jaw') !== -1 || lower.indexOf('mouth') !== -1 || n.indexOf('viseme_') === 0) {
                found = child;
                return;
              }
            }
          });
          return found;
        }

        function __cenchFindFaceMeshForLipSync(h, domContainer) {
          var roots = [h.nodeAvatar, h.scene, h.avatar, domContainer].filter(Boolean);
          var ri;
          for (ri = 0; ri < roots.length; ri++) {
            var m = __cenchTraverseFaceMesh(roots[ri]);
            if (m) return m;
          }
          return null;
        }

        function __cenchApplyMouthJaw(md, mt, jaw) {
          var pairs = [
            ['jawOpen', jaw],
            ['mouthOpen', jaw],
            ['jaw_lower', jaw * 0.92],
            ['Jaw_Open', jaw],
            ['aac', jaw * 0.7],
            ['viseme_aa', jaw * 0.55],
            ['viseme_A', jaw * 0.5],
            ['viseme_E', jaw * 0.45],
            ['viseme_I', jaw * 0.35],
            ['viseme_O', jaw * 0.38],
            ['viseme_U', jaw * 0.32],
          ];
          for (var pi = 0; pi < pairs.length; pi++) {
            var nm = pairs[pi][0];
            var v = pairs[pi][1];
            if (nm in md) mt[md[nm]] = v;
          }
        }

        async function __cenchSpeakServerTtsToHead(endpoint, txt) {
          if (!endpoint || !txt) return false;
          try {
            var r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: txt },
                voice: { languageCode: 'en-US', name: '' },
                audioConfig: { audioEncoding: 'MP3' },
              }),
            });
            if (!r.ok) return false;
            var data = await r.json();
            if (!data.audioContent) return false;
            var binary = atob(data.audioContent);
            var len = binary.length;
            var bytes = new Uint8Array(len);
            var i;
            for (i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            var AC = window.AudioContext || window.webkitAudioContext;
            var audioCtx = new AC();
            try {
              if (audioCtx.state === 'suspended') await audioCtx.resume();
            } catch (e0) {}
            var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            var audioBuf = await audioCtx.decodeAudioData(ab);
            var words = txt.split(/\\s+/).filter(Boolean);
            if (!words.length) words = ['...'];
            var totalMs = audioBuf.duration * 1000;
            var perWord = totalMs / (words.length || 1);
            head.speakAudio({
              audio: audioBuf,
              words: words,
              wtimes: words.map(function (_, wi) { return Math.round(wi * perWord); }),
              wdurations: words.map(function () { return Math.round(perWord * 0.9); }),
            });
            return true;
          } catch (e) {
            console.warn('[AvatarScene] server TTS speakAudio failed:', e);
            return false;
          }
        }

        var faceMesh = __cenchFindFaceMeshForLipSync(head, container);
        const FAKE_LIPSYNC_SCENE = ${fakeLipsyncScene ? "true" : "false"};

        function fakeTalkJawOnly(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              if (Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
        }

        function speakWithBrowserTTS(txt) {
          if (!txt) return;
          if (!faceMesh) faceMesh = __cenchFindFaceMeshForLipSync(head, container);
          var mt = null;
          var md = null;
          if (faceMesh && faceMesh.morphTargetDictionary) {
            mt = faceMesh.morphTargetInfluences;
            md = faceMesh.morphTargetDictionary;
          }
          var estMs = Math.min(90000, Math.max(2000, (txt.length / 14) * 1000));
          var endAt = Date.now() + estMs;
          var phase = 0;
          var loop = null;
          function stopJaw() {
            if (loop) clearInterval(loop);
            loop = null;
            if (md && mt) __cenchApplyMouthJaw(md, mt, 0);
          }
          function tickJaw() {
            if (!md || !mt) return;
            phase += 0.3;
            var jaw = 0.2 + 0.3 * Math.abs(Math.sin(phase * 2.7)) + 0.15 * Math.sin(phase * 4.1);
            __cenchApplyMouthJaw(md, mt, jaw);
          }
          if (md && mt) {
            loop = setInterval(function () {
              var synth = window.speechSynthesis;
              var speaking = synth && synth.speaking;
              if (!speaking && Date.now() >= endAt) { stopJaw(); return; }
              tickJaw();
            }, 80);
          }
          if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (e1) {}
            try { window.speechSynthesis.resume(); } catch (e2) {}
            var u = new SpeechSynthesisUtterance(txt);
            u.lang = 'en-US';
            u.rate = 1;
            u.onend = function () { stopJaw(); };
            u.onerror = function () {};
            window.speechSynthesis.speak(u);
          }
        }

        // Speech
        ${ns?.lines && ns.lines.length > 0 ? (() => {
    const allText = ns.lines.map((l) => l.text).join(" ");
    return `
        window.__avatarStartSpeech = async function() {
          try {
            var all = ${JSON.stringify(allText)};
            if (FAKE_LIPSYNC_SCENE) {
              fakeTalkJawOnly(all);
              return;
            }
            var ep = head.opt && head.opt.ttsEndpoint;
            if (all && ep && (await __cenchSpeakServerTtsToHead(ep, all))) return;
            speakWithBrowserTTS(all);
          } catch (e) {
            console.warn('[AvatarScene] speech error:', e);
            speakWithBrowserTTS(${JSON.stringify(allText)});
          }
        };`;
  })() : `
        const ttsAudio = document.getElementById('scene-tts') || document.getElementById('scene-audio');
        if (ttsAudio && ttsAudio.src) {
          window.__avatarStartSpeech = async function() {
            try {
              const resp = await fetch(ttsAudio.src);
              const arrayBuf = await resp.arrayBuffer();
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              try {
                if (audioCtx.state === 'suspended') await audioCtx.resume();
              } catch (e4) {}
              const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
              const text = (ttsAudio.dataset.text || '').split(/\\s+/).filter(Boolean);
              const words = text.length > 0 ? text : ['...'];
              const totalMs = audioBuf.duration * 1000;
              const perWord = totalMs / (words.length || 1);
              head.speakAudio({
                audio: audioBuf,
                words: words,
                wtimes: words.map((_, i) => Math.round(i * perWord)),
                wdurations: words.map(() => Math.round(perWord * 0.9)),
              });
            } catch(e) { console.warn('[AvatarScene] Audio lip sync error:', e); }
          };
        }`}

        console.log('[AvatarScene] Ready \u2014 mood=' + mood + ', view=' + view + ', panels=${contentPanels.length}');

      } catch(e) {
        console.error('[AvatarScene] Fatal:', e);
      }
    })();
  </script>

  ${generateAILayersHTML(
    scene.aiLayers?.filter((l) => l.type !== "avatar"),
    audioSettings
  )}

  </div><!-- /scene-camera -->
</body>
</html>`;
}
function normalizeReactSceneExport(src) {
  if (!src || typeof src !== "string") return src;
  if (/\bexport\s+default\b/.test(src) || /\bmodule\.exports\s*=/.test(src) || /\bexports\.[A-Za-z_$][\w$]*\s*=/.test(src) || /\bexport\s*\{[^}]+\}/.test(src)) {
    return src;
  }
  const CANDIDATES = ["Scene", "Main", "App", "Root", "Composition", "VideoScene"];
  for (const name of CANDIDATES) {
    const re = new RegExp(
      `(^|\\n)\\s*(?:async\\s+)?function\\s+${name}\\b|(^|\\n)\\s*(?:const|let|var)\\s+${name}\\s*=`
    );
    if (re.test(src)) {
      return `${src.replace(/\s+$/, "")}

export default ${name};
`;
    }
  }
  return src;
}
function generateReactHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const reactCode = scene.reactCode || scene.sceneCode || "";
  const sceneStyles = scene.sceneStyles || "";
  const audioHTML = generateAudioHTML(scene.audioLayer);
  const palette = style.palette ?? ["#1a1a2e", "#16213e", "#0f3460", "#e94560"];
  const duration = scene.duration ?? 8;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      transform-origin: top left;
      ${buildBgStyleCSS(style)}
    }
    #scene-camera {
      position: absolute; inset: 0;
      width: ${W}px; height: ${H}px;
      transform-origin: center center;
      will-change: transform, filter;
    }
    #react-root {
      position: absolute; inset: 0;
      width: ${W}px; height: ${H}px;
      overflow: hidden;
    }
    ${sanitizeCssBlock(sceneStyles)}
  </style>
  <script>
    function fitToViewport() {
      var s = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      document.body.style.transform = 'scale(' + s + ')';
      document.body.style.transformOrigin = 'top left';
    }
    window.addEventListener('resize', fitToViewport);
    document.addEventListener('DOMContentLoaded', fitToViewport);
  </script>
  <!-- React 18 UMD -->
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <!-- Babel standalone: in-browser JSX transpilation (bundled locally to avoid CDN failures) -->
  <script src="/sdk/babel.min.js"></script>
  <!-- lottie-web: required by LottieLayer bridge and CenchMotion.lottieSync -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
</head>
<body>
  <div id="scene-camera">
    <div id="react-root"></div>
    ${audioHTML}
    ${generateAILayersHTML(scene.aiLayers, audioSettings)}
  </div>

  <script>
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(palette)};
    var DURATION     = ${duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};
    // Scene variables (reactive via useVariable hook)
    window.__CENCH_VARIABLES = ${JSON.stringify(
    Object.fromEntries(
      (scene.variables ?? []).map((v) => [
        v.name,
        v.defaultValue ?? (v.type === "number" ? 0 : v.type === "boolean" ? false : "")
      ])
    )
  )};
  </script>

  <!-- playback-controller-slot -->

  <!-- Three.js r183 UMD (exposes window.THREE) + D3 v7 (available for bridge components) -->
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
  <script src="/vendor/three-sky.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
  <script>
  // buildStudio(THREE, scene, camera, renderer, style) \u2014 sets up studio environment inside ThreeJSLayer
  // Adds: sky gradient sphere (128 segments), infinite grid, white floor, 3-point lighting, env map
  // floorMode: 'infinite' (default, extends to horizon with fog), 'circle' (radial fade), 'none'
  // floorColor: override floor color (hex string), null = use style default
  window.buildStudio = function(T, scene, camera, renderer, style, opts) {
    style = style || 'white';
    opts = opts || {};
    var floorMode = opts.floorMode || 'infinite';
    var floorColorOverride = opts.floorColor || null;
    var configs = {
      white:     { floorY: -2.5, skyTop: '#999999', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6, ambientI: 0.3, keyI: 1.0, useSky: false, noFog: true, useShaderFloor: true },
      corporate: { floorY: -2.5, skyTop: '#b0b0b0', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#d0cdc8', offset: 50, exponent: 0.6, ambientI: 0.4, keyI: 1.0, useSky: false },
      playful:   { floorY: -2,   skyTop: '#908880', skyBot: '#ffffff', floorCol: '#ffffff', gridCol: '#c8c4be', offset: 50, exponent: 0.6, ambientI: 0.3, keyI: 1.0, useSky: false },
      cinematic: { floorY: -3,   skyTop: '#020204', skyBot: '#0e0c14', floorCol: '#0e0c14', gridCol: '#1a1828', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      showcase:  { floorY: -3,   skyTop: '#06050a', skyBot: '#18141e', floorCol: '#18141e', gridCol: '#221e2a', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      tech:      { floorY: -3,   skyTop: '#020204', skyBot: '#080810', floorCol: '#080810', gridCol: '#1a1a28', offset: 30, exponent: 0.5, ambientI: 0.08, keyI: 0.8, useSky: false },
      sky:       { floorY: -2.5, skyTop: null, skyBot: '#c0d8f0', floorCol: null, gridCol: '#a0b098', offset: 33, exponent: 0.6, ambientI: 0.4, keyI: 1.2, useSky: true },
    };
    var c = configs[style] || configs.corporate;
    var isLight = (style === 'white' || style === 'corporate' || style === 'playful');
    // Override renderer settings \u2014 the bridge creates with alpha:true which makes bg transparent
    renderer.setClearColor(isLight ? 0xffffff : 0x060510, 1);
    renderer.toneMapping = 1; // LinearToneMapping = 1
    renderer.toneMappingExposure = c.useSky ? 0.5 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = 'srgb';
    // Sky background
    if (c.useSky && T.Sky) {
      // Real THREE.Sky atmospheric scattering \u2014 outdoor look
      var skySun = new T.Sky();
      skySun.scale.setScalar(450000);
      scene.add(skySun);
      var u = skySun.material.uniforms;
      u['turbidity'].value = 10;
      u['rayleigh'].value = 2;
      u['mieCoefficient'].value = 0.005;
      u['mieDirectionalG'].value = 0.8;
      u['sunPosition'].value.set(400000, 400000, 400000);
      renderer.toneMappingExposure = 0.5;
    } else if (c.useSky) {
      // Fallback if Sky not loaded: blue gradient
      var skyGeo = new T.SphereGeometry(5000, 32, 128);
      var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
      scene.add(new T.Mesh(skyGeo, new T.ShaderMaterial({ uniforms: { topColor: {value: new T.Color('#3060a0')}, bottomColor: {value: new T.Color('#b8d4f0')}, offset: {value: 33}, exponent: {value: 0.6} }, vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false })));
    } else {
      // Gradient sky sphere (128 vertical segments = smooth, no banding)
      var skyGeo = new T.SphereGeometry(5000, 32, 128);
      var skyVS = 'varying vec3 vWorldPosition; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var skyFS = 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0); }';
      scene.add(new T.Mesh(skyGeo, new T.ShaderMaterial({ uniforms: { topColor: {value: new T.Color(c.skyTop)}, bottomColor: {value: new T.Color(c.skyBot)}, offset: {value: c.offset}, exponent: {value: c.exponent} }, vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false })));
    }
    // Infinite grid
    var gridGeo = new T.PlaneGeometry(2, 2, 1, 1);
    var gridVS = 'varying vec3 worldPosition; uniform float uDistance; void main() { vec3 pos = position.xzy * uDistance; pos.xz += cameraPosition.xz; worldPosition = pos; gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0); }';
    var gridFS = 'varying vec3 worldPosition; uniform float uSize1; uniform float uSize2; uniform vec3 uColor; uniform float uDistance; float getGrid(float size) { vec2 r = worldPosition.xz / size; vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r); float line = min(grid.x, grid.y); return 1.0 - min(line, 1.0); } void main() { float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0); float g1 = getGrid(uSize1); float g2 = getGrid(uSize2); gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0)); gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2); if (gl_FragColor.a <= 0.0) discard; }';
    var grid = new T.Mesh(gridGeo, new T.ShaderMaterial({ side: T.DoubleSide, transparent: true, uniforms: { uSize1: {value:10}, uSize2: {value:100}, uColor: {value: new T.Color(c.gridCol)}, uDistance: {value:3000} }, vertexShader: gridVS, fragmentShader: gridFS, extensions: { derivatives: true } }));
    grid.frustumCulled = false; grid.position.y = c.floorY; scene.add(grid);
    // Floor \u2014 mode: 'infinite' (fog blend), 'circle' (radial fade), 'none'
    // If floorCol is null (sky style), skip colored floor \u2014 just add shadow catcher
    if (!c.floorCol && !floorColorOverride) { floorMode = 'none'; }
    // White studio default: use ShaderMaterial circle floor (renders at exact color, unaffected by lighting)
    if (c.useShaderFloor && floorMode === 'infinite') { floorMode = 'circle'; }
    var actualFloorCol = floorColorOverride ? new T.Color(floorColorOverride) : (c.floorCol ? new T.Color(c.floorCol) : new T.Color('#ffffff'));
    if (floorMode === 'circle') {
      var circRadius = opts.floorRadius || 80;
      var circGeo = new T.CircleGeometry(circRadius, 128);
      var circFS = 'uniform vec3 uColor; uniform float uRadius; varying vec3 vWorldPos; void main() { float dist = length(vWorldPos.xz); float fade = 1.0 - smoothstep(uRadius * 0.3, uRadius * 0.95, dist); gl_FragColor = vec4(uColor, fade); }';
      var circVS = 'varying vec3 vWorldPos; void main() { vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
      var circMat = new T.ShaderMaterial({ uniforms: { uColor: {value: actualFloorCol}, uRadius: {value: circRadius} }, vertexShader: circVS, fragmentShader: circFS, transparent: true, side: T.DoubleSide, depthWrite: false });
      var circFloor = new T.Mesh(circGeo, circMat);
      circFloor.rotation.x = -Math.PI / 2; circFloor.position.y = c.floorY - 0.01; scene.add(circFloor);
      // Shadow catcher
      var shadowFloor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.15 }));
      shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = c.floorY - 0.005; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
    } else if (floorMode !== 'none') {
      // Infinite floor \u2014 large plane + fog to blend with sky at horizon
      var infFloor = new T.Mesh(new T.PlaneGeometry(10000, 10000), new T.MeshStandardMaterial({ color: actualFloorCol, roughness: 1.0, metalness: 0, envMapIntensity: 0 }));
      infFloor.rotation.x = -Math.PI / 2; infFloor.position.y = c.floorY - 0.01; infFloor.receiveShadow = true; scene.add(infFloor);
      if (!c.noFog) scene.fog = new T.FogExp2(new T.Color(c.skyBot), 0.003);
    }
    // Always add a shadow catcher
    if (floorMode === 'none') {
      var shFloor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.15 }));
      shFloor.rotation.x = -Math.PI / 2; shFloor.position.y = c.floorY - 0.005; shFloor.receiveShadow = true; scene.add(shFloor);
    }
    // 3-point lighting
    scene.add(new T.AmbientLight(isLight ? 0xffffff : 0x111122, c.ambientI));
    var keyL = new T.DirectionalLight(isLight ? 0xfff6e0 : 0xffffff, c.keyI);
    keyL.position.set(-5, 8, 5); keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048);
    keyL.shadow.camera.left = -15; keyL.shadow.camera.right = 15; keyL.shadow.camera.top = 15; keyL.shadow.camera.bottom = -15; keyL.shadow.bias = -0.001;
    scene.add(keyL);
    scene.add(new T.DirectionalLight(isLight ? 0xd0e8ff : 0x4444aa, isLight ? 0.35 : 0.2).translateX(6).translateY(2).translateZ(4));
    scene.add(new T.DirectionalLight(isLight ? 0xffe0d0 : 0xff6040, isLight ? 0.5 : 0.35).translateY(4).translateZ(-9));
    // Env map
    try {
      var pmrem = new T.PMREMGenerator(renderer);
      var envScene = new T.Scene();
      var envSkyGeo = new T.SphereGeometry(50, 32, 16);
      var envSkyMat = new T.ShaderMaterial({ side: T.BackSide, uniforms: { topColor: {value: new T.Color(0xddeeff)}, bottomColor: {value: new T.Color(0xfff8f0)} }, vertexShader: 'varying vec3 vWP; void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWP=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}', fragmentShader: 'uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vWP;void main(){float h=normalize(vWP).y*0.5+0.5;gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0);}' });
      envScene.add(new T.Mesh(envSkyGeo, envSkyMat));
      var p = new T.Mesh(new T.PlaneGeometry(8,4), new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));
      p.position.set(-6,8,5); p.lookAt(0,0,0); envScene.add(p);
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    } catch(e) {}
    return { floorY: c.floorY };
  };
  </script>
  <!-- CenchReact SDK: Remotion-style hooks + bridge components -->
  <script src="/sdk/cench-react/cench-react-runtime.js"></script>
  <script src="/sdk/cench-react/cench-react-bridges.js"></script>
  <!-- CenchMotion + CenchCamera (shared with other scene types) -->
  <script src="/sdk/cench-motion.js"></script>
  <script src="/sdk/cench-camera.js"></script>

  <script id="scene-jsx" type="text/cench-jsx">
${normalizeReactSceneExport(reactCode).replace(/<\/script/gi, "<\\/script")}
  </script>

  <script>
  // CenchReact bootstrapper: transpile JSX and mount the exported scene component.
  // The scene code runs in the same sandboxed iframe as all other scene types.
  (function() {
    var jsxSrc = document.getElementById('scene-jsx').textContent;
    if (!jsxSrc || !jsxSrc.trim()) return;

    // Transpile JSX to JS via Babel standalone
    var js;
    try {
      js = Babel.transform(jsxSrc, {
        presets: [['react', { runtime: 'classic' }]],
        plugins: ['transform-modules-commonjs'],
      }).code;
    } catch (e) {
      console.error('CenchReact: JSX transpilation failed', e);
      var errDiv = document.getElementById('react-root');
      if (errDiv) errDiv.textContent = 'JSX Error: ' + e.message;
      try {
        window.parent.postMessage({ source: 'cench-scene', type: 'cench-jsx-error', sceneId: SCENE_ID, message: e.message }, '*');
      } catch(ignore) {}
      return;
    }

    // Inject transpiled code as a script element (same pattern as other scene types
    // which embed AI-generated JS directly in inline script tags)
    var scriptEl = document.createElement('script');
    scriptEl.textContent = '(function(useCurrentFrame,useVideoConfig,interpolate,spring,Sequence,AbsoluteFill,Easing,Canvas2DLayer,ThreeJSLayer,D3Layer,SVGLayer,LottieLayer,useVariable,useInteraction,useTrigger){var module={exports:{}};var exports=module.exports;'
      + 'var require=function(mod){var _r={useCurrentFrame:useCurrentFrame,useVideoConfig:useVideoConfig,interpolate:interpolate,spring:spring,Sequence:Sequence,AbsoluteFill:AbsoluteFill,Easing:Easing};var m={"react":React,"three":typeof THREE!=="undefined"?THREE:{},"d3":typeof d3!=="undefined"?d3:{},"animejs":typeof anime!=="undefined"?anime:{},"anime":typeof anime!=="undefined"?anime:{},"remotion":_r,"@remotion/core":_r};if(m[mod]!==undefined)return m[mod];console.warn("CenchReact: unknown module "+mod);return {};};'
      + js
      + ';window.__CenchSceneExports=module.exports;'
      + '})(CenchReact.useCurrentFrame,CenchReact.useVideoConfig,CenchReact.interpolate,CenchReact.spring,CenchReact.Sequence,CenchReact.AbsoluteFill,CenchReact.Easing,CenchReact.Canvas2DLayer,CenchReact.ThreeJSLayer,CenchReact.D3Layer,CenchReact.SVGLayer,CenchReact.LottieLayer,CenchReact.useVariable,CenchReact.useInteraction,CenchReact.useTrigger);';
    document.body.appendChild(scriptEl);

    // Resolve the exported component
    var exp = window.__CenchSceneExports || {};
    var SceneComponent = exp.default || exp.Scene || (typeof exp === 'function' ? exp : null);
    if (typeof SceneComponent !== 'function') {
      // Self-diagnose: look at the source to hint what's missing.
      var hint = 'Add "export default Scene;" at the end of the scene code.';
      if (/function\\s+(Scene|Main|App|Root)\\b/.test(jsxSrc) && !/export\\s+default/.test(jsxSrc)) {
        hint = 'Found a component but no "export default" statement. Scene renders blank without it. Add: "export default Scene;" at the end.';
      } else if (!/function|const|let|var/.test(jsxSrc)) {
        hint = 'No component declaration found in scene source.';
      }
      console.error('CenchReact: No component exported. ' + hint);
      var root = document.getElementById('react-root');
      if (root) root.textContent = 'Scene error: ' + hint;
      return;
    }

    // Error boundary to catch runtime errors in scene code
    var ErrorBoundary = (function() {
      function EB(props) { this.state = { error: null }; }
      EB.prototype = Object.create(React.Component.prototype);
      EB.prototype.constructor = EB;
      EB.getDerivedStateFromError = function(err) { return { error: err }; };
      EB.prototype.componentDidCatch = function(err, info) {
        console.error('CenchReact scene error:', err, info);
      };
      EB.prototype.render = function() {
        if (this.state.error) {
          return React.createElement('div', {
            style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: '12px',
              background: '#1a1a2e', color: '#e84545', fontFamily: 'monospace', padding: '40px' }
          },
            React.createElement('div', { style: { fontSize: '18px', fontWeight: 700 } }, 'Scene Error'),
            React.createElement('pre', { style: { fontSize: '13px', color: '#ccc', maxWidth: '80%',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, String(this.state.error.message || this.state.error))
          );
        }
        return this.props.children;
      };
      return EB;
    })();

    // Mount inside CenchComposition with Error Boundary
    var fps = 30;
    var root = ReactDOM.createRoot(document.getElementById('react-root'));
    root.render(
      React.createElement(ErrorBoundary, null,
        React.createElement(CenchReact.CenchComposition, {
          fps: fps,
          width: WIDTH,
          height: HEIGHT,
          durationInFrames: Math.round(DURATION * fps),
        }, React.createElement(SceneComponent))
      )
    );

    // Apply element overrides (non-destructive visual tweaks from the inspector)
    var __overrides = ${JSON.stringify(scene.elementOverrides ?? {})};
    if (Object.keys(__overrides).length > 0) {
      requestAnimationFrame(function() {
        setTimeout(function() {
          Object.keys(__overrides).forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            var props = __overrides[id];
            Object.keys(props).forEach(function(prop) {
              var val = props[prop];
              if (prop === 'text') el.textContent = String(val);
              else el.style[prop] = (typeof val === 'number') ? (val + 'px') : String(val);
            });
          });
        }, 50);
      });
    }
  })();
  </script>
</body>
</html>`;
}
function generateSceneHTML(scene, globalStyle, watermark, audioSettings, dims) {
  const { width: W, height: H } = dims ?? DEFAULT_DIMENSIONS;
  const hasOverride = scene.styleOverride != null && Object.keys(scene.styleOverride).length > 0;
  const style = hasOverride && globalStyle ? resolveSceneStyle(scene.styleOverride, globalStyle) : resolveStyleFromGlobal(globalStyle);
  if (scene.bgColor) {
    style.bgColor = scene.bgColor;
  }
  const _dims = { width: W, height: H };
  let html;
  if (scene.sceneType === "canvas2d") html = generateCanvasHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "motion") html = generateMotionHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "d3") html = generateD3HTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "three") html = generateThreeHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "lottie") html = generateLottieHTML(scene, audioSettings, _dims);
  else if (scene.sceneType === "zdog") html = generateZdogHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "physics") html = generatePhysicsHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "3d_world") html = generateWorldHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "avatar_scene") html = generateAvatarSceneHTML(scene, style, audioSettings, _dims);
  else if (scene.sceneType === "react") html = generateReactHTML(scene, style, audioSettings, _dims);
  else html = generateSVGHTML(scene, style, audioSettings, _dims);
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  html = html.replace("<head>", `<head>
  <base href="${appBaseUrl}/">` + GSAP_HEAD);
  const hasTalkingHead = scene.aiLayers?.some((l) => l.type === "avatar" && l.talkingHeadUrl);
  if (hasTalkingHead) {
    const importMap = `
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
    }
  }
  </script>`;
    html = html.replace("</head>", importMap + "\n</head>");
  }
  const controllerScript = `<script>${PLAYBACK_CONTROLLER}</script>`;
  const registryScript = `<script>${ELEMENT_REGISTRY}</script>`;
  const canvasBgUserCode = scene.canvasBackgroundCode?.trim() ?? "";
  const canvasBgScript = canvasBgUserCode && ["motion", "d3", "svg", "react"].includes(scene.sceneType ?? "") ? `<script>
${canvasBgUserCode}
</script>` : "";
  if (html.includes("<!-- playback-controller-slot -->")) {
    html = html.replace(
      "<!-- playback-controller-slot -->",
      controllerScript + "\n" + registryScript + (canvasBgScript ? `
${canvasBgScript}` : "")
    );
  } else {
    html = html.replace("</body>", controllerScript + "\n" + registryScript + "\n</body>");
  }
  if (scene.cameraMotion && scene.cameraMotion.length > 0) {
    const cameraScript = generateCameraMotionScript(scene.cameraMotion);
    html = html.replace("</body>", cameraScript + "\n</body>");
  }
  if (watermark?.publicUrl) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const wmUrl = watermark.publicUrl.startsWith("http") ? watermark.publicUrl : `${baseUrl}${watermark.publicUrl}`;
    const posCSS = getWatermarkPositionCSS(watermark.position);
    const wmHTML = `<div style="position:fixed;${posCSS};opacity:${watermark.opacity};pointer-events:none;z-index:9999;">
  <img src="${escapeAttr(wmUrl)}" style="width:${watermark.sizePercent}vw;height:auto;" />
</div>`;
    html = html.replace("</body>", wmHTML + "\n</body>");
  }
  return html;
}
function getWatermarkPositionCSS(position) {
  switch (position) {
    case "top-left":
      return "top:2vw;left:2vw";
    case "top-right":
      return "top:2vw;right:2vw";
    case "bottom-left":
      return "bottom:2vw;left:2vw";
    case "bottom-right":
      return "bottom:2vw;right:2vw";
    default:
      return "bottom:2vw;right:2vw";
  }
}
function generateSVGHTML(scene, style, audioSettings, dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const { svgContent = "", videoLayer, textOverlays = [], svgObjects = [], primaryObjectId = null } = scene;
  const hasPrimaryObject = !!primaryObjectId && svgObjects.some((o) => o.id === primaryObjectId);
  const svgObjectsHTML = svgObjects.map(
    (obj) => obj.svgContent ? `<div class="svg-object" id="obj-${obj.id}" style="position:absolute;left:${obj.x}%;top:${obj.y}%;width:${obj.width}%;opacity:${obj.opacity};z-index:${obj.zIndex};pointer-events:none;">${obj.svgContent}</div>` : ""
  ).join("\n  ");
  const textOverlaysHTML = textOverlays.map((t) => {
    const animMap = {
      "fade-in": "fadeInOverlay",
      "slide-up": "slideUpOverlay",
      typewriter: "fadeInOverlay"
    };
    return `<div class="text-overlay" style="left:${t.x}%;top:${t.y}%;font-family:${t.font};font-size:${t.size}px;color:${t.color};animation:${animMap[t.animation]} ${t.duration}s ease ${t.delay}s forwards;">${t.content}</div>`;
  }).join("\n  ");
  const videoDisplay = videoLayer?.enabled ? "block" : "none";
  const videoOpacity = videoLayer?.opacity ?? 1;
  const videoSrc = videoLayer?.src ?? "";
  const videoTrimStart = videoLayer?.trimStart ?? 0;
  const audioHTML = generateAudioHTML(scene.audioLayer);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${buildSceneFontLinks(style)}
  ${style.roughnessLevel > 0.2 ? '<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>' : ""}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; animation-play-state: paused; }
    body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${style.bgColor};
      --bg-color: ${style.bgColor};
      ${buildBgStyleCSS(style)}
    }

    #video-layer {
      position: absolute; inset: 0;
      opacity: ${videoOpacity};
      z-index: 1;
      display: ${videoDisplay};
    }
    #video-layer video { width: 100%; height: 100%; object-fit: cover; }

    #svg-layer {
      position: absolute; inset: 0;
      z-index: 2;
    }
    #svg-layer svg { width: 100%; height: 100%; }

    .text-overlay {
      position: absolute;
      z-index: 3;
      opacity: 0;
      white-space: pre-wrap;
    }

    .svg-object svg { width: 100%; height: auto; display: block; background: transparent; }

    /* Stroke animation */
    .stroke {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: var(--len, 1000);
      stroke-dashoffset: var(--len, 1000);
      animation: draw var(--dur, 1s) ease-in-out var(--delay, 0s) forwards;
    }
    .fadein {
      opacity: 0;
      animation: pop var(--dur, 0.4s) ease var(--delay, 0s) forwards;
    }
    @keyframes draw      { to { stroke-dashoffset: 0; } }
    @keyframes pop       { to { opacity: 1; } }
    @keyframes scaleIn   { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp   { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes bounceIn  { 0% { opacity: 0; transform: scale(0); } 60% { opacity: 1; transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes rotateIn  { from { opacity: 0; transform: rotate(-15deg); } to { opacity: 1; transform: rotate(0deg); } }
    @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUpOverlay {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .scale {
      opacity: 0; transform-origin: center center;
      animation: scaleIn var(--dur, 0.4s) ease var(--delay, 0s) forwards;
    }
    .slide-up {
      opacity: 0;
      animation: slideUp var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
    .slide-left {
      opacity: 0;
      animation: slideLeft var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
    .bounce {
      opacity: 0; transform-origin: center center;
      animation: bounceIn var(--dur, 0.6s) cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0s) forwards;
    }
    .rotate {
      opacity: 0; transform-origin: center center;
      animation: rotateIn var(--dur, 0.5s) ease var(--delay, 0s) forwards;
    }
  </style>
</head>
<body>

  <div id="scene-camera" style="position:absolute;inset:0;transform-origin:center center;will-change:transform,filter;">

  ${sceneUsesCanvasBackground(scene) ? canvasBgTag(W, H) : ""}

  <div id="video-layer">
    ${videoLayer?.enabled && videoSrc ? `<video src="${videoSrc}" muted playsinline></video>` : ""}
  </div>

  ${hasPrimaryObject ? "" : `<div id="svg-layer">${svgContent}</div>`}

  ${audioHTML}

  ${svgObjectsHTML}

  ${textOverlaysHTML}

  ${generateAILayersHTML(scene.aiLayers, audioSettings)}

  </div><!-- /scene-camera -->

  <script>
    // \u2500\u2500 Scene globals \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    var SCENE_ID     = '${escapeJsString(scene.id)}';
    var PALETTE      = ${JSON.stringify(style.palette)};
    var DURATION     = ${scene.duration};
    var ROUGHNESS    = ${style.roughnessLevel};
    var FONT         = '${style.font}';
    var BODY_FONT    = '${style.bodyFont || style.font}';
    var STROKE_COLOR = '${style.strokeColor}';
    var BG_COLOR     = '${style.bgColor}';
    var WIDTH        = ${W};
    var HEIGHT       = ${H};

    document.addEventListener('DOMContentLoaded', () => {
      // Auto-calculate stroke-dasharray lengths (legacy CSS animation scenes)
      document.querySelectorAll('.stroke').forEach(el => {
        if (el.getTotalLength) {
          el.style.setProperty('--len', el.getTotalLength());
        }
      });

      const video = document.querySelector('#video-layer video');
      if (video) video.currentTime = ${videoTrimStart};

      // Audio volume is handled by the playback controller
    });
  </script>

  <!-- playback-controller-slot -->
</body>
</html>`;
}

// electron/ipc/scene.ts
function resolveScenesDir2() {
  return import_electron4.app.isPackaged ? import_node_path4.default.join(import_electron4.app.getPath("userData"), "scenes") : import_node_path4.default.join(process.cwd(), "public", "scenes");
}
var SCENE_ID_RE = /^[a-zA-Z0-9_-]+$/;
var MAX_HTML_BYTES = 5 * 1024 * 1024;
async function writeHtml(args) {
  if (!SCENE_ID_RE.test(args.id)) {
    throw new IpcValidationError("invalid scene id");
  }
  if (typeof args.html !== "string") {
    throw new IpcValidationError("html must be a string");
  }
  if (args.html.length > MAX_HTML_BYTES) {
    throw new IpcValidationError("HTML body exceeds 5MB limit");
  }
  const scenesDir = resolveScenesDir2();
  await import_promises4.default.mkdir(scenesDir, { recursive: true });
  const destPath = import_node_path4.default.resolve(import_node_path4.default.join(scenesDir, `${args.id}.html`));
  if (!destPath.startsWith(scenesDir + import_node_path4.default.sep)) {
    throw new IpcValidationError("Invalid scene id (path escape)");
  }
  await import_promises4.default.writeFile(destPath, args.html, "utf-8");
  return { success: true, path: `/scenes/${args.id}.html` };
}
async function get4(args) {
  assertValidUuid(args.projectId, "projectId");
  assertValidUuid(args.sceneId, "sceneId");
  await loadProjectOrThrow(args.projectId);
  const [project] = await db.select({ description: projects.description }).from(projects).where((0, import_drizzle_orm10.eq)(projects.id, args.projectId)).limit(1);
  if (!project) throw new IpcNotFoundError(`Project ${args.projectId} not found`);
  const tableBacked = await readProjectScenesFromTables(args.projectId);
  const scenes2 = tableBacked?.scenes ?? readProjectSceneBlob(project.description).scenes;
  const scene = scenes2.find((s) => s.id === args.sceneId);
  if (!scene) {
    throw new IpcNotFoundError(`Scene ${args.sceneId} not found`);
  }
  return { scene };
}
async function generateWorld(args) {
  if (!args.scene?.id || !args.scene?.worldConfig) {
    throw new IpcValidationError("scene with worldConfig required");
  }
  if (!SCENE_ID_RE.test(args.scene.id)) {
    throw new IpcValidationError("invalid scene id");
  }
  const html = generateSceneHTML(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args.scene,
    args.scene.globalStyle ?? void 0,
    void 0,
    void 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveProjectDimensions(args.aspectRatio, args.resolution)
  );
  const scenesDir = resolveScenesDir2();
  await import_promises4.default.mkdir(scenesDir, { recursive: true });
  const destPath = import_node_path4.default.resolve(import_node_path4.default.join(scenesDir, `${args.scene.id}.html`));
  if (!destPath.startsWith(scenesDir + import_node_path4.default.sep)) {
    throw new IpcValidationError("Invalid scene id (path escape)");
  }
  await import_promises4.default.writeFile(destPath, html, "utf-8");
  return { success: true, path: `/scenes/${args.scene.id}.html` };
}
function register10(ipcMain2) {
  ipcMain2.handle("cench:scene.writeHtml", (_e, args) => writeHtml(args));
  ipcMain2.handle("cench:scene.get", (_e, args) => get4(args));
  ipcMain2.handle("cench:scene.generateWorld", (_e, args) => generateWorld(args));
}

// electron/ipc/media.ts
var import_node_path6 = __toESM(require("node:path"));
var import_promises5 = __toESM(require("node:fs/promises"));
var import_uuid = require("uuid");

// lib/uploads/paths.ts
var import_node_path5 = __toESM(require("node:path"));
function getUploadsDir() {
  return process.env.CENCH_UPLOADS_DIR || import_node_path5.default.join(process.cwd(), "public", "uploads");
}
function uploadsUrlFor(relativePath) {
  const raw = process.env.CENCH_UPLOADS_URL_BASE || "/uploads/";
  const base = raw.endsWith("/") ? raw : `${raw}/`;
  const rel = relativePath.replace(/^\/+/, "");
  return `${base}${rel}`;
}

// electron/ipc/media.ts
var ALLOWED_TYPES = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "application/json": "json"
};
var MAX_SIZE = 100 * 1024 * 1024;
async function upload(args) {
  if (!args || typeof args !== "object") throw new IpcValidationError("upload args required");
  if (!(args.data instanceof ArrayBuffer)) throw new IpcValidationError("data must be an ArrayBuffer");
  if (typeof args.mimeType !== "string" || args.mimeType.length === 0) {
    throw new IpcValidationError("mimeType required");
  }
  const ext = ALLOWED_TYPES[args.mimeType];
  if (!ext) throw new IpcValidationError(`Unsupported file type: ${args.mimeType}`);
  if (args.data.byteLength > MAX_SIZE) {
    throw new IpcValidationError("File too large (max 100MB)");
  }
  const buffer = Buffer.from(args.data);
  if (ext === "json") {
    try {
      const json = JSON.parse(buffer.toString("utf-8"));
      if (!json.v || !json.w || !json.h || !json.layers) {
        throw new IpcValidationError("File does not appear to be a valid Lottie animation");
      }
    } catch (err) {
      if (err instanceof IpcValidationError) throw err;
      throw new IpcValidationError("Invalid JSON file");
    }
  }
  const uploadsDir2 = getUploadsDir();
  await import_promises5.default.mkdir(uploadsDir2, { recursive: true });
  const filename = `${(0, import_uuid.v4)()}.${ext}`;
  const destPath = import_node_path6.default.resolve(import_node_path6.default.join(uploadsDir2, filename));
  if (!destPath.startsWith(uploadsDir2 + import_node_path6.default.sep)) {
    throw new IpcValidationError("Invalid upload path (escape)");
  }
  await import_promises5.default.writeFile(destPath, buffer);
  return { url: uploadsUrlFor(filename), filename };
}
function register11(ipcMain2) {
  ipcMain2.handle("cench:media.upload", (_e, args) => upload(args));
}

// electron/ipc/avatar-configs.ts
var import_drizzle_orm11 = require("drizzle-orm");

// lib/avatar/providers/talkinghead.ts
var talkingHeadProvider = {
  id: "talkinghead",
  name: "Animated Character (Free)",
  isFree: true,
  requiresImage: false,
  estimateCost: () => 0,
  async generate(input, config4) {
    const character = config4.characterFile || "friendly";
    const idleAnimation = config4.idleAnimation || "idle";
    const style = config4.style || "default";
    const modelFromConfig = config4.avatarModelId || config4.model;
    const model = typeof modelFromConfig === "string" && isTalkingHeadModelId(modelFromConfig) ? modelFromConfig : DEFAULT_TALKING_HEAD_MODEL_BY_CHARACTER[character] ?? "brunette";
    const params = new URLSearchParams({
      text: input.text,
      audio: input.audioUrl,
      character,
      model,
      idle: idleAnimation,
      style
    });
    return {
      videoUrl: `talkinghead://render?${params.toString()}`,
      durationSeconds: input.durationSeconds,
      costUsd: 0,
      provider: "talkinghead"
    };
  }
};

// lib/avatar/providers/musetalk.ts
var fal = __toESM(require("@fal-ai/serverless-client"));
function configureFal() {
  const key = process.env.FAL_KEY;
  if (key) fal.config({ credentials: key });
}
var museTalkProvider = {
  id: "musetalk",
  name: "MuseTalk (Realistic)",
  isFree: false,
  requiresImage: true,
  estimateCost: () => 0.04,
  async generate(input, config4) {
    configureFal();
    const result = await fal.subscribe("fal-ai/musetalk", {
      input: {
        source_video_url: input.sourceImageUrl,
        audio_url: input.audioUrl
      }
    });
    return {
      videoUrl: result.video.url,
      durationSeconds: input.durationSeconds,
      costUsd: 0.04,
      provider: "musetalk"
    };
  }
};

// lib/avatar/providers/fabric.ts
var fal2 = __toESM(require("@fal-ai/serverless-client"));
function configureFal2() {
  const key = process.env.FAL_KEY;
  if (key) fal2.config({ credentials: key });
}
var fabricProvider = {
  id: "fabric",
  name: "Fabric 1.0 (Any Image Style)",
  isFree: false,
  requiresImage: true,
  estimateCost: (duration) => duration * 0.08,
  async generate(input, config4) {
    configureFal2();
    const resolution = config4.resolution || "480p";
    const costPerSec = resolution === "720p" ? 0.15 : 0.08;
    const result = await fal2.subscribe("veed/fabric-1.0", {
      input: {
        image_url: input.sourceImageUrl,
        audio_url: input.audioUrl,
        resolution
      }
    });
    return {
      videoUrl: result.video.url,
      durationSeconds: input.durationSeconds,
      costUsd: input.durationSeconds * costPerSec,
      provider: "fabric"
    };
  }
};

// lib/avatar/providers/aurora.ts
var fal3 = __toESM(require("@fal-ai/serverless-client"));
function configureFal3() {
  const key = process.env.FAL_KEY;
  if (key) fal3.config({ credentials: key });
}
var auroraProvider = {
  id: "aurora",
  name: "Aurora (Studio Quality)",
  isFree: false,
  requiresImage: true,
  estimateCost: (duration) => duration * 0.05,
  async generate(input, config4) {
    configureFal3();
    const result = await fal3.subscribe("creatify/aurora", {
      input: {
        image_url: input.sourceImageUrl,
        audio_url: input.audioUrl
      }
    });
    return {
      videoUrl: result.video.url,
      durationSeconds: input.durationSeconds,
      costUsd: input.durationSeconds * 0.05,
      provider: "aurora"
    };
  }
};

// lib/apis/heygen.ts
var HEYGEN_BASE = "https://api.heygen.com/v2";
var HEYGEN_KEY = () => process.env.HEYGEN_API_KEY;
async function heygenFetch(path23, options = {}) {
  const response = await fetch(`${HEYGEN_BASE}${path23}`, {
    ...options,
    headers: {
      "X-Api-Key": HEYGEN_KEY(),
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? data.message ?? `HeyGen API error: ${response.status}`);
  }
  return data.data ?? data;
}
var AVATAR_CACHE_TTL = 24 * 60 * 60 * 1e3;
async function generateAvatarVideo(opts) {
  const data = await heygenFetch("/video/generate", {
    method: "POST",
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: opts.avatarId,
            avatar_style: "normal"
          },
          voice: {
            type: "text",
            input_text: opts.script,
            voice_id: opts.voiceId
          },
          background: {
            type: "color",
            value: opts.bgColor ?? "#00FF00"
            // green for chroma key
          }
        }
      ],
      dimension: {
        width: opts.width ?? 512,
        height: opts.height ?? 512
      }
    })
  });
  const wordCount = opts.script.split(/\s+/).length;
  const estimatedSeconds = Math.ceil(wordCount / 150 * 60);
  return {
    videoId: data.video_id,
    estimatedSeconds
  };
}
async function getVideoStatus(videoId) {
  const data = await heygenFetch(`/video_status.get?video_id=${videoId}`);
  return {
    status: data.status,
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url,
    error: data.error
  };
}
var VOICE_CACHE_TTL = 24 * 60 * 60 * 1e3;

// lib/avatar/providers/heygen.ts
var heygenProvider = {
  id: "heygen",
  name: "HeyGen (Premium)",
  isFree: false,
  requiresImage: false,
  estimateCost: (duration) => duration * 0.1,
  async generate(input, config4) {
    const avatarId = config4.avatarId;
    const voiceId = config4.voiceId;
    if (!avatarId || !voiceId) {
      throw new Error("HeyGen provider requires avatarId and voiceId in config");
    }
    const { videoId, estimatedSeconds } = await generateAvatarVideo({
      avatarId,
      voiceId,
      script: input.text,
      bgColor: config4.bgColor ?? "#00FF00",
      width: config4.width ?? 512,
      height: config4.height ?? 512
    });
    const maxAttempts = 60;
    const pollInterval = 5e3;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const status = await getVideoStatus(videoId);
      if (status.status === "completed" && status.videoUrl) {
        return {
          videoUrl: status.videoUrl,
          durationSeconds: estimatedSeconds,
          costUsd: estimatedSeconds * 0.1,
          provider: "heygen"
        };
      }
      if (status.status === "failed") {
        throw new Error(`HeyGen generation failed: ${status.error ?? "unknown error"}`);
      }
    }
    throw new Error("HeyGen generation timed out after 5 minutes");
  }
};

// lib/avatar/index.ts
var PROVIDERS = {
  talkinghead: talkingHeadProvider,
  musetalk: museTalkProvider,
  fabric: fabricProvider,
  aurora: auroraProvider,
  heygen: heygenProvider
};
var AvatarService = class {
  static getProvider(providerId) {
    const provider = PROVIDERS[providerId];
    if (!provider) throw new Error(`Unknown avatar provider: ${providerId}`);
    return provider;
  }
  static async generate(input, avatarConfig) {
    const provider = this.getProvider(avatarConfig.provider);
    if (provider.requiresImage && !input.sourceImageUrl) {
      const configImage = avatarConfig.config?.sourceImageUrl;
      if (!configImage) {
        throw new Error(`Provider ${provider.id} requires a source image. Upload one in avatar settings.`);
      }
      input.sourceImageUrl = configImage;
    }
    return provider.generate(input, avatarConfig.config);
  }
  static getAllProviders() {
    return Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      name: p.name,
      isFree: p.isFree,
      requiresImage: p.requiresImage
    }));
  }
  static estimateCost(providerId, durationSeconds) {
    const provider = PROVIDERS[providerId];
    return provider ? provider.estimateCost(durationSeconds) : 0;
  }
};

// electron/ipc/avatar-configs.ts
async function list5(args) {
  assertValidUuid(args.projectId, "projectId");
  await loadProjectOrThrow(args.projectId);
  const configs = await db.select().from(avatarConfigs).where((0, import_drizzle_orm11.eq)(avatarConfigs.projectId, args.projectId)).orderBy(avatarConfigs.createdAt);
  return { configs, providers: AvatarService.getAllProviders() };
}
async function create4(args) {
  assertValidUuid(args.projectId, "projectId");
  await loadProjectOrThrow(args.projectId);
  if (!args.provider || typeof args.provider !== "string") {
    throw new IpcValidationError("provider is required");
  }
  if (!args.name || typeof args.name !== "string") {
    throw new IpcValidationError("name is required");
  }
  if (args.isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where((0, import_drizzle_orm11.eq)(avatarConfigs.projectId, args.projectId));
  }
  const [created] = await db.insert(avatarConfigs).values({
    projectId: args.projectId,
    provider: args.provider,
    name: args.name,
    config: args.config ?? {},
    isDefault: args.isDefault ?? false
  }).returning();
  return created;
}
async function update5(args) {
  assertValidUuid(args.projectId, "projectId");
  assertValidUuid(args.configId, "configId");
  await loadProjectOrThrow(args.projectId);
  if (args.isDefault) {
    await db.update(avatarConfigs).set({ isDefault: false }).where((0, import_drizzle_orm11.eq)(avatarConfigs.projectId, args.projectId));
  }
  const updates = {};
  if (args.provider !== void 0) updates.provider = args.provider;
  if (args.name !== void 0) updates.name = args.name;
  if (args.config !== void 0) updates.config = args.config;
  if (args.isDefault !== void 0) updates.isDefault = args.isDefault;
  if (args.thumbnailUrl !== void 0) updates.thumbnailUrl = args.thumbnailUrl;
  const [updated] = await db.update(avatarConfigs).set(updates).where((0, import_drizzle_orm11.and)((0, import_drizzle_orm11.eq)(avatarConfigs.id, args.configId), (0, import_drizzle_orm11.eq)(avatarConfigs.projectId, args.projectId))).returning();
  if (!updated) throw new IpcNotFoundError(`Config ${args.configId} not found`);
  return updated;
}
async function remove4(args) {
  assertValidUuid(args.projectId, "projectId");
  assertValidUuid(args.configId, "configId");
  await loadProjectOrThrow(args.projectId);
  const [deleted] = await db.delete(avatarConfigs).where((0, import_drizzle_orm11.and)((0, import_drizzle_orm11.eq)(avatarConfigs.id, args.configId), (0, import_drizzle_orm11.eq)(avatarConfigs.projectId, args.projectId))).returning();
  if (!deleted) throw new IpcNotFoundError(`Config ${args.configId} not found`);
  return { success: true };
}
function register12(ipcMain2) {
  ipcMain2.handle("cench:avatarConfigs.list", (_e, args) => list5(args));
  ipcMain2.handle("cench:avatarConfigs.create", (_e, args) => create4(args));
  ipcMain2.handle("cench:avatarConfigs.update", (_e, args) => update5(args));
  ipcMain2.handle("cench:avatarConfigs.delete", (_e, args) => remove4(args));
}

// electron/ipc/zdog-library.ts
var import_drizzle_orm12 = require("drizzle-orm");
var import_uuid2 = require("uuid");
function parseBlob(description) {
  if (!description) return {};
  try {
    return JSON.parse(description);
  } catch {
    return {};
  }
}
async function list6(args) {
  assertValidUuid(args.projectId, "projectId");
  await loadProjectOrThrow(args.projectId);
  const [project] = await db.select({ description: projects.description }).from(projects).where((0, import_drizzle_orm12.eq)(projects.id, args.projectId)).limit(1);
  if (!project) throw new IpcNotFoundError("Project not found");
  const blob = parseBlob(project.description);
  return {
    assets: [
      ...blob.zdogStudioLibrary ?? [],
      ...(blob.zdogLibrary ?? []).map((a) => ({ ...a, assetType: "person" }))
    ]
  };
}
async function save(args) {
  assertValidUuid(args.projectId, "projectId");
  await loadProjectOrThrow(args.projectId);
  if (!args.name || typeof args.name !== "string") throw new IpcValidationError("name is required");
  const tags = args.tags ?? [];
  const [existing] = await db.select({ description: projects.description, version: projects.version }).from(projects).where((0, import_drizzle_orm12.eq)(projects.id, args.projectId)).limit(1);
  if (!existing) throw new IpcNotFoundError("Project not found");
  const currentVersion = existing.version ?? 1;
  const blob = parseBlob(existing.description);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let updatedBlob;
  let asset;
  if (args.assetType === "studio") {
    if (!args.shapes?.length) throw new IpcValidationError("shapes are required for studio assets");
    asset = {
      id: (0, import_uuid2.v4)(),
      name: args.name.slice(0, 120),
      shapes: args.shapes,
      tags,
      createdAt: now,
      updatedAt: now
    };
    updatedBlob = { ...blob, zdogStudioLibrary: [...blob.zdogStudioLibrary ?? [], asset] };
  } else {
    if (!args.formula) throw new IpcValidationError("formula is required for person assets");
    asset = {
      id: (0, import_uuid2.v4)(),
      name: args.name.slice(0, 120),
      formula: args.formula,
      tags,
      createdAt: now,
      updatedAt: now
    };
    updatedBlob = { ...blob, zdogLibrary: [...blob.zdogLibrary ?? [], asset] };
  }
  const [updated] = await db.update(projects).set({
    description: JSON.stringify(updatedBlob),
    version: currentVersion + 1,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(projects.id, args.projectId), (0, import_drizzle_orm12.eq)(projects.version, currentVersion))).returning({ id: projects.id });
  if (!updated) throw new IpcConflictError("Project was modified concurrently. Please retry.");
  return { success: true, asset };
}
async function remove5(args) {
  assertValidUuid(args.projectId, "projectId");
  if (!args.id || typeof args.id !== "string") throw new IpcValidationError("id is required");
  await loadProjectOrThrow(args.projectId);
  const [existing] = await db.select({ description: projects.description, version: projects.version }).from(projects).where((0, import_drizzle_orm12.eq)(projects.id, args.projectId)).limit(1);
  if (!existing) throw new IpcNotFoundError("Project not found");
  const currentVersion = existing.version ?? 1;
  const blob = parseBlob(existing.description);
  const prevStudio = blob.zdogStudioLibrary ?? [];
  const newStudio = prevStudio.filter((a) => a.id !== args.id);
  const prevPerson = blob.zdogLibrary ?? [];
  const newPerson = prevPerson.filter((a) => a.id !== args.id);
  if (newStudio.length === prevStudio.length && newPerson.length === prevPerson.length) {
    throw new IpcNotFoundError("Asset not found");
  }
  const [updated] = await db.update(projects).set({
    description: JSON.stringify({ ...blob, zdogLibrary: newPerson, zdogStudioLibrary: newStudio }),
    version: currentVersion + 1,
    updatedAt: /* @__PURE__ */ new Date()
  }).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(projects.id, args.projectId), (0, import_drizzle_orm12.eq)(projects.version, currentVersion))).returning({ id: projects.id });
  if (!updated) throw new IpcConflictError("Project was modified concurrently. Please retry.");
  return { success: true };
}
function register13(ipcMain2) {
  ipcMain2.handle("cench:zdogLibrary.list", (_e, args) => list6(args));
  ipcMain2.handle("cench:zdogLibrary.save", (_e, args) => save(args));
  ipcMain2.handle("cench:zdogLibrary.delete", (_e, args) => remove5(args));
}

// lib/services/audio.ts
var import_promises16 = __toESM(require("node:fs/promises"));
var import_node_path8 = __toESM(require("node:path"));

// lib/audio/router.ts
var ttsProviders = {
  elevenlabs: () => Promise.resolve().then(() => (init_elevenlabs_tts(), elevenlabs_tts_exports)).then((m) => m.elevenlabsTTS),
  "openai-tts": () => Promise.resolve().then(() => (init_openai_tts(), openai_tts_exports)).then((m) => m.openaiTTS),
  "gemini-tts": () => Promise.resolve().then(() => (init_gemini_tts(), gemini_tts_exports)).then((m) => m.geminiTTS),
  "google-tts": () => Promise.resolve().then(() => (init_google_tts(), google_tts_exports)).then((m) => m.googleTTS),
  "openai-edge-tts": () => Promise.resolve().then(() => (init_openai_edge_tts(), openai_edge_tts_exports)).then((m) => m.openaiEdgeTTS),
  "pocket-tts": () => Promise.resolve().then(() => (init_pocket_tts(), pocket_tts_exports)).then((m) => m.pocketTTS),
  voxcpm: () => Promise.resolve().then(() => (init_voxcpm_tts(), voxcpm_tts_exports)).then((m) => m.voxcpmTTS),
  "native-tts": () => Promise.resolve().then(() => (init_native_tts(), native_tts_exports)).then((m) => m.nativeTTS),
  "web-speech": () => Promise.resolve().then(() => (init_web_speech(), web_speech_exports)).then((m) => m.webSpeechTTS),
  puter: () => Promise.resolve().then(() => (init_puter_tts(), puter_tts_exports)).then((m) => m.puterTTS)
};
var sfxProviders = {
  "elevenlabs-sfx": () => Promise.resolve().then(() => (init_elevenlabs_sfx(), elevenlabs_sfx_exports)).then((m) => m.elevenlabsSFX),
  freesound: () => Promise.resolve().then(() => (init_freesound(), freesound_exports)).then((m) => m.freesoundSFX),
  pixabay: () => Promise.resolve().then(() => (init_pixabay(), pixabay_exports)).then((m) => m.pixabaySFX)
};
var musicProviders = {
  "pixabay-music": () => Promise.resolve().then(() => (init_pixabay_music(), pixabay_music_exports)).then((m) => m.pixabayMusic),
  "freesound-music": () => Promise.resolve().then(() => (init_freesound_music(), freesound_music_exports)).then((m) => m.freesoundMusic)
};
function getBestSFXProvider(settings) {
  if (settings?.defaultSFXProvider && settings.defaultSFXProvider !== "auto") {
    return settings.defaultSFXProvider;
  }
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs-sfx";
  if (process.env.FREESOUND_API_KEY) return "freesound";
  if (process.env.PIXABAY_API_KEY) return "pixabay";
  return "freesound";
}
function getBestMusicProvider(settings) {
  if (settings?.defaultMusicProvider && settings.defaultMusicProvider !== "auto") {
    return settings.defaultMusicProvider;
  }
  if (process.env.PIXABAY_API_KEY) return "pixabay-music";
  return "freesound-music";
}
async function getTTSProvider(id) {
  const loader = ttsProviders[id];
  if (!loader) throw new Error(`Unknown TTS provider: ${id}`);
  return loader();
}
async function getSFXProvider(id) {
  const loader = sfxProviders[id];
  if (!loader) throw new Error(`Unknown SFX provider: ${id}`);
  return loader();
}
async function getMusicProvider(id) {
  const loader = musicProviders[id];
  if (!loader) throw new Error(`Unknown music provider: ${id}`);
  return loader();
}

// lib/audio/download.ts
var import_promises15 = __toESM(require("fs/promises"));
var import_path10 = __toESM(require("path"));
init_paths();
var ALLOWED_HOSTS = /* @__PURE__ */ new Set([
  "freesound.org",
  "www.freesound.org",
  "cdn.freesound.org",
  "pixabay.com",
  "cdn.pixabay.com",
  "api.elevenlabs.io",
  "storage.googleapis.com"
]);
var MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
function validateDownloadUrl(remoteUrl) {
  let parsed;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    throw new Error("Invalid download URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS download URLs are allowed");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0" || hostname.endsWith(".local") || hostname.startsWith("169.254.") || hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
    throw new Error("Download from internal addresses is not allowed");
  }
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`Download not allowed from host: ${hostname}`);
  }
}
async function downloadToLocal(remoteUrl, prefix = "dl") {
  if (isLocalAudioUrl(remoteUrl) || remoteUrl.startsWith("/uploads/") || remoteUrl.startsWith("cench://uploads/") || remoteUrl.startsWith("/sfx-library/")) {
    return remoteUrl;
  }
  if (remoteUrl.startsWith("web-speech://") || remoteUrl.startsWith("puter-tts://")) {
    return remoteUrl;
  }
  validateDownloadUrl(remoteUrl);
  const audioDir = getAudioDir();
  await import_promises15.default.mkdir(audioDir, { recursive: true });
  let ext = ".mp3";
  try {
    const urlPath = new URL(remoteUrl).pathname;
    ext = import_path10.default.extname(urlPath) || ".mp3";
  } catch {
  }
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filePath = import_path10.default.join(audioDir, filename);
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Failed to download audio: ${res.status} ${res.statusText}`);
  }
  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
    throw new Error("Audio file too large to download");
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new Error("Audio file too large to download");
  }
  await import_promises15.default.writeFile(filePath, buffer);
  return audioUrlFor(filename);
}

// lib/services/audio.ts
init_sanitize();
init_captions();

// lib/audio/sfx-zzfx-presets.ts
var ZZFX_SFX_CATEGORIES = [
  {
    id: "ui",
    label: "UI & clicks",
    presets: [
      { id: "ui-tick", name: "Soft tick", zzfx: [1, , 880, 0.01, 0.01, 0.08, 0, 1.2] },
      { id: "ui-click", name: "Click", zzfx: [1.2, , 1200, 2e-3, 0.01, 0.06, 1, 0.8] },
      { id: "ui-toggle", name: "Toggle", zzfx: [0.9, , 600, 5e-3, 0.02, 0.12, 2, 1.5] },
      { id: "ui-beep-hi", name: "Beep high", zzfx: [0.8, , 1400, 1e-3, 0.02, 0.1, 0, 1] },
      { id: "ui-beep-lo", name: "Beep low", zzfx: [0.8, , 220, 2e-3, 0.03, 0.15, 0, 1] },
      { id: "ui-chime", name: "Chime", zzfx: [1, , 990, 0.02, 0.08, 0.25, 0, 1.4, , , , , , , , 0.2] },
      { id: "ui-swipe", name: "Swipe", zzfx: [0.85, , 600, 0.04, 0.06, 0.18, 0, 2.2, 40] },
      { id: "ui-success", name: "Success", zzfx: [1.1, , 520, 0.01, 0.08, 0.22, 1, 1.4, 6, 2] },
      { id: "ui-deny", name: "Denied", zzfx: [1, , 140, 0.04, 0.12, 0.35, 1, 0.6, -12] },
      { id: "ui-hover", name: "Hover", zzfx: [0.45, , 920, 3e-3, 0.015, 0.07, 0, 1.3] },
      { id: "ui-tap", name: "Tap", zzfx: [1, , 1050, 1e-3, 0.012, 0.055, 1, 0.9] },
      { id: "ui-send", name: "Send / submit", zzfx: [1, , 680, 8e-3, 0.04, 0.16, 1, 1.5, 4] },
      { id: "ui-open", name: "Panel open", zzfx: [0.95, , 340, 0.02, 0.08, 0.28, 0, 1.8, 35] },
      { id: "ui-close", name: "Panel close", zzfx: [0.9, , 420, 0.02, 0.06, 0.22, 0, 1.6, -28] },
      { id: "ui-menu", name: "Menu fold", zzfx: [0.85, , 240, 0.015, 0.05, 0.2, 2, 1.4] },
      { id: "ui-type", name: "Type key", zzfx: [0.55, , 1600, 1e-3, 8e-3, 0.04, 4, 2.2, , , , 0.35] },
      { id: "ui-bright", name: "Bright ping", zzfx: [1.1, , 1100, 4e-3, 0.03, 0.14, 2, 2.2, , 12] }
    ]
  },
  {
    id: "impacts",
    label: "Impacts & hits",
    presets: [
      { id: "impact-punch", name: "Punch", zzfx: [1.4, , 150, 0.01, 0.04, 0.35, 4, 2.5, , , , , , , , 0.15] },
      { id: "impact-thud", name: "Thud", zzfx: [1.2, , 80, 0.02, 0.06, 0.4, 3, 1.2] },
      { id: "impact-slam", name: "Slam", zzfx: [1.5, , 55, 5e-3, 0.02, 0.55, 4, 3] },
      { id: "impact-metal", name: "Metal hit", zzfx: [1.1, , 320, 0.01, 0.03, 0.2, 3, 2, , , , 0.3, , , 0.4] },
      { id: "impact-glass", name: "Glass tap", zzfx: [0.9, , 1800, 1e-3, 0.02, 0.18, 5, 3] },
      { id: "impact-body", name: "Body fall", zzfx: [1, , 95, 0.03, 0.1, 0.45, 2, 1.8] },
      { id: "impact-sword", name: "Sword clang", zzfx: [1.2, , 420, 2e-3, 0.02, 0.28, 3, 2.8, , , , 0.15] },
      { id: "impact-wood", name: "Wood knock", zzfx: [1, , 180, 0.01, 0.05, 0.32, 2, 1.6] },
      { id: "impact-rubber", name: "Rubber slap", zzfx: [1.1, , 95, 0.02, 0.12, 0.38, 2, 2.2, -25] },
      { id: "impact-gravel", name: "Gravel hit", zzfx: [1.2, , 140, 0.01, 0.06, 0.32, 4, 1.8, , , , 0.55] },
      { id: "impact-sand", name: "Sand thump", zzfx: [0.95, , 110, 0.02, 0.1, 0.38, 3, 1.5, , , , 0.4] },
      { id: "impact-ice", name: "Ice crack", zzfx: [0.85, , 2e3, 1e-3, 0.025, 0.2, 5, 3, , , , 0.2] },
      { id: "impact-bubble", name: "Wet slap", zzfx: [1, , 160, 0.03, 0.14, 0.32, 3, 1.6, , , , 0.35] },
      { id: "impact-ceramic", name: "Ceramic clink", zzfx: [0.9, , 2400, 1e-3, 0.015, 0.16, 5, 3.5] },
      { id: "impact-chain", name: "Chain rattle", zzfx: [1, , 280, 8e-3, 0.04, 0.28, 4, 2.2, , , , 0.45] }
    ]
  },
  {
    id: "explosions",
    label: "Explosions",
    presets: [
      { id: "ex-small", name: "Small blast", zzfx: [1.3, , 55, 0.02, 0.25, 0.5, 3, 2, 0.5] },
      { id: "ex-med", name: "Medium blast", zzfx: [1.5, , 40, 0.03, 0.35, 0.65, 4, 2.5, 0.8] },
      { id: "ex-noise", name: "Noisy burst", zzfx: [1.2, , 70, 0.02, 0.2, 0.55, 4, 1, 2, 0, 0, 0, 0.6] },
      { id: "ex-crunch", name: "Crunch boom", zzfx: [1.4, , 65, 0.015, 0.15, 0.45, 3, 2.2, , , , 0.45] },
      { id: "ex-electric", name: "Electric pop", zzfx: [1.1, , 200, 2e-3, 0.06, 0.22, 4, 3, , , , 0.5] },
      { id: "ex-underwater", name: "Muffled boom", zzfx: [1.2, , 45, 0.04, 0.4, 0.7, 3, 1.5, , , , 0.35] },
      { id: "ex-spark", name: "Spark burst", zzfx: [0.9, , 1200, 1e-3, 0.04, 0.14, 5, 4, , , , 0.4] },
      { id: "ex-tail", name: "Long tail boom", zzfx: [1.2, , 48, 0.04, 0.5, 0.85, 3, 2, , , , 0.5] },
      { id: "ex-compact", name: "Compact burst", zzfx: [1.4, , 90, 8e-3, 0.08, 0.22, 3, 2.5, , , , 0.25] },
      { id: "ex-sizzle", name: "Sizzle burst", zzfx: [1, , 180, 0.01, 0.12, 0.4, 4, 2, , , , 0.65] },
      { id: "ex-ring", name: "Shock ring", zzfx: [1.1, , 75, 0.02, 0.18, 0.55, 1, 2.2, 15] },
      { id: "ex-flare", name: "Flare pop", zzfx: [1.3, , 320, 3e-3, 0.05, 0.2, 2, 3, -40] }
    ]
  },
  {
    id: "pickups",
    label: "Pickups & rewards",
    presets: [
      { id: "coin", name: "Coin", zzfx: [1, , 500, 0.01, 0.04, 0.15, 1, 0.6, , 3] },
      { id: "powerup", name: "Power-up", zzfx: [1.1, , 740, 0.02, 0.06, 0.22, 1, 1.8, -4, 4] },
      { id: "heart", name: "Heart / life", zzfx: [, , 537, 0.02, 0.02, 0.22, 1, 1.59, -6.98, 4.97] },
      { id: "star", name: "Star sparkle", zzfx: [0.9, , 1200, 5e-3, 0.03, 0.2, 2, 2.5, , 8] },
      { id: "level-up", name: "Level up", zzfx: [1.2, , 400, 0.01, 0.1, 0.35, 1, 1.2, , 12, -0.2] },
      { id: "gem", name: "Gem", zzfx: [1, , 880, 3e-3, 0.05, 0.18, 2, 2.2, , 10] },
      { id: "key", name: "Key / unlock", zzfx: [1.1, , 620, 8e-3, 0.04, 0.2, 1, 1.6, 5] },
      { id: "multi", name: "Combo ping", zzfx: [1, , 700, 4e-3, 0.03, 0.14, 1, 1.8, , 6] },
      { id: "treasure", name: "Treasure chest", zzfx: [1.2, , 280, 0.02, 0.1, 0.4, 2, 1.4, , 8] },
      { id: "orb", name: "Orb collect", zzfx: [1, , 720, 6e-3, 0.05, 0.2, 2, 2, , 8] },
      { id: "ring-collect", name: "Ring collect", zzfx: [1.1, , 900, 4e-3, 0.035, 0.16, 1, 1.9, , 5] },
      { id: "bonus", name: "Bonus wave", zzfx: [1.2, , 380, 0.02, 0.08, 0.35, 1, 1.6, , 14] },
      { id: "streak", name: "Streak tick", zzfx: [0.75, , 560, 2e-3, 0.02, 0.09, 1, 1.3, , 4] },
      { id: "magic-flourish", name: "Magic flourish", zzfx: [1, , 520, 0.03, 0.12, 0.45, 2, 2.2, , 20] }
    ]
  },
  {
    id: "alarms",
    label: "Alarms & alerts",
    presets: [
      { id: "alarm-fast", name: "Fast beep", zzfx: [1, , 880, 5e-3, 0.02, 0.08, 1, 1, , , , 120] },
      { id: "alarm-slow", name: "Slow alarm", zzfx: [1.1, , 220, 0.02, 0.15, 0.35, 1, 1, , , , 200] },
      { id: "buzzer", name: "Buzzer", zzfx: [1.2, , 150, 0.01, 0.2, 0.4, 2, 1, , , , 80] },
      { id: "wrong", name: "Wrong / error", zzfx: [1, , 180, 0.05, 0.1, 0.3, 1, 0.5, -8] },
      { id: "alarm-urgent", name: "Urgent pulse", zzfx: [1.2, , 440, 4e-3, 0.03, 0.1, 1, 1, , , , 90] },
      { id: "chime-soft", name: "Soft chime", zzfx: [0.65, , 1320, 0.02, 0.1, 0.35, 0, 1.5, , , , 0.08] },
      { id: "attention", name: "Attention ding", zzfx: [1, , 770, 0.01, 0.05, 0.22, 1, 1.4, 3] },
      { id: "countdown", name: "Countdown tick", zzfx: [0.9, , 260, 8e-3, 0.02, 0.1, 1, 1.1] }
    ]
  },
  {
    id: "sci-fi",
    label: "Sci\u2011fi",
    presets: [
      { id: "laser", name: "Laser shot", zzfx: [0.9, , 1200, 1e-3, 0.06, 0.12, 3, 4, -50] },
      { id: "laser-big", name: "Heavy laser", zzfx: [1.2, , 180, 0.01, 0.08, 0.35, 3, 3, -20] },
      { id: "warp", name: "Warp", zzfx: [1, , 200, 0.05, 0.2, 0.6, 0, 2, 40, 0, 0, 0, 0.15] },
      { id: "scanner", name: "Scanner", zzfx: [0.7, , 800, 2e-3, 0.04, 0.25, 1, 3, , 15] },
      { id: "alien", name: "Alien ping", zzfx: [1, , 400, 0.02, 0.12, 0.4, 4, 2.5, , 6] },
      { id: "teleport", name: "Teleport", zzfx: [1, , 300, 0.06, 0.25, 0.55, 0, 2.5, 180, , , , 0.2] },
      { id: "shield", name: "Shield hum", zzfx: [0.75, , 220, 0.08, 0.35, 0.5, 0, 1.2, , , , 150] },
      { id: "charge", name: "Charge up", zzfx: [1, , 90, 0.12, 0.45, 0.65, 0, 1.8, 220] },
      { id: "hologram", name: "Hologram flicker", zzfx: [0.6, , 1400, 2e-3, 0.02, 0.12, 4, 3, , , , 0.25] },
      { id: "drone-pass", name: "Fly-by drone", zzfx: [0.8, , 95, 0.06, 0.25, 0.55, 0, 2, -60] },
      { id: "servo", name: "Servo motor", zzfx: [0.7, , 210, 0.04, 0.2, 0.45, 1, 1.5, , , , 120] },
      { id: "plasma", name: "Plasma hiss", zzfx: [0.85, , 350, 0.02, 0.15, 0.42, 4, 2.5, , , , 0.5] },
      { id: "cpu-beep", name: "CPU beep", zzfx: [0.55, , 2e3, 2e-3, 0.015, 0.08, 1, 1.2] },
      { id: "datagram", name: "Data blip", zzfx: [0.6, , 1600, 1e-3, 0.012, 0.07, 3, 2.8, , , , 0.3] },
      { id: "airlock", name: "Airlock seal", zzfx: [1.1, , 60, 0.03, 0.2, 0.55, 3, 1.8, , , , 0.2] }
    ]
  },
  {
    id: "cartoon",
    label: "Cartoon",
    presets: [
      { id: "boing", name: "Boing", zzfx: [1.2, , 180, 0.02, 0.15, 0.45, 2, 3, -30, 2] },
      { id: "pop", name: "Pop", zzfx: [1, , 600, 5e-3, 0.03, 0.12, 2, 2] },
      { id: "slide", name: "Slide whistle", zzfx: [1, , 300, 0.03, 0.2, 0.5, 0, 3, 80] },
      { id: "squish", name: "Squish", zzfx: [1.1, , 90, 0.04, 0.2, 0.35, 3, 1.5, , , , 0.5] },
      { id: "bonk", name: "Bonk", zzfx: [1.3, , 140, 8e-3, 0.04, 0.28, 2, 2.5, -15] },
      { id: "stretch", name: "Stretch", zzfx: [1, , 120, 0.05, 0.25, 0.55, 0, 2.5, 95] },
      { id: "whee", name: "Whee up", zzfx: [1.1, , 200, 0.04, 0.18, 0.5, 0, 3, 150] },
      { id: "zip", name: "Zip", zzfx: [0.95, , 500, 0.02, 0.05, 0.18, 0, 2.5, 200] },
      { id: "crunch-soft", name: "Soft crunch", zzfx: [1, , 85, 0.02, 0.12, 0.38, 3, 1.7, , , , 0.45] },
      { id: "spring", name: "Spring", zzfx: [1.2, , 320, 0.015, 0.1, 0.38, 2, 3, -45, 2] }
    ]
  },
  {
    id: "percussion",
    label: "Drums & rhythm",
    presets: [
      { id: "drum", name: "Drum hit", zzfx: [, , 129, 0.01, , 0.15, , , , , , , 5] },
      { id: "kick", name: "Kick", zzfx: [1.3, , 55, 5e-3, 0.02, 0.25, 3, 2] },
      { id: "snare", name: "Snare-ish", zzfx: [1, , 200, 2e-3, 0.02, 0.15, 4, 2, , , , 0.35] },
      { id: "hat", name: "Hi-hat", zzfx: [0.6, , 8e3, 1e-3, 0.01, 0.05, 4, 4, , , , 0.8] },
      { id: "tom", name: "Tom", zzfx: [1.2, , 100, 8e-3, 0.03, 0.35, 3, 2.2] },
      { id: "clap", name: "Clap", zzfx: [1, , 180, 2e-3, 0.02, 0.18, 4, 2.5, , , , 0.5] },
      { id: "rim", name: "Rim shot", zzfx: [1.1, , 450, 1e-3, 0.015, 0.12, 3, 2.8] },
      { id: "ride", name: "Ride bell", zzfx: [0.75, , 600, 3e-3, 0.04, 0.22, 2, 2, , , , 0.15] },
      { id: "shaker", name: "Shaker", zzfx: [0.5, , 3e3, 0.02, 0.08, 0.25, 4, 2, , , , 0.75] }
    ]
  },
  {
    id: "transitions",
    label: "Transitions",
    presets: [
      { id: "whoosh", name: "Whoosh", zzfx: [0.9, , 400, 0.08, 0.15, 0.55, 0, 2, 120] },
      { id: "sweep-up", name: "Sweep up", zzfx: [1, , 120, 0.1, 0.2, 0.45, 0, 2, 200] },
      { id: "riser", name: "Riser", zzfx: [1.1, , 80, 0.15, 0.35, 0.7, 0, 1.5, 150] },
      { id: "downer", name: "Downer", zzfx: [1, , 500, 0.05, 0.25, 0.55, 0, 2, -120] },
      { id: "tape-stop", name: "Tape stop", zzfx: [1, , 300, 0.02, 0.15, 0.45, 0, 2, -200] },
      { id: "reverse-suck", name: "Reverse suck", zzfx: [0.95, , 250, 0.1, 0.2, 0.5, 0, 2, -90] },
      { id: "glitch-in", name: "Glitch in", zzfx: [0.85, , 800, 0.01, 0.06, 0.22, 4, 3, , , , 0.55] },
      { id: "glitch-out", name: "Glitch out", zzfx: [0.85, , 600, 0.01, 0.08, 0.28, 4, 2.5, , , , 0.6] },
      { id: "soft-in", name: "Soft fade in", zzfx: [0.7, , 200, 0.15, 0.25, 0.5, 0, 1.2, 40] },
      { id: "hard-cut", name: "Hard cut", zzfx: [1.2, , 150, 1e-3, 0.02, 0.08, 2, 2] }
    ]
  },
  {
    id: "sfxr",
    label: "Retro game",
    presets: [
      { id: "sfxr-jump", name: "Jump", zzfx: [1, , 300, 0.02, 0.05, 0.15, 0, 2, 50] },
      { id: "sfxr-shoot", name: "Shoot / pew", zzfx: [0.9, , 800, 1e-3, 0.02, 0.1, 3, 3, -15] },
      { id: "sfxr-hurt", name: "Hurt", zzfx: [1.2, , 120, 0.01, 0.08, 0.25, 4, 1.5, , -20] },
      { id: "sfxr-bling", name: "Pickup bling", zzfx: [1, , 600, 5e-3, 0.04, 0.12, 1, 2, 8] },
      { id: "sfxr-tiny-pop", name: "Tiny pop", zzfx: [0.8, , 400, 2e-3, 0.03, 0.08, 2, 2] },
      { id: "sfxr-stab", name: "Synth stab", zzfx: [1.1, , 110, 0.01, 0.12, 0.3, 1, 1.8] },
      { id: "sfxr-noise", name: "Noise burst", zzfx: [1, , 100, 0.01, 0.1, 0.35, 4, 1, , , , 0.7] },
      { id: "sfxr-tone", name: "Simple tone", zzfx: [0.7, , 440, 0.05, 0.2, 0.25, 0, 1] },
      { id: "sfxr-wobble", name: "Wobble", zzfx: [1, , 200, 0.03, 0.15, 0.4, 2, 2, , , 90] },
      { id: "sfxr-slide", name: "Pitch slide", zzfx: [1, , 150, 0.05, 0.2, 0.5, 0, 2, 100] },
      { id: "sfxr-zap", name: "Zap", zzfx: [1.2, , 900, 1e-3, 0.03, 0.1, 3, 4, -80] },
      { id: "sfxr-thump", name: "Land thump", zzfx: [1.3, , 70, 8e-3, 0.03, 0.3, 3, 2.5] },
      { id: "sfxr-8bit-run", name: "8-bit run", zzfx: [0.5, , 320, 2e-3, 0.015, 0.06, 1, 1.2, , , 40] },
      { id: "sfxr-game-start", name: "Game start", zzfx: [1.2, , 200, 0.02, 0.15, 0.45, 1, 1.5, , 18] },
      { id: "sfxr-powerdown", name: "Power down", zzfx: [1, , 280, 0.04, 0.2, 0.55, 0, 1.5, -140] },
      { id: "sfxr-laser-charge", name: "Laser charge", zzfx: [0.9, , 120, 0.08, 0.35, 0.6, 0, 1.8, 180] },
      { id: "sfxr-mutate", name: "Mutate", zzfx: [1.1, , 160, 0.02, 0.12, 0.42, 4, 2, , , , 0.55] },
      { id: "sfxr-lift", name: "Lift / spring up", zzfx: [1, , 250, 0.02, 0.1, 0.38, 2, 2.8, 55] },
      { id: "sfxr-coin-slot", name: "Coin slot", zzfx: [1, , 480, 6e-3, 0.04, 0.18, 3, 2.2] },
      { id: "sfxr-enemy-die", name: "Enemy poof", zzfx: [1.2, , 180, 0.015, 0.1, 0.35, 4, 2, , , , 0.4] },
      { id: "sfxr-bubble", name: "Bubble pop", zzfx: [0.85, , 650, 4e-3, 0.03, 0.14, 2, 2] },
      { id: "sfxr-motor", name: "Motor loop-ish", zzfx: [0.6, , 95, 0.06, 0.3, 0.5, 1, 1.2, , , , 200] },
      { id: "sfxr-blip-up", name: "Blip up", zzfx: [1, , 380, 0.02, 0.06, 0.2, 0, 1.8, 90] },
      { id: "sfxr-blip-down", name: "Blip down", zzfx: [1, , 420, 0.02, 0.06, 0.2, 0, 1.6, -85] },
      { id: "sfxr-double-jump", name: "Double jump", zzfx: [1.1, , 380, 0.015, 0.04, 0.14, 0, 2.2, 70] }
    ]
  },
  {
    id: "ambient",
    label: "Ambient & drones",
    presets: [
      { id: "amb-wind", name: "Soft wind", zzfx: [0.35, , 180, 0.25, 0.55, 0.85, 3, 0.6, , , , 0.25] },
      { id: "amb-pad", name: "Warm pad", zzfx: [0.4, , 110, 0.15, 0.6, 0.9, 0, 1.1, , , , 0.12] },
      { id: "amb-space", name: "Space drone", zzfx: [0.3, , 55, 0.3, 0.7, 1.1, 0, 0.8, , , , 0.2] },
      { id: "amb-rumble", name: "Low rumble", zzfx: [0.55, , 40, 0.08, 0.45, 0.75, 3, 1.2, , , , 0.35] },
      { id: "amb-crystal", name: "Crystal bed", zzfx: [0.25, , 1200, 0.1, 0.4, 0.7, 2, 1.5, , , , 0.15] },
      { id: "amb-pulse", name: "Slow pulse", zzfx: [0.45, , 90, 0.2, 0.5, 0.8, 1, 1, , , , 180] },
      { id: "amb-horror", name: "Tense drone", zzfx: [0.4, , 70, 0.12, 0.55, 0.95, 4, 1.3, , , , 0.3] },
      { id: "amb-rain", name: "Rain texture", zzfx: [0.2, , 2400, 0.05, 0.2, 0.45, 4, 2, , , , 0.85] },
      { id: "amb-dark", name: "Dark hum", zzfx: [0.3, , 48, 0.2, 0.65, 1, 0, 0.85, , , , 0.25] },
      { id: "amb-choir", name: "Airy pad", zzfx: [0.28, , 280, 0.12, 0.55, 0.9, 0, 1, , , , 0.1] },
      { id: "amb-glass", name: "Glass tone bed", zzfx: [0.22, , 880, 0.15, 0.45, 0.75, 2, 1.6, , , , 0.12] },
      { id: "amb-machine", name: "Machine room", zzfx: [0.35, , 65, 0.1, 0.5, 0.85, 3, 1.1, , , , 0.4] }
    ]
  },
  {
    id: "misc",
    label: "Classic ZzFX demos",
    presets: [
      { id: "game-over", name: "Game over", zzfx: [, , 925, 0.04, 0.3, 0.6, 1, 0.3, , 6.27, -184, 0.09, 0.17] },
      { id: "piano", name: "Piano pluck", zzfx: [1.5, 0.8, 270, , 0.1, , 1, 1.5, , , , , , , , 0.1, 0.01] },
      { id: "blip", name: "Blip", zzfx: [1, , 999, 2e-3, 0.02, 0.1, 0, 1.5] },
      { id: "notify", name: "Notification", zzfx: [1, , 660, 0.01, 0.06, 0.2, 1, 1.2, , 5] },
      { id: "sparkle-short", name: "Sparkle", zzfx: [0.9, , 1400, 3e-3, 0.025, 0.14, 2, 2.5, , 15] },
      { id: "digital-glitch", name: "Digital glitch", zzfx: [0.75, , 600, 8e-3, 0.04, 0.2, 4, 2.8, , , , 0.5] },
      { id: "confirm-deep", name: "Confirm deep", zzfx: [1.1, , 180, 0.02, 0.12, 0.4, 1, 1.5, -5] },
      { id: "cancel-soft", name: "Cancel soft", zzfx: [0.8, , 220, 0.04, 0.15, 0.38, 1, 0.7, -10] },
      { id: "timer-done", name: "Timer done", zzfx: [1.2, , 520, 0.01, 0.08, 0.3, 1, 1.3, , 8] },
      { id: "typing", name: "Typing burst", zzfx: [0.45, , 1400, 2e-3, 0.01, 0.05, 4, 2.5, , , , 0.4] }
    ]
  }
];
var SFX_LIBRARY_CATEGORIES = ZZFX_SFX_CATEGORIES.map(({ id, label }) => ({
  id,
  label
}));
function getZzfxCategory(id) {
  if (!id) return void 0;
  return ZZFX_SFX_CATEGORIES.find((c) => c.id === id);
}

// lib/services/audio.ts
init_sfx_license();
init_paths();
var AudioValidationError = class extends Error {
  code = "VALIDATION";
  constructor(message) {
    super(message);
    this.name = "AudioValidationError";
  }
};
var SCENE_ID_RE2 = /^[a-zA-Z0-9\-]+$/;
async function synthesizeTTS(input) {
  if (!input.text) throw new AudioValidationError("text is required");
  if (!input.sceneId || typeof input.sceneId !== "string") {
    throw new AudioValidationError("sceneId is required");
  }
  if (!SCENE_ID_RE2.test(input.sceneId)) {
    throw new AudioValidationError("Invalid sceneId format");
  }
  try {
    validateTextLength(input.text);
  } catch {
    throw new AudioValidationError(`Text exceeds maximum length of ${MAX_TTS_TEXT_LENGTH} characters`);
  }
  const selectedProvider = input.provider ?? getBestTTSProvider(null, input.localMode);
  if (selectedProvider === "web-speech" || selectedProvider === "puter") {
    return {
      mode: "client",
      provider: selectedProvider,
      text: input.text,
      voiceId: input.voiceId ?? null
    };
  }
  const impl = await getTTSProvider(selectedProvider);
  const result = await impl.generate({
    text: input.text,
    sceneId: input.sceneId,
    voiceId: input.voiceId,
    model: input.model,
    instructions: input.instructions
  });
  if (!result.captions && result.duration && isLocalAudioUrl(result.audioUrl)) {
    const bundle = buildNaiveCaptions(input.text, result.duration);
    if (bundle.words.length > 0 && bundle.srt.length > 0) {
      try {
        const audioDir = getAudioDir();
        await import_promises16.default.mkdir(audioDir, { recursive: true });
        const base = result.audioUrl.replace(/^(cench:\/\/audio\/|\/audio\/)/, "").replace(/\.[a-z0-9]+$/i, "");
        const srtName = `${base}.srt`;
        const vttName = `${base}.vtt`;
        await Promise.all([
          import_promises16.default.writeFile(import_node_path8.default.join(audioDir, srtName), bundle.srt, "utf8"),
          import_promises16.default.writeFile(import_node_path8.default.join(audioDir, vttName), bundle.vtt, "utf8")
        ]);
        result.captions = {
          srtUrl: audioUrlFor(srtName),
          vttUrl: audioUrlFor(vttName),
          kind: "naive",
          words: bundle.words
        };
      } catch (captionErr) {
        console.warn("[audio-service] naive caption write failed:", captionErr);
      }
    }
  }
  return {
    url: result.audioUrl,
    duration: result.duration,
    provider: result.provider,
    captions: result.captions ? {
      srtUrl: result.captions.srtUrl,
      vttUrl: result.captions.vttUrl,
      kind: result.captions.kind,
      words: result.captions.words
    } : null
  };
}
async function searchSFX(input) {
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const page = Math.max(1, Number(input.page) || 1);
  const isLibrary = input.mode === "library";
  if (isLibrary) {
    const cat = getZzfxCategory(input.categoryId);
    const category = cat ? { id: cat.id, label: cat.label } : { id: SFX_LIBRARY_CATEGORIES[0].id, label: SFX_LIBRARY_CATEGORIES[0].label };
    return {
      results: [],
      provider: "pixabay",
      mode: "library",
      category,
      page,
      licenseNote: "The editor Sound effects library uses ZzFX (MIT) in the browser. Use search mode for remote Pixabay/Freesound when API keys are configured."
    };
  }
  const searchQuery = input.query || input.prompt;
  if (!searchQuery) throw new AudioValidationError("query or prompt is required");
  try {
    if (input.query) validateQueryLength(input.query);
    if (input.prompt) validateQueryLength(input.prompt);
  } catch {
    throw new AudioValidationError("Query or prompt too long");
  }
  const providerId = input.provider ?? getBestSFXProvider();
  const impl = await getSFXProvider(providerId);
  if (input.prompt && impl.generate) {
    const result = await impl.generate(input.prompt, input.duration);
    return { results: [result], provider: providerId, mode: "generated" };
  }
  const commercialOnly = input.commercialOnly !== void 0 ? Boolean(input.commercialOnly) : providerId === "freesound" ? true : false;
  const searchOpts = commercialOnly || page > 1 ? { page, commercialOnly: providerId === "freesound" ? commercialOnly : false } : void 0;
  const results = await impl.search(searchQuery, limit, searchOpts);
  if (input.download && results.length > 0) {
    const localResults = await Promise.all(
      results.map(async (r) => {
        if (r.audioUrl.startsWith("http")) {
          const localUrl = await downloadToLocal(r.audioUrl, "sfx");
          return { ...r, audioUrl: localUrl, previewUrl: r.previewUrl || r.audioUrl };
        }
        return r;
      })
    );
    return { results: localResults, provider: providerId, mode: "search" };
  }
  return {
    results,
    provider: providerId,
    mode: "search",
    licenseNote: providerId === "pixabay" ? PIXABAY_SFX_LICENSE_NOTE : FREESOUND_LICENSE_NOTE
  };
}
async function searchMusic(input) {
  if (!input.query) throw new AudioValidationError("query is required");
  try {
    validateQueryLength(input.query);
  } catch {
    throw new AudioValidationError("Query too long");
  }
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const providerId = input.provider ?? getBestMusicProvider();
  const impl = await getMusicProvider(providerId);
  const results = await impl.search(input.query, limit);
  if (input.download && results.length > 0) {
    const localResults = await Promise.all(
      results.map(async (r) => {
        if (r.audioUrl.startsWith("http")) {
          const localUrl = await downloadToLocal(r.audioUrl, "music");
          return { ...r, audioUrl: localUrl, previewUrl: r.previewUrl || r.audioUrl };
        }
        return r;
      })
    );
    return { results: localResults, provider: providerId };
  }
  return { results, provider: providerId };
}

// electron/ipc/audio.ts
function rethrowValidation(fn) {
  return (async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AudioValidationError) throw new IpcValidationError(err.message);
      throw err;
    }
  });
}
function register14(ipcMain2) {
  ipcMain2.handle(
    "cench:tts.synthesize",
    rethrowValidation((_e, args) => synthesizeTTS(args))
  );
  ipcMain2.handle(
    "cench:sfx.search",
    rethrowValidation((_e, args) => searchSFX(args))
  );
  ipcMain2.handle(
    "cench:music.search",
    rethrowValidation((_e, args) => searchMusic(args))
  );
}

// lib/services/ingest.ts
var import_promises18 = __toESM(require("node:fs/promises"));
var import_node_path9 = __toESM(require("node:path"));
var import_uuid3 = require("uuid");
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var import_sharp = __toESM(require("sharp"));
var import_drizzle_orm13 = require("drizzle-orm");

// lib/ingest/yt-dlp.ts
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var execFileAsync2 = (0, import_util2.promisify)(import_child_process2.execFile);
var YtDlpNotInstalledError = class extends Error {
  constructor() {
    super("yt-dlp binary not found on PATH. Install with: brew install yt-dlp  (or  pip install yt-dlp)");
    this.name = "YtDlpNotInstalledError";
  }
};
async function runYtDlp(args, opts = {}) {
  try {
    return await execFileAsync2("yt-dlp", args, {
      timeout: opts.timeoutMs ?? 12e4,
      maxBuffer: 50 * 1024 * 1024
    });
  } catch (e) {
    if (e?.code === "ENOENT" || /command not found|ENOENT/i.test(e?.message ?? "")) {
      throw new YtDlpNotInstalledError();
    }
    throw e;
  }
}
async function probe(url, opts = {}) {
  const { stdout } = await runYtDlp(["-J", "--no-warnings", "--no-playlist", url], {
    timeoutMs: opts.timeoutMs ?? 45e3
  });
  const info = JSON.parse(stdout);
  const formats = (info.formats ?? []).filter((f) => f.vcodec && f.vcodec !== "none").map((f) => ({
    formatId: f.format_id,
    ext: f.ext,
    resolution: f.resolution,
    width: f.width,
    height: f.height,
    fps: f.fps,
    filesize: f.filesize ?? f.filesize_approx,
    vcodec: f.vcodec,
    acodec: f.acodec,
    formatNote: f.format_note
  })).sort((a, b) => {
    const aScore = (a.acodec && a.acodec !== "none" ? 1e3 : 0) + (a.ext === "mp4" ? 500 : 0) + (a.height ?? 0);
    const bScore = (b.acodec && b.acodec !== "none" ? 1e3 : 0) + (b.ext === "mp4" ? 500 : 0) + (b.height ?? 0);
    return bScore - aScore;
  });
  const reco = formats.find((f) => (f.height ?? 0) <= 1080 && f.acodec && f.acodec !== "none") ?? formats[0];
  return {
    title: info.title,
    durationSec: info.duration,
    thumbnail: info.thumbnail,
    uploader: info.uploader,
    webpageUrl: info.webpage_url,
    extractor: info.extractor,
    formats,
    recommendedFormatId: reco?.formatId ?? info.format_id ?? "best[height<=1080]"
  };
}
async function download(opts) {
  const { url, destPath, maxDurationSec, formatId, timeoutMs = 3e5 } = opts;
  const info = await probe(url, { timeoutMs: Math.min(timeoutMs, 45e3) });
  if (maxDurationSec && info.durationSec > maxDurationSec) {
    throw new Error(
      `Video is ${Math.round(info.durationSec)}s, exceeds cap of ${maxDurationSec}s. Try a shorter clip or a different URL.`
    );
  }
  const effectiveFormat = formatId ?? info.recommendedFormatId;
  const args = [
    "-f",
    effectiveFormat,
    "--merge-output-format",
    "mp4",
    "--no-warnings",
    "--no-playlist",
    "-o",
    destPath,
    url
  ];
  await runYtDlp(args, { timeoutMs });
  const chosen = info.formats.find((f) => f.formatId === effectiveFormat) ?? info.formats[0];
  return {
    destPath,
    title: info.title,
    durationSec: info.durationSec,
    width: chosen?.width,
    height: chosen?.height,
    formatId: effectiveFormat,
    sourceUrl: info.webpageUrl
  };
}

// lib/apis/media-cache.ts
var import_crypto5 = __toESM(require("crypto"));
var import_promises17 = __toESM(require("fs/promises"));
var import_path11 = __toESM(require("path"));
var GENERATED_DIR = import_path11.default.join(process.cwd(), "public", "generated");
function computeContentHash(buffer) {
  return import_crypto5.default.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

// lib/security/url-guard.ts
var UrlGuardError = class extends Error {
  code = "URL_GUARD";
  constructor(message) {
    super(message);
    this.name = "UrlGuardError";
  }
};
function isLoopbackOrPrivateV4(hostname) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname === "0.0.0.0") return true;
  if (hostname === "127.0.0.1" || hostname.startsWith("127.")) return true;
  if (hostname === "::1") return true;
  if (hostname.startsWith("169.254.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}
function isPrivateV6(hostname) {
  const bare = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (bare === "::" || bare === "::1") return true;
  if (/^(fc|fd)[0-9a-f]{0,2}:/.test(bare)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(bare)) return true;
  if (/^::ffff:/.test(bare)) return true;
  return false;
}
function assertPublicHttpUrl(urlString, opts = {}) {
  const allowedSchemes = opts.allowedSchemes ?? ["http:", "https:"];
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new UrlGuardError("Invalid URL");
  }
  if (!allowedSchemes.includes(parsed.protocol)) {
    throw new UrlGuardError(`Disallowed URL scheme: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new UrlGuardError("URL has no hostname");
  }
  if (isLoopbackOrPrivateV4(hostname) || isPrivateV6(hostname)) {
    throw new UrlGuardError(`Internal address not allowed: ${hostname}`);
  }
  return parsed;
}

// lib/services/ingest.ts
var execFileAsync3 = (0, import_node_util.promisify)(import_node_child_process.execFile);
var UUID_RE3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var MAX_DURATION_SEC = 600;
var MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
var INGESTED_SUBDIR = "ingested";
var IngestValidationError = class extends Error {
  code = "VALIDATION";
  constructor(message) {
    super(message);
    this.name = "IngestValidationError";
  }
};
var YtDlpMissingError = class extends Error {
  code = "YT_DLP_MISSING";
  constructor(message) {
    super(message);
    this.name = "YtDlpMissingError";
  }
};
function assertProjectId(projectId) {
  if (typeof projectId !== "string" || !UUID_RE3.test(projectId)) {
    throw new IngestValidationError("projectId (uuid) is required");
  }
}
function ingestedDir(projectId) {
  return import_node_path9.default.join(getUploadsDir(), "projects", projectId, INGESTED_SUBDIR);
}
function ingestedUrl(projectId, filename) {
  return uploadsUrlFor(`projects/${projectId}/${INGESTED_SUBDIR}/${filename}`);
}
async function ingestUrl(input) {
  if (!input.url || typeof input.url !== "string") {
    throw new IngestValidationError("url is required");
  }
  try {
    assertPublicHttpUrl(input.url);
  } catch (e) {
    if (e instanceof UrlGuardError) throw new IngestValidationError(e.message);
    throw e;
  }
  assertProjectId(input.projectId);
  if (!input.formatId) {
    try {
      const info = await probe(input.url);
      return {
        mode: "probe",
        title: info.title,
        durationSec: info.durationSec,
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        extractor: info.extractor,
        webpageUrl: info.webpageUrl,
        recommendedFormatId: info.recommendedFormatId,
        formats: info.formats.slice(0, 12),
        ytDlpTooLong: info.durationSec > MAX_DURATION_SEC ? `Video is ${Math.round(info.durationSec)}s; hard cap is ${MAX_DURATION_SEC}s. Refuse or try a shorter clip.` : null
      };
    } catch (e) {
      if (e instanceof YtDlpNotInstalledError) throw new YtDlpMissingError(e.message);
      throw new Error(`yt-dlp probe failed: ${e.message}`);
    }
  }
  const assetId = (0, import_uuid3.v4)();
  const uploadsDir2 = ingestedDir(input.projectId);
  await import_promises18.default.mkdir(uploadsDir2, { recursive: true });
  const storagePath = import_node_path9.default.join(uploadsDir2, `${assetId}.mp4`);
  let result;
  let downloadSucceeded = false;
  try {
    try {
      result = await download({
        url: input.url,
        destPath: storagePath,
        formatId: input.formatId,
        maxDurationSec: MAX_DURATION_SEC
      });
      downloadSucceeded = true;
    } catch (e) {
      if (e instanceof YtDlpNotInstalledError) throw new YtDlpMissingError(e.message);
      throw new Error(`yt-dlp download failed: ${e.message}`);
    }
  } finally {
    if (!downloadSucceeded) {
      await import_promises18.default.unlink(storagePath).catch(() => {
      });
    }
  }
  const stat = await import_promises18.default.stat(storagePath);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    await import_promises18.default.unlink(storagePath).catch(() => {
    });
    throw new IngestValidationError(
      `Downloaded file is ${Math.round(stat.size / 1024 / 1024)} MB, exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB cap.`
    );
  }
  const fileBuffer = await import_promises18.default.readFile(storagePath);
  const contentHash = computeContentHash(fileBuffer);
  const existing = await db.select().from(projectAssets).where((0, import_drizzle_orm13.and)((0, import_drizzle_orm13.eq)(projectAssets.projectId, input.projectId), (0, import_drizzle_orm13.eq)(projectAssets.contentHash, contentHash))).limit(1);
  if (existing.length > 0) {
    await import_promises18.default.unlink(storagePath).catch(() => {
    });
    return {
      mode: "download",
      asset: existing[0],
      contentHash,
      sourceUrl: result.sourceUrl,
      deduped: true
    };
  }
  let thumbnailUrl = null;
  try {
    const thumbFilename = `${assetId}_thumb.jpg`;
    const thumbPath = import_node_path9.default.join(uploadsDir2, thumbFilename);
    await execFileAsync3("ffmpeg", ["-i", storagePath, "-vframes", "1", "-vf", "scale=300:-1", "-y", thumbPath], {
      timeout: 3e4
    });
    thumbnailUrl = ingestedUrl(input.projectId, thumbFilename);
  } catch {
  }
  const filename = `${assetId}.mp4`;
  const publicUrl = ingestedUrl(input.projectId, filename);
  const [asset] = await db.insert(projectAssets).values({
    id: assetId,
    projectId: input.projectId,
    filename: `${result.title.slice(0, 200).replace(/[^\w -]/g, "_")}.mp4`,
    storagePath,
    publicUrl,
    type: "video",
    mimeType: "video/mp4",
    sizeBytes: stat.size,
    width: result.width ?? null,
    height: result.height ?? null,
    durationSeconds: result.durationSec,
    name: result.title.slice(0, 200),
    tags: [],
    thumbnailUrl,
    extractedColors: [],
    source: "yt-dlp",
    contentHash,
    sourceUrl: result.sourceUrl
  }).returning();
  return {
    mode: "download",
    asset,
    contentHash,
    sourceUrl: result.sourceUrl,
    deduped: false
  };
}
var MIME_TO_TYPE = {
  "image/jpeg": { type: "image", ext: "jpg" },
  "image/png": { type: "image", ext: "png" },
  "image/webp": { type: "image", ext: "webp" },
  "image/gif": { type: "image", ext: "gif" },
  "image/svg+xml": { type: "svg", ext: "svg" },
  "video/mp4": { type: "video", ext: "mp4" },
  "video/webm": { type: "video", ext: "webm" },
  "video/quicktime": { type: "video", ext: "mov" },
  "video/ogg": { type: "video", ext: "ogv" },
  "application/ogg": { type: "video", ext: "ogv" }
};
function extFromUrl(url) {
  try {
    const u = new URL(url);
    const ext = import_node_path9.default.extname(u.pathname).toLowerCase().slice(1);
    return ext || null;
  } catch {
    return null;
  }
}
function typeFromExt(ext) {
  const e = ext.toLowerCase();
  if (["jpg", "jpeg"].includes(e)) return { type: "image", ext: "jpg" };
  if (["png", "webp", "gif"].includes(e)) return { type: "image", ext: e };
  if (e === "svg") return { type: "svg", ext: "svg" };
  if (["mp4", "webm", "mov", "ogv", "m4v"].includes(e)) return { type: "video", ext: e === "m4v" ? "mp4" : e };
  return null;
}
function deriveNameFromUrl(url) {
  try {
    const u = new URL(url);
    const name = import_node_path9.default.basename(u.pathname).replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    return name || u.hostname;
  } catch {
    return "Imported media";
  }
}
async function ingestDirect(input) {
  if (!input.url || typeof input.url !== "string") {
    throw new IngestValidationError("url is required");
  }
  try {
    assertPublicHttpUrl(input.url);
  } catch (e) {
    if (e instanceof UrlGuardError) throw new IngestValidationError(e.message);
    throw e;
  }
  assertProjectId(input.projectId);
  const head = await fetch(input.url, { method: "HEAD" }).catch(() => null);
  const contentType = head?.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const contentLength = head?.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_FILE_SIZE_BYTES) {
    throw new IngestValidationError(
      `File is ${Math.round(Number(contentLength) / 1024 / 1024)} MB, exceeds 200 MB cap.`
    );
  }
  const response = await fetch(input.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const chunks = [];
  let total = 0;
  while (total < MAX_FILE_SIZE_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.length;
  }
  if (total >= MAX_FILE_SIZE_BYTES) {
    throw new IngestValidationError("File too large (over 200 MB)");
  }
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  let typeInfo = contentType ? MIME_TO_TYPE[contentType] : void 0;
  if (!typeInfo) {
    const urlExt = extFromUrl(input.url);
    if (urlExt) typeInfo = typeFromExt(urlExt) ?? void 0;
  }
  if (!typeInfo) {
    throw new IngestValidationError(
      `Cannot determine media type from URL or content-type (${contentType ?? "unknown"}).`
    );
  }
  const contentHash = computeContentHash(buffer);
  const existing = await db.select().from(projectAssets).where((0, import_drizzle_orm13.and)((0, import_drizzle_orm13.eq)(projectAssets.projectId, input.projectId), (0, import_drizzle_orm13.eq)(projectAssets.contentHash, contentHash))).limit(1);
  if (existing.length > 0) {
    return { asset: existing[0], contentHash, sourceUrl: input.url, deduped: true };
  }
  const assetId = (0, import_uuid3.v4)();
  const uploadsDir2 = ingestedDir(input.projectId);
  await import_promises18.default.mkdir(uploadsDir2, { recursive: true });
  let effectiveExt = typeInfo.ext;
  const needsTranscode = typeInfo.type === "video" && (typeInfo.ext === "ogv" || typeInfo.ext === "mov");
  const rawFilename = `${assetId}.${typeInfo.ext}`;
  const rawPath = import_node_path9.default.join(uploadsDir2, rawFilename);
  await import_promises18.default.writeFile(rawPath, buffer);
  let storedFilename = rawFilename;
  let storagePath = rawPath;
  if (needsTranscode) {
    const mp4Filename = `${assetId}.mp4`;
    const mp4Path = import_node_path9.default.join(uploadsDir2, mp4Filename);
    try {
      await execFileAsync3(
        "ffmpeg",
        [
          "-i",
          rawPath,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          "-y",
          mp4Path
        ],
        { timeout: 18e4 }
      );
      await import_promises18.default.unlink(rawPath).catch(() => {
      });
      storedFilename = mp4Filename;
      storagePath = mp4Path;
      effectiveExt = "mp4";
    } catch (e) {
      console.warn("[ingest] transcode failed, keeping original:", e.message);
    }
  }
  const publicUrl = ingestedUrl(input.projectId, storedFilename);
  let width = null;
  let height = null;
  let durationSeconds = null;
  let thumbnailUrl = null;
  if (typeInfo.type === "image") {
    try {
      const meta = await (0, import_sharp.default)(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumbFilename = `${assetId}_thumb.jpg`;
      const thumbPath = import_node_path9.default.join(uploadsDir2, thumbFilename);
      await (0, import_sharp.default)(buffer, { animated: false }).resize(300, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(thumbPath);
      thumbnailUrl = ingestedUrl(input.projectId, thumbFilename);
    } catch {
    }
  } else if (typeInfo.type === "video") {
    try {
      const { stdout } = await execFileAsync3(
        "ffprobe",
        ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", storagePath],
        { timeout: 15e3 }
      );
      const info = JSON.parse(stdout);
      const v = info.streams?.find((s) => s.codec_type === "video");
      if (v) {
        width = v.width ?? null;
        height = v.height ?? null;
      }
      durationSeconds = info.format?.duration ? parseFloat(info.format.duration) : null;
    } catch {
    }
    try {
      const thumbFilename = `${assetId}_thumb.jpg`;
      const thumbPath = import_node_path9.default.join(uploadsDir2, thumbFilename);
      await execFileAsync3("ffmpeg", ["-i", storagePath, "-vframes", "1", "-vf", "scale=300:-1", "-y", thumbPath], {
        timeout: 3e4
      });
      thumbnailUrl = ingestedUrl(input.projectId, thumbFilename);
    } catch {
    }
  } else if (typeInfo.type === "svg") {
    thumbnailUrl = publicUrl;
  }
  const displayName = input.name || deriveNameFromUrl(input.url);
  const storedMime = typeInfo.type === "video" ? `video/${effectiveExt === "ogv" ? "ogg" : effectiveExt}` : typeInfo.type === "svg" ? "image/svg+xml" : `image/${effectiveExt === "jpg" ? "jpeg" : effectiveExt}`;
  const [asset] = await db.insert(projectAssets).values({
    id: assetId,
    projectId: input.projectId,
    filename: storedFilename,
    storagePath,
    publicUrl,
    type: typeInfo.type,
    mimeType: storedMime,
    sizeBytes: (await import_promises18.default.stat(storagePath)).size,
    width,
    height,
    durationSeconds,
    name: displayName,
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 30) : [],
    thumbnailUrl,
    extractedColors: [],
    source: "research",
    contentHash,
    sourceUrl: input.url
  }).returning();
  return { asset, contentHash, sourceUrl: input.url, deduped: false };
}

// electron/ipc/ingest.ts
function register15(ipcMain2) {
  ipcMain2.handle("cench:ingest.fromUrl", async (_e, args) => {
    try {
      return await ingestUrl(args);
    } catch (err) {
      if (err instanceof IngestValidationError) throw new IpcValidationError(err.message);
      if (err instanceof YtDlpMissingError) throw new IpcValidationError(`yt-dlp not installed: ${err.message}`);
      throw err;
    }
  });
  ipcMain2.handle("cench:ingest.fromDirectUrl", async (_e, args) => {
    try {
      return await ingestDirect(args);
    } catch (err) {
      if (err instanceof IngestValidationError) throw new IpcValidationError(err.message);
      throw err;
    }
  });
}

// lib/generation/generate.ts
var import_sdk = __toESM(require("@anthropic-ai/sdk"));

// lib/agents/types.ts
var MODEL_PRICING = {
  "claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
  "claude-opus-4-6": { inputPer1M: 15, outputPer1M: 75 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 3, outputPer1M: 15 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  o1: { inputPer1M: 15, outputPer1M: 60 },
  "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "gemini-2.5-flash-preview-05-20": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gemini-2.5-pro-preview-05-06": { inputPer1M: 1.25, outputPer1M: 10 }
};
function getModelProvider(modelId, modelConfigs) {
  if (!modelId) return "anthropic";
  if (modelId === "codex-cli") return "openai";
  if (modelId === "claude-code") return "claude-code";
  if (modelConfigs) {
    const config4 = modelConfigs.find((m) => m.id === modelId || m.modelId === modelId);
    if (config4?.provider === "local") return "local";
    if (config4?.provider === "claude-code") return "claude-code";
  }
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "openai";
  if (modelId.startsWith("gemini-")) return "google";
  const knownPrefixes = ["claude-", "gpt-", "o1", "o3", "gemini-"];
  if (!knownPrefixes.some((p) => modelId.startsWith(p))) return "local";
  return "anthropic";
}
function getModelPricing(modelId) {
  return MODEL_PRICING[modelId] ?? { inputPer1M: 0, outputPer1M: 0 };
}

// lib/three-environments/registry.ts
var CENCH_STUDIO_ENV_IDS = [
  "track_rolling_topdown",
  "studio_white",
  "cinematic_fog",
  "iso_playful",
  "tech_grid",
  "nature_sunset",
  "data_lab"
];
var CENCH_THREE_ENVIRONMENTS = [
  {
    id: "studio_white",
    name: "Studio white",
    description: "White cyclorama + circular floor + soft hemisphere key/fill. Product, SaaS, corporate.",
    tags: ["studio", "white", "cyclorama", "product", "corporate"]
  },
  {
    id: "cinematic_fog",
    name: "Cinematic fog",
    description: "Dark fogged backdrop, reflective floor, warm spot key + cool rim. Premium reveals, film.",
    tags: ["dark", "cinematic", "fog", "dramatic", "premium"]
  },
  {
    id: "iso_playful",
    name: "Playful pastel",
    description: "Warm pastel background + hemisphere + sun-warm key. Tutorials, kids, casual.",
    tags: ["pastel", "playful", "tutorial", "kids"]
  },
  {
    id: "tech_grid",
    name: "Tech grid",
    description: "Cyan shader grid floor + magenta rim + starfield on deep blue. Cyberpunk, AI, data.",
    tags: ["cyberpunk", "neon", "grid", "tech", "data", "ai"]
  },
  {
    id: "nature_sunset",
    name: "Nature sunset",
    description: "Gradient sunset sky, green ground, warm sun. Wellness, environment.",
    tags: ["nature", "sunset", "outdoor", "wellness"]
  },
  {
    id: "data_lab",
    name: "Data lab",
    description: "White void + transparent shadow-catcher floor. Charts, infographics, minimal.",
    tags: ["data", "white", "shadow-catcher", "chart", "minimal"]
  },
  {
    id: "track_rolling_topdown",
    name: "Rolling track lanes",
    description: "Top-down white surface, 4 lanes of rolling marbles. Diagrams, races.",
    tags: ["top-down", "tracks", "marbles", "diagram"]
  }
];
function formatThreeEnvironmentsForPrompt() {
  return CENCH_THREE_ENVIRONMENTS.map((e) => `- \`${e.id}\` \u2014 ${e.name}: ${e.description}`).join("\n");
}

// lib/three-environments/build-three-data-scatter-scene-code.ts
var STUDIO_ID_SET = new Set(CENCH_STUDIO_ENV_IDS);

// lib/generation/design-principles.ts
var LANDSCAPE_LAYOUT_RULES = `
ASPECT RATIO: Landscape (16:9)
- Full layout pattern library available. Side-by-side layouts encouraged.
- Hero text: 80-160px. Content can span full width.
- HERO-SPLIT works especially well \u2014 60/40 text-visual split.
- OFFSET-GRID for comparisons using the wide canvas.
`;
var PORTRAIT_LAYOUT_RULES = `
ASPECT RATIO: Portrait (9:16 or 4:5)
- Stack EVERYTHING vertically. Never use side-by-side columns \u2014 not enough width.
- Maximum 3 text blocks per scene (even less space than landscape).
- Hero text: 60-100px (narrower viewport demands smaller type).
- Full-width cards only, max 2 per scene.
- Increase vertical spacing between groups to 64px minimum.
- Available layout patterns: STACK-BREATHE, STAT-ANCHOR (vertical), FOCAL-POINT.
- Do NOT use: HERO-SPLIT, OFFSET-GRID, EDITORIAL-COLUMN (they need horizontal space).
`;
var SQUARE_LAYOUT_RULES = `
ASPECT RATIO: Square (1:1)
- Center-biased layouts are acceptable (unlike landscape where asymmetry is preferred).
- Maximum 4 visual elements per scene.
- Hero text: 64-96px.
- Consider radial or circular compositions \u2014 the square frame naturally draws the eye to center.
- Available layout patterns: FOCAL-POINT, STACK-BREATHE, HERO-SPLIT (use 50/50 split).
- STAT-ANCHOR works centered in square format.
`;
function getDesignPrinciples(dims) {
  const W = dims?.width ?? 1920;
  const H = dims?.height ?? 1080;
  const isPortrait = H > W;
  const isSquare = Math.abs(W - H) < 100;
  const scale = W / 1920;
  const safeArea = Math.round(80 * scale);
  const groupGap = Math.round(48 * scale);
  const innerGap = Math.round(16 * scale);
  const titleGapMin = Math.round(64 * scale);
  const titleGapMax = Math.round(96 * scale);
  const cardPaddingMin = Math.round(32 * scale);
  const cardPaddingMax = Math.round(48 * scale);
  const minGap = Math.round(24 * scale);
  const sectionGap = Math.round(120 * scale);
  const aspectRules = isPortrait ? PORTRAIT_LAYOUT_RULES : isSquare ? SQUARE_LAYOUT_RULES : LANDSCAPE_LAYOUT_RULES;
  return `
DESIGN QUALITY BAR (adapted from Impeccable):

The Slop Test: If someone looked at your output and said "AI made this," would they believe it immediately? If yes, redesign. Distinctive output makes people ask "how was this made?" not "which AI made this."

TYPOGRAPHY:
- VIDEO TEXT MUST BE LARGE. This is video, not a webpage \u2014 viewers watch on phones, embedded players, TVs across a room. Text that looks fine in a code editor is unreadable in a video.
- 4-step scale for video (at 1920\xD71080): display (100-180px), heading (48-72px), body (32-42px), label (24-32px). NOTHING below 24px. Ratio between levels: at least 1.5\xD7.
- The absolute minimum readable text in video is 24px at 1920\xD71080. If you're tempted to use a smaller size, remove the text instead \u2014 it won't be read.
- Never use overused fonts: Inter, Syne, Space Grotesk, DM Sans, Playfair Display, Montserrat, Roboto, Open Sans, Lato.
- Choose fonts that match the content's tone as a physical object \u2014 a museum caption, a hand-lettered sign, a mainframe manual.
- Light text on dark backgrounds reads heavier \u2014 reduce weight slightly and increase line-height.

COMPOSITION:
- Do NOT center everything. Asymmetric layouts with left-aligned text feel more designed.
- Create visual hierarchy through 2-3 dimensions simultaneously: size + weight + space.
- Squint Test: blur your eyes. Can you identify the most important element and clear groupings? If everything looks the same weight, redesign.
- Vary spacing \u2014 tight groupings next to generous whitespace creates rhythm. Same-padding-everywhere is monotonous.
- Cards are overused. Spacing and alignment create visual grouping naturally. Only use cards when content needs clear boundaries or comparison.
- Break the grid intentionally for emphasis. One off-grid element draws the eye.

COLOR:
- Tint neutrals toward your accent hue. Even 0.005 chroma creates subconscious cohesion.
- 60-30-10 rule: 60% neutral/background, 30% secondary, 10% accent. Accent works because it's rare.
- Never pure black (#000) or pure white (#fff) \u2014 always tint toward the scene's mood.
- Never gray text on colored backgrounds \u2014 use a darker shade of the background color.
- Never the AI palette: cyan-on-dark, purple-to-blue gradients, neon accents on dark.
- Never gradient text \u2014 solid colors only for text.

MOTION:
- Exponential easing only: cubic-bezier(0.16, 1, 0.3, 1) for entrances, cubic-bezier(0.7, 0, 0.84, 0) for exits.
- NEVER bounce or elastic. They feel dated and amateurish.
- NEVER linear easing on spatial movement (position) \u2014 it looks robotic.
- Stagger: 50-100ms between items. Cap total stagger under 800ms.
- Exit at 75% of entrance duration.
- Do not animate everything \u2014 animation fatigue is real.
- Vary animation directions. Not everything should fade-in-from-below.
- Scene timing: 0-20% bg appears, 20-80% content builds, 80-100% hold (everything visible, viewer absorbs).
- Two-property sweet spot: pair position+opacity for entrances, scale+color for emphasis.
- Stagger secondary elements 50-100ms after the primary action for depth.

EMOTION-TO-MOTION (match motion to the scene's emotional intent):
- Joy / success: upward arcs, elastic settle, 150-250ms transitions, expanding scale.
- Urgency / warning: sharp direct paths, fast 100-150ms, angular movement.
- Trust / professionalism: smooth curves, medium 300-400ms, no overshoot, predictable.
- Elegance / premium: slow controlled curves, 400-600ms, subtle deceleration.
- Growth / progress: upward paths, expanding scale, sequential reveal.
- Calm / reflection: gentle floating drift, 500-1000ms, sine easing.
- Energy / excitement: quick snappy transitions, 100-200ms, dramatic direction changes.

CAMERA (required \u2014 but VARY per scene purpose; do NOT stamp kenBurns on every scene):
- Title / opening card \u2192 CenchCamera.presetCinematicPush({ at: 0, duration: DURATION * 0.6 })
- Static data / receipt / grid \u2192 CenchCamera.kenBurns({ duration: DURATION, endScale: 1.02 })
- Reveal of multiple items \u2192 CenchCamera.presetReveal({ duration: DURATION * 0.7 })
- Sign-off / closing \u2192 CenchCamera.presetEmphasis({ at: 0.5, duration: DURATION - 0.5 })
- Focus on one element \u2192 CenchCamera.dollyIn({ targetSelector: '#key-element', at: 1, duration: 3 })
- Content already moves (video playback, 3D spin, fast data animation) \u2192 SKIP CenchCamera entirely.
  Stacking camera motion on top of intrinsic motion causes visual nausea.
- If three scenes in a row use the same motion, change one. Mechanical sameness is worse than a mildly wrong motion.

ANTI-PATTERNS (instant AI tells):
- Side-stripe borders on cards (border-left: 4px solid ...)
- Identical card grids (icon + heading + text repeated)
- Hero metric layout (big number, small label, gradient accent)
- Particle background + gradient text hero
- Purple-to-blue gradients on dark backgrounds
- Bounce/elastic easing

CONTENT DENSITY (hard limits \u2014 do not exceed):
- Maximum 5 text blocks per scene (1 title + up to 4 supporting elements).
- Maximum 4 list/bullet items visible simultaneously. Longer lists \u2192 split across scenes.
- Maximum 3 cards or containers per scene. Prefer 1-2 for visual impact.
- If a scene has more than 6 distinct visual elements, remove or combine until 5 or fewer.
- One "hero element" per scene that occupies 40-60% of viewport area.
- Body text: maximum 3 lines per text block (~50 words). Cut ruthlessly.
- Bullet points: maximum 8 words per bullet. If longer, rewrite.
- These limits exist because viewers watch, not read. Less content = more retention.

SPACING SYSTEM (viewport: ${W}\xD7${H}px):
- Viewport edge safe area: ${safeArea}px inset from all edges minimum.
- Gap between content groups (e.g. title block vs. body block): ${groupGap}px minimum.
- Gap between elements within a group (e.g. heading and subheading): ${innerGap}px minimum.
- Title-to-first-content gap: ${titleGapMin}-${titleGapMax}px \u2014 this breathing room is what separates good from amateur.
- Card/container internal padding: ${cardPaddingMin}-${cardPaddingMax}px.
- Minimum gap between any two elements: ${minGap}px. Never less.
- Whitespace target: at least 40% of the viewport should be empty space. If your layout feels dense, remove elements \u2014 don't shrink them.
- Between sections or conceptual groups: ${sectionGap}px+ vertical gap.

ELEMENT SIZING:
- Hero/display text: at least ${isPortrait ? "72" : "100"}px, spanning 50%+ of viewport width.
- Heading text: at least ${isPortrait ? "40" : "48"}px.
- Body text: at least ${isPortrait ? "28" : "32"}px. This is the FLOOR \u2014 body text below this is unreadable in video.
- Labels, list items, annotations: at least ${isPortrait ? "22" : "24"}px. Nothing smaller, ever.
- Heading-to-body font size ratio: at least 1.5\xD7 (e.g. 72px heading, 36px body \u2014 not 48px/36px).
- Icons and illustrations: ${Math.round(140 * scale)}-${Math.round(400 * scale)}px. Below ${Math.round(140 * scale)}px they become unreadable.
- Data visualizations: minimum ${Math.round(500 * scale)}px wide, ${Math.round(300 * scale)}px tall.
- Interactive elements (pills, badges, tags): at least 24px text, 48px height minimum.
- Decorative elements: never larger than the primary content element.
- If text won't fit at these sizes, you have too much text. Cut content, don't shrink type.
- COMMON MISTAKE: Using 16-20px for secondary text. That's web sizing, not video sizing. Scale everything up.

LAYOUT PATTERNS (choose one per scene \u2014 do not improvise from scratch):

HERO-SPLIT: Large text left (60% width), visual/illustration right (40%). Text left-aligned. Visual can bleed to edge. Best for: introductions, key statements, definitions.

STACK-BREATHE: Full-width text blocks stacked vertically with ${Math.round(80 * scale)}px+ gaps. No containers or cards. Let whitespace do the grouping. Best for: single concepts, quotes, definitions.

OFFSET-GRID: 2-column asymmetric grid (55/45 or 65/35 split). Items intentionally DON'T align horizontally \u2014 the offset creates visual interest. Best for: comparisons, before/after, two related concepts.

FOCAL-POINT: One large central element (60%+ of viewport) with 2-3 small annotations positioned around it with subtle leader lines or arrows. Best for: diagrams, anatomy, feature highlights.

TIMELINE-FLOW: Horizontal or vertical flow with connected nodes. Maximum 4 nodes per scene. Best for: processes, history, step-by-step sequences.

STAT-ANCHOR: One massive number/metric (${Math.round(120 * scale)}px+) anchored to the left or top third, with supporting context text in smaller type beside or below it. NOT centered. Best for: data points, key statistics, impact numbers.

EDITORIAL-COLUMN: Single narrow text column (max ${Math.round(600 * scale)}px wide) offset to the left third, with a full-bleed background color, image, or illustration filling the rest. Best for: narrative text, storytelling.

SCATTER-ORGANIC: Elements placed at intentional but non-grid positions, varying in size. Connected by subtle lines, shared color, or proximity. Best for: mind maps, ecosystem overviews, relationship diagrams.
${aspectRules}
`;
}
var DESIGN_PRINCIPLES = getDesignPrinciples();

// lib/motion/easing.ts
var PERSONALITIES = {
  playful: {
    name: "Playful",
    durationRange: [0.15, 0.3],
    staggerMs: 60,
    maxStaggerMs: 500,
    overshoot: 0.15,
    easing: {
      entrance: [0.34, 1.56, 0.64, 1],
      // back-out approximation
      exit: [0.36, 0, 0.66, -0.56],
      // back-in approximation
      emphasis: [0.22, 1.4, 0.36, 1],
      // elastic-ish settle
      ambient: [0.37, 0, 0.63, 1]
      // ease-in-out
    },
    gsap: {
      entrance: "back.out(1.4)",
      exit: "back.in(1.4)",
      emphasis: "back.out(1.7)",
      ambient: "sine.inOut"
    }
  },
  premium: {
    name: "Premium",
    durationRange: [0.35, 0.6],
    staggerMs: 80,
    maxStaggerMs: 600,
    overshoot: 0,
    easing: {
      entrance: [0.4, 0, 0.2, 1],
      // smooth deceleration
      exit: [0.4, 0, 1, 1],
      // subtle acceleration
      emphasis: [0.16, 1, 0.3, 1],
      // exponential out
      ambient: [0.37, 0, 0.63, 1]
      // ease-in-out
    },
    gsap: {
      entrance: "power3.out",
      exit: "power2.in",
      emphasis: "expo.out",
      ambient: "sine.inOut"
    }
  },
  corporate: {
    name: "Corporate",
    durationRange: [0.2, 0.4],
    staggerMs: 70,
    maxStaggerMs: 600,
    overshoot: 0.02,
    easing: {
      entrance: [0.42, 0, 0.58, 1],
      // ease-in-out (predictable)
      exit: [0.42, 0, 1, 1],
      // ease-in
      emphasis: [0.16, 1, 0.3, 1],
      // exponential out
      ambient: [0.37, 0, 0.63, 1]
      // ease-in-out
    },
    gsap: {
      entrance: "power2.inOut",
      exit: "power2.in",
      emphasis: "expo.out",
      ambient: "sine.inOut"
    }
  },
  energetic: {
    name: "Energetic",
    durationRange: [0.1, 0.25],
    staggerMs: 40,
    maxStaggerMs: 400,
    overshoot: 0.25,
    easing: {
      entrance: [0.22, 1.8, 0.36, 1],
      // strong back-out
      exit: [0.55, 0, 1, 0.45],
      // quick acceleration
      emphasis: [0.18, 1.6, 0.32, 1],
      // aggressive overshoot
      ambient: [0.37, 0, 0.63, 1]
      // ease-in-out
    },
    gsap: {
      entrance: "back.out(2.0)",
      exit: "power3.in",
      emphasis: "back.out(2.5)",
      ambient: "sine.inOut"
    }
  }
};
function easingToLottieHandles(bezier, dimensions = 1) {
  const [x1, y1, x2, y2] = bezier;
  if (dimensions === 1) {
    return {
      i: { x: [x2], y: [y2] },
      o: { x: [x1], y: [y1] }
    };
  }
  return {
    i: { x: [x2, x2, x2], y: [y2, y2, y2] },
    o: { x: [x1, x1, x1], y: [y1, y1, y1] }
  };
}
function personalityPromptBlock(personality) {
  const p = PERSONALITIES[personality];
  const fmt = (b) => `cubic-bezier(${b.join(", ")})`;
  const lottie1d = (b) => {
    const h = easingToLottieHandles(b, 1);
    return `"i":{"x":[${h.i.x}],"y":[${h.i.y}]}, "o":{"x":[${h.o.x}],"y":[${h.o.y}]}`;
  };
  const lottie3d = (b) => {
    const h = easingToLottieHandles(b, 3);
    return `"i":{"x":[${h.i.x}],"y":[${h.i.y}]}, "o":{"x":[${h.o.x}],"y":[${h.o.y}]}`;
  };
  return `MOTION PERSONALITY: ${p.name}
Duration range: ${p.durationRange[0]}-${p.durationRange[1]}s per element transition
Stagger: ${p.staggerMs}ms between items (cap at ${p.maxStaggerMs}ms total)
Overshoot: ${p.overshoot === 0 ? "none" : `${Math.round(p.overshoot * 100)}%`}

Entrance easing: ${fmt(p.easing.entrance)}
  1D Lottie: ${lottie1d(p.easing.entrance)}
  3D Lottie: ${lottie3d(p.easing.entrance)}

Exit easing: ${fmt(p.easing.exit)}
  1D Lottie: ${lottie1d(p.easing.exit)}
  3D Lottie: ${lottie3d(p.easing.exit)}

Emphasis easing: ${fmt(p.easing.emphasis)}
  1D Lottie: ${lottie1d(p.easing.emphasis)}

Ambient easing: ${fmt(p.easing.ambient)}
  1D Lottie: ${lottie1d(p.easing.ambient)}`;
}

// lib/generation/prompts.ts
var SVG_SYSTEM_PROMPT = (palette, strokeWidth, font, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are an SVG animation artist for a high-end vector video editor.
Generate a single <svg> element with viewBox="0 0 ${W} ${H}" that draws itself using CSS animations.

STRICT RULES:
- Output ONLY the raw <svg>...</svg> element. No markdown, no explanation, no code blocks.
${hasExplicitPalette ? `- Suggested palette (prefer these, override when content demands): ${palette.join(", ")}` : "- Choose a color palette that best suits the content. You have full creative control over colors."}
- Default stroke-width: ${strokeWidth}
- Default font-family: ${font}
- Total animation must complete within ${duration} seconds
- Canvas: ${W}\xD7${H}px \u2014 fill the full space deliberately
- ALL content MUST fit within the viewBox (0,0 to ${W},${H}). Nothing below y=${H} or past x=${W} \u2014 it will be clipped and invisible. If there are too many items, reduce count, use smaller text, multi-column layout, or split into multiple scenes.

ANIMATION CLASSES (apply to SVG elements via class="..."):

class="stroke" \u2014 Draw effect for lines, paths, curves, outlines.
  CSS vars: --len (auto-calculated), --dur (seconds), --delay (seconds)
  Always pair with: stroke-linecap="round" stroke-linejoin="round" fill="none"
  Use for: all lines, arrows, outlines, technical diagrams, handwriting paths

class="fadein" \u2014 Opacity reveal for filled shapes and icons.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: filled rects, circles, polygons, solid-color blocks, icons, backgrounds

class="scale" \u2014 Scale entrance from 0 \u2192 1.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: icons appearing, callout circles, emphasis elements, data points

class="slide-up" \u2014 Slide in from below with fade.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: labels, annotations, body text, captions

class="slide-left" \u2014 Slide in from right with fade.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: titles entering from right, horizontal list items

class="bounce" \u2014 Elastic scale pop with overshoot.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: key data points, highlighted numbers, important icons

class="rotate" \u2014 Rotation entrance with fade.
  CSS vars: --dur (seconds), --delay (seconds)
  Use for: arrows, spinning decorative elements

LAYERING MODEL (always use these <g id="..."> groups in order):
1. <g id="bg">         \u2014 full-bleed background fills, gradients, texture shapes (fadein, delay 0)
2. <g id="midground">  \u2014 primary graphic content: charts, diagrams, illustrations (20\u201360% of duration)
3. <g id="fg">         \u2014 supporting lines, connectors, arrows (60\u201380%)
4. <g id="text">       \u2014 all <text> elements, titles, numbers, labels (70\u201390%)

STAGGER RULE:
- Never assign --delay 0 to all elements. Divide duration by element count, assign ascending delays.
- Background: --delay 0\u2013${(duration * 0.2).toFixed(1)}s
- Midground: --delay ${(duration * 0.2).toFixed(1)}\u2013${(duration * 0.6).toFixed(1)}s
- Foreground: --delay ${(duration * 0.6).toFixed(1)}\u2013${(duration * 0.8).toFixed(1)}s
- Text: --delay ${(duration * 0.7).toFixed(1)}\u2013${(duration * 0.9).toFixed(1)}s

TEXT RULES:
- Use <text> elements only (never foreignObject)
- font-family="${font}", specify dominant-baseline
- Pair large display text (font-size 80\u2013160) with smaller annotations (font-size 32\u201356)
- Apply class="slide-up" or class="fadein" with appropriate --delay

GSAP ANIMATION (preferred over CSS classes for new scenes):
A GSAP master timeline is available as window.__tl. Use it for seekable, pausable animations.
After the <svg> element, include a <script> block that adds animations to __tl:

  document.fonts.ready.then(() => {
    const tl = window.__tl;
    // DrawSVGPlugin: animate strokes from 0% to 100%
    tl.from('#path-id', { drawSVG: '0%', duration: 0.8, ease: 'power2.inOut' }, 0.5);
    // Fade in elements
    tl.from('#label-id', { opacity: 0, y: 10, duration: 0.3 }, 1.2);
    // Stagger multiple elements
    tl.from('.diagram-element', { drawSVG: '0%', duration: 0.6, stagger: 0.2 }, 0);
  });

All SVG elements MUST have unique id attributes for GSAP targeting.
Timeline position syntax: tl.from(el, opts, 0) = start at t=0s, tl.from(el, opts, '+=0.3') = 0.3s after previous.

ELEMENT IDS (required for editor inspector):
- EVERY visible SVG element (rect, circle, path, text, line, polygon, etc.) MUST have a unique id attribute
- Add data-label="Human-readable name" to each element for the editor's element list
- Example: <rect id="bg-rect-1" data-label="Blue background" ... />
- Example: <text id="title-text" data-label="Main title" ... />
- Groups <g> should also have id and data-label if they represent a logical unit

COMPOSITION:
- Include at least 3 layers (bg, midground, text minimum)
- Use arrows: <line> or <path> with unique ids + a small <polygon> arrowhead
- Include <!-- section comments --> for each group
- Vary element sizes for hierarchy \u2014 one dominant visual, 2-3 supporting, many small details.
- Use overlapping shapes and partial occlusion for depth, not flat side-by-side arrangement.
- Break symmetry: offset related elements, use diagonal flows, cluster groups off-center.
- Give every animated element a unique id attribute and data-label
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var CANVAS_SYSTEM_PROMPT = (palette, bgColor, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are a Canvas 2D animation programmer for a high-end video editor.

Generate a SINGLE self-contained JavaScript code block. No HTML, no <script> tags, no markdown fences, no explanation.

STRICT RULES:
- Output ONLY raw JavaScript.
- The canvas is already in the DOM: use document.getElementById('c') and getContext('2d').
- Canvas size: ${W}\xD7${H}. Never resize it.
${hasExplicitPalette ? `- Suggested palette (prefer these, override when content demands): ${palette.join(", ")}` : "- Choose colors that best suit the content. You have full creative control over the palette."}
- Duration: ${duration} seconds. Animation must complete in that time.
- All motion must be driven purely by t (elapsed seconds), never by setInterval or setTimeout.

GSAP PROXY PATTERN (required for all canvas2d scenes):

A GSAP master timeline is available as window.__tl. Use it with proxy objects.
Progress-based draw functions are available as globals: drawRoughLineAtProgress,
drawRoughCircleAtProgress, drawRoughRectAtProgress, drawRoughArrowAtProgress, drawTextAtProgress.

REQUIRED SKELETON:

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tl = window.__tl;

// Define proxy objects for each animated element (progress 0\u21921)
const proxies = {
  line1:   { p: 0 },
  circle1: { p: 0 },
  text1:   { p: 0 },
};

// REGISTER every element for the inspector (required)
window.__register({ id: 'line1', type: 'rough-line', label: 'Main line',
  x1: 100, y1: 540, x2: 900, y2: 540, color: STROKE_COLOR, strokeWidth: 3,
  tool: TOOL, seed: 1, opacity: 1, visible: true,
  animStartTime: 0, animDuration: 0.8,
  bbox: { x: 100, y: 530, w: 800, h: 20 } });
window.__register({ id: 'circle1', type: 'rough-circle', label: 'Circle',
  cx: 500, cy: 400, radius: 160, color: PALETTE[1], fill: 'none', fillAlpha: 0,
  strokeWidth: 3, tool: TOOL, seed: 2, opacity: 1, visible: true,
  animStartTime: 0.9, animDuration: 0.6,
  bbox: { x: 340, y: 240, w: 320, h: 320 } });
window.__register({ id: 'text1', type: 'text', label: 'Hello text',
  text: 'Hello', x: 500, y: 300, fontSize: 56, fontFamily: FONT,
  color: STROKE_COLOR, fontWeight: 'bold', textAlign: 'left',
  opacity: 1, visible: true, animStartTime: 1.5, animDuration: 0.4,
  bbox: { x: 500, y: 260, w: 200, h: 60 } });

// Master redraw \u2014 reads from __elements so inspector patches take effect
function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  var els = window.__elements;
  Object.keys(els).forEach(function(id) {
    var el = els[id];
    if (!el.visible) return;
    ctx.globalAlpha = el.opacity;
    var p = proxies[id] ? proxies[id].p : 1;
    if (el.type === 'rough-line') drawRoughLineAtProgress(ctx, el.x1, el.y1, el.x2, el.y2, p, { color: el.color, tool: el.tool, seed: el.seed, strokeWidth: el.strokeWidth });
    else if (el.type === 'rough-circle') drawRoughCircleAtProgress(ctx, el.cx, el.cy, el.radius, p, { color: el.color, fill: el.fill, fillAlpha: el.fillAlpha, tool: el.tool, seed: el.seed, strokeWidth: el.strokeWidth });
    else if (el.type === 'rough-rect') drawRoughRectAtProgress(ctx, el.x, el.y, el.width, el.height, p, { color: el.color, fill: el.fill, fillAlpha: el.fillAlpha, tool: el.tool, seed: el.seed, strokeWidth: el.strokeWidth, cornerRadius: el.cornerRadius });
    else if (el.type === 'rough-arrow') drawRoughArrowAtProgress(ctx, el.x1, el.y1, el.x2, el.y2, p, { color: el.color, tool: el.tool, seed: el.seed, strokeWidth: el.strokeWidth, arrowheadSize: el.arrowheadSize });
    else if (el.type === 'text') drawTextAtProgress(ctx, el.text, el.x, el.y, p, { fontSize: el.fontSize, fontFamily: el.fontFamily, color: el.color, fontWeight: el.fontWeight, textAlign: el.textAlign });
    ctx.globalAlpha = 1;
  });
}
window.__redrawAll = draw;

// Wire up timeline \u2014 wrap in fonts.ready for text rendering
document.fonts.ready.then(() => {
  tl.to(proxies.line1,   { p: 1, duration: 0.8, onUpdate: draw }, 0)
    .to(proxies.circle1, { p: 1, duration: 0.6, onUpdate: draw }, 0.9)
    .to(proxies.text1,   { p: 1, duration: 0.4, onUpdate: draw }, 1.5);
});

CRITICAL RULES:
- NEVER use requestAnimationFrame, setInterval, setTimeout, async/await, or Promise-based animation.
- NEVER define your own loop() function. GSAP drives all frame updates.
- ALWAYS use window.__tl for sequencing. Timeline position: tl.to(el, opts, 0) = starts at t=0s.
- ALWAYS use fixed seed integers (1, 2, 3...) for drawRough* functions. Never Math.random().
- ALWAYS wrap in document.fonts.ready.then(() => { ... }) if drawing text.
- Do NOT fill the background \u2014 clearRect + body CSS handles it.
- Stagger: background elements at t=0, midground at 20-60% of DURATION, text at 60-90%.
- Fill the full ${W}\xD7${H} canvas.
- Rich compositions: create visual depth with layered elements (background wash, midground subjects, foreground details).
- For generative art: use coherent mathematical systems (attractors, flow fields, recursive subdivisions) not random scatter. Each pattern should have governing logic the viewer can sense.
- Vary stroke weights \u2014 thin detail lines alongside bold structural strokes.
- ALL content MUST fit within ${W}\xD7${H}. Nothing drawn below y=${H} or past x=${W} \u2014 it will be clipped. If too many items, reduce count, use smaller text, or use multi-column layout.

DrawOpts for progress functions: { color, tool, seed, width, fill, fillAlpha }
Available tools: 'marker', 'pen', 'chalk', 'brush', 'highlighter'
Globals: PALETTE, DURATION, ROUGHNESS, FONT, WIDTH, HEIGHT, TOOL, STROKE_COLOR, BG_COLOR
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var D3_SYSTEM_PROMPT = (palette, font, bgColor, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are a D3.js data visualization programmer for a high-end video editor.

Output ONLY a raw JSON object \u2014 no markdown fences, no explanation.

Required JSON shape:
{
  "styles": "<CSS string for chart elements, no <style> tags>",
  "sceneCode": "<JavaScript using D3 \u2014 appends SVG to #chart>",
  "suggestedData": <JSON data object appropriate for the visualization>
}

STRICT RULES:
- Use d3 global (v7), DATA global (user data or suggested), WIDTH=${W}, HEIGHT=${H}
- Create an SVG: d3.select('#chart').append('svg').attr('viewBox','0 0 ${W} ${H}').attr('width','100%').attr('height','100%')
- NEVER use .attr('width', WIDTH).attr('height', HEIGHT) with pixel values \u2014 this creates a fixed-size SVG that overflows the container. ALWAYS use viewBox + width="100%" + height="100%".
${hasExplicitPalette ? `- Suggested palette (prefer these, override when content demands): ${palette.join(", ")}` : "- Choose a color palette that suits the data and content."}
- Font: ${font}; background is already ${bgColor}
- Duration: ${duration} seconds \u2014 use .transition().duration(ms) for all enters
- Stagger elements: .delay((d,i) => i * 100)
- Title text: 56px bold; axis labels: 28px; data labels: 24px (nothing below 24px \u2014 this is video)
- Fill the full ${W}\xD7${H} canvas deliberately \u2014 ALL content must fit within the viewBox. Nothing below y=${H} or past x=${W}. If too many data points or labels, reduce the dataset or use smaller text.
- suggestedData should be a realistic dataset matching the prompt (array or object)
SEEK/SCRUB SAFETY (MANDATORY):
- Scene output MUST be deterministic from timeline time.
- Define a function renderAtTime(t) that computes all visual state (camera + chart) from absolute t.
- Define window.__updateScene = function(t) { renderAtTime(t || 0); }.
- Register a single GSAP timeline driver:
    const sceneState = { t: 0 };
    window.__tl.to(sceneState, { t: DURATION, duration: DURATION, ease: 'none', onUpdate: () => renderAtTime(sceneState.t) }, 0);
- Call renderAtTime(0) once for initial paused frame.
- NEVER rely on one-shot animation triggers for core state (no event-only transitions).
GSAP ANIMATION (preferred over D3 transitions):
A GSAP master timeline is available as window.__tl. Use it for seekable animations:

  bars.each(function(d, i) {
    const proxy = { height: 0 };
    window.__tl.to(proxy, {
      height: targetHeight,
      duration: 0.8,
      ease: 'power2.out',
      delay: i * 0.1,
      onUpdate: () => d3.select(this).attr('height', proxy.height).attr('y', HEIGHT - margin.bottom - proxy.height),
    }, 0);
  });

This is preferred over D3 .transition() because GSAP timelines are pausable and seekable.
NEVER use setTimeout/setInterval for visual sequencing; use window.__tl positions only.
Avoid d3.transition() for core chart state; if used for micro-effects, scene must still render correctly at any seek time via renderAtTime(t).

ANIMATION GUIDANCE:
- Start all elements at opacity 0, use GSAP to animate to full opacity
- Bars: start height 0, animate to full height via GSAP proxy
- Use GSAP eases: 'power2.out', 'power2.inOut', 'power3.out'
- Add gridlines, axis labels, title, and data value labels
- Readability default (MANDATORY unless user requests otherwise): clear legible typography, high contrast text, and explicit axis/title/value labels. Do not sacrifice readability for style unless the user explicitly asks.

CHART DESIGN:
- Prefer horizontal bar charts over vertical when labels are long.
- Avoid pie charts for more than 4 categories \u2014 use horizontal bar or treemap instead.
- Never use 3D effects on 2D charts.
- Use direct labeling on data points instead of legends when possible \u2014 reduces eye travel.
- Choose chart type by question: comparison \u2192 bar, trend \u2192 line, proportion \u2192 stacked bar/waffle, distribution \u2192 histogram, correlation \u2192 scatter.
- Animate the data, not the decoration. Bar height growing from zero is meaningful; decorative spinning is not.
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var THREE_SYSTEM_PROMPT = (palette, bgColor, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are a Three.js 3D scene programmer for a high-end video editor.

Output ONLY a raw JSON object \u2014 no markdown fences, no explanation.

Required JSON shape:
{
  "sceneCode": "<ES module JavaScript \u2014 full self-contained scene>"
}

STRICT RULES:
- Three.js r183 via ES modules. Your code runs in its own <script type="module">.
- You MUST import THREE yourself: import * as THREE from 'three';
- You MUST read globals from window: const WIDTH = window.WIDTH, etc.
- Available window globals: WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment, THREE, applyCenchThreeEnvironment, updateCenchThreeEnvironment, CENCH_THREE_ENV_IDS, createCenchDataScatterplot, updateCenchDataScatterplot, createCenchPostFX, createCenchPostFXPreset, CENCH_POSTFX_PRESETS, CENCH_TONE_MAPS, addCinematicLighting, addGroundPlane, loadPBRSet, loadHDREnvironment, createInstancedField, createPositionalAudio
- Background is already set to ${bgColor} via CSS; set renderer.setClearColor to match.
${hasExplicitPalette ? `- Suggested palette (convert hex to THREE.Color, override when content demands): ${palette.join(", ")}` : "- Choose colors that suit the 3D content. PALETTE global is available but you may use any colors."}
- WebGLRenderer MUST include preserveDrawingBuffer: true
- NEVER use requestAnimationFrame for your animation loop \u2014 use window.__tl (GSAP) onUpdate instead.
- NEVER use Math.random() \u2014 use mulberry32(seed) for deterministic randomness.
- NEVER use MeshBasicMaterial \u2014 always use MeshStandardMaterial or MeshPhysicalMaterial.
- You CAN import from 'three/addons/' for OrbitControls, postprocessing, GLTFLoader, RGBELoader, etc.

AVAILABLE IMPORTS (use as needed):
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Text } from 'troika-three-text';  // SDF 3D text \u2014 any font URL
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg'; // Boolean ops on meshes

SVG-TO-3D EXTRUSION (SVGLoader cannot resolve url(#...) gradients \u2014 always use PALETTE):
const pivot = new THREE.Group(); scene.add(pivot);
const data = new SVGLoader().parse(await fetch(svgUrl).then(r => r.text()));
const inner = new THREE.Group(); let i = 0;
for (const p of data.paths) for (const sh of SVGLoader.createShapes(p)) {
  const g = new THREE.ExtrudeGeometry(sh, { depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5, bevelSegments: 8, curveSegments: 24 });
  const m = new THREE.MeshStandardMaterial({ color: PALETTE[i++ % PALETTE.length], metalness: 0.6, roughness: 0.25 });
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; inner.add(mesh);
}
// center + Y-flip via pivot:
const box = new THREE.Box3().setFromObject(inner), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
inner.position.set(-c.x, -c.y, -c.z); pivot.scale.set(4/Math.max(sz.x,sz.y,sz.z), -4/Math.max(sz.x,sz.y,sz.z), 4/Math.max(sz.x,sz.y,sz.z)); pivot.add(inner);

DREI-VANILLA (import { Sparkles, Grid, Stars } from '@pmndrs/vanilla'):
- new Sparkles(scene, { count, size, color }) | new Grid(scene, { cellSize, sectionSize, fadeDistance }) | new Stars(scene, { count, radius })

3D TEXT (troika SDF \u2014 decorative only; prefer HTML overlays for readable captions):
import { Text } from 'troika-three-text';
const t = new Text(); t.text = 'hi'; t.fontSize = 0.8; t.color = PALETTE[0]; t.anchorX='center'; t.anchorY='middle'; t.font = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2'; t.sync(); scene.add(t);
// Props: maxWidth, textAlign, outlineWidth, outlineColor, curveRadius, letterSpacing.

CSG BOOLEANS (three-bvh-csg \u2014 cutouts, mechanical parts):
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';
const a = new Brush(new THREE.SphereGeometry(1.5,32,32), MATERIALS.metal(PALETTE[0]));
const b = new Brush(new THREE.BoxGeometry(1.2,1.2,1.2), MATERIALS.plastic(PALETTE[1])); b.position.set(0.5,0.5,0); b.updateMatrixWorld();
const result = new Evaluator().evaluate(a, b, SUBTRACTION); result.castShadow = true; scene.add(result);

ANIMATED GLTF MODELS (AnimationMixer for Mixamo / animated .glb):
const gltf = await new GLTFLoader().loadAsync(modelUrl);
scene.add(gltf.scene);
const mixer = new THREE.AnimationMixer(gltf.scene);
if (gltf.animations.length > 0) mixer.clipAction(gltf.animations[0]).play();
// In onUpdate: mixer.update(deltaTime)

POST-FX COOKBOOK (prefer createCenchPostFX over hand-wiring passes):
// One call builds the whole composer. Call render() in onUpdate instead of renderer.render.
const fx = createCenchPostFX(renderer, scene, camera, {
  bloom: { strength: 0.4, radius: 0.45, threshold: 0.85 },
  dof:   { focus: 10, aperture: 0.002, maxblur: 0.01 },
  ssao:  { kernelRadius: 8, minDistance: 0.005, maxDistance: 0.1 },
  outline: { edgeStrength: 3.0, visibleEdgeColor: 0xffffff, selectedObjects: [myMesh] },
  afterimage: { damp: 0.92 },               // motion-blur trails
  chromaticAberration: { amount: 0.0035 },
  filmGrain: { intensity: 0.35 },
  glitch: false,
  pixelate: { pixelSize: 4 },               // retro downsample
  scanlines: { intensity: 0.2, density: 1.8 },
  colorGrade: { exposure: 1.05, contrast: 1.08, saturation: 1.05, tint: 0xffe8bf },
});
// In animation loop: fx.render() instead of renderer.render(scene, camera)

POSTFX PRESETS (fastest path \u2014 createCenchPostFXPreset(renderer, scene, camera, preset)):
- 'bloom' \u2014 soft emissive glow
- 'cinematic' \u2014 bloom + DOF + subtle grade (hero product / reveal)
- 'cyberpunk' \u2014 bloom + chromatic aberration + scanlines + magenta tint
- 'vintage' \u2014 film grain + warm desaturated grade
- 'dream' \u2014 heavy bloom + wide DOF + lifted blacks
- 'matrix' \u2014 green tint + bloom + scanlines
- 'retroPixel' \u2014 pixelate + saturated grade
- 'ghibli' \u2014 soft bloom + warm pastel grade
- 'noir' \u2014 high-contrast grayscale + film grain
- 'sharpCorporate' \u2014 SSAO + subtle contrast (clean product)
Overrides merge on top: createCenchPostFXPreset(renderer, scene, camera, 'cinematic', { bloom: { strength: 0.55 } }).

SCENE BUILDERS (one-call helpers \u2014 ALWAYS prefer these over hand-wiring):
// 1) Stage environment: call ONCE after scene+renderer+camera exist
applyCenchThreeEnvironment('studio_white', scene, renderer, camera);
// Ids: studio_white | cinematic_fog | iso_playful | tech_grid | nature_sunset | data_lab | track_rolling_topdown

// 2) Lighting rig (drop-in 3-point, shadow-enabled)
addCinematicLighting(scene, 'product'); // corporate | dramatic | playful | product | cyberpunk | nature | softbox

// 3) Ground plane (shadow-catcher, infinite, circle, etc.)
addGroundPlane(scene, { mode: 'shadow', opacity: 0.25 });      // invisible floor that only catches shadows
addGroundPlane(scene, { mode: 'circle', radius: 18, color: '#ffffff' });
addGroundPlane(scene, { mode: 'infinite', color: 0x0e131a, roughness: 0.3, metalness: 0.2 });

// 4) PBR texture set (diffuse+normal+roughness+metalness+ao files at {prefix}_{name}.jpg)
const mat = loadPBRSet('/textures/brick', { repeat: 3, physical: false });

// 5) HDR IBL (equirect .hdr \u2192 scene.environment, photoreal reflections)
await loadHDREnvironment('/hdr/studio_small.hdr', scene, renderer, { background: false });

// 6) Instancing (>30 clones \u2192 ALWAYS use this, not individual meshes)
const field = createInstancedField({
  geometry: new THREE.IcosahedronGeometry(0.3, 1),
  material: MATERIALS.metal(PALETTE[1]),
  count: 400, layout: 'sphere', radius: 6, randomRotation: true, randomScale: true,
  color: (i) => new THREE.Color().setHSL((i / 400), 0.6, 0.55),
});
scene.add(field);
// layout: 'grid' | 'circle' | 'sphere' | 'jitter'. Optional transform(dummy, i, rng) for full control.

// 7) Spatial audio (positional \u2014 pans + attenuates with distance)
const beep = createPositionalAudio(camera, '/sfx/beep.mp3', { refDistance: 2, volume: 0.6 });
mesh.add(beep);

CAMERA ANIMATION PATTERNS:
- Dolly: animate camera.position.z from far to near
- Crane: animate camera.position.y while lookAt origin
- Path: new THREE.CatmullRomCurve3([points...]), camera.position.copy(curve.getPointAt(progress))
- Zoom: animate camera.fov + camera.updateProjectionMatrix()

REQUIRED BOILERPLATE (include this at the top, then add your scene):
import * as THREE from 'three';
const { WIDTH, HEIGHT, PALETTE, DURATION, MATERIALS, mulberry32, setupEnvironment, applyCenchThreeEnvironment, updateCenchThreeEnvironment, createCenchDataScatterplot, updateCenchDataScatterplot } = window;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(WIDTH, HEIGHT);
renderer.setClearColor('${bgColor}');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = CENCH_TONE_MAPS.aces; // aces (default) | agx (most neutral modern) | cineon (cinema) | reinhard (soft highlights) | neutral | linear | none
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 0, 0);
window.__threeCamera = camera; // Expose for CenchCamera 3D moves

// 3-point lighting (ALWAYS include \u2014 never just AmbientLight)
const ambient = new THREE.AmbientLight(0xffffff, 0.3);
const key = new THREE.DirectionalLight(0xfff6e0, 1.4);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.001;
const fill = new THREE.DirectionalLight(0xd0e8ff, 0.45);
fill.position.set(6, 2, 4);
const rim = new THREE.DirectionalLight(0xffe0d0, 0.7);
rim.position.set(0, 4, -9);
scene.add(ambient, key, fill, rim);

// Animation \u2014 MUST use window.__tl (GSAP master timeline), NOT requestAnimationFrame
const state = { progress: 0 };
window.__tl.to(state, {
  progress: 1,
  duration: DURATION,
  ease: 'none',
  onUpdate: function () {
    const t = state.progress * DURATION; // seconds 0 \u2192 DURATION
    // ---- YOUR SCENE UPDATES HERE (use t for all animation) ----
    renderer.render(scene, camera);
  }
}, 0);
// Initial render so scene is visible while paused
renderer.render(scene, camera);

SHADOWS (all 4 lines required for shadows to appear):
renderer.shadowMap.enabled = true   // in boilerplate above
light.castShadow = true             // on light
mesh.castShadow = true              // on objects casting shadows
floor.receiveShadow = true          // on the receiving surface

GEOMETRIES AVAILABLE (r183):
SphereGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, CapsuleGeometry,
TorusGeometry, TorusKnotGeometry, PlaneGeometry, RingGeometry, TubeGeometry,
IcosahedronGeometry, OctahedronGeometry, DodecahedronGeometry, TetrahedronGeometry,
LatheGeometry, ExtrudeGeometry, ShapeGeometry, EdgesGeometry, WireframeGeometry

ENVIRONMENT MAP (call after creating scene + renderer for pro lighting):
setupEnvironment(scene, renderer);
This creates a procedural studio environment map with warm/cool gradient
and soft light panels. Makes all PBR materials look dramatically better
with realistic reflections. Call this for studio/product shots, OR skip it when you use the Cench stage environment below (it sets its own backdrop and lights).

CENCH STAGE ENVIRONMENTS (pick ONE id that matches the user's setting \u2014 adds lights, ground/sky/fog/particles as a group __cenchEnvRoot):
${formatThreeEnvironmentsForPrompt()}

HOW TO USE STAGE ENVIRONMENTS:
- After you create scene, renderer, and camera, call exactly one of:
  applyCenchThreeEnvironment('ENV_ID', scene, renderer, camera);
- Each frame inside your animate loop, after you compute elapsed time t in seconds:
  updateCenchThreeEnvironment(window.__tl && typeof window.__tl.time === 'function' ? window.__tl.time() : t);
  (Timeline scrubbing requires __tl.time(); call updateCenchThreeEnvironment every frame so the stage animation \u2014 rolling track marbles \u2014 stays in sync.)
- Then add your hero meshes, GLTF models, and story motion on top. Do not remove the __cenchEnvRoot group.

COMPOSITION & MOTION (compressed \u2014 prefer scene builders for the heavy lifting):
- Frame subjects at rule-of-thirds intersections; never dead-center on an empty void.
- Depth: foreground detail + midground hero + background environment. Use stage envs for depth.
- Materials: roughness 0.3-0.7 for realism, metalness for contrast. Avoid default gray.
- Camera: eye-level or slightly above. Slow motion (0.1-0.3 rad/s). Static for info-heavy.
- Scale: camera distance 8-15u, objects 0.5-3u radius. Animate with t via window.__tl.
- TEXT IN HTML, NOT 3D: for production video use React scenes with <ThreeJSLayer> under <AbsoluteFill> JSX text. Troika 3D text is decorative only.
- Every object should mean something \u2014 3D illustrates concepts, it's not a tech demo.

TEMPLATE HELPERS (injected as globals \u2014 all above are preferred over hand-coded equivalents):
- applyCenchThreeEnvironment(envId, scene, renderer, camera) \u2014 full backdrop + lights (see SCENE BUILDERS)
- addCinematicLighting(scene, style) \u2014 tuned 3-point rig
- addGroundPlane(scene, opts) \u2014 shadow-catcher | infinite | circle floor
- loadHDREnvironment(url, scene, renderer, { background }) \u2014 equirect HDR \u2192 IBL
- loadPBRSet(urlPrefix, opts) \u2014 material from {prefix}_diffuse.jpg + _normal + _roughness + _metalness + _ao
- createInstancedField(opts) \u2014 InstancedMesh with grid|circle|sphere|jitter layout
- createPositionalAudio(camera, url, opts) \u2014 spatial audio attached to meshes
- createCenchPostFX(renderer, scene, camera, opts) / createCenchPostFXPreset(..., name)
- CENCH_TONE_MAPS \u2014 { aces, cineon, reinhard, linear, agx, neutral, none }
- buildStudio(THREE, scene, camera, renderer, style?, opts?) \u2014 ThreeJSLayer-only studio bundle
- createStudioScene(style) \u2014 standalone all-in-one (NOT available in ThreeJSLayer)
- createPostProcessing(renderer, scene, camera, { bloom }) \u2014 legacy minimal composer (prefer createCenchPostFX)
- MATERIALS.lowpoly(c) \u2014 flat-shaded friendly aesthetic

MODEL LIBRARY (/models/library/ \u2014 use GLTFLoader):
Categories: tech (laptop, monitor, tablet, keyboard), people (person-standing), business (desk, office-chair, whiteboard, briefcase, book, coin-stack), abstract (gear, shield, target, light-bulb, arrow-3d), environment (building-office, building-skyscraper, tree), transport (car, delivery-truck).
Pattern: new GLTFLoader().load('/models/library/tech/laptop.glb', g => scene.add(g.scene))

ADVANCED / OPT-IN \u2014 WebGPURenderer + TSL (Three.js Shading Language):
Three.js ships WebGPURenderer + a node-based TSL shader system at 'three/webgpu'. Reach for it ONLY when the user explicitly asks for GPU compute, >10k particle simulations, or node shaders. Baseline scenes should stay on WebGLRenderer. If you DO switch, keep preserveDrawingBuffer: true, await renderer.init() before first render, and swap composer.render() with renderer.renderAsync().

3D STYLE MATCHUP (pick ONE combo \u2014 variety is professional):
- Corporate/SaaS \u2192 studio_white + sharpCorporate + addCinematicLighting('corporate')
- Premium/reveal \u2192 cinematic_fog + cinematic + addCinematicLighting('dramatic')
- Tutorial/kids \u2192 iso_playful + ghibli + addCinematicLighting('playful')
- Cyberpunk/data/AI \u2192 tech_grid + cyberpunk + addCinematicLighting('cyberpunk')
- Product launch \u2192 studio_white + cinematic + addCinematicLighting('product')
- Wellness/nature \u2192 nature_sunset + vintage + addCinematicLighting('nature')
- Chart/infographic \u2192 data_lab + bloom + addCinematicLighting('softbox')
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var MOTION_SYSTEM_PROMPT = (palette, font, bgColor, duration, previousSummary, hasExplicitPalette = true) => `You are a Motion/Anime.js animation programmer for a high-end video editor.

Output ONLY a raw JSON object \u2014 no markdown fences, no explanation.

Required JSON shape:
{
  "styles": "<CSS string for all elements, no <style> tags>",
  "htmlContent": "<HTML body elements, no <body> tags>",
  "sceneCode": "<JavaScript \u2014 runs after Motion and Anime.js are loaded>"
}

STRICT RULES:
- Body is 100vw \xD7 100vh with overflow:hidden \u2014 ALL content MUST fit without overflowing
- Use flexbox or CSS grid for layout \u2014 NEVER position:absolute with pixel values
- Use clamp(), vw/vh, and percentages for responsive sizing
- Elements SHOULD have CSS @keyframes entrance animations (opacity:0 + animation: ... forwards) so content is visible even before JS runs
${hasExplicitPalette ? `- Suggested palette (prefer these, override when content demands): ${palette.join(", ")}` : "- Choose a color palette that suits the content. You have full creative control over colors."}
- Font: ${font}
- Background is already set to ${bgColor}
- Duration: ${duration} seconds total
- GSAP master timeline is available as window.__tl. ALL animation timing MUST go through it.
- NEVER use standalone anime() timelines, setTimeout, setInterval, or requestAnimationFrame
- Use mulberry32(seed)() for any randomness \u2014 never Math.random()
- Template globals are pre-injected (DURATION, WIDTH, HEIGHT, PALETTE, FONT, STROKE_COLOR) \u2014 do NOT redeclare them

REQUIRED SKELETON (include this in sceneCode, then add your element updates):
const els = {
  // Cache your DOM elements here
  // title: document.getElementById('title'),
};

const sceneState = { progress: 0 };
window.__tl.to(sceneState, {
  progress: 1,
  duration: DURATION,
  ease: 'none',
  onUpdate: function() {
    const p = sceneState.progress; // 0\u21921 over DURATION seconds
    // Reveal and animate elements based on progress:
    // if (p > 0.1) els.title.style.opacity = Math.min(1, (p - 0.1) / 0.1);
    // els.box.style.transform = 'translateX(' + (p * 500) + 'px)';
  },
}, 0);

ANIMATION GUIDANCE:
- Use progress thresholds to stagger element entrances (e.g., show el1 at p>0.1, el2 at p>0.25)
- Smooth transitions: use Math.min(1, (p - threshold) / fadeDuration) for fade-ins
- Use sin/cos on p for oscillating motion
- Fill the viewport deliberately \u2014 use flex/grid to distribute content evenly
- ALL content MUST stay within bounds \u2014 use overflow:hidden, clamp(), and responsive units
- If too many items, reduce count, use smaller text, or multi-column flex/grid layout
- For easing within a segment: use power curves like Math.pow((p - start) / length, 2) for ease-in

LAYOUT & CHOREOGRAPHY:
- Use CSS grid or flexbox to create editorial layouts: split screens, overlapping panels, text alongside shapes.
- Establish typographic hierarchy with at least 3 distinct sizes (headline 5-9vw, subhead 2.5-4vw, body 1.7-2.2vw). Nothing below 1.5vw \u2014 that's the video readability floor.
- Choreograph reveals by spatial region \u2014 e.g., left builds first, then right responds \u2014 not everything from the same direction.
- Avoid centering every text block. Left-aligned text with asymmetric composition feels more intentional.
${DESIGN_PRINCIPLES}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
var ZDOG_SYSTEM_PROMPT = (palette, bgColor, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are a Zdog pseudo-3D illustration programmer for a high-end video editor.

Generate a SINGLE self-contained JavaScript code block. No HTML, no <script> tags, no markdown fences, no explanation.

STRICT RULES:
- Output ONLY raw JavaScript.
- Zdog is already loaded as a global (window.Zdog). Never import or require it.
- The canvas is already in the DOM: use document.getElementById('zdog-canvas').
- Canvas size: ${W}\xD7${H} (WIDTH and HEIGHT globals are pre-defined). Do not resize it.
${hasExplicitPalette ? `- Suggested palette (prefer these, override when content demands): ${palette.join(", ")}` : "- Choose colors that suit the content. PALETTE global is available but you may use any colors."}
- Background is already set to ${bgColor} via CSS \u2014 do NOT draw a background rectangle.
- Duration: ${duration} seconds. Animation must stop or loop gracefully at DURATION.
- dragRotate MUST be false \u2014 headless Chrome has no mouse events.
- NEVER use requestAnimationFrame, setInterval, or setTimeout. GSAP drives all animation.
- Use mulberry32(seed)() for any randomness \u2014 never Math.random().
- Maximum 20 individual shape objects. Use Zdog.Anchor groups for complex assemblies.
- No Zfont \u2014 do NOT attempt to render text inside Zdog. Use HTML overlay for labels if needed.

REQUIRED SKELETON (copy exactly, fill in the scene setup between the markers):
const canvas = document.getElementById('zdog-canvas');

const illo = new Zdog.Illustration({
  element: canvas,
  zoom: 4,
  dragRotate: false,
  resize: false,
  width: WIDTH,
  height: HEIGHT,
});

// ---- YOUR SCENE SETUP HERE (add shapes to illo or to Anchor groups) ----

// ---- END SCENE SETUP ----

// GSAP drives the animation \u2014 no manual RAF loop
const sceneState = { t: 0 };
window.__tl.to(sceneState, {
  t: DURATION,
  duration: DURATION,
  ease: 'none',
  onUpdate: function() {
    const t = sceneState.t;
    // ---- YOUR ANIMATION UPDATES HERE (use t for all motion) ----

    // ---- END ANIMATION UPDATES ----
    illo.updateRenderGraph();
  },
}, 0);

COORDINATE SYSTEM:
- Origin is center of canvas.
- x: positive = right, y: positive = DOWN, z: positive = toward camera.
- At zoom=4: a shape with diameter=40 appears ~160px wide on screen.
- Keep shapes within -60 to +60 on x/y, -40 to +40 on z.

ANIMATION GUIDANCE:
- Slow spin: illo.rotate.y = elapsed * 0.5 (full turn every ~12s)
- Lerp to target: shape.translate.y += (targetY - shape.translate.y) * 0.08
- Oscillate: shape.translate.y = Math.sin(elapsed * 2) * 20
- Stagger reveals: reveal shape i when elapsed > i * (DURATION / shapeCount)

SHAPE QUICK REFERENCE:
new Zdog.Ellipse({ addTo, diameter, stroke, color, fill, translate:{x,y,z}, rotate:{x,y,z} })
new Zdog.Rect({ addTo, width, height, stroke, color, fill, translate, rotate })
new Zdog.Cylinder({ addTo, diameter, length, stroke, color, fill, backface })
new Zdog.Cone({ addTo, diameter, length, stroke, color })
new Zdog.Box({ addTo, width, height, depth, stroke, color, fill, leftFace, rightFace, topFace, bottomFace, frontFace, rearFace })
new Zdog.Hemisphere({ addTo, diameter, stroke, color, fill, backface })
new Zdog.Polygon({ addTo, radius, sides, stroke, color, fill })
new Zdog.Shape({ addTo, path:[{x,y,z},...], stroke, color, closed })
new Zdog.Anchor({ addTo, translate, rotate, scale })  // group/pivot

WHAT LOOKS GREAT IN ZDOG:
- Rotating molecular/atomic models (Hemisphere + Cylinder + Ellipse rings)
- 3D bar charts (Box shapes varying height)
- Spinning globes (Ellipse latitude rings on a sphere body)
- Interlocking gears (Polygon + Cylinder)
- Network diagrams (Ellipse nodes + Shape connectors)
- Solar system / orbital models (Ellipse rings + Hemisphere)
- Product boxes (Box with different face colors per face)

COMPOSITION:
- Group shapes into logical assemblies using Zdog.Anchor \u2014 don't scatter unrelated shapes.
- One primary assembly at larger scale, with secondary details orbiting or supporting.
- Use 2-3 palette colors maximum, with one dominant. Not every shape needs a different color.
- Vary shape types within assemblies \u2014 combine Ellipse + Cylinder + Box, not all-same-shape.
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var LOTTIE_OVERLAY_PROMPT = (palette, font, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }, motionPersonality = "corporate") => {
  const W = dims.width;
  const H = dims.height;
  const op = duration * 30;
  const personality = personalityPromptBlock(motionPersonality);
  return `You are a Lottie animation generator. Generate a valid Lottie JSON animation.

Output ONLY raw JSON \u2014 no markdown fences, no explanation, no wrapping.

CANVAS: w=${W}, h=${H}, fr=30, duration=${duration}s (op = ${op} frames).
${hasExplicitPalette ? `COLORS (as 0\u20131 RGBA arrays): ${palette.map((c) => {
    const r = parseInt(c.slice(1, 3), 16) / 255, g = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255;
    return `[${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)},1]`;
  }).join(", ")}` : "COLORS: Choose colors that suit the animation content."}

${personality}

CRITICAL \u2014 KEYFRAME EASING HANDLES:
Every animated keyframe (except the final one) MUST include bezier easing handles.
Use the easing curves from the MOTION PERSONALITY section above. Example for 1D properties:
  "i": {"x":[0.58],"y":[1]}, "o": {"x":[0.42],"y":[0]}
For 3D properties (position, scale, anchor) use arrays of 3:
  "i": {"x":[0.58,0.58,0.58],"y":[1,1,1]}, "o": {"x":[0.42,0.42,0.42],"y":[0,0,0]}
Without these, lottie-web throws renderFrameError and nothing renders.
NEVER use linear easing (identical i/o values) on position \u2014 it looks robotic.

NARRATIVE STRUCTURE (distribute keyframes across these phases):
- Setup (frames 0-${Math.round(op * 0.25)}): Elements appear, establish positions. Use entrance easing.
- Action (frames ${Math.round(op * 0.25)}-${Math.round(op * 0.65)}): Primary animation. Use emphasis/personality easing.
- Resolution (frames ${Math.round(op * 0.65)}-${op}): Settle to final state. Hold or gentle ambient.

STRUCTURE:
{
  "v": "5.7.1", "fr": 30, "ip": 0, "op": ${op},
  "w": ${W}, "h": ${H}, "nm": "Scene", "ddd": 0, "assets": [],
  "layers": [
    {
      "ddd": 0, "ind": 1, "ty": 4, "nm": "LayerName", "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [960, 540, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "ao": 0,
      "shapes": [
        { "ty": "el", "d": 1, "s": { "a": 0, "k": [200, 200] }, "p": { "a": 0, "k": [0, 0] }, "nm": "E" },
        { "ty": "st", "c": { "a": 0, "k": [R,G,B,1] }, "o": { "a": 0, "k": 100 }, "w": { "a": 0, "k": 4 }, "lc": 2, "lj": 2, "nm": "S" }
      ],
      "ip": 0, "op": ${op}, "st": 0
    }
  ]
}

SHAPE TYPES: "el" (ellipse), "rc" (rect with "r" for radius), "sr" (star/polygon), "sh" (bezier path with "v","i","o","c" arrays), "fl" (fill), "st" (stroke), "tr" (transform), "gr" (group containing shapes + "tr").
LAYER ty: 4 = shape layer, 1 = solid.
ANIMATED PROPERTY: set "a":1 and "k" to keyframe array. Static: "a":0, "k": value.

PATTERN TEMPLATES \u2014 adapt these for your animation (all include proper easing handles):

Entrance (fade + scale up, 1D opacity):
"o": { "a": 1, "k": [
  { "t": 0, "s": [0], "i": {"x":[0.58],"y":[1]}, "o": {"x":[0.42],"y":[0]} },
  { "t": 20, "s": [100] }
]}

Entrance (scale up, 3D):
"s": { "a": 1, "k": [
  { "t": 0, "s": [80, 80, 100], "i": {"x":[0.58,0.58,0.58],"y":[1,1,1]}, "o": {"x":[0.42,0.42,0.42],"y":[0,0,0]} },
  { "t": 20, "s": [100, 100, 100] }
]}

Exit (fade + scale down, 1D opacity):
"o": { "a": 1, "k": [
  { "t": ${op - 20}, "s": [100], "i": {"x":[1],"y":[1]}, "o": {"x":[0.42],"y":[0]} },
  { "t": ${op}, "s": [0] }
]}

Pulse emphasis (scale 100 -> 110 -> 100):
"s": { "a": 1, "k": [
  { "t": 30, "s": [100,100,100], "i": {"x":[0.58,0.58,0.58],"y":[1,1,1]}, "o": {"x":[0.16,0.16,0.16],"y":[1,1,1]} },
  { "t": 40, "s": [110,110,100], "i": {"x":[0.58,0.58,0.58],"y":[1,1,1]}, "o": {"x":[0.3,0.3,0.3],"y":[1,1,1]} },
  { "t": 50, "s": [100,100,100] }
]}

GOOD SUBJECTS: icons, logos, geometric patterns, looping decorative elements, simple character animations, data viz transitions, micro-interactions.

QUALITY:
- Use intentional movement paths \u2014 arcs and curves, not just linear slides.
- Asymmetric timing: fast start with slow settle, or delayed secondary motion after primary.
- Two-property sweet spot: combine position+opacity for entrances, scale+color for emphasis.
- Stagger secondary elements 50-100ms after the primary action.
- Exit animations should be 75% of entrance duration.
${getDesignPrinciples(dims)}
Previous scene summary (for visual continuity): ${previousSummary || "none"}`;
};
var REACT_SYSTEM_PROMPT = (palette, font, bgColor, duration, previousSummary, hasExplicitPalette = true, dims = { width: 1920, height: 1080 }) => {
  const W = dims.width;
  const H = dims.height;
  return `You are an expert React animation developer creating video scenes for Cench Studio. You write React components that render deterministic, frame-based animations using the CenchReact SDK (Remotion-style).

## OUTPUT FORMAT
Return a JSON object with these fields:
- "sceneCode": JSX code that exports a default React component
- "styles": Optional CSS string for additional styling

## AVAILABLE APIs (injected as globals \u2014 do NOT import them)

### Core hooks
- \`useCurrentFrame()\` \u2014 returns current integer frame number
- \`useVideoConfig()\` \u2014 returns \`{ fps, width, height, durationInFrames }\`

### Animation utilities
- \`interpolate(value, inputRange, outputRange, options?)\` \u2014 map a value between ranges
  - options: \`{ extrapolateLeft: 'clamp'|'extend', extrapolateRight: 'clamp'|'extend', easing: fn }\`
  - Example: \`interpolate(frame, [0, 30], [0, 1])\` \u2014 fade in over 30 frames
- \`spring({ frame, fps, config?, from?, to? })\` \u2014 spring-based animation
  - config: \`{ damping, mass, stiffness, overshootClamping }\`
  - Example: \`spring({ frame: frame - 15, fps, config: { damping: 12 } })\`
- \`Easing.ease\`, \`Easing.easeIn\`, \`Easing.easeOut\`, \`Easing.easeInOut\`, \`Easing.bezier(x1,y1,x2,y2)\`

### Layout components
- \`<AbsoluteFill style={{...}}>\` \u2014 full-frame absolute positioning div
- \`<Sequence from={30} durationInFrames={60}>\` \u2014 timing container, children see local frame starting at 0

### Bridge components (for imperative renderers)
- \`<Canvas2DLayer draw={(ctx, frame, config) => {...}} />\` \u2014 2D canvas drawing
- \`<ThreeJSLayer setup={(THREE, scene, cam, renderer) => {...}} update={(scene, cam, frame) => {...}} />\` \u2014 Three.js 3D
- \`<D3Layer setup={(d3, el, config) => {...}} update={(d3, el, frame, config) => {...}} />\` \u2014 D3 data viz
- \`<SVGLayer viewBox="0 0 ${W} ${H}" setup={(svgEl, gsap, tl) => {...}}>{children}</SVGLayer>\` \u2014 SVG with GSAP
- \`<LottieLayer data={lottieJSON} />\` \u2014 Lottie animation synced to frame

### Interactivity hooks (for interactive/branching scenes)
- \`useVariable(name, defaultValue)\` \u2014 reactive state synced with parent player
  - Returns \`[value, setValue]\` like useState
  - Value persists across scenes and is visible to the parent player
  - Example: \`const [score, setScore] = useVariable('score', 0)\`
  - Use for: counters, user selections, form values, any state the viewer controls
- \`useInteraction(elementId)\` \u2014 click/hover handlers for interactive elements
  - Returns \`{ handlers, isHovered, isClicked }\`
  - Spread \`handlers\` on any element: \`<div {...btn.handlers}>\`
  - Hover/click state drives visual feedback (scale, opacity, color changes)
  - Example: \`const btn = useInteraction('cta-button')\`
  - Use for: clickable cards, hoverable chart elements, interactive 3D objects
- \`useTrigger(name)\` \u2014 fire named events to the parent player
  - Returns \`{ fire(payload), onFired(callback) }\`
  - Example: \`const reveal = useTrigger('show-details'); reveal.fire({ section: 'pricing' })\`

### When to use interactivity hooks
- Use useVariable when the viewer needs to control a value that affects the scene (slider-driven charts, toggle-driven visibility, score tracking)
- Use useInteraction when elements should respond to hover/click with visual feedback AND notify the parent
- Use useTrigger for one-shot events (completed quiz, reached milestone)
- Animation state should still be frame-based (useCurrentFrame + interpolate). Interactivity hooks are for VIEWER INPUT, not animation.

### Scene globals (available as window vars)
- \`PALETTE\`, \`DURATION\`, \`FONT\`, \`WIDTH\`, \`HEIGHT\`, \`ROUGHNESS\`, \`STROKE_COLOR\`

## EXAMPLE

\`\`\`jsx
export default function Scene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1]);
  const titleY = interpolate(frame, [0, 30], [50, 0], { easing: Easing.easeOut });
  const scale = spring({ frame: frame - 10, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ background: PALETTE[0], fontFamily: FONT }}>
      <div style={{
        position: 'absolute', top: '20%', width: '100%', textAlign: 'center',
        opacity: titleOpacity, transform: \\\`translateY(\\\${titleY}px) scale(\\\${scale})\\\`,
        fontSize: 80, color: PALETTE[3], fontWeight: 700,
      }}>
        Hello World
      </div>
      <Sequence from={60} durationInFrames={120}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <SubContent />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

function SubContent() {
  const frame = useCurrentFrame(); // local frame (0-based within Sequence)
  const opacity = interpolate(frame, [0, 20], [0, 1]);
  return <p style={{ opacity, fontSize: 48, color: PALETTE[1] }}>Subtitle text</p>;
}
\`\`\`

## ANIMATION RULES
- Animation is a PURE FUNCTION of frame. No useState for animation state.
- Use \`interpolate()\` and \`spring()\` \u2014 NOT manual lerp functions.
- useEffect is ONLY for imperative bridge layers (Canvas2D, Three.js), never for animation state.
- NO Math.random \u2014 use deterministic values (index-based, frame-based).
- NO setTimeout, setInterval, requestAnimationFrame for animation.
- All motion derived from frame number via \`useCurrentFrame()\`.
- Use \`<Sequence>\` for temporal composition \u2014 children see a local frame starting at 0.

## STYLING
- Use inline styles (style={{ }}) \u2014 no external CSS classes needed.
- Use \`<AbsoluteFill>\` for full-frame layers that stack via z-index.
${hasExplicitPalette ? `- Palette: ${JSON.stringify(palette)}` : "- Choose a color palette that suits the content."}
- Heading font: "${font}" (use for titles, headings, display text)
- Body font: available as BODY_FONT global (use for paragraphs, descriptions, labels)
- Background: "${bgColor}"
- The canvas is a fixed ${W}\xD7${H}px box with overflow: hidden \u2014 any content outside this area is clipped and invisible. Position all elements within bounds. Use percentage-based or absolute positioning relative to ${W}\xD7${H}.

## CONTENT & DESIGN GUIDELINES
- Create a clear visual hierarchy: one dominant element, supporting elements at smaller scale, fine details.
- Use AbsoluteFill layers for depth through overlapping: background layer, content layer, accent/decorative layers.
- Layout variety: use CSS grid/flexbox within AbsoluteFill for editorial layouts \u2014 split screens, offset grids, text-alongside-visual. Do not default to centered stacks.
- Typography: VIDEO SIZES \u2014 nothing below 24px. Pair bold headline (100-180px) with subtitle (48-72px) and body/labels (32-42px). Labels/annotations minimum 24px. Web-sized text (14-20px) is invisible in video.
- Stagger entrances using Sequence components with 8-15 frame offsets between elements.
- Use spring() for organic motion on key reveals. Use interpolate() with Easing.bezier for controlled motion.
- Leave 20% of duration as a visual hold at the end.
- Total duration: ${duration} seconds at 30fps = ${duration * 30} total frames.

## CAMERA MOTION \u2014 required, but VARY per scene purpose (do NOT default kenBurns on every scene)
Pick the motion that matches what THIS scene is doing. Do not mechanically stamp one motion
across a whole sequence \u2014 that reads as lazy.
\`\`\`jsx
React.useEffect(() => {
  // Title / opening card:
  CenchCamera.presetCinematicPush({ at: 0, duration: DURATION * 0.6 })
  // Static data / receipt / grid \u2014 subtle zoom only:
  // CenchCamera.kenBurns({ duration: DURATION, endScale: 1.02 })
  // Reveal multiple items:
  // CenchCamera.presetReveal({ duration: DURATION * 0.7 })
  // Sign-off / closing:
  // CenchCamera.presetEmphasis({ at: 0.5, duration: DURATION - 0.5 })
  // Focus on one element:
  // CenchCamera.dollyIn({ targetSelector: '#hero', at: 1, duration: 3 })
}, [])
\`\`\`
**Skip CenchCamera entirely** when the scene's content already moves (video playback,
a 3D spin, fast data animation). Stacking camera motion on top of intrinsic motion
causes visual nausea \u2014 a locked camera is correct there.
If three scenes in a row use the same motion, change one.

${getDesignPrinciples(dims)}
Previous scene summary: ${previousSummary || "none"}`;
};

// lib/zdog/animations/presets.ts
function animCall(beat, body) {
  const dur = beat.duration ?? 1.2;
  return `if (t >= ${beat.at} && t <= ${beat.at + dur}) { const local = (t - ${beat.at}) / ${Math.max(dur, 1e-3)}; ${body} }`;
}
function presetCode(preset, beat, ctx) {
  const amp = ctx.formula.motionProfile.idleAmplitude.toFixed(3);
  const gesture = ctx.formula.motionProfile.gestureBias.toFixed(3);
  const walk = ctx.formula.motionProfile.walkAmplitude.toFixed(3);
  const h = ctx.handles;
  switch (preset) {
    case "idleBreath":
      return animCall(
        beat,
        `if (${h.spine}._baseY === undefined) ${h.spine}._baseY = ${h.spine}.translate.y || 0; ${h.spine}.translate.y = ${h.spine}._baseY + Math.sin(local * Math.PI * 2) * 0.45 * ${amp};`
      );
    case "talkNod":
      return animCall(
        beat,
        `${h.head}.rotate.x = Math.sin(local * Math.PI * 4) * 0.2 * ${gesture}; ${h.rightForearm}.rotate.x = 0.2 + Math.sin(local * Math.PI * 4) * 0.05;`
      );
    case "wave":
      return animCall(
        beat,
        `${h.rightUpperArm}.rotate.z = -0.4; ${h.rightForearm}.rotate.x = -0.7 + Math.sin(local * Math.PI * 6) * 0.9 * ${gesture};`
      );
    case "pointLeft":
      return animCall(
        beat,
        `${h.leftUpperArm}.rotate.z = 1.1; ${h.leftForearm}.rotate.x = -0.9; ${h.leftForearm}.rotate.z = 0.15;`
      );
    case "pointRight":
      return animCall(
        beat,
        `${h.rightUpperArm}.rotate.z = -1.1; ${h.rightForearm}.rotate.x = -0.9; ${h.rightForearm}.rotate.z = -0.15;`
      );
    case "present":
      return animCall(
        beat,
        `${h.leftUpperArm}.rotate.z = 0.6; ${h.rightUpperArm}.rotate.z = -0.6; ${h.leftForearm}.rotate.x = -0.4; ${h.rightForearm}.rotate.x = -0.4;`
      );
    case "walkInPlace":
      return animCall(
        beat,
        `if (${h.hips}._baseY === undefined) ${h.hips}._baseY = ${h.hips}.translate.y || 0; ${h.leftUpperLeg}.rotate.x = Math.sin(local * Math.PI * 4) * 0.5 * ${walk}; ${h.rightUpperLeg}.rotate.x = Math.sin(local * Math.PI * 4 + Math.PI) * 0.5 * ${walk}; ${h.hips}.translate.y = ${h.hips}._baseY + Math.sin(local * Math.PI * 8) * 0.2;`
      );
    default:
      return "";
  }
}
function buildPresetAnimationsCode(beats, personRefs) {
  const snippets = [];
  for (const beat of beats) {
    const ctx = personRefs[beat.targetPersonId];
    if (!ctx) continue;
    snippets.push(presetCode(beat.action, beat, ctx));
  }
  return snippets.join("\n");
}

// lib/zdog/core/rng.ts
function mulberry32(seed) {
  let s = seed | 0;
  return function next() {
    s |= 0;
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rng, values) {
  if (values.length === 0) throw new Error("pick() requires non-empty values");
  const idx = Math.floor(rng() * values.length);
  return values[Math.min(values.length - 1, Math.max(0, idx))];
}
function range(rng, min, max) {
  return min + (max - min) * rng();
}

// lib/zdog/formulas/person.ts
var FACE_STYLES = ["friendly", "serious", "curious"];
var HAIR_STYLES = ["curls", "short", "bob", "bun", "flat"];
var EYE_STYLES = ["dot", "almond", "wide"];
var MOUTH_STYLES = ["smile", "neutral", "grin"];
var NOSE_STYLES = ["dot", "line", "button"];
var ACCESSORIES = ["glasses", "tablet", "badge"];
var ZDOG_REFERENCE_DEMO_PALETTE = {
  skin: "#eeaa00",
  hair: "#5c3a1e",
  top: "#cc2255",
  bottom: "#663366",
  accent: "#222222"
};
var PALETTES = [
  ZDOG_REFERENCE_DEMO_PALETTE,
  { skin: "#f2c8a2", hair: "#5a3c2a", top: "#2563eb", bottom: "#334155", accent: "#e84545" },
  { skin: "#d9a47c", hair: "#1f2937", top: "#7c3aed", bottom: "#0f766e", accent: "#f59e0b" },
  { skin: "#f0b58a", hair: "#7f1d1d", top: "#16a34a", bottom: "#1e293b", accent: "#ec4899" }
];
var REF_HTML_HEAD = 12;
function buildProportions(rng) {
  return {
    head: 16,
    torso: range(rng, 9.5, 15),
    upperArm: range(rng, 4.8, 9),
    forearm: range(rng, 4.2, 8),
    upperLeg: range(rng, 6.5, 11),
    lowerLeg: range(rng, 6, 10)
  };
}
var PROPER_SHAPE_MINS = {
  proportions: {
    torso: 10.5,
    upperArm: 5.2,
    forearm: 5,
    upperLeg: 7.2,
    lowerLeg: 6.8
  },
  bodyStyle: {
    torsoWidth: 3.4,
    armThickness: 6.4,
    legThickness: 7.2,
    hipWidth: 3.4
  }
};
function createProperPersonFromSeed(seed) {
  const base = createPersonFormulaFromSeed(seed);
  const p = base.proportions;
  const b = base.bodyStyle ?? {
    torsoWidth: 2.2,
    armThickness: 4.85,
    legThickness: 5,
    hipWidth: 2.8
  };
  const m = PROPER_SHAPE_MINS;
  return mergePersonFormula(base, {
    proportions: {
      head: 16,
      torso: Math.max(p.torso, m.proportions.torso),
      upperArm: Math.max(p.upperArm, m.proportions.upperArm),
      forearm: Math.max(p.forearm, m.proportions.forearm),
      upperLeg: Math.max(p.upperLeg, m.proportions.upperLeg),
      lowerLeg: Math.max(p.lowerLeg, m.proportions.lowerLeg)
    },
    bodyStyle: {
      torsoWidth: Math.max(b.torsoWidth, m.bodyStyle.torsoWidth),
      armThickness: Math.max(b.armThickness, m.bodyStyle.armThickness),
      legThickness: Math.max(b.legThickness, m.bodyStyle.legThickness),
      hipWidth: Math.max(b.hipWidth, m.bodyStyle.hipWidth)
    }
  });
}
function createPersonFormulaFromSeed(seed) {
  const rng = mulberry32(seed);
  const accessoryCount = Math.floor(range(rng, 0, 3));
  const accessories = [];
  for (let i = 0; i < accessoryCount; i += 1) {
    const candidate = pick(rng, ACCESSORIES);
    if (!accessories.includes(candidate)) accessories.push(candidate);
  }
  return {
    seed,
    palette: pick(rng, PALETTES),
    proportions: buildProportions(rng),
    faceStyle: pick(rng, FACE_STYLES),
    hairStyle: pick(rng, HAIR_STYLES),
    hairProfile: {
      size: 1.05,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      offsetX: 0,
      offsetY: 3.52,
      offsetZ: 0
    },
    faceProfile: {
      eyesY: 0,
      noseY: 0,
      mouthY: 0,
      depthZ: 0
    },
    bodyDepth: { hipsZ: 0, spineZ: 0 },
    headProfile: {
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotateY: 0,
      rotateX: 0,
      rotateZ: 0
    },
    eyeStyle: pick(rng, EYE_STYLES),
    mouthStyle: pick(rng, MOUTH_STYLES),
    noseStyle: pick(rng, NOSE_STYLES),
    bodyStyle: {
      torsoWidth: range(rng, 2.6, 5.8),
      armThickness: range(rng, 4.8, 10),
      legThickness: range(rng, 5.2, 11),
      hipWidth: range(rng, 2.6, 5.5)
    },
    accessories,
    motionProfile: {
      idleAmplitude: range(rng, 0.6, 1.2),
      gestureBias: range(rng, 0.5, 1.1),
      walkAmplitude: range(rng, 0.8, 1.3)
    },
    studioBlocks: []
  };
}
function mergePersonFormula(base, overrides) {
  if (!overrides) return base;
  const mergedHead = 16;
  return {
    ...base,
    ...overrides,
    palette: { ...base.palette, ...overrides.palette ?? {} },
    proportions: { ...base.proportions, ...overrides.proportions ?? {}, head: mergedHead },
    motionProfile: { ...base.motionProfile, ...overrides.motionProfile ?? {} },
    bodyStyle: { ...base.bodyStyle ?? {}, ...overrides.bodyStyle ?? {} },
    hairProfile: { ...base.hairProfile ?? {}, ...overrides.hairProfile ?? {} },
    faceProfile: { ...base.faceProfile ?? {}, ...overrides.faceProfile ?? {} },
    headProfile: { ...base.headProfile ?? {}, ...overrides.headProfile ?? {} },
    bodyDepth: {
      hipsZ: 0,
      spineZ: 0,
      ...base.bodyDepth ?? {},
      ...overrides.bodyDepth ?? {}
    },
    accessories: overrides.accessories ?? base.accessories,
    studioBlocks: overrides.studioBlocks !== void 0 ? overrides.studioBlocks : base.studioBlocks
  };
}
function createReferenceDemoPersonFromSeed(seed) {
  const base = createProperPersonFromSeed(seed);
  const h = 16;
  return mergePersonFormula(base, {
    hairStyle: "curls",
    palette: ZDOG_REFERENCE_DEMO_PALETTE,
    proportions: {
      ...base.proportions,
      head: h,
      upperArm: 6 * h / REF_HTML_HEAD,
      forearm: 6 * h / REF_HTML_HEAD,
      upperLeg: 7 * h / REF_HTML_HEAD,
      lowerLeg: 7 * h / REF_HTML_HEAD
    },
    bodyStyle: {
      torsoWidth: 2.2,
      armThickness: 4,
      legThickness: 4,
      hipWidth: 2.8
    },
    hairProfile: {
      size: 1.05,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0
    },
    faceProfile: { eyesY: 0, noseY: 0, mouthY: 0, depthZ: 0 },
    headProfile: { offsetX: 0, offsetY: 0, offsetZ: 0, rotateY: 0, rotateX: 0, rotateZ: 0 },
    bodyDepth: { hipsZ: 0, spineZ: 0 },
    studioBlocks: [],
    accessories: []
  });
}

// lib/zdog/modules/index.ts
function q(v) {
  return JSON.stringify(v);
}
function colorExpr(color, fallback = "PALETTE[0]") {
  if (!color) return fallback;
  return color.startsWith("#") ? q(color) : color;
}
function safeJsId(input) {
  const cleaned = input.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!cleaned) return "id";
  return /^[0-9]/.test(cleaned) ? `id_${cleaned}` : cleaned;
}
function buildBarChart(mod) {
  const data = mod.data && mod.data.length ? mod.data : [3, 5, 4, 7];
  const color = colorExpr(mod.color, "PALETTE[3]");
  const bars = data.map((v, i) => {
    const h = Math.max(2, v * 2.2);
    return `new Zdog.Box({ addTo: module_${mod.id}, width: 3.2, depth: 3.2, height: ${h.toFixed(
      2
    )}, stroke: 0.6, color: ${color}, topFace: ${color}, leftFace: ${color}, rightFace: ${color}, translate: { x: ${(-6 + i * 4).toFixed(2)}, y: ${(-h / 2).toFixed(2)}, z: 0 } });`;
  }).join("\n");
  return `${bars}
new Zdog.Rect({ addTo: module_${mod.id}, width: 20, height: 1.2, stroke: 0.5, color: '#334155', fill: true, translate: { x: 0, y: 1.4, z: -2 } });`;
}
function buildLineChart(mod) {
  const data = mod.data && mod.data.length ? mod.data : [2, 4, 3, 6, 5];
  const path23 = data.map((v, i) => `{ x: ${(-8 + i * 4).toFixed(2)}, y: ${(-v * 1.7).toFixed(2)}, z: 0 }`).join(", ");
  return `new Zdog.Shape({ addTo: module_${mod.id}, path: [${path23}], closed: false, stroke: 1.1, color: ${colorExpr(
    mod.color,
    "PALETTE[2]"
  )} });
new Zdog.Rect({ addTo: module_${mod.id}, width: 20, height: 1.2, stroke: 0.5, color: '#334155', fill: true, translate: { x: 0, y: 1.4, z: -2 } });`;
}
function buildDonutChart(mod) {
  const color = colorExpr(mod.color, "PALETTE[1]");
  return `new Zdog.Ellipse({ addTo: module_${mod.id}, diameter: 12, stroke: 3.5, color: ${color}, fill: false, rotate: { x: Zdog.TAU / 4 } });
new Zdog.Ellipse({ addTo: module_${mod.id}, diameter: 5.2, stroke: 3.4, color: '#fffef9', fill: true, rotate: { x: Zdog.TAU / 4 }, translate: { z: 0.2 } });`;
}
function buildPresentationBoard(mod) {
  return `new Zdog.RoundedRect({ addTo: module_${mod.id}, width: 22, height: 14, cornerRadius: 1.2, stroke: 1.2, color: '#0f172a', fill: true, translate: { z: -1.5 } });
new Zdog.RoundedRect({ addTo: module_${mod.id}, width: 20, height: 12, cornerRadius: 1, stroke: 0.9, color: '#e2e8f0', fill: true, translate: { z: -0.4 } });`;
}
function buildDesk(mod) {
  return `new Zdog.Box({ addTo: module_${mod.id}, width: 20, height: 2, depth: 10, stroke: 0.8, color: '#8b5e3c', fill: true, translate: { y: 1, z: 0 } });
new Zdog.Shape({ addTo: module_${mod.id}, path: [{ x: -8, y: 1, z: -3 }, { x: -8, y: 8, z: -3 }], stroke: 1, color: '#7c4a2e' });
new Zdog.Shape({ addTo: module_${mod.id}, path: [{ x: 8, y: 1, z: -3 }, { x: 8, y: 8, z: -3 }], stroke: 1, color: '#7c4a2e' });`;
}
function buildTablet(mod) {
  return `new Zdog.RoundedRect({ addTo: module_${mod.id}, width: 8, height: 11, cornerRadius: 0.8, stroke: 0.9, color: '#111827', fill: true });
new Zdog.RoundedRect({ addTo: module_${mod.id}, width: 6.8, height: 9.3, cornerRadius: 0.5, stroke: 0.5, color: '#93c5fd', fill: true, translate: { z: 0.4 } });`;
}
function buildModuleCode(modules) {
  return modules.map((mod) => {
    const moduleVar = `module_${safeJsId(mod.id)}`;
    const safeMod = { ...mod, id: safeJsId(mod.id) };
    const header = `const ${moduleVar} = new Zdog.Anchor({ addTo: sceneRoot, translate: { x: ${mod.x}, y: ${mod.y}, z: ${mod.z} }, scale: ${mod.scale ?? 1} });`;
    let body = "";
    if (mod.type === "barChart") body = buildBarChart(safeMod);
    else if (mod.type === "lineChart") body = buildLineChart(safeMod);
    else if (mod.type === "donutChart") body = buildDonutChart(safeMod);
    else if (mod.type === "presentationBoard") body = buildPresentationBoard(safeMod);
    else if (mod.type === "desk") body = buildDesk(safeMod);
    else if (mod.type === "tablet") body = buildTablet(safeMod);
    return `${header}
${body}`;
  }).join("\n\n");
}

// lib/zdog/rigs/person.ts
function safeJsId2(input) {
  const cleaned = input.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!cleaned) return "id";
  return /^[0-9]/.test(cleaned) ? `id_${cleaned}` : cleaned;
}
function q2(v) {
  return JSON.stringify(v);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function buildPersonRigCode(personId, formula, placement) {
  const p = formula.proportions;
  const pal = formula.palette;
  const id = safeJsId2(personId);
  const root = `person_${id}_root`;
  const spine = `person_${id}_spine`;
  const head = `person_${id}_head`;
  const lUpper = `person_${id}_lUpperArm`;
  const lFore = `person_${id}_lForearm`;
  const rUpper = `person_${id}_rUpperArm`;
  const rFore = `person_${id}_rForearm`;
  const hips = `person_${id}_hips`;
  const lLeg = `person_${id}_lLeg`;
  const rLeg = `person_${id}_rLeg`;
  const accessories = new Set(formula.accessories);
  const body = formula.bodyStyle ?? {
    torsoWidth: 2.2,
    armThickness: 4.85,
    legThickness: 5,
    hipWidth: 2.8
  };
  const k = p.head / 12;
  const bdRaw = formula.bodyDepth ?? { hipsZ: 0, spineZ: 0 };
  const bd = { hipsZ: clamp(bdRaw.hipsZ, -10, 10), spineZ: clamp(bdRaw.spineZ, -10, 10) };
  const hipHalf = 3 * k * (body.hipWidth / 2.8);
  const chestHalf = 1.5 * k * (body.torsoWidth / 2.2);
  const hipLineStroke = Math.max(2.2, 4 * k * (body.legThickness / 5));
  const chestStroke = Math.max(5, 9 * k * (body.torsoWidth / 2.2));
  const thighLen = Math.max(3, k * p.upperLeg);
  const shinLen = Math.max(3, k * p.lowerLeg);
  const armUpperLen = Math.max(3, k * p.upperArm);
  const armForeLen = Math.max(2.5, k * p.forearm);
  const hipX = Math.max(2, hipHalf * 0.95);
  const legStroke = Math.max(2.5, 4 * k * (body.legThickness / 5));
  const shinStroke = Math.max(2.2, 3.5 * k * (body.legThickness / 5));
  const armStroke = Math.max(2.5, 4 * k * (body.armThickness / 4.85));
  const handStroke = Math.max(4, 6 * k * (body.armThickness / 4.85));
  const footW = Math.max(1.5, 2 * k);
  const footH = Math.max(3, 4 * k);
  const footStroke = Math.max(2.5, 4 * k);
  const chestY = -6.5 * k;
  const headY = -9.5 * k;
  const armAttachY = -2 * k;
  const armSideX = 5 * k * (body.torsoWidth / 2.2);
  const hipsBaseY = 2 * k;
  const hp = formula.headProfile ?? { offsetX: 0, offsetY: 0, offsetZ: 0, rotateY: 0 };
  const headYaw = (hp.rotateY ?? 0).toFixed(3);
  const headRotX = (hp.rotateX ?? 0).toFixed(3);
  const headRotZ = (hp.rotateZ ?? 0).toFixed(3);
  const hox = hp.offsetX.toFixed(2);
  const hoy = hp.offsetY.toFixed(2);
  const hoz = hp.offsetZ.toFixed(2);
  const hair = formula.hairProfile ?? {
    size: 1.05,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    offsetX: 0,
    offsetY: 3.52,
    offsetZ: 0
  };
  const hairVisualSize = clamp(hair.size, 0.35, 5.5) * 1.02;
  const hairOffsetX = clamp(hair.offsetX, -6, 6);
  const hairOffsetY = clamp(hair.offsetY, -12, 12);
  const hairOffsetZ = clamp(hair.offsetZ, -6, 6);
  const hairBaseY = -p.head * 0.29;
  const face = formula.faceProfile ?? { eyesY: 0, noseY: 0, mouthY: 0, depthZ: 0 };
  const eyeXOff = clamp(face.eyesX ?? 0, -5, 5);
  const faceDepth = clamp(face.depthZ, -4, 4);
  const eyeZ = (4.5 * k + faceDepth + clamp(face.eyesZ ?? 0, -4, 4)).toFixed(2);
  const mouthZ = (4.5 * k + faceDepth + clamp(face.mouthZ ?? 0, -4, 4)).toFixed(2);
  const noseZ = (4.5 * k + faceDepth + clamp(face.noseZ ?? 0, -4, 4)).toFixed(2);
  const eyeY = ((formula.faceStyle === "serious" ? 0.67 : 1) + clamp(face.eyesY, -4, 4) * 0.12) * k;
  const mouthY = (2.5 + clamp(face.mouthY, -4, 4) * 0.12) * k;
  const noseY = (1.5 + clamp(face.noseY, -4, 4) * 0.12) * k;
  const noseXNum = clamp(face.noseX ?? 0, -3, 3);
  const mouthXNum = clamp(face.mouthX ?? 0, -3, 3);
  const leftEyeX = (-2 + eyeXOff) * k;
  const rightEyeX = (2 + eyeXOff) * k;
  const eyeStyle = formula.eyeStyle ?? "almond";
  const mouthStyle = formula.mouthStyle ?? "smile";
  const noseStyle = formula.noseStyle ?? "line";
  const eyeDiam = (eyeStyle === "wide" ? 2.72 : 2.2) * k;
  const eyeStrokeW = (eyeStyle === "wide" ? 0.88 : 0.72) * Math.max(0.85, k);
  const leftEye = eyeStyle === "dot" ? `new Zdog.Shape({ addTo: ${head}, stroke: ${(0.85 * k).toFixed(2)}, color: '#111827', translate: { x: ${leftEyeX.toFixed(2)}, y: ${eyeY}, z: ${eyeZ} }, backface: false });` : `new Zdog.Ellipse({ addTo: ${head}, diameter: ${eyeDiam.toFixed(2)}, quarters: 2, translate: { x: ${leftEyeX.toFixed(2)}, y: ${eyeY}, z: ${eyeZ} }, rotate: { z: -Zdog.TAU/4 }, color: '#1f2937', stroke: ${eyeStrokeW.toFixed(2)}, backface: false });`;
  const rightEye = eyeStyle === "dot" ? `new Zdog.Shape({ addTo: ${head}, stroke: ${(0.85 * k).toFixed(2)}, color: '#111827', translate: { x: ${rightEyeX.toFixed(2)}, y: ${eyeY}, z: ${eyeZ} }, backface: false });` : `new Zdog.Ellipse({ addTo: ${head}, diameter: ${eyeDiam.toFixed(2)}, quarters: 2, translate: { x: ${rightEyeX.toFixed(2)}, y: ${eyeY}, z: ${eyeZ} }, rotate: { z: -Zdog.TAU/4 }, color: '#1f2937', stroke: ${eyeStrokeW.toFixed(2)}, backface: false });`;
  const mouth = mouthStyle === "neutral" ? `new Zdog.Shape({ addTo: ${head}, path: [{ x: ${(-1.1 * k + mouthXNum).toFixed(2)}, y: ${mouthY}, z: ${mouthZ} }, { x: ${(1.1 * k + mouthXNum).toFixed(2)}, y: ${mouthY}, z: ${mouthZ} }], stroke: ${(0.5 * k).toFixed(2)}, color: '#ffffff', backface: false });` : `new Zdog.Ellipse({ addTo: ${head}, diameter: ${((mouthStyle === "grin" ? 3.6 : 3) * k).toFixed(2)}, quarters: 2, translate: { x: ${mouthXNum.toFixed(2)}, y: ${mouthY}, z: ${mouthZ} }, rotate: { z: Zdog.TAU/4 }, closed: true, color: '#ffffff', stroke: ${((mouthStyle === "grin" ? 0.7 : 0.5) * k).toFixed(2)}, fill: true, backface: false });`;
  const nose = noseStyle === "dot" ? `new Zdog.Shape({ addTo: ${head}, stroke: ${(0.5 * k).toFixed(2)}, color: '#b08968', translate: { x: ${noseXNum.toFixed(2)}, y: ${noseY}, z: ${noseZ} }, backface: false });` : noseStyle === "button" ? `new Zdog.Ellipse({ addTo: ${head}, diameter: ${(0.9 * k).toFixed(2)}, stroke: ${(0.2 * k).toFixed(2)}, color: '#b08968', fill: true, translate: { x: ${noseXNum.toFixed(2)}, y: ${noseY}, z: ${noseZ} }, backface: false });` : `new Zdog.Shape({ addTo: ${head}, path: [{ x: ${noseXNum.toFixed(2)}, y: ${(noseY - 0.5 * k).toFixed(2)}, z: ${noseZ} }, { x: ${noseXNum.toFixed(2)}, y: ${(noseY + 0.25 * k).toFixed(2)}, z: ${noseZ} }], stroke: ${(0.35 * k).toFixed(2)}, color: '#b08968', backface: false });`;
  const hairCode = (() => {
    if (formula.hairStyle === "curls") {
      const curlD = 5 * k * hairVisualSize;
      const hc = q2(pal.hair);
      const curls = [
        [0, -7, 0],
        [-2.5, -6.5, 1.5],
        [2.5, -6.5, 1.5],
        [-1.5, -6.5, -1.5],
        [1.5, -6.5, -1.5],
        [0, -6, 3],
        [-3, -6, 0],
        [3, -6, 0],
        [0, -6, -3]
      ];
      return curls.map(([cx, cy, cz]) => {
        const tx = cx * k + hairOffsetX;
        const ty = cy * k + hairOffsetY;
        const tz = cz * k + hairOffsetZ;
        return `new Zdog.Hemisphere({
  addTo: ${head},
  diameter: ${curlD.toFixed(2)},
  stroke: false,
  color: ${hc},
  backface: ${hc},
  translate: { x: ${tx.toFixed(2)}, y: ${ty.toFixed(2)}, z: ${tz.toFixed(2)} },
  rotate: { x: Zdog.TAU/2 },
});`;
      }).join("\n");
    }
    const domeD = p.head * 0.95 * hairVisualSize;
    const TAU = Math.PI * 2;
    const rx = (TAU / 4 - 0.06 + clamp(hair.rotateX, -1.2, 1.2)).toFixed(3);
    const ry = clamp(hair.rotateY, -1.2, 1.2).toFixed(3);
    const rz = clamp(hair.rotateZ, -1.2, 1.2).toFixed(3);
    return `new Zdog.Hemisphere({
  addTo: ${head},
  diameter: ${domeD.toFixed(2)},
  stroke: ${(0.45 * k).toFixed(2)},
  color: ${q2(pal.hair)},
  translate: { x: ${hairOffsetX.toFixed(2)}, y: ${(hairBaseY + hairOffsetY).toFixed(2)}, z: ${hairOffsetZ.toFixed(2)} },
  rotate: { x: ${rx}, y: ${ry}, z: ${rz} },
  backface: ${q2(pal.hair)},
});`;
  })();
  const code = `
// Person rig ${id} (compact): hips \u2192 spine \u2192 chest \u2192 head/arms; legs on hips.
const ${root} = new Zdog.Anchor({
  addTo: sceneRoot,
  translate: { x: ${placement.x}, y: ${placement.y}, z: ${placement.z} },
  rotate: { y: ${placement.rotationY ?? 0} },
  scale: ${placement.scale ?? 1},
});

const ${hips} = new Zdog.Anchor({
  addTo: ${root},
  translate: { y: ${hipsBaseY.toFixed(2)}, z: ${bd.hipsZ.toFixed(2)} },
});
new Zdog.Shape({
  addTo: ${hips},
  path: [{ x: -${hipHalf.toFixed(2)} }, { x: ${hipHalf.toFixed(2)} }],
  stroke: ${hipLineStroke.toFixed(2)},
  color: ${q2(pal.bottom)},
});

const ${spine} = new Zdog.Anchor({
  addTo: ${hips},
  translate: { z: ${bd.spineZ.toFixed(2)} },
});

const person_${id}_chest = new Zdog.Shape({
  addTo: ${spine},
  path: [{ x: -${chestHalf.toFixed(2)} }, { x: ${chestHalf.toFixed(2)} }],
  translate: { y: ${chestY.toFixed(2)} },
  stroke: ${chestStroke.toFixed(2)},
  color: ${q2(pal.top)},
});

const person_${id}_headAnchor = new Zdog.Anchor({
  addTo: person_${id}_chest,
  translate: { x: ${hox}, y: ${(headY + hp.offsetY).toFixed(2)}, z: ${hoz} },
  rotate: { x: ${headRotX}, y: ${headYaw}, z: ${headRotZ} },
});
const ${head} = new Zdog.Shape({
  addTo: person_${id}_headAnchor,
  stroke: ${p.head.toFixed(2)},
  color: ${q2(pal.skin)},
});
${leftEye}
${rightEye}
${mouth}
${nose}
${hairCode}
${accessories.has("glasses") ? `new Zdog.Ellipse({ addTo: ${head}, diameter: ${(4 * k).toFixed(2)}, stroke: ${(0.5 * k).toFixed(2)}, color: '#111827', translate: { x: ${leftEyeX.toFixed(2)}, y: ${Number(eyeY).toFixed(2)}, z: ${eyeZ} }, fill: false, backface: false });
new Zdog.Ellipse({ addTo: ${head}, diameter: ${(4 * k).toFixed(2)}, stroke: ${(0.5 * k).toFixed(2)}, color: '#111827', translate: { x: ${rightEyeX.toFixed(2)}, y: ${Number(eyeY).toFixed(2)}, z: ${eyeZ} }, fill: false, backface: false });` : ""}

const ${lUpper} = new Zdog.Shape({
  addTo: person_${id}_chest,
  path: [{ y: 0 }, { y: ${armUpperLen.toFixed(2)} }],
  translate: { x: -${armSideX.toFixed(2)}, y: ${armAttachY.toFixed(2)} },
  stroke: ${armStroke.toFixed(2)},
  color: ${q2(pal.top)},
});
const ${lFore} = new Zdog.Shape({
  addTo: ${lUpper},
  path: [{ y: 0 }, { y: ${armForeLen.toFixed(2)} }],
  translate: { y: ${armUpperLen.toFixed(2)} },
  stroke: ${armStroke.toFixed(2)},
  color: ${q2(pal.skin)},
});
new Zdog.Shape({
  addTo: ${lFore},
  stroke: ${handStroke.toFixed(2)},
  color: ${q2(pal.skin)},
  translate: { y: ${(armForeLen + handStroke * 0.35).toFixed(2)}, z: ${(1 * k).toFixed(2)} },
});

const ${rUpper} = new Zdog.Shape({
  addTo: person_${id}_chest,
  path: [{ y: 0 }, { y: ${armUpperLen.toFixed(2)} }],
  translate: { x: ${armSideX.toFixed(2)}, y: ${armAttachY.toFixed(2)} },
  stroke: ${armStroke.toFixed(2)},
  color: ${q2(pal.top)},
});
const ${rFore} = new Zdog.Shape({
  addTo: ${rUpper},
  path: [{ y: 0 }, { y: ${armForeLen.toFixed(2)} }],
  translate: { y: ${armUpperLen.toFixed(2)} },
  stroke: ${armStroke.toFixed(2)},
  color: ${q2(pal.skin)},
});
new Zdog.Shape({
  addTo: ${rFore},
  stroke: ${handStroke.toFixed(2)},
  color: ${q2(pal.skin)},
  translate: { y: ${(armForeLen + handStroke * 0.35).toFixed(2)}, z: ${(1 * k).toFixed(2)} },
});

const ${lLeg} = new Zdog.Anchor({ addTo: ${hips}, translate: { x: -${hipX.toFixed(2)} } });
new Zdog.Shape({
  addTo: ${lLeg},
  path: [{ y: 0 }, { y: ${thighLen.toFixed(2)} }],
  stroke: ${legStroke.toFixed(2)},
  color: ${q2(pal.bottom)},
});
const person_${id}_lShin = new Zdog.Anchor({ addTo: ${lLeg}, translate: { y: ${thighLen.toFixed(2)} } });
new Zdog.Shape({
  addTo: person_${id}_lShin,
  path: [{ y: 0 }, { y: ${shinLen.toFixed(2)} }],
  stroke: ${shinStroke.toFixed(2)},
  color: ${q2(pal.bottom)},
});
new Zdog.RoundedRect({
  addTo: person_${id}_lShin,
  width: ${footW.toFixed(2)},
  height: ${footH.toFixed(2)},
  cornerRadius: 1,
  translate: { y: ${(shinLen + footH * 0.5).toFixed(2)}, z: ${(2 * k).toFixed(2)} },
  rotate: { x: Zdog.TAU/4 },
  color: ${q2(pal.accent)},
  fill: true,
  stroke: ${footStroke.toFixed(2)},
});

const ${rLeg} = new Zdog.Anchor({ addTo: ${hips}, translate: { x: ${hipX.toFixed(2)} } });
new Zdog.Shape({
  addTo: ${rLeg},
  path: [{ y: 0 }, { y: ${thighLen.toFixed(2)} }],
  stroke: ${legStroke.toFixed(2)},
  color: ${q2(pal.bottom)},
});
const person_${id}_rShin = new Zdog.Anchor({ addTo: ${rLeg}, translate: { y: ${thighLen.toFixed(2)} } });
new Zdog.Shape({
  addTo: person_${id}_rShin,
  path: [{ y: 0 }, { y: ${shinLen.toFixed(2)} }],
  stroke: ${shinStroke.toFixed(2)},
  color: ${q2(pal.bottom)},
});
new Zdog.RoundedRect({
  addTo: person_${id}_rShin,
  width: ${footW.toFixed(2)},
  height: ${footH.toFixed(2)},
  cornerRadius: 1,
  translate: { y: ${(shinLen + footH * 0.5).toFixed(2)}, z: ${(2 * k).toFixed(2)} },
  rotate: { x: Zdog.TAU/4 },
  color: ${q2(pal.accent)},
  fill: true,
  stroke: ${footStroke.toFixed(2)},
});

${accessories.has("badge") ? `new Zdog.Rect({ addTo: ${spine}, width: ${(2.4 * k).toFixed(2)}, height: ${(2.8 * k).toFixed(2)}, stroke: ${(0.8 * k).toFixed(2)}, color: ${q2(pal.accent)}, fill: true, translate: { x: ${(1.8 * k).toFixed(2)}, y: ${(chestY - 1.5 * k).toFixed(2)}, z: ${(2.2 * k).toFixed(2)} } });` : ""}
${accessories.has("tablet") ? `new Zdog.RoundedRect({ addTo: ${rFore}, width: ${(2.6 * k).toFixed(2)}, height: ${(3.6 * k).toFixed(2)}, cornerRadius: ${(0.4 * k).toFixed(2)}, stroke: ${(0.8 * k).toFixed(2)}, color: '#111827', fill: true, translate: { y: ${(armForeLen + 1.4 * k).toFixed(2)}, z: ${(2.2 * k).toFixed(2)} }, rotate: { x: -0.25, y: -0.2 } });` : ""}
`;
  return {
    code,
    handles: {
      root,
      spine,
      head,
      leftUpperArm: lUpper,
      leftForearm: lFore,
      rightUpperArm: rUpper,
      rightForearm: rFore,
      hips,
      leftUpperLeg: lLeg,
      rightUpperLeg: rLeg
    }
  };
}

// lib/zdog/scene-match.ts
var ZDOG_SCENE = {
  width: 1920,
  height: 1080,
  /**
   * Canvas zoom (reference demo uses ~6 on a 400px-wide canvas). Prefer this over huge
   * `Anchor.scale` on the person root — scale stretches path points more than stroke width
   * (see Zdog Shape.transform), which reads as “twig” limbs.
   */
  illustrationZoom: 9,
  /**
   * Default rig placement for person roots (character builder + composed scenes).
   * Keep person root scale at 1 when possible; use `illustrationZoom` for framing.
   */
  matchPlacement: { y: 44, scale: 1 }
};

// lib/zdog/studio-blocks.ts
function safeJsId3(input) {
  const cleaned = input.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!cleaned) return "id";
  return /^[0-9]/.test(cleaned) ? `id_${cleaned}` : cleaned;
}
function personRootVariableName(personId) {
  return `person_${safeJsId3(personId)}_root`;
}
function q3(s) {
  return JSON.stringify(s);
}
function buildStudioBlocksCode(blocks, attachToRootVar) {
  if (!blocks?.length) return "";
  const parts = [];
  for (const b of blocks) {
    const c = q3(b.color);
    const tx = b.x;
    const ty = b.y;
    const tz = b.z;
    const rx = b.rotateX;
    const ry = b.rotateY;
    const rz = b.rotateZ;
    if (b.kind === "box") {
      const w = Math.max(0.25, b.w);
      const h = Math.max(0.25, b.h);
      const d = Math.max(0.25, b.d);
      parts.push(`new Zdog.Box({
  addTo: ${attachToRootVar},
  width: ${w},
  height: ${h},
  depth: ${d},
  translate: { x: ${tx}, y: ${ty}, z: ${tz} },
  rotate: { x: ${rx}, y: ${ry}, z: ${rz} },
  stroke: false,
  color: ${c},
});`);
    } else if (b.kind === "sphere") {
      const stroke = Math.max(0.5, b.w);
      parts.push(`new Zdog.Shape({
  addTo: ${attachToRootVar},
  stroke: ${stroke},
  translate: { x: ${tx}, y: ${ty}, z: ${tz} },
  rotate: { x: ${rx}, y: ${ry}, z: ${rz} },
  color: ${c},
});`);
    } else {
      const diam = Math.max(0.5, b.w);
      const length = Math.max(0.5, b.d);
      const str = Math.max(0.5, b.stroke ?? 2.5);
      parts.push(`new Zdog.Cylinder({
  addTo: ${attachToRootVar},
  diameter: ${diam},
  length: ${length},
  stroke: ${str},
  translate: { x: ${tx}, y: ${ty}, z: ${tz} },
  rotate: { x: ${rx}, y: ${ry}, z: ${rz} },
  color: ${c},
});`);
    }
  }
  return parts.join("\n");
}

// lib/zdog/composer/index.ts
function composeDeterministicZdogScene(spec, options) {
  const duration = Math.max(1, options.duration || 8);
  const peopleCode = [];
  const peopleCtx = {};
  for (let i = 0; i < spec.people.length; i += 1) {
    const person = spec.people[i];
    const base = createReferenceDemoPersonFromSeed(spec.seed + i * 101);
    const formula = mergePersonFormula(base, person.formula);
    const rig = buildPersonRigCode(person.id, formula, person.placement);
    const blocks = buildStudioBlocksCode(formula.studioBlocks, personRootVariableName(person.id));
    peopleCode.push(blocks ? `${rig.code}
${blocks}` : rig.code);
    peopleCtx[person.id] = { handles: rig.handles, formula, personId: person.id };
  }
  const modulesCode = buildModuleCode(spec.modules);
  const beatCode = buildPresetAnimationsCode(spec.beats, peopleCtx);
  return `
const canvas = document.getElementById('zdog-canvas');
const illo = new Zdog.Illustration({
  element: canvas,
  zoom: ${ZDOG_SCENE.illustrationZoom},
  dragRotate: false,
  resize: false,
  width: WIDTH,
  height: HEIGHT,
});
const sceneRoot = new Zdog.Anchor({ addTo: illo });

${modulesCode}

${peopleCode.join("\n\n")}

const sceneState = { t: 0 };
window.__tl.to(sceneState, {
  t: ${duration},
  duration: ${duration},
  ease: 'none',
  onUpdate: function() {
    const t = sceneState.t;
    sceneRoot.rotate.y = Math.sin(t * 0.25) * 0.22;
    ${beatCode}
    illo.updateRenderGraph();
  },
}, 0);

illo.updateRenderGraph();
`;
}

// lib/generation/generate.ts
var anthropicClient = new import_sdk.default();
var openaiClient = null;
var googleClient = null;
var localClients = /* @__PURE__ */ new Map();
function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = require("openai").default;
    openaiClient = new OpenAI();
  }
  return openaiClient;
}
function getGoogleClient() {
  if (!googleClient) {
    const { GoogleGenAI } = require("@google/genai");
    googleClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
  }
  return googleClient;
}
function getLocalClient(endpoint) {
  if (!localClients.has(endpoint)) {
    const OpenAI = require("openai").default;
    localClients.set(endpoint, new OpenAI({ baseURL: `${endpoint}/v1`, apiKey: "ollama" }));
  }
  return localClients.get(endpoint);
}
var MAX_TOKENS_BY_TYPE = {
  svg: 12288,
  canvas2d: 16384,
  d3: 5120,
  three: 5120,
  motion: 5120,
  lottie: 4096,
  zdog: 4096,
  react: 8192
};
var TIER_GEN_MODELS = {
  budget: "claude-haiku-4-5-20251001",
  auto: "claude-sonnet-4-6",
  premium: "claude-opus-4-6"
};
async function generateCode(layerType, prompt, options, projectId) {
  const {
    palette,
    bgColor = "#181818",
    duration = 8,
    font,
    strokeWidth = 2,
    previousSummary = "",
    d3Data,
    modelId: requestedModel,
    modelTier = "auto"
  } = options;
  const effectivePalette = palette ?? ["#f0ece0", "#e84545", "#4595e8", "#45e87a"];
  const effectiveFont = font ?? "Inter";
  const hasExplicitPalette = palette != null && palette.length > 0;
  if (layerType === "zdog" && options.zdogComposedSpec) {
    const composedCode = composeDeterministicZdogScene(options.zdogComposedSpec, { duration });
    return {
      code: composedCode,
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      truncated: false
    };
  }
  const model = requestedModel ?? TIER_GEN_MODELS[modelTier] ?? "claude-sonnet-4-6";
  const maxTokens = MAX_TOKENS_BY_TYPE[layerType] ?? 6144;
  let systemPrompt;
  let userContent = prompt;
  switch (layerType) {
    case "svg":
      systemPrompt = SVG_SYSTEM_PROMPT(
        effectivePalette,
        strokeWidth,
        effectiveFont,
        duration,
        previousSummary,
        hasExplicitPalette
      );
      break;
    case "canvas2d":
      systemPrompt = CANVAS_SYSTEM_PROMPT(effectivePalette, bgColor, duration, previousSummary, hasExplicitPalette);
      break;
    case "d3":
      systemPrompt = D3_SYSTEM_PROMPT(
        effectivePalette,
        effectiveFont,
        bgColor,
        duration,
        previousSummary,
        hasExplicitPalette
      );
      if (d3Data) {
        userContent = `${prompt}

Existing data to visualize:
${JSON.stringify(d3Data, null, 2)}`;
      }
      break;
    case "three":
      systemPrompt = THREE_SYSTEM_PROMPT(effectivePalette, bgColor, duration, previousSummary, hasExplicitPalette);
      break;
    case "motion":
      systemPrompt = MOTION_SYSTEM_PROMPT(
        effectivePalette,
        effectiveFont,
        bgColor,
        duration,
        previousSummary,
        hasExplicitPalette
      );
      break;
    case "lottie":
      systemPrompt = LOTTIE_OVERLAY_PROMPT(
        effectivePalette,
        effectiveFont,
        duration,
        previousSummary,
        hasExplicitPalette
      );
      break;
    case "zdog":
      systemPrompt = ZDOG_SYSTEM_PROMPT(effectivePalette, bgColor, duration, previousSummary, hasExplicitPalette);
      break;
    case "react":
      systemPrompt = REACT_SYSTEM_PROMPT(
        effectivePalette,
        effectiveFont,
        bgColor,
        duration,
        previousSummary,
        hasExplicitPalette
      );
      break;
    default:
      throw new Error(`Unknown layer type: ${layerType}`);
  }
  const provider = getModelProvider(model, options.modelConfigs);
  console.log(
    `[generateCode] Start: type=${layerType} model=${model} provider=${provider} prompt="${prompt.slice(0, 120)}"`
  );
  let raw;
  let inputTokens;
  let outputTokens;
  let truncated;
  if (provider === "local") {
    const localConfig = options.modelConfigs?.find((m) => m.id === model || m.modelId === model);
    const endpoint = localConfig?.endpoint ?? process.env.OLLAMA_ENDPOINT ?? "http://localhost:11434";
    const localModelName = localConfig?.localModelName ?? model;
    ({ raw, inputTokens, outputTokens, truncated } = await callLocal(
      endpoint,
      localModelName,
      systemPrompt,
      userContent,
      maxTokens
    ));
  } else if (provider === "openai") {
    ;
    ({ raw, inputTokens, outputTokens, truncated } = await callOpenAI(model, systemPrompt, userContent, maxTokens));
  } else if (provider === "google") {
    ;
    ({ raw, inputTokens, outputTokens, truncated } = await callGoogle(model, systemPrompt, userContent, maxTokens));
  } else {
    ;
    ({ raw, inputTokens, outputTokens, truncated } = await callAnthropic(model, systemPrompt, userContent, maxTokens));
  }
  const pricing = getModelPricing(model);
  const costUsd = inputTokens / 1e6 * pricing.inputPer1M + outputTokens / 1e6 * pricing.outputPer1M;
  console.log(
    `[generateCode] Complete: type=${layerType} model=${model} tokens=${inputTokens}in/${outputTokens}out cost=$${costUsd.toFixed(4)} codeLen=${raw.length}${truncated ? " TRUNCATED" : ""}`
  );
  if (projectId) {
    await logSpend(projectId, `generation:${layerType}`, costUsd, prompt.slice(0, 200));
  }
  const usageResult = { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd };
  switch (layerType) {
    case "svg":
    case "canvas2d":
      return { code: raw, usage: usageResult, truncated };
    case "lottie": {
      const lottieRaw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        JSON.parse(lottieRaw);
      } catch {
        console.error(`[generateCode] Lottie JSON parse failed, raw length: ${raw.length}`);
        throw new Error(
          truncated ? "Lottie JSON was truncated \u2014 try a simpler animation" : "Generated Lottie output is not valid JSON"
        );
      }
      return { code: lottieRaw, usage: usageResult, truncated };
    }
    case "zdog":
      return { code: raw, usage: usageResult, truncated };
    case "d3": {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(`[generateCode] D3 JSON parse failed, raw length: ${raw.length}`);
        throw new Error(
          truncated ? "D3 scene code was too long and got cut off \u2014 try a simpler prompt" : "Model returned invalid JSON for D3 scene \u2014 please retry"
        );
      }
      return {
        code: parsed.sceneCode ?? "",
        styles: parsed.styles,
        suggestedData: parsed.suggestedData,
        usage: usageResult,
        truncated
      };
    }
    case "three": {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(`[generateCode] Three.js JSON parse failed, raw length: ${raw.length}`);
        throw new Error(
          truncated ? "Three.js scene code was too long and got cut off \u2014 try a simpler prompt" : "Model returned invalid JSON for Three.js scene \u2014 please retry"
        );
      }
      return { code: parsed.sceneCode ?? "", usage: usageResult, truncated };
    }
    case "motion": {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error(`[generateCode] Motion JSON parse failed, raw length: ${raw.length}`);
        throw new Error(
          truncated ? "Motion scene code was too long and got cut off \u2014 try a simpler prompt" : "Model returned invalid JSON for Motion scene \u2014 please retry"
        );
      }
      return {
        code: parsed.sceneCode ?? "",
        styles: parsed.styles,
        htmlContent: parsed.htmlContent,
        usage: usageResult,
        truncated
      };
    }
    case "react": {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return { code: raw, usage: usageResult, truncated };
      }
      return {
        code: parsed.sceneCode ?? "",
        styles: parsed.styles,
        usage: usageResult,
        truncated
      };
    }
    default:
      return { code: raw, usage: usageResult, truncated };
  }
}
async function callAnthropic(model, systemPrompt, userContent, maxTokens) {
  const params = {
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }]
  };
  let result;
  try {
    result = await anthropicClient.messages.create(params, { timeout: 6e4 });
  } catch (firstErr) {
    console.warn("[generateCode] First attempt failed, retrying in 1s:", firstErr.message);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    result = await anthropicClient.messages.create(params, { timeout: 6e4 });
  }
  const truncated = result.stop_reason === "max_tokens";
  if (truncated) {
    console.warn(
      `[generateCode] Anthropic output truncated (hit max_tokens=${maxTokens}, used ${result.usage.output_tokens})`
    );
  }
  const textBlock = result.content.find((b) => b.type === "text");
  return {
    raw: textBlock?.type === "text" ? textBlock.text : "",
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    truncated
  };
}
async function callOpenAI(model, systemPrompt, userContent, maxTokens) {
  const client = getOpenAIClient();
  let result;
  try {
    result = await client.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      },
      { timeout: 6e4 }
    );
  } catch (firstErr) {
    console.warn("[generateCode] OpenAI first attempt failed, retrying in 1s:", firstErr.message);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    result = await client.chat.completions.create(
      {
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      },
      { timeout: 6e4 }
    );
  }
  const finishReason = result.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  if (truncated) {
    console.warn(`[generateCode] OpenAI output truncated (hit max_tokens=${maxTokens})`);
  }
  return {
    raw: result.choices?.[0]?.message?.content ?? "",
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
    truncated
  };
}
async function callGoogle(model, systemPrompt, userContent, _maxTokens) {
  const client = getGoogleClient();
  let result;
  try {
    result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      config: {
        systemInstruction: systemPrompt
      }
    });
  } catch (firstErr) {
    console.warn("[generateCode] Google first attempt failed, retrying in 1s:", firstErr.message);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      config: {
        systemInstruction: systemPrompt
      }
    });
  }
  const text2 = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const usageMetadata = result?.usageMetadata ?? {};
  const finishReason = result?.candidates?.[0]?.finishReason;
  const truncated = finishReason === "MAX_TOKENS";
  if (truncated) {
    console.warn(`[generateCode] Google output truncated (hit max_tokens)`);
  }
  return {
    raw: text2,
    inputTokens: usageMetadata.promptTokenCount ?? 0,
    outputTokens: usageMetadata.candidatesTokenCount ?? 0,
    truncated
  };
}
async function callLocal(endpoint, localModelName, systemPrompt, userContent, maxTokens) {
  const client = getLocalClient(endpoint);
  let result;
  try {
    result = await client.chat.completions.create(
      {
        model: localModelName,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      },
      { timeout: 12e4 }
    );
  } catch (firstErr) {
    console.warn("[generateCode] Local LLM first attempt failed, retrying in 1s:", firstErr.message);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    result = await client.chat.completions.create(
      {
        model: localModelName,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ]
      },
      { timeout: 12e4 }
    );
  }
  const finishReason = result.choices?.[0]?.finish_reason;
  const truncated = finishReason === "length";
  if (truncated) {
    console.warn(`[generateCode] Local LLM output truncated (hit max_tokens=${maxTokens})`);
  }
  return {
    raw: result.choices?.[0]?.message?.content ?? "",
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
    truncated
  };
}

// lib/services/generation.ts
async function generateCanvas(input) {
  if (!input.prompt) {
    throw new GenerationValidationError("prompt is required");
  }
  const gen = await generateCode("canvas2d", input.prompt, {
    palette: input.palette,
    bgColor: input.bgColor,
    duration: input.duration,
    previousSummary: input.previousSummary,
    modelId: input.modelId,
    modelConfigs: input.modelConfigs
  });
  return { result: gen.code, usage: gen.usage, truncated: gen.truncated };
}
var GenerationValidationError = class extends Error {
  code = "VALIDATION";
  constructor(message) {
    super(message);
    this.name = "GenerationValidationError";
  }
};

// electron/ipc/generate.ts
function register16(ipcMain2) {
  ipcMain2.handle("cench:generate.canvas", async (_e, args) => {
    try {
      return await generateCanvas(args);
    } catch (err) {
      if (err instanceof GenerationValidationError) throw new IpcValidationError(err.message);
      throw err;
    }
  });
}

// electron/ipc/index.ts
function registerAllIpc(ipcMain2) {
  register(ipcMain2);
  register2(ipcMain2);
  register3(ipcMain2);
  register4(ipcMain2);
  register5(ipcMain2);
  register6(ipcMain2);
  register7(ipcMain2);
  register8(ipcMain2);
  register9(ipcMain2);
  register10(ipcMain2);
  register11(ipcMain2);
  register12(ipcMain2);
  register13(ipcMain2);
  register14(ipcMain2);
  register15(ipcMain2);
  register16(ipcMain2);
}

// electron/paths.ts
var import_electron5 = require("electron");
var import_node_path10 = __toESM(require("node:path"));
function getUserScenesDir() {
  return import_node_path10.default.join(import_electron5.app.getPath("userData"), "scenes");
}
function getUserUploadsDir() {
  return import_node_path10.default.join(import_electron5.app.getPath("userData"), "uploads");
}
function getUserAudioDir() {
  return import_node_path10.default.join(import_electron5.app.getPath("userData"), "audio");
}
function getStaticAppDir() {
  return import_node_path10.default.join(__dirname, "..", "out");
}

// electron/main.ts
function loadEnvFiles() {
  const attempted = [];
  const tryLoad = (p) => {
    attempted.push(p);
    if (import_fs.default.existsSync(p)) {
      (0, import_dotenv.config)({ path: p, override: false });
    }
  };
  if (import_electron6.app.isPackaged) {
    tryLoad(import_path12.default.join(import_electron6.app.getPath("userData"), "cench.env"));
    tryLoad(import_path12.default.join(process.resourcesPath, ".env.defaults"));
  } else {
    const repoRoot = import_path12.default.resolve(__dirname, "..");
    tryLoad(import_path12.default.join(repoRoot, ".env.local"));
    tryLoad(import_path12.default.join(repoRoot, ".env"));
  }
}
loadEnvFiles();
if (import_electron6.app.isPackaged) {
  process.env.CENCH_AUDIO_DIR = getUserAudioDir();
  process.env.CENCH_AUDIO_URL_BASE = "cench://audio/";
  process.env.CENCH_UPLOADS_DIR = getUserUploadsDir();
  process.env.CENCH_UPLOADS_URL_BASE = "cench://uploads/";
}
var execFileAsync4 = (0, import_util3.promisify)(import_child_process3.execFile);
function webZoomTargetWindow() {
  return import_electron6.BrowserWindow.getFocusedWindow() ?? import_electron6.BrowserWindow.getAllWindows()[0] ?? null;
}
var DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
import_electron6.protocol.registerSchemesAsPrivileged([
  {
    scheme: "cench",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);
async function registerCenchProtocol() {
  const staticDir = import_path12.default.resolve(getStaticAppDir());
  const scenesDir = import_path12.default.resolve(getUserScenesDir());
  const uploadsDir2 = import_path12.default.resolve(getUserUploadsDir());
  const audioDir = import_path12.default.resolve(getUserAudioDir());
  await import_promises19.default.mkdir(scenesDir, { recursive: true });
  await import_promises19.default.mkdir(uploadsDir2, { recursive: true });
  await import_promises19.default.mkdir(audioDir, { recursive: true });
  import_electron6.protocol.handle("cench", async (request) => {
    try {
      const url = new URL(request.url);
      const host = url.hostname;
      const rawPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      let baseDir;
      if (host === "scenes") {
        baseDir = scenesDir;
      } else if (host === "uploads") {
        baseDir = uploadsDir2;
      } else if (host === "audio") {
        baseDir = audioDir;
      } else if (host === "app" || host === "") {
        baseDir = staticDir;
      } else {
        return new Response(`Unknown cench:// host "${host}"`, { status: 404 });
      }
      let filePath = import_path12.default.resolve(baseDir, rawPath || "index.html");
      if (!filePath.startsWith(baseDir + import_path12.default.sep) && filePath !== baseDir) {
        return new Response("Forbidden", { status: 403 });
      }
      try {
        const stat = await import_promises19.default.stat(filePath);
        if (stat.isDirectory()) filePath = import_path12.default.join(filePath, "index.html");
      } catch {
        if (!filePath.endsWith(".html")) {
          const htmlVariant = `${filePath}.html`;
          try {
            await import_promises19.default.access(htmlVariant);
            filePath = htmlVariant;
          } catch {
          }
        }
      }
      try {
        const realPath = await import_promises19.default.realpath(filePath);
        if (!realPath.startsWith(baseDir + import_path12.default.sep) && realPath !== baseDir) {
          return new Response("Forbidden (symlink escape)", { status: 403 });
        }
        filePath = realPath;
      } catch {
      }
      return import_electron6.net.fetch((0, import_url.pathToFileURL)(filePath).toString());
    } catch (err) {
      console.error("[cench-protocol] failed to serve", request.url, err);
      return new Response("Internal error", { status: 500 });
    }
  });
}
function sanitizeFilename(hint, fallback = "recording") {
  return (hint || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || fallback;
}
import_electron6.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
function createWindow() {
  const win = new import_electron6.BrowserWindow({
    width: 1600,
    height: 960,
    backgroundColor: "#0b0b0f",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 16 },
    webPreferences: {
      preload: import_path12.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  const appUrl = import_electron6.app.isPackaged ? "cench://app/index.html" : DEV_URL;
  win.loadURL(appUrl);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const template = [
    ...process.platform === "darwin" ? [
      {
        label: import_electron6.app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => {
            const w = import_electron6.BrowserWindow.getFocusedWindow() ?? import_electron6.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const store = window.__cenchStore;
                if (store) { store.setState({ project: { ...store.getState().project, id: '' } }); window.location.href = '/'; }
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => {
            const w = import_electron6.BrowserWindow.getFocusedWindow() ?? import_electron6.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('undo');
                } else {
                  window.__cenchStore?.getState()?.undo?.();
                }
              })()
            `);
          }
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => {
            const w = import_electron6.BrowserWindow.getFocusedWindow() ?? import_electron6.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const el = document.activeElement;
                if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                  document.execCommand('redo');
                } else {
                  window.__cenchStore?.getState()?.redo?.();
                }
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...process.platform === "darwin" ? [{ role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" }] : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Preview Fullscreen",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => {
            const w = import_electron6.BrowserWindow.getFocusedWindow() ?? import_electron6.BrowserWindow.getAllWindows()[0];
            if (w)
              w.webContents.executeJavaScript(`
              (() => {
                const s = window.__cenchStore?.getState();
                if (s) s.setPreviewFullscreen(!s.isPreviewFullscreen);
              })()
            `);
          }
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Documentation",
      click: () => {
        import_electron6.shell.openExternal(`${DEV_URL.replace(/\/$/, "")}/docs`);
      }
    },
    {
      role: "window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...process.platform === "darwin" ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]
      ]
    }
  ];
  import_electron6.Menu.setApplicationMenu(import_electron6.Menu.buildFromTemplate(template));
}
import_electron6.app.whenReady().then(async () => {
  import_electron6.ipcMain.handle("cench:gitStatus", async () => {
    if (import_electron6.app.isPackaged) {
      return { ok: false, branch: null, dirty: false };
    }
    const cwd = process.cwd();
    try {
      const { stdout: branchOut } = await execFileAsync4("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd,
        timeout: 8e3,
        maxBuffer: 1024 * 1024
      });
      const { stdout: por } = await execFileAsync4("git", ["status", "--porcelain"], {
        cwd,
        timeout: 8e3,
        maxBuffer: 1024 * 1024
      });
      const branch = branchOut.trim();
      if (!branch) return { ok: false, branch: null, dirty: false };
      return { ok: true, branch, dirty: por.trim().length > 0 };
    } catch {
      return { ok: false, branch: null, dirty: false };
    }
  });
  import_electron6.ipcMain.handle("cench:webZoomIn", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    const z = win.webContents.getZoomFactor();
    const next = Math.min(3, Math.round((z + 0.1) * 100) / 100);
    win.webContents.setZoomFactor(next);
    return { ok: true, factor: win.webContents.getZoomFactor() };
  });
  import_electron6.ipcMain.handle("cench:webZoomOut", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    const z = win.webContents.getZoomFactor();
    const next = Math.max(0.5, Math.round((z - 0.1) * 100) / 100);
    win.webContents.setZoomFactor(next);
    return { ok: true, factor: win.webContents.getZoomFactor() };
  });
  import_electron6.ipcMain.handle("cench:webZoomReset", () => {
    const win = webZoomTargetWindow();
    if (!win) return { ok: false, factor: 1 };
    win.webContents.setZoomFactor(1);
    return { ok: true, factor: 1 };
  });
  import_electron6.ipcMain.handle(
    "cench:capturePage",
    async (_evt, args) => {
      const win = webZoomTargetWindow();
      if (!win) return { ok: false, error: "no window" };
      try {
        const image = args?.rect ? await win.webContents.capturePage(args.rect) : await win.webContents.capturePage();
        const dataUri = image.toDataURL();
        return { ok: true, dataUri, mimeType: "image/png" };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
  );
  import_electron6.ipcMain.handle("cench:saveDialog", async (_evt, suggestedName) => {
    const res = await import_electron6.dialog.showSaveDialog({
      title: "Save exported video",
      defaultPath: suggestedName || `export-${Date.now()}.mp4`,
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
    });
    return { canceled: res.canceled, filePath: res.filePath ?? null };
  });
  import_electron6.ipcMain.handle("cench:chooseDirectory", async (_evt, defaultPath) => {
    const res = await import_electron6.dialog.showOpenDialog({
      title: "Choose export folder",
      defaultPath: defaultPath || import_electron6.app.getPath("downloads"),
      properties: ["openDirectory", "createDirectory"]
    });
    const dirPath = res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    return { canceled: res.canceled, dirPath };
  });
  import_electron6.ipcMain.handle("cench:getDefaultExportDir", async () => {
    return { dirPath: import_electron6.app.getPath("downloads") };
  });
  import_electron6.ipcMain.handle("cench:showItemInFolder", async (_evt, filePath) => {
    if (!filePath) return { ok: false, error: "No file path provided" };
    import_electron6.shell.showItemInFolder(filePath);
    return { ok: true };
  });
  import_electron6.ipcMain.handle("cench:openPath", async (_evt, filePath) => {
    if (!filePath) return { ok: false, error: "No file path provided" };
    const err = await import_electron6.shell.openPath(filePath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });
  import_electron6.ipcMain.handle("cench:writeFile", async (_evt, args) => {
    await import_promises19.default.mkdir(import_path12.default.dirname(args.filePath), { recursive: true });
    await import_promises19.default.writeFile(args.filePath, Buffer.from(args.bytes));
    return { ok: true };
  });
  import_electron6.ipcMain.handle(
    "cench:saveRecording",
    async (_evt, args) => {
      const extRaw = (args.extension || "webm").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = extRaw || "webm";
      const dir = import_path12.default.join(import_electron6.app.getPath("userData"), "recordings");
      await import_promises19.default.mkdir(dir, { recursive: true });
      const safeBase = sanitizeFilename(args.nameHint || "");
      const filePath = import_path12.default.join(dir, `${safeBase}-${Date.now()}.${ext}`);
      await import_promises19.default.writeFile(filePath, Buffer.from(args.bytes));
      const fileUrl = (0, import_url.pathToFileURL)(filePath).href;
      return { ok: true, filePath, fileUrl };
    }
  );
  import_electron6.ipcMain.handle(
    "cench:concatMp4",
    async (_evt, args) => {
      const inputs = (args.inputs ?? []).filter(Boolean);
      if (inputs.length === 0) throw new Error("concatMp4: no input files");
      if (inputs.length === 1) {
        await import_promises19.default.copyFile(inputs[0], args.output);
        if (args.cleanup) {
          await import_promises19.default.unlink(inputs[0]).catch(() => {
          });
        }
        return { ok: true };
      }
      const transitions = args.transitions ?? [];
      try {
        const stitcherPath = import_electron6.app.isPackaged ? import_path12.default.join(process.resourcesPath, "render-server", "stitcher.js") : import_path12.default.join(process.cwd(), "render-server", "stitcher.js");
        const mod = await import((0, import_url.pathToFileURL)(stitcherPath).href);
        const stitchScenes = mod?.stitchScenes;
        if (typeof stitchScenes !== "function") {
          throw new Error("stitchScenes() not found in render-server/stitcher.js");
        }
        const stitchedTransitions = Array.from({ length: Math.max(0, inputs.length - 1) }, (_v, i) => ({
          type: transitions[i]?.type ?? "none",
          duration: transitions[i]?.duration ?? 0.5
        }));
        await stitchScenes(inputs, stitchedTransitions, args.output);
      } finally {
        if (args.cleanup) {
          await Promise.all(inputs.map((p) => import_promises19.default.unlink(p).catch(() => {
          })));
        }
      }
      return { ok: true };
    }
  );
  const MAX_CURSOR_SAMPLES = 36e3;
  let cursorInterval = null;
  let cursorSamples = [];
  let cursorStartTime = 0;
  let cursorSourceDisplay = null;
  import_electron6.ipcMain.handle("cench:startCursorTelemetry", (_evt, args) => {
    cursorSamples = [];
    cursorStartTime = Date.now();
    cursorSourceDisplay = null;
    if (args?.displayId) {
      const numId = Number(args.displayId);
      const all = import_electron6.screen.getAllDisplays();
      cursorSourceDisplay = all.find((d) => d.id === numId || String(d.id) === args.displayId) ?? null;
    }
    cursorInterval = setInterval(() => {
      const point = import_electron6.screen.getCursorScreenPoint();
      const display = cursorSourceDisplay ?? import_electron6.screen.getDisplayNearestPoint(point);
      const { x, y, width, height } = display.bounds;
      const nx = Math.max(0, Math.min(1, (point.x - x) / width));
      const ny = Math.max(0, Math.min(1, (point.y - y) / height));
      if (cursorSamples.length >= MAX_CURSOR_SAMPLES) {
        cursorSamples.shift();
      }
      cursorSamples.push({ t: Date.now() - cursorStartTime, x: nx, y: ny });
    }, 100);
    return { ok: true };
  });
  import_electron6.ipcMain.handle("cench:stopCursorTelemetry", () => {
    if (cursorInterval) {
      clearInterval(cursorInterval);
      cursorInterval = null;
    }
    cursorSourceDisplay = null;
    const samples = cursorSamples;
    cursorSamples = [];
    return { samples };
  });
  import_electron6.ipcMain.handle(
    "cench:saveRecordingSession",
    async (_evt, args) => {
      if (!args.screenBytes || args.screenBytes.byteLength === 0) {
        throw new Error("Screen recording is empty \u2014 nothing to save");
      }
      const dir = import_path12.default.join(import_electron6.app.getPath("userData"), "recordings");
      await import_promises19.default.mkdir(dir, { recursive: true });
      const ts = Date.now();
      const safeBase = sanitizeFilename(args.nameHint || "");
      const writtenFiles = [];
      try {
        const screenPath = import_path12.default.join(dir, `${safeBase}-${ts}.webm`);
        await import_promises19.default.writeFile(screenPath, Buffer.from(args.screenBytes));
        writtenFiles.push(screenPath);
        const result = {
          screenVideoPath: screenPath,
          screenVideoUrl: (0, import_url.pathToFileURL)(screenPath).href,
          createdAt: ts
        };
        if (args.webcamBytes && args.webcamBytes.byteLength > 0) {
          const webcamPath = import_path12.default.join(dir, `${safeBase}-${ts}-webcam.webm`);
          await import_promises19.default.writeFile(webcamPath, Buffer.from(args.webcamBytes));
          writtenFiles.push(webcamPath);
          result.webcamVideoPath = webcamPath;
          result.webcamVideoUrl = (0, import_url.pathToFileURL)(webcamPath).href;
        }
        const manifestPath = import_path12.default.join(dir, `${safeBase}-${ts}.session.json`);
        await import_promises19.default.writeFile(manifestPath, JSON.stringify(result, null, 2));
        return result;
      } catch (err) {
        await Promise.all(writtenFiles.map((f) => import_promises19.default.unlink(f).catch(() => {
        })));
        throw err;
      }
    }
  );
  import_electron6.session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
    return allowed.includes(permission);
  });
  import_electron6.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["media", "audioCapture", "microphone", "videoCapture", "camera"];
    callback(allowed.includes(permission));
  });
  await registerCenchProtocol();
  registerAllIpc(import_electron6.ipcMain);
  createWindow();
  import_electron6.session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    console.log("[Electron] setDisplayMediaRequestHandler called");
    console.log("[Electron]   videoRequested:", !!request.videoRequested);
    console.log("[Electron]   audioRequested:", !!request.audioRequested);
    console.log("[Electron]   frame:", request.frame?.url?.slice(0, 80));
    try {
      ;
      callback({}, { useSystemPicker: true });
      console.log("[Electron]   callback invoked with useSystemPicker: true");
    } catch (err) {
      console.error("[Electron]   callback error:", err.message);
      callback(null);
    }
  });
  import_electron6.app.on("activate", () => {
    if (import_electron6.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron6.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron6.app.quit();
});
//# sourceMappingURL=main.js.map
