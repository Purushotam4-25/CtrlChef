const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { VALID_PAYMENT_METHODS } = require("./billing");

function cutoffTimestamp(days) {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Query body behind getSalesAnalytics (see functions/analytics.js), pulled
// out so the assistant callable can reuse the same numbers instead of
// re-deriving them.
async function computeSalesAnalytics(restaurantId, days) {
  const db = getFirestore();

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
  const byPaymentMethod = Object.fromEntries(
    VALID_PAYMENT_METHODS.map((method) => [method, { method, orderCount: 0, revenue: 0 }])
  );

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

    // Only closed orders carry a paymentMethod (set by closeOrder) — open
    // orders and anything closed before this field existed are silently
    // excluded rather than guessed at.
    if (order.status === "closed" && order.paymentMethod && byPaymentMethod[order.paymentMethod]) {
      byPaymentMethod[order.paymentMethod].orderCount += 1;
      byPaymentMethod[order.paymentMethod].revenue += order.bill ? order.bill.total : order.totalAmount;
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

  return {
    windowDays: days,
    byDish: byDishList,
    topSellers,
    slowMovers,
    byHour,
    byDayOfWeek,
    byStaff: byStaffList,
    byPaymentMethod: Object.values(byPaymentMethod),
  };
}

module.exports = { computeSalesAnalytics, cutoffTimestamp };
