const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

// received -> preparing -> ready -> served. Order items only ever move
// forward one step at a time through this list.
const ITEM_STATUSES = ["received", "preparing", "ready", "served"];

// Who's allowed to move an item TO each status. Chef cooks it
// (received -> preparing -> ready), waiter delivers it (ready -> served) —
// matches the spec's kitchen workflow description exactly. "received" isn't
// listed because nothing ever advances INTO it — addOrderItem creates it.
const ADVANCE_ROLES = {
  preparing: ["chef", "manager"],
  ready: ["chef", "manager"],
  served: ["waiter", "manager"],
};

// Called by the chef's screen to move one order item forward one stage:
// received -> preparing -> ready -> served. Rejects skipping stages and
// rejects moving backwards.
exports.advanceOrderItemStatus = onCall(async (request) => {
  const { restaurantId, orderId, itemId, newStatus } = request.data;

  // Object.hasOwn (not `!ADVANCE_ROLES[newStatus]`) — a plain `[newStatus]`
  // lookup lets newStatus: "__proto__" resolve to a real inherited object
  // instead of undefined, sailing past validation.
  if (!restaurantId || !orderId || !itemId || !Object.hasOwn(ADVANCE_ROLES, newStatus)) {
    throw new HttpsError(
      "invalid-argument",
      `restaurantId, orderId, itemId and a newStatus in [${Object.keys(ADVANCE_ROLES).join(", ")}] are required`
    );
  }

  await requireStaffRole(request, restaurantId, ADVANCE_ROLES[newStatus]);

  const orderRef = db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId);

  return db.runTransaction(async (t) => {
    const orderSnap = await t.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", `Order ${orderId} not found`);
    }
    const order = orderSnap.data();

    const itemIndex = order.items.findIndex((i) => i.itemId === itemId);
    if (itemIndex === -1) {
      throw new HttpsError("not-found", `Item ${itemId} not found on order ${orderId}`);
    }

    const currentStatus = order.items[itemIndex].itemStatus;
    if (ITEM_STATUSES.indexOf(newStatus) !== ITEM_STATUSES.indexOf(currentStatus) + 1) {
      throw new HttpsError(
        "failed-precondition",
        `Can't move from "${currentStatus}" to "${newStatus}" — status can only advance one step at a time`
      );
    }

    const items = [...order.items];
    // Lets the chef board measure elapsed time in the *current* stage
    // instead of total ticket age since addedAt — see Tickets.jsx.
    items[itemIndex] = { ...items[itemIndex], itemStatus: newStatus, statusChangedAt: Timestamp.now() };
    t.update(orderRef, { items });

    return { itemId, itemStatus: newStatus };
  });
});
