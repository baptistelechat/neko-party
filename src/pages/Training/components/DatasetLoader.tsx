import { Button } from "@/components/ui/button";
import { FileText, Package, Upload } from "lucide-react";

interface DatasetLoaderProps {
  onLoadDefault: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportHistory: (file: File) => void;
  filesCount: number;
}

export function DatasetLoader({
  onLoadDefault,
  onFileChange,
  onImportHistory,
  filesCount,
}: DatasetLoaderProps) {
  return (
    <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
      <h2 className="font-bold mb-4">1. Charger le Dataset (ZIPs)</h2>
      <div className="flex gap-4 items-center">
        <Button variant="secondary" onClick={onLoadDefault}>
          <Package className="mr-2 h-4 w-4" />
          Charger le dataset existant
        </Button>

        <Button variant="secondary" className="relative">
          <Upload className="mr-2 h-4 w-4" />
          Sélectionner ZIPs
          <input
            type="file"
            multiple
            accept=".zip"
            onChange={onFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </Button>

        <Button variant="secondary" className="relative">
          <FileText className="mr-2 h-4 w-4" />
          Réanalyser Historique
          <input
            type="file"
            accept=".txt"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onImportHistory(e.target.files[0]);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </Button>

        <span className="text-zinc-400">
          {filesCount} fichiers sélectionnés
        </span>
      </div>
    </div>
  );
}
