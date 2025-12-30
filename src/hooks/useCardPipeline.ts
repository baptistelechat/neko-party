
import { useState, useRef, useEffect, useCallback } from 'react';
import { ObjectDetector } from '@/modules/vision/ObjectDetector';
import { ImageProcessor } from '@/modules/vision/ImageProcessor';
import { CardClassifierService } from '@/modules/vision/CardClassifierService';

export interface PipelineResult {
  bbox: { x: number; y: number; w: number; h: number };
  score: number;
  value: string;
  valueConfidence: number;
  crop: string; // Data URL
}

export function useCardPipeline() {
  const [isReady, setIsReady] = useState(false);
  const [isYoloAvailable, setIsYoloAvailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  
  const detectorRef = useRef<ObjectDetector | null>(null);
  const processorRef = useRef<ImageProcessor | null>(null);
  const classifierRef = useRef<CardClassifierService | null>(null);
  
  const lastProcessTime = useRef(0);

  useEffect(() => {
    async function init() {
      try {
        // Init Singletons
        detectorRef.current = ObjectDetector.getInstance();
        processorRef.current = ImageProcessor.getInstance();
        classifierRef.current = CardClassifierService.getInstance();

        // Load Models
        await Promise.all([
            detectorRef.current.loadModel().catch(e => console.warn("YOLO load failed (expected if not present)", e)),
            classifierRef.current.loadModel()
        ]);

        setIsYoloAvailable(detectorRef.current.isModelLoaded());
        setIsReady(true);
      } catch (e) {
        console.error("Pipeline init failed", e);
      }
    }
    init();
  }, []);

  const processFrame = useCallback(async (source: HTMLVideoElement) => {
    if (!isReady || isProcessing) return;
    
    // Throttle: 200ms
    const now = Date.now();
    if (now - lastProcessTime.current < 200) return;
    lastProcessTime.current = now;

    setIsProcessing(true);

    try {
      // 1. Detect (YOLO)
      const detections = await detectorRef.current?.detect(source);
      
      if (detections && detections.length > 0) {
        // Take best detection
        const best = detections.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        
        // 2. Process (OpenCV Crop)
        const cropCanvas = processorRef.current?.processCrop(source, best.bbox);
        
        if (cropCanvas) {
          // 3. Recognize (CNN)
          const prediction = await classifierRef.current?.predict(cropCanvas);
          
          if (prediction) {
            setResult({
              bbox: best.bbox,
              score: best.score,
              value: prediction.label,
              valueConfidence: prediction.confidence,
              crop: cropCanvas.toDataURL('image/jpeg')
            });
          }
        }
      } else {
        setResult(null);
      }
    } catch (e) {
      console.error("Pipeline error:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [isReady, isProcessing]);

  return {
    isReady,
    isYoloAvailable,
    processFrame,
    result
  };
}
