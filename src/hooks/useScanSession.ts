import { DatasetService } from "@/modules/dataset/DatasetService";
import { DatasetEntry } from "@/modules/dataset/types";
import { CardClassifierService } from "@/modules/vision/CardClassifierService";
import { useEffect, useRef, useState } from "react";

export const useScanSession = (classifier: CardClassifierService) => {
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionEntries, setSessionEntries] = useState<DatasetEntry[]>([]);
  const [exampleCounts, setExampleCounts] = useState<{ [label: string]: number }>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const targetBoxRef = useRef<HTMLDivElement>(null);
  const datasetService = DatasetService.getInstance();

  useEffect(() => {
    // Load initial counts
    const counts = classifier.getExampleCount();
    if (counts) setExampleCounts(counts);
  }, [classifier]);

  const addExample = async (video: HTMLVideoElement, label: string) => {
    // Feedback: Vibration
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Capture for Dataset Export
    if (containerRef.current && targetBoxRef.current) {
      try {
        await datasetService.addEntry(
          video,
          label,
          containerRef.current.getBoundingClientRect(),
          targetBoxRef.current.getBoundingClientRect()
        );
        setSessionCount(datasetService.getSessionCount());
        setSessionEntries([...datasetService.getSessionEntries()]);
      } catch (e) {
        console.error("Failed to add entry to dataset session", e);
      }
    }

    // Add to Classifier (KNN)
    await classifier.addExample(video, label);
    const counts = classifier.getExampleCount();
    if (counts) setExampleCounts(counts);
  };

  const removeEntry = (index: number) => {
    datasetService.removeEntry(index);
    setSessionCount(datasetService.getSessionCount());
    setSessionEntries([...datasetService.getSessionEntries()]);
    // Note: Can't easily remove from KNN classifier without full reload
  };

  const clearSession = () => {
    classifier.clearAllExamples();
    datasetService.clearSession();
    setSessionCount(0);
    setSessionEntries([]);
    setExampleCounts({});
  };

  const exportSession = async (label: string) => {
    await datasetService.exportSessionZip(label);
  };

  const uploadSession = async (label: string) => {
    const { blob, filename } = await datasetService.generateSessionZip(label);
    const response = await fetch(
        `/upload-dataset?filename=${encodeURIComponent(filename)}`,
        {
          method: "POST",
          body: blob,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      return await response.json();
  };

  return {
    sessionCount,
    sessionEntries,
    exampleCounts,
    containerRef,
    targetBoxRef,
    addExample,
    removeEntry,
    clearSession,
    exportSession,
    uploadSession
  };
};
