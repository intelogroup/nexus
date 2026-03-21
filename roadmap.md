# Nexus (Omnichat) — Roadmap

Focus: complete the knowledge loop — messages come in, knowledge is extracted, insights surface to the user. Graph and research features are built; the missing piece is making them visible and actionable.

---

## P0 — Journey Blockers (ship these first)

- [ ] **Deploy edge functions** — `scan-knowledge-gaps`, `execute-research`, `compress-knowledge` are built but not deployed; the autonomous research loop cannot run without them
- [x] **Knowledge browse UI** — graph visualization exists but isn't the right entry point; add a searchable list/table of KG nodes so users can find what the system learned
- [ ] **Research goal approval flow UI** — backend approval exists; add inbox-style UI so users can approve/reject pending research goals without going to the DB
- [ ] **Notification delivery** — notifications are generated but `notifications/*` routes are untested; wire up in-app notification bell as read-only first
- [ ] **Snap page** — clarify and complete: if it's a quick-capture tool, build the minimal capture → tag → save flow; if stub, remove it

---

## P1 — User Journey Completeness

- [ ] **Knowledge node detail view** — click a node in the graph or list to see: what it is, which messages it came from, related nodes, research findings
- [ ] **Chat with knowledge context toggle** — let user turn knowledge augmentation on/off per chat; show which nodes influenced an answer
- [ ] **Research report reader** — surface completed research reports in a readable format inside the app (not just DB rows)
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
