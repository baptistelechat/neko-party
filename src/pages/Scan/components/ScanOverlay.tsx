import { DetectionResult } from "@/hooks/useCardDetection";
import { TRAINING_STEPS } from "../constants";

interface ScanOverlayProps {
  isTrainingMode: boolean;
  result: DetectionResult;
  trainingStep: number;
  targetBoxRef: React.RefObject<HTMLDivElement>;
}

export function ScanOverlay({
  isTrainingMode,
  result,
  trainingStep,
  targetBoxRef,
}: ScanOverlayProps) {
  return (
    <div
      ref={targetBoxRef}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 h-[60%] aspect-2/3"
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
          className={`w-full h-px absolute top-1/2 ${
            isTrainingMode ? "bg-blue-500/30" : "bg-green-500/30"
          }`}
        />
        <div
          className={`h-full w-px absolute left-1/2 ${
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
  );
}
