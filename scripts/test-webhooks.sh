#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

if [[ -z "${PROVISION_WEBHOOK_SECRET:-}" && -f ".env.local" ]]; then
  # Load only the webhook secret from .env.local (supports quoted or unquoted values).
  env_secret_line="$(grep -E '^[[:space:]]*PROVISION_WEBHOOK_SECRET=' .env.local | tail -n1 || true)"
  if [[ -n "$env_secret_line" ]]; then
    env_secret_value="${env_secret_line#*=}"
    env_secret_value="${env_secret_value%\"}"
    env_secret_value="${env_secret_value#\"}"
    env_secret_value="${env_secret_value%\'}"
    env_secret_value="${env_secret_value#\'}"
    PROVISION_WEBHOOK_SECRET="$env_secret_value"
  fi
fi

SECRET="${PROVISION_WEBHOOK_SECRET:-local-test-secret}"

sign_payload() {
  local payload="$1"
  printf '%s' "$payload" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}'
}

post_webhook() {
  local endpoint="$1"
  local label="$2"
  local payload="$3"
  local signature="$4"

  local response
  response=$(
    curl -sS \
      -X POST "${BASE_URL}${endpoint}" \
      -H "content-type: application/json" \
      -H "x-webhook-signature: ${signature}" \
      -d "$payload" \
      -w $'\nHTTP_STATUS:%{http_code}'
  )

  local status
  status="$(printf '%s\n' "$response" | tail -n1 | cut -d: -f2)"
  local body
  body="$(printf '%s\n' "$response" | sed '$d')"

  printf '[%s] POST %s -> %s\n' "$label" "$endpoint" "$status"
  printf '%s\n' "$body"
  printf '\n'
}

payment_missing_fields='{"admin_external_id":"admin-123"}'
payment_invalid_signature='{"admin_external_id":"admin-123","cohort_external_id":"cohort-123"}'

seat_invalid_seat_count='{"admin_external_id":"admin-123","cohort_external_id":"cohort-123","seat_count":-1}'
seat_invalid_signature='{"admin_external_id":"admin-123","cohort_external_id":"cohort-123","seat_count":10}'

echo "Using BASE_URL=${BASE_URL}"
if [[ -z "${PROVISION_WEBHOOK_SECRET:-}" ]]; then
  echo "Using fallback webhook secret (PROVISION_WEBHOOK_SECRET not found in env or .env.local)"
else
  echo "Using webhook secret from environment/.env.local"
fi
echo "Running webhook smoke tests (validation/signature paths)"
echo

post_webhook "/api/webhooks/payment" "payment/invalid-signature" "$payment_invalid_signature" "bad-signature"
post_webhook "/api/webhooks/payment" "payment/missing-fields" "$payment_missing_fields" "$(sign_payload "$payment_missing_fields")"

post_webhook "/api/webhooks/seat-update" "seat-update/invalid-signature" "$seat_invalid_signature" "bad-signature"
post_webhook "/api/webhooks/seat-update" "seat-update/invalid-seat-count" "$seat_invalid_seat_count" "$(sign_payload "$seat_invalid_seat_count")"

REAL_ADMIN_EXTERNAL_ID="${REAL_ADMIN_EXTERNAL_ID:-}"
REAL_COHORT_ID="${REAL_COHORT_ID:-}"
REAL_COHORT_EXTERNAL_ID="${REAL_COHORT_EXTERNAL_ID:-}"
REAL_SEAT_COUNT="${REAL_SEAT_COUNT:-}"
REAL_PROVISION_ORG_SLUG="${REAL_PROVISION_ORG_SLUG:-}"
REAL_PROVISION_CORPORATION_NAME="${REAL_PROVISION_CORPORATION_NAME:-}"
REAL_PROVISION_CORPORATION_EXTERNAL_ID="${REAL_PROVISION_CORPORATION_EXTERNAL_ID:-}"
REAL_PROVISION_COHORT_EXTERNAL_ID="${REAL_PROVISION_COHORT_EXTERNAL_ID:-}"
REAL_PROVISION_ADMIN_EMAIL="${REAL_PROVISION_ADMIN_EMAIL:-}"
REAL_PROVISION_ADMIN_FULL_NAME="${REAL_PROVISION_ADMIN_FULL_NAME:-}"
REAL_PROVISION_ADMIN_EXTERNAL_ID="${REAL_PROVISION_ADMIN_EXTERNAL_ID:-}"
REAL_CREATE_COHORT_ADMIN_EXTERNAL_ID="${REAL_CREATE_COHORT_ADMIN_EXTERNAL_ID:-}"
REAL_CREATE_COHORT_CORPORATION_EXTERNAL_ID="${REAL_CREATE_COHORT_CORPORATION_EXTERNAL_ID:-}"

