import * as tf from "@tensorflow/tfjs";
import JSZip from "jszip";
import { TrainingConfig, ConfusionMatrixResult } from "./types";

export class CNNTrainer {
  private static instance: CNNTrainer;

  public static getInstance(): CNNTrainer {
    if (!CNNTrainer.instance) {
      CNNTrainer.instance = new CNNTrainer();
    }
    return CNNTrainer.instance;
  }

  private model: tf.LayersModel | null = null;
  private labels: string[] = [];
  private stopRequested: boolean = false;
  private seed: number = 42; // Default seed for reproducibility
  private lastTrainingHistory: Array<{
    epoch: number;
    loss: number;
    acc: number;
    val_loss: number;
    val_acc: number;
  }> = [];

  private lastDatasetStats: Array<{
    Class: string;
    Total: number;
    Train: number;
    Val: number;
  }> = [];

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
    this.stopRequested = true;
    if (this.model) {
      this.model.stopTraining = true;
      this.model.dispose();
      this.model = null;
    }
  }

  /**
   * Creates a model using Transfer Learning from MobileNet V1
   * Input: 224x224x3
   * Output: 15 classes
   */
  public async createModel(
    onLog?: (msg: string) => void
  ): Promise<tf.LayersModel> {
    try {
      const msg = "Attempting to load MobileNet for Transfer Learning...";
      console.log(msg);
      if (onLog) onLog(msg);

      // Load MobileNet (alpha=0.25 for speed/size)
      const mobilenet = await tf.loadLayersModel(
        "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json"
      );

      // Get the output of the internal layer
      // We choose 'conv_pw_13_relu' which is a common cut-off point for MobileNetV1
      const layer = mobilenet.getLayer("conv_pw_13_relu");

      const successMsg = `MobileNet loaded. Adapting for ${this.labels.length} classes...`;
      console.log(successMsg);
      if (onLog) onLog(successMsg);

      // Create a new model that outputs from the chosen layer
      const trunk = tf.model({
        inputs: mobilenet.inputs,
        outputs: layer.output,
      });

      // Freeze the trunk layers
      for (const layer of trunk.layers) {
        layer.trainable = false;
      }

      // Build the full model
      const model = tf.sequential();
      model.add(trunk);
      model.add(tf.layers.flatten());
      model.add(tf.layers.dense({ units: 100, activation: "relu" }));
      model.add(
        tf.layers.dense({ units: this.labels.length, activation: "softmax" })
      );

      model.compile({
        optimizer: tf.train.adam(0.0001), // Lower learning rate for transfer learning
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
      });

      this.model = model;
      return model;
    } catch (e) {
      console.error("Failed to load MobileNet, falling back to simple CNN", e);
      // Fallback to simple CNN if internet fails
      const model = tf.sequential();
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
      model.add(tf.layers.flatten());
      model.add(
        tf.layers.dense({ units: this.labels.length, activation: "softmax" })
      );

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
      });

      this.model = model;
      return model;
    }
  }

  /**
   * Generates a pseudo-random number between 0 and 1 using a seed.
   * Simple Linear Congruential Generator (LCG).
   */
  private seededRandom(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Shuffles an array in place using the seeded random generator.
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Loads dataset from ZIP files (containing /crops images)
   * Performs a STRATIFIED SPLIT (80% Train / 20% Val)
   */
  public async loadDatasetFromZips(
    zipFiles: File[],
    expectedTotalImages: number,
    onProgress?: (count: number, total: number) => void
  ): Promise<{
    train: { xs: tf.Tensor4D; ys: tf.Tensor2D };
    val: { xs: tf.Tensor4D; ys: tf.Tensor2D };
    stats: Array<{
      Class: string;
      Total: number;
      Train: number;
      Val: number;
    }>;
  }> {
    this.stopRequested = false;
    // Reset seed for reproducibility at each load
    this.seed = 42;

    // Temporary storage grouped by label index to ensure stratified split
    const dataByLabel: { [labelIndex: number]: tf.Tensor3D[] } = {};
    this.labels.forEach((_, i) => (dataByLabel[i] = []));

    // Use expected total for accurate progress bar
    const estimatedTotalFiles = expectedTotalImages;
    let processedGlobalCount = 0;

    for (const zipFile of zipFiles) {
      if (this.stopRequested) break;

      try {
        const zip = await JSZip.loadAsync(zipFile);
        const cropFiles = Object.keys(zip.files).filter(
          (path) =>
            path.startsWith("crops/") &&
            (path.endsWith(".jpg") || path.endsWith(".jpeg"))
        );

        for (const filename of cropFiles) {
          if (this.stopRequested) break;

          processedGlobalCount++;
          if (onProgress && processedGlobalCount % 20 === 0) {
            onProgress(processedGlobalCount, estimatedTotalFiles);
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

              dataByLabel[labelIndex].push(tensor);
              imgBitmap.close(); // Clean up bitmap
            }
          }
        }
      } catch (e) {
        console.error(`Failed to load zip file ${zipFile.name}:`, e);
      }
    }

    if (this.stopRequested) {
      // Dispose all tensors
      Object.values(dataByLabel)
        .flat()
        .forEach((t) => t.dispose());
      throw new Error("Training stopped by user during data loading.");
    }

    // --- STRATIFIED SPLIT ---
    const trainImages: tf.Tensor3D[] = [];
    const trainLabels: number[] = [];
    const valImages: tf.Tensor3D[] = [];
    const valLabels: number[] = [];
    const stats: Array<{
      Class: string;
      Total: number;
      Train: number;
      Val: number;
    }> = [];

    console.group("📊 Dataset Distribution (Stratified Split)");
    const statsTable = this.labels.map((label, i) => {
      const total = dataByLabel[i].length;
      // Calculate split count
      const nVal = Math.floor(total * 0.2); // 20% validation

      // Shuffle specifically this class's images
      const shuffled = this.shuffleArray(dataByLabel[i]);

      // Distribute
      const valSet = shuffled.slice(0, nVal);
      const trainSet = shuffled.slice(nVal);

      valSet.forEach((t) => {
        valImages.push(t);
        valLabels.push(i);
      });

      trainSet.forEach((t) => {
        trainImages.push(t);
        trainLabels.push(i);
      });

      return {
        Class: label,
        Total: total,
        Train: trainSet.length,
        Val: valSet.length,
      };
    });

    stats.push(...statsTable);
    this.lastDatasetStats = stats; // Save for export

    console.table(statsTable);
    console.groupEnd();

    if (trainImages.length === 0) {
      throw new Error("No valid training data found.");
    }

    // Stack tensors
    const trainXs = tf.stack(trainImages) as tf.Tensor4D;
    const trainYs = tf.oneHot(
      tf.tensor1d(trainLabels, "int32"),
      this.labels.length
    ) as tf.Tensor2D;

    const valXs = tf.stack(valImages) as tf.Tensor4D;
    const valYs = tf.oneHot(
      tf.tensor1d(valLabels, "int32"),
      this.labels.length
    ) as tf.Tensor2D;

    // Verify shapes
    console.log(
      `✅ Split Complete. Train: ${trainXs.shape[0]} samples, Val: ${valXs.shape[0]} samples.`
    );

    // Dispose individual tensors now that they are stacked
    trainImages.forEach((t) => t.dispose());
    valImages.forEach((t) => t.dispose());

    return {
      train: { xs: trainXs, ys: trainYs },
      val: { xs: valXs, ys: valYs },
      stats,
    };
  }

  /**
   * Augments a batch of images with random variations (Vectorized for speed)
   */
  private augmentBatch(batch: tf.Tensor4D): tf.Tensor4D {
    return tf.tidy(() => {
      const batchSize = batch.shape[0];
      let aug = batch;

      // 1. Random Brightness (+/- 20%)
      const brightness = tf.randomUniform([batchSize, 1, 1, 1], -0.2, 0.2);
      aug = aug.add(brightness).clipByValue(0, 1) as tf.Tensor4D;

      // 2. Random Contrast (0.8 to 1.2)
      const contrast = tf.randomUniform([batchSize, 1, 1, 1], 0.8, 1.2);
      aug = aug
        .sub(0.5)
        .mul(contrast)
        .add(0.5)
        .clipByValue(0, 1) as tf.Tensor4D;

      // 3. Random Noise (Gaussian)
      // Small noise to robustness
      const noise = tf.randomNormal(aug.shape, 0, 0.02);
      aug = aug.add(noise).clipByValue(0, 1) as tf.Tensor4D;

      return aug;
    });
  }

  /**
   * Trains the model.
   */
  public async train(
    trainData: { xs: tf.Tensor4D; ys: tf.Tensor2D },
    valData: { xs: tf.Tensor4D; ys: tf.Tensor2D },
    config: TrainingConfig,
    onEpochEnd?: (epoch: number, logs: tf.Logs | undefined) => void,
    onLog?: (message: string) => void
  ) {
    // ALWAYS create/reset model at start of training to ensure fresh state (and load MobileNet)
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.stopRequested = false;
    this.lastTrainingHistory = [];

    await this.createModel(onLog);

    if (!this.model) throw new Error("Model creation failed");

    // Capture model locally to satisfy TS in callbacks
    // const model = this.model;

    const numTrainSamples = trainData.xs.shape[0];
    const numValSamples = valData.xs.shape[0];
    console.log(
      `Starting training with ${numTrainSamples} train samples and ${numValSamples} val samples...`
    );

    // --- CLASS WEIGHTING LOGIC ---
    // Calculate class weights to handle potential dataset imbalance
    // Formula: weight_i = total_samples / (num_classes * count_i)

    // Use tf.tidy to clean up intermediate tensors during calculation
    const trainSampleWeights = tf.tidy(() => {
      const trainLabelsTensor = trainData.ys.argMax(1);
      const trainLabels = trainLabelsTensor.dataSync();

      const classCounts: { [key: number]: number } = {};
      trainLabels.forEach(
        (l: number) => (classCounts[l] = (classCounts[l] || 0) + 1)
      );

      const numClasses = this.labels.length;
      const totalSamples = trainLabels.length;
      const classWeights: { [key: number]: number } = {};

      Object.keys(classCounts).forEach((key) => {
        const k = Number(key);
        const count = classCounts[k];
        // Standard balancing formula
        classWeights[k] = totalSamples / (numClasses * count);
      });

      // Log weights
      if (onLog) {
        const weightsInfo = this.labels
          .map((l, i) =>
            classWeights[i] ? `${l}=${classWeights[i].toFixed(2)}` : null
          )
          .filter(Boolean)
          .join(", ");
        onLog(`Balancing: [${weightsInfo}]`);
      }

      const sampleWeightsArray = new Float32Array(totalSamples);
      for (let i = 0; i < totalSamples; i++) {
        sampleWeightsArray[i] = classWeights[trainLabels[i]] || 0;
      }
      return tf.tensor1d(sampleWeightsArray);
    });

    // Custom training loop
    const BATCH_SIZE = config.batchSize;
    const STEPS_PER_EPOCH = Math.ceil(numTrainSamples / BATCH_SIZE);

    // Early Stopping State (Monitors Val Loss)
    let bestValLoss = Infinity;
    let patienceCount = 0;
    let bestWeights: tf.NamedTensorMap | undefined;

    for (let epoch = 0; epoch < config.epochs; epoch++) {
      if (this.stopRequested) break;

      // --- TRAINING PHASE ---
      let trainEpochLoss = 0;
      let trainEpochAcc = 0;

      // Shuffle indices for training only (guarantees every sample is seen exactly once)
      const indices = tf.util.createShuffledIndices(numTrainSamples);

      for (let i = 0; i < numTrainSamples; i += BATCH_SIZE) {
        if (this.stopRequested) break;

        const batchIndices: number[] = [];
        for (let j = 0; j < BATCH_SIZE && i + j < numTrainSamples; j++) {
          batchIndices.push(indices[i + j]);
        }

        // Random Batch Sampling (with Replacement) & Augmentation
        // Using tf.tidy to ensure intermediate tensors are cleaned up
        const { batchXsAugmented, batchYs, batchSampleWeights } = tf.tidy(
          () => {
            const batchIndicesTensor = tf.tensor1d(batchIndices, "int32");
            const bx = trainData.xs.gather(batchIndicesTensor);
            const by = trainData.ys.gather(batchIndicesTensor);
            const bw = trainSampleWeights.gather(batchIndicesTensor); // Gather weights
            const aug = this.augmentBatch(bx as tf.Tensor4D);
            return {
              batchXsAugmented: aug,
              batchYs: by,
              batchSampleWeights: bw,
            };
          }
        );

        // Train
        let lossVal = 0;
        let accVal = 0;

        try {
          // Manual training step with sample weights
          // model.fit() sampleWeight support is limited in WebGL, so we use trainOnBatch
          // Note: trainOnBatch doesn't support sample weights directly either in all versions,
          // so we might need a custom optimizer loop if this fails again.
          // BUT: TF.js documentation says trainOnBatch(x, y) returns loss.
          // To implement weights, we need to use optimizer.minimize() with a custom loss function.

          const lossScalar = tf.tidy(() => {
            if (!this.model) return tf.scalar(0);

            const optimizer = this.model.optimizer;
            const def = optimizer.minimize(() => {
              if (!this.model) return tf.scalar(0); // Should not happen
              const preds = this.model.predict(batchXsAugmented) as tf.Tensor;
              const loss = tf.metrics.categoricalCrossentropy(batchYs, preds);
              // Apply sample weights: loss * weights
              // Ensure dimensions match for broadcasting if needed
              return loss.mul(batchSampleWeights).mean();
            }, true); // true = return cost

            // Handle null return from minimize (though rare if variables exist)
            // tf.tidy requires a Tensor return, not null.
            return def ? def : tf.scalar(0);
          });

          // Calculate accuracy for reporting
          const accScalar = tf.tidy(() => {
            if (!this.model) return tf.scalar(0);
            const preds = this.model.predict(batchXsAugmented) as tf.Tensor;
            const predLabels = preds.argMax(1);
            const trueLabels = batchYs.argMax(1);
            return predLabels.equal(trueLabels).cast("float32").mean();
          });

          if (lossScalar) {
            // dataSync works on Tensor
            const lossData = lossScalar.dataSync();
            lossVal = lossData[0];
            lossScalar.dispose();
          }
          if (accScalar) {
            const accData = accScalar.dataSync();
            accVal = accData[0];
            accScalar.dispose();
          }
        } finally {
          batchXsAugmented.dispose();
          batchYs.dispose();
          batchSampleWeights.dispose();
        }

        trainEpochLoss += lossVal;
        trainEpochAcc += accVal;

        // Progress logging for slow GPUs
        const currentStep = Math.floor(i / BATCH_SIZE) + 1;
        if (onLog && (currentStep % 5 === 0 || currentStep === 1)) {
          const percent = Math.round((currentStep / STEPS_PER_EPOCH) * 100);
          onLog(
            `Epoch ${
              epoch + 1
            }: ${percent}% (${currentStep}/${STEPS_PER_EPOCH} batches)...`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1));
        await tf.nextFrame();
      }

      if (this.stopRequested) break;

      const avgTrainLoss = trainEpochLoss / STEPS_PER_EPOCH;
      const avgTrainAcc = trainEpochAcc / STEPS_PER_EPOCH;

      // --- VALIDATION PHASE (No Augmentation, No Backprop) ---
      let valEpochLoss = 0;
      let valEpochAcc = 0;
      // Use full validation set for fairness
      const valSteps = Math.ceil(numValSamples / BATCH_SIZE);

      // No shuffling needed for validation, just iterate
      if (this.model && !this.stopRequested) {
        for (let i = 0; i < numValSamples; i += BATCH_SIZE) {
          const end = Math.min(i + BATCH_SIZE, numValSamples);
          // Slice directly (faster than gather)
          const batchValXs = valData.xs.slice(
            [i, 0, 0, 0],
            [end - i, 224, 224, 3]
          );
          const batchValYs = valData.ys.slice(
            [i, 0],
            [end - i, this.labels.length]
          );

          // Evaluate
          const evalRes = (this.model as tf.LayersModel).evaluate(
            batchValXs,
            batchValYs
          ) as tf.Scalar[];
          const vLoss = evalRes[0].dataSync()[0];
          const vAcc = evalRes[1].dataSync()[0];

          valEpochLoss += vLoss;
          valEpochAcc += vAcc;

          // Cleanup
          batchValXs.dispose();
          batchValYs.dispose();
          evalRes.forEach((t) => t.dispose());
        }
      }

      const avgValLoss = valEpochLoss / valSteps;
      const avgValAcc = valEpochAcc / valSteps;

      // Log Results
      const logMsg = `Epoch ${epoch + 1}: Train [loss=${avgTrainLoss.toFixed(
        4
      )}, accuracy=${avgTrainAcc.toFixed(
        4
      )}] | Validation [loss=${avgValLoss.toFixed(
        4
      )}, accuracy=${avgValAcc.toFixed(4)}]`;
      console.log(logMsg);
      if (onLog) onLog(logMsg);

      // Save to history
      this.lastTrainingHistory.push({
        epoch: epoch + 1,
        loss: avgTrainLoss,
        acc: avgTrainAcc,
        val_loss: avgValLoss,
        val_acc: avgValAcc,
      });

      // --- Early Stopping Check (Based on Val Loss) ---
      if (config.earlyStopping?.enabled) {
        if (avgValLoss < bestValLoss - config.earlyStopping.minDelta) {
          // Improvement detected
          bestValLoss = avgValLoss;
          patienceCount = 0;

          // Save best weights
          if (bestWeights) {
            tf.dispose(bestWeights);
          }
          bestWeights = {};
          if (this.model) {
            (this.model as tf.LayersModel).getWeights().forEach((w, i) => {
              bestWeights![i] = w.clone();
            });
          }
        } else {
          // No improvement
          patienceCount++;
          const msg = `⚠️ Early Stopping: No val_loss improvement for ${patienceCount}/${
            config.earlyStopping.patience
          } epochs. (Best: ${bestValLoss.toFixed(4)})`;
          console.log(msg);
          if (onLog) onLog(msg);

          if (patienceCount >= config.earlyStopping.patience) {
            const stopMsg = `🛑 Early Stopping triggered at epoch ${
              epoch + 1
            }! Restoring best weights...`;
            console.log(stopMsg);
            if (onLog) onLog(stopMsg);

            this.stopRequested = true;

            // Restore best weights
            if (bestWeights && this.model) {
              const weightArray: tf.Tensor[] = [];
              Object.keys(bestWeights)
                .sort((a, b) => Number(a) - Number(b))
                .forEach((key) => {
                  weightArray.push(bestWeights![key]);
                });
              if (this.model) {
                // Ensure model is not null before calling setWeights
                (this.model as tf.LayersModel).setWeights(weightArray);
              }
              const restoreMsg = `♻️ Restored model to best val_loss: ${bestValLoss.toFixed(
                4
              )}`;
              console.log(restoreMsg);
              if (onLog) onLog(restoreMsg);
            }
            break;
          }
        }
      }

      if (onEpochEnd) {
        onEpochEnd(epoch + 1, {
          loss: avgTrainLoss,
          acc: avgTrainAcc,
          val_loss: avgValLoss,
          val_acc: avgValAcc,
        } as unknown as tf.Logs);
      }
    }

    // Cleanup
    if (trainSampleWeights) {
      trainSampleWeights.dispose();
    }

    // Cleanup bestWeights tensors
    if (bestWeights) {
      tf.dispose(bestWeights);
    }

    return {
      history: {
        loss: [],
        acc: [],
      },
    };
  }

  /**
   * Generates a Confusion Matrix from the validation set.
   */
  public async generateConfusionMatrix(valData: {
    xs: tf.Tensor4D;
    ys: tf.Tensor2D;
  }): Promise<ConfusionMatrixResult> {
    if (!this.model) throw new Error("Model not trained");

    console.log("📊 Generating Confusion Matrix...");

    const matrixTensor = tf.tidy(() => {
      // 1. Predict
      const predictions = this.model!.predict(valData.xs) as tf.Tensor;
      
      // 2. Extract Labels
      const predLabels = predictions.argMax(1) as tf.Tensor1D;
      const trueLabels = valData.ys.argMax(1) as tf.Tensor1D;

      // 3. Compute Matrix
      return tf.math.confusionMatrix(
        trueLabels,
        predLabels,
        this.labels.length
      );
    });

    // 4. Download to CPU
    const matrix = (await matrixTensor.array()) as number[][];
    matrixTensor.dispose(); // Manual dispose since it escaped tidy

    // 5. Normalize (Row-wise)
    const normalized = matrix.map((row) => {
      const sum = row.reduce((a, b) => a + b, 0);
      return row.map((val) => (sum > 0 ? val / sum : 0));
    });

    return {
      matrix,
      normalized,
      labels: this.labels,
    };
  }

  /**
   * Exports the trained model as a single ZIP file containing:
   * - neko-skyjo-model.json
   * - neko-skyjo-model.weights.bin
   * - neko-skyjo-model-logs.txt
   */
  public async exportModel(
    elapsedTime?: string,
    confusionMatrix?: ConfusionMatrixResult
  ) {
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

        // Add Training History (Logs only)
        if (this.lastTrainingHistory.length > 0) {
          const lastEntry =
            this.lastTrainingHistory[this.lastTrainingHistory.length - 1];
          let logContent = `--------------------------------------------------\n`;
          logContent += `Epoch: ${lastEntry.epoch}\n`;
          logContent += `Loss: ${lastEntry.loss.toFixed(
            4
          )} (Validation: ${lastEntry.val_loss.toFixed(4)})\n`;
          logContent += `Accuracy: ${(lastEntry.acc * 100).toFixed(
            1
          )}% (Validation: ${(lastEntry.val_acc * 100).toFixed(1)}%)\n`;
          if (elapsedTime) {
            logContent += `Duration: ${elapsedTime}\n`;
          }
          logContent += `--------------------------------------------------\n\n`;

          // Add Confusion Matrix Analysis
          if (confusionMatrix) {
            const { matrix, normalized, labels } = confusionMatrix;

            logContent += `📊 Confusion Matrix Analysis\n`;
            logContent += `============================\n\n`;

            // 1. Top Confusions
            const errors = normalized
              .flatMap((row, i) =>
                row.map((val, j) => ({
                  from: labels[i],
                  to: labels[j],
                  percent: val,
                  count: matrix[i][j],
                }))
              )
              .filter((e) => e.from !== e.to && e.percent > 0.05) // Filter > 5%
              .sort((a, b) => b.percent - a.percent);

            if (errors.length > 0) {
              logContent += `⚠️ MAJOR CONFUSIONS (>5%):\n`;
              logContent += `-------------------------\n`;
              errors.forEach((e) => {
                logContent += `${e.from.padEnd(4)} -> ${e.to.padEnd(
                  4
                )} : ${(e.percent * 100).toFixed(1)}% (${e.count} errors)\n`;
              });
              logContent += `-------------------------\n\n`;
            } else {
              logContent += `✅ No major confusions detected (>5%).\n\n`;
            }

            // 2. Full Matrix (ASCII Art style)
            logContent += `📈 Full Matrix (Rows=True, Cols=Pred)\n`;
            // Header
            logContent += `      ` + labels.map((l) => l.padStart(4)).join(" ") + "\n";
            // Rows
            matrix.forEach((row, i) => {
              logContent += `${labels[i].padStart(4)} |`;
              row.forEach((val) => {
                logContent += val.toString().padStart(4) + " ";
              });
              logContent += "\n";
            });
            logContent += "\n";
          }

          // Add Dataset Stats
          if (this.lastDatasetStats.length > 0) {
            logContent += "📊 Dataset Distribution:\n";
            logContent += "Class | Total | Train | Val\n";
            logContent += "-------------------------------\n";
            this.lastDatasetStats.forEach((s) => {
              logContent += `${s.Class.padEnd(5)} | ${s.Total.toString().padEnd(
                5
              )} | ${s.Train.toString().padEnd(5)} | ${s.Val.toString().padEnd(
                5
              )}\n`;
            });
            logContent += "-------------------------------\n\n";
          }

          this.lastTrainingHistory.forEach((entry) => {
            logContent += `Epoch ${
              entry.epoch
            }: Train [loss=${entry.loss.toFixed(
              4
            )}, accuracy=${entry.acc.toFixed(
              4
            )}] | Validation [loss=${entry.val_loss.toFixed(
              4
            )}, accuracy=${entry.val_acc.toFixed(4)}]\n`;
          });

          zip.file("neko-skyjo-model-logs.txt", logContent);
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
