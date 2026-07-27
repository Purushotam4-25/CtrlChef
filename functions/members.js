const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

// Both callables below are member-scoped, not staff-scoped: the caller must
// be signed in as the exact member they're asking about. This is the same
// "narrow scoped read via a callable" pattern estimateQueueWait uses for
// guests — orders stay isStaff-only in firestore.rules, so a member's own
// history has to come from a Cloud Function (Admin SDK bypasses rules)
// rather than a rules change.
function requireSelf(request, memberId) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  if (request.auth.uid !== memberId) {
    throw new HttpsError("permission-denied", "Can only read your own order history");
  }
}

async function fetchMemberOrders(restaurantRef, memberId) {
  const snap = await restaurantRef.collection("orders").where("memberId", "==", memberId).get();
  // Sorted here instead of via orderBy in the query, to avoid needing a
  // composite index for a collection that's small per member anyway.
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

exports.getMyOrderHistory = onCall(async (request) => {
  const { restaurantId, memberId } = request.data;
  if (!restaurantId || !memberId) {
    throw new HttpsError("invalid-argument", "restaurantId and memberId are required");
  }
  requireSelf(request, memberId);

  const orders = await fetchMemberOrders(db.collection("restaurants").doc(restaurantId), memberId);
  // Firestore Timestamps aren't plain JSON — hand back millis explicitly
  // instead of relying on however the callable transport happens to encode
  // a Timestamp object.
  return {
    orders: orders.map((o) => ({
      ...o,
      createdAt: o.createdAt?.toMillis() ?? null,
      closedAt: o.closedAt?.toMillis() ?? null,
    })),
  };
});

// Plain frequency count over the member's own order history, filtered to
// dishes that are still `available` right now — same live, ingredient-driven
// availability every other surface reads. This is honest counting, not a
// recommendation model (same "heuristic, not ML" framing getStockForecast
// uses) — label it that way in the UI too.
exports.getMyRecommendations = onCall(async (request) => {
  const { restaurantId, memberId } = request.data;
  if (!restaurantId || !memberId) {
    throw new HttpsError("invalid-argument", "restaurantId and memberId are required");
  }
  requireSelf(request, memberId);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const [orders, dishesSnap] = await Promise.all([
    fetchMemberOrders(restaurantRef, memberId),
    restaurantRef.collection("dishes").get(),
  ]);

  const dishesById = {};
  dishesSnap.forEach((doc) => {
    dishesById[doc.id] = { id: doc.id, ...doc.data() };
  });

  const countByDish = {};
  for (const order of orders) {
    for (const item of order.items) {
      countByDish[item.dishId] = (countByDish[item.dishId] || 0) + item.qty;
    }
  }

  const recommendations = Object.entries(countByDish)
    .map(([dishId, count]) => ({ dishId, count, dish: dishesById[dishId] }))
    .filter((r) => r.dish && r.dish.available)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((r) => ({ dishId: r.dishId, name: r.dish.name, price: r.dish.price, orderCount: r.count }));

  return { recommendations };
});
