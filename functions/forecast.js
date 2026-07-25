const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

// Manager-facing heuristic: how fast is each ingredient being used lately,
// and when it'll run out at that rate. A rolling average over a lookback
// window, not a real forecasting model — same "honest heuristic, not ML"
// framing the spec uses for this feature.
exports.getStockForecast = onCall(async (request) => {
  const { restaurantId } = request.data;
  const days = request.data.days === undefined ? 7 : Number(request.data.days);

  if (!restaurantId || !Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive days are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const cutoff = Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dishesSnap, ordersSnap, ingredientsSnap] = await Promise.all([
    restaurantRef.collection("dishes").get(),
    restaurantRef.collection("orders").where("createdAt", ">=", cutoff).get(),
    restaurantRef.collection("ingredients").get(),
  ]);

  const dishesById = {};
  dishesSnap.forEach((doc) => {
    dishesById[doc.id] = doc.data();
  });

  // Every item ever added to an order already decremented stock at that
  // moment (see orders.js) regardless of what happens to it afterward, so
  // summing items here — not filtering by item/order status — is what
  // actually matches how currentStock got to where it is.
  const consumedByIngredient = {};
  ordersSnap.forEach((doc) => {
    for (const item of doc.data().items) {
      const dish = dishesById[item.dishId];
      if (!dish) continue;
      for (const req of dish.ingredients) {
        consumedByIngredient[req.ingredientId] =
          (consumedByIngredient[req.ingredientId] || 0) + req.qtyRequired * item.qty;
      }
    }
  });

  const forecast = [];
  ingredientsSnap.forEach((doc) => {
    const ingredient = doc.data();
    const avgDailyConsumption = (consumedByIngredient[doc.id] || 0) / days;
    const predictedStockoutInDays = avgDailyConsumption > 0 ? ingredient.currentStock / avgDailyConsumption : null;
    forecast.push({
      ingredientId: doc.id,
      name: ingredient.name,
      currentStock: ingredient.currentStock,
      lowStockThreshold: ingredient.lowStockThreshold,
      lowStock: !!ingredient.lowStock,
      avgDailyConsumption,
      predictedStockoutInDays,
    });
  });

  // Soonest stockout first; no-recent-consumption (null) entries last.
  forecast.sort((a, b) => {
    if (a.predictedStockoutInDays === null) return b.predictedStockoutInDays === null ? 0 : 1;
    if (b.predictedStockoutInDays === null) return -1;
    return a.predictedStockoutInDays - b.predictedStockoutInDays;
  });

  return { windowDays: days, forecast };
});
