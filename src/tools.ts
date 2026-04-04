/**
 * MCP tool definitions — one per AnchorID REST endpoint.
 *
 * Each tool is a thin schema + handler that delegates to the ApiClient.
 * Zero business logic lives here; the AnchorID API owns all scoring,
 * validation, and persistence.
 *
 * Terminology:
 *   AnchorID  = canonical resolved entity (company or person)
 *   needs_review = ambiguous match requiring human review
 *   guard_write  = evaluation-only safety check (never writes)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, ApiClientOpts, ApiError } from "./api-client.js";

/** Format the API response as MCP tool content. */
function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Format an error as MCP tool content (isError flag). */
function errorContent(err: unknown) {
  if (err instanceof ApiError) {
    const payload = {
      error: err.message,
      status_code: err.status_code,
      request_id: err.request_id,
      details: err.details,
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: (err as Error).message ?? String(err) }],
    isError: true,
  };
}

export function registerTools(server: McpServer, client?: ApiClient): void {
  const api = client ?? new ApiClient();

  // ─── 1. resolve_company ──────────────────────────────────────────
  server.tool(
    "resolve_company",
    "Resolve a company to an AnchorID using domain, name, city/state, " +
      "or external identifiers. Returns status (resolved | needs_review | not_found), " +
      "confidence score, the canonical AnchorID, match reasons, and any ambiguous candidates.",
    {
      domain: z.string().optional().describe("Company domain (e.g. acme.com)"),
      name: z.string().optional().describe("Company name"),
      city: z.string().optional().describe("City for geo-matching"),
      state: z.string().optional().describe("State for geo-matching"),
      identifiers: z
        .object({
          stripe_customer_id: z.string().optional(),
          salesforce_account_id: z.string().optional(),
          hubspot_company_id: z.string().optional(),
          phone: z.string().optional(),
        })
        .optional()
        .describe("External system identifiers"),
      min_confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum confidence threshold (0-1)"),
    },
    async (input) => {
      try {
        const data = await api.post("/resolve/company", input as Record<string, unknown>);
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 2. resolve_company_batch ────────────────────────────────────
  server.tool(
    "resolve_company_batch",
    "Resolve multiple companies to AnchorIDs in a single call (max 200). " +
      "Each item needs a client_ref for correlation and at least one identifying field. " +
      "Ambiguous matches return status needs_review with candidate AnchorIDs.",
    {
      items: z
        .array(
          z.object({
            client_ref: z.string().describe("Your reference ID for correlation"),
            domain: z.string().optional(),
            name: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            identifiers: z
              .object({
                stripe_customer_id: z.string().optional(),
                salesforce_account_id: z.string().optional(),
                hubspot_company_id: z.string().optional(),
                phone: z.string().optional(),
              })
              .optional(),
            min_confidence: z.number().min(0).max(1).optional(),
          }),
        )
        .max(200)
        .describe("Array of company resolution requests"),
    },
    async (input) => {
      try {
        const data = await api.post(
          "/resolve/company:batch",
          input as Record<string, unknown>,
        );
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 3. resolve_person ───────────────────────────────────────────
  server.tool(
    "resolve_person",
    "Resolve a person to an AnchorID using email, name, company domain, " +
      "or external identifiers (Slack/Google user IDs). " +
      "Returns status (resolved | needs_review | not_found), " +
      "confidence score, the canonical AnchorID, match reasons, and any ambiguous candidates.",
    {
      email: z.string().optional().describe("Person's email address"),
      name: z.string().optional().describe("Person's full name"),
      company_entity_id: z
        .string()
        .optional()
        .describe("Resolved company AnchorID (UUID) for name+company matching"),
      company_domain: z
        .string()
        .optional()
        .describe("Company domain for name+company matching"),
      identifiers: z
        .object({
          slack_user_id: z.string().optional(),
          google_user_id: z.string().optional(),
          salesforce_contact_id: z.string().optional(),
          hubspot_contact_id: z.string().optional(),
          phone: z.string().optional(),
        })
        .optional()
        .describe("External system identifiers"),
      min_confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum confidence threshold (0-1)"),
    },
    async (input) => {
      try {
        const data = await api.post("/resolve/person", input as Record<string, unknown>);
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 4. resolve_person_batch ─────────────────────────────────────
  server.tool(
    "resolve_person_batch",
    "Resolve multiple people to AnchorIDs in a single call (max 200). " +
      "Each item needs a client_ref for correlation and at least one identifying field. " +
      "Ambiguous matches return status needs_review with candidate AnchorIDs.",
    {
      items: z
        .array(
          z.object({
            client_ref: z.string().describe("Your reference ID for correlation"),
            email: z.string().optional(),
            name: z.string().optional(),
            company_entity_id: z.string().optional(),
            company_domain: z.string().optional(),
            identifiers: z
              .object({
                slack_user_id: z.string().optional(),
                google_user_id: z.string().optional(),
                salesforce_contact_id: z.string().optional(),
                hubspot_contact_id: z.string().optional(),
                phone: z.string().optional(),
              })
              .optional(),
            min_confidence: z.number().min(0).max(1).optional(),
          }),
        )
        .max(200)
        .describe("Array of person resolution requests"),
    },
    async (input) => {
      try {
        const data = await api.post(
          "/resolve/person:batch",
          input as Record<string, unknown>,
        );
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 5. get_entity ───────────────────────────────────────────────
  server.tool(
    "get_entity",
    "Fetch an AnchorID (canonical entity) by UUID. Optionally include linked " +
      "source records via the include parameter (links, source_records, or both).",
    {
      entity_id: z.string().describe("UUID of the AnchorID to retrieve"),
      include: z
        .string()
        .optional()
        .describe(
          'Comma-separated relations to include: "links", "source_records", or both',
        ),
    },
    async ({ entity_id, include }) => {
      try {
        const params: Record<string, string | undefined> = { include };
        const data = await api.get(`/entities/${entity_id}`, params);
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 6. link_source_record ───────────────────────────────────────
  server.tool(
    "link_source_record",
    "Create or reactivate a link between an AnchorID and a source record. " +
      "Idempotent — calling twice returns the existing link.",
    {
      entity_id: z.string().describe("UUID of the AnchorID to link to"),
      source_record_id: z.string().describe("UUID of the source record to link"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Confidence score for this link (0-1)"),
      linked_by: z
        .string()
        .optional()
        .describe('Who/what created this link (default: "api")'),
    },
    async ({ entity_id, ...body }) => {
      try {
        const data = await api.post(
          `/entities/${entity_id}/links`,
          body as Record<string, unknown>,
        );
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 7. unlink_source_record ─────────────────────────────────────
  server.tool(
    "unlink_source_record",
    "Soft-delete the link between an AnchorID and a source record. " +
      "Idempotent — calling on an already-unlinked pair returns 200.",
    {
      entity_id: z.string().describe("UUID of the AnchorID to unlink from"),
      source_record_id: z.string().describe("UUID of the source record to unlink"),
    },
    async ({ entity_id, source_record_id }) => {
      try {
        const data = await api.delete(`/entities/${entity_id}/links`, {
          source_record_id,
        });
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 8. guard_write ──────────────────────────────────────────────
  server.tool(
    "guard_write",
    "Evaluation-only pre-write safety check. Verifies the AnchorID exists, " +
      "confidence meets threshold, no unresolved conflicts, and at least one " +
      "canonical link is present. Returns allowed/blocked with reasons. " +
      "This tool does NOT perform any write — the caller decides whether to proceed.",
    {
      entity_id: z.string().describe("UUID of the AnchorID to evaluate"),
      min_confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Minimum confidence threshold (default: 0.70)"),
      require_no_conflicts: z
        .boolean()
        .optional()
        .describe("Block if unresolved conflicts exist (default: true)"),
    },
    async (input) => {
      try {
        const data = await api.post("/guard/write", input as Record<string, unknown>);
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 9. guard_write_batch ─────────────────────────────────────────
  server.tool(
    "guard_write_batch",
    "Batch pre-write safety check for multiple AnchorIDs (max 200). " +
      "Each item needs a client_ref for correlation. Returns per-item " +
      "allowed/blocked decisions with reasons. Evaluation-only — never writes.",
    {
      items: z
        .array(
          z.object({
            client_ref: z.string().describe("Your reference ID for correlation"),
            entity_id: z.string().describe("UUID of the AnchorID to evaluate"),
            min_confidence: z.number().min(0).max(1).optional(),
            require_no_conflicts: z.boolean().optional(),
          }),
        )
        .max(200)
        .describe("Array of guard/write requests"),
    },
    async (input) => {
      try {
        const data = await api.post(
          "/guard/write:batch",
          input as Record<string, unknown>,
        );
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 10. ingest_record ──────────────────────────────────────────
  server.tool(
    "ingest_record",
    "Ingest a single source record into Anchord. The record is matched to an " +
      "AnchorID automatically. Requires a registered source (system). " +
      "Wraps POST /ingest/batch with a single-item array.",
    {
      system: z.string().describe("Source system key (e.g. hubspot, salesforce, stripe, or a custom source)"),
      object_type: z.string().describe("Object type within the source (e.g. company, contact, customer)"),
      object_id: z.string().describe("Unique ID of the record in the source system"),
      payload: z
        .record(z.unknown())
        .describe("Record payload — key/value fields (e.g. name, domain, email)"),
    },
    async (input) => {
      try {
        const data = await api.post("/ingest/batch", {
          records: [input],
        });
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );

  // ─── 11. get_entity_export ──────────────────────────────────────
  server.tool(
    "get_entity_export",
    "Export the golden record for an AnchorID. Returns the merged/canonical " +
      "view of all linked source records as a single JSON object.",
    {
      entity_id: z.string().describe("UUID of the AnchorID to export"),
    },
    async ({ entity_id }) => {
      try {
        const data = await api.get(`/entities/${entity_id}/export`);
        return jsonContent(data);
      } catch (e) {
        return errorContent(e);
      }
    },
  );
}
