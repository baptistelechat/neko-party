import { useCardDetection } from "@/hooks/useCardDetection";
import { useScanSession } from "@/hooks/useScanSession";
import { CameraView } from "@/modules/camera/CameraView";
import { Button } from "@/ui/button";
import { Toggle } from "@/ui/toggle";
import {
  ArrowLeft,
  ArrowLeftIcon,
  Bot,
  Cat,
  Download,
  FolderArchive,
  GraduationCap,
  Play,
  RotateCcw,
  Send,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Scan() {
  const navigate = useNavigate();

  // UI States
  const [showRobotVision, setShowRobotVision] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  // Training Steps Configuration
  const [trainingStep, setTrainingStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string>("-2");

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

  // Hooks
  // We disable detection when in training mode to save resources, or we can keep it running to see what it thinks
  // Original code disabled it. Let's disable it during training mode for clarity.
  const { result, processFrame, isModelLoading, classifier } = useCardDetection(
    {
      enabled: !isTrainingMode,
      returnDebugImage: showRobotVision,
    }
  );

  const {
    sessionCount,
    sessionEntries,
    exampleCounts,
    containerRef,
    targetBoxRef,
    addExample,
    removeEntry,
    clearSession,
    exportSession,
    uploadSession,
  } = useScanSession(classifier);

  // Ref to hold video for training capture
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleTrainClick = async () => {
    if (!currentVideoRef.current) return;

    await addExample(currentVideoRef.current, selectedLabel);

    // Update Step Progress
    const currentStep = TRAINING_STEPS[trainingStep];
    const newProgress = stepProgress + 1;

    if (
      newProgress >= currentStep.target &&
      trainingStep < TRAINING_STEPS.length - 1
    ) {
      setTrainingStep(trainingStep + 1);
      setStepProgress(0);
    } else {
      setStepProgress(newProgress);
    }
  };

  const handleExportDataset = async () => {
    if (sessionCount === 0) {
      alert("Veuillez d'abord scanner au moins une carte.");
      return;
    }
    setShowGallery(true);
  };

  const performDownload = async () => {
    try {
      await exportSession(selectedLabel);
      if (confirm("Dataset téléchargé ! Effacer la session en cours ?")) {
        clearSession();
      }
    } catch (e) {
      console.error("Export failed", e);
      alert("Erreur lors de l'export du dataset.");
    }
  };

  const performUpload = async () => {
    try {
      await uploadSession(selectedLabel);
      if (
        confirm(
          "Dataset envoyé au PC avec succès ! Effacer la session en cours ?"
        )
      ) {
        clearSession();
      }
    } catch (e) {
      console.error("Upload failed", e);
      alert("Erreur lors de l'envoi du dataset au PC.");
    }
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

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            <div className="grid grid-cols-3 gap-2 pb-2">
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
                        onClick={() => removeEntry(idx)}
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
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-4">
            <Button
              variant="outline"
              onClick={() => setShowGallery(false)}
              size="icon"
            >
              <ArrowLeftIcon />
            </Button>
            {import.meta.env.DEV && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowGallery(false);
                  performUpload();
                }}
              >
                <Send className="mr-2 h-4 w-4" /> Envoyer
              </Button>
            )}
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowGallery(false);
                performDownload();
              }}
            >
              <FolderArchive className="mr-2 h-4 w-4" /> Télécharger
            </Button>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>

        {/* Always Live Indicator */}
        <div className="flex items-center px-3 py-1 rounded-md bg-black/20 backdrop-blur-sm text-white text-sm font-medium border border-white/10">
          <Zap className="h-4 w-4 mr-2 text-green-400 fill-current animate-pulse" />
          Live
        </div>

        {!isTrainingMode && (
          <Toggle
            pressed={showRobotVision}
            onPressedChange={setShowRobotVision}
            variant="outline"
            size="sm"
            className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40 data-[state=on]:bg-green-500 data-[state=on]:text-white border-none"
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
          onClick={() => setIsTrainingMode(!isTrainingMode)}
        >
          <GraduationCap
            className={`h-4 w-4 mr-2 ${isTrainingMode ? "fill-current" : ""}`}
          />
          {isTrainingMode ? "Train ON" : "Train OFF"}
        </Button>
      </div>

      {/* Main Camera View */}
      <div
        className="flex-1 flex items-center justify-center text-white relative bg-zinc-900"
        ref={containerRef}
      >
        <CameraView
          onFrame={(video) => {
            currentVideoRef.current = video;
            processFrame(video);
          }}
        />

        {/* Training Overlay */}
        {isTrainingMode && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 z-20 border-t border-blue-500/50">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-blue-400 font-bold flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> Mode Entraînement
                </h3>
                <span className="text-xs text-zinc-400">
                  {Object.values(exampleCounts).reduce((a, b) => a + b, 0)}{" "}
                  exemples
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
                      setTrainingStep(0);
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
                  onClick={handleTrainClick}
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
                  onClick={handleExportDataset}
                >
                  <Download className="h-5 w-5 mb-1" />{" "}
                  <span className="text-xs font-bold">Zip</span>
                </Button>

                <Button
                  variant="destructive"
                  size="icon"
                  className="h-auto w-12"
                  onClick={() => {
                    if (confirm("Effacer tout ?")) {
                      clearSession();
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

        {/* Target Box (Shared) */}
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
              {isTrainingMode && (
                <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-blue-400 mb-2 animate-bounce text-center">
                  {TRAINING_STEPS[trainingStep].desc}
                </div>
              )}

              {!isTrainingMode && (
                <span className="px-3 py-1 rounded text-5xl font-bold font-mono border bg-black/80 shadow-[0_0_20px_rgba(0,0,0,0.5)] text-green-400 border-green-500/50">
                  {result.label}
                </span>
              )}

              {!isTrainingMode && (
                <div className="flex gap-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      result.confidence > 70
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    CONF: {result.confidence}%
                  </span>
                  {result.isInverted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/20 text-blue-400">
                      INVERTED
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Crosshairs & Markers */}
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
            <div
              className={`absolute top-4 bottom-4 left-4 right-4 border-2 border-dashed opacity-30 rounded-lg ${
                isTrainingMode ? "border-blue-400" : "border-green-400"
              }`}
            />

            {/* Corners */}
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

            <div
              className={`absolute bottom-4 text-xs font-mono text-center w-full animate-pulse ${
                isTrainingMode ? "text-blue-500/70" : "text-green-500/70"
              }`}
            >
              CADREZ LA CARTE ENTIÈRE
            </div>
          </div>
        </div>

        {/* Robot Vision Debug Overlay */}
        {!isTrainingMode && showRobotVision && result.image && (
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
                src={result.image}
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/30" />
              <div className="absolute left-1/2 top-0 h-full w-[1px] bg-red-500/30" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
              <div className="flex flex-col">
                <span className="text-zinc-600 uppercase">Raw</span>
                <span className="text-white truncate">{result.rawText}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-600 uppercase">Method</span>
                <span className="text-white">{result.method}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-600 uppercase">Mode</span>
                <span className="text-white">
                  {result.isInverted ? "Inv" : "Norm"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-600 uppercase">Conf</span>
                <span className="text-green-400">{result.confidence}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
