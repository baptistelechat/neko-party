import JSZip from 'jszip';
import { DatasetAnnotation, DatasetEntry, BBox } from './types';
import { CardClassifierService } from '../vision/CardClassifierService';

export class DatasetService {
  private static instance: DatasetService;
  private sessionEntries: DatasetEntry[] = [];

  private constructor() {}

  public static getInstance(): DatasetService {
    if (!DatasetService.instance) {
      DatasetService.instance = new DatasetService();
    }
    return DatasetService.instance;
  }

  public getSessionCount(): number {
    return this.sessionEntries.length;
  }

  public clearSession(): void {
    this.sessionEntries = [];
  }

  public getSessionEntries(): DatasetEntry[] {
    return this.sessionEntries;
  }

  public removeEntry(index: number): void {
    if (index >= 0 && index < this.sessionEntries.length) {
      this.sessionEntries.splice(index, 1);
    }
  }

  /**
   * Adds a card scan to the current session.
   */
  public async addEntry(
    source: HTMLVideoElement | HTMLCanvasElement,
    label: string,
    containerRect: DOMRect,
    overlayRect: DOMRect
  ): Promise<void> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    // Filename Format: skyjo_[type]_[value]_[timestamp]_[random]
    // Base prefix for this entry: skyjo
    const id = `${timestamp}_${randomSuffix}`;
    const filenameBase = `skyjo`; 

    // Determine dimensions
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    // 1. Capture Raw Image
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = width;
    rawCanvas.height = height;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) throw new Error('Failed to create canvas context');
    
    // Draw full frame
    rawCtx.drawImage(source, 0, 0, width, height);
    
    const rawBlob = await new Promise<Blob | null>(resolve => rawCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!rawBlob) throw new Error('Failed to create raw blob');

    // 2. Calculate BBox (Map overlay coordinates to video coordinates)
    const rawBBox = this.calculateBBox(
      width,
      height,
      containerRect.width,
      containerRect.height,
      overlayRect
    );

    // Add Safety Padding (15%) to capture slightly more than the box
    // This helps with imperfect framing and perspective
    const bbox = this.applyPadding(rawBBox, width, height, 0.15);

    // 3. Extract Crop
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = bbox.w;
    cropCanvas.height = bbox.h;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) throw new Error('Failed to create crop context');

    cropCtx.drawImage(
      rawCanvas,
      bbox.x, bbox.y, bbox.w, bbox.h, // Source
      0, 0, bbox.w, bbox.h            // Destination
    );

    const cropBlob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!cropBlob) throw new Error('Failed to create crop blob');

    // 4. Generate Annotation
    // Filename format: skyjo_raw_[value]_[timestamp]_[random].jpg
    const rawFilename = `${filenameBase}_raw_${label}_${id}.jpg`;
    
    const annotation: DatasetAnnotation = {
      version: '1.0',
      id,
      timestamp,
      imageId: rawFilename,
      meta: {
        userAgent: navigator.userAgent,
        device: 'web-camera',
      },
      cards: [
        {
          label,
          bbox,
          confidence: 1.0 // Manual validation implies 100% confidence
        }
      ]
    };

    // Store in Session
    this.sessionEntries.push({
      raw: rawBlob,
      crop: cropBlob,
      annotation,
      filenamePrefix: `${filenameBase}`, // Not used directly for full filename anymore, constructed dynamically
    });
  }

  /**
   * Exports the current session as a ZIP file.
   */
  public async exportSessionZip(sessionLabel: string): Promise<void> {
    if (this.sessionEntries.length === 0) {
      throw new Error("Session is empty");
    }

    const zip = new JSZip();
    const timestamp = Math.floor(Date.now() / 1000);
    const sessionZipName = `neko_dataset_${sessionLabel}_${timestamp}.zip`;

    for (const entry of this.sessionEntries) {
        const { raw, crop, annotation } = entry;
        const id = annotation.id;
        const label = annotation.cards[0].label;
        
        // Construct filenames according to user request:
        // skyjo_[type]_[numero de carte]_[timestamp]_[random]
        
        const rawName = `skyjo_raw_${label}_${id}.jpg`;
        const cropName = `skyjo_crop_${label}_${id}.jpg`;
        const annotName = `skyjo_annotation_${label}_${id}.json`;

        // Update annotation to reference the correct raw filename
        annotation.imageId = rawName;

        // /raw/
        zip.folder('raw')?.file(rawName, raw);
        
        // /crops/
        zip.folder('crops')?.file(cropName, crop);
        
        // /annotations/
        zip.folder('annotations')?.file(annotName, JSON.stringify(annotation, null, 2));
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Trigger Download
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = sessionZipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  private calculateBBox(
    videoW: number,
    videoH: number,
    containerW: number,
    containerH: number,
    overlayRect: DOMRect
  ): BBox {
    // Determine how object-cover scaled the video
    const videoAspect = videoW / videoH;
    const containerAspect = containerW / containerH;

    let renderW, renderH, offsetX, offsetY;

    if (videoAspect > containerAspect) {
      // Video is wider than container: Height matches, Width is cropped
      renderH = containerH;
      renderW = containerH * videoAspect;
      offsetY = 0;
      offsetX = (renderW - containerW) / 2; // Amount cropped from left
    } else {
      // Video is taller than container: Width matches, Height is cropped
      renderW = containerW;
      renderH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (renderH - containerH) / 2; // Amount cropped from top
    }

    // Overlay Rect is relative to the Container (viewport)
    // We need to map it to the Video Coordinate Space
    
    // 1. Convert Overlay coordinates to "Rendered Video" coordinates
    // The rendered video starts at (-offsetX, -offsetY) relative to container top-left.
    // So, a point (x, y) in container is at (x + offsetX, y + offsetY) in rendered video.
    
    const renderX = overlayRect.left + offsetX;
    const renderY = overlayRect.top + offsetY;

    // 2. Scale from Rendered Size to Actual Video Size
    const scale = videoW / renderW; // (should be same as videoH / renderH)

    return {
      x: Math.round(renderX * scale),
      y: Math.round(renderY * scale),
      w: Math.round(overlayRect.width * scale),
      h: Math.round(overlayRect.height * scale)
    };
  }

  private applyPadding(bbox: BBox, imgW: number, imgH: number, paddingFactor: number): BBox {
    const padW = Math.round(bbox.w * paddingFactor);
    const padH = Math.round(bbox.h * paddingFactor);

    let x = bbox.x - padW;
    let y = bbox.y - padH;
    let w = bbox.w + (padW * 2);
    let h = bbox.h + (padH * 2);

    // Clamp to image boundaries
    if (x < 0) { w += x; x = 0; } // x is negative, so w decreases
    if (y < 0) { h += y; y = 0; }
    if (x + w > imgW) { w = imgW - x; }
    if (y + h > imgH) { h = imgH - y; }

    return { x, y, w, h };
  }
}
