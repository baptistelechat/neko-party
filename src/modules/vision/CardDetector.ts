import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export class CardDetector {
  private model: cocoSsd.ObjectDetection | null = null;

  async load() {
    if (!this.model) {
      await tf.ready();
      this.model = await cocoSsd.load();
    }
  }

  async detect(imageElement: HTMLImageElement | HTMLVideoElement) {
    if (!this.model) {
      await this.load();
    }
    if (this.model) {
        // Class 'book' or similar might be detected for cards in coco-ssd, 
        // but for specific Skyjo cards, we need custom training or just blob detection.
        // For now, return raw predictions.
        return await this.model.detect(imageElement);
    }
    return [];
  }
}

export const cardDetector = new CardDetector();
