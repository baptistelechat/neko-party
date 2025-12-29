import { DatasetStat } from "@/hooks/useTraining";

interface DatasetStatsProps {
  stats: DatasetStat[];
}

export function DatasetStats({ stats }: DatasetStatsProps) {
  return (
    <div className="bg-zinc-950 p-0 rounded-lg overflow-hidden border border-zinc-800 shadow-inner flex flex-col">
      <div className="bg-zinc-900 p-2 text-xs font-bold text-zinc-300 border-b border-zinc-800">
        Dataset Distribution (Stratified)
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {stats.length === 0 ? (
          <div className="text-zinc-500 text-center italic mt-10">
            Aucune données disponible
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="py-1 px-2">Class</th>
                <th className="py-1 px-2 text-right">Total</th>
                <th className="py-1 px-2 text-right">Train</th>
                <th className="py-1 px-2 text-right">Validation</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="py-1 px-2 font-bold text-zinc-300">
                    {stat.Class}
                  </td>
                  <td className="py-1 px-2 text-right text-zinc-400">
                    {stat.Total}
                  </td>
                  <td className="py-1 px-2 text-right text-zinc-400">
                    {stat.Train}
                  </td>
                  <td className="py-1 px-2 text-right text-zinc-400">
                    {stat.Val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
