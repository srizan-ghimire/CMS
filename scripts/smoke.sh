#!/usr/bin/env bash
#
# End-to-end smoke test against a running deployment.
#
# Signs in, creates a throwaway workspace, exercises every feature area inside it, then deletes the
# workspace on the way out. Nothing outside that workspace is touched.
#
#   SMOKE_API_URL=https://api.example.com \
#   SMOKE_EMAIL=you@example.com \
#   SMOKE_PASSWORD='...' \
#   bash scripts/smoke.sh
#
# Requires curl and node. Exits non-zero if any check fails.
#
# Node rather than jq for the JSON handling: node is guaranteed present (this is a Node project,
# engines >= 20) and jq is not — notably absent from Git Bash on Windows, where this is likely run.
#
# Two things it deliberately does NOT do, because a script cannot do them safely:
#   - Publish. POST /posts/:id/publish against a connected account posts to a real social network.
#     Validation and scheduling are covered; the publish itself is in docs/SMOKE.md.
#   - Upload bytes. The PUT goes browser -> storage directly. The presign is checked here; the
#     round trip is manual.

set -uo pipefail

API_URL="${SMOKE_API_URL:-http://localhost:4000}"
EMAIL="${SMOKE_EMAIL:-}"
PASSWORD="${SMOKE_PASSWORD:-}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "SMOKE_EMAIL and SMOKE_PASSWORD must be set." >&2
  exit 2
fi
for binary in curl node; do
  command -v "$binary" >/dev/null || { echo "$binary is required." >&2; exit 2; }
done

# Build a JSON object from alternating key/value arguments. Values are passed as argv rather than
# interpolated into a string so a password containing quotes or backslashes cannot break the body.
json_obj() {
  node -e '
    const args = process.argv.slice(1);
    const out = {};
    for (let i = 0; i < args.length; i += 2) out[args[i]] = args[i + 1];
    process.stdout.write(JSON.stringify(out));
  ' "$@"
}

# Read one field out of a JSON document on stdin. Prints nothing when absent or unparseable, so
# callers can test with -n and carry on rather than aborting the run.
json_field() {
  node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk));
    process.stdin.on("end", () => {
      try {
        const value = JSON.parse(raw)[process.argv[1]];
        process.stdout.write(value == null ? "" : String(value));
      } catch {
        process.stdout.write("");
      }
    });
  ' "$1"
}

API_URL="${API_URL%/}"
JAR="$(mktemp)"
PASSED=0
FAILED=0
RESULTS=()
WORKSPACE_ID=""

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; RESET=$'\033[0m'

# Free instances sleep after 15 minutes idle and a Docker cold start takes 30-60s, so the first
# call gets a long timeout. Reporting that as a failure would be a false negative.
FIRST_CALL_TIMEOUT=90
CALL_TIMEOUT=30

cleanup() {
  if [ -n "$WORKSPACE_ID" ]; then
    printf '\n%sRemoving scratch workspace %s%s\n' "$DIM" "$WORKSPACE_ID" "$RESET"
    curl -sS -X DELETE -b "$JAR" --max-time "$CALL_TIMEOUT" \
      "$API_URL/api/v1/workspaces/$WORKSPACE_ID" -o /dev/null || true
  fi
  rm -f "$JAR"
}
# In a trap so the workspace is removed even when a check fails and the script exits early.
trap cleanup EXIT

# api <name> <method> <path> [body] [expected_status]
# Records a pass/fail and echoes the response body so callers can pull ids out of it.
api() {
  local name="$1" method="$2" path="$3" body="${4:-}" expect="${5:-2xx}"
  local timeout="$CALL_TIMEOUT"
  [ "$PASSED" -eq 0 ] && [ "$FAILED" -eq 0 ] && timeout="$FIRST_CALL_TIMEOUT"

  local args=(-sS -X "$method" -b "$JAR" -c "$JAR" --max-time "$timeout"
              -w '\n%{http_code}' -H 'Content-Type: application/json')
  [ -n "$body" ] && args+=(-d "$body")

  local response status payload
  response="$(curl "${args[@]}" "$API_URL$path" 2>&1)" || response=$'\n000'
  status="${response##*$'\n'}"
  payload="${response%$'\n'*}"

  local ok=1
  case "$expect" in
    2xx) [[ "$status" =~ ^2 ]] || ok=0 ;;
    *)   [ "$status" = "$expect" ] || ok=0 ;;
  esac

  if [ "$ok" -eq 1 ]; then
    PASSED=$((PASSED + 1))
    RESULTS+=("$(printf '%s  %-44s %s' "${GREEN}PASS${RESET}" "$name" "$status")")
  else
    FAILED=$((FAILED + 1))
    RESULTS+=("$(printf '%s  %-44s %s  %s' "${RED}FAIL${RESET}" "$name" "$status" "${payload:0:120}")")
  fi
  printf '%s' "$payload"
}

section() { printf '\n%s── %s%s\n' "$DIM" "$1" "$RESET" >&2; }

# ---------------------------------------------------------------- liveness ----
section "liveness and identity"
api "health"                GET  "/health"                    "" >/dev/null
api "auth providers"        GET  "/api/v1/auth/providers"     "" >/dev/null

# Better Auth mounts unversioned, outside the /api/v1 prefix.
api "sign in"               POST "/api/auth/sign-in/email" \
  "$(json_obj email "$EMAIL" password "$PASSWORD")" >/dev/null

ME="$(api "users/me" GET "/api/v1/users/me" "")"
if [ -z "$(json_field id <<<"$ME")" ]; then
  printf '\n%sSign-in failed — every check below would be a false negative. Stopping.%s\n' \
    "$RED" "$RESET" >&2
  printf '%s\n' "${RESULTS[@]}" >&2
  exit 1
fi

# ------------------------------------------------------------- scratch ws ----
section "scratch workspace"
WS="$(api "create workspace" POST "/api/v1/workspaces" \
  "$(json_obj name "smoke-$(date +%s)")")"
WORKSPACE_ID="$(json_field id <<<"$WS")"
if [ -z "$WORKSPACE_ID" ]; then
  printf '\n%sCould not create a workspace; nothing below can run.%s\n' "$RED" "$RESET" >&2
  printf '%s\n' "${RESULTS[@]}" >&2
  exit 1
fi
api "list my workspaces"    GET  "/api/v1/workspaces/mine"                 "" >/dev/null
api "list members"          GET  "/api/v1/workspaces/$WORKSPACE_ID/members" "" >/dev/null
api "list invitations"      GET  "/api/v1/workspaces/$WORKSPACE_ID/invitations" "" >/dev/null

# ------------------------------------------------------------ organization ----
section "organization"
TAG="$(api "create tag" POST "/api/v1/tags" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-tag" color "#4F46E5")")"
TAG_ID="$(json_field id <<<"$TAG")"
api "list tags"             GET  "/api/v1/tags?workspaceId=$WORKSPACE_ID" "" >/dev/null
# Same name twice must be a 409, not a 500 — the P2002 path.
api "duplicate tag -> 409"  POST "/api/v1/tags" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-tag")" "409" >/dev/null

CAMPAIGN="$(api "create campaign" POST "/api/v1/campaigns" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-campaign")")"
CAMPAIGN_ID="$(json_field id <<<"$CAMPAIGN")"
api "list campaigns"        GET  "/api/v1/campaigns?workspaceId=$WORKSPACE_ID" "" >/dev/null

TEMPLATE="$(api "create template" POST "/api/v1/templates" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-template" content "Hello {{name}}")")"
TEMPLATE_ID="$(json_field id <<<"$TEMPLATE")"
api "list templates"        GET  "/api/v1/templates?workspaceId=$WORKSPACE_ID" "" >/dev/null
[ -n "$TEMPLATE_ID" ] && api "instantiate template" POST \
  "/api/v1/templates/$TEMPLATE_ID/instantiate" '{"values":{"name":"world"}}' >/dev/null

SNIPPET="$(api "create snippet" POST "/api/v1/snippets" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-snippet" kind "TEXT" body "--")")"
SNIPPET_ID="$(json_field id <<<"$SNIPPET")"
api "list snippets"         GET  "/api/v1/snippets?workspaceId=$WORKSPACE_ID" "" >/dev/null

# -------------------------------------------------------------------- posts ----
section "posts"
POST="$(api "create post" POST "/api/v1/posts" \
  "$(json_obj workspaceId "$WORKSPACE_ID" content "smoke test post")")"
POST_ID="$(json_field id <<<"$POST")"
api "list posts"            GET  "/api/v1/posts?workspaceId=$WORKSPACE_ID" "" >/dev/null

if [ -n "$POST_ID" ]; then
  api "get post"            GET  "/api/v1/posts/$POST_ID"                 "" >/dev/null
  api "update post"         PATCH "/api/v1/posts/$POST_ID" '{"content":"edited"}' >/dev/null
  api "validate post"       GET  "/api/v1/posts/$POST_ID/validate"        "" >/dev/null
  api "post versions"       GET  "/api/v1/posts/$POST_ID/versions"        "" >/dev/null
  api "duplicate post"      POST "/api/v1/posts/$POST_ID/duplicate"       "" >/dev/null
  api "archive post"        POST "/api/v1/posts/$POST_ID/archive"         "" >/dev/null
  api "unarchive post"      POST "/api/v1/posts/$POST_ID/unarchive"       "" >/dev/null

  # Regression guard: duplicated ids collide on a composite unique constraint and used to 500.
  api "duplicate target -> 400" PATCH "/api/v1/posts/$POST_ID" \
    '{"targets":[{"socialAccountId":"clm0000000000000000000001"},{"socialAccountId":"clm0000000000000000000001"}]}' \
    "400" >/dev/null

  [ -n "$TAG_ID" ] && api "tag a post" POST "/api/v1/posts/$POST_ID/tags" \
    "{\"tagIds\":[\"$TAG_ID\"]}" >/dev/null
  [ -n "$CAMPAIGN_ID" ] && api "assign campaign" POST "/api/v1/posts/$POST_ID/campaign" \
    "$(json_obj campaignId "$CAMPAIGN_ID")" >/dev/null

  api "comments list"       GET  "/api/v1/posts/$POST_ID/comments"        "" >/dev/null
  api "approvals for post"  GET  "/api/v1/posts/$POST_ID/approvals"       "" >/dev/null
