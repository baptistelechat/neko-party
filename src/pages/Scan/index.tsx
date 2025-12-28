import { useCardDetection } from "@/hooks/useCardDetection";
import { useScanSession } from "@/hooks/useScanSession";
import { CameraView } from "@/modules/camera/CameraView";
import { useRef, useState } from "react";
import { ScanDebugOverlay } from "./components/ScanDebugOverlay";
import { ScanGallery } from "./components/ScanGallery";
import { ScanHeader } from "./components/ScanHeader";
import { ScanLoading } from "./components/ScanLoading";
import { ScanOverlay } from "./components/ScanOverlay";
import { ScanTrainingControls } from "./components/ScanTrainingControls";
import { TRAINING_STEPS } from "./constants";
import { ScanUploadOverlay } from "./components/ScanUploadOverlay";

export default function Scan() {
  // UI States
  const [showRobotVision, setShowRobotVision] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Training Steps Configuration
  const [trainingStep, setTrainingStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string>("-2");

  // Hooks
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
        onToggleTrainingMode={() => setIsTrainingMode(!isTrainingMode)}
        showRobotVision={showRobotVision}
        onToggleRobotVision={setShowRobotVision}
      />

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

        <ScanTrainingControls
          isTrainingMode={isTrainingMode}
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

        <ScanOverlay
          isTrainingMode={isTrainingMode}
          result={result}
          trainingStep={trainingStep}
          targetBoxRef={targetBoxRef}
        />

        <ScanDebugOverlay
          show={showRobotVision}
          result={result}
          isTrainingMode={isTrainingMode}
        />
      </div>
    </div>
  );
}
