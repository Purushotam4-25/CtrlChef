const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { requireStaffRole, WAITER_OR_MANAGER } = require("./lib/auth");

const db = getFirestore();

// Table lifecycle: empty -> occupied -> needs_cleaning -> empty.
// Three small functions, one per transition, each guarded so it can only
// fire from the state it's supposed to follow.

// Waiter seats a walk-in party.
exports.seatTable = onCall(async (request) => {
  const { restaurantId, tableId } = request.data;
  if (!restaurantId || !tableId) {
    throw new HttpsError("invalid-argument", "restaurantId and tableId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const tableRef = db.collection("restaurants").doc(restaurantId).collection("tables").doc(tableId);
  return db.runTransaction(async (t) => {
    const tableSnap = await t.get(tableRef);
    if (!tableSnap.exists) {
      throw new HttpsError("not-found", `Table ${tableId} not found`);
    }
    const table = tableSnap.data();
    if (table.status !== "empty") {
      throw new HttpsError("failed-precondition", `Table is "${table.status}" — can only seat an empty table`);
    }

    t.update(tableRef, { status: "occupied", seatedAt: FieldValue.serverTimestamp() });
    return { tableId, status: "occupied" };
  });
});

// Waiter closes out the tab: order is done, table needs cleaning before the
// next party can be seated. Every item must already be "served" — closing
// early would silently orphan whatever's still on the kitchen ticket (its
// reserved stock included), so this refuses instead. Use cancelOrderItem
// first for anything that hasn't started cooking, or wait for the rest.
// Also returns the final bill breakdown — billing is display-only per the
// spec, so this is just totalAmount plus the restaurant's configured
// service charge / GST percentages, nothing new to compute elsewhere.
exports.closeOrder = onCall(async (request) => {
  const { restaurantId, orderId } = request.data;
  if (!restaurantId || !orderId) {
    throw new HttpsError("invalid-argument", "restaurantId and orderId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const orderRef = restaurantRef.collection("orders").doc(orderId);

  return db.runTransaction(async (t) => {
    const orderSnap = await t.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", `Order ${orderId} not found`);
    }
    const order = orderSnap.data();
    if (order.status !== "open") {
      throw new HttpsError("failed-precondition", `Order is already "${order.status}"`);
    }

    const outstanding = order.items.filter((i) => i.itemStatus !== "served");
    if (outstanding.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        `Can't close — still outstanding: ${outstanding.map((i) => i.dishName).join(", ")}`
      );
    }

    const tableRef = restaurantRef.collection("tables").doc(order.tableId);
    const [tableSnap, restaurantSnap] = await Promise.all([t.get(tableRef), t.get(restaurantRef)]);
    if (!tableSnap.exists) {
      throw new HttpsError("not-found", `Table ${order.tableId} not found`);
    }

    t.update(orderRef, { status: "closed", closedAt: FieldValue.serverTimestamp() });
    t.update(tableRef, { status: "needs_cleaning" });

    const restaurant = restaurantSnap.data();
    const subtotal = order.totalAmount;
    const serviceCharge = (subtotal * (restaurant.serviceChargePct || 0)) / 100;
    const gst = (subtotal * (restaurant.gstPct || 0)) / 100;

    return {
      orderId,
      tableStatus: "needs_cleaning",
      bill: { subtotal, serviceCharge, gst, total: subtotal + serviceCharge + gst },
    };
  });
});

// Staff marks a table cleaned and ready for the next party.
exports.markTableClean = onCall(async (request) => {
  const { restaurantId, tableId } = request.data;
  if (!restaurantId || !tableId) {
    throw new HttpsError("invalid-argument", "restaurantId and tableId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const tableRef = db.collection("restaurants").doc(restaurantId).collection("tables").doc(tableId);
  return db.runTransaction(async (t) => {
    const tableSnap = await t.get(tableRef);
    if (!tableSnap.exists) {
      throw new HttpsError("not-found", `Table ${tableId} not found`);
    }
    const table = tableSnap.data();
    if (table.status !== "needs_cleaning") {
      throw new HttpsError("failed-precondition", `Table is "${table.status}" — nothing to clean`);
    }

    t.update(tableRef, { status: "empty", seatedAt: FieldValue.delete() });
    return { tableId, status: "empty" };
  });
});

// Manager-only escape hatch for a table stuck in any state — the lifecycle
// above is deliberately function-gated (firestore.rules blocks a direct
// client write to `status`) so a genuine force-reset needs its own explicit,
// manager-only path rather than loosening that rule.
exports.forceResetTable = onCall(async (request) => {
  const { restaurantId, tableId } = request.data;
  if (!restaurantId || !tableId) {
    throw new HttpsError("invalid-argument", "restaurantId and tableId are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const tableRef = db.collection("restaurants").doc(restaurantId).collection("tables").doc(tableId);
  const snap = await tableRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Table ${tableId} not found`);
  }

  await tableRef.update({ status: "empty", seatedAt: FieldValue.delete() });
  return { tableId, status: "empty" };
});
