import { DatasetEntry } from "@/modules/dataset/types";
import { Button } from "@/ui/button";
import { ArrowLeftIcon, FolderArchive, Send } from "lucide-react";

interface ScanGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  sessionEntries: DatasetEntry[];
  sessionCount: number;
  onRemoveEntry: (index: number) => void;
  onUpload: () => void;
  onDownload: () => void;
}

export function ScanGallery({
  isOpen,
  onClose,
  sessionEntries,
  sessionCount,
  onRemoveEntry,
  onUpload,
  onDownload,
}: ScanGalleryProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">
          Vérification de Session ({sessionCount})
        </h3>
        <Button variant="ghost" onClick={onClose}>
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
                className="relative aspect-2/3 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
              >
                <img src={url} className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    onClick={() => onRemoveEntry(idx)}
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
        <Button variant="outline" onClick={onClose} size="icon">
          <ArrowLeftIcon />
        </Button>
        {import.meta.env.DEV && (
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              onClose();
              onUpload();
            }}
          >
            <Send className="mr-2 h-4 w-4" /> Envoyer
          </Button>
        )}
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={() => {
            onClose();
            onDownload();
          }}
        >
          <FolderArchive className="mr-2 h-4 w-4" /> Télécharger
        </Button>
      </div>
    </div>
  );
}
