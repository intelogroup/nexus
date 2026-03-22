import { KnowledgeGraph } from "@/components/chat/knowledge-graph";

export default function GraphPage() {
  return (
    <div className="h-full w-full p-4 lg:p-8 overflow-auto">
      <KnowledgeGraph />
    </div>
  );
}
