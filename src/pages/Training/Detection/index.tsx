import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

interface DatasetFile {
  name: string;
  size: number;
}

export default function DetectionTraining() {
  const [datasetFiles, setDatasetFiles] = useState<DatasetFile[]>([]);

  useEffect(() => {
    // Check for existing dataset files in public/dataset
    // This is a bit tricky in client-side, we'll fetch the manifest
    fetch("/dataset/manifest.json")
      .then((res) => res.json())
      .then((data) => {
        const files = data.map((entry: any) => ({
          name: entry.filename,
          size: entry.size || 0,
        }));
        setDatasetFiles(files);
      })
      .catch((e) => console.warn("No manifest found", e));
  }, []);

  return (
    <div className="flex flex-col gap-6 text-zinc-100">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2 text-green-500">
          <Terminal className="w-5 h-5" />
          Entraînement YOLO (Détection)
        </h2>
        <p className="text-zinc-400 text-sm">
          L'entraînement d'un modèle de détection d'objets (YOLO) nécessite plus
          de puissance de calcul. Le processus se fait en local via un script
          Python.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1: Dataset */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="bg-zinc-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                1
              </span>
              Préparer le Dataset
            </CardTitle>
            <CardDescription>
              Le dataset actuel contient {datasetFiles.length} archives ZIP
              annotées.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="bg-black/50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
              {datasetFiles.length === 0 ? (
                <span className="text-zinc-500">
                  Aucun fichier trouvé. Scannez des cartes d'abord.
                </span>
              ) : (
                datasetFiles.map((f) => (
                  <div
                    key={f.name}
                    className="flex justify-between py-1 border-b border-zinc-800/50 last:border-0"
                  >
                    <span>{f.name}</span>
                    <span className="text-zinc-500">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-sm text-blue-200 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Assurez-vous d'avoir scanné suffisamment de cartes (Raw + BBox)
                via l'écran de Scan avant de commencer.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Training */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="bg-zinc-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                2
              </span>
              Entraînement Local (Python)
            </CardTitle>
            <CardDescription>
              Exécutez le script d'entraînement sur votre machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="bg-black p-4 rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
              <p className="text-zinc-500 mb-2">
                # Dans le dossier du projet :
              </p>

              <p className="mb-1 text-zinc-500">
                # 1. Convertir le dataset (JSON vers YOLO)
              </p>
              <p className="mb-3 text-white">pnpm convert-dataset-yolo</p>

              <p className="mb-1 text-zinc-500">
                # 2. Lancer l'entraînement Python (Setup + Train + Export)
              </p>
              <p className="mb-3 text-white">pnpm train-yolo</p>
              <p className="text-zinc-500 text-[10px]">
                Ou via PowerShell : .\scripts\python_training\train.ps1
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
