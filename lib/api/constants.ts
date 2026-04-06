/**
 * Shared API validation constants.
 * Centralizes all input bounds so routes stay consistent.
 */

export const LIMITS = {
  /** Max text length for agent messages (~50KB) */
  MAX_MESSAGE_LENGTH: 50_000,
  /** Max scenes array size in a single request */
  MAX_SCENES: 100,
  /** Max chat history messages */
  MAX_HISTORY: 200,
  /** Max generated code / SVG content (2MB) */
  MAX_CODE_SIZE: 2 * 1024 * 1024,
  /** Max question length for analyze-logs */
  MAX_QUESTION_LENGTH: 2_000,
  /** Max query result limit */
  MAX_QUERY_RESULTS: 200,
  /** Default query limit */
  DEFAULT_QUERY_LIMIT: 50,
  /** Max globalStyle JSON size (50KB) */
  MAX_GLOBAL_STYLE_SIZE: 50_000,
  /** Max settings JSON size (10KB) */
  MAX_SETTINGS_SIZE: 10_000,
  /** Max name length */
  MAX_NAME_LENGTH: 255,
  /** Max audio search results */
  MAX_AUDIO_RESULTS: 50,
  /** Max scene duration in seconds */
  MAX_SCENE_DURATION: 300,
  /** Min scene duration in seconds */
  MIN_SCENE_DURATION: 0.1,
  /** Max sceneGraph nodes */
  MAX_SCENE_GRAPH_NODES: 200,
  /** Max description/note length */
  MAX_DESCRIPTION_LENGTH: 500,
  /** Max API name length */
  MAX_API_NAME_LENGTH: 100,
  /** Max spend per log entry */
  MAX_COST_USD: 1000,
} as const

export const VALID_SCENE_TYPES = [
  'svg',
  'canvas2d',
  'd3',
  'three',
  'motion',
  'zdog',
  'lottie',
  'physics',
  '3d_world',
] as const

export const VALID_USER_ACTIONS = ['kept', 'edited', 'regenerated', 'deleted'] as const

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Matches the exact scrypt hash format from lib/crypto.ts: 32-char hex salt + ":" + 128-char hex hash */
export const SCRYPT_HASH_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/
