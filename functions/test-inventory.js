// Exercises restockIngredient: stock/lowStock/availability updates, plus its
// auth guard and input validation. Needs the Firestore + Functions + Auth
// emulators running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:inventory  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-inventory";
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

async function call(data, idToken) {
  const res = await fetch(`${FUNCTIONS_BASE}/restockIngredient`, {
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

async function setup() {
  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({ name: "Inventory Test Kitchen" });

  // paneer_test: starts low (currentStock 1 <= threshold 2) and short of
  // what test_dish needs (3), so both lowStock and available start "wrong"
  // and the restock should flip both.
  await restaurantRef.collection("ingredients").doc("paneer_test").set({
    name: "Paneer (test)",
    unit: "kg",
    currentStock: 1,
    lowStockThreshold: 2,
    lowStock: true,
  });

  await restaurantRef.collection("dishes").doc("test_dish").set({
    name: "Test Dish",
    price: 100,
    available: false,
    ingredients: [{ ingredientId: "paneer_test", qtyRequired: 3 }],
    ingredientIds: ["paneer_test"],
  });

  const now = Date.now();
  manager = await signUp(`manager-inventory-${now}@test.com`);
  await restaurantRef.collection("staff").doc(manager.uid).set({ name: "Test Manager", role: "manager" });
  waiter = await signUp(`waiter-inventory-${now}@test.com`);
  await restaurantRef.collection("staff").doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });
}

test("restockIngredient with no auth is rejected", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, ingredientId: "paneer_test", qtyAdded: 5 });
  if (!res.error || res.error.status !== "UNAUTHENTICATED") {
    throw new Error(`expected UNAUTHENTICATED, got ${JSON.stringify(res)}`);
  }
});

test("restockIngredient as a waiter (wrong role) is rejected", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, ingredientId: "paneer_test", qtyAdded: 5 }, waiter.idToken);
  if (!res.error || res.error.status !== "PERMISSION_DENIED") {
    throw new Error(`expected PERMISSION_DENIED, got ${JSON.stringify(res)}`);
  }
});

test("restockIngredient rejects a non-positive qtyAdded", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, ingredientId: "paneer_test", qtyAdded: 0 }, manager.idToken);
  if (!res.error || res.error.status !== "INVALID_ARGUMENT") {
    throw new Error(`expected INVALID_ARGUMENT, got ${JSON.stringify(res)}`);
  }
});

test("restockIngredient as manager updates stock, lowStock, and dish availability", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, ingredientId: "paneer_test", qtyAdded: 5 }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  assertEqual(res.result.ingredientId, "paneer_test", "response ingredientId");
  assertEqual(res.result.currentStock, 6, "response currentStock"); // 1 + 5

  const ingredientSnap = await db
    .collection("restaurants").doc(RESTAURANT_ID)
    .collection("ingredients").doc("paneer_test").get();
  assertEqual(ingredientSnap.data().currentStock, 6, "ingredient doc currentStock");
  assertEqual(ingredientSnap.data().lowStock, false, "ingredient doc lowStock (6 > threshold 2)");
  if (!ingredientSnap.data().lastRestockedAt) throw new Error("expected lastRestockedAt to be set");

  const dishSnap = await db
    .collection("restaurants").doc(RESTAURANT_ID)
    .collection("dishes").doc("test_dish").get();
  assertEqual(dishSnap.data().available, true, "dish available (6 >= required 3)");
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
