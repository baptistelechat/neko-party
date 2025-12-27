import * as tf from "@tensorflow/tfjs";
import JSZip from "jszip";

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
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
   * Input: 224x224x3 (RGB images)
   * Output: 15 classes (probabilities)
   */
  public createModel(): tf.Sequential {
    const model = tf.sequential();

    // 1. Convolutional Layer 1 (MobileNet-style lighter config)
    model.add(
      tf.layers.conv2d({
        inputShape: [224, 224, 3],
        filters: 16,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 2. Convolutional Layer 2 (Separable for mobile optimization)
    model.add(
      tf.layers.separableConv2d({
        filters: 32,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 3. Convolutional Layer 3 (Separable for mobile optimization)
    model.add(
      tf.layers.separableConv2d({
        filters: 64,
        kernelSize: 3,
        activation: "relu",
        padding: "same",
      })
    );
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 4. Flatten & Dense Layers
    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.5 })); // Prevent overfitting
    model.add(tf.layers.dense({ units: 64, activation: "relu" })); // Smaller dense layer

    // Output Layer
    model.add(
      tf.layers.dense({ units: this.labels.length, activation: "softmax" })
    );

    // Compile
    model.compile({
      optimizer: tf.train.adam(0.0001), // Reduced learning rate for stability
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });

    this.model = model;
    return model;
  }

  /**
   * Loads dataset from ZIP files (containing /crops images)
   * Returns list of Blobs and labels to keep memory low before training
   */
  public async loadDatasetFromZips(
    zipFiles: File[]
  ): Promise<{ images: Blob[]; labels: number[] }> {
    this.stopRequested = false;
    const images: Blob[] = [];
    const labels: number[] = [];

    for (const zipFile of zipFiles) {
      if (this.stopRequested) break;
      const zip = await JSZip.loadAsync(zipFile);

      // Filter for crop images
      const cropFiles = Object.keys(zip.files).filter(
        (path) =>
          path.startsWith("crops/") &&
          (path.endsWith(".jpg") || path.endsWith(".jpeg"))
      );

      for (const filename of cropFiles) {
        if (this.stopRequested) break;
        // Extract label from filename: skyjo_crop_[LABEL]_[timestamp].jpg
        const match = filename.match(/skyjo_crop_(-?\d+)_/);
        if (match && match[1]) {
          const labelStr = match[1];
          const labelIndex = this.labels.indexOf(labelStr);

          if (labelIndex !== -1) {
            // Store Blob instead of Tensor
            const blob = await zip.files[filename].async("blob");
            images.push(blob);
            labels.push(labelIndex);
          }
        }
      }
    }

    if (this.stopRequested) {
      throw new Error("Training stopped by user during data loading.");
    }

    if (images.length === 0) {
      throw new Error("No valid training data found in ZIPs.");
    }

    return { images, labels };
  }

  /**
   * Creates a dataset iterator that loads images on demand
   */
  private createDataset(
    images: Blob[],
    labels: number[],
    batchSize: number
  ): tf.data.Dataset<tf.TensorContainer> {
    const indices = tf.util.createShuffledIndices(images.length);
    const numBatches = Math.ceil(images.length / batchSize);
    const classLabels = this.labels;

    // Generator function that yields batches
    const generator = async function* () {
      for (let i = 0; i < numBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, images.length);
        const batchIndices = indices.slice(start, end);

        const batchImages: tf.Tensor3D[] = [];
        const batchLabels: number[] = [];

        try {
          // Load batch images
          await Promise.all(
            Array.from(batchIndices).map(async (idx) => {
              const imgBitmap = await createImageBitmap(images[idx as number], {
                resizeWidth: 224,
                resizeHeight: 224,
                resizeQuality: "medium",
              });

              const tensor = tf.tidy(() => {
                return tf.browser
                  .fromPixels(imgBitmap)
                  .toFloat()
                  .div(tf.scalar(255)) as tf.Tensor3D;
              });

              imgBitmap.close();
              batchImages.push(tensor);
              batchLabels.push(labels[idx as number]);
            })
          );

          // Create batch tensors
          const xs = tf.stack(batchImages) as tf.Tensor4D;
          const ys = tf.oneHot(
            tf.tensor1d(batchLabels, "int32"),
            classLabels.length
          ) as tf.Tensor2D;

          // Dispose individual image tensors (stack has a copy)
          batchImages.forEach((t) => t.dispose());

          yield { xs, ys };
        } catch (error) {
          console.error("Error in dataset generator:", error);
          // Cleanup on error
          batchImages.forEach((t) => !t.isDisposed && t.dispose());
        }
      }
    };

    return tf.data.generator(generator);
  }

  /**
   * Trains the model using the provided dataset.
   */
  public async train(
    data: { images: Blob[]; labels: number[] },
    config: TrainingConfig,
    onEpochEnd?: (epoch: number, logs: tf.Logs | undefined) => void
  ) {
    if (!this.model) {
      this.createModel();
    }

    if (!this.model) throw new Error("Model creation failed");

    console.log(`Starting training with ${data.images.length} samples...`);

    // Manual validation split since fitDataset doesn't support validationSplit directly easily
    // We will use all data for training for now to simplify or implement manual split if needed
    // For mobile stability, we'll just train on everything or implement a simple split

    // Simple split for validation
    const numVal = Math.floor(data.images.length * config.validationSplit);
    const numTrain = data.images.length - numVal;

    // Shuffle all data first
    const indices = tf.util.createShuffledIndices(data.images.length);
    const trainIndices = indices.slice(0, numTrain);
    const valIndices = indices.slice(numTrain);

    const trainBlobs = Array.from(trainIndices).map((i) => data.images[i]);
    const trainLabels = Array.from(trainIndices).map((i) => data.labels[i]);

    const valBlobs = Array.from(valIndices).map((i) => data.images[i]);
    const valLabels = Array.from(valIndices).map((i) => data.labels[i]);

    const trainDataset = this.createDataset(
      trainBlobs,
      trainLabels,
      config.batchSize
    );
    const valDataset = this.createDataset(
      valBlobs,
      valLabels,
      config.batchSize
    );

    const history = await this.model.fitDataset(trainDataset, {
      epochs: config.epochs,
      batchesPerEpoch: Math.ceil(numTrain / config.batchSize),
      validationData: valDataset,
      validationBatches: Math.ceil(numVal / config.batchSize),
      callbacks: [
        {
          onEpochEnd: (epoch: number, logs: tf.Logs | undefined) => {
            console.log(
              `Epoch ${epoch + 1}: loss=${logs?.loss.toFixed(
                4
              )}, acc=${logs?.acc.toFixed(
                4
              )}, val_loss=${logs?.val_loss?.toFixed(
                4
              )}, val_acc=${logs?.val_acc?.toFixed(4)}`
            );
            if (onEpochEnd) onEpochEnd(epoch + 1, logs);
          },
        },
        tf.callbacks.earlyStopping({ monitor: "val_loss", patience: 3 }),
      ],
    });

    return history;
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
