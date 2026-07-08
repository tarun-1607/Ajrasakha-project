import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeManager, KnowledgeManagerHint } from "@/components/ajrasakha/knowledge-manager";

export const Route = createFileRoute("/_authenticated/admin/pop")({
  ssr: false,
  component: PopAdminPage,
});

function PopAdminPage() {
  return (
    <div className="space-y-4">
      <KnowledgeManager
        tier="pop"
        title="Package of Practices"
        description="Regional PoP entries served to farmers with the blue Package of Practices badge."
        fields={["source", "crop", "category", "state", "district", "block", "season", "soilType"]}
        accent="blue"
      />
      <KnowledgeManagerHint
        title="Bulk import format"
        csvColumns={["question", "answer", "source", "crop", "category", "state", "district", "block", "season", "soil_type"]}
      />
    </div>
  );
}