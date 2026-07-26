import { useEffect, useState } from "react";
import { getSalesAnalytics, getTableTurnoverStats } from "../../lib/api";
import { fmtHour, fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Panel } from "../../components/ops/primitives";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AnalyticsTab() {
  const { T } = useOpsTheme();
  const [sales, setSales] = useState(null);
  const [turnover, setTurnover] = useState(null);

  useEffect(() => {
    getSalesAnalytics({ days: 7 }).then(setSales);
    getTableTurnoverStats({ days: 7 }).then(setTurnover);
  }, []);

  if (!sales) return <div style={{ color: T.faint }}>Loading analytics…</div>;

  const maxHour = Math.max(1, ...sales.byHour.map((h) => h.revenue));
  const dayData = sales.byDayOfWeek.map((d, i) => ({ label: DAY_LABELS[i], revenue: d.revenue }));
  const maxDay = Math.max(1, ...dayData.map((d) => d.revenue));
  const n = dayData.length;
  const dots = dayData.map((d, i) => ({ x: (i / (n - 1)) * 300, y: 115 - (d.revenue / maxDay) * 105 }));
  const linePoints = dots.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-[1.2fr_1fr] gap-3.5">
        <Panel className="p-4">
          <div className="mb-3 text-[13px] font-bold" style={{ color: T.header }}>
            Revenue by Hour
          </div>
          <div className="flex h-[130px] items-end gap-1.5">
            {sales.byHour.map((h) => (
              <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-sm"
                  style={{ background: T.accent, height: `${Math.round((h.revenue / maxHour) * 100)}%` }}
                />
                <div className="text-[9.5px]" style={{ color: T.fainter }}>
                  {fmtHour(h.hour)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="mb-3 text-[13px] font-bold" style={{ color: T.header }}>
            Revenue by Day
          </div>
          <svg viewBox="0 0 300 120" className="h-[110px] w-full">
            <polyline points={linePoints} fill="none" stroke={T.accent} strokeWidth="2.5" />
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="3" fill={T.accentBright} />
            ))}
          </svg>
          <div className="mt-0.5 flex justify-between">
            {dayData.map((d) => (
              <div key={d.label} className="text-[9.5px]" style={{ color: T.fainter }}>
                {d.label}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3.5">
        <Panel className="p-4">
          <div className="mb-2.5 text-[13px] font-bold" style={{ color: T.header }}>
            Top 5 Best-Sellers
          </div>
          {sales.topSellers.map((b) => (
            <div key={b.dishId} className="flex justify-between border-b py-1.5 text-[13px]" style={{ borderColor: T.panel2 }}>
              <span>{b.name}</span>
              <span className="font-mono" style={{ color: T.dim }}>
                {b.qty} sold
              </span>
            </div>
          ))}
        </Panel>
        <Panel className="p-4">
          <div className="mb-2.5 text-[13px] font-bold" style={{ color: T.header }}>
            Bottom 5 Slow-Movers
          </div>
          {sales.slowMovers.map((s) => (
            <div key={s.dishId} className="flex justify-between border-b py-1.5 text-[13px]" style={{ borderColor: T.panel2 }}>
              <span>{s.name}</span>
              <span className="font-mono" style={{ color: T.dim }}>
                {s.qty} sold
              </span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="mb-2.5 text-[13px] font-bold" style={{ color: T.header }}>
          Sales by Staff
        </div>
        {sales.byStaff.map((ss) => (
          <div key={ss.staffId} className="flex items-center justify-between border-b py-1.5 text-[13.5px]" style={{ borderColor: T.panel2 }}>
            <span>{ss.name}</span>
            <span className="flex gap-4">
              <span style={{ color: T.faint }}>{ss.orderCount} orders</span>
              <span className="inline-block w-20 text-right font-mono font-semibold" style={{ color: T.accentBright }}>
                {fmtINR(ss.revenue)}
              </span>
            </span>
          </div>
        ))}
      </Panel>

      {turnover && (
        <div className="mt-3.5 text-[12.5px]" style={{ color: T.faint }}>
          Average table turnover: {turnover.overall.avgDurationMinutes.toFixed(0)} min over the last {turnover.windowDays} days
          ({turnover.overall.sampleCount} closed orders).
        </div>
      )}
    </div>
  );
}
