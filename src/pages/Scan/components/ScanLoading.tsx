import { Cat } from "lucide-react";

interface ScanLoadingProps {
  isLoading: boolean;
}

export function ScanLoading({ isLoading }: ScanLoadingProps) {
  if (!isLoading) return null;

  return (
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
  );
}
