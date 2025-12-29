"use client";

import { TrainingProgress } from "@/hooks/useTraining";
import { type ChartConfig } from "@/ui/chart";
import { TrainingChartCard } from "./components/TrainingChartCard";

interface TrainingChartsProps {
  data: TrainingProgress[];
}

const accuracyConfig = {
  acc: {
    label: "Train Accuracy",
    color: "#4ade80", // Green 400
  },
  val_acc: {
    label: "Validation Accuracy",
    color: "#86efac", // Green 300
  },
} satisfies ChartConfig;

const lossConfig = {
  loss: {
    label: "Train Loss",
    color: "#f87171", // Red 400
  },
  val_loss: {
    label: "Validation Loss",
    color: "#fca5a5", // Red 300
  },
} satisfies ChartConfig;

export function TrainingCharts({ data }: TrainingChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Loss Chart */}
      <TrainingChartCard
        data={data}
        config={lossConfig}
        title="Loss (Train vs Validation)"
        description="Validation Loss determines Early Stopping"
        trainKey="loss"
        valKey="val_loss"
        footerText="Lower is better"
        colorTheme="red"
      />

      {/* Accuracy Chart */}
      <TrainingChartCard
        data={data}
        config={accuracyConfig}
        title="Accuracy (Train vs Validation)"
        description="Monitor for divergence (Overfitting if Train > Validation)"
        trainKey="acc"
        valKey="val_acc"
        yDomain={[0, 1]}
        footerText="Higher is better"
        footerValueFormatter={(v) => `${(v * 100).toFixed(1)}%`}
        colorTheme="green"
      />
    </div>
  );
}
