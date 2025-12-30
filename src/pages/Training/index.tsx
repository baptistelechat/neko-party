
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cpu, Eye } from "lucide-react";
import RecognitionTraining from "./Recognition";
import DetectionTraining from "./Detection";

export default function TrainingLayout() {
  const [activeTab, setActiveTab] = useState<"recognition" | "detection">("recognition");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <h1 className="font-bold text-sm">Centre d'Entraînement Neko</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        <button
            onClick={() => setActiveTab("recognition")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
                activeTab === "recognition" ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
        >
            <Cpu className="w-4 h-4" />
            Reconnaissance (CNN)
            {activeTab === "recognition" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
        </button>
        <button
            onClick={() => setActiveTab("detection")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
                activeTab === "detection" ? "text-green-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
        >
            <Eye className="w-4 h-4" />
            Détection (YOLO)
            {activeTab === "detection" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
            )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
            {activeTab === "recognition" ? <RecognitionTraining /> : <DetectionTraining />}
        </div>
      </div>
    </div>
  );
}
