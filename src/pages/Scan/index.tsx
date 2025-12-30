import { useCardDetection } from "@/hooks/useCardDetection";
import { useCardPipeline } from "@/hooks/useCardPipeline";
import { useScanSession } from "@/hooks/useScanSession";
import { CameraView } from "@/modules/camera/CameraView";
import { useRef, useState } from "react";
import { ScanDebugOverlay } from "./components/ScanDebugOverlay";
import { ScanGallery } from "./components/ScanGallery";
import { ScanHeader } from "./components/ScanHeader";
import { ScanLoading } from "./components/ScanLoading";
import { ScanOverlay } from "./components/ScanOverlay";
import { ScanTrainingControls } from "./components/ScanTrainingControls";
import { ScanUploadOverlay } from "./components/ScanUploadOverlay";
import { TRAINING_STEPS } from "./constants";

export default function Scan() {
  // UI States
  const [isTrainingMode, setIsTrainingMode] = useState(false); // Default: Live Mode
  const [showDebug, setShowDebug] = useState(false); // Default: No Debug info

  const [showGallery, setShowGallery] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Training Steps Configuration
  const [trainingStep, setTrainingStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string>("-2");

  // --- OLD HOOK (Data Collection / Training Mode / Fallback) ---
  // Only enabled when in Training Mode OR Fallback mode
  // We determine fallback later, but useCardDetection needs "enabled" prop.
  // Ideally, we should check `isYoloAvailable` here, but hooks order rules.

  // We can force enable it, but ignore results if not needed.
  // Or better: enable it if isTrainingMode OR (Live and YOLO not available).
  // But we don't know if YOLO is available yet inside useCardPipeline call.
  // Actually we do get `isYoloAvailable` from pipeline result.

  // Let's use a 2-pass approach or just always enable detection if we want fallback?
  // No, heavy.

  // Refactor: We can just use the Pipeline hook.
  // BUT Pipeline hook doesn't currently support "Fallback Crop".

  // Let's rely on the fact that `useCardDetection` is cheap (just a center crop and CNN).

  // --- NEW HOOK (Live Pipeline / Inference Mode) ---
  const {
    result: pipelineResult,
    processFrame: processPipelineFrame,
    isReady: isPipelineReady,
    isYoloAvailable,
  } = useCardPipeline();

  // --- OLD HOOK ---
  // Enable if Training Mode OR (Live Mode AND Pipeline Ready AND YOLO NOT Available)
  const shouldUseFallback =
    !isTrainingMode && isPipelineReady && !isYoloAvailable;

  const {
    result: detectionResult,
    processFrame: processDetectionFrame,
    isModelLoading: isDetectionLoading,
  } = useCardDetection({
    enabled: isTrainingMode || shouldUseFallback,
    returnDebugImage: false,
  });

  // Loading state depends on mode
  const isModelLoading = isTrainingMode ? isDetectionLoading : !isPipelineReady;

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
  } = useScanSession();

  // Ref to hold video for training capture
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleFrame = (video: HTMLVideoElement) => {
    currentVideoRef.current = video;

    if (isTrainingMode) {
      processDetectionFrame(video);
    } else {
      // LIVE MODE
      if (isYoloAvailable) {
        processPipelineFrame(video);
      } else {
        // Fallback to simple detection (Center Crop)
        processDetectionFrame(video);
      }
    }
  };

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
      setUploadProgress(0);
      await uploadSession(selectedLabel, (progress) => {
        setUploadProgress(progress);
      });
      setUploadProgress(null);

      if (
        confirm(
          "Dataset envoyé au PC avec succès ! Effacer la session en cours ?"
        )
      ) {
        clearSession();
      }
    } catch (e) {
      setUploadProgress(null);
      console.error("Upload failed", e);
      alert("Erreur lors de l'envoi du dataset au PC.");
    }
  };

  const handleResetSession = () => {
    if (confirm("Effacer tout ?")) {
      clearSession();
      setTrainingStep(0);
      setStepProgress(0);
    }
  };

  // Prepare result for Debug Overlay (Unified format)
  // If fallback, use detectionResult
  const currentResult =
    isTrainingMode || !isYoloAvailable
      ? detectionResult
      : pipelineResult
      ? {
          label: pipelineResult.value,
          confidence: Math.round(pipelineResult.valueConfidence * 100),
          rawText: `YOLO: ${(pipelineResult.score * 100).toFixed(0)}%`,
          isInverted: false,
          method: "CNN" as const,
          bbox: pipelineResult.bbox,
        }
      : null;

  return (
    <div className="flex flex-col h-dvh bg-black overflow-hidden">
      <ScanLoading isLoading={isModelLoading} />
      {uploadProgress !== null && (
        <ScanUploadOverlay progress={uploadProgress} />
      )}

      <ScanGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        sessionEntries={sessionEntries}
        sessionCount={sessionCount}
        onRemoveEntry={removeEntry}
        onUpload={performUpload}
        onDownload={performDownload}
      />

      <ScanHeader
        isTrainingMode={isTrainingMode}
        onSetTrainingMode={setIsTrainingMode}
        showDebug={showDebug}
        onToggleDebug={setShowDebug}
      />

      {/* Main Camera View */}
      <div
        className="flex-1 flex items-center justify-center text-white relative bg-zinc-900"
        ref={containerRef}
      >
        <CameraView onFrame={handleFrame} />

        {/* --- TRAINING MODE UI --- */}
        {isTrainingMode && (
          <>
            {/* Mode Indicator: Top Center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-blue-500/30">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              <span className="text-xs font-bold text-blue-200 tracking-wider">
                MODE TRAINING
              </span>
            </div>

            {/* Controls */}
            <ScanTrainingControls
              isTrainingMode={true}
              exampleCounts={exampleCounts}
              sessionCount={sessionCount}
              selectedLabel={selectedLabel}
              onSelectLabel={(label) => {
                setSelectedLabel(label);
                setTrainingStep(0);
                setStepProgress(0);
              }}
              trainingStep={trainingStep}
              stepProgress={stepProgress}
              onTrainClick={handleTrainClick}
              onExportClick={handleExportDataset}
              onResetClick={handleResetSession}
              onShowGallery={() => setShowGallery(true)}
            />
            {/* Center Box Overlay (Blue) */}
            <ScanOverlay
              isTrainingMode={true}
              result={detectionResult}
              trainingStep={trainingStep}
              targetBoxRef={targetBoxRef}
            />
          </>
        )}

        {/* --- LIVE MODE UI --- */}
        {!isTrainingMode && (
          <>
            {/* Mode Indicator: Bottom Right */}
            <div
              className={`absolute bottom-6 right-6 z-20 pointer-events-none flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border ${
                isYoloAvailable ? "border-green-500/30" : "border-yellow-500/30"
              }`}
            >
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isYoloAvailable ? "bg-green-400" : "bg-yellow-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isYoloAvailable ? "bg-green-500" : "bg-yellow-500"
                  }`}
                ></span>
              </span>
              <span
                className={`text-xs font-bold tracking-wider ${
                  isYoloAvailable ? "text-green-200" : "text-yellow-200"
                }`}
              >
                {isYoloAvailable ? "MODE LIVE" : "MODE LIVE (DEGRADÉ)"}
              </span>
            </div>

            {/* YOLO BBox (Only if YOLO available) */}
            {isYoloAvailable && pipelineResult && (
              <div
                className="absolute border-2 border-green-500 z-20 pointer-events-none transition-all duration-75"
                style={{
                  left: pipelineResult.bbox.x,
                  top: pipelineResult.bbox.y,
                  width: pipelineResult.bbox.w,
                  height: pipelineResult.bbox.h,
                }}
              >
                <div className="absolute -top-8 left-0 bg-green-500 text-black px-2 py-1 text-sm font-bold rounded shadow-lg">
                  {pipelineResult.value} (
                  {(pipelineResult.valueConfidence * 100).toFixed(0)}%)
                </div>
              </div>
            )}

            {/* Fallback Overlay (Green Center Box) if YOLO NOT available */}
            {!isYoloAvailable && (
              <ScanOverlay
                isTrainingMode={false} // Show Green style
                result={detectionResult}
                trainingStep={0} // Irrelevant
                targetBoxRef={targetBoxRef}
              />
            )}

            {/* Debug Overlay (Robot) */}
            <ScanDebugOverlay
              show={showDebug}
              result={currentResult}
              isTrainingMode={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
