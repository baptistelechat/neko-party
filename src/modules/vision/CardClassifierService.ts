import * as tf from '@tensorflow/tfjs';
import { MobileNet } from '@tensorflow-models/mobilenet';

export class CardClassifierService {
  private static instance: CardClassifierService;
  private knnClassifier: any; // Keep KNN for fallback/hybrid
  private cnnModel: tf.LayersModel | null = null; // New CNN Model
  private mobilenet: MobileNet | null = null;
  private labels: string[] = [
    '-2', '-1', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  ];

  private constructor() {}

  public static getInstance(): CardClassifierService {
    if (!CardClassifierService.instance) {
      CardClassifierService.instance = new CardClassifierService();
    }
    return CardClassifierService.instance;
  }

  public async loadModel(): Promise<void> {
    // 1. Load KNN (MobileNet) for features
    if (!this.knnClassifier) {
      const knn = await import('@tensorflow-models/knn-classifier');
      this.knnClassifier = knn.create();
    }
    if (!this.mobilenet) {
      const mobilenet = await import('@tensorflow-models/mobilenet');
      this.mobilenet = await mobilenet.load();
    }

    // 2. Load Custom CNN Model
    try {
        console.log("Attempting to load CNN model from /models/neko-skyjo-model.json...");
        // Try to load from public folder
        // Note: This path assumes you placed the model files in /public/models/
        this.cnnModel = await tf.loadLayersModel('/models/neko-skyjo-model.json', {
            strict: true // Force strict loading to catch shape mismatch
        });
        console.log("✅ Custom CNN Model loaded successfully!");
        this.cnnModel.summary(); // Print model summary to console
    } catch (e: any) {
        console.warn("❌ Could not load custom CNN model (Using KNN only).");
        console.error("Detailed Error:", e.message);
        if (e.message && e.message.includes("404")) {
            console.error("HINT: Ensure 'neko-skyjo-model.json' and 'neko-skyjo-model.weights.bin' are in 'public/models/'");
        }
    }
  }

  /**
   * Predict using the best available model (CNN > KNN)
   */
  public async predict(element: HTMLVideoElement | HTMLCanvasElement): Promise<{ label: string, confidence: number, method: 'CNN' | 'KNN' }> {
    // A. Try CNN First
    if (this.cnnModel) {
        try {
            const prediction = tf.tidy(() => {
                const tensor = tf.browser.fromPixels(element)
                    .resizeNearestNeighbor([224, 224])
                    .toFloat()
                    .div(tf.scalar(255))
                    .expandDims();
                return this.cnnModel!.predict(tensor) as tf.Tensor;
            });

            const probabilities = await prediction.data();
            const maxScore = Math.max(...Array.from(probabilities));
            const classIndex = Array.from(probabilities).indexOf(maxScore);
            
            prediction.dispose();

            if (maxScore > 0.4) { // Confidence threshold (lowered for testing)
                return {
                    label: this.labels[classIndex],
                    confidence: maxScore,
                    method: 'CNN'
                };
            }
        } catch (e) {
            console.error("CNN Prediction failed", e);
        }
    }

    // B. Fallback to KNN
    if (this.knnClassifier && this.knnClassifier.getNumClasses() > 0 && this.mobilenet) {
      const activation = this.mobilenet.infer(element, true);
      const result = await this.knnClassifier.predictClass(activation);
      activation.dispose();

      if (result.confidences[result.label] > 0.5) {
          return {
              label: result.label,
              confidence: result.confidences[result.label],
              method: 'KNN'
          };
      }
    }

    return { label: '?', confidence: 0, method: 'KNN' };
  }

  // --- Training / Collection Methods (KNN) ---

  public async addExample(element: HTMLVideoElement | HTMLCanvasElement, label: string): Promise<void> {
    if (!this.mobilenet) return;
    const activation = this.mobilenet.infer(element, true);
    this.knnClassifier.addExample(activation, label);
    activation.dispose();
  }

  public getExampleCount(): { [label: string]: number } {
    return this.knnClassifier ? this.knnClassifier.getClassExampleCount() : {};
  }

  public clearAllExamples(): void {
    if (this.knnClassifier) {
      this.knnClassifier.clearAllClasses();
    }
  }

  public async getClassifierDatasetJSON(): Promise<string | null> {
    return null; // Deprecated
  }
}
