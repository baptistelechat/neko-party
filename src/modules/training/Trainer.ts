import * as tf from '@tensorflow/tfjs';
import JSZip from 'jszip';

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

export class Trainer {
  private model: tf.Sequential | null = null;
  private labels: string[] = [];

  constructor() {
    this.labels = [
      '-2', '-1', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
    ];
  }

  /**
   * Creates a lightweight CNN model suitable for Skyjo card recognition.
   * Input: 224x224x3 (RGB images)
   * Output: 15 classes (probabilities)
   */
  public createModel(): tf.Sequential {
    const model = tf.sequential();

    // 1. Convolutional Layer 1
    model.add(tf.layers.conv2d({
      inputShape: [224, 224, 3],
      filters: 16,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 2. Convolutional Layer 2
    model.add(tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 3. Convolutional Layer 3
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
      padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

    // 4. Flatten & Dense Layers
    model.add(tf.layers.flatten());
    model.add(tf.layers.dropout({ rate: 0.5 })); // Prevent overfitting
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    
    // Output Layer
    model.add(tf.layers.dense({ units: this.labels.length, activation: 'softmax' }));

    // Compile
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.model = model;
    return model;
  }

  /**
   * Loads dataset from ZIP files (containing /crops images)
   * Returns tensors: xs (images) and ys (labels)
   */
  public async loadDatasetFromZips(zipFiles: File[]): Promise<{ xs: tf.Tensor4D, ys: tf.Tensor2D }> {
    const images: tf.Tensor3D[] = [];
    const labels: number[] = [];

    for (const zipFile of zipFiles) {
      const zip = await JSZip.loadAsync(zipFile);
      
      // Filter for crop images
      const cropFiles = Object.keys(zip.files).filter(path => path.startsWith('crops/') && (path.endsWith('.jpg') || path.endsWith('.jpeg')));

      for (const filename of cropFiles) {
        // Extract label from filename: skyjo_crop_[LABEL]_[timestamp].jpg
        const match = filename.match(/skyjo_crop_(-?\d+)_/);
        if (match && match[1]) {
          const labelStr = match[1];
          const labelIndex = this.labels.indexOf(labelStr);
          
          if (labelIndex !== -1) {
            // Load Image
            const blob = await zip.files[filename].async('blob');
            const imgBitmap = await createImageBitmap(blob);
            
            // Convert to Tensor
            const tensor = tf.browser.fromPixels(imgBitmap)
              .resizeNearestNeighbor([224, 224]) // Resize to model input
              .toFloat()
              .div(tf.scalar(255)); // Normalize [0, 1]
            
            images.push(tensor as tf.Tensor3D);
            labels.push(labelIndex);
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error("No valid training data found in ZIPs.");
    }

    // Stack images into a batch tensor
    const xs = tf.stack(images) as tf.Tensor4D;
    
    // One-hot encode labels
    const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), this.labels.length) as tf.Tensor2D;

    // Cleanup individual tensors (stacked one remains)
    images.forEach(t => t.dispose());

    return { xs, ys };
  }

  /**
   * Trains the model using the provided dataset.
   */
  public async train(
    xs: tf.Tensor4D, 
    ys: tf.Tensor2D, 
    config: TrainingConfig,
    onEpochEnd?: (epoch: number, logs: tf.Logs | undefined) => void
  ) {
    if (!this.model) {
      this.createModel();
    }

    if (!this.model) throw new Error("Model creation failed");

    console.log(`Starting training with ${xs.shape[0]} samples...`);

    const history = await this.model.fit(xs, ys, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss=${logs?.loss.toFixed(4)}, acc=${logs?.acc.toFixed(4)}`);
          if (onEpochEnd) onEpochEnd(epoch + 1, logs);
        }
      }
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
    const saveResult = await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
        // This handler receives the model artifacts (json + weights)
        const zip = new JSZip();

        // Prepare standard model.json structure (TFJS format)
        // It must contain 'modelTopology' AND 'weightsManifest' at the root level.
        const modelJSON = {
            modelTopology: artifacts.modelTopology,
            format: artifacts.format,
            generatedBy: artifacts.generatedBy,
            convertedBy: artifacts.convertedBy,
            weightsManifest: [{
                paths: ['./neko-skyjo-model.weights.bin'],
                weights: artifacts.weightSpecs
            }]
        };

        // Add model.json
        zip.file('neko-skyjo-model.json', JSON.stringify(modelJSON));

        // Add weights.bin (if exists)
        if (artifacts.weightData) {
            zip.file('neko-skyjo-model.weights.bin', artifacts.weightData);
        }

        // Generate ZIP blob
        const blob = await zip.generateAsync({ type: 'blob' });
        
        // Trigger Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'neko-skyjo-model-package.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: 'JSON',
            }
        };
    }));
  }
}
