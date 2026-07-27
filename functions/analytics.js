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
// grouped by party size. seatFromQueue (queue.js) writes the real partySize
// onto the table at seating time — this reads the table's CURRENT partySize
// as a stand-in for whatever party was seated at each historical closed
// order, same approximation this function already made for capacity before.
// A table seated by the plain walk-in seatTable (no queue involved) has no
// partySize recorded, so its orders are skipped here, same as a
// since-deleted table already was.
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

  const partySizeByTable = {};
  tablesSnap.forEach((doc) => {
    partySizeByTable[doc.id] = doc.data().partySize;
  });

  const durationsByPartySize = {}; // partySize -> minutes[]
  const allDurations = [];

  ordersSnap.forEach((doc) => {
    const order = doc.data();
    // closedAt didn't exist on orders closed before this field was added —
    // skip those rather than crash on missing data.
    if (!order.createdAt || !order.closedAt) return;
    if (order.createdAt.toMillis() < cutoffMillis) return;

    const minutes = (order.closedAt.toMillis() - order.createdAt.toMillis()) / 60000;
    allDurations.push(minutes);

    const partySize = partySizeByTable[order.tableId];
    if (partySize === undefined) return; // table since deleted, or never seated via the queue
    (durationsByPartySize[partySize] ||= []).push(minutes);
  });

  const average = (arr) => arr.reduce((sum, n) => sum + n, 0) / arr.length;

  const byPartySize = Object.keys(durationsByPartySize)
    .map(Number)
    .sort((a, b) => a - b)
    .map((partySize) => ({
      partySize,
      avgDurationMinutes: average(durationsByPartySize[partySize]),
      sampleCount: durationsByPartySize[partySize].length,
    }));

  return {
    windowDays: days,
    byPartySize,
    overall: {
      avgDurationMinutes: allDurations.length ? average(allDurations) : 0,
      sampleCount: allDurations.length,
    },
  };
});
