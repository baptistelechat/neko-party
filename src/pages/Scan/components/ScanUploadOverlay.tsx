import { Cat } from "lucide-react";

interface ScanUploadOverlayProps {
  progress: number;
}

export function ScanUploadOverlay({ progress }: ScanUploadOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
      <div className="relative mb-6">
        <div className="w-20 h-20 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Cat className="h-8 w-8 text-blue-500 animate-pulse" />
        </div>
      </div>

      <h2 className="text-xl font-bold mb-2">Envoi en cours...</h2>

      <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-zinc-400 font-mono text-sm">{Math.round(progress)}%</p>
    </div>
  );
}
