import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, ApiError } from "../api-client.js";

/**
 * Helper: build a minimal Response-like object that fetch would return.
 */
function fakeResponse(opts: {
  status: number;
  body: string;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(opts.headers ?? {});
  return {
    ok: opts.status >= 200 && opts.status < 300,
    status: opts.status,
    statusText: "",
    headers,
    text: async () => opts.body,
    // Required by the Response interface but unused in parse()
    json: async () => JSON.parse(opts.body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    clone: () => fakeResponse(opts),
    type: "basic" as ResponseType,
    url: "",
    redirected: false,
    bytes: async () => new Uint8Array(),
  } satisfies Response;
}

/** UUID v4 pattern */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("ApiClient", () => {
  let originalFetch: typeof globalThis.fetch;
  let client: ApiClient;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.ANCHORD_API_KEY = "test-key-for-unit-tests";
    process.env.ANCHORD_API_BASE_URL = "http://fake-api.test";
    client = new ApiClient();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.ANCHORD_API_KEY;
    delete process.env.ANCHORD_API_BASE_URL;
  });

  it("throws when ANCHORD_API_KEY is missing", () => {
    delete process.env.ANCHORD_API_KEY;
    assert.throws(
      () => new ApiClient(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("ANCHORD_API_KEY"));
        return true;
      },
    );
  });

  it("throws ApiError with status_code, request_id, and details on 422 JSON", async () => {
    const responseBody = {
      error: {
        code: "BATCH_TOO_LARGE",
        message: "Batch size must not exceed 100 records.",
        details: { records: ["Too many records."] },
      },
      request_id: "req_01ABC123",
    };

    globalThis.fetch = mock.fn(async () =>
      fakeResponse({
        status: 422,
        body: JSON.stringify(responseBody),
        headers: { "x-request-id": "req_01ABC123" },
      }),
    ) as typeof fetch;

    await assert.rejects(
      () => client.post("/ingest/batch", { records: [] }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError, "should be ApiError instance");
        assert.equal(err.status_code, 422);
        assert.equal(err.request_id, "req_01ABC123");
        assert.deepEqual(err.details, { records: ["Too many records."] });
        assert.ok(
          err.message.includes("BATCH_TOO_LARGE"),
          "message should include the error code",
        );
        assert.ok(
          err.message.includes("req_01ABC123"),
          "message should include request_id",
        );
        return true;
      },
    );
  });

  it("throws ApiError with request_id from body when header differs", async () => {
    const responseBody = {
      error: { code: "VALIDATION_ERROR", message: "Bad input.", details: {} },
      request_id: "req_BODY_ID",
    };

    globalThis.fetch = mock.fn(async () =>
      fakeResponse({
        status: 400,
        body: JSON.stringify(responseBody),
        headers: { "x-request-id": "req_HEADER_ID" },
      }),
    ) as typeof fetch;

    await assert.rejects(
      () => client.post("/resolve/company", {}),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        // Body request_id takes priority over header
        assert.equal(err.request_id, "req_BODY_ID");
        assert.equal(err.status_code, 400);
        return true;
      },
    );
  });

  it("throws ApiError with header request_id on non-JSON error", async () => {
    globalThis.fetch = mock.fn(async () =>
      fakeResponse({
        status: 502,
        body: "<html>Bad Gateway</html>",
        headers: { "X-Request-Id": "req_FROM_HEADER" },
      }),
    ) as typeof fetch;

    await assert.rejects(
      () => client.get("/entities/abc"),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status_code, 502);
        assert.equal(err.request_id, "req_FROM_HEADER");
        assert.equal(err.details, null);
        assert.ok(err.message.includes("Bad Gateway"));
        return true;
      },
    );
  });

  it("throws plain Error on 2xx non-JSON response", async () => {
    globalThis.fetch = mock.fn(async () =>
      fakeResponse({
        status: 200,
        body: "OK plain text",
      }),
    ) as typeof fetch;

    await assert.rejects(
      () => client.get("/entities/abc"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(!(err instanceof ApiError), "should NOT be ApiError for 2xx non-JSON");
        assert.ok(err.message.includes("non-JSON"));
        assert.ok(err.message.includes("200"));
        return true;
      },
    );
  });

  it("returns parsed JSON on success", async () => {
    const payload = { entity: { id: "e-1", kind: "company" }, request_id: "req_OK" };

    globalThis.fetch = mock.fn(async () =>
      fakeResponse({
        status: 200,
        body: JSON.stringify(payload),
        headers: { "x-request-id": "req_OK" },
      }),
    ) as typeof fetch;

    const result = await client.get("/entities/e-1");
    assert.deepEqual(result, payload);
  });

  // ── X-Request-Id outgoing header ────────────────────────────────

  it("sends X-Request-Id header on POST requests", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      capturedHeaders = { ...h };
      return fakeResponse({
        status: 200,
        body: JSON.stringify({ ok: true }),
      });
    }) as typeof fetch;

    await client.post("/resolve/company", { domain: "acme.com" });

    assert.ok("X-Request-Id" in capturedHeaders, "X-Request-Id header should be present");
    assert.match(capturedHeaders["X-Request-Id"], UUID_RE, "should be a valid UUID v4");
  });

  it("sends X-Request-Id header on GET requests", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = { ...(init?.headers as Record<string, string>) };
      return fakeResponse({
        status: 200,
        body: JSON.stringify({ entity: {} }),
      });
    }) as typeof fetch;

    await client.get("/entities/abc-123");

    assert.ok("X-Request-Id" in capturedHeaders);
    assert.match(capturedHeaders["X-Request-Id"], UUID_RE);
  });

  it("sends X-Request-Id header on DELETE requests", async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = { ...(init?.headers as Record<string, string>) };
      return fakeResponse({
        status: 200,
        body: JSON.stringify({ link: {} }),
      });
    }) as typeof fetch;

    await client.delete("/entities/abc/links", { source_record_id: "sr-1" });

    assert.ok("X-Request-Id" in capturedHeaders);
    assert.match(capturedHeaders["X-Request-Id"], UUID_RE);
  });

  it("generates a unique X-Request-Id per call", async () => {
    const ids: string[] = [];

    globalThis.fetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      if (h?.["X-Request-Id"]) ids.push(h["X-Request-Id"]);
      return fakeResponse({ status: 200, body: JSON.stringify({}) });
    }) as typeof fetch;

    await client.post("/resolve/company", {});
    await client.post("/resolve/company", {});
    await client.post("/resolve/company", {});

    assert.equal(ids.length, 3);
    const unique = new Set(ids);
    assert.equal(unique.size, 3, "each call should have a distinct request ID");
  });

  it("does not expose API key in error messages", async () => {
    globalThis.fetch = mock.fn(async () =>
      fakeResponse({ status: 500, body: "Internal Server Error" }),
    ) as typeof fetch;

    await assert.rejects(
      () => client.post("/resolve/company", {}),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.ok(
          !err.message.includes("test-key-for-unit-tests"),
          "error message must not contain the API key",
        );
        return true;
      },
    );
  });

  // ── Client-generated request_id as fallback ─────────────────────

  it("uses client-generated request_id when API returns neither body nor header", async () => {
    let sentRequestId = "";

    globalThis.fetch = mock.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      sentRequestId = h?.["X-Request-Id"] ?? "";
      // API returns a 503 with no JSON and no x-request-id header
      return fakeResponse({ status: 503, body: "Service Unavailable" });
    }) as typeof fetch;

    await assert.rejects(
      () => client.get("/entities/abc"),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        // The request_id on the error should be the one we generated and sent
        assert.equal(err.request_id, sentRequestId);
        assert.ok(err.message.includes(sentRequestId), "message should include client request_id");
        assert.match(sentRequestId, UUID_RE, "fallback should be a valid UUID");
        return true;
      },
    );
  });

  // ── Constructor opts (per-request auth) ──────────────────────────

  describe("constructor opts", () => {
    it("uses explicit apiKey and baseUrl, ignoring env vars", async () => {
      let capturedHeaders: Record<string, string> = {};
      let capturedUrl = "";

      globalThis.fetch = mock.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = typeof url === "string" ? url : url.toString();
        capturedHeaders = { ...(init?.headers as Record<string, string>) };
        return fakeResponse({ status: 200, body: JSON.stringify({ ok: true }) });
      }) as typeof fetch;

      const optsClient = new ApiClient({
        apiKey: "explicit-key-123",
        baseUrl: "https://custom.api.test",
      });
      await optsClient.post("/resolve/company", {});

      assert.ok(capturedHeaders["Authorization"] === "Bearer explicit-key-123");
      assert.ok(capturedUrl.startsWith("https://custom.api.test/"));
    });

    it("uses explicit apiKey and falls back to env for baseUrl", () => {
      process.env.ANCHORD_API_BASE_URL = "https://env-base.test";
      const optsClient = new ApiClient({ apiKey: "explicit-key" });

      globalThis.fetch = mock.fn(async (url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url.toString();
        assert.ok(u.startsWith("https://env-base.test/"));
        return fakeResponse({ status: 200, body: JSON.stringify({}) });
      }) as typeof fetch;

      assert.ok(optsClient);
    });

    it("throws when neither opts.apiKey nor env var is set", () => {
      delete process.env.ANCHORD_API_KEY;
      assert.throws(
        () => new ApiClient({ baseUrl: "https://example.com" }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes("ANCHORD_API_KEY"));
          return true;
        },
      );
    });

    it("does not leak explicit apiKey in error messages", async () => {
      globalThis.fetch = mock.fn(async () =>
        fakeResponse({ status: 500, body: "Internal Server Error" }),
      ) as typeof fetch;

      const optsClient = new ApiClient({ apiKey: "secret-explicit-key-xyz" });

      await assert.rejects(
        () => optsClient.post("/resolve/company", {}),
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.ok(
            !err.message.includes("secret-explicit-key-xyz"),
            "error message must not contain the explicit API key",
          );
          return true;
        },
      );
    });

    it("preserves structured error chain with explicit opts", async () => {
      const responseBody = {
        error: {
          code: "ENTITY_NOT_FOUND",
          message: "Entity does not exist.",
          details: { entity_id: "missing-uuid" },
        },
        request_id: "req_OPTS_TEST",
      };

      globalThis.fetch = mock.fn(async () =>
        fakeResponse({
          status: 404,
          body: JSON.stringify(responseBody),
          headers: { "x-request-id": "req_OPTS_TEST" },
        }),
      ) as typeof fetch;

      const optsClient = new ApiClient({
        apiKey: "opts-test-key",
        baseUrl: "https://opts.api.test",
      });

      await assert.rejects(
        () => optsClient.get("/entities/missing-uuid"),
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.status_code, 404);
          assert.equal(err.request_id, "req_OPTS_TEST");
          assert.deepEqual(err.details, { entity_id: "missing-uuid" });
          assert.ok(err.message.includes("ENTITY_NOT_FOUND"));
          return true;
        },
      );
    });
  });

  // ── URL path correctness (colon routes, no encoding) ────────────

  describe("URL path mapping", () => {
    /**
     * The expected mapping from each tool's ApiClient call to the full
     * URL path.  Colon-routes (:batch) must stay literal — they must
     * NOT be percent-encoded to %3A.
     */
    const EXPECTED_PATHS: Array<{
      label: string;
      call: (c: ApiClient) => Promise<unknown>;
      method: string;
      path: string;
    }> = [
      {
        label: "resolve_company",
        call: (c) => c.post("/resolve/company", {}),
        method: "POST",
        path: "/api/v1/resolve/company",
      },
      {
        label: "resolve_company:batch",
        call: (c) => c.post("/resolve/company:batch", {}),
        method: "POST",
        path: "/api/v1/resolve/company:batch",
      },
      {
        label: "resolve_person",
        call: (c) => c.post("/resolve/person", {}),
        method: "POST",
        path: "/api/v1/resolve/person",
      },
      {
        label: "resolve_person:batch",
        call: (c) => c.post("/resolve/person:batch", {}),
        method: "POST",
        path: "/api/v1/resolve/person:batch",
      },
      {
        label: "get_entity",
        call: (c) => c.get("/entities/e-123"),
        method: "GET",
        path: "/api/v1/entities/e-123",
      },
      {
        label: "link_source_record",
        call: (c) => c.post("/entities/e-123/links", {}),
        method: "POST",
        path: "/api/v1/entities/e-123/links",
      },
      {
        label: "unlink_source_record",
        call: (c) => c.delete("/entities/e-123/links", {}),
        method: "DELETE",
        path: "/api/v1/entities/e-123/links",
      },
      {
        label: "guard_write",
        call: (c) => c.post("/guard/write", {}),
        method: "POST",
        path: "/api/v1/guard/write",
      },
      {
        label: "guard_write:batch",
        call: (c) => c.post("/guard/write:batch", {}),
        method: "POST",
        path: "/api/v1/guard/write:batch",
      },
      {
        label: "ingest_record (via /ingest/batch)",
        call: (c) => c.post("/ingest/batch", { records: [{}] }),
        method: "POST",
        path: "/api/v1/ingest/batch",
      },
      {
        label: "get_entity_export",
        call: (c) => c.get("/entities/e-123/export"),
        method: "GET",
        path: "/api/v1/entities/e-123/export",
      },
    ];

    for (const { label, call, method, path } of EXPECTED_PATHS) {
      it(`${label} → ${method} ${path}`, async () => {
        let capturedUrl = "";
        let capturedMethod = "";

        globalThis.fetch = mock.fn(
          async (input: string | URL | Request, init?: RequestInit) => {
            capturedUrl = typeof input === "string" ? input : input.toString();
            capturedMethod = init?.method ?? "GET";
            return fakeResponse({ status: 200, body: JSON.stringify({}) });
          },
        ) as typeof fetch;

        await call(client);

        // Verify method
        assert.equal(capturedMethod, method, `expected ${method} for ${label}`);

        // Verify full path (base URL + path)
        const url = new URL(capturedUrl);
        assert.equal(url.pathname, path, `path mismatch for ${label}`);

        // Explicitly verify no percent-encoding of colons
        assert.ok(
          !capturedUrl.includes("%3A"),
          `colon must NOT be percent-encoded in ${label} URL: ${capturedUrl}`,
        );
      });
    }
  });
});
