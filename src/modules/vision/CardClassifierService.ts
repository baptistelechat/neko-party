import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';

export class CardClassifierService {
  private static instance: CardClassifierService;
  private classifier: knnClassifier.KNNClassifier | null = null;
  private net: mobilenet.MobileNet | null = null;
  private isModelLoading = false;
  
  // Store only NEW examples added in this session for export
  private sessionTensors: { [label: string]: tf.Tensor2D[] } = {};

  private constructor() {}

  public static getInstance(): CardClassifierService {
    if (!CardClassifierService.instance) {
      CardClassifierService.instance = new CardClassifierService();
    }
    return CardClassifierService.instance;
  }

  public async loadModel() {
    if (this.net || this.isModelLoading) return;
    
    this.isModelLoading = true;
    try {
      console.log('Loading MobileNet...');
      this.classifier = knnClassifier.create();
      this.net = await mobilenet.load();
      console.log('MobileNet loaded');
      
      let finalDataset: { [label: string]: tf.Tensor2D } = {};

      // 1. Load Global Models from src/assets/models/*.json using Vite's import.meta.glob
      // The user will place manually exported JSON files there.
      const models = import.meta.glob('/src/assets/models/*.json', { eager: true, as: 'raw' });
      
      for (const path in models) {
          try {
              const jsonStr = models[path] as string;
              // Only load if content exists
              if (jsonStr) {
                const dataset = this.parseDataset(jsonStr);
                finalDataset = this.mergeDatasets(finalDataset, dataset);
                console.log(`Loaded model from ${path}`);
              }
          } catch (e) {
              console.error(`Failed to load model from ${path}`, e);
          }
      }

      // 2. Also try loading the old single global model if it exists (legacy support)
      try {
        const response = await fetch('/skyjo_model.json');
        if (response.ok) {
            const jsonStr = await response.text();
            const globalDataset = this.parseDataset(jsonStr);
            finalDataset = this.mergeDatasets(finalDataset, globalDataset);
            console.log('Global model loaded from /skyjo_model.json');
        }
      } catch (e) {
        // Ignore if missing
      }

      if (Object.keys(finalDataset).length > 0) {
          this.classifier.setClassifierDataset(finalDataset);
          console.log(`Classifier initialized with ${Object.keys(finalDataset).length} classes`);
      }

    } catch (error) {
      console.error('Failed to load MobileNet:', error);
    } finally {
      this.isModelLoading = false;
    }
  }

  // Helper to parse JSON to Tensor dataset
  private parseDataset(jsonStr: string): { [label: string]: tf.Tensor2D } {
      const datasetObj = JSON.parse(jsonStr);
      const dataset: { [label: string]: tf.Tensor2D } = {};
      Object.keys(datasetObj).forEach((key) => {
          const { data, shape } = datasetObj[key];
          dataset[key] = tf.tensor(data, shape) as tf.Tensor2D;
      });
      return dataset;
  }

  // Helper to merge two datasets
  private mergeDatasets(d1: { [label: string]: tf.Tensor }, d2: { [label: string]: tf.Tensor }): { [label: string]: tf.Tensor2D } {
      const merged: { [label: string]: tf.Tensor2D } = {};
      
      // Copy d1
      Object.keys(d1).forEach(k => merged[k] = d1[k] as tf.Tensor2D);

      Object.keys(d2).forEach(label => {
          if (merged[label]) {
              const oldTensor = merged[label];
              const newTensor = d2[label] as tf.Tensor2D;
              // Concat along axis 0 (examples)
              merged[label] = tf.concat([oldTensor, newTensor], 0) as tf.Tensor2D;
              
              // Cleanup
              oldTensor.dispose();
              newTensor.dispose(); 
          } else {
              merged[label] = d2[label] as tf.Tensor2D;
          }
      });
      return merged;
  }

  public async addExample(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, label: string) {
    if (!this.net || !this.classifier) {
      await this.loadModel();
    }

    if (this.net && this.classifier) {
      const activation = this.net.infer(imageElement, true);
      this.classifier.addExample(activation, label);

      // Store clone for session export (only new data)
      if (!this.sessionTensors[label]) {
        this.sessionTensors[label] = [];
      }
      // Clone because we want to own this tensor copy independently
      this.sessionTensors[label].push(activation.clone() as tf.Tensor2D);

      activation.dispose();
    }
  }

  public async predict(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<{ label: string; confidences: { [label: string]: number } } | null> {
    if (!this.net || !this.classifier || this.classifier.getNumClasses() === 0) {
      return null;
    }

    const activation = this.net.infer(imageElement, true);
    try {
      const result = await this.classifier.predictClass(activation);
      return result;
    } catch (error) {
      console.error('Prediction error:', error);
      return null;
    } finally {
        activation.dispose();
    }
  }

  public getExampleCount(): { [label: string]: number } | null {
      if (!this.classifier) return null;
      return this.classifier.getClassExampleCount();
  }

  public clearAllExamples() {
      if (this.classifier) {
          this.classifier.clearAllClasses();
      }
      // Clear session tensors
      Object.values(this.sessionTensors).flat().forEach(t => t.dispose());
      this.sessionTensors = {};
  }

  // Persistence Methods
  public async getClassifierDatasetJSON(labelToExport?: string): Promise<string | null> {
      // Export ONLY session tensors (newly added), not the full merged dataset
      
      const datasetObj: any = {};
      const labels = labelToExport ? [labelToExport] : Object.keys(this.sessionTensors);
      
      let hasData = false;

      for (const label of labels) {
        if (this.sessionTensors[label] && this.sessionTensors[label].length > 0) {
            // Concat all examples for this label
            const concatenated = tf.concat(this.sessionTensors[label], 0);
            datasetObj[label] = {
                data: Array.from(concatenated.dataSync()),
                shape: concatenated.shape
            };
            concatenated.dispose();
            hasData = true;
        }
      }
      
      if (!hasData) return null;

      return JSON.stringify(datasetObj);
  }
}
