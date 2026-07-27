// Gemini and Groq clients for the assistant's phrase() tier. Both are one
// REST call each (Node 22 has global fetch) — no SDK dependency needed for
// "send JSON, get a sentence back".
// The spec names "gemini-3-flash", which 404s against the real API (verified
// live) — no model with that exact id exists. "gemini-flash-latest" is
// Google's own alias for the current recommended flash-tier model, which
// keeps the "cheap/fast, not Pro-tier" intent without pinning a dated model
// id that'll eventually get retired.
const GEMINI_MODEL = "gemini-flash-latest";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 5000;

function buildPrompt(intent, data) {
  return [
    "You are a restaurant manager's assistant. Using ONLY the JSON data below, write 2-3 short, plain-English sentences answering the question for intent " +
      `"${intent}".`,
    "Use only the numbers and facts present in the data. Do not invent, estimate, or assume anything not in it.",
    "Data:",
    JSON.stringify(data),
  ].join("\n");
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(intent, data, apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(intent, data) }] }] }),
  });

  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return text.trim();
}

async function callGroq(intent, data, apiKey) {
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildPrompt(intent, data) }],
    }),
  });

  if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return text.trim();
}

module.exports = { callGemini, callGroq };
