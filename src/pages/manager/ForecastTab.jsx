import { useEffect, useState } from "react";
import { getStockForecast } from "../../lib/api";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Panel } from "../../components/ops/primitives";

export default function ForecastTab() {
  const { T } = useOpsTheme();
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStockForecast({ days: 7 })
      .then((res) => setForecast(res.forecast))
      .catch((err) => setError(err.message || "Couldn't load the forecast."));
  }, []);

  if (error) return <div style={{ color: "#f87171" }}>{error}</div>;
  if (!forecast) return <div style={{ color: T.faint }}>Loading forecast…</div>;

  const atRisk = forecast.filter((f) => f.predictedStockoutInDays !== null).sort((a, b) => a.predictedStockoutInDays - b.predictedStockoutInDays);

  return (
    <div>
      <div className="mb-3 text-[12.5px]" style={{ color: T.faint }}>
        Predicted days to stockout at current usage rate — a rolling-average heuristic, not a live count or ML model.
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {atRisk.map((f) => {
          const critical = f.predictedStockoutInDays < 1;
          return (
            <Panel key={f.ingredientId} className="relative border-dashed p-3.5" style={{ borderColor: T.borderDashed }}>
              <div className="absolute right-3 top-2.5 text-[9.5px] font-bold tracking-wide" style={{ color: T.accentBright }}>
                PREDICTED
              </div>
              <div className="mb-1.5 text-[14.5px] font-bold">{f.name}</div>
              <div className="font-mono text-2xl font-bold" style={{ color: critical ? "#f87171" : "#fbbf24" }}>
                {f.predictedStockoutInDays.toFixed(1)}d
              </div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: T.faint }}>
                until stockout
              </div>
            </Panel>
          );
        })}
        {atRisk.length === 0 && <div style={{ color: T.faint }}>Nothing trending toward a stockout right now.</div>}
      </div>
    </div>
  );
}
