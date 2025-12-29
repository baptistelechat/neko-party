import { useTraining } from "@/hooks/useTraining";
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
  Copy,
  Download,
  FileText,
  Loader2,
  Package,
  Play,
  Square,
  Timer,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TrainingCharts } from "@/ui/components/TrainingCharts";
import { toast } from "sonner";

export default function TrainingPage() {
  const {
    files,
    isTraining,
    logs,
    datasetStats,
    progress,
    history,
    elapsedTime,
    isModelReady,
    handleFileChange,
    loadDefaultDataset,
    startTraining,
    stopTraining,
    exportModel,
    importHistory,
  } = useTraining();

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const [showStopDialog, setShowStopDialog] = useState(false);

  const handleCopyLogs = () => {
    const summary = logs.join("\n");
    navigator.clipboard.writeText(summary);
    toast.success("Logs copiés dans le presse-papier !");
  };

  const handleStopTraining = () => {
    stopTraining();
    setShowStopDialog(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleExport = () => {
    exportModel(formatTime(elapsedTime));
  };

  return (
    <div className="p-6 bg-zinc-900 min-h-screen text-white flex flex-col gap-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Play className="text-blue-500" />
        Entraînement Local Convolutional Neural Network (CNN)
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

          <Button variant="secondary" className="relative">
            <FileText className="mr-2 h-4 w-4" />
            Réanalyser Historique
            <input
              type="file"
              accept=".txt"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  importHistory(e.target.files[0]);
                }
              }}
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
              Loss: {progress.loss.toFixed(4)}{" "}
              <span className="text-red-300 opacity-70">
                (Validation: {progress.val_loss.toFixed(4)})
              </span>
            </span>
            <span className="text-green-400">
              Accuracy: {(progress.acc * 100).toFixed(1)}%{" "}
              <span className="text-green-300 opacity-70">
                (Validation: {(progress.val_acc * 100).toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>

        {/* Logs & Stats Grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 h-80">
          {/* Logs Console */}
          <div className="lg:col-span-2 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex flex-col">
            <div className="flex items-center justify-between bg-zinc-900 px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300">Logs</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={handleCopyLogs}
              >
                <Copy className="size-1" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {logs.map((log, i) => {
                let colorClass = "text-zinc-300"; // Default
                if (log.includes("Epoch ")) colorClass = "text-zinc-500";
                if (log.includes("loss=")) colorClass = "text-blue-400";
                if (log.includes("⚠️") || log.includes("Balancing"))
                  colorClass = "text-yellow-500";
                if (log.includes("🛑")) colorClass = "text-red-500";
                if (
                  log.includes("♻️") ||
                  log.includes("Training Complete") ||
                  log.includes("Manifest")
                )
                  colorClass = "text-green-500";
                if (log.includes("MobileNet")) colorClass = "text-indigo-500";

                return (
                  <div key={i} className={`${colorClass} mb-1`}>
                    {log}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Distribution Stats Table */}
          <div className="bg-zinc-950 p-0 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex flex-col">
            <div className="bg-zinc-900 p-2 text-xs font-bold text-zinc-300 border-b border-zinc-800">
              Dataset Distribution (Stratified)
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {datasetStats.length === 0 ? (
                <div className="text-zinc-500 text-center italic mt-10">
                  Waiting for data...
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="py-1 px-2">Class</th>
                      <th className="py-1 px-2 text-right">Total</th>
                      <th className="py-1 px-2 text-right">Train</th>
                      <th className="py-1 px-2 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasetStats.map((stat, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                      >
                        <td className="py-1 px-2 font-bold text-zinc-300">
                          {stat.Class}
                        </td>
                        <td className="py-1 px-2 text-right text-zinc-400">
                          {stat.Total}
                        </td>
                        <td className="py-1 px-2 text-right text-zinc-400">
                          {stat.Train}
                        </td>
                        <td className="py-1 px-2 text-right text-zinc-400">
                          {stat.Val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        {history.length > 0 && (
          <div className="mt-4">
            <TrainingCharts data={history} />
          </div>
        )}
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">3. Exporter</h2>
        <Button
          onClick={handleExport}
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
