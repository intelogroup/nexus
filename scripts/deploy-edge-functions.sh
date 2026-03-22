#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions for the autonomous research loop
# Usage: ./scripts/deploy-edge-functions.sh [--dry-run]
#
# Prerequisites:
#   - supabase CLI installed (`brew install supabase/tap/supabase`)
#   - Logged in (`supabase login`)
#   - Project linked (`supabase link --project-ref etqcbdrwmfacsaqegwzd`)
#
# Required secrets (set via `supabase secrets set`):
#   OPENAI_API_KEY — used by all three functions

PROJECT_REF="etqcbdrwmfacsaqegwzd"
FUNCTIONS=(
  "scan-knowledge-gaps"
  "execute-research"
  "compress-knowledge"
)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] Would deploy the following functions:"
fi

cd "$(dirname "$0")/.."

# Verify supabase CLI
if ! command -v supabase &>/dev/null; then
  echo "Error: supabase CLI not found. Install with: brew install supabase/tap/supabase"
  exit 1
fi

# Verify project is linked
if ! supabase projects list &>/dev/null 2>&1; then
  echo "Error: Not logged in. Run: supabase login"
  exit 1
fi

# Verify function source files exist
for fn in "${FUNCTIONS[@]}"; do
  if [[ ! -f "supabase/functions/$fn/index.ts" ]]; then
    echo "Error: Missing source file supabase/functions/$fn/index.ts"
    exit 1
  fi
done

echo "Deploying ${#FUNCTIONS[@]} edge functions to project $PROJECT_REF..."
echo ""

FAILED=()
for fn in "${FUNCTIONS[@]}"; do
  echo "--- Deploying: $fn ---"
  if $DRY_RUN; then
    echo "  [dry-run] supabase functions deploy $fn --project-ref $PROJECT_REF"
  else
    if supabase functions deploy "$fn" --project-ref "$PROJECT_REF"; then
      echo "  OK: $fn deployed"
    else
      echo "  FAILED: $fn"
      FAILED+=("$fn")
    fi
  fi
  echo ""
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "Deployment completed with errors."
  echo "Failed functions: ${FAILED[*]}"
  exit 1
fi

echo "All edge functions deployed successfully."
echo ""
echo "Next steps:"
echo "  1. Set secrets if not already done:"
echo "     supabase secrets set OPENAI_API_KEY=sk-... --project-ref $PROJECT_REF"
echo ""
echo "  2. Set up pg_cron schedules in the Supabase dashboard SQL editor:"
echo "     -- scan-knowledge-gaps: twice daily (8am, 8pm UTC)"
echo "     select cron.schedule("
echo "       'scan-knowledge-gaps',"
echo "       '0 8,20 * * *',"
echo "       \$\$select net.http_post("
echo "         url := 'https://$PROJECT_REF.supabase.co/functions/v1/scan-knowledge-gaps',"
echo "         headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),"
echo "         body := '{}'::jsonb"
echo "       )\$\$"
echo "     );"
echo ""
echo "     -- execute-research: every 15 minutes"
echo "     select cron.schedule("
echo "       'execute-research',"
echo "       '*/15 * * * *',"
echo "       \$\$select net.http_post("
echo "         url := 'https://$PROJECT_REF.supabase.co/functions/v1/execute-research',"
echo "         headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),"
echo "         body := '{}'::jsonb"
echo "       )\$\$"
echo "     );"
echo ""
echo "     -- compress-knowledge: weekly Sundays 2am UTC"
echo "     select cron.schedule("
echo "       'compress-knowledge',"
echo "       '0 2 * * 0',"
echo "       \$\$select net.http_post("
echo "         url := 'https://$PROJECT_REF.supabase.co/functions/v1/compress-knowledge',"
echo "         headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),"
echo "         body := '{}'::jsonb"
echo "       )\$\$"
echo "     );"
