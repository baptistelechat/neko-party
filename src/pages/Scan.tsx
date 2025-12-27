import { CameraView } from "@/modules/camera/CameraView";
import { DatasetService } from "@/modules/dataset/DatasetService";
import { CardClassifierService } from "@/modules/vision/CardClassifierService";
import { OCRService } from "@/modules/vision/OCRService";
import { Button } from "@/ui/button";
import { Toggle } from "@/ui/toggle";
import * as tf from "@tensorflow/tfjs";
import {
  ArrowLeft,
  Bot,
  Cat,
  Check,
  Download,
  GraduationCap,
  Play,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Tesseract from "tesseract.js";

export default function Scan() {
  const navigate = useNavigate();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultText, setResultText] = useState<string>("");

  // Real-time Debug
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showRobotVision, setShowRobotVision] = useState(false);

  // Training Mode
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("-2");
  const [exampleCounts, setExampleCounts] = useState<{
    [label: string]: number;
  }>({});

  // Model Upload
  // const fileInputRef = useRef<HTMLInputElement>(null); // Removed manual import

  const [trainingStep, setTrainingStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);

  const TRAINING_STEPS = [
    {
      name: "Position Standard",
      desc: "Carte bien droite, éclairage normal",
      target: 5,
    },
    {
      name: "Rotation Légère",
      desc: "Pivotez légèrement (gauche/droite)",
      target: 5,
    },
    {
      name: "Distance",
      desc: "Variez la distance (plus près/loin)",
      target: 5,
    },
    {
      name: "Angles de Vue",
      desc: "Inclinez le téléphone (haut/bas/côté)",
      target: 5,
    },
    {
      name: "Conditions Difficiles",
      desc: "Ombre de la main, moins de lumière...",
      target: 5,
    },
    {
      name: "Mode Libre",
      desc: "Ajoutez autant d'exemples que voulu",
      target: 999,
    },
  ];

  // const [isClassifierReady, setIsClassifierReady] = useState(false); // Unused for now

  const [debugResult, setDebugResult] = useState<string>("-");
  const [debugConfidence, setDebugConfidence] = useState<number>(0);
  const [debugRawText, setDebugRawText] = useState<string>("");
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [debugInverted, setDebugInverted] = useState(false);

  const lastProcessTime = useRef<number>(0);
  const isProcessingFrame = useRef<boolean>(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const classifierRef = useRef<CardClassifierService>(
    CardClassifierService.getInstance()
  );

  // Dataset Export Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const targetBoxRef = useRef<HTMLDivElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const datasetService = DatasetService.getInstance();
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionEntries, setSessionEntries] = useState<any[]>([]);
  const [showGallery, setShowGallery] = useState(false);

  const [isModelLoading, setIsModelLoading] = useState(true);

  // WebGL Optimization for Mobile
  useEffect(() => {
    const initBackend = async () => {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const backend = tf.getBackend();
        if (backend === "webgl") {
          console.log("WebGL Backend initialized for Scan");
          tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);
        }
      } catch (e) {
        console.warn("WebGL init failed in Scan", e);
      }
    };
    initBackend();
  }, []);

  useEffect(() => {
    // Init Classifier
    const initClassifier = async () => {
      setIsModelLoading(true);
      await classifierRef.current.loadModel();
      // Load counts
      const counts = classifierRef.current.getExampleCount();
      if (counts) setExampleCounts(counts);
      setIsModelLoading(false);
    };
    initClassifier();
  }, []);

  // Initialize/Cleanup Worker based on Debug Mode
  useEffect(() => {
    let active = true;

    const initWorker = async () => {
      // In Debug Mode, we now rely mainly on the CNN model.
      // OCR is kept as a legacy fallback but we might not need to init it aggressively.
      // For now, keep it if user wants to compare.
      if (!isDebugMode) return;

      try {
        console.log("Initializing OCR Worker (Backup)...");
        const worker = await OCRService.createWorker();
        if (active) {
          workerRef.current = worker;
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.error("Failed to init worker", err);
      }
    };

    if (isDebugMode) {
      initWorker();
    } else {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setDebugResult("-");
      setDebugConfidence(0);
      setDebugRawText("");
      setDebugImage(null);
    }

    return () => {
      active = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isDebugMode]);

  const handleCapture = async (imageSrc: string) => {
    // Stop debug loop when captured
    setIsDebugMode(false);
    setIsTrainingMode(false);

    setCapturedImage(imageSrc);
    setIsProcessing(true);
    try {
      // Create an image element to pass to the classifier
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => (img.onload = resolve));

      // 1. Try CNN Prediction first
      const mlResult = await classifierRef.current.predict(img as any);

      if (mlResult.confidence > 0.6) {
        setResultText(mlResult.label);
      } else {
        // 2. Fallback to OCR if CNN is unsure
        const text = await OCRService.recognizeText(imageSrc);
        const cleanedText = text.replace(/[^0-9-]/g, "");
        setResultText(cleanedText || text);
      }
    } catch (error) {
      console.error("Processing failed", error);
      setResultText("Erreur lors de l'analyse");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrain = async (video: HTMLVideoElement) => {
    if (!isTrainingMode) return;

    // Feedback: Vibration
    if (navigator.vibrate) {
      navigator.vibrate(50); // 50ms vibration
    }

    // Feedback: Sound (Simple beep using AudioContext)
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) {
      console.error("Audio feedback failed", e);
    }

    // Capture for Dataset Export
    if (containerRef.current && targetBoxRef.current) {
      try {
        await datasetService.addEntry(
          video,
          selectedLabel,
          containerRef.current.getBoundingClientRect(),
          targetBoxRef.current.getBoundingClientRect()
        );
        setSessionCount(datasetService.getSessionCount());
        setSessionEntries([...datasetService.getSessionEntries()]);
      } catch (e) {
        console.error("Failed to add entry to dataset session", e);
      }
    }

    await classifierRef.current.addExample(video, selectedLabel);
    const counts = classifierRef.current.getExampleCount();
    if (counts) setExampleCounts(counts);

    // Update Step Progress
    const currentStep = TRAINING_STEPS[trainingStep];
    const newProgress = stepProgress + 1;

    if (
      newProgress >= currentStep.target &&
      trainingStep < TRAINING_STEPS.length - 1
    ) {
      // Move to next step
      const nextStep = trainingStep + 1;
      setTrainingStep(nextStep);
      setStepProgress(0);
    } else {
      setStepProgress(newProgress);
    }
  };

  const handleExportDataset = async () => {
    if (datasetService.getSessionCount() === 0) {
      alert("Veuillez d'abord scanner au moins une carte.");
      return;
    }

    // Show gallery for final review before download
    setShowGallery(true);
  };

  const performDownload = async () => {
    try {
      await datasetService.exportSessionZip(selectedLabel);

      // Ask to clear session after download
      if (confirm("Dataset téléchargé ! Effacer la session en cours ?")) {
        datasetService.clearSession();
        setSessionCount(0);
        setSessionEntries([]);
      }
    } catch (e) {
      console.error("Export failed", e);
      alert("Erreur lors de l'export du dataset.");
    }
  };

  const handleFrame = async (video: HTMLVideoElement) => {
    if (!isDebugMode && !isTrainingMode) return;

    const now = Date.now();
    // Process every 200ms (throttled from 100ms to reduce mobile load)
    if (now - lastProcessTime.current < 200 || isProcessingFrame.current) {
      return;
    }

    // Ensure video has valid dimensions
    if (video.videoWidth < 10 || video.videoHeight < 10) {
      return;
    }

    isProcessingFrame.current = true;
    lastProcessTime.current = now;

    try {
      // Training Mode
      if (isTrainingMode) {
        return;
      }

      // Debug Mode (Hybrid: TF.js + OCR)
      if (isDebugMode) {
        // 1. Try TF.js Classifier first
        const mlResult = await classifierRef.current.predict(video);

        // Update Debug UI with ML Result
        if (mlResult.method === "CNN") {
          setDebugResult(mlResult.label);
          setDebugConfidence(Math.round(mlResult.confidence * 100));
          setDebugRawText(`CNN: ${mlResult.label}`);
          setDebugInverted(false);
          // If CNN is confident, we stop here (no OCR)
          if (mlResult.confidence > 0.6) return;
        } else if (mlResult.method === "KNN") {
          // KNN (Temporary memory)
          setDebugResult(mlResult.label);
          setDebugConfidence(Math.round(mlResult.confidence * 100));
          setDebugRawText(`KNN: ${mlResult.label}`);
        }

        // 2. Fallback to OCR if ML is unsure (or if CNN not loaded yet)
        if (workerRef.current) {
          // Reuse canvas
          if (!processingCanvasRef.current) {
            processingCanvasRef.current = document.createElement("canvas");
          }
          const canvas = processingCanvasRef.current;
          if (canvas.width !== video.videoWidth)
            canvas.width = video.videoWidth;
          if (canvas.height !== video.videoHeight)
            canvas.height = video.videoHeight;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageSrc = canvas.toDataURL("image/jpeg", 0.8); // Reduce quality to 0.8 for speed

            let result = await OCRService.recognizeWithWorkerDetailed(
              workerRef.current,
              imageSrc,
              { invert: false }
            );
            let usedInverted = false;
            // let finalImage = null; // Don't process image for UI every frame to save memory

            if (result.confidence < 70 || result.number === null) {
              const resultInverted =
                await OCRService.recognizeWithWorkerDetailed(
                  workerRef.current,
                  imageSrc,
                  { invert: true }
                );

              if (
                resultInverted.number !== null &&
                (result.number === null ||
                  resultInverted.confidence > result.confidence)
              ) {
                result = resultInverted;
                usedInverted = true;
              }
            }

            // Update debug image every frame but use a throttled/lower quality one if needed
            // For now, let's restore it as user requested it back
            if (showRobotVision) {
              setDebugImage(imageSrc);
            }
            setDebugInverted(usedInverted);
            setDebugRawText(result.text);
            setDebugConfidence(Math.round(result.confidence));
            setDebugResult(
              result.number !== null ? result.number.toString() : "?"
            );
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      isProcessingFrame.current = false;
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResultText("");
    setIsDebugMode(false);
    setIsTrainingMode(false);
    setTrainingStep(0);
    setStepProgress(0);
  };

  const TRAINABLE_LABELS = [
    "-2",
    "-1",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
  ];

  const handleRemoveEntry = (index: number) => {
    datasetService.removeEntry(index);
    setSessionCount(datasetService.getSessionCount());
    setSessionEntries([...datasetService.getSessionEntries()]);
    // Note: We don't remove from classifier/counts because we can't easily undo "addExample" in KNN without reloading.
    // But that's fine, the visual feedback count will be slightly off vs zip content, but the ZIP will be clean.
  };

  return (
    <div className="flex flex-col h-dvh bg-black overflow-hidden">
      {/* Model Loading Overlay */}
      {isModelLoading && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
          <div className="relative mb-4">
            <div className="w-16 h-16 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Cat className="h-6 w-6 text-blue-500 animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Chargement de Neko...</h2>
          <p className="text-zinc-400 text-sm">
            Initialisation du modèle de reconnaisance
          </p>
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">
              Vérification de Session ({sessionCount})
            </h3>
            <Button variant="ghost" onClick={() => setShowGallery(false)}>
              Fermer
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2">
            {sessionEntries.map((entry, idx) => {
              const url = URL.createObjectURL(entry.crop);
              return (
                <div
                  key={entry.annotation.id}
                  className="relative aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
                >
                  <img src={url} className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                      onClick={() => handleRemoveEntry(idx)}
                    >
                      <span className="text-xs">✕</span>
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-center text-white py-1">
                    #{idx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-4">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => setShowGallery(false)}
            >
              Retour au scan
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowGallery(false);
                performDownload();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger le ZIP
            </Button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Import - REMOVED */}

      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <Button
          variant={isDebugMode ? "secondary" : "ghost"}
          size="sm"
          className={`${
            isDebugMode
              ? "bg-green-500 text-white hover:bg-green-600"
              : "text-white bg-black/20"
          } backdrop-blur-sm`}
          onClick={() => {
            setIsDebugMode(!isDebugMode);
            setIsTrainingMode(false);
          }}
        >
          <Zap
            className={`h-4 w-4 mr-2 ${isDebugMode ? "fill-current" : ""}`}
          />
          {isDebugMode ? "Live ON" : "Live OFF"}
        </Button>
        {isDebugMode && (
          <Toggle
            pressed={showRobotVision}
            onPressedChange={setShowRobotVision}
            variant="outline"
            size="sm"
            className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40 data-[state=on]:bg-green-500 data-[state=on]:text-white border-none"
            aria-label="Toggle robot vision"
          >
            <Bot className="h-4 w-4" />
          </Toggle>
        )}
        <Button
          variant={isTrainingMode ? "secondary" : "ghost"}
          size="sm"
          className={`${
            isTrainingMode
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "text-white bg-black/20"
          } backdrop-blur-sm`}
          onClick={() => {
            setIsTrainingMode(!isTrainingMode);
            setIsDebugMode(false);
          }}
        >
          <GraduationCap
            className={`h-4 w-4 mr-2 ${isTrainingMode ? "fill-current" : ""}`}
          />
          {isTrainingMode ? "Train ON" : "Train OFF"}
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center text-white relative bg-zinc-900">
        {capturedImage ? (
          <div className="relative w-full h-full flex flex-col">
            <img
              src={capturedImage}
              alt="Captured"
              className="flex-1 object-contain bg-black"
            />

            {/* Result Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/90 p-6 rounded-t-3xl border-t border-zinc-700">
              <h3 className="text-lg font-bold mb-2">Résultats de l'analyse</h3>
              <div className="min-h-[100px] p-4 bg-black/50 rounded-lg mb-4 text-sm font-mono whitespace-pre-wrap max-h-[200px] overflow-auto flex items-center justify-center">
                <span className="text-4xl font-bold text-green-400">
                  {isProcessing ? "..." : resultText || "?"}
                </span>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRetake}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réessayer
                </Button>
                <Button className="flex-1" disabled={isProcessing}>
                  <Check className="mr-2 h-4 w-4" />
                  Valider
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full" ref={containerRef}>
            <CameraView
              onCapture={handleCapture}
              onFrame={async (video) => {
                handleFrame(video);
                // Hack to expose video to training button (could be better)
                if (isTrainingMode) {
                  (window as any).currentVideoFrame = video;
                }
              }}
            />

            {/* Training Overlay */}
            {isTrainingMode && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 z-20 border-t border-blue-500/50">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-blue-400 font-bold flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Mode Entraînement
                    </h3>
                    <span className="text-xs text-zinc-400">
                      {Object.values(exampleCounts).reduce((a, b) => a + b, 0)}{" "}
                      exemples total
                    </span>
                    {sessionCount > 0 && (
                      <span
                        className="text-xs text-yellow-400 font-bold animate-pulse cursor-pointer underline decoration-dotted"
                        onClick={() => setShowGallery(true)}
                      >
                        {sessionCount} en attente
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {TRAINABLE_LABELS.map((label) => (
                      <button
                        key={label}
                        onClick={() => {
                          setSelectedLabel(label);
                          setTrainingStep(0); // Reset steps when changing card
                          setStepProgress(0);
                        }}
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
                      onClick={() => {
                        const video = (window as any).currentVideoFrame;
                        if (video) handleTrain(video);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
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
                      onClick={handleExportDataset}
                      title="Sauvegarder le Dataset (ZIP)"
                    >
                      <Download className="h-5 w-5 mb-1" />
                      <span className="text-xs font-bold">Zip</span>
                    </Button>

                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-auto w-12"
                      title="Effacer la session en cours (RAM uniquement)"
                      onClick={async () => {
                        if (
                          confirm(
                            "Effacer les exemples de la session en cours ?"
                          )
                        ) {
                          classifierRef.current.clearAllExamples();
                          datasetService.clearSession();
                          setSessionCount(0);
                          setSessionEntries([]);
                          setExampleCounts({});
                          setTrainingStep(0);
                          setStepProgress(0);
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Target Box (Center) - Shared for Debug & Training */}
            {(isDebugMode || isTrainingMode) && (
              <div
                ref={targetBoxRef}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 h-[60%] aspect-[2/3]"
              >
                <div
                  className={`w-full h-full border-4 rounded-xl flex items-center justify-center relative box-border transition-colors duration-300 ${
                    isTrainingMode
                      ? "border-blue-500/50 shadow-[0_0_100px_rgba(59,130,246,0.2)]"
                      : "border-green-500/50 shadow-[0_0_100px_rgba(34,197,94,0.2)]"
                  }`}
                >
                  <div className="absolute -top-20 left-0 right-0 flex flex-col items-center gap-1">
                    {/* Step Instruction Bubble */}
                    {isTrainingMode && (
                      <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-blue-400 mb-2 animate-bounce text-center">
                        {TRAINING_STEPS[trainingStep].desc}
                      </div>
                    )}

                    {isDebugMode && (
                      <span className="px-3 py-1 rounded text-5xl font-bold font-mono border bg-black/80 shadow-[0_0_20px_rgba(0,0,0,0.5)] text-green-400 border-green-500/50">
                        {debugResult}
                      </span>
                    )}
                    {isDebugMode && (
                      <div className="flex gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            debugConfidence > 70
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          CONF: {debugConfidence}%
                        </span>
                        {debugInverted && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/20 text-blue-400">
                            INVERTED
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Central Crosshair */}
                  <div
                    className={`w-full h-[1px] absolute top-1/2 ${
                      isTrainingMode ? "bg-blue-500/30" : "bg-green-500/30"
                    }`}
                  />
                  <div
                    className={`h-full w-[1px] absolute left-1/2 ${
                      isTrainingMode ? "bg-blue-500/30" : "bg-green-500/30"
                    }`}
                  />

                  {/* Card Aspect Ratio Guides (Inner dashed border) */}
                  <div
                    className={`absolute top-4 bottom-4 left-4 right-4 border-2 border-dashed opacity-30 rounded-lg ${
                      isTrainingMode ? "border-blue-400" : "border-green-400"
                    }`}
                  />

                  {/* Corner Markers */}
                  <div
                    className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 -mt-1 -ml-1 ${
                      isTrainingMode ? "border-blue-500" : "border-green-500"
                    }`}
                  ></div>
                  <div
                    className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 -mt-1 -mr-1 ${
                      isTrainingMode ? "border-blue-500" : "border-green-500"
                    }`}
                  ></div>
                  <div
                    className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 -mb-1 -ml-1 ${
                      isTrainingMode ? "border-blue-500" : "border-green-500"
                    }`}
                  ></div>
                  <div
                    className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 -mb-1 -mr-1 ${
                      isTrainingMode ? "border-blue-500" : "border-green-500"
                    }`}
                  ></div>

                  {/* Guidance Text */}
                  <div
                    className={`absolute bottom-4 text-xs font-mono text-center w-full animate-pulse ${
                      isTrainingMode ? "text-blue-500/70" : "text-green-500/70"
                    }`}
                  >
                    {isTrainingMode
                      ? "CADREZ LA CARTE ENTIÈRE"
                      : "CADREZ LA CARTE ENTIÈRE"}
                  </div>
                </div>
              </div>
            )}

            {/* Debug Overlay */}
            {isDebugMode && showRobotVision && (
              <>
                {/* Robot Vision Preview (Bottom Right Corner) */}
                {debugImage && (
                  <div className="absolute bottom-4 right-4 z-20 bg-black/90 border border-green-500/50 p-3 rounded-lg shadow-xl pointer-events-none w-72">
                    <div className="text-xs text-green-400 mb-2 font-mono uppercase tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Robot Vision
                      </div>
                      <span className="text-[10px] text-zinc-500">v0.2</span>
                    </div>

                    <div className="relative aspect-video bg-zinc-900 rounded overflow-hidden border border-white/10 mb-2">
                      <img
                        src={debugImage}
                        className="w-full h-full object-contain"
                        alt="Debug View"
                        style={{ imageRendering: "pixelated" }}
                      />
                      {/* Crosshair on debug image */}
                      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/30" />
                      <div className="absolute left-1/2 top-0 h-full w-[1px] bg-red-500/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
                      <div className="flex flex-col">
                        <span className="text-zinc-600 uppercase">
                          Raw Text
                        </span>
                        <span className="text-white truncate">
                          "{debugRawText}"
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-zinc-600 uppercase">Filter</span>
                        <span className="text-white">[-2..12]</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-zinc-600 uppercase">Mode</span>
                        <span className="text-white">
                          {debugInverted ? "Inverted" : "Normal"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-zinc-600 uppercase">Conf</span>
                        <span
                          className={
                            debugConfidence > 80
                              ? "text-green-400"
                              : debugConfidence > 50
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                        >
                          {debugConfidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!capturedImage && !isDebugMode && <div className="hidden"></div>}
    </div>
  );
}
