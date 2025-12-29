import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface TrainingExportProps {
  isModelReady: boolean;
  onExport: () => void;
}

export function TrainingExport({
  isModelReady,
  onExport,
}: TrainingExportProps) {
  return (
    <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
      <h2 className="font-bold mb-4">3. Exporter</h2>
      <Button
        onClick={onExport}
        disabled={!isModelReady}
        className="bg-green-600 hover:bg-green-700"
      >
        <Download className="mr-2 h-4 w-4" />
        Télécharger model.json
      </Button>
    </div>
  );
}
