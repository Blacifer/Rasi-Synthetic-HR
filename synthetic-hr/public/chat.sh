#!/usr/bin/env bash
# RASI Agent Terminal Chat
# Usage: curl -fsSL https://rasi-synthetic-hr.vercel.app/chat.sh | bash -s -- sk_YOUR_KEY YOUR_AGENT_ID
# Or:    bash chat.sh sk_YOUR_KEY YOUR_AGENT_ID

set -e

API_KEY="${1:-}"
AGENT_ID="${2:-}"
BASE_URL="${3:-https://rasi-synthetic-hr-production.up.railway.app}"
ENDPOINT="${BASE_URL}/v1/agents/${AGENT_ID}/chat"

if [[ -z "$API_KEY" || -z "$AGENT_ID" ]]; then
  echo "Usage: bash chat.sh <api_key> <agent_id>"
  echo "       curl -fsSL https://rasi-synthetic-hr.vercel.app/chat.sh | bash -s -- sk_xxx agent_id"
  exit 1
fi

if ! command -v curl &>/dev/null; then
  echo "Error: curl is required but not installed."
  exit 1
fi

echo ""
echo "  RASI Agent Chat"
echo "  Agent: ${AGENT_ID}"
echo "  Type your message and press Enter. Press Ctrl+C to quit."
echo ""

CONVERSATION_ID=""

while true; do
  IFS= read -rp "You: " msg </dev/tty || break
  # Strip control characters (e.g. Ctrl+R, Ctrl+C sequences that slip through)
  msg="${msg//[$'\001'-$'\037']}"
  [[ -z "$msg" ]] && continue

  # Build JSON body — include conversation_id on subsequent turns to group messages
  msg_json=$(printf '%s' "$msg" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$(echo "$msg" | sed 's/"/\\"/g')")
  if [[ -n "$CONVERSATION_ID" ]]; then
    body="{\"message\": ${msg_json}, \"conversation_id\": \"${CONVERSATION_ID}\"}"
  else
    body="{\"message\": ${msg_json}}"
  fi

  response=$(
    curl -sf -X POST "$ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d "$body" \
      2>/dev/null
  )

  if [[ -z "$response" ]]; then
    echo "Agent: [No response — check your API key and agent ID]"
    continue
  fi

  # Extract reply and conversation_id from JSON
  reply=$(
    echo "$response" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("reply",""))' 2>/dev/null ||
    echo "$response" | grep -o '"reply":"[^"]*"' | sed 's/"reply":"//;s/"$//' 2>/dev/null ||
    echo "[Could not parse response]"
  )

  # Persist conversation_id for session continuity
  if [[ -z "$CONVERSATION_ID" ]]; then
    CONVERSATION_ID=$(echo "$response" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("conversation_id") or "")' 2>/dev/null || true)
  fi

  echo "Agent: ${reply}"
  echo ""
done

echo ""
echo "Goodbye!"
