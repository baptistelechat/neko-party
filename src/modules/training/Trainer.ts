import * as tf from "@tensorflow/tfjs";
import JSZip from "jszip";

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
}

export class Trainer {
  private model: tf.Sequential | null = null;
  private labels: string[] = [];
  private stopRequested: boolean = false;

  constructor() {
    this.labels = [
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
  }

  public stop() {
    this.stopRequested = true;
    if (this.model) {
      this.model.stopTraining = true;
    }
  }

  public dispose() {
    if (this.model) {
      this.model.stopTraining = true;
      this.model.dispose();
      this.model = null;
    }
  }

  /**
   * Creates a lightweight CNN model suitable for Skyjo card recognition.
   * Input: 224x224x3 (RGB images) - Restored to match original successful model
   * Output: 15 classes (probabilities)
   */
  public createModel(): tf.Sequential {
    const model = tf.sequential();

    // 1. Convolutional Layer 1
    model.add(
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 16,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 2. Convolutional Layer 2
    model.add(
      tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 3. Convolutional Layer 3
    model.add(
      tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 4. Flatten & Dense Layers
    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.5 }));
    model.add(tf.layers.dense({ units: 64, activation: "relu" }));

    // Output Layer
    model.add(
      tf.layers.dense({ units: this.labels.length, activation: "softmax" })
    );

    // Compile
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });

