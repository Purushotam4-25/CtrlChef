// Exercises getStockForecast's math against a hand-calculable scenario, plus
// its auth guard. Needs the Firestore + Functions + Auth emulators running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:forecast  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-forecast";
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";
const DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

function assertClose(actual, expected, label) {
  if (actual === null || expected === null) {
    if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
    return;
  }
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ~${expected}, got ${actual}`);
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
  const res = await fetch(`${FUNCTIONS_BASE}/getStockForecast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

let manager;

async function setup() {
  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({ name: "Forecast Test Kitchen" });

  // flour_test: currentStock 10, consumed 5 units (2 + 3) over the 7-day
  // window -> avgDailyConsumption = 5/7, predictedStockoutInDays = 10/(5/7) = 14.
  await restaurantRef.collection("ingredients").doc("flour_test").set({
    name: "Flour (test)",
    unit: "kg",
    currentStock: 10,
    lowStockThreshold: 2,
    lowStock: false,
  });

  // sugar_test: never ordered in-window -> avgDailyConsumption 0,
  // predictedStockoutInDays null.
  await restaurantRef.collection("ingredients").doc("sugar_test").set({
    name: "Sugar (test)",
    unit: "kg",
    currentStock: 5,
    lowStockThreshold: 1,
    lowStock: false,
  });

  await restaurantRef.collection("dishes").doc("test_dish").set({
    name: "Test Dish",
    price: 100,
    available: true,
    ingredients: [{ ingredientId: "flour_test", qtyRequired: 1 }],
    ingredientIds: ["flour_test"],
  });

  const now = Date.now();
  await restaurantRef.collection("orders").doc("order_a").set({
    tableId: "n/a",
    status: "closed",
    createdAt: admin.firestore.Timestamp.fromMillis(now - 1 * DAY_MS),
    totalAmount: 200,
    items: [{ itemId: "a1", dishId: "test_dish", dishName: "Test Dish", qty: 2, price: 100, itemStatus: "served" }],
  });
  await restaurantRef.collection("orders").doc("order_b").set({
    tableId: "n/a",
    status: "closed",
    createdAt: admin.firestore.Timestamp.fromMillis(now - 3 * DAY_MS),
    totalAmount: 300,
    items: [{ itemId: "b1", dishId: "test_dish", dishName: "Test Dish", qty: 3, price: 100, itemStatus: "served" }],
  });
  // Outside the 7-day window entirely — must not count toward consumption.
  await restaurantRef.collection("orders").doc("order_old").set({
    tableId: "n/a",
    status: "closed",
    createdAt: admin.firestore.Timestamp.fromMillis(now - 30 * DAY_MS),
    totalAmount: 1000,
    items: [{ itemId: "c1", dishId: "test_dish", dishName: "Test Dish", qty: 10, price: 100, itemStatus: "served" }],
  });

  manager = await signUp(`manager-forecast-${now}@test.com`);
  await restaurantRef.collection("staff").doc(manager.uid).set({ name: "Test Manager", role: "manager" });
}

test("getStockForecast with no auth is rejected", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, days: DAYS });
  if (!res.error || res.error.status !== "UNAUTHENTICATED") {
    throw new Error(`expected UNAUTHENTICATED, got ${JSON.stringify(res)}`);
  }
});

test("flour_test's avgDailyConsumption and predictedStockoutInDays match hand-calculated values", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, days: DAYS }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);

  const entry = res.result.forecast.find((f) => f.ingredientId === "flour_test");
  if (!entry) throw new Error("flour_test missing from forecast");

  assertClose(entry.avgDailyConsumption, 5 / DAYS, "flour_test avgDailyConsumption");
  assertClose(entry.predictedStockoutInDays, 10 / (5 / DAYS), "flour_test predictedStockoutInDays");
});

test("sugar_test (no consumption in window) gets a null stockout prediction", async () => {
  const res = await call({ restaurantId: RESTAURANT_ID, days: DAYS }, manager.idToken);
  const entry = res.result.forecast.find((f) => f.ingredientId === "sugar_test");
  if (!entry) throw new Error("sugar_test missing from forecast");

  assertClose(entry.avgDailyConsumption, 0, "sugar_test avgDailyConsumption");
  if (entry.predictedStockoutInDays !== null) {
    throw new Error(`expected null predictedStockoutInDays, got ${entry.predictedStockoutInDays}`);
  }
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
