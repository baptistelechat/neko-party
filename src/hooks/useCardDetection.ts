import { CardClassifierService } from "@/modules/vision/CardClassifierService";
import { OCRService } from "@/modules/vision/OCRService";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

interface UseCardDetectionProps {
  enabled: boolean;
  returnDebugImage?: boolean;
}

export interface DetectionResult {
  label: string;
  confidence: number;
  rawText: string;
  image?: string | null;
  isInverted: boolean;
  method: "CNN" | "KNN" | "OCR" | "NONE";
}

export const useCardDetection = ({
  enabled,
  returnDebugImage = false,
}: UseCardDetectionProps) => {
  const [result, setResult] = useState<DetectionResult>({
    label: "-",
    confidence: 0,
    rawText: "",
    isInverted: false,
    method: "NONE",
  });
  const [isModelLoading, setIsModelLoading] = useState(true);

  const lastProcessTime = useRef<number>(0);
  const isProcessingFrame = useRef<boolean>(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const classifierRef = useRef<CardClassifierService>(
    CardClassifierService.getInstance()
  );
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initialize WebGL Backend
  useEffect(() => {
    const initBackend = async () => {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const backend = tf.getBackend();
        if (backend === "webgl") {
          console.log("WebGL Backend initialized");
          tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
        }
      } catch (e) {
        console.warn("WebGL init failed", e);
      }
    };
    initBackend();
  }, []);

  // 2. Initialize Classifier
  useEffect(() => {
    const initClassifier = async () => {
      setIsModelLoading(true);
      await classifierRef.current.loadModel();
      setIsModelLoading(false);
    };
    initClassifier();
  }, []);

  // 3. Initialize OCR Worker (only if enabled)
  useEffect(() => {
    let active = true;

    const initWorker = async () => {
      if (!enabled) return;

      try {
        // Only init if not already existing
        if (!workerRef.current) {
          console.log("Initializing OCR Worker...");
          const worker = await OCRService.createWorker();
          if (active) {
            workerRef.current = worker;
          } else {
            await worker.terminate();
          }
        }
      } catch (err) {
        console.error("Failed to init worker", err);
      }
    };

    if (enabled) {
      initWorker();
    }

    return () => {
      active = false;
      // We don't terminate immediately on unmount/disable to avoid heavy re-init costs
      // unless we really want to save memory. For now, let's keep it alive or manage globally.
      // But if user leaves page, we should terminate.
      // In this hook context, it might be better to terminate on unmount.
    };
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const processFrame = async (video: HTMLVideoElement) => {
    if (!enabled || isModelLoading) return;

    const now = Date.now();
    // Process every 200ms
    if (now - lastProcessTime.current < 200 || isProcessingFrame.current) {
      return;
    }

    if (video.videoWidth < 10 || video.videoHeight < 10) return;

    isProcessingFrame.current = true;
    lastProcessTime.current = now;

    try {
      // 1. Try TF.js Classifier first
      const mlResult = await classifierRef.current.predict(video);

      // CNN High Confidence -> Return immediately
      if (mlResult.method === "CNN" && mlResult.confidence > 0.6) {
        setResult({
          label: mlResult.label,
          confidence: Math.round(mlResult.confidence * 100),
          rawText: `CNN: ${mlResult.label}`,
          isInverted: false,
          method: "CNN",
          image: returnDebugImage ? await captureFrame(video) : null,
        });
        return;
      }

      // 2. Fallback to OCR
      if (workerRef.current) {
        if (!processingCanvasRef.current) {
          processingCanvasRef.current = document.createElement("canvas");
        }
        const canvas = processingCanvasRef.current;
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight)
          canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageSrc = canvas.toDataURL("image/jpeg", 0.8);

          let ocrResult = await OCRService.recognizeWithWorkerDetailed(
            workerRef.current,
            imageSrc,
            { invert: false }
          );
          let usedInverted = false;

          if (ocrResult.confidence < 70 || ocrResult.number === null) {
            const resultInverted = await OCRService.recognizeWithWorkerDetailed(
              workerRef.current,
              imageSrc,
              { invert: true }
            );

            if (
              resultInverted.number !== null &&
              (ocrResult.number === null ||
                resultInverted.confidence > ocrResult.confidence)
            ) {
              ocrResult = resultInverted;
              usedInverted = true;
            }
          }

          setResult({
            label:
              ocrResult.number !== null ? ocrResult.number.toString() : "?",
            confidence: Math.round(ocrResult.confidence),
            rawText: ocrResult.text,
            isInverted: usedInverted,
            method: "OCR",
            image: returnDebugImage ? imageSrc : null,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      isProcessingFrame.current = false;
    }
  };

  const captureFrame = async (video: HTMLVideoElement): Promise<string> => {
    // Simple capture helper for debug image
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.5);
    }
    return "";
  };

  return {
    result,
    processFrame,
    isModelLoading,
    classifier: classifierRef.current, // Expose for training
  };
};
