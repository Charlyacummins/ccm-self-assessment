# Webhook Integration Guide

## Authentication

All provisioning webhooks use HMAC-SHA256 signature verification. Every request must include an `x-webhook-signature` header containing the hex-encoded HMAC of the raw JSON body, signed with the shared secret provided during onboarding.

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
  "cohort_external_id": "cohort_123",
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
| `cohort_external_id` | string | Yes | Your system's unique ID for this cohort. Used as the key in subsequent webhook calls. |
| `admin_user.email` | string | Yes | Admin's email. Used to match existing users. |
| `admin_user.full_name` | string | Yes | Admin's full name. |
| `admin_user.external_id` | string | Yes | Your system's unique ID for this admin. Used as the key in subsequent webhook calls. |

**Success response (`200`):**

```json
{
  "ok": true,
  "corporationId": "uuid",
  "cohortId": "uuid",
  "clerkUserId": "user_xxx",
  "profileId": "uuid"
}
```

**Notes:**

- The cohort is created with a default template and `payment_status: pending`.
- `org_slug` must correspond to an organization already configured in the system. Contact your account manager if unsure of the correct value.

---

### 2. Seat Update

`POST /api/webhooks/seat-update`

Updates the seat count on an existing cohort. Call this whenever the purchased or allocated seat count changes in your system.

**Payload:**

```json
{
  "admin_external_id": "admin_123",
  "cohort_external_id": "cohort_123",
  "seat_count": 25
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_external_id` | string | Yes | The `admin_user.external_id` originally sent in Provision Admin. |
| `cohort_external_id` | string | Yes | The `cohort_external_id` originally sent in Provision Admin. |
| `seat_count` | number | Yes | New seat count. Must be a non-negative integer. |

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
  "cohort_external_id": "cohort_123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_external_id` | string | Yes | The `admin_user.external_id` originally sent in Provision Admin. |
| `cohort_external_id` | string | Yes | The `cohort_external_id` originally sent in Provision Admin. |

**Success response (`200`):**

```json
{
  "ok": true,
  "cohortId": "uuid"
}
```

---

## Error Responses

All error responses share the same shape:

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
| `404` | The referenced organization or Clerk user could not be found. |
| `500` | Internal processing error. The `error` field contains details. |

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
```

1. Call **Provision Admin** when a new corporation and admin are onboarded in your system.
2. Call **Seat Update** whenever the seat count changes.
3. Call **Payment** when payment is confirmed.

The `external_id` values are the stable linkage between your system and the platform. Use consistent IDs across all three webhooks — `cohort_external_id` and `admin_external_id` set during provisioning are required for all subsequent calls.

---

## Retry Guidance

Webhooks are not automatically retried by the platform. If a call fails with a `5xx` status, it is safe to retry with the same payload. Calls with `4xx` status indicate a problem with the request itself and should not be retried without correction.
