const { onCall, HttpsError } = require("firebase-functions/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const { requireStaffRole } = require("./lib/auth");
const { computeStockForecast } = require("./lib/forecast");
const { computeSalesAnalytics } = require("./lib/analytics");
const { callGemini, callGroq } = require("./lib/llm");
const { fmtHour, fmtINR } = require("./lib/format");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

const VALID_INTENTS = ["low_stock", "busiest_hour", "what_to_86"];

// Firestore only — no phrasing here. Reuses the same lib/ functions
// getStockForecast and getSalesAnalytics call, so the assistant can never
// report a different number than the tiles on screen.
async function fetchData(intent, restaurantId, params) {
  const days = params.days === undefined ? 7 : Number(params.days);
  if (!Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "days must be a positive number");
  }

  if (intent === "low_stock") {
    const { forecast } = await computeStockForecast(restaurantId, days);
    return { lowStock: forecast.filter((f) => f.lowStock) };
  }

  if (intent === "busiest_hour") {
    const { byHour } = await computeSalesAnalytics(restaurantId, days);
    return { byHour };
  }

  // what_to_86: soonest-stockout ingredient (matches AssistantTab's old
  // "close enough to running out" cutoff of under 3 days) plus every dish
  // that shares it.
  const { forecast } = await computeStockForecast(restaurantId, days);
  const critical = forecast
    .filter((f) => f.predictedStockoutInDays !== null && f.predictedStockoutInDays < 3)
    .sort((a, b) => a.predictedStockoutInDays - b.predictedStockoutInDays);
  const soonest = critical[0] || null;

  let affectedDishes = [];
  if (soonest) {
    const dishesSnap = await getFirestore()
      .collection("restaurants")
      .doc(restaurantId)
      .collection("dishes")
      .get();
    affectedDishes = dishesSnap.docs
      .map((doc) => doc.data())
      .filter((dish) => dish.ingredientIds?.includes(soonest.ingredientId))
      .map((dish) => dish.name);
  }
  return { soonest, affectedDishes };
}

// Tier 3: the string-template logic that used to live inline in
// AssistantTab.jsx's answerFns, moved here so it's the shared fallback
// instead of duplicated between frontend and backend.
function buildTemplate(intent, data) {
  if (intent === "low_stock") {
    if (!data.lowStock.length) return "Nothing low right now — all ingredients are well stocked.";
    return (
      data.lowStock.map((i) => `${i.name} (${i.currentStock} left, threshold ${i.lowStockThreshold})`).join(", ") + "."
    );
  }

  if (intent === "busiest_hour") {
    const max = data.byHour.reduce((a, b) => (b.revenue > a.revenue ? b : a));
    if (max.revenue === 0) return "No sales yet tonight to call a busiest hour.";
    return `${fmtHour(max.hour)} is tracking as tonight's busiest hour, around ${fmtINR(max.revenue)} in sales.`;
  }

  // what_to_86
  if (!data.soonest) return "Nothing is close enough to running out to 86 anything yet.";
  const runsOutIn = data.soonest.predictedStockoutInDays.toFixed(1);
  return data.affectedDishes.length
    ? `${data.soonest.name} runs out soonest (~${runsOutIn}d) — consider 86ing ${data.affectedDishes.join(", ")}.`
    : `${data.soonest.name} runs out soonest (~${runsOutIn}d).`;
}

// Gemini -> Groq -> template. Each hop only runs if the one before it threw
// (missing key, timeout, bad response) — a demo that stalls on a slow API
// is worse than one that answers instantly from a template.
async function phrase(intent, data) {
  try {
    const text = await callGemini(intent, data, GEMINI_API_KEY.value());
    return { text, source: "gemini" };
  } catch {
    try {
      const text = await callGroq(intent, data, GROQ_API_KEY.value());
      return { text, source: "groq" };
    } catch {
      return { text: buildTemplate(intent, data), source: "template" };
    }
  }
}

// Manager-only. Three fixed, grounded questions — not free-form chat (see
// plans/07-ai-assistant.md: "three working functions beats ten
// unpredictable ones").
exports.askAssistant = onCall({ secrets: [GEMINI_API_KEY, GROQ_API_KEY] }, async (request) => {
  const { restaurantId, intent, params } = request.data;
  if (!restaurantId || !VALID_INTENTS.includes(intent)) {
    throw new HttpsError("invalid-argument", `intent must be one of: ${VALID_INTENTS.join(", ")}`);
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const data = await fetchData(intent, restaurantId, params || {});
  const { text, source } = await phrase(intent, data);
  return { text, source, data };
});
