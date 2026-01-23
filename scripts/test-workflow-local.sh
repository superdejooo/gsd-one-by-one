#!/bin/bash
# Local GitHub Actions workflow testing using `act`
# Usage: ./scripts/test-workflow-local.sh [--dryrun]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Create test event payload
EVENT_FILE="/tmp/gsd_issue_comment_event.json"
cat > "$EVENT_FILE" << 'EOF'
{
  "action": "created",
  "issue": {
    "number": 1
  },
  "comment": {
    "body": "@gsd-bot execute-phase 9"
  },
  "repository": {
    "name": "gsd-one-by-one",
    "owner": {
      "login": "superdejooo"
    }
  }
}
EOF

echo "Event file created at $EVENT_FILE"

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "act is not installed. Install with: brew install act"
    exit 1
fi

# Set default options
DRYRUN=""
if [[ "$1" == "--dryrun" ]]; then
    DRYRUN="--dryrun"
    echo "Running in DRY RUN mode"
fi

# Run act
cd "$PROJECT_DIR"
echo "Running workflow test..."
act issue_comment \
    $DRYRUN \
    -e "$EVENT_FILE" \
    -W .github/workflows/gsd-command-handler.yml \
    --container-architecture linux/amd64 \
    -s GITHUB_TOKEN="$(gh auth token)" \
    -s OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-dummy}" \
    -s ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-dummy}" \
    -s DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-dummy}"
