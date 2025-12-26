import { useEffect } from 'react';
import { useCamera } from './useCamera';
import { Button } from '@/ui/button';
import { AlertCircle } from 'lucide-react';

interface CameraViewProps {
  onCapture?: (imageSrc: string) => void;
  onFrame?: (video: HTMLVideoElement) => void;
}

export const CameraView = ({ onCapture, onFrame }: CameraViewProps) => {
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

  const handleCapture = () => {
    if (videoRef.current && onCapture) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageSrc = canvas.toDataURL('image/jpeg');
        onCapture(imageSrc);
      }
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="font-semibold mb-2">{error}</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-[250px]">
          Si le problème persiste, essayez de désactiver vos extensions de navigateur (bloqueurs de pub, etc.) ou utilisez le mode navigation privée.
        </p>
        <Button variant="outline" className="mt-4" onClick={startCamera}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {isLoading && <div className="absolute text-white z-20">Chargement de la caméra...</div>}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover"
      />
      
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
        <Button 
            size="lg" 
            className="rounded-full h-20 w-20 p-1 border-4 border-white bg-transparent hover:bg-white/20 transition-all active:scale-95"
            onClick={handleCapture}
        >
            <div className="h-16 w-16 rounded-full bg-white" />
        </Button>
      </div>
    </div>
  );
};
