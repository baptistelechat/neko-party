export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  earlyStopping?: {
    enabled: boolean;
    patience: number; // Nombre d'époques sans amélioration avant arrêt
    minDelta: number; // Amélioration minimale requise
  };
}

export interface ConfusionMatrixResult {
  matrix: number[][];
  normalized: number[][];
  labels: string[];
}
