"use client";

import { TrainingProgress } from "@/hooks/useTraining";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/ui/chart";
import { CartesianGrid, Label, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

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
  // Find epoch with best validation loss (Early Stopping point)
  const bestEpoch =
    data.length > 0
      ? data.reduce((best, current) =>
          current.val_loss < best.val_loss ? current : best
        ).epoch
      : 0;

  const lastAcc = data.length > 0 ? data[data.length - 1].acc : 0;
  const lastValAcc = data.length > 0 ? data[data.length - 1].val_acc : 0;

  const lastLoss = data.length > 0 ? data[data.length - 1].loss : 0;
  const lastValLoss = data.length > 0 ? data[data.length - 1].val_loss : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Accuracy Chart */}
      <Card className="bg-zinc-800 border-zinc-700 text-white">
        <CardHeader>
          <CardTitle>Accuracy (Train vs Validation)</CardTitle>
          <CardDescription className="text-zinc-400">
            Monitor for divergence (Overfitting if Train &gt; Validation)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={accuracyConfig}
            className="aspect-auto h-62.5 w-full"
          >
            <LineChart
              accessibilityLayer
              data={data}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} stroke="#3f3f46" />
              <XAxis
                dataKey="epoch"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa" }}
              />
              <YAxis hide domain={[0, 1]} />
              {bestEpoch > 0 && (
                <ReferenceLine
                  x={bestEpoch}
                  stroke="#facc15"
                  strokeDasharray="3 3"
                >
                  <Label
                    value="Best"
                    position="insideTopLeft"
                    fill="#facc15"
                    fontSize={12}
                  />
                </ReferenceLine>
              )}
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent className="bg-zinc-900 border-zinc-700 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-zinc-400" />
                }
              />
              <Line
                dataKey="acc"
                type="monotone"
                stroke="var(--color-acc)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="val_acc"
                type="monotone"
                stroke="var(--color-val_acc)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-zinc-400">
          <div className="flex gap-4 w-full">
            <div className="flex gap-2 items-center">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              Train: {(lastAcc * 100).toFixed(1)}%
            </div>
            <div className="flex gap-2 items-center text-green-300 opacity-70">
              <div className="w-3 h-3 rounded-full border-2 border-green-300 border-dashed bg-transparent"></div>
              Validation: {(lastValAcc * 100).toFixed(1)}%
            </div>
          </div>
          <div className="leading-none">Higher is better</div>
        </CardFooter>
      </Card>

      {/* Loss Chart */}
      <Card className="bg-zinc-800 border-zinc-700 text-white">
        <CardHeader>
          <CardTitle>Loss (Train vs Validation)</CardTitle>
          <CardDescription className="text-zinc-400">
            Validation Loss determines Early Stopping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={lossConfig}
            className="aspect-auto h-62.5 w-full"
          >
            <LineChart
              accessibilityLayer
              data={data}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} stroke="#3f3f46" />
              <XAxis
                dataKey="epoch"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa" }}
              />
              <YAxis hide />
              {bestEpoch > 0 && (
                <ReferenceLine
                  x={bestEpoch}
                  stroke="#facc15"
                  strokeDasharray="3 3"
                >
                  <Label
                    value="Best"
                    position="insideTopLeft"
                    fill="#facc15"
                    fontSize={12}
                  />
                </ReferenceLine>
              )}
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent className="bg-zinc-900 border-zinc-700 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-zinc-400" />
                }
              />
              <Line
                dataKey="loss"
                type="monotone"
                stroke="var(--color-loss)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="val_loss"
                type="monotone"
                stroke="var(--color-val_loss)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-zinc-400">
          <div className="flex gap-4 w-full">
            <div className="flex gap-2 items-center">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              Train: {lastLoss.toFixed(4)}
            </div>
            <div className="flex gap-2 items-center text-red-300 opacity-70">
              <div className="w-3 h-3 rounded-full border-2 border-red-300 border-dashed bg-transparent"></div>
              Validation: {lastValLoss.toFixed(4)}
            </div>
          </div>
          <div className="leading-none">Lower is better</div>
        </CardFooter>
      </Card>
    </div>
  );
}
