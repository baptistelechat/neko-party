import { CameraView } from "@/modules/camera/CameraView";
import { CardClassifierService } from "@/modules/vision/CardClassifierService";
import { OCRService } from "@/modules/vision/OCRService";
import { Button } from "@/ui/button";
import {
  ArrowLeft,
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

  useEffect(() => {
    // Init Classifier
    const initClassifier = async () => {
      await classifierRef.current.loadModel();
      // Load counts
      const counts = classifierRef.current.getExampleCount();
      if (counts) setExampleCounts(counts);
    };
    initClassifier();
  }, []);

  // Initialize/Cleanup Worker based on Debug Mode
  useEffect(() => {
    let active = true;

    const initWorker = async () => {
      if (!isDebugMode) return;

      try {
        console.log("Initializing OCR Worker...");
        const worker = await OCRService.createWorker();
        if (active) {
          workerRef.current = worker;
          console.log("OCR Worker Ready");
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
      // Cleanup if mode is turned off
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      // Clear debug state
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
      // If we have a trained model, use it first? For now, stick to OCR for the "Main" action unless confident.
      // Or just use OCR as default flow.
      const text = await OCRService.recognizeText(imageSrc);
      const cleanedText = text.replace(/[^0-9-]/g, "");
      setResultText(cleanedText || text);
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

  const handleExportModel = async () => {
    // Export only the currently selected label
    const labelToExport = selectedLabel;

    // Check if we have examples
    if (!exampleCounts[labelToExport] || exampleCounts[labelToExport] === 0) {
      alert(`Aucune donnée à sauvegarder pour le chiffre ${labelToExport}`);
      return;
    }

    const jsonStr = await classifierRef.current.getClassifierDatasetJSON(
      labelToExport
    );

    if (!jsonStr) {
      alert(`Erreur lors de la récupération des données pour ${labelToExport}`);
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const filename = `skyjo_model_${labelToExport}_${timestamp}.json`;

    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Optional: Feedback
    // alert(`Sauvegarde lancée : ${filename}`);
  };

  const handleFrame = async (video: HTMLVideoElement) => {
    if (!isDebugMode && !isTrainingMode) return;

    const now = Date.now();
    // Process every 100ms
    if (now - lastProcessTime.current < 100 || isProcessingFrame.current) {
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
        // No auto processing, waiting for user click "Add Example"
        // Actually, we could show real-time prediction if we wanted, but let's keep it simple
        // const result = await classifierRef.current.predict(video);
        // if (result && result.confidences[result.label] > 0.8) {
        //   setPredictionLabel(result.label);
        // } else {
        //   setPredictionLabel("?");
        // }
        return;
      }

      // Debug Mode (Hybrid: TF.js + OCR)
      if (isDebugMode) {
        // 1. Try TF.js Classifier first
        const mlResult = await classifierRef.current.predict(video);

        // Threshold check: >0.9 confidence AND not a "Background" class if we implemented one.
        // For now, assume if confidence is high, it's good.
        // BUT if no cards are present, we might get false positives if we don't have a "background" class.
        // Let's rely on high confidence for now.
        if (mlResult && mlResult.confidences[mlResult.label] > 0.9) {
          setDebugResult(mlResult.label);
          setDebugConfidence(
            Math.round(mlResult.confidences[mlResult.label] * 100)
          );
          setDebugRawText(`ML: ${mlResult.label}`);
          setDebugImage(null); // No debug image for ML
          setDebugInverted(false);
          // Only skip OCR if we are REALLY sure.
          return;
        } else if (mlResult && mlResult.confidences[mlResult.label] > 0.5) {
          // Show weak ML prediction
          setDebugResult(`? (${mlResult.label}?)`);
          setDebugConfidence(
            Math.round(mlResult.confidences[mlResult.label] * 100)
          );
        } else {
          // No ML confidence
          setDebugResult("-");
          setDebugConfidence(0);
        }

        // 2. Fallback to OCR if ML is unsure (or always run it for comparison in debug?)
        // The user said: "actuellement s'il y a aucune carte le mode live me dit -2"
        // This is likely because the ML model forces a prediction to the closest class.
        // Solution: Add a threshold. If max confidence < 0.8, display nothing or OCR.

        if (workerRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageSrc = canvas.toDataURL("image/jpeg");

            let result = await OCRService.recognizeWithWorkerDetailed(
              workerRef.current,
              imageSrc,
              { invert: false }
            );
            let usedInverted = false;
            let finalImage = await OCRService.preprocessImage(imageSrc, {
              invert: false,
            });

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
                finalImage = await OCRService.preprocessImage(imageSrc, {
                  invert: true,
                });
              }
            }

            setDebugImage(finalImage);
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

  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
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
          <div className="relative w-full h-full">
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
                      onClick={handleExportModel}
                      title="Terminer et Sauvegarder"
                    >
                      <Download className="h-5 w-5 mb-1" />
                      <span className="text-xs font-bold">Sauver</span>
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
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 h-[60%] aspect-[2/3]">
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
            {isDebugMode && (
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
