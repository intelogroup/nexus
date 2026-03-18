-- Remove duplicate nodes (keep oldest per user+label+node_type)
-- Only one known duplicate: label='hi', node_type='concept'
DELETE FROM public.knowledge_graph_nodes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, label, node_type
             ORDER BY created_at ASC
           ) AS rn
    FROM public.knowledge_graph_nodes
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint to support upsert ON CONFLICT (user_id, label, node_type)
CREATE UNIQUE INDEX idx_kg_nodes_user_label_type
  ON public.knowledge_graph_nodes (user_id, lower(label), node_type);
