// One-off script: writes demo menu + ingredient data into Firestore.
// Run: npm run seed  (inside functions/, with the Firestore emulator running)
//
// Defaults to the local emulator so this can never accidentally write to prod.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";

const admin = require("firebase-admin");
const { computeAvailable } = require("./lib/availability");

admin.initializeApp({ projectId: "ctrlchef-b8ba2" });
const db = admin.firestore();

const RESTAURANT_ID = "demo-restaurant-1";

// Deliberate overlap (paneer, basmati_rice, base_gravy, ...) so ordering a
// bunch of one dish visibly greys out every other dish sharing an ingredient.
const ingredients = [
  { id: "paneer", name: "Paneer", unit: "kg", currentStock: 8, lowStockThreshold: 2 },
  { id: "chicken", name: "Chicken", unit: "kg", currentStock: 10, lowStockThreshold: 2 },
  { id: "basmati_rice", name: "Basmati Rice", unit: "kg", currentStock: 15, lowStockThreshold: 3 },
  { id: "base_gravy", name: "Base Gravy", unit: "l", currentStock: 6, lowStockThreshold: 1.5 },
  { id: "lentils", name: "Lentils", unit: "kg", currentStock: 5, lowStockThreshold: 1 },
  { id: "tomato", name: "Tomato", unit: "kg", currentStock: 6, lowStockThreshold: 1 },
  { id: "onion", name: "Onion", unit: "kg", currentStock: 6, lowStockThreshold: 1 },
  { id: "garam_masala", name: "Garam Masala", unit: "kg", currentStock: 1, lowStockThreshold: 0.2 },
  { id: "flour", name: "Flour", unit: "kg", currentStock: 10, lowStockThreshold: 2 },
  { id: "sugar", name: "Sugar", unit: "kg", currentStock: 4, lowStockThreshold: 1 },
  { id: "milk", name: "Milk", unit: "l", currentStock: 8, lowStockThreshold: 2 },
];

const dishes = [
  { id: "paneer_tikka", name: "Paneer Tikka", category: "starter", price: 220,
    ingredients: [{ ingredientId: "paneer", qtyRequired: 0.2 }, { ingredientId: "garam_masala", qtyRequired: 0.02 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "chicken_tikka", name: "Chicken Tikka", category: "starter", price: 260,
    ingredients: [{ ingredientId: "chicken", qtyRequired: 0.25 }, { ingredientId: "garam_masala", qtyRequired: 0.02 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "paneer_butter_masala", name: "Paneer Butter Masala", category: "main", price: 280,
    ingredients: [{ ingredientId: "paneer", qtyRequired: 0.25 }, { ingredientId: "base_gravy", qtyRequired: 0.3 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "chicken_butter_masala", name: "Chicken Butter Masala", category: "main", price: 320,
    ingredients: [{ ingredientId: "chicken", qtyRequired: 0.3 }, { ingredientId: "base_gravy", qtyRequired: 0.3 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "dal_makhani", name: "Dal Makhani", category: "main", price: 220,
    ingredients: [{ ingredientId: "lentils", qtyRequired: 0.2 }, { ingredientId: "base_gravy", qtyRequired: 0.2 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "veg_biryani", name: "Veg Biryani", category: "main", price: 240,
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.3 }, { ingredientId: "paneer", qtyRequired: 0.1 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "chicken_biryani", name: "Chicken Biryani", category: "main", price: 300,
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.3 }, { ingredientId: "chicken", qtyRequired: 0.25 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "jeera_rice", name: "Jeera Rice", category: "main", price: 160,
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.25 }] },
  { id: "butter_naan", name: "Butter Naan", category: "main", price: 60,
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.15 }] },
  { id: "garlic_naan", name: "Garlic Naan", category: "main", price: 70,
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.15 }] },
  { id: "gulab_jamun", name: "Gulab Jamun", category: "dessert", price: 120,
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.1 }, { ingredientId: "sugar", qtyRequired: 0.15 }, { ingredientId: "milk", qtyRequired: 0.1 }] },
  { id: "kheer", name: "Kheer", category: "dessert", price: 130,
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.1 }, { ingredientId: "milk", qtyRequired: 0.3 }, { ingredientId: "sugar", qtyRequired: 0.1 }] },
];

// Mixed capacities per the demo data plan: 2/4/6-tops.
const tables = [
  { id: "table_1", number: 1, capacity: 2 },
  { id: "table_2", number: 2, capacity: 2 },
  { id: "table_3", number: 3, capacity: 2 },
  { id: "table_4", number: 4, capacity: 4 },
  { id: "table_5", number: 5, capacity: 4 },
  { id: "table_6", number: 6, capacity: 4 },
  { id: "table_7", number: 7, capacity: 6 },
  { id: "table_8", number: 8, capacity: 6 },
];

async function seed() {
  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({
    name: "Tandoor & Tales",
    cuisine: "Indian multi-cuisine",
    serviceChargePct: 5,
    gstPct: 5,
  });

  const ingredientsById = {};
  for (const ing of ingredients) {
    ingredientsById[ing.id] = ing;
    await restaurantRef.collection("ingredients").doc(ing.id).set({
      name: ing.name,
      unit: ing.unit,
      currentStock: ing.currentStock,
      lowStockThreshold: ing.lowStockThreshold,
      lastRestockedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  for (const dish of dishes) {
    await restaurantRef.collection("dishes").doc(dish.id).set({
      name: dish.name,
      category: dish.category,
      price: dish.price,
      imageUrl: "",
      ingredients: dish.ingredients,
      ingredientIds: dish.ingredients.map((i) => i.ingredientId),
      available: computeAvailable(dish.ingredients, ingredientsById),
    });
  }

  for (const table of tables) {
    await restaurantRef.collection("tables").doc(table.id).set({
      number: table.number,
      capacity: table.capacity,
      status: "empty",
    });
  }

  console.log(
    `Seeded ${ingredients.length} ingredients, ${dishes.length} dishes, and ${tables.length} tables into restaurants/${RESTAURANT_ID}`
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