    this.model = model;
    return model;
  }

  /**
   * Loads dataset from ZIP files (containing /crops images)
   * Returns Tensors directly (simplest robust method for PC training)
   */
  public async loadDatasetFromZips(
    zipFiles: File[],
    onProgress?: (count: number, total: number) => void
  ): Promise<{ xs: tf.Tensor4D; ys: tf.Tensor2D }> {
    this.stopRequested = false;
    const images: tf.Tensor3D[] = [];
    const labels: number[] = [];

    let totalFiles = 0;
    const zipContents: Array<{ zip: JSZip; files: string[] }> = [];

    // Pre-scan to count files
    for (const zipFile of zipFiles) {
      const zip = await JSZip.loadAsync(zipFile);
      const cropFiles = Object.keys(zip.files).filter(
        (path) =>
          path.startsWith("crops/") &&
          (path.endsWith(".jpg") || path.endsWith(".jpeg"))
      );
      totalFiles += cropFiles.length;
      zipContents.push({ zip, files: cropFiles });
    }

    let processedCount = 0;

    for (const { zip, files } of zipContents) {
      if (this.stopRequested) break;

      for (const filename of files) {
        if (this.stopRequested) break;

        // Report progress
        processedCount++;
        if (onProgress && processedCount % 10 === 0) {
          onProgress(processedCount, totalFiles);
          await tf.nextFrame(); // Keep UI responsive
        }

        // Extract label from filename: skyjo_crop_[LABEL]_[timestamp].jpg
        const match = filename.match(/skyjo_crop_(-?\d+)_/);
        if (match && match[1]) {
          const labelStr = match[1];
          const labelIndex = this.labels.indexOf(labelStr);

          if (labelIndex !== -1) {
            // Load image as Blob -> Bitmap -> Tensor
            const blob = await zip.files[filename].async("blob");
            const imgBitmap = await createImageBitmap(blob);

            const tensor = tf.tidy(() => {
              return tf.browser
                .fromPixels(imgBitmap)
                .resizeBilinear([224, 224]) // Restored to 224x224
                .toFloat()
                .div(tf.scalar(255)) as tf.Tensor3D;
            });

            images.push(tensor);
            labels.push(labelIndex);
            imgBitmap.close(); // Clean up bitmap
          }
        }
      }
    }

    if (this.stopRequested) {
      images.forEach((t) => t.dispose());
      throw new Error("Training stopped by user during data loading.");
    }

    if (images.length === 0) {
      throw new Error("No valid training data found in ZIPs.");
    }

    // Stack all images into a single batch tensor
    const xs = tf.stack(images) as tf.Tensor4D;
    const ys = tf.oneHot(
      tf.tensor1d(labels, "int32"),
      this.labels.length
    ) as tf.Tensor2D;

    // Dispose individual tensors now that they are stacked
    images.forEach((t) => t.dispose());

    return { xs, ys };
  }

  /**
   * Augments a batch of images with random variations (Vectorized for speed)
   */
  private augmentBatch(batch: tf.Tensor4D): tf.Tensor4D {
    return tf.tidy(() => {
      const batchSize = batch.shape[0];
      let aug = batch;

      // 1. Random Brightness (+/- 10%)
      // Generate [batch, 1, 1, 1] tensor for broadcasting
      const brightness = tf.randomUniform([batchSize, 1, 1, 1], -0.1, 0.1);
      aug = aug.add(brightness).clipByValue(0, 1) as tf.Tensor4D;

      // 2. Random Contrast (0.9 to 1.1)
      // Formula: (x - 0.5) * contrast + 0.5
      const contrast = tf.randomUniform([batchSize, 1, 1, 1], 0.9, 1.1);
      aug = aug
        .sub(0.5)
        .mul(contrast)
        .add(0.5)
        .clipByValue(0, 1) as tf.Tensor4D;

      return aug;
    });
  }

  /**
   * Trains the model using a data generator to handle augmentation on-the-fly.
   */
  public async train(
    data: { xs: tf.Tensor4D; ys: tf.Tensor2D },
    config: TrainingConfig,
    onEpochEnd?: (epoch: number, logs: tf.Logs | undefined) => void
  ) {
    if (!this.model) {
      this.createModel();
    }

    if (!this.model) throw new Error("Model creation failed");

    const numSamples = data.xs.shape[0];
    console.log(
      `Starting training with ${numSamples} original samples (augmented on-the-fly)...`
    );

    // Custom training loop
    const BATCH_SIZE = config.batchSize;
    const STEPS_PER_EPOCH = Math.ceil(numSamples / BATCH_SIZE);

    for (let epoch = 0; epoch < config.epochs; epoch++) {
      if (this.model.stopTraining) break;

      let epochLoss = 0;
      let epochAcc = 0;

      // Shuffle indices
      const indices = tf.util.createShuffledIndices(numSamples);

      for (let i = 0; i < numSamples; i += BATCH_SIZE) {
        if (this.model.stopTraining) break;

        const batchIndices = [];
        for (let j = 0; j < BATCH_SIZE && i + j < numSamples; j++) {
          batchIndices.push(indices[i + j]);
        }

        // 1. Extract Batch Data (outside tidy to manage disposal manually)
        const batchIndicesTensor = tf.tensor1d(batchIndices, "int32");
        const batchXs = data.xs.gather(batchIndicesTensor);
        const batchYs = data.ys.gather(batchIndicesTensor);
        batchIndicesTensor.dispose();

        // 2. Augment (Vectorized Batch Augmentation - Faster)
        const augmentedXs = this.augmentBatch(batchXs as tf.Tensor4D);

        // 3. Train (Async, NEVER inside tidy)
        // Cleanup input batch tensors immediately as we have the augmented copy
        batchXs.dispose();

        let lossVal = 0;
        let accVal = 0;

        try {
          const res = await this.model.trainOnBatch(augmentedXs, batchYs);

          // Helper to safely extract value from Scalar or number
          const extractVal = (val: number | tf.Scalar): number => {
            if (typeof val === "number") return val;
            return val.dataSync()[0];
          };

          if (Array.isArray(res)) {
            lossVal = extractVal(res[0]);
            accVal = extractVal(res[1]);
          } else {
            lossVal = extractVal(res as number | tf.Scalar);
          }
        } finally {
          // 4. Cleanup Training Tensors
          augmentedXs.dispose();
          batchYs.dispose();
        }

        epochLoss += lossVal;
        epochAcc += accVal;

        // Give GPU time to breathe to prevent TDR/Context Loss
        await new Promise((resolve) => setTimeout(resolve, 1));
        await tf.nextFrame();
      }

      // Epoch End
      const avgLoss = epochLoss / STEPS_PER_EPOCH;
      const avgAcc = epochAcc / STEPS_PER_EPOCH;

      console.log(
        `Epoch ${epoch + 1}: loss=${avgLoss.toFixed(4)}, acc=${avgAcc.toFixed(
          4
        )}`
      );

      if (onEpochEnd) {
        onEpochEnd(epoch + 1, {
          loss: avgLoss,
          acc: avgAcc,
        } as any);
      }
    }

    return {
      history: {
        loss: [],
        acc: [],
      },
    };
  }

  /**
   * Exports the trained model as a single ZIP file containing:
   * - neko-skyjo-model.json
   * - neko-skyjo-model.weights.bin
   */
  public async exportModel() {
    if (!this.model) throw new Error("No model to export");

    // 1. Save to IO Handler in memory
    await this.model.save(
      tf.io.withSaveHandler(async (artifacts) => {
        // This handler receives the model artifacts (json + weights)
        const zip = new JSZip();

        // Prepare standard model.json structure (TFJS format)
        // It must contain 'modelTopology' AND 'weightsManifest' at the root level.
        const modelJSON = {
          modelTopology: artifacts.modelTopology,
          format: artifacts.format,
          generatedBy: artifacts.generatedBy,
          convertedBy: artifacts.convertedBy,
          weightsManifest: [
            {
              paths: ["./neko-skyjo-model.weights.bin"],
              weights: artifacts.weightSpecs,
            },
          ],
        };

        // Add model.json
        zip.file("neko-skyjo-model.json", JSON.stringify(modelJSON));

        // Add weights.bin (if exists)
        if (artifacts.weightData) {
          zip.file(
            "neko-skyjo-model.weights.bin",
            artifacts.weightData as ArrayBuffer
          );
        }

        // Generate ZIP blob
        const blob = await zip.generateAsync({ type: "blob" });

        // Trigger Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "neko-skyjo-model-package.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
          modelArtifactsInfo: {
            dateSaved: new Date(),
            modelTopologyType: "JSON",
          },
        };
      })
    );
  }
}
