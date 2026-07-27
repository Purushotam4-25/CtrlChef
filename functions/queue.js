const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireStaffRole, WAITER_OR_MANAGER } = require("./lib/auth");

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
  let fittingTableCount = 0;
  tablesSnap.forEach((doc) => {
    const t = doc.data();
    capacityByTable[doc.id] = t.capacity;
    if (t.capacity >= partySize) {
      fittingCapacities.add(t.capacity);
      fittingTableCount++;
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

  const avgTurnoverMinutes = durations.length
    ? durations.reduce((sum, n) => sum + n, 0) / durations.length
    : 15; // no turnover history yet for this table size — a plain default, not a fabricated precise number

  // Parties already waiting that would also compete for the same
  // fitting-size tables — without this the 10th party in line got the same
  // number as the 1st. Single equality filter (status == "waiting"), no
  // composite index needed since there's no orderBy alongside it.
  const maxFittingCapacity = fittingCapacities.size ? Math.max(...fittingCapacities) : 0;
  const queueSnap = await restaurantRef.collection("queue").where("status", "==", "waiting").get();
  let partiesAhead = 0;
  queueSnap.forEach((doc) => {
    if (doc.data().partySize <= maxFittingCapacity) partiesAhead++;
  });

  // ceil(partiesAhead / fittingTableCount) cycles of the average turnover —
  // floored at 1 cycle, since we already know (hasFreeTable was false) that
  // every fitting table is currently occupied, so even 0 parties ahead still
  // means waiting for the next vacancy. Still a heuristic, not a simulation.
  const estimatedWaitMinutes = fittingTableCount
    ? avgTurnoverMinutes * Math.max(1, Math.ceil(partiesAhead / fittingTableCount))
    : avgTurnoverMinutes; // no table anywhere fits this party size — nothing to divide by

  return { available: false, estimatedWaitMinutes };
});

// Waiter seats a party straight from the queue — one transaction so the
// table and the queue entry can never disagree. The old flow was two
// separate calls (seatTable, then a queue update); a failure between them
// left the table "occupied" with the queue entry stuck "waiting" forever,
// and nothing detected the mismatch.
exports.seatFromQueue = onCall(async (request) => {
  const { restaurantId, entryId, tableId } = request.data;
  if (!restaurantId || !entryId || !tableId) {
    throw new HttpsError("invalid-argument", "restaurantId, entryId and tableId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const entryRef = restaurantRef.collection("queue").doc(entryId);
  const tableRef = restaurantRef.collection("tables").doc(tableId);

  return db.runTransaction(async (t) => {
    const [entrySnap, tableSnap] = await Promise.all([t.get(entryRef), t.get(tableRef)]);
    if (!entrySnap.exists) {
      throw new HttpsError("not-found", `Queue entry ${entryId} not found`);
    }
    if (!tableSnap.exists) {
      throw new HttpsError("not-found", `Table ${tableId} not found`);
    }
    const entry = entrySnap.data();
    const table = tableSnap.data();

    if (entry.status !== "waiting") {
      throw new HttpsError("failed-precondition", `Queue entry is already "${entry.status}"`);
    }
    if (table.status !== "empty") {
      throw new HttpsError("failed-precondition", `Table is "${table.status}" — can only seat an empty table`);
    }
    if (table.capacity < entry.partySize) {
      throw new HttpsError("failed-precondition", `Table seats ${table.capacity}, party is ${entry.partySize}`);
    }

    const seatedAt = FieldValue.serverTimestamp();
    t.update(tableRef, { status: "occupied", seatedAt, partySize: entry.partySize });
    t.update(entryRef, { status: "seated", seatedAt, tableId });

    return { tableId, entryId, status: "occupied" };
  });
});

// Waiter marks a queue entry as a no-show / walked. Was a direct client
// updateDoc before — moved to a callable so a cancel on an already-seated
// entry (a stale click, a race with another waiter) gets rejected instead
// of silently overwriting its "seated" status.
exports.cancelQueueEntry = onCall(async (request) => {
  const { restaurantId, entryId } = request.data;
  if (!restaurantId || !entryId) {
    throw new HttpsError("invalid-argument", "restaurantId and entryId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const entryRef = db.collection("restaurants").doc(restaurantId).collection("queue").doc(entryId);
  const entrySnap = await entryRef.get();
  if (!entrySnap.exists) {
    throw new HttpsError("not-found", `Queue entry ${entryId} not found`);
  }
  if (entrySnap.data().status !== "waiting") {
    throw new HttpsError("failed-precondition", `Queue entry is already "${entrySnap.data().status}"`);
  }

  await entryRef.update({ status: "cancelled" });
  return { entryId, status: "cancelled" };
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
