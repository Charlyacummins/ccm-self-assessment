# Webhook Integration Guide

## Authentication

All provisioning webhooks use HMAC-SHA256 signature verification. Every request must include an `x-webhook-signature` header containing the hex-encoded HMAC of the raw JSON body, signed with the shared secret provided during onboarding.

For outbound webhooks sent by the Self Assessment Tool to your system (for example `cohort.created`), the platform signs requests the same way using a separate outbound shared secret.

**Signature generation (Node.js):**

```javascript
const crypto = require("crypto");

const payload = JSON.stringify(data);
const signature = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(payload)
  .digest("hex");

// Include as header:
// x-webhook-signature: <signature>
```

**Signature generation (Python):**

```python
import hmac
import hashlib

payload = json.dumps(data)
signature = hmac.new(
    WEBHOOK_SECRET.encode(),
    payload.encode(),
    hashlib.sha256
).hexdigest()
```

> The signature must be computed against the exact raw body string that is sent. Any whitespace or key-ordering differences will result in a `401`.

---

## Endpoints

### 1. Provision Admin

`POST /api/webhooks/provision-admin`

Creates a corporation, provisions an admin user, and creates their initial cohort. If the admin user already exists (matched by email), they are linked to the new corporation rather than recreated.

**Payload:**

```json
{
  "org_slug": "worldcc",
  "corporation_name": "Acme Corp",
  "corporation_external_id": "corp_123",
  "admin_user": {
    "email": "admin@acme.com",
    "full_name": "Jane Smith",
    "external_id": "admin_123"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `org_slug` | string | Yes | Organization identifier (e.g. `worldcc`, `ncma`). Must match an existing org. |
| `corporation_name` | string | Yes | Display name of the corporation. |
| `corporation_external_id` | string | Yes | Your system's unique ID for this corporation. |
| `cohort_external_id` | string | No | Optional upstream cohort ID. If provided, it is stored on the created cohort as `external_id`. |
| `admin_user.email` | string | Yes | Admin's email. Used to match existing users. |
| `admin_user.full_name` | string | Recommended | Admin's full name. Used when creating/upserting user profile data. |
| `admin_user.external_id` | string | Recommended | Your system's unique ID for this admin. Used as the key in subsequent webhook calls. |

**Success response (`200`):**

```json
{
  "ok": true,
  "corporationId": "uuid",
  "cohortId": "uuid",
  "cohortExternalId": "cohort_123",
  "clerkUserId": "user_xxx",
  "profileId": "uuid"
}
```

**Happy-path example (using returned `cohortId` in later webhooks):**

1. Provision admin:

```json
{
  "org_slug": "worldcc",
  "corporation_name": "Acme Corp",
  "corporation_external_id": "corp_123",
  "admin_user": {
    "email": "admin@acme.com",
    "full_name": "Jane Smith",
    "external_id": "admin_123"
  }
}
```

2. Store the response values:

```json
{
  "ok": true,
  "corporationId": "73e37be6-b4e0-4c42-98ce-bf0be2d2fd26",
  "cohortId": "d493c825-84f8-463e-8b56-8184a7ae4cbf",
  "cohortExternalId": null,
  "clerkUserId": "user_xxx",
  "profileId": "8e8c7e56-75f0-418e-9a37-87d5e59d5927"
}
```

3. Use `admin_external_id` + `cohortId` for seat and payment updates:

```json
{
  "admin_external_id": "admin_123",
  "cohort_id": "d493c825-84f8-463e-8b56-8184a7ae4cbf",
  "seat_count": 25
}
```

```json
{
  "admin_external_id": "admin_123",
  "cohort_id": "d493c825-84f8-463e-8b56-8184a7ae4cbf"
}
```

**Notes:**


- The cohort name defaults to `<corporation_name> <current year>` (for example, `Acme Corp 2026`).
- The created cohort sets both `admin_id` and `created_by` to the provisioned admin's profile ID.
- `payment_status` is not set directly by this endpoint and uses database defaults.
- `org_slug` must correspond to an organization already configured in the system. Contact your account manager if unsure of the correct value.
- `admin_user.external_id` is stored on both `corp_memberships.external_id` and `profiles.external_id` for identity linkage.
- `cohortId` (internal UUID) is returned and can be stored by your system for subsequent Seat Update / Payment calls.
- A corp admin may have multiple cohorts over time. `cohortId` must be stored per cohort, not per admin.

---

### 2. Seat Update

`POST /api/webhooks/seat-update`

Updates the seat count on an existing cohort. Call this whenever the purchased or allocated seat count changes in your system.

**Payload:**

```json
{
  "admin_external_id": "admin_123",
  "cohort_id": "uuid",
  "seat_count": 25
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_external_id` | string | Yes | The `admin_user.external_id` originally sent in Provision Admin. |
| `cohort_id` | string | Conditionally | Internal cohort UUID returned by Provision Admin. Preferred identifier. |
| `cohort_external_id` | string | Conditionally | Upstream cohort ID if your system provided one during Provision Admin. |
| `seat_count` | number | Yes | New seat count. Must be a non-negative number. |

Provide at least one of `cohort_id` or `cohort_external_id`. If both are provided, `cohort_id` is used.

**Success response (`200`):**

```json
{
  "ok": true,
  "cohortId": "uuid",
  "seatCount": 25
}
```

---

### 3. Payment

`POST /api/webhooks/payment`

Marks a cohort's payment as received. Sets the payment status to `paid` and records the timestamp.

**Payload:**

```json
{
  "admin_external_id": "admin_123",
  "cohort_id": "uuid"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_external_id` | string | Yes | The `admin_user.external_id` originally sent in Provision Admin. |
| `cohort_id` | string | Conditionally | Internal cohort UUID returned by Provision Admin. Preferred identifier. |
| `cohort_external_id` | string | Conditionally | Upstream cohort ID if your system provided one during Provision Admin. |

Provide at least one of `cohort_id` or `cohort_external_id`. If both are provided, `cohort_id` is used.

**Success response (`200`):**

```json
{
  "ok": true,
  "cohortId": "uuid"
}
```

---

### 4. Create Cohort (Additional Cohorts)

`POST /api/webhooks/create-cohort`

Creates an additional cohort for an existing corp admin / corporation pair. Use this after the initial Provision Admin call when a corp admin needs a second (or later) cohort.

**Payload:**

```json
{
  "admin_external_id": "admin_123",
  "corporation_external_id": "corp_123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_external_id` | string | Yes | Existing corp admin external ID from Provision Admin. |
| `corporation_external_id` | string | Yes | Existing corporation external ID from Provision Admin. |

**Success response (`200`):**

```json
{
  "ok": true,
  "cohortId": "uuid",
  "corporationId": "uuid"
}
```

**Notes:**

- The new cohort is assigned to the corp admin (`admin_id`) and attributed to them as creator (`created_by`).
- The cohort is created with the same default template as Provision Admin.
- The cohort name defaults to `<corporation name> <current year>`.
- This endpoint intentionally does not set `cohort_external_id`.

---

## Error Responses

Error response shape depends on the failure type:

- Signature failures (`401`) and invalid JSON (`400`) return plain text responses:

```text
Invalid signature
```

```text
Invalid JSON
```

- Validation, authorization, and processing failures return JSON:

```json
{
  "ok": false,
  "error": "Human-readable description"
}
```

| Status | Meaning |
|---|---|
| `400` | Invalid JSON or missing required fields. |
| `401` | Missing or invalid `x-webhook-signature`. |
| `403` | The `admin_external_id` does not match the admin assigned to the cohort. |
| `404` | Organization not found in Supabase, or Clerk organization not found (Provision Admin endpoint). |
| `409` | Conflict (for example, profile `external_id` mismatch or a reused `cohort_external_id` linked to a different cohort). |
| `500` | Internal processing error (including admin/cohort lookup failures in Seat Update and Payment). |

---

## Typical Integration Flow

```
Your system                         CCM Platform
     │                                   │
     │  1. POST /provision-admin         │
     │ ─────────────────────────────────>│  Creates corporation, user, cohort
     │ <─────────────────────────────────│  Returns IDs
     │                                   │
     │  2. POST /seat-update             │
     │ ─────────────────────────────────>│  Updates seat count
     │ <─────────────────────────────────│  Confirms update
     │                                   │
     │  3. POST /payment                 │
     │ ─────────────────────────────────>│  Marks payment received
     │ <─────────────────────────────────│  Confirms status change
     │                                   │
     │  4. POST /create-cohort           │
     │ ─────────────────────────────────>│  Creates additional cohort
     │ <─────────────────────────────────│  Returns new cohortId
     │                                   │
```

1. Call **Provision Admin** when a new corporation and admin are onboarded in your system.
2. Store the returned `cohortId` (recommended) and `admin_user.external_id` for future webhook calls.
3. Call **Seat Update** whenever the seat count changes.
4. Call **Payment** when payment is confirmed.
5. Call **Create Cohort** when you need an additional cohort for the same corp admin/corporation.

`admin_external_id` remains the admin linkage key across these webhooks. For cohort linkage, prefer returned `cohortId` values from Provision Admin / Create Cohort. `cohort_external_id` is optional and supported for teams that already maintain their own cohort identifiers.

---

## Retry Guidance

Webhooks are not automatically retried by the platform. If a call fails with a `5xx` status, it is safe to retry with the same payload. Calls with `4xx` status indicate a problem with the request itself and should not be retried without correction.

Provision Admin is designed to be idempotent on retries when the same `corporation_external_id` is reused, and when `cohort_external_id` is provided consistently. If you omit `cohort_external_id`, repeated Provision Admin calls may create multiple cohorts.

---

## Outbound Webhooks (CCM Platform -> Your System)

### `cohort.created` (planned / optional integration)

When enabled, the platform can notify your system when a cohort is created in the CCM application (for example, via the dashboard UI).

**Payload (minimum):**

```json
{
  "event_type": "cohort.created",
  "cohort_id": "uuid",
  "admin_external_id": "admin_123"
}
```

**Recommended payload fields:**

- `event_type`
- `cohort_id`
- `admin_external_id`
- `occurred_at`

**Outbound webhook configuration (provided by your team / partner):**

- `OUTBOUND_COHORT_WEBHOOK_URL` - Destination endpoint URL on your system
- `OUTBOUND_COHORT_WEBHOOK_SECRET` - Shared secret used by the platform to sign outbound requests

Notes:

- Outbound webhook secrets should be different from inbound webhook secrets.
- Use separate outbound secrets for staging and production.
- If the platform cannot resolve `admin_external_id` for a cohort creator/admin, it should skip sending and log the error rather than sending an incomplete payload.
