export const IPC = {
  // File system
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_SAVE_FILE: 'fs:save-file',
  FS_GET_PROJECT_ROOT: 'fs:get-project-root',
  FS_FILE_CHANGED: 'fs:file-changed',

  // Claude Code
  CLAUDE_SPAWN: 'claude:spawn',
  CLAUDE_SEND_MESSAGE: 'claude:send-message',
  CLAUDE_SEND_MESSAGE_WITH_IMAGES: 'claude:send-message-with-images',
  CLAUDE_KILL: 'claude:kill',
  CLAUDE_INTERRUPT: 'claude:interrupt',
  CLAUDE_SET_MODEL: 'claude:set-model',
  CLAUDE_SET_PERMISSION_MODE: 'claude:set-permission-mode',
  CLAUDE_STREAM_EVENT: 'claude:stream-event',
  CLAUDE_PROCESS_EXIT: 'claude:process-exit',

  // SDK permission flow
  CLAUDE_PERMISSION_REQUEST: 'claude:permission-request',
  CLAUDE_PERMISSION_RESPONSE: 'claude:permission-response',
  CLAUDE_MODE_CHANGED: 'claude:mode-changed',

  // Session management
  CLAUDE_SPAWN_SESSION: 'claude:spawn-session',
  CLAUDE_RESUME_SESSION: 'claude:resume-session',
  CLAUDE_KILL_SESSION: 'claude:kill-session',
  CLAUDE_RESPOND_PROMPT: 'claude:respond-prompt',

  // Session persistence
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',
  SESSION_LOAD_INDEX: 'session:load-index',
  SESSION_GET_LAST: 'session:get-last',
  SESSION_DELETE: 'session:delete',
  SESSION_LOAD_EXTERNAL_INDEX: 'session:load-external-index',
  SESSION_PARSE_EXTERNAL: 'session:parse-external',

  // Editor state persistence
  EDITOR_STATE_SAVE: 'editor-state:save',
  EDITOR_STATE_LOAD: 'editor-state:load',

  // Slash commands
  CLAUDE_LIST_COMMANDS: 'claude:list-commands',
  CLAUDE_READ_COMMAND: 'claude:read-command',
  CLAUDE_RUN_ONE_SHOT: 'claude:run-one-shot',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_SELECT_FOLDER: 'app:select-folder',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
