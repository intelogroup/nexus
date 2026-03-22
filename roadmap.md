# Nexus (Omnichat) — Roadmap

Focus: complete the knowledge loop — messages come in, knowledge is extracted, insights surface to the user. Graph and research features are built; the missing piece is making them visible and actionable.

---

## P0 — Journey Blockers (ship these first)

- [x] **Deploy edge functions** — `scan-knowledge-gaps`, `execute-research`, `compress-knowledge` deployed to project `etqcbdrwmfacsaqegwzd` (2026-03-22)
- [x] **Knowledge browse UI** — graph visualization exists but isn't the right entry point; add a searchable list/table of KG nodes so users can find what the system learned
- [x] **Research goal approval flow UI** — inbox-style UI at `/research-inbox` with approve/dismiss, status filtering, confidence display (2026-03-22)
- [x] **Notification delivery** — `NotificationBell` component fetches from `/api/notifications`, has realtime subscription via Supabase channels, dismiss/approve flow; mounted in topbar; API routes have auth + validation + tests (2026-03-22)
- [x] **Snap page** — full capture flow: `/snap?chatId=X` loads messages, generates structured graph via AI streaming, outline + flow views, localStorage caching, regeneration; navigation wired from layout-client (2026-03-22)

---

## P1 — User Journey Completeness

- [x] **Knowledge node detail view** — click a node in the graph or list to see: what it is, which messages it came from, related nodes, research findings (2026-03-22)
- [ ] **Chat with knowledge context toggle** — let user turn knowledge augmentation on/off per chat; show which nodes influenced an answer
- [x] **Research report reader** — surface completed research reports in a readable format inside the app (not just DB rows) (2026-03-22)
- [ ] **Knowledge gap notifications** — when `scan-knowledge-gaps` finds a gap, show it prominently: "We noticed you lack knowledge about X — approve research?"
- [ ] **Chat search** — full-text search across all chats; Supabase already has the data
- [ ] **User profile / settings page** — currently missing entirely; minimum: display name, timezone, model preference, notification opt-ins

---

## P2 — Quality of Life

- [ ] **Knowledge export** — export KG as JSON or markdown for personal backup
- [ ] **Graph filter controls** — filter by node type, date, confidence score; graph is already built, just needs UI controls
- [ ] **Weekly knowledge digest** — email or in-app summary: new nodes added, research completed, gaps discovered this week
- [ ] **Brain Nexus SYNC_ALL crash fix** — known race condition in Cytoscape render on first click (see CLAUDE.md known bugs)
- [ ] **Model selector persistence** — remember chosen model per chat across sessions

---

## Out of Scope (do not build)

- Multi-user workspaces or team knowledge bases
- New AI model integrations (model registry is sufficient)
- Adding new knowledge node types beyond the 8 defined (do not alter constraint)
- Real-time collaborative editing of the knowledge graph
- Public knowledge sharing or publishing
