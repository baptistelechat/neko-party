import { Button } from "@/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useCamera } from "./useCamera";

interface CameraViewProps {
  onFrame?: (video: HTMLVideoElement) => void;
}

export const CameraView = ({ onFrame }: CameraViewProps) => {
  const { videoRef, startCamera, error, isLoading } = useCamera();

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (!onFrame || !videoRef.current) return;

    let animationFrameId: number;

    const loop = () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        onFrame(videoRef.current);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [onFrame, videoRef]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-semibold mb-2">{error}</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-62.5">
          Si le problème persiste, essayez de désactiver vos extensions de
          navigateur (bloqueurs de pub, etc.) ou utilisez le mode navigation
          privée.
        </p>
        <Button variant="outline" className="mt-4" onClick={startCamera}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {isLoading && (
        <div className="absolute text-white z-20">
          Chargement de la caméra...
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover"
      />
    </div>
  );
};
