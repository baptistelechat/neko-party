
// @ts-expect-error OpenCV is loaded globally via script tag
declare const cv: any;

export class ImageProcessor {
  private static instance: ImageProcessor;
  
  private constructor() {}

  public static getInstance(): ImageProcessor {
    if (!ImageProcessor.instance) {
      ImageProcessor.instance = new ImageProcessor();
    }
    return ImageProcessor.instance;
  }

  public isReady(): boolean {
    return typeof cv !== 'undefined' && cv.Mat;
  }

  /**
   * Crops the card from the source image based on the bounding box.
   * Performs basic perspective correction if we had 4 corners, 
   * but with a simple BBox we just crop and maybe rotate.
   */
  public processCrop(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    bbox: { x: number; y: number; w: number; h: number }
  ): HTMLCanvasElement | null {
    if (!this.isReady()) {
      console.warn('OpenCV not ready');
      return null;
    }

    try {
      // 1. Read source into Mat
      const src = cv.imread(source);
      
      // 2. Define ROI (Region of Interest)
      // Ensure ROI is within bounds
      const rows = src.rows;
      const cols = src.cols;
      
      const x = Math.max(0, Math.min(bbox.x, cols - 1));
      const y = Math.max(0, Math.min(bbox.y, rows - 1));
      const w = Math.min(bbox.w, cols - x);
      const h = Math.min(bbox.h, rows - y);
      
      if (w <= 0 || h <= 0) {
        src.delete();
        return null;
      }

      const rect = new cv.Rect(x, y, w, h);
      const cropped = src.roi(rect);
      
      // 3. Resize to 224x224 (Model Input)
      const dsize = new cv.Size(224, 224);
      const resized = new cv.Mat();
      cv.resize(cropped, resized, dsize, 0, 0, cv.INTER_AREA);
      
      // 4. Convert back to Canvas
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 224;
      outputCanvas.height = 224;
      cv.imshow(outputCanvas, resized);
      
      // Cleanup
      src.delete();
      cropped.delete();
      resized.delete();
      
      return outputCanvas;

    } catch (e) {
      console.error('OpenCV processing failed:', e);
      return null;
    }
  }
}
