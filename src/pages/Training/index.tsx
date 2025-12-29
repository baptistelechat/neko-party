import { useTraining } from "@/hooks/useTraining";
import { Play } from "lucide-react";

import { ConfusionMatrix } from "@/components/ConfusionMatrix";
import { TrainingCharts } from "@/pages/Training/components/TrainingCharts";
import { DatasetLoader } from "@/pages/Training/components/DatasetLoader";
import { DatasetStats } from "@/pages/Training/components/DatasetStats";
import { TrainingControls } from "@/pages/Training/components/TrainingControls";
import { TrainingExport } from "@/pages/Training/components/TrainingExport";
import { TrainingLogs } from "@/pages/Training/components/TrainingLogs";

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
    <div className="p-6 bg-zinc-900 min-h-screen text-white flex flex-col gap-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Play className="text-blue-500" />
        Entraînement Local Convolutional Neural Network (CNN)
      </h1>

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
