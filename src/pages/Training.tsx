import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui/alert-dialog";
import { Button } from "@/ui/button";
import {
  Download,
  Loader2,
  Package,
  Play,
  Square,
  Timer,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useTraining } from "@/hooks/useTraining";

export default function TrainingPage() {
  const {
    files,
    isTraining,
    logs,
    progress,
    elapsedTime,
    isModelReady,
    handleFileChange,
    loadDefaultDataset,
    startTraining,
    stopTraining,
    exportModel,
  } = useTraining();
  
  const [showStopDialog, setShowStopDialog] = useState(false);

  const handleStopTraining = () => {
    stopTraining();
    setShowStopDialog(false);
  };

  return (
    <div className="p-6 bg-zinc-900 min-h-screen text-white flex flex-col gap-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Play className="text-blue-500" />
        Entraînement Local (CNN)
      </h1>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">1. Charger le Dataset (ZIPs)</h2>
        <div className="flex gap-4 items-center">
          <Button variant="secondary" onClick={loadDefaultDataset}>
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
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </Button>

          <span className="text-zinc-400">
            {files.length} fichiers sélectionnés
          </span>
        </div>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">2. Entraîner le Modèle</h2>
        <div className="flex gap-4 items-center">
          {!isTraining ? (
            <Button
              onClick={startTraining}
              disabled={files.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Lancer l'entraînement
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button disabled className="bg-blue-600/50 cursor-not-allowed">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                En cours...
              </Button>

              <AlertDialog
                open={showStopDialog}
                onOpenChange={setShowStopDialog}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Square className="mr-2 h-4 w-4 fill-current" />
                    Arrêter
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Arrêter l'entraînement ?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      Cette action est irréversible. Le modèle en cours
                      d'apprentissage sera perdu.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700 border-zinc-700">
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleStopTraining}
                      className="bg-red-600 hover:bg-red-700 text-white border-0"
                    >
                      Confirmer l'arrêt
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div
            className={cn(
              "flex gap-4 text-sm font-mono ml-4",
              !isTraining && "brightness-50"
            )}
          >
            <span className="text-zinc-400 flex gap-2 items-center justify-center">
              <Timer className="size-4" /> {elapsedTime}s
            </span>
            <span className="text-yellow-400">Epoch: {progress.epoch}</span>
            <span className="text-red-400">
              Loss: {progress.loss.toFixed(4)}
            </span>
            <span className="text-green-400">
              Acc: {(progress.acc * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Logs Console */}
        <div className="mt-4 bg-black p-2 rounded h-40 overflow-y-auto font-mono text-xs text-zinc-400 border border-zinc-700">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">3. Exporter</h2>
        <Button
          onClick={exportModel}
          disabled={!isModelReady}
          className="bg-green-600 hover:bg-green-700"
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger model.json
        </Button>
      </div>
    </div>
  );
}
