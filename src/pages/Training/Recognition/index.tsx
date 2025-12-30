
import { useTraining } from "@/hooks/useTraining";
import { Play } from "lucide-react";

import { ConfusionMatrix } from "@/pages/Training/components/ConfusionMatrix";
import { TrainingCharts } from "@/pages/Training/components/TrainingCharts";
import { DatasetLoader } from "@/pages/Training/components/DatasetLoader";
import { DatasetStats } from "@/pages/Training/components/DatasetStats";
import { TrainingControls } from "@/pages/Training/components/TrainingControls";
import { TrainingExport } from "@/pages/Training/components/TrainingExport";
import { TrainingLogs } from "@/pages/Training/components/TrainingLogs";

export default function RecognitionTraining() {
  const {
    files,
    isTraining,
    logs,
    datasetStats,
    progress,
    history,
    elapsedTime,
    isModelReady,
    confusionMatrix,
    handleFileChange,
    loadDefaultDataset,
    startTraining,
    stopTraining,
    exportModel,
    importHistory,
  } = useTraining();

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
            <Play className="text-blue-500 w-5 h-5" />
            Entraînement CNN (Reconnaissance)
        </h2>
        <p className="text-zinc-400 text-sm">
            Entraînez le modèle de classification pour reconnaître la valeur des cartes (-2 à 12).
        </p>
      </div>

      <DatasetLoader
        onLoadDefault={loadDefaultDataset}
        onFileChange={handleFileChange}
        onImportHistory={importHistory}
        filesCount={files.length}
      />

      <TrainingControls
        isTraining={isTraining}
        filesCount={files.length}
        onStart={startTraining}
        onStop={stopTraining}
        elapsedTime={elapsedTime}
        progress={progress}
      />

      {/* Logs & Stats Grid */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 h-80">
        <TrainingLogs logs={logs} />
        <DatasetStats stats={datasetStats} />
      </div>

      {/* Charts */}
      {history.length > 0 && (
        <div className="mt-4">
          <TrainingCharts data={history} />
        </div>
      )}

      {/* Confusion Matrix */}
      {confusionMatrix && (
        <div className="mt-4">
          <ConfusionMatrix data={confusionMatrix} />
        </div>
      )}

      <TrainingExport isModelReady={isModelReady} onExport={handleExport} />
    </div>
  );
}
