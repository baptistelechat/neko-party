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

export const useTraining = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
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

    let data: { xs: tf.Tensor4D; ys: tf.Tensor2D } | null = null;

    try {
      setLogs((prev) => [...prev, `Loading: ${files.length} source images...`]);

      // 1. Load Data
      data = await trainerRef.current.loadDatasetFromZips(
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

      setLogs((prev) => [
        ...prev,
        `Dataset ready: ${data?.xs.shape[0]} samples.`,
        "Starting training... (This may take a while)",
      ]);

      // 2. Configure Training
      const config: TrainingConfig = {
        epochs: 50, // Increased because Early Stopping will handle the stop
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
        await trainerRef.current.train(
          data,
          config,
          (epoch, logs) => {
            const loss = logs?.loss ? logs.loss.toFixed(4) : "0.0000";
            const acc = logs?.acc ? logs.acc.toFixed(4) : "0.0000";

            setLogs((prev) => [
              ...prev,
              `Epoch ${epoch}: loss=${loss}, acc=${acc}`,
            ]);

            const newProgress = {
              epoch,
              loss: logs?.loss || 0,
              acc: logs?.acc || 0,
              val_loss: 0,
              val_acc: 0,
            };

            setProgress(newProgress);
            setHistory((prev) => [...prev, newProgress]);
          },
          (message) => {
            setLogs((prev) => [...prev, message]);
          }
        );
      }

      setLogs((prev) => [...prev, "Training completed!"]);
      setIsModelReady(true);
    } catch (err) {
      console.error(err);
      setLogs((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setIsTraining(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

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

  return {
    files,
    isTraining,
    logs,
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
