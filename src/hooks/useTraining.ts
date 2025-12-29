import { Trainer, TrainingConfig } from "@/modules/training/Trainer";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface TrainingProgress {
  epoch: number;
  loss: number;
  acc: number;
  val_loss: number;
  val_acc: number;
}

export interface DatasetStat {
  Class: string;
  Total: number;
  Train: number;
  Val: number;
}

interface ManifestEntry {
  filename: string;
  count: number;
  size: number;
  error?: string;
}

export const useTraining = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [datasetStats, setDatasetStats] = useState<DatasetStat[]>([]);
  const [progress, setProgress] = useState<TrainingProgress>({
    epoch: 0,
    loss: 0,
    acc: 0,
    val_loss: 0,
    val_acc: 0,
  });
  const [history, setHistory] = useState<TrainingProgress[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const trainerRef = useRef<Trainer>(new Trainer());

  // Cleanup on unmount
  useEffect(() => {
    const trainer = trainerRef.current;
    return () => {
      if (trainer) {
        trainer.dispose();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setLogs((prev) => [...prev, `Selected ${e.target.files?.length} files.`]);
      // Estimate 50 images per zip for manual upload
      setTotalImages(e.target.files.length * 50);
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
      const manifest = await manifestRes.json();

      // Handle both old format (string[]) and new format (object[])
      const isNewFormat =
        manifest.length > 0 && typeof manifest[0] !== "string";

      let filenames: string[];
      let calculatedTotalImages: number;

      if (isNewFormat) {
        const entries = manifest as ManifestEntry[];
        filenames = entries.map((entry) => entry.filename);
        calculatedTotalImages = entries.reduce(
          (sum, entry) => sum + (entry.count || 0),
          0
        );
      } else {
        filenames = manifest as string[];
        calculatedTotalImages = filenames.length * 50; // Fallback estimate
      }

      setTotalImages(calculatedTotalImages);

      setLogs((prev) => [
        ...prev,
        `Manifest chargé: ${filenames.length} fichiers trouvés (${calculatedTotalImages} images).`,
      ]);

      // 2. Fetch all ZIPs
      const loadedFiles: File[] = [];
      for (const filename of filenames) {
        setLogs((prev) => [...prev, `Chargement de ${filename}...`]);
        try {
          const response = await fetch(`/dataset/${filename}`, {
            cache: "no-cache",
          });

          if (!response.ok) {
            setLogs((prev) => [
              ...prev,
              `Erreur chargement ${filename} (Status: ${response.status})`,
            ]);
            continue;
          }

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
            setLogs((prev) => [
              ...prev,
              `Erreur: Le fichier ${filename} semble être une page HTML (probablement 404)`,
            ]);
            continue;
          }

          const blob = await response.blob();
          const file = new File([blob], filename, { type: "application/zip" });
          loadedFiles.push(file);
        } catch (err) {
          setLogs((prev) => [
            ...prev,
            `Exception chargement ${filename}: ${err}`,
          ]);
        }
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

  const importHistory = async (file: File) => {
    try {
      const text = await file.text();
      const newHistory: TrainingProgress[] = [];

      if (file.name.endsWith(".txt")) {
        const lines = text.split("\n");
        const regex =
          /Epoch (\d+): Train \[loss=([\d.]+), accuracy=([\d.]+)\] \| Validation \[loss=([\d.]+), accuracy=([\d.]+)\]/;

        lines.forEach((line) => {
          const match = line.match(regex);
          if (match) {
            newHistory.push({
              epoch: parseInt(match[1]),
              loss: parseFloat(match[2]),
              acc: parseFloat(match[3]),
              val_loss: parseFloat(match[4]),
              val_acc: parseFloat(match[5]),
            });
          }
        });

        // Parse Dataset Stats from logs
        const stats: DatasetStat[] = [];
        let inStats = false;

        for (const line of lines) {
          if (line.includes("📊 Dataset Distribution:")) {
            inStats = true;
            continue;
          }
          if (inStats) {
            if (line.includes("Class | Total")) continue;
            if (line.includes("---")) {
              // End of table if we already have stats
              if (stats.length > 0) inStats = false;
              continue;
            }
            if (line.trim() === "") {
              inStats = false;
              continue;
            }

            const parts = line.split("|").map((s) => s.trim());
            if (parts.length === 4) {
              const stat: DatasetStat = {
                Class: parts[0],
                Total: parseInt(parts[1]) || 0,
                Train: parseInt(parts[2]) || 0,
                Val: parseInt(parts[3]) || 0,
              };
              if (!isNaN(stat.Total)) {
                stats.push(stat);
              }
            }
          }
        }

        if (stats.length > 0) {
          setDatasetStats(stats);
        }

        // Set the logs to the file content
        setLogs(lines);
      } else {
        throw new Error(
          "Format de fichier non supporté. Utilisez uniquement le fichier de logs .txt"
        );
      }

      if (newHistory.length === 0) {
        throw new Error("Aucune donnée d'historique trouvée dans le fichier.");
      }

      setHistory(newHistory);
      const lastEntry = newHistory[newHistory.length - 1];
      setProgress(lastEntry);

      // Removed the generic "Historique importé" log since we replaced logs with file content
      toast.success("Historique importé avec succès !");
    } catch (err) {
      console.error(err);
      setLogs((prev) => [
        ...prev,
        `Erreur import historique: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ]);
    }
  };

  const stopTraining = () => {
    trainerRef.current.stop();
    setLogs((prev) => [...prev, "Stopping training..."]);
  };

  const startTraining = async () => {
    setIsTraining(true);
    setIsModelReady(false);
    setLogs([]);
    setHistory([]);
    setElapsedTime(0);

    // Start Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let trainData: { xs: tf.Tensor4D; ys: tf.Tensor2D } | null = null;
    let valData: { xs: tf.Tensor4D; ys: tf.Tensor2D } | null = null;

    try {
      // Initialize Backend
      await tf.setBackend("webgl");
      await tf.ready();
      const backend = tf.getBackend();
      setLogs((prev) => [...prev, `TF.js Backend: ${backend}`]);

      setLogs((prev) => [...prev, `Loading: ${files.length} source images...`]);

      // 1. Load Data (Stratified Split)
      const splitData = await trainerRef.current.loadDatasetFromZips(
        files,
        totalImages,
        (count, total) => {
          setLogs((prev) => {
            const lastLog = prev[prev.length - 1];
            const msg = `Loading: ${count}/${total} source images...`;
            if (lastLog && lastLog.startsWith("Loading:")) {
              return [...prev.slice(0, -1), msg];
            }
            return [...prev, msg];
          });
        }
      );

      trainData = splitData.train;
      valData = splitData.val;
      if (splitData.stats) {
        setDatasetStats(splitData.stats);

        // Log stats table for export/import
        let statsLog =
          "\n📊 Dataset Distribution:\nClass | Total | Train | Val\n";
        statsLog += "-------------------------------\n";
        splitData.stats.forEach((s) => {
          statsLog += `${s.Class.padEnd(5)} | ${s.Total.toString().padEnd(
            5
          )} | ${s.Train.toString().padEnd(5)} | ${s.Val.toString().padEnd(
            5
          )}\n`;
        });
        statsLog += "-------------------------------\n";
        setLogs((prev) => [...prev, statsLog]);
      }

      setLogs((prev) => [
        ...prev,
        `Dataset ready: ${trainData?.xs.shape[0]} train, ${valData?.xs.shape[0]} val samples.`,
      ]);

      // 2. Configure Training
      const config: TrainingConfig = {
        epochs: 50,
        batchSize: 16, // Augmenté de 8 à 16 pour stabiliser le gradient
        earlyStopping: {
          enabled: true,
          patience: 15, // Augmenté de 5 à 15
          minDelta: 0.001,
        },
      };

      // 3. Train
      setLogs((prev) => [...prev, `Starting training... (Monitors val_loss)`]);

      await trainerRef.current.train(
        trainData!,
        valData!,
        config,
        (epoch, logs) => {
          // Update UI
          const currentProgress: TrainingProgress = {
            epoch,
            loss: logs?.loss || 0,
            acc: logs?.acc || 0,
            val_loss: logs?.val_loss || 0,
            val_acc: logs?.val_acc || 0,
          };
          setProgress(currentProgress);
          setHistory((prev) => [...prev, currentProgress]);
        },
        (msg) => {
          setLogs((prev) => [...prev, msg]);
        }
      );

      setIsModelReady(true);
      setLogs((prev) => [...prev, "Training Complete! ✅"]);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `Error: ${msg}`]);
    } finally {
      setIsTraining(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Cleanup Tensors
      if (trainData) {
        trainData.xs.dispose();
        trainData.ys.dispose();
      }
      if (valData) {
        valData.xs.dispose();
        valData.ys.dispose();
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

  return {
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
  };
};
