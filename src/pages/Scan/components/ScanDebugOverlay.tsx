import { DetectionResult } from "@/hooks/useCardDetection";

interface ScanDebugOverlayProps {
  show: boolean;
  result: DetectionResult;
  isTrainingMode: boolean;
}

export function ScanDebugOverlay({
  show,
  result,
  isTrainingMode,
}: ScanDebugOverlayProps) {
  if (isTrainingMode || !show || !result.image) return null;

  return (
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
        <div className="absolute top-1/2 left-0 w-full h-px bg-red-500/30" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-red-500/30" />
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
  );
}
