-- ============================================================
-- Migration 006: DB Performance Optimization
-- Applied via mcp__supabase-nexus__apply_migration only
-- NEVER run supabase db push
-- ============================================================

-- ============================================================
-- SECTION 1: Fix RLS policies — replace auth.uid() with
-- (select auth.uid()) to evaluate once per query, not per row
-- ============================================================

-- knowledge_graph_nodes
DROP POLICY IF EXISTS "Users can manage their own knowledge graph nodes" ON public.knowledge_graph_nodes;
CREATE POLICY "Users can manage their own knowledge graph nodes"
  ON public.knowledge_graph_nodes
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- knowledge_graph_edges
DROP POLICY IF EXISTS "Users can manage their own knowledge graph edges" ON public.knowledge_graph_edges;
CREATE POLICY "Users can manage their own knowledge graph edges"
  ON public.knowledge_graph_edges
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- graphs
DROP POLICY IF EXISTS "Users manage own graphs" ON public.graphs;
CREATE POLICY "Users manage own graphs"
  ON public.graphs
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- knowledge_gaps
DROP POLICY IF EXISTS "Users manage own gaps" ON public.knowledge_gaps;
CREATE POLICY "Users manage own gaps"
  ON public.knowledge_gaps
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- notifications
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications"
  ON public.notifications
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- agent_feedback_stats
DROP POLICY IF EXISTS "Users manage own feedback stats" ON public.agent_feedback_stats;
CREATE POLICY "Users manage own feedback stats"
  ON public.agent_feedback_stats
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- user_agent_settings
DROP POLICY IF EXISTS "Users manage own agent settings" ON public.user_agent_settings;
CREATE POLICY "Users manage own agent settings"
  ON public.user_agent_settings
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- research_goals
DROP POLICY IF EXISTS "Users manage own goals" ON public.research_goals;
CREATE POLICY "Users manage own goals"
  ON public.research_goals
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- research_reports
DROP POLICY IF EXISTS "Users manage own reports" ON public.research_reports;
CREATE POLICY "Users manage own reports"
  ON public.research_reports
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- profiles — insert
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles
  FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

-- profiles — update
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles
  FOR UPDATE
  USING ((select auth.uid()) = id);

-- message_embeddings — EXISTS subquery
DROP POLICY IF EXISTS "Users can manage their own message embeddings" ON public.message_embeddings;
CREATE POLICY "Users can manage their own message embeddings"
  ON public.message_embeddings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = message_embeddings.chat_id
        AND chats.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = message_embeddings.chat_id
        AND chats.owner_id = (select auth.uid())
    )
  );

-- messages_delete — FOR DELETE only (no WITH CHECK on DELETE policies)
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete"
  ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
        AND chats.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- SECTION 2: Drop 7 unused indexes
-- (IVFFlat indexes kept — reserved for upcoming vector search)
-- ============================================================

DROP INDEX IF EXISTS public.idx_kg_nodes_user_label;
DROP INDEX IF EXISTS public.idx_nodes_graph_importance;
DROP INDEX IF EXISTS public.idx_kg_nodes_domain_id;
DROP INDEX IF EXISTS public.idx_kg_nodes_level;
DROP INDEX IF EXISTS public.idx_kg_nodes_parent;
DROP INDEX IF EXISTS public.kg_nodes_chat_msg_idx;
DROP INDEX IF EXISTS public.chat_members_user_id_idx;

-- ============================================================
-- SECTION 3: Add FK covering indexes
-- Note: CREATE INDEX (not CONCURRENTLY) — required inside
-- a transaction block as used by apply_migration
-- ============================================================

-- knowledge_graph_nodes: message FK (covers all 32 partition FKs + kg_nodes_message_fkey)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_message_id_chat_id
  ON public.knowledge_graph_nodes (message_id, chat_id);

-- knowledge_graph_nodes: graph FK
CREATE INDEX IF NOT EXISTS idx_kg_nodes_graph_id
  ON public.knowledge_graph_nodes (graph_id);

-- knowledge_graph_edges: graph FK
CREATE INDEX IF NOT EXISTS idx_kg_edges_graph_id
  ON public.knowledge_graph_edges (graph_id);

-- domain_ontology: domain FK (existing unique index has domain_id as 2nd col, not reliable)
CREATE INDEX IF NOT EXISTS idx_domain_ontology_domain_id
  ON public.domain_ontology (domain_id);

-- graphs: user FK
CREATE INDEX IF NOT EXISTS idx_graphs_user_id
  ON public.graphs (user_id);

-- knowledge_gaps: graph + user FKs
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_graph_id
  ON public.knowledge_gaps (graph_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_user_id
  ON public.knowledge_gaps (user_id);

-- research_goals: user, graph, gap, result_report FKs
CREATE INDEX IF NOT EXISTS idx_research_goals_user_id
  ON public.research_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_research_goals_graph_id
  ON public.research_goals (graph_id);
CREATE INDEX IF NOT EXISTS idx_research_goals_gap_id
  ON public.research_goals (gap_id);
CREATE INDEX IF NOT EXISTS idx_research_goals_result_report
  ON public.research_goals (result_report_id);

-- research_reports: user + graph FKs
CREATE INDEX IF NOT EXISTS idx_research_reports_user_id
  ON public.research_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_research_reports_graph_id
  ON public.research_reports (graph_id);

-- message_embeddings: message FK (covers 32 partition FKs — same pattern as kg_nodes)
CREATE INDEX IF NOT EXISTS idx_message_embeddings_msg_chat
  ON public.message_embeddings (message_id, chat_id);
