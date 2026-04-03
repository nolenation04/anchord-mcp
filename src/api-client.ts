/**
 * Thin HTTP client that forwards JSON to the AnchorID REST API.
 *
 * Reads configuration from environment variables:
 *   ANCHORD_API_BASE_URL  – e.g. http://localhost:8000  (default)
 *   ANCHORD_API_KEY       – the Bearer token (required)
 *
 * No business logic lives here — just HTTP plumbing.
 */

/**
 * Structured error thrown when the Identity API returns a non-2xx response.
 * Carries machine-readable metadata alongside the human-readable message.
 */
export class ApiError extends Error {
  readonly status_code: number;
  readonly request_id: string | null;
  readonly details: unknown;

  constructor(opts: {
    message: string;
    status_code: number;
    request_id: string | null;
    details: unknown;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status_code = opts.status_code;
    this.request_id = opts.request_id;
    this.details = opts.details;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = (process.env.ANCHORD_API_BASE_URL ?? "http://localhost:8000").replace(
      /\/$/,
      "",
    );
    this.apiKey = process.env.ANCHORD_API_KEY ?? "";

    if (!this.apiKey) {
      throw new Error(
        "ANCHORD_API_KEY environment variable is required. " +
          "Set it to a valid API key for the AnchorID API.",
      );
    }
  }

  // ── HTTP helpers ──────────────────────────────────────────────────

  async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const requestId = this.generateRequestId();
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method: "POST",
      headers: this.headers(requestId),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, requestId);
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") {
          url.searchParams.set(k, v);
        }
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(requestId),
    });
    return this.parse<T>(res, requestId);
  }

  async delete<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const requestId = this.generateRequestId();
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method: "DELETE",
      headers: this.headers(requestId),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, requestId);
  }

  // ── Internals ─────────────────────────────────────────────────────

  /**
   * Generate a UUID for the outgoing X-Request-Id header.
   * Prefers crypto.randomUUID(); falls back to a Math.random()-based v4 UUID.
   */
  private generateRequestId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback for runtimes without crypto.randomUUID()
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }

  /**
   * Build request headers.  The API key is included as a Bearer token
   * but is never surfaced in logs or error messages.
   */
  private headers(requestId: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-Request-Id": requestId,
    };
  }

  /**
   * Parse a fetch Response into JSON, with structured error handling.
   *
   * @param res              The fetch Response
   * @param clientRequestId  The UUID we sent on the request — used as the
   *                         ultimate fallback when neither the response body
   *                         nor the response header contain a request_id.
   *
   * Resolution order for request_id:
   *   1. response body `request_id`  (set by the API)
   *   2. response header `x-request-id`  (set by the API / gateway)
   *   3. `clientRequestId`  (the UUID we generated)
   */
  private async parse<T>(res: Response, clientRequestId: string): Promise<T> {
    // The Fetch API's Headers.get() is already case-insensitive
    const headerRequestId = res.headers.get("x-request-id") ?? null;
    const text = await res.text();

    // Attempt JSON parse
    let json: unknown = undefined;
    let isJson = false;
    try {
      json = JSON.parse(text);
      isJson = true;
    } catch {
      // body is not JSON
    }

    if (!res.ok) {
      if (isJson) {
        const body = json as Record<string, unknown>;
        const errorObj = (body.error ?? {}) as Record<string, unknown>;
        const code = (errorObj.code as string) ?? "UNKNOWN";
        const msg = (errorObj.message as string) ?? `API error`;
        // Prefer body > response header > client-generated
        const requestId =
          (body.request_id as string) ?? headerRequestId ?? clientRequestId;

        throw new ApiError({
          message: `[${res.status}] ${code}: ${msg} (request_id: ${requestId})`,
          status_code: res.status,
          request_id: requestId,
          details: errorObj.details ?? null,
        });
      }

      // Non-JSON error response — fall back through header then client ID
      const requestId = headerRequestId ?? clientRequestId;
      throw new ApiError({
        message:
          `Anchord API returned non-JSON error (HTTP ${res.status})` +
          ` [request_id: ${requestId}]: ` +
          text.slice(0, 500),
        status_code: res.status,
        request_id: requestId,
        details: null,
      });
    }

    // 2xx but not JSON — something unexpected
    if (!isJson) {
      throw new Error(
        `Anchord API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 500)}`,
      );
    }

    return json as T;
  }
}
