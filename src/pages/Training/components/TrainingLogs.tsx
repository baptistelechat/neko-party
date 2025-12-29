import { useEffect, useRef } from "react";

interface TrainingLogsProps {
  logs: string[];
}

export function TrainingLogs({ logs }: TrainingLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="lg:col-span-2 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex flex-col">
      <div className="flex items-center justify-between bg-zinc-900 px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-bold text-zinc-300">Logs</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {logs.map((log, i) => {
          let colorClass = "text-zinc-300"; // Default
          if (log.includes("Epoch ")) colorClass = "text-zinc-500";
          if (log.includes("loss=")) colorClass = "text-blue-400";
          if (log.includes("⚠️") || log.includes("Balancing"))
            colorClass = "text-yellow-500";
          if (log.includes("🛑")) colorClass = "text-red-500";
          if (
            log.includes("♻️") ||
            log.includes("Training Complete") ||
            log.includes("Manifest")
          )
            colorClass = "text-green-500";
          if (log.includes("MobileNet")) colorClass = "text-indigo-500";

          return (
            <div key={i} className={`${colorClass} mb-1`}>
              {log}
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
