export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal'

export type ErrorSource =
  | 'process_crash'
  | 'api_error'
  | 'rate_limit'
  | 'file_system'
  | 'network'
  | 'unknown'

export interface ClaudeStudioError {
  id: string
  severity: ErrorSeverity
  source: ErrorSource
  message: string
  details?: string
  sessionId?: string
  timestamp: number
  dismissed: boolean
  retryable: boolean
  retryAfterMs?: number
}
