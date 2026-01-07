
import * as ort from 'onnxruntime-web';

// Configure wasm path - use local files in public folder
ort.env.wasm.wasmPaths = "/models/detection/";

export interface DetectionResult {
  bbox: { x: number; y: number; w: number; h: number };
  score: number;
  class: string;
}

export class ObjectDetector {
  private static instance: ObjectDetector;
  private session: ort.InferenceSession | null = null;
  private isLoaded = false;
  
  // Configuration
  private readonly MODEL_PATH = '/models/detection/neko-skyjo-yolo_model.onnx';
  private readonly SCORE_THRESHOLD = 0.6; // Back to strict confidence
  private readonly IOU_THRESHOLD = 0.45;
  
  private constructor() {}

  public static getInstance(): ObjectDetector {
    if (!ObjectDetector.instance) {
      ObjectDetector.instance = new ObjectDetector();
    }
    return ObjectDetector.instance;
  }

  public isModelLoaded(): boolean {
    return this.session !== null;
  }

  public async loadModel(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      console.log(`Loading YOLO ONNX model from ${this.MODEL_PATH}...`);
      
      this.session = await ort.InferenceSession.create(this.MODEL_PATH, {
        executionProviders: ['wasm'], // 'webgl' can be faster but buggier on some GPUs
        graphOptimizationLevel: 'all'
      });
      
      this.isLoaded = true;
      console.log('✅ YOLO ONNX model loaded successfully');
    } catch (e) {
      console.warn('⚠️ Failed to load YOLO ONNX model.');
      console.error(e);
      throw e;
    }
  }

  /**
   * Preprocess image to [1, 3, 640, 640] Float32 tensor
   */
  private async preprocess(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<[ort.Tensor, number, number]> {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) throw new Error("Canvas context failed");

    // Draw and resize
    ctx.drawImage(source, 0, 0, 640, 640);
    
    const imageData = ctx.getImageData(0, 0, 640, 640);
    const { data } = imageData;
    
    // Convert to Float32 CHW format [3, 640, 640] and normalize [0-1]
    const float32Data = new Float32Array(3 * 640 * 640);
    
    for (let i = 0; i < 640 * 640; ++i) {
      const r = data[i * 4] / 255.0;
      const g = data[i * 4 + 1] / 255.0;
      const b = data[i * 4 + 2] / 255.0;
      
      // R
      float32Data[i] = r;
      // G
      float32Data[i + 640 * 640] = g;
      // B
      float32Data[i + 2 * 640 * 640] = b;
    }

    const tensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);
    
    // Return tensor and original dimensions for scaling back
    const w = (source instanceof HTMLVideoElement) ? source.videoWidth : source.width;
    const h = (source instanceof HTMLVideoElement) ? source.videoHeight : source.height;
    
    return [tensor, w, h];
  }

  public async detect(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<DetectionResult[]> {
    if (!this.session) return [];

    try {
      // 1. Preprocess
      const [inputTensor, imgW, imgH] = await this.preprocess(source);
      
      // 2. Inference
      const feeds: Record<string, ort.Tensor> = {};
      feeds[this.session.inputNames[0]] = inputTensor;
      
      const results = await this.session.run(feeds);
      const output = results[this.session.outputNames[0]]; // [1, 5, 8400]
      
      // 3. Post-process
      return this.postprocess(output.data as Float32Array, imgW, imgH);
    } catch (e) {
      console.error("Inference failed", e);
      return [];
    }
  }

  /**
   * Post-process YOLO output [1, 5, 8400]
   * 5 channels: cx, cy, w, h, score (class 0)
   */
  private postprocess(data: Float32Array, imgW: number, imgH: number): DetectionResult[] {
    const boxes: Array<{ x: number, y: number, w: number, h: number, score: number }> = [];
    
    // Output shape is flattened [1, 5, 8400] -> but typically YOLO exports as [1, 8400, 5] OR [1, 5, 8400]
    // Ultralytics default is [1, 5, 8400] (channels first in the last dim)
    // 5 rows (cx, cy, w, h, score), 8400 columns (anchors)
    
    // Check if we need to transpose?
    // If output is [1, 8400, 5], the logic changes.
    // Let's assume [1, 5, 8400] for now based on typical export.

    const numAnchors = 8400;
    const numChannels = 5; // 4 box + 1 class score
    
    // Scale factors
    const xParams = imgW / 640;
    const yParams = imgH / 640;

    for (let i = 0; i < numAnchors; i++) {
      // Access data column-wise if shape is [5, 8400]
      // index = channel * numAnchors + anchor_index
      const score = data[4 * numAnchors + i];
      
      if (score > this.SCORE_THRESHOLD) {
        const cx = data[0 * numAnchors + i];
        const cy = data[1 * numAnchors + i];
        const w = data[2 * numAnchors + i];
        const h = data[3 * numAnchors + i];
        
        // Convert to top-left corner and scale to original image
        const boxW = w * xParams;
        const boxH = h * yParams;
        const boxX = (cx * xParams) - (boxW / 2);
        const boxY = (cy * yParams) - (boxH / 2);
        
        boxes.push({
          x: boxX,
          y: boxY,
          w: boxW,
          h: boxH,
          score: score
        });
      }
    }

    // NMS
    const result = this.nms(boxes);
    
    return result.map(box => ({
      bbox: { x: box.x, y: box.y, w: box.w, h: box.h },
      score: box.score,
      class: 'card'
    }));
  }

  private nms(boxes: Array<{ x: number, y: number, w: number, h: number, score: number }>): Array<{ x: number, y: number, w: number, h: number, score: number }> {
    if (boxes.length === 0) return [];

    // Sort by score desc
    boxes.sort((a, b) => b.score - a.score);
    
    const selected: typeof boxes = [];
    const active = new Array(boxes.length).fill(true);
    
    for (let i = 0; i < boxes.length; i++) {
      if (!active[i]) continue;
      
      const boxA = boxes[i];
      selected.push(boxA);
      
      if (selected.length >= 10) break; // Max detections
      
      for (let j = i + 1; j < boxes.length; j++) {
        if (!active[j]) continue;
        
        const boxB = boxes[j];
        const iou = this.computeIOU(boxA, boxB);
        
        if (iou > this.IOU_THRESHOLD) {
          active[j] = false;
        }
      }
    }
    
    return selected;
  }

  private computeIOU(boxA: { x: number, y: number, w: number, h: number }, boxB: { x: number, y: number, w: number, h: number }): number {
    const x1 = Math.max(boxA.x, boxB.x);
    const y1 = Math.max(boxA.y, boxB.y);
    const x2 = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
    const y2 = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);
    
    const intersectionW = Math.max(0, x2 - x1);
    const intersectionH = Math.max(0, y2 - y1);
    
    const intersectionArea = intersectionW * intersectionH;
    const boxAArea = boxA.w * boxA.h;
    const boxBArea = boxB.w * boxB.h;
    
    const unionArea = boxAArea + boxBArea - intersectionArea;
    
    return (unionArea === 0) ? 0 : intersectionArea / unionArea;
  }
}
