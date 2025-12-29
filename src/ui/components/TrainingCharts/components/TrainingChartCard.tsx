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
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const THEME_CLASSES = {
  red: {
    trainDot: "bg-red-400",
    valText: "text-red-300",
    valBorder: "border-red-300",
  },
  green: {
    trainDot: "bg-green-400",
    valText: "text-green-300",
    valBorder: "border-green-300",
  },
};

interface TrainingChartCardProps {
  data: TrainingProgress[];
  config: ChartConfig;
  title: string;
  description: string;
  trainKey: keyof TrainingProgress;
  valKey: keyof TrainingProgress;
  yDomain?: [number, number];
  footerText: string;
  footerValueFormatter?: (value: number) => string;
  colorTheme: "red" | "green";
}

export function TrainingChartCard({
  data,
  config,
  title,
  description,
  trainKey,
  valKey,
  yDomain,
  footerText,
  footerValueFormatter = (v) => v.toFixed(4),
  colorTheme,
}: TrainingChartCardProps) {
  const lastTrain =
    data.length > 0 ? (data[data.length - 1][trainKey] as number) : 0;
  const lastVal =
    data.length > 0 ? (data[data.length - 1][valKey] as number) : 0;

  const theme = THEME_CLASSES[colorTheme];

  return (
    <Card className="bg-zinc-800 border-zinc-700 text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-zinc-400">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-62.5 w-full">
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
            {yDomain ? <YAxis hide domain={yDomain} /> : <YAxis hide />}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent className="bg-zinc-900 border-zinc-700 [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-zinc-400" />
              }
            />
            <Line
              dataKey={trainKey as string}
              type="monotone"
              stroke={`var(--color-${String(trainKey)})`}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey={valKey as string}
              type="monotone"
              stroke={`var(--color-${String(valKey)})`}
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
            <div className={`w-3 h-3 rounded-full ${theme.trainDot}`}></div>
            Train: {footerValueFormatter(lastTrain)}
          </div>
          <div
            className={`flex gap-2 items-center opacity-70 ${theme.valText}`}
          >
            <div
              className={`w-3 h-3 rounded-full border-2 border-dashed bg-transparent ${theme.valBorder}`}
            ></div>
            Validation: {footerValueFormatter(lastVal)}
          </div>
        </div>
        <div className="leading-none">{footerText}</div>
      </CardFooter>
    </Card>
  );
}
