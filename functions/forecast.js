const { onCall, HttpsError } = require("firebase-functions/https");
const { requireStaffRole } = require("./lib/auth");
const { computeStockForecast } = require("./lib/forecast");

// Manager-facing heuristic: how fast is each ingredient being used lately,
// and when it'll run out at that rate. A rolling average over a lookback
// window, not a real forecasting model — same "honest heuristic, not ML"
// framing the spec uses for this feature. Query logic lives in
// lib/forecast.js so assistant.js can reuse it instead of re-deriving it.
exports.getStockForecast = onCall(async (request) => {
  const { restaurantId } = request.data;
  const days = request.data.days === undefined ? 7 : Number(request.data.days);

  if (!restaurantId || !Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive days are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  return computeStockForecast(restaurantId, days);
});
