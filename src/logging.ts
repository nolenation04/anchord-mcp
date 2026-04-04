/**
 * Structured JSON logging for CloudWatch and local debugging.
 * API keys must never appear in log output.
 */

export interface LogEntry {
  tool?: string;
  request_id?: string;
  status?: number;
  latency_ms?: number;
  error_code?: string;
  message?: string;
}

export function logRequest(entry: LogEntry): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

/**
 * Redact an API key for safe logging. Shows first 4 and last 4 characters
 * for keys longer than 8 characters; fully redacts shorter keys.
 */
export function redactKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "***" + key.slice(-4);
}
