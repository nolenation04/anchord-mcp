# Tool Reference

Complete reference for all MCP tools exposed by `@anchord/mcp-server`.

Every tool is a thin proxy to the hosted Anchord API. No business logic
runs locally — all scoring, validation, and persistence happen server-side.

---

## resolve_company

Resolve a company to a canonical AnchorID using domain, name, location, or
external identifiers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domain` | string | No | Company domain (e.g. `acme.com`) |
| `name` | string | No | Company name |
| `city` | string | No | City for geo-matching |
| `state` | string | No | State for geo-matching |
| `identifiers` | object | No | External IDs: `stripe_customer_id`, `salesforce_account_id`, `hubspot_company_id`, `phone` |
| `min_confidence` | number | No | Minimum confidence threshold (0–1) |

At least one identifying field is required.

**Response statuses:**

| Status | Meaning |
|--------|---------|
| `resolved` | High-confidence match found. Use `entity_id`. |
| `not_found` | No match. Safe to create a new record. |
| `needs_review` | Ambiguous — multiple candidates. Do not write. |

---

## resolve_company_batch

Resolve multiple companies in a single call (max 200 items).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `items` | array | Yes | Array of company resolution requests. Each needs a `client_ref` for correlation, plus at least one identifying field. Same fields as `resolve_company`. |

---

## resolve_person

Resolve a person to a canonical AnchorID using email, name, company, or
external identifiers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `email` | string | No | Person's email address |
| `name` | string | No | Person's full name |
| `company_entity_id` | string | No | Resolved company AnchorID (UUID) for name+company matching |
| `company_domain` | string | No | Company domain for name+company matching |
| `identifiers` | object | No | External IDs: `slack_user_id`, `google_user_id`, `salesforce_contact_id`, `hubspot_contact_id`, `phone` |
| `min_confidence` | number | No | Minimum confidence threshold (0–1) |

At least one identifying field is required.

**Response statuses:** Same as `resolve_company`.

---

## resolve_person_batch

Resolve multiple people in a single call (max 200 items).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `items` | array | Yes | Array of person resolution requests. Each needs a `client_ref`, plus at least one identifying field. Same fields as `resolve_person`. |

---

## get_entity

Fetch an AnchorID (canonical entity) by UUID with optional related data.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_id` | string | Yes | UUID of the AnchorID |
| `include` | string | No | Comma-separated: `links`, `source_records`, or both |

---

## get_entity_export

Export the golden record for an AnchorID — the merged/canonical view of all
linked source records as a single JSON object.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_id` | string | Yes | UUID of the AnchorID to export |

---

## link_source_record

Create or reactivate a link between an AnchorID and a source record.
Idempotent — calling twice returns the existing link.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_id` | string | Yes | UUID of the AnchorID |
| `source_record_id` | string | Yes | UUID of the source record |
| `confidence` | number | No | Confidence score (0–1) |
| `linked_by` | string | No | Who/what created this link (default: `api`) |

---

## unlink_source_record

Soft-delete the link between an AnchorID and a source record.
Idempotent — calling on an already-unlinked pair returns 200.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_id` | string | Yes | UUID of the AnchorID |
| `source_record_id` | string | Yes | UUID of the source record |

---

## guard_write

Evaluation-only pre-write safety check. Verifies the AnchorID exists,
confidence meets threshold, and no unresolved conflicts are present.
Returns allowed/blocked with block codes.

**This tool does NOT perform any write.** The caller decides whether to
proceed based on the result.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entity_id` | string | Yes | UUID of the AnchorID to evaluate |
| `min_confidence` | number | No | Minimum confidence threshold (default: 0.8) |
| `require_no_conflicts` | boolean | No | Block if unresolved conflicts exist (default: true) |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | Whether the write is safe to proceed |
| `blocks` | string[] | Block codes when `allowed` is false |
| `entity_id` | string | The evaluated AnchorID |
| `confidence` | number | Current confidence score |
| `active_links` | number | Number of active source record links |
| `audit_id` | string | Audit trail ID for this evaluation |

---

## guard_write_batch

Batch pre-write safety check for multiple AnchorIDs (max 200).
Each item needs a `client_ref` for correlation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `items` | array | Yes | Array of guard requests. Each needs `client_ref`, `entity_id`, and optionally `min_confidence` and `require_no_conflicts`. |

---

## ingest_record

Ingest a single source record into Anchord. The record is automatically
matched to an AnchorID. Requires a registered source (system).

Wraps `POST /ingest/batch` with a single-item array.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `system` | string | Yes | Source system key (e.g. `hubspot`, `salesforce`, `stripe`, or a custom source) |
| `object_type` | string | Yes | Object type (e.g. `company`, `contact`, `customer`) |
| `object_id` | string | Yes | Unique ID in the source system |
| `payload` | object | Yes | Key/value fields (e.g. `name`, `domain`, `email`) |

---

## Error handling

When the Anchord API returns 4xx/5xx, the MCP tool response is marked
`isError: true` with a structured payload:

```json
{
  "error": "[422] BATCH_TOO_LARGE: Batch size must not exceed 100 records. (request_id: req_01ABC123)",
  "status_code": 422,
  "request_id": "req_01ABC123",
  "details": { "records": ["Too many records."] }
}
```

- `request_id` is always present (from API response, header, or client-generated).
- `details` contains validation errors or additional context (null for non-JSON errors).

## Response shape notes

API response shapes may include additional fields beyond the documented core
as the Anchord API evolves (e.g. `integration_id` on candidates, structured
identifiers on entities). The MCP server forwards all response data
transparently.
