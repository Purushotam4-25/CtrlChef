const { randomUUID } = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { computeAvailable, computeLowStock } = require("./lib/availability");
const { requireStaffRole, WAITER_OR_MANAGER } = require("./lib/auth");

const db = getFirestore();

// Called by the waiter app when a dish is added to a table's order.
// Everything below runs as one Firestore transaction: check stock is
// actually enough → decrement it → recompute `available` on every dish
// that shares an ingredient → append the line to the table's open order
// (or start one). Doing this as a single transaction is what stops two
// waiters from both ordering "the last paneer dish" at the same instant —
// a transaction only commits if none of the documents it read changed
// while it was running, so the second one automatically retries and sees
// the updated stock.
exports.addOrderItem = onCall(async (request) => {
  const { restaurantId, tableId, dishId } = request.data;
  const qty = Number(request.data.qty);

  if (!restaurantId || !tableId || !dishId || !Number.isInteger(qty) || qty <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "restaurantId, tableId, dishId and a positive integer qty are required"
    );
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const dishRef = restaurantRef.collection("dishes").doc(dishId);
  const ingredientsRef = restaurantRef.collection("ingredients");

  return db.runTransaction(async (t) => {
    // --- reads (all transaction reads must happen before any writes) ---
    const dishSnap = await t.get(dishRef);
    if (!dishSnap.exists) {
      throw new HttpsError("not-found", `Dish ${dishId} not found`);
    }
    const dish = dishSnap.data();

    // ponytail: reads the whole ingredients collection every call — fine at
    // demo scale (a few dozen ingredients). If that grows large, switch to
    // fetching only the ingredients referenced by affected dishes.
    const ingredientsSnap = await t.get(ingredientsRef);
    const ingredientsById = {};
    ingredientsSnap.forEach((doc) => {
      ingredientsById[doc.id] = { id: doc.id, ...doc.data() };
    });

    const touchedIds = dish.ingredients.map((req) => req.ingredientId);
    const affectedSnap = await t.get(
      restaurantRef.collection("dishes").where("ingredientIds", "array-contains-any", touchedIds.slice(0, 10))
    );

    const openOrderSnap = await t.get(
      restaurantRef.collection("orders").where("tableId", "==", tableId).where("status", "==", "open").limit(1)
    );

    // --- validate stock is actually enough ---
    for (const req of dish.ingredients) {
      const ingredient = ingredientsById[req.ingredientId];
      const need = req.qtyRequired * qty;
      if (!ingredient || ingredient.currentStock < need) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough ${ingredient ? ingredient.name : req.ingredientId} left for ${dish.name}`
        );
      }
    }

    // --- writes: decrement stock ---
    for (const req of dish.ingredients) {
      const ingredient = ingredientsById[req.ingredientId];
      const newStock = ingredient.currentStock - (req.qtyRequired * qty);
      t.update(ingredientsRef.doc(req.ingredientId), {
        currentStock: newStock,
        lowStock: computeLowStock({ currentStock: newStock, lowStockThreshold: ingredient.lowStockThreshold }),
      });
      ingredient.currentStock = newStock; // keep local copy in sync for the recompute below
    }

    // --- writes: recompute availability on every affected dish ---
    affectedSnap.forEach((doc) => {
      const affected = doc.data();
      t.update(doc.ref, { available: computeAvailable(affected.ingredients, ingredientsById) });
    });

    // --- writes: append the line item to the table's open order ---
    const item = {
      itemId: randomUUID(), // items live inside an array field, not their own docs, so this is what lets later calls target one specific item
      dishId,
      dishName: dish.name,
      qty,
      price: dish.price,
      ingredientsUsed: dish.ingredients, // snapshot — the dish's recipe can be edited/deleted later, forecasting still needs what it actually took
      itemStatus: "received",
      addedAt: Timestamp.now(), // not FieldValue.serverTimestamp() — that sentinel isn't allowed inside array elements
    };

    if (!openOrderSnap.empty) {
      const orderDoc = openOrderSnap.docs[0];
      const order = orderDoc.data();
      t.update(orderDoc.ref, {
        items: [...order.items, item],
        totalAmount: order.totalAmount + item.price * qty,
      });
      return { orderId: orderDoc.id };
    }

    const newOrderRef = restaurantRef.collection("orders").doc();
    t.set(newOrderRef, {
      tableId,
      createdBy: request.auth.uid, // verified identity from requireStaffRole, not client input
      createdAt: FieldValue.serverTimestamp(),
      status: "open",
      items: [item],
      totalAmount: item.price * qty,
    });
    return { orderId: newOrderRef.id };
  });
});

// Called by the waiter app to cancel a line item. Per the spec, a line can
// only be cancelled while the kitchen hasn't started on it yet — once it's
// "preparing" it's locked. Cancelling gives back the ingredient stock that
// addOrderItem decremented and recomputes availability, same as ordering
// but in reverse.
exports.cancelOrderItem = onCall(async (request) => {
  const { restaurantId, orderId, itemId } = request.data;

  if (!restaurantId || !orderId || !itemId) {
    throw new HttpsError("invalid-argument", "restaurantId, orderId and itemId are required");
  }

  await requireStaffRole(request, restaurantId, WAITER_OR_MANAGER);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const orderRef = restaurantRef.collection("orders").doc(orderId);
  const ingredientsRef = restaurantRef.collection("ingredients");

  return db.runTransaction(async (t) => {
    // --- reads ---
    const orderSnap = await t.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", `Order ${orderId} not found`);
    }
    const order = orderSnap.data();

    const item = order.items.find((i) => i.itemId === itemId);
    if (!item) {
      throw new HttpsError("not-found", `Item ${itemId} not found on order ${orderId}`);
    }
    if (item.itemStatus !== "received") {
      throw new HttpsError(
        "failed-precondition",
        `Can't cancel — the kitchen has already started on this item ("${item.itemStatus}")`
      );
    }

    const dishSnap = await t.get(restaurantRef.collection("dishes").doc(item.dishId));
    const dish = dishSnap.data();

    const ingredientsSnap = await t.get(ingredientsRef);
    const ingredientsById = {};
    ingredientsSnap.forEach((doc) => {
      ingredientsById[doc.id] = { id: doc.id, ...doc.data() };
    });

    const touchedIds = dish.ingredients.map((req) => req.ingredientId);
    const affectedSnap = await t.get(
      restaurantRef.collection("dishes").where("ingredientIds", "array-contains-any", touchedIds.slice(0, 10))
    );

    // --- writes: restore stock ---
    for (const req of dish.ingredients) {
      const ingredient = ingredientsById[req.ingredientId];
      const restored = ingredient.currentStock + req.qtyRequired * item.qty;
      t.update(ingredientsRef.doc(req.ingredientId), {
        currentStock: restored,
        lowStock: computeLowStock({ currentStock: restored, lowStockThreshold: ingredient.lowStockThreshold }),
      });
      ingredient.currentStock = restored;
    }

    // --- writes: recompute availability on every affected dish ---
    affectedSnap.forEach((doc) => {
      const affected = doc.data();
      t.update(doc.ref, { available: computeAvailable(affected.ingredients, ingredientsById) });
    });

    // --- writes: remove the item from the order ---
    t.update(orderRef, {
      items: order.items.filter((i) => i.itemId !== itemId),
      totalAmount: order.totalAmount - item.price * item.qty,
    });

    return { cancelled: true };
  });
});