fi

section "approvals"
api "approval queue"        GET  "/api/v1/approvals/queue?workspaceId=$WORKSPACE_ID" "" >/dev/null
api "approval policy"       GET  "/api/v1/approvals/policy?workspaceId=$WORKSPACE_ID" "" >/dev/null

# --------------------------------------------------------------------- media ----
section "media"
api "list media"            GET  "/api/v1/media?workspaceId=$WORKSPACE_ID" "" >/dev/null
api "list folders"          GET  "/api/v1/media/folders?workspaceId=$WORKSPACE_ID" "" >/dev/null
FOLDER="$(api "create folder" POST "/api/v1/media/folders" \
  "$(json_obj workspaceId "$WORKSPACE_ID" name "smoke-folder")")"
FOLDER_ID="$(json_field id <<<"$FOLDER")"
# Presign only — the PUT itself goes browser -> storage and is checked manually.
# sizeBytes must be a number, so this body is written out rather than built by json_obj, which
# stringifies every value.
api "presign upload" POST "/api/v1/media/uploads/presign" \
  "{\"workspaceId\":\"$WORKSPACE_ID\",\"fileName\":\"smoke.png\",\"mimeType\":\"image/png\",\"sizeBytes\":1024}" \
  >/dev/null

# ------------------------------------------------------- scheduling & search ----
section "scheduling, search, analytics"
FROM="$(date -u -d '-7 days' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null \
        || date -u -v-7d +%Y-%m-%dT%H:%M:%S.000Z)"
TO="$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null \
      || date -u -v+30d +%Y-%m-%dT%H:%M:%S.000Z)"
api "calendar"              GET  "/api/v1/scheduling/calendar?workspaceId=$WORKSPACE_ID&from=$FROM&to=$TO" "" >/dev/null
[ -n "$POST_ID" ] && api "reschedule post" PATCH "/api/v1/scheduling/posts/$POST_ID/schedule" \
  "$(json_obj scheduledAt "$TO")" >/dev/null

api "search"                GET  "/api/v1/search?workspaceId=$WORKSPACE_ID&q=smoke" "" >/dev/null
api "analytics overview"    GET  "/api/v1/analytics/overview?workspaceId=$WORKSPACE_ID" "" >/dev/null

section "accounts, notifications, admin, ai"
api "social accounts"       GET  "/api/v1/social-accounts/workspaces/$WORKSPACE_ID" "" >/dev/null
api "notifications"         GET  "/api/v1/notifications"                  "" >/dev/null
api "mark all read"         POST "/api/v1/notifications/read-all"         "" >/dev/null
api "ai status"             GET  "/api/v1/ai/status?workspaceId=$WORKSPACE_ID" "" >/dev/null
api "feature flags"         GET  "/api/v1/admin/feature-flags"            "" >/dev/null
api "queues"                GET  "/api/v1/admin/queues"                   "" >/dev/null

# -------------------------------------------------------------------- teardown ----
section "teardown"
[ -n "$SNIPPET_ID" ]  && api "delete snippet"  DELETE "/api/v1/snippets/$SNIPPET_ID"   "" >/dev/null
[ -n "$TEMPLATE_ID" ] && api "delete template" DELETE "/api/v1/templates/$TEMPLATE_ID" "" >/dev/null
[ -n "$CAMPAIGN_ID" ] && api "delete campaign" DELETE "/api/v1/campaigns/$CAMPAIGN_ID" "" >/dev/null
[ -n "$FOLDER_ID" ]   && api "delete folder"   DELETE "/api/v1/media/folders/$FOLDER_ID" "" >/dev/null
[ -n "$TAG_ID" ]      && api "delete tag"      DELETE "/api/v1/tags/$TAG_ID"           "" >/dev/null
[ -n "$POST_ID" ]     && api "delete post"     DELETE "/api/v1/posts/$POST_ID"         "" >/dev/null

# ---------------------------------------------------------------------- report ----
printf '\n'
printf '%s\n' "${RESULTS[@]}"
printf '\n  %s%d passed%s, %s%d failed%s\n\n' \
  "$GREEN" "$PASSED" "$RESET" \
  "$([ "$FAILED" -gt 0 ] && printf '%s' "$RED" || printf '%s' "$DIM")" "$FAILED" "$RESET"
printf '%sNot covered here: a real publish, the OAuth round trip, the storage PUT, and the\n' "$DIM"
printf 'mobile layout. See docs/SMOKE.md.%s\n\n' "$RESET"

[ "$FAILED" -eq 0 ]