if [[ -n "$REAL_ADMIN_EXTERNAL_ID" && ( -n "$REAL_COHORT_ID" || -n "$REAL_COHORT_EXTERNAL_ID" ) ]]; then
  if [[ -n "$REAL_COHORT_ID" ]]; then
    real_payment_payload=$(printf '{"admin_external_id":"%s","cohort_id":"%s"}' "$REAL_ADMIN_EXTERNAL_ID" "$REAL_COHORT_ID")
  else
    real_payment_payload=$(printf '{"admin_external_id":"%s","cohort_external_id":"%s"}' "$REAL_ADMIN_EXTERNAL_ID" "$REAL_COHORT_EXTERNAL_ID")
  fi
  post_webhook "/api/webhooks/payment" "payment/real" "$real_payment_payload" "$(sign_payload "$real_payment_payload")"

  if [[ -n "$REAL_SEAT_COUNT" ]]; then
    if [[ -n "$REAL_COHORT_ID" ]]; then
      real_seat_payload=$(printf '{"admin_external_id":"%s","cohort_id":"%s","seat_count":%s}' "$REAL_ADMIN_EXTERNAL_ID" "$REAL_COHORT_ID" "$REAL_SEAT_COUNT")
    else
      real_seat_payload=$(printf '{"admin_external_id":"%s","cohort_external_id":"%s","seat_count":%s}' "$REAL_ADMIN_EXTERNAL_ID" "$REAL_COHORT_EXTERNAL_ID" "$REAL_SEAT_COUNT")
    fi
    post_webhook "/api/webhooks/seat-update" "seat-update/real" "$real_seat_payload" "$(sign_payload "$real_seat_payload")"
  fi
fi

if [[ -n "$REAL_PROVISION_ORG_SLUG" && -n "$REAL_PROVISION_CORPORATION_NAME" && -n "$REAL_PROVISION_CORPORATION_EXTERNAL_ID" && -n "$REAL_PROVISION_ADMIN_EMAIL" && -n "$REAL_PROVISION_ADMIN_FULL_NAME" && -n "$REAL_PROVISION_ADMIN_EXTERNAL_ID" ]]; then
  if [[ -n "$REAL_PROVISION_COHORT_EXTERNAL_ID" ]]; then
    real_provision_payload=$(printf '{"org_slug":"%s","corporation_name":"%s","corporation_external_id":"%s","cohort_external_id":"%s","admin_user":{"email":"%s","full_name":"%s","external_id":"%s"}}' \
      "$REAL_PROVISION_ORG_SLUG" \
      "$REAL_PROVISION_CORPORATION_NAME" \
      "$REAL_PROVISION_CORPORATION_EXTERNAL_ID" \
      "$REAL_PROVISION_COHORT_EXTERNAL_ID" \
      "$REAL_PROVISION_ADMIN_EMAIL" \
      "$REAL_PROVISION_ADMIN_FULL_NAME" \
      "$REAL_PROVISION_ADMIN_EXTERNAL_ID")
  else
    real_provision_payload=$(printf '{"org_slug":"%s","corporation_name":"%s","corporation_external_id":"%s","admin_user":{"email":"%s","full_name":"%s","external_id":"%s"}}' \
      "$REAL_PROVISION_ORG_SLUG" \
      "$REAL_PROVISION_CORPORATION_NAME" \
      "$REAL_PROVISION_CORPORATION_EXTERNAL_ID" \
      "$REAL_PROVISION_ADMIN_EMAIL" \
      "$REAL_PROVISION_ADMIN_FULL_NAME" \
      "$REAL_PROVISION_ADMIN_EXTERNAL_ID")
  fi
  post_webhook "/api/webhooks/provision-admin" "provision-admin/real" "$real_provision_payload" "$(sign_payload "$real_provision_payload")"
fi

if [[ -n "$REAL_CREATE_COHORT_ADMIN_EXTERNAL_ID" && -n "$REAL_CREATE_COHORT_CORPORATION_EXTERNAL_ID" ]]; then
  real_create_cohort_payload=$(printf '{"admin_external_id":"%s","corporation_external_id":"%s"}' \
    "$REAL_CREATE_COHORT_ADMIN_EXTERNAL_ID" \
    "$REAL_CREATE_COHORT_CORPORATION_EXTERNAL_ID")
  post_webhook "/api/webhooks/create-cohort" "create-cohort/real" "$real_create_cohort_payload" "$(sign_payload "$real_create_cohort_payload")"
fi

cat <<'EOF'
Expected statuses:
  payment invalid signature -> 401
  payment missing fields    -> 400
  seat invalid signature    -> 401
  seat invalid seat_count   -> 400

To test success paths, send a signed payload with real IDs against your local/staging data.
This script can do that if you set:
  REAL_ADMIN_EXTERNAL_ID=...
  REAL_COHORT_ID=... or REAL_COHORT_EXTERNAL_ID=...
  REAL_SEAT_COUNT=...   (optional; runs seat-update success path too)

Provision admin (real request) requires all of:
  REAL_PROVISION_ORG_SLUG=...
  REAL_PROVISION_CORPORATION_NAME=...
  REAL_PROVISION_CORPORATION_EXTERNAL_ID=...
  REAL_PROVISION_ADMIN_EMAIL=...
  REAL_PROVISION_ADMIN_FULL_NAME=...
  REAL_PROVISION_ADMIN_EXTERNAL_ID=...

Optional for provision-admin:
  REAL_PROVISION_COHORT_EXTERNAL_ID=...

Create cohort (real request) requires:
  REAL_CREATE_COHORT_ADMIN_EXTERNAL_ID=...
  REAL_CREATE_COHORT_CORPORATION_EXTERNAL_ID=...
EOF
