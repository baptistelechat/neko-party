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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TrainingProgress } from "@/hooks/useTraining";
import { cn } from "@/lib/utils";
import { Loader2, Play, Square, Timer } from "lucide-react";
import { useState } from "react";

interface TrainingControlsProps {
  isTraining: boolean;
  filesCount: number;
  onStart: () => void;
  onStop: () => void;
  elapsedTime: number;
  progress: TrainingProgress;
}

export function TrainingControls({
  isTraining,
  filesCount,
  onStart,
  onStop,
  elapsedTime,
  progress,
}: TrainingControlsProps) {
  const [showStopDialog, setShowStopDialog] = useState(false);

  const handleStopTraining = () => {
    onStop();
    setShowStopDialog(false);
  };

  return (
    <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
      <h2 className="font-bold mb-4">2. Entraîner le Modèle</h2>
      <div className="flex gap-4 items-center">
        {!isTraining ? (
          <Button
            onClick={onStart}
            disabled={filesCount === 0}
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

            <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Square className="mr-2 h-4 w-4 fill-current" />
                  Arrêter
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Arrêter l'entraînement ?</AlertDialogTitle>
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
    </div>
  );
}
