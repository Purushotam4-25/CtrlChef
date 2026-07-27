const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore } = require("firebase-admin/firestore");
const { requireStaffRole } = require("./lib/auth");
const { computeSalesAnalytics, cutoffTimestamp } = require("./lib/analytics");

const db = getFirestore();

// Manager-only: sales broken down by dish, hour of day, day of week, and
// staff member, over a rolling window (default 7 days). Query logic lives in
// lib/analytics.js so assistant.js can reuse it instead of re-deriving it.
exports.getSalesAnalytics = onCall(async (request) => {
  const { restaurantId } = request.data;
  const days = request.data.days === undefined ? 7 : Number(request.data.days);
  if (!restaurantId || !Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive days are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  return computeSalesAnalytics(restaurantId, days);
});

// Manager-only: average time a table stays open (createdAt -> closedAt),
// grouped by table capacity — party size itself isn't tracked anywhere in
// the schema, so capacity is the closest available stand-in grouping. This
// is a deliberate scope simplification, not a gap: adding real party-size
// tracking is a separate, bigger schema change.
exports.getTableTurnoverStats = onCall(async (request) => {
  const { restaurantId } = request.data;
  const days = request.data.days === undefined ? 7 : Number(request.data.days);
  if (!restaurantId || !Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive days are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const cutoffMillis = cutoffTimestamp(days).toMillis();

  // Single equality filter only (status == "closed"), cutoff applied in
  // memory below — avoids needing a composite index for status+createdAt.
  // ponytail: scans every closed order ever, not just the window — fine at
  // demo scale, add a composite index on (status, createdAt) or a periodic
  // rollup if order volume grows.
  const [ordersSnap, tablesSnap] = await Promise.all([
    restaurantRef.collection("orders").where("status", "==", "closed").get(),
    restaurantRef.collection("tables").get(),
  ]);

  const capacityByTable = {};
  tablesSnap.forEach((doc) => {
    capacityByTable[doc.id] = doc.data().capacity;
  });

  const durationsByCapacity = {}; // capacity -> minutes[]
  const allDurations = [];

  ordersSnap.forEach((doc) => {
    const order = doc.data();
    // closedAt didn't exist on orders closed before this field was added —
    // skip those rather than crash on missing data.
    if (!order.createdAt || !order.closedAt) return;
    if (order.createdAt.toMillis() < cutoffMillis) return;

    const minutes = (order.closedAt.toMillis() - order.createdAt.toMillis()) / 60000;
    allDurations.push(minutes);

    const capacity = capacityByTable[order.tableId];
    if (capacity === undefined) return; // table since deleted
    (durationsByCapacity[capacity] ||= []).push(minutes);
  });

  const average = (arr) => arr.reduce((sum, n) => sum + n, 0) / arr.length;

  const byCapacity = Object.keys(durationsByCapacity)
    .map(Number)
    .sort((a, b) => a - b)
    .map((capacity) => ({
      capacity,
      avgDurationMinutes: average(durationsByCapacity[capacity]),
      sampleCount: durationsByCapacity[capacity].length,
    }));

  return {
    windowDays: days,
    byCapacity,
    overall: {
      avgDurationMinutes: allDurations.length ? average(allDurations) : 0,
      sampleCount: allDurations.length,
    },
  };
});
