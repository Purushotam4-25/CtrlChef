const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

// Public — guests need this to check in, no staff account involved. Tables
// are staff-only in firestore.rules, so this never hands back raw table
// data, just a yes/no plus a wait estimate computed server-side.
exports.estimateQueueWait = onCall(async (request) => {
  const { restaurantId } = request.data;
  const partySize = Number(request.data.partySize);
  if (!restaurantId || !Number.isInteger(partySize) || partySize <= 0) {
    throw new HttpsError("invalid-argument", "restaurantId and a positive integer partySize are required");
  }

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const tablesSnap = await restaurantRef.collection("tables").get();

  const capacityByTable = {};
  const fittingCapacities = new Set();
  let hasFreeTable = false;
  tablesSnap.forEach((doc) => {
    const t = doc.data();
    capacityByTable[doc.id] = t.capacity;
    if (t.capacity >= partySize) {
      fittingCapacities.add(t.capacity);
      if (t.status === "empty") hasFreeTable = true;
    }
  });

  if (hasFreeTable) {
    return { available: true, estimatedWaitMinutes: 0 };
  }

  // Same idea as getTableTurnoverStats — average how long tables big enough
  // for this party have taken to turn over recently. A heuristic, not a
  // live queue simulation.
  const ordersSnap = await restaurantRef.collection("orders").where("status", "==", "closed").get();
  const durations = [];
  ordersSnap.forEach((doc) => {
    const order = doc.data();
    if (!order.createdAt || !order.closedAt) return;
    const capacity = capacityByTable[order.tableId];
    if (capacity === undefined || !fittingCapacities.has(capacity)) return;
    durations.push((order.closedAt.toMillis() - order.createdAt.toMillis()) / 60000);
  });

  const estimatedWaitMinutes = durations.length
    ? durations.reduce((sum, n) => sum + n, 0) / durations.length
    : 15; // no turnover history yet for this table size — a plain default, not a fabricated precise number

  return { available: false, estimatedWaitMinutes };
});

// Public — reachable by a QR code at the table, no login. `orders` is
// staff-read-only in firestore.rules (payment info, every other table's
// bill), so this is the only way a guest ever sees their order: item names,
// statuses, and the running total, nothing else. Same shape as
// estimateQueueWait above — a narrow read, not a raw document.
exports.getTableOrderStatus = onCall(async (request) => {
  const { restaurantId, tableId } = request.data;
  if (!restaurantId || !tableId) {
    throw new HttpsError("invalid-argument", "restaurantId and tableId are required");
  }

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const tableSnap = await restaurantRef.collection("tables").doc(tableId).get();
  if (!tableSnap.exists) {
    throw new HttpsError("not-found", `Table ${tableId} not found`);
  }

  const orderSnap = await restaurantRef
    .collection("orders")
    .where("tableId", "==", tableId)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (orderSnap.empty) {
    return { tableNumber: tableSnap.data().number, hasOpenOrder: false };
  }

  const order = orderSnap.docs[0].data();
  return {
    tableNumber: tableSnap.data().number,
    hasOpenOrder: true,
    items: order.items.map((i) => ({ dishName: i.dishName, qty: i.qty, itemStatus: i.itemStatus })),
    totalAmount: order.totalAmount,
  };
});
