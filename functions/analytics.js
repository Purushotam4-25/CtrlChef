const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

function cutoffTimestamp(days) {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Manager-only: sales broken down by dish, hour of day, day of week, and
// staff member, over a rolling window (default 7 days). Walks every item on
// every order in the window — presence in order.items is a real sale here,
// regardless of item/order status.
exports.getSalesAnalytics = onCall(async (request) => {
  const { restaurantId } = request.data;
  const days = request.data.days === undefined ? 7 : Number(request.data.days);
  if (!restaurantId || !Number.isFinite(days) || days <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive days are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  // ponytail: fetches the full dishes/staff collections every call — fine at
  // demo scale (a dozen dishes, a handful of staff). Paginate or precompute
  // a rollup if either collection grows large.
  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const [ordersSnap, dishesSnap, staffSnap] = await Promise.all([
    restaurantRef.collection("orders").where("createdAt", ">=", cutoffTimestamp(days)).get(),
    restaurantRef.collection("dishes").get(),
    restaurantRef.collection("staff").get(),
  ]);

  const staffNameById = {};
  staffSnap.forEach((doc) => {
    staffNameById[doc.id] = doc.data().name;
  });

  // Seed every current dish at zero so slow-movers (nobody ordering it) show up too.
  const byDish = {};
  dishesSnap.forEach((doc) => {
    byDish[doc.id] = { dishId: doc.id, name: doc.data().name, qty: 0, revenue: 0 };
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, qty: 0, revenue: 0 }));
  const byDayOfWeek = Array.from({ length: 7 }, (_, day) => ({ day, qty: 0, revenue: 0 }));
  const byStaff = {}; // uid -> { staffId, name, qty, revenue, orderIds }

  ordersSnap.forEach((doc) => {
    const order = doc.data();
    const staffId = order.createdBy || null;
    if (staffId && !byStaff[staffId]) {
      byStaff[staffId] = {
        staffId,
        name: staffNameById[staffId] || "Unknown", // account may since be gone; order is still history
        qty: 0,
        revenue: 0,
        orderIds: new Set(),
      };
    }

    for (const item of order.items) {
      const lineRevenue = item.price * item.qty;

      // Dish may have since been deleted (managers can) — fall back to the
      // item's own snapshotted name rather than dropping its sales.
      if (!byDish[item.dishId]) {
        byDish[item.dishId] = { dishId: item.dishId, name: item.dishName, qty: 0, revenue: 0 };
      }
      byDish[item.dishId].qty += item.qty;
      byDish[item.dishId].revenue += lineRevenue;

      const addedAt = item.addedAt.toDate();
      byHour[addedAt.getHours()].qty += item.qty;
      byHour[addedAt.getHours()].revenue += lineRevenue;
      byDayOfWeek[addedAt.getDay()].qty += item.qty;
      byDayOfWeek[addedAt.getDay()].revenue += lineRevenue;

      if (staffId) {
        byStaff[staffId].qty += item.qty;
        byStaff[staffId].revenue += lineRevenue;
        byStaff[staffId].orderIds.add(doc.id);
      }
    }
  });

  const byDishList = Object.values(byDish);
  const topSellers = [...byDishList].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const slowMovers = [...byDishList].sort((a, b) => a.qty - b.qty).slice(0, 5);
  const byStaffList = Object.values(byStaff).map(({ orderIds, ...rest }) => ({ ...rest, orderCount: orderIds.size }));

  return { windowDays: days, byDish: byDishList, topSellers, slowMovers, byHour, byDayOfWeek, byStaff: byStaffList };
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
