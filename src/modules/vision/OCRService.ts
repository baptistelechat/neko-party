import Tesseract from 'tesseract.js';

export interface OCRResult {
    text: string;
    confidence: number;
    number: number | null;
}

export class OCRService {
  public static async preprocessImage(imageSrc: string, options: { invert?: boolean; scale?: number } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (img.width < 10 || img.height < 10) {
            console.warn(`Image too small for preprocessing: ${img.width}x${img.height}`);
            resolve(imageSrc);
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        const width = img.width;
        const height = img.height;

        // Crop center 40% width and 50% height to avoid corners (reduced from 50/60)
        const cropWidth = Math.floor(width * 0.4);
        const cropHeight = Math.floor(height * 0.5);
        const startX = Math.floor((width - cropWidth) / 2);
        const startY = Math.floor((height - cropHeight) / 2);

        if (cropWidth <= 0 || cropHeight <= 0) {
            resolve(imageSrc);
            return;
        }

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        const imageData = ctx.getImageData(0, 0, cropWidth, cropHeight);
        const data = imageData.data;
        
        // Contrast Stretching & Dynamic Thresholding
         let min = 255;
         let max = 0;
         
         // First pass: find min/max
         for (let i = 0; i < data.length; i += 4) {
           const r = data[i];
           const g = data[i + 1];
           const b = data[i + 2];
           const gray = 0.299 * r + 0.587 * g + 0.114 * b;
           if (gray < min) min = gray;
           if (gray > max) max = gray;
         }
         
         for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Contrast Stretch
          if (max > min) {
              gray = ((gray - min) / (max - min)) * 255;
          }
          
          // Binarization with fixed threshold after stretch (since we stretched to full range, 128 is a decent middle ground, 
          // or we can use the stretched threshold)
          // Let's stick to a simple adaptive approach: if pixel is significantly brighter than local or global average.
          // For now, let's use the simple threshold on the stretched image.
          gray = gray > 128 ? 255 : 0;
          
          // Inversion (if requested)
          if (options.invert) {
              gray = 255 - gray;
          }

          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
          data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      img.onerror = reject;
      img.src = imageSrc;
    });
  }

  static async createWorker(): Promise<Tesseract.Worker> {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
            if (m.status !== 'recognizing text') console.log(m);
        },
      });
      
      await worker.setParameters({
        tessedit_char_whitelist: '-0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
      });

      return worker;
  }

  static async recognizeWithWorkerDetailed(worker: Tesseract.Worker, imageSrc: string, options: { invert?: boolean } = {}): Promise<OCRResult> {
      const processedImage = await this.preprocessImage(imageSrc, options);
      
      if (!processedImage || processedImage.length < 100) {
          return { text: "", confidence: 0, number: null };
      }

      try {
        const result = await worker.recognize(processedImage);
        const text = result.data.text.trim();
        const confidence = result.data.confidence;
        const number = this.parseNumber(text);
        
        return { text, confidence, number };
      } catch (e) {
          console.error("Worker recognize error", e);
          return { text: "", confidence: 0, number: null };
      }
  }

  // Alias for backward compatibility (but now uses options)
  static async recognizeWithWorker(worker: Tesseract.Worker, imageSrc: string): Promise<string> {
      const result = await this.recognizeWithWorkerDetailed(worker, imageSrc);
      return result.text;
  }

  static async recognizeText(imageSrc: string): Promise<string> {
    try {
      const processedImage = await this.preprocessImage(imageSrc);
      const worker = await this.createWorker();
      const result = await worker.recognize(processedImage);
      await worker.terminate();
      return result.data.text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw error;
    }
  }

  static async recognizeNumber(imageSrc: string): Promise<number | null> {
    const text = await this.recognizeText(imageSrc);
    return this.parseNumber(text);
  }

  static parseNumber(text: string): number | null {
    // Skyjo specific: -2 to 12
    const cleanText = text.replace(/[^0-9-]/g, '');
    const match = cleanText.match(/-?\d+/);
    if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num >= -2 && num <= 12) {
            return num;
        }
    }
    return null;
  }
}
