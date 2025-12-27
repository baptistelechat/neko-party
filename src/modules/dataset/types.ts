export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectedCard {
  label: string;
  bbox: BBox;
  confidence?: number;
}

export interface DatasetAnnotation {
  version: '1.0';
  id: string;
  timestamp: number;
  imageId: string;
  
  meta: {
    userAgent: string;
    device?: string;
  };

  cards: DetectedCard[];
}

export interface DatasetEntry {
  raw: Blob;
  crop: Blob;
  annotation: DatasetAnnotation;
  features?: string; // JSON string
  filenamePrefix: string;
}
