import { Button } from "@/ui/button";
import { Download, GraduationCap, Play, RotateCcw } from "lucide-react";
import { TRAINABLE_LABELS, TRAINING_STEPS } from "../constants";

interface ScanTrainingControlsProps {
  isTrainingMode: boolean;
  exampleCounts: { [label: string]: number };
  sessionCount: number;
  selectedLabel: string;
  onSelectLabel: (label: string) => void;
  trainingStep: number;
  stepProgress: number;
  onTrainClick: () => void;
  onExportClick: () => void;
  onResetClick: () => void;
  onShowGallery: () => void;
}

export function ScanTrainingControls({
  isTrainingMode,
  exampleCounts,
  sessionCount,
  selectedLabel,
  onSelectLabel,
  trainingStep,
  stepProgress,
  onTrainClick,
  onExportClick,
  onResetClick,
  onShowGallery,
}: ScanTrainingControlsProps) {
  if (!isTrainingMode) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 z-20 border-t border-blue-500/50">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-blue-400 font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Mode Entraînement
          </h3>
          <span className="text-xs text-zinc-400">
            {Object.values(exampleCounts).reduce((a, b) => a + b, 0)} exemples
          </span>
          {sessionCount > 0 && (
            <span
              className="text-xs text-yellow-400 font-bold animate-pulse cursor-pointer underline decoration-dotted"
              onClick={onShowGallery}
            >
              {sessionCount} en attente
            </span>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {TRAINABLE_LABELS.map((label) => (
            <button
              key={label}
              onClick={() => onSelectLabel(label)}
              className={`px-3 py-2 rounded font-mono text-sm border whitespace-nowrap ${
                selectedLabel === label
                  ? "bg-blue-500 border-blue-400 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {label}{" "}
              <span className="text-[10px] opacity-60 ml-1">
                ({exampleCounts[label] || 0})
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 h-auto py-3 flex flex-col items-center gap-1"
            onClick={onTrainClick}
          >
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4" />{" "}
              <span>Apprendre "{selectedLabel}"</span>
            </div>
            <span className="text-[10px] font-normal opacity-90">
              {TRAINING_STEPS[trainingStep].name} ({stepProgress}/
              {TRAINING_STEPS[trainingStep].target === 999
                ? "∞"
                : TRAINING_STEPS[trainingStep].target}
              )
            </span>
          </Button>

          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700 h-auto flex flex-col items-center justify-center px-4"
            onClick={onExportClick}
          >
            <Download className="h-5 w-5 mb-1" />{" "}
            <span className="text-xs font-bold">Zip</span>
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="h-auto w-12"
            onClick={onResetClick}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
