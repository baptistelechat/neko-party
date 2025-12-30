
import * as tf from '@tensorflow/tfjs';

export interface DetectionResult {
  bbox: { x: number; y: number; w: number; h: number };
  score: number;
  class: string;
}

export class ObjectDetector {
  private static instance: ObjectDetector;
  private model: tf.GraphModel | null = null;
  private isLoaded = false;
  
  // Configuration
  private readonly MODEL_URL = '/models/yolo_web_model/model.json';
  private readonly SCORE_THRESHOLD = 0.5;
  private readonly IOU_THRESHOLD = 0.45;
  
  private constructor() {}

  public static getInstance(): ObjectDetector {
    if (!ObjectDetector.instance) {
      ObjectDetector.instance = new ObjectDetector();
    }
    return ObjectDetector.instance;
  }

  public isModelLoaded(): boolean {
    return this.model !== null;
  }

  public async loadModel(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      console.log(`Loading YOLO model from ${this.MODEL_URL}...`);
      // Use loadGraphModel for YOLO exports
      this.model = await tf.loadGraphModel(this.MODEL_URL);
      
      // Warmup
      const dummy = tf.zeros([1, 640, 640, 3]);
      this.model.execute(dummy);
      tf.dispose(dummy);
      
      this.isLoaded = true;
      console.log('✅ YOLO model loaded successfully');
    } catch (e) {
      console.warn('⚠️ Failed to load YOLO model. Make sure you have exported it to public/models/yolo_web_model/');
      console.error(e);
      throw e;
    }
  }

  public async detect(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<DetectionResult[]> {
    if (!this.model) return [];

    return tf.tidy(() => {
      // 1. Preprocess
      // YOLO usually expects 640x640, normalized 0-1
      const input = tf.browser.fromPixels(source);
      const [h, w] = input.shape.slice(0, 2);
      
      const resized = tf.image.resizeBilinear(input, [640, 640]);
      const normalized = resized.div(255.0).expandDims(0).toFloat();

      // 2. Inference
      // YOLOv8 output shape: [1, 5, 8400] (cx, cy, w, h, score) for 1 class
      const output = this.model!.execute(normalized) as tf.Tensor;
      
      // 3. Post-process (Transpose to [8400, 5] for easier handling)
      // output shape is likely [1, 5, 8400]
      const squeezed = output.squeeze(); // [5, 8400]
      const transposed = squeezed.transpose([1, 0]); // [8400, 5]
      
      const boxes = tf.tidy(() => {
        const w = transposed.slice([0, 2], [-1, 1]);
        const h = transposed.slice([0, 3], [-1, 1]);
        const x1 = transposed.slice([0, 0], [-1, 1]).sub(w.div(2));
        const y1 = transposed.slice([0, 1], [-1, 1]).sub(h.div(2));
        const y2 = y1.add(h);
        const x2 = x1.add(w);
        return tf.concat([y1, x1, y2, x2], 1); // [8400, 4] (y1, x1, y2, x2) for tf.nms
      });
      
      const scores = transposed.slice([0, 4], [-1, 1]).squeeze(); // [8400]
      
      // NMS
      const nms = tf.image.nonMaxSuppression(
        boxes as tf.Tensor2D,
        scores as tf.Tensor1D,
        10, // Max output size
        this.IOU_THRESHOLD,
        this.SCORE_THRESHOLD
      );
      
      const indices = nms.arraySync();
      const results: DetectionResult[] = [];
      const boxesData = boxes.arraySync() as number[][];
      const scoresData = scores.arraySync() as number[];
      
      for (const i of indices) {
        const box = boxesData[i]; // y1, x1, y2, x2 (normalized to 640x640)
        const score = scoresData[i];
        
        // Scale back to original image size
        // Box is in 640x640 scale
        const scaleX = w / 640;
        const scaleY = h / 640;
        
        const y1 = box[0] * scaleY;
        const x1 = box[1] * scaleX;
        const y2 = box[2] * scaleY;
        const x2 = box[3] * scaleX;
        
        results.push({
          bbox: {
            x: Math.max(0, x1),
            y: Math.max(0, y1),
            w: Math.min(w, x2 - x1),
            h: Math.min(h, y2 - y1)
          },
          score: score,
          class: 'card' // We only have one class
        });
      }
      
      return results;
    }) as DetectionResult[];
  }
}
