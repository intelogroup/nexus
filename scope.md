# Nexus (Omnichat) — Agent Scope

## In-Scope (agent may fix)
- Security: unprotected routes, missing input validation, NaN-unsafe parseInt (already fixed — maintain)
- Console.logs leaking user data or auth tokens
- Missing error handling on API routes
- TypeScript errors (4 known type-only errors — fix cautiously)
- Dead code removal

## Out-of-Scope (agent must NOT touch)
- `knowledge/*` routes — no tests, do not modify
- `notifications/*` routes — no tests, do not modify
- `research-goals/*` routes — no tests, do not modify
- Database migration files
- Files with uncommitted user changes (check git status first)
- Adding new AI model integrations

## Test Requirement
Run `npm test` — all 33 tests must pass. No regressions allowed.
