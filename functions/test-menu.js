// Exercises upsertDish (ingredientIds derivation, availability computed on
// create AND on a recipe-changing update) and deleteIngredient (dependent
// dishes flip to unavailable). Needs the Firestore + Functions + Auth
// emulators running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:menu  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-menu";
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function signUp(email) {
  const res = await fetch(AUTH_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", returnSecureToken: true }),
  });
  const body = await res.json();
  return { uid: body.localId, idToken: body.idToken };
}

async function call(fnName, data, idToken) {
  const res = await fetch(`${FUNCTIONS_BASE}/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

let manager, waiter;
let dishId;

async function setup() {
  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({ name: "Menu Test Kitchen" });

  await restaurantRef.collection("ingredients").doc("flour_test").set({
    name: "Flour (test)", unit: "kg", currentStock: 10, lowStockThreshold: 2, lowStock: false,
  });
  await restaurantRef.collection("ingredients").doc("cheese_test").set({
    name: "Cheese (test)", unit: "kg", currentStock: 1, lowStockThreshold: 1, lowStock: true,
  });

  const now = Date.now();
  manager = await signUp(`manager-menu-${now}@test.com`);
  await restaurantRef.collection("staff").doc(manager.uid).set({ name: "Test Manager", role: "manager" });
  waiter = await signUp(`waiter-menu-${now}@test.com`);
  await restaurantRef.collection("staff").doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });
}

test("upsertDish as a waiter (wrong role) is rejected", async () => {
  const res = await call("upsertDish", {
    restaurantId: RESTAURANT_ID, name: "Pizza", category: "main", price: 200,
    ingredients: [{ ingredientId: "flour_test", qtyRequired: 1 }],
  }, waiter.idToken);
  if (!res.error || res.error.status !== "PERMISSION_DENIED") {
    throw new Error(`expected PERMISSION_DENIED, got ${JSON.stringify(res)}`);
  }
});

test("upsertDish create derives ingredientIds and computes available=true", async () => {
  const res = await call("upsertDish", {
    restaurantId: RESTAURANT_ID, name: "Pizza", category: "main", price: 200, veg: true, tags: ["High Carb"],
    ingredients: [{ ingredientId: "flour_test", qtyRequired: 2 }, { ingredientId: "cheese_test", qtyRequired: 1 }],
  }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  assertEqual(res.result.available, true, "available on create (flour 10>=2, cheese 1>=1)");
  dishId = res.result.dishId;

  const dishSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("dishes").doc(dishId).get();
  const dish = dishSnap.data();
  assertEqual(JSON.stringify(dish.ingredientIds.sort()), JSON.stringify(["cheese_test", "flour_test"]), "ingredientIds derived from ingredients");
  assertEqual(JSON.stringify(dish.tags), JSON.stringify(["High Carb"]), "tags stored");
});

test("upsertDish update with a heavier recipe flips available to false immediately", async () => {
  // cheese_test only has 1kg — asking for 5 makes this recipe impossible.
  // This is exactly the case a client update can't fix on its own
  // (firestore.rules blocks a manager from hand-editing `available`).
  const res = await call("upsertDish", {
    restaurantId: RESTAURANT_ID, dishId, name: "Pizza", category: "main", price: 200, veg: true, tags: [],
    ingredients: [{ ingredientId: "flour_test", qtyRequired: 2 }, { ingredientId: "cheese_test", qtyRequired: 5 }],
  }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  assertEqual(res.result.available, false, "available on update (cheese 1 < required 5)");

  const dishSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("dishes").doc(dishId).get();
  assertEqual(dishSnap.data().available, false, "dish doc available reflects the recompute");
});

test("deleteIngredient flips dependent dishes to unavailable and removes the ingredient", async () => {
  // Reset to an available recipe first, so this test proves the delete path
  // itself does the flip, not a recompute left over from the previous test.
  await call("upsertDish", {
    restaurantId: RESTAURANT_ID, dishId, name: "Pizza", category: "main", price: 200, veg: true, tags: [],
    ingredients: [{ ingredientId: "flour_test", qtyRequired: 2 }, { ingredientId: "cheese_test", qtyRequired: 1 }],
  }, manager.idToken);

  const res = await call("deleteIngredient", { restaurantId: RESTAURANT_ID, ingredientId: "cheese_test" }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  assertEqual(res.result.affectedDishIds.includes(dishId), true, "dish reported as affected");

  const dishSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("dishes").doc(dishId).get();
  assertEqual(dishSnap.data().available, false, "dish flipped unavailable after its ingredient was deleted");

  const ingredientSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("ingredients").doc("cheese_test").get();
  assertEqual(ingredientSnap.exists, false, "ingredient doc actually deleted");
});

async function run() {
  await setup();
  let failed = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}`);
      console.log(`      ${err.message}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}

run();
