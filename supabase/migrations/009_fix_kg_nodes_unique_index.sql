-- Drop expression index (lower(label)) — PostgREST can't match it to onConflict: 'user_id,label,node_type'
DROP INDEX IF EXISTS public.idx_kg_nodes_user_label_type;

-- Plain unique index on (user_id, label, node_type) — matches the upsert conflict target exactly
-- Code already normalizes label to lowercase before inserting, so this is safe
CREATE UNIQUE INDEX idx_kg_nodes_user_label_type
  ON public.knowledge_graph_nodes (user_id, label, node_type);
