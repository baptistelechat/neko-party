import { cn } from "@/lib/utils";
import { ConfusionMatrixResult } from "@/modules/training/Trainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfusionMatrixProps {
  data: ConfusionMatrixResult;
}

export function ConfusionMatrix({ data }: ConfusionMatrixProps) {
  const { matrix, normalized, labels } = data;

  // Find significant errors (> 5%)
  const significantErrors: {
    from: string;
    to: string;
    percent: number;
    count: number;
  }[] = [];

  normalized.forEach((row, i) => {
    row.forEach((val, j) => {
      if (i !== j && val > 0.05) {
        significantErrors.push({
          from: labels[i],
          to: labels[j],
          percent: val,
          count: matrix[i][j],
        });
      }
    });
  });

  // Sort errors by severity
  significantErrors.sort((a, b) => b.percent - a.percent);

  // Helper for cell color
  const getCellColor = (val: number, isDiagonal: boolean) => {
    if (isDiagonal) {
      // Green scale for diagonal (True Positives)
      // Low accuracy on diagonal is bad, but we want to highlight presence.
      // Opacity based on value.
      return `rgba(74, 222, 128, ${0.2 + val * 0.8})`; // green-400 base
    } else {
      // Red scale for errors
      if (val === 0) return "transparent";
      return `rgba(248, 113, 113, ${Math.min(1, val * 2)})`; // red-400 base, amplified visibility
    }
  };

  return (
    <div className="space-y-6">
      {/* Analysis Section */}
      {significantErrors.length > 0 && (
        <Card className="bg-yellow-950/20 border-yellow-700/50">
          <CardHeader>
            <CardTitle className="text-yellow-500 text-lg flex items-center gap-2">
              ⚠️ Confusions Fréquentes (&gt; 5%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-300">
              {significantErrors.map((err, idx) => (
                <li key={idx} className="flex gap-2 items-center">
                  <span className="font-mono font-bold text-white bg-zinc-800 px-1 rounded">
                    {err.from}
                  </span>
                  <span className="text-zinc-500">→</span>
                  <span className="font-mono font-bold text-white bg-zinc-800 px-1 rounded">
                    {err.to}
                  </span>
                  <span className="text-red-400 font-bold ml-2">
                    {(err.percent * 100).toFixed(1)}%
                  </span>
                  <span className="text-zinc-500 text-xs">
                    ({err.count} erreurs)
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* The Matrix */}
      <Card className="bg-zinc-800 border-zinc-700 overflow-x-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-white">
            Matrice de Confusion (Normalisée)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="min-w-150 text-xs font-mono inline-block p-4">
            {/* Top Label (X-Axis) */}
            <div className="flex justify-center mb-2 font-bold text-zinc-500 uppercase tracking-widest text-[10px]">
              ← Prédiction →
            </div>

            {/* Matrix Container with Labels */}
            <div className="flex">
              {/* Left Label (Y-Axis) */}
              <div className="flex items-center justify-center w-6">
                <div className="font-bold text-zinc-500 uppercase tracking-widest text-[10px] -rotate-90 whitespace-nowrap">
                  ← Vraie Classe →
                </div>
              </div>

              {/* Grid */}
              <div>
                {/* Header Row */}
                <div className="flex">
                  <div className="w-6 shrink-0"></div> {/* Corner Spacer */}
                  {labels.map((label, i) => (
                    <div
                      key={i}
                      className="w-10 flex items-end justify-center pb-2"
                    >
                      <span className="font-bold text-zinc-300">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {normalized.map((row, i) => (
                  <div key={i} className="flex h-10 items-center">
                    {/* Row Label */}
                    <div className="w-6 shrink-0 font-bold text-zinc-300 text-right pr-3 flex items-center justify-end h-full border-r border-zinc-700">
                      {labels[i]}
                    </div>

                    {/* Cells */}
                    {row.map((val, j) => {
                      const isDiagonal = i === j;
                      const count = matrix[i][j];
                      // Determine text color based on background intensity
                      const textColor =
                        val > 0.5
                          ? "text-black font-extrabold"
                          : "text-zinc-300";

                      return (
                        <div
                          key={j}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center text-[10px] relative group cursor-default transition-all border border-zinc-700/50 hover:border-white/50 hover:z-10"
                          )}
                          style={{
                            backgroundColor: getCellColor(val, isDiagonal),
                          }}
                          title={`True: ${labels[i]}, Pred: ${
                            labels[j]
                          }\nCount: ${count}\nRate: ${(val * 100).toFixed(1)}%`}
                        >
                          <span className={cn("z-10 select-none", textColor)}>
                            {val > 0.01
                              ? Math.round(val * 100) + "%"
                              : count > 0
                              ? "."
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <div className="p-6 pt-0 text-sm text-zinc-400 text-center">
          <span className="text-green-400 font-bold">Vert</span> = Correct,{" "}
          <span className="text-red-400 font-bold">Rouge</span> = Confusion.
        </div>
      </Card>
    </div>
  );
}
