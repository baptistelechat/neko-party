import { useState, useRef } from 'react';
import { Button } from '@/ui/button';
import { Trainer, TrainingConfig } from '@/modules/training/Trainer';
import { Upload, Play, Download, Loader2 } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';

export default function TrainingPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ epoch: 0, loss: 0, acc: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const trainerRef = useRef<Trainer>(new Trainer());
  const [isModelReady, setIsModelReady] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setLogs(prev => [...prev, `Selected ${e.target.files?.length} files.`]);
    }
  };

  const startTraining = async () => {
    setIsTraining(true);
    setIsModelReady(false);
    setLogs([]);
    setElapsedTime(0);
    
    // Start Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      setLogs(prev => [...prev, "Loading dataset from ZIPs..."]);
      
      // 1. Load Data
      const { xs, ys } = await trainerRef.current.loadDatasetFromZips(files);
      setLogs(prev => [...prev, `Dataset loaded: ${xs.shape[0]} samples.`]);

      // 2. Configure Training
      const config: TrainingConfig = {
        epochs: 20,
        batchSize: 16,
        validationSplit: 0.2
      };

      // 3. Train
      setLogs(prev => [...prev, "Starting training... (This may take a while)"]);
      
      // Log Backend info
      const backend = tf.getBackend();
      setLogs(prev => [...prev, `TF.js Backend: ${backend}`]);

      await trainerRef.current.train(xs, ys, config, (epoch, logs) => {
        setProgress({
          epoch,
          loss: logs?.loss || 0,
          acc: logs?.acc || 0
        });
      });

      setLogs(prev => [...prev, "Training completed!"]);
      setIsModelReady(true);

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, `Error: ${err}`]);
    } finally {
      setIsTraining(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const exportModel = async () => {
    try {
      await trainerRef.current.exportModel();
      setLogs(prev => [...prev, "Model exported to downloads folder."]);
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, "Export failed."]);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 min-h-screen text-white flex flex-col gap-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Play className="text-blue-500" />
        Entraînement Local (CNN)
      </h1>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">1. Charger le Dataset (ZIPs)</h2>
        <div className="flex gap-4 items-center">
          <Button variant="secondary" className="relative">
            <Upload className="mr-2 h-4 w-4" />
            Sélectionner ZIPs
            <input 
              type="file" 
              multiple 
              accept=".zip" 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </Button>
          <span className="text-zinc-400">{files.length} fichiers sélectionnés</span>
        </div>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">2. Entraîner le Modèle</h2>
        <div className="flex gap-4 items-center">
          <Button 
            onClick={startTraining} 
            disabled={files.length === 0 || isTraining}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTraining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Lancer l'entraînement
          </Button>
          
          {isTraining && (
            <div className="flex gap-4 text-sm font-mono">
              <span className="text-zinc-400">⏱️ {elapsedTime}s</span>
              <span className="text-yellow-400">Epoch: {progress.epoch}</span>
              <span className="text-red-400">Loss: {progress.loss.toFixed(4)}</span>
              <span className="text-green-400">Acc: {(progress.acc * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
        
        {/* Logs Console */}
        <div className="mt-4 bg-black p-2 rounded h-40 overflow-y-auto font-mono text-xs text-zinc-400 border border-zinc-700">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
        <h2 className="font-bold mb-4">3. Exporter</h2>
        <Button 
          onClick={exportModel} 
          disabled={!isModelReady}
          className="bg-green-600 hover:bg-green-700"
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger model.json
        </Button>
      </div>
    </div>
  );
}
