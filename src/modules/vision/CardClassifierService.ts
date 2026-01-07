import * as tf from "@tensorflow/tfjs";

export class CardClassifierService {
  private static instance: CardClassifierService;
  private cnnModel: tf.LayersModel | null = null; // Custom CNN Model
  private labels: string[] = [
    "-2",
    "-1",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
  ];

  private constructor() {}

  public static getInstance(): CardClassifierService {
    if (!CardClassifierService.instance) {
      CardClassifierService.instance = new CardClassifierService();
    }
    return CardClassifierService.instance;
  }

  public async loadModel(): Promise<void> {
    // Load Custom CNN Model
    try {
      console.log(
        "Attempting to load CNN model from /models/recognition/neko-skyjo-model.json..."
      );
      // Try to load from public folder
      // Note: This path assumes you placed the model files in /public/models/recognition/
      this.cnnModel = await tf.loadLayersModel(
        "/models/recognition/neko-skyjo-model.json",
        {
          strict: true, // Force strict loading to catch shape mismatch
        }
      );
      console.log("✅ Custom CNN Model loaded successfully!");
      this.cnnModel.summary(); // Print model summary to console
    } catch (e: unknown) {
      console.warn("❌ Could not load custom CNN model.");
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Detailed Error:", errorMessage);
      if (errorMessage.includes("404")) {
        console.error(
          "HINT: Ensure 'neko-skyjo-model.json' and 'neko-skyjo-model.weights.bin' are in 'public/models/recognition/'"
        );
      }
    }
  }

  /**
   * Predict using the CNN model
   */
  public async predict(
    element: HTMLVideoElement | HTMLCanvasElement
  ): Promise<{ label: string; confidence: number; method: "CNN" | "KNN" }> {
    if (this.cnnModel) {
      try {
        const prediction = tf.tidy(() => {
          const tensor = tf.browser
            .fromPixels(element)
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

        if (maxScore > 0.4) {
          // Confidence threshold
          return {
            label: this.labels[classIndex],
            confidence: maxScore,
            method: "CNN",
          };
        }
      } catch (e) {
        console.error("CNN Prediction failed", e);
      }
    }

    return { label: "?", confidence: 0, method: "CNN" };
  }
}
