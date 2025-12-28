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

  const uploadSession = async (
    label: string,
    onProgress?: (percent: number) => void
  ) => {
    const { blob, filename } = await datasetService.generateSessionZip(label);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `/upload-dataset?filename=${encodeURIComponent(filename)}`
      );

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network Error"));
      };

      xhr.send(blob);
    });
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
