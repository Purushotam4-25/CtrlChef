const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { computeAvailable, computeLowStock } = require("./lib/availability");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

// Called by the manager when a real delivery arrives. currentStock only
// ever goes up here or via cancelOrderItem's restore — this is the "a
// delivery showed up" path, so it also stamps lastRestockedAt.
exports.restockIngredient = onCall(async (request) => {
  const { restaurantId, ingredientId } = request.data;
  const qtyAdded = Number(request.data.qtyAdded);

  if (!restaurantId || !ingredientId || !Number.isFinite(qtyAdded) || qtyAdded <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "restaurantId, ingredientId and a positive qtyAdded are required"
    );
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const ingredientRef = restaurantRef.collection("ingredients").doc(ingredientId);
  const ingredientsRef = restaurantRef.collection("ingredients");

  return db.runTransaction(async (t) => {
    // --- reads (all transaction reads must happen before any writes) ---
    const ingredientSnap = await t.get(ingredientRef);
    if (!ingredientSnap.exists) {
      throw new HttpsError("not-found", `Ingredient ${ingredientId} not found`);
    }
    const ingredient = ingredientSnap.data();

    // ponytail: reads the whole ingredients collection every call — fine at
    // demo scale, same tradeoff already made in orders.js.
    const ingredientsSnap = await t.get(ingredientsRef);
    const ingredientsById = {};
    ingredientsSnap.forEach((doc) => {
      ingredientsById[doc.id] = { id: doc.id, ...doc.data() };
    });

    const affectedSnap = await t.get(
      restaurantRef.collection("dishes").where("ingredientIds", "array-contains", ingredientId)
    );

    // --- writes: add the stock ---
    const newStock = ingredient.currentStock + qtyAdded;
    t.update(ingredientRef, {
      currentStock: newStock,
      lowStock: computeLowStock({ currentStock: newStock, lowStockThreshold: ingredient.lowStockThreshold }),
      lastRestockedAt: FieldValue.serverTimestamp(),
    });
    ingredientsById[ingredientId].currentStock = newStock; // keep local copy in sync for the recompute below

    // --- writes: recompute availability on every affected dish ---
    affectedSnap.forEach((doc) => {
      const affected = doc.data();
      t.update(doc.ref, { available: computeAvailable(affected.ingredients, ingredientsById) });
    });

    return { ingredientId, currentStock: newStock };
  });
});

// Manager-only add/edit. `currentStock` is only accepted on create — editing
// it afterwards stays restockIngredient's job (firestore.rules blocks a
// direct client write from touching it), so an update here only ever
// changes name/unit/lowStockThreshold and recomputes `lowStock` from the
// ingredient's existing stock.
exports.upsertIngredient = onCall(async (request) => {
  const { restaurantId, ingredientId, name, unit } = request.data;
  const lowStockThreshold = Number(request.data.lowStockThreshold);

  if (!restaurantId || !name || typeof name !== "string" || !unit || typeof unit !== "string" || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
    throw new HttpsError("invalid-argument", "name, unit, and a non-negative lowStockThreshold are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const ingredientsRef = restaurantRef.collection("ingredients");

  if (!ingredientId) {
    const currentStock = Number(request.data.currentStock);
    if (!Number.isFinite(currentStock) || currentStock < 0) {
      throw new HttpsError("invalid-argument", "A non-negative currentStock is required when creating an ingredient");
    }
    const ref = ingredientsRef.doc();
    await ref.set({
      name,
      unit,
      lowStockThreshold,
      currentStock,
      lowStock: computeLowStock({ currentStock, lowStockThreshold }),
    });
    return { ingredientId: ref.id };
  }

  const ref = ingredientsRef.doc(ingredientId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Ingredient ${ingredientId} not found`);
  }
  const currentStock = snap.data().currentStock;
  await ref.update({ name, unit, lowStockThreshold, lowStock: computeLowStock({ currentStock, lowStockThreshold }) });
  return { ingredientId };
});

// Manager-only delete. Root-cause fix for a real gap: deleting an
// ingredient a dish still needs would otherwise leave that dish silently
// `available: true` until something unrelated happened to recompute it.
// This does the recompute in the same transaction as the delete.
exports.deleteIngredient = onCall(async (request) => {
  const { restaurantId, ingredientId } = request.data;
  if (!restaurantId || !ingredientId) {
    throw new HttpsError("invalid-argument", "restaurantId and ingredientId are required");
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const ingredientRef = restaurantRef.collection("ingredients").doc(ingredientId);

  return db.runTransaction(async (t) => {
    const affectedSnap = await t.get(
      restaurantRef.collection("dishes").where("ingredientIds", "array-contains", ingredientId)
    );

    affectedSnap.forEach((doc) => t.update(doc.ref, { available: false }));
    t.delete(ingredientRef);

    return { deleted: true, affectedDishIds: affectedSnap.docs.map((d) => d.id) };
  });
});
