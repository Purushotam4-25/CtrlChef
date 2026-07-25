const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { computeAvailable } = require("./lib/availability");

setGlobalOptions({ maxInstances: 10 });

initializeApp();
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
  const { restaurantId, tableId, dishId, waiterId } = request.data;
  const qty = Number(request.data.qty);

  if (!restaurantId || !tableId || !dishId || !Number.isInteger(qty) || qty <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "restaurantId, tableId, dishId and a positive integer qty are required"
    );
  }

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
      const newStock = ingredient.currentStock - req.qtyRequired * qty;
      t.update(ingredientsRef.doc(req.ingredientId), { currentStock: newStock });
      ingredient.currentStock = newStock; // keep local copy in sync for the recompute below
    }

    // --- writes: recompute availability on every affected dish ---
    affectedSnap.forEach((doc) => {
      const affected = doc.data();
      t.update(doc.ref, { available: computeAvailable(affected.ingredients, ingredientsById) });
    });

    // --- writes: append the line item to the table's open order ---
    const item = {
      dishId,
      dishName: dish.name,
      qty,
      price: dish.price,
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
      createdBy: waiterId || null,
      createdAt: FieldValue.serverTimestamp(),
      status: "open",
      items: [item],
      totalAmount: item.price * qty,
    });
    return { orderId: newOrderRef.id };
  });
});
