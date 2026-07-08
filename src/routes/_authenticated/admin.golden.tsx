import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeManager, KnowledgeManagerHint } from "@/components/ajrasakha/knowledge-manager";

export const Route = createFileRoute("/_authenticated/admin/golden")({
  ssr: false,
  component: GoldenAdminPage,
});

function GoldenAdminPage() {
  return (
    <div className="space-y-4">
      <KnowledgeManager
        tier="golden"
        title="Golden Dataset"
        description="Expert-verified answers. Served to farmers with the green Verified badge."
        fields={["source", "crop", "state", "district", "block", "season", "soilType"]}
        accent="green"
      />
      <KnowledgeManagerHint
        title="Bulk import format"
        csvColumns={["question", "answer", "source", "crop", "state", "district", "block", "season", "soil_type"]}
      />
    </div>
  );
}