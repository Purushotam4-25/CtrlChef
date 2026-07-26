import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { getSalesAnalytics, getStockForecast } from "../../lib/api";
import { fmtHour, fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Panel } from "../../components/ops/primitives";

// No Gemini function exists yet (see functions/) — this is the spec's own
// "last resort" tier of its 3-layer fallback plan: real Firestore data,
// turned into plain English with plain templates, no LLM call at all.
// Swap these for a Cloud Function call once the Gemini/Groq layer lands.
export default function AssistantTab() {
  const { T } = useOpsTheme();
  const [dishes, setDishes] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "dishes"), (snap) =>
      setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    ),
    []
  );

  async function ask(question, answerFn) {
    setBusy(true);
    try {
      const answer = await answerFn();
      setHistory((h) => [...h, { question, answer }]);
    } finally {
      setBusy(false);
    }
  }

  const questions = [
    {
      text: "What's low on stock?",
      onAsk: () =>
        ask("What's low on stock?", async () => {
          const { forecast } = await getStockForecast({ days: 7 });
          const low = forecast.filter((f) => f.lowStock);
          if (!low.length) return "Nothing low right now — all ingredients are well stocked.";
          return low.map((i) => `${i.name} (${i.currentStock} left, threshold ${i.lowStockThreshold})`).join(", ") + ".";
        }),
    },
    {
      text: "What's tonight's busiest hour?",
      onAsk: () =>
        ask("What's tonight's busiest hour?", async () => {
          const sales = await getSalesAnalytics({ days: 1 });
          const max = sales.byHour.reduce((a, b) => (b.revenue > a.revenue ? b : a));
          if (max.revenue === 0) return "No sales yet tonight to call a busiest hour.";
          return `${fmtHour(max.hour)} is tracking as tonight's busiest hour, around ${fmtINR(max.revenue)} in sales.`;
        }),
    },
    {
      text: "What should I 86 if an ingredient runs out?",
      onAsk: () =>
        ask("What should I 86 if an ingredient runs out?", async () => {
          const { forecast } = await getStockForecast({ days: 7 });
          const critical = forecast
            .filter((f) => f.predictedStockoutInDays !== null && f.predictedStockoutInDays < 3)
            .sort((a, b) => a.predictedStockoutInDays - b.predictedStockoutInDays);
          if (!critical.length) return "Nothing is close enough to running out to 86 anything yet.";
          const soonest = critical[0];
          const affected = dishes.filter((d) => d.ingredientIds?.includes(soonest.ingredientId)).map((d) => d.name);
          const runsOutIn = soonest.predictedStockoutInDays.toFixed(1);
          return affected.length
            ? `${soonest.name} runs out soonest (~${runsOutIn}d) — consider 86ing ${affected.join(", ")}.`
            : `${soonest.name} runs out soonest (~${runsOutIn}d).`;
        }),
    },
  ];

  return (
    <Panel className="max-w-[640px] p-4">
      <div className="mb-3.5 flex flex-col gap-2">
        {questions.map((q) => (
          <button
            key={q.text}
            disabled={busy}
            onClick={q.onAsk}
            className="rounded-md border px-3 py-2.5 text-left text-[13.5px] disabled:opacity-60"
            style={{ background: T.panel2, borderColor: T.borderAlt, color: T.text }}
          >
            {q.text}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {history.map((c, i) => (
          <div key={i}>
            <div
              className="ml-[20%] inline-block max-w-[80%] rounded-[8px_8px_2px_8px] px-3 py-2 text-[13.5px] text-white"
              style={{ background: T.accent }}
            >
              {c.question}
            </div>
            <div
              className="mt-1.5 inline-block max-w-[80%] rounded-[8px_8px_8px_2px] px-3 py-2 text-[13.5px]"
              style={{ background: T.panel2, color: T.bright }}
            >
              {c.answer}
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-3.5 rounded-md border px-3 py-2.5 text-[13px]"
        style={{ background: T.inputBg, borderColor: T.panel2, color: T.faintest }}
      >
        Free-form questions — coming once Gemini's wired up
      </div>
    </Panel>
  );
}
