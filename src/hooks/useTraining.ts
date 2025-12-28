import { Trainer, TrainingConfig } from "@/modules/training/Trainer";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";

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

export const useTraining = () => {
  const [files, setFiles] = useState<File[]>([]);
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
      }

      setLogs((prev) => [
        ...prev,
        `Dataset ready: ${trainData?.xs.shape[0]} train, ${valData?.xs.shape[0]} val samples.`,
      ]);

      // 2. Configure Training
      const config: TrainingConfig = {
        epochs: 50,
        batchSize: 8,
        earlyStopping: {
          enabled: true,
          patience: 5,
          minDelta: 0.001,
        },
      };

      // 3. Train
      setLogs((prev) => [
        ...prev,
        `Starting training... (Monitors val_loss)`,
      ]);

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
    } catch (err: any) {
      console.error(err);
      setLogs((prev) => [...prev, `Error: ${err.message}`]);
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
  };
};
