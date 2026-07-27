import { useState } from "react";
import { askAssistant } from "../../lib/api";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Panel, Badge } from "../../components/ops/primitives";

const SOURCE_BADGE = {
  gemini: { kind: "green", label: "Gemini" },
  groq: { kind: "amber", label: "Groq" },
  template: { kind: "gray", label: "Offline" },
};

const QUESTIONS = [
  { text: "What's low on stock?", intent: "low_stock" },
  { text: "What's tonight's busiest hour?", intent: "busiest_hour" },
  { text: "What should I take off the menu if an ingredient runs out?", intent: "what_to_86" },
];

// Gemini -> Groq -> template fallback lives server-side (functions/assistant.js,
// see plans/07-ai-assistant.md) — this tab just calls askAssistant and shows
// which tier actually answered.
export default function AssistantTab() {
  const { T } = useOpsTheme();
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  async function ask(question, intent) {
    setBusy(true);
    try {
      const { text, source } = await askAssistant({ intent, params: { days: intent === "busiest_hour" ? 1 : 7 } });
      setHistory((h) => [...h, { question, answer: text, source }]);
    } catch (err) {
      setHistory((h) => [...h, { question, answer: `Couldn't get an answer: ${err.message || "something went wrong"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="max-w-[640px] p-4">
      <div className="mb-3.5 flex flex-col gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q.text}
            disabled={busy}
            onClick={() => ask(q.text, q.intent)}
            className="rounded-md border px-3 py-2.5 text-left text-[13.5px] transition-colors hover:brightness-125 disabled:opacity-60 disabled:hover:brightness-100"
            style={{ background: T.panel2, borderColor: T.borderAlt, color: T.text }}
          >
            {q.text}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {history.map((c, i) => {
          const badge = SOURCE_BADGE[c.source] || SOURCE_BADGE.template;
          return (
            <div key={i}>
              <div
                className="ml-[20%] inline-block max-w-[80%] rounded-[8px_8px_2px_8px] px-3 py-2 text-[13.5px] text-white"
                style={{ background: T.accent }}
              >
                {c.question}
              </div>
              <div className="mt-1.5 flex items-start gap-2">
                <div
                  className="inline-block max-w-[80%] rounded-[8px_8px_8px_2px] px-3 py-2 text-[13.5px]"
                  style={{ background: T.panel2, color: T.bright }}
                >
                  {c.answer}
                </div>
                <Badge kind={badge.kind}>{badge.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
