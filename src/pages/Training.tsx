import { cn } from "@/lib/utils";
import { Trainer, TrainingConfig } from "@/modules/training/Trainer";
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
import * as tf from "@tensorflow/tfjs";
import {
  Download,
  Loader2,
  Package,
  Play,
  Square,
  Timer,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function TrainingPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({
    epoch: 0,
    loss: 0,
    acc: 0,
    val_loss: 0,
    val_acc: 0,
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const trainerRef = useRef<Trainer>(new Trainer());
  const [isModelReady, setIsModelReady] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    const trainer = trainerRef.current;
    return () => {
      if (trainer) {
        trainer.dispose();
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setLogs((prev) => [...prev, `Selected ${e.target.files?.length} files.`]);
    }
  };

  const loadDefaultDataset = async () => {
    try {
      setLogs((prev) => [
        ...prev,
        "Tentative de chargement du dataset par défaut...",
      ]);

      // 1. Fetch Manifest
      const manifestRes = await fetch("/dataset/manifest.json");
      if (!manifestRes.ok) {
        throw new Error("Manifest non trouvé (public/dataset/manifest.json)");
      }
      const filenames: string[] = await manifestRes.json();
      setLogs((prev) => [
        ...prev,
        `Manifest chargé: ${filenames.length} fichiers trouvés.`,
      ]);

      // 2. Fetch all ZIPs
      const loadedFiles: File[] = [];
      for (const filename of filenames) {
        setLogs((prev) => [...prev, `Chargement de ${filename}...`]);
        const response = await fetch(`/dataset/${filename}`);
        if (!response.ok) {
          setLogs((prev) => [...prev, `Erreur chargement ${filename}`]);
          continue;
        }
        const blob = await response.blob();
        const file = new File([blob], filename, { type: "application/zip" });
        loadedFiles.push(file);
      }

      setFiles(loadedFiles);
      setLogs((prev) => [
        ...prev,
        `Dataset complet chargé: ${loadedFiles.length} fichiers ZIP.`,
      ]);
    } catch (e) {
      console.error(e);
      setLogs((prev) => [...prev, `Erreur chargement défaut: ${e}`]);
    }
  };

  const handleStopTraining = () => {
    trainerRef.current.stop();
    setLogs((prev) => [...prev, "Stopping training..."]);
    setShowStopDialog(false);
  };

  const startTraining = async () => {
    setIsTraining(true);
    setIsModelReady(false);
    setLogs([]);
    setElapsedTime(0);

    // Start Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let data: { xs: tf.Tensor4D; ys: tf.Tensor2D } | null = null;

    try {
      setLogs((prev) => [...prev, "Loading dataset from ZIPs..."]);

      // 1. Load Data
      data = await trainerRef.current.loadDatasetFromZips(
        files,
        (count, total) => {
          setLogs((prev) => {
            const lastLog = prev[prev.length - 1];
            const msg = `Loading & Augmenting: ${count}/${total} source images...`;
            if (lastLog && lastLog.startsWith("Loading & Augmenting:")) {
              return [...prev.slice(0, -1), msg];
            }
            return [...prev, msg];
          });
        }
      );

      setLogs((prev) => [
        ...prev,
        `Dataset ready: ${data?.xs.shape[0]} samples (including augmentation).`,
      ]);

      // 2. Configure Training
      const config: TrainingConfig = {
        epochs: 20,
        batchSize: 8, // Reduced to prevent WebGL Context Loss / GPU Crash
      };

      // 3. Train
      setLogs((prev) => [
        ...prev,
        "Starting training... (This may take a while)",
      ]);

      // Initialize Backend for Mobile
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const backend = tf.getBackend();
        setLogs((prev) => [...prev, `TF.js Backend initialized: ${backend}`]);

        if (backend === "webgl") {
          const gl = (tf.backend() as tf.MathBackendWebGL).getGPGPUContext().gl;
          setLogs((prev) => [
            ...prev,
            `WebGL Info: ${gl.getParameter(gl.RENDERER)}`,
          ]);
        }
      } catch (e) {
        setLogs((prev) => [
          ...prev,
          `Warning: WebGL init failed, falling back. Error: ${e}`,
        ]);
      }

      // Log memory before training
      const mem = tf.memory();
      setLogs((prev) => [
        ...prev,
        `Memory: ${Math.round(mem.numBytes / 1024 / 1024)} MB (${
          mem.numTensors
        } tensors)`,
      ]);

      if (data) {
        setLogs((prev) => [
          ...prev,
          `Starting training with ${data?.xs.shape[0]} samples...`,
        ]);
        await trainerRef.current.train(data, config, (epoch, logs) => {
          const loss = logs?.loss ? logs.loss.toFixed(4) : "0.0000";
          const acc = logs?.acc ? logs.acc.toFixed(4) : "0.0000";

          setLogs((prev) => [
            ...prev,
            `Epoch ${epoch}: loss=${loss}, acc=${acc}`,
          ]);

          setProgress({
            epoch,
            loss: logs?.loss || 0,
            acc: logs?.acc || 0,
            val_loss: 0,
            val_acc: 0,
          });
        });
      }

      setLogs((prev) => [...prev, "Training completed!"]);
      setIsModelReady(true);
    } catch (err) {
      console.error(err);
      setLogs((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setIsTraining(false);
      if (timerRef.current) clearInterval(timerRef.current);

      // Cleanup Tensors
      if (data) {
        data.xs.dispose();
        data.ys.dispose();
      }

      // Final cleanup check
      const mem = tf.memory();
      console.log("Memory after cleanup:", mem);
    }
  };

  const exportModel = async () => {
    try {
      await trainerRef.current.exportModel();
      setLogs((prev) => [...prev, "Model exported to downloads folder."]);
    } catch (err) {
      console.error(err);
      setLogs((prev) => [...prev, "Export failed."]);
    }
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
