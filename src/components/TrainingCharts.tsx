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
import { TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface TrainingChartsProps {
  data: TrainingProgress[];
}

const accuracyConfig = {
  acc: {
    label: "Accuracy",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const lossConfig = {
  loss: {
    label: "Loss",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function TrainingCharts({ data }: TrainingChartsProps) {
  const lastAcc = data.length > 0 ? data[data.length - 1].acc : 0;
  const lastLoss = data.length > 0 ? data[data.length - 1].loss : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Accuracy Chart */}
      <Card className="bg-zinc-800 border-zinc-700 text-white">
        <CardHeader>
          <CardTitle>Accuracy</CardTitle>
          <CardDescription className="text-zinc-400">
            Training Accuracy over Epochs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={accuracyConfig}
            className="aspect-auto h-[250px] w-full"
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
              <ChartTooltip
                cursor={false}
                formatter={(value) => (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[--color-bg]"
                      style={
                        {
                          "--color-bg": "var(--color-acc)",
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-mono font-medium tabular-nums text-foreground ml-auto">
                      {Number(value).toFixed(4)}
                    </span>
                  </>
                )}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="bg-zinc-900 border-zinc-700 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-zinc-400"
                  />
                }
              />
              <Line
                dataKey="acc"
                type="monotone"
                stroke="var(--color-acc)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-zinc-400">
          <div className="flex gap-2 leading-none font-medium text-white">
            Current Accuracy: {(lastAcc * 100).toFixed(1)}%{" "}
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="leading-none">Higher is better</div>
        </CardFooter>
      </Card>

      {/* Loss Chart */}
      <Card className="bg-zinc-800 border-zinc-700 text-white">
        <CardHeader>
          <CardTitle>Loss</CardTitle>
          <CardDescription className="text-zinc-400">
            Training Loss over Epochs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={lossConfig}
            className="aspect-auto h-[250px] w-full"
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
              <ChartTooltip
                cursor={false}
                formatter={(value) => (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[--color-bg]"
                      style={
                        {
                          "--color-bg": "var(--color-loss)",
                        } as React.CSSProperties
                      }
                    />
                    <span className="text-muted-foreground">Loss</span>
                    <span className="font-mono font-medium tabular-nums text-foreground ml-auto">
                      {Number(value).toFixed(4)}
                    </span>
                  </>
                )}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="bg-zinc-900 border-zinc-700 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-zinc-400"
                  />
                }
              />
              <Line
                dataKey="loss"
                type="monotone"
                stroke="var(--color-loss)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm text-zinc-400">
          <div className="flex gap-2 leading-none font-medium text-white">
            Current Loss: {lastLoss.toFixed(4)}{" "}
            <TrendingDown className="h-4 w-4" />
          </div>
          <div className="leading-none">Lower is better</div>
        </CardFooter>
      </Card>
    </div>
  );
}
