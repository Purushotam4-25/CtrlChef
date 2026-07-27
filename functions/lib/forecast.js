const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// Module-scope, instance-scoped cache — same reasoning and TTL as
// lib/analytics.js's; see plans/11.
const FORECAST_CACHE_TTL_MS = 30000;
const forecastCache = new Map(); // `${restaurantId}:${days}` -> { result, expiresAt }

// Query body behind getStockForecast (see functions/forecast.js), pulled out
// so the assistant callable can reuse the exact same numbers instead of
// re-deriving them — see the deleted-dish consumption bug this repo already
// hit once from duplicated aggregation logic.
async function computeStockForecast(restaurantId, days) {
  const cacheKey = `${restaurantId}:${days}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const db = getFirestore();
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
  //
  // Prefer the item's own ingredientsUsed snapshot over the dish's current
  // ingredients — the dish may have been edited or deleted since, but the
  // snapshot is what actually consumed the stock. Older items from before
  // this snapshot existed fall back to the current dish lookup.
  const consumedByIngredient = {};
  ordersSnap.forEach((doc) => {
    for (const item of doc.data().items) {
      const ingredients = item.ingredientsUsed || dishesById[item.dishId]?.ingredients;
      if (!ingredients) continue;
      for (const req of ingredients) {
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

  const result = { windowDays: days, forecast };
  forecastCache.set(cacheKey, { result, expiresAt: Date.now() + FORECAST_CACHE_TTL_MS });
  return result;
}

module.exports = { computeStockForecast };
