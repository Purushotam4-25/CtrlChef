const { onCall, HttpsError } = require("firebase-functions/https");
const { getFirestore } = require("firebase-admin/firestore");
const { computeAvailable } = require("./lib/availability");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

// Manager-only dish create/edit. The one job this does that a direct client
// write to `dishes` couldn't: derive `ingredientIds` from `ingredients`
// server-side (never trust a client-sent copy — that flat array is what
// powers the `array-contains-any` availability queries in orders.js/
// inventory.js, so letting it drift from the real recipe silently breaks
// availability recompute) and compute `available` against current stock.
// `available` is otherwise unwritable by a manager on update
// (firestore.rules: unchanged('available')), so without this an edited
// recipe would show stale availability until an unrelated order happened to
// touch one of its ingredients.
exports.upsertDish = onCall(async (request) => {
  const { restaurantId, dishId, name, category, desc } = request.data;
  const price = Number(request.data.price);
  const veg = !!request.data.veg;
  const tags = Array.isArray(request.data.tags) ? request.data.tags.filter((t) => typeof t === "string") : [];
  const ingredients = request.data.ingredients;

  if (
    !restaurantId ||
    !name ||
    typeof name !== "string" ||
    !category ||
    typeof category !== "string" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Array.isArray(ingredients) ||
    ingredients.length === 0 ||
    !ingredients.every(
      (i) => i && typeof i.ingredientId === "string" && Number.isFinite(Number(i.qtyRequired)) && Number(i.qtyRequired) > 0
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "name, category, a positive price, and a non-empty ingredients list (ingredientId + positive qtyRequired) are required"
    );
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const restaurantRef = db.collection("restaurants").doc(restaurantId);
  const recipe = ingredients.map((i) => ({ ingredientId: i.ingredientId, qtyRequired: Number(i.qtyRequired) }));
  const ingredientIds = recipe.map((i) => i.ingredientId);

  const ingredientsSnap = await restaurantRef.collection("ingredients").get();
  const ingredientsById = {};
  ingredientsSnap.forEach((doc) => {
    ingredientsById[doc.id] = { id: doc.id, ...doc.data() };
  });

  const missing = ingredientIds.filter((id) => !ingredientsById[id]);
  if (missing.length > 0) {
    throw new HttpsError("invalid-argument", `Unknown ingredient(s): ${missing.join(", ")}`);
  }

  const dish = {
    name,
    category,
    price,
    desc: typeof desc === "string" ? desc : "",
    veg,
    tags,
    ingredients: recipe,
    ingredientIds,
    available: computeAvailable(recipe, ingredientsById),
  };

  const dishRef = dishId ? restaurantRef.collection("dishes").doc(dishId) : restaurantRef.collection("dishes").doc();
  await dishRef.set(dish, { merge: true });

  return { dishId: dishRef.id, available: dish.available };
});
