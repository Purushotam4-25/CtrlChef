// Exercises cancelOrderItem's stock-restore path, in particular the bug
// where it used to re-read the dish live (orders.js used to iterate
// `dish.ingredients`) instead of the item's own `ingredientsUsed` snapshot:
// a deleted dish crashed the whole call, and an edited recipe restored the
// wrong quantities. Needs the Firestore + Functions + Auth emulators
// running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:orders  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-orders"; // isolated from demo-restaurant-1
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";
const TABLE_ID = "t1";

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

const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
let waiter;

async function setup() {
  await restaurantRef.set({ name: "Orders Test Kitchen" });

  await restaurantRef.collection("ingredients").doc("paneer_orders").set({
    name: "Paneer (orders test)", unit: "kg", currentStock: 10, lowStockThreshold: 2, lowStock: false,
  });
  await restaurantRef.collection("ingredients").doc("onion_orders").set({
    name: "Onion (orders test)", unit: "kg", currentStock: 6, lowStockThreshold: 1, lowStock: false,
  });

  await restaurantRef.collection("dishes").doc("dish_to_delete").set({
    name: "Paneer Dish (will be deleted)",
    price: 200,
    available: true,
    ingredients: [
      { ingredientId: "paneer_orders", qtyRequired: 2 },
      { ingredientId: "onion_orders", qtyRequired: 1 },
    ],
    ingredientIds: ["paneer_orders", "onion_orders"],
  });

  await restaurantRef.collection("tables").doc(TABLE_ID).set({ number: 1, capacity: 4, status: "empty" });

  const stamp = Date.now();
  waiter = await signUp(`orders-waiter-${stamp}@test.com`);
  await restaurantRef.collection("staff").doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });
}

test("cancelOrderItem restores stock and does not crash after the dish is deleted", async () => {
  const addRes = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "dish_to_delete", qty: 1 },
    waiter.idToken
  );
  if (!addRes.result) throw new Error(`addOrderItem failed: ${JSON.stringify(addRes)}`);
  const { orderId } = addRes.result;

  // Stock should have dropped by the recipe amounts.
  const paneerAfterOrder = await restaurantRef.collection("ingredients").doc("paneer_orders").get();
  assertEqual(paneerAfterOrder.data().currentStock, 8, "paneer stock after ordering (10 - 2)");

  const orderSnap = await restaurantRef.collection("orders").doc(orderId).get();
  const itemId = orderSnap.data().items[0].itemId;

  // Simulate a manager deleting the dish after it was ordered — this used
  // to throw a TypeError inside the transaction (`dish.ingredients` on
  // undefined) because cancelOrderItem re-read the live dish instead of
  // using the item's own ingredientsUsed snapshot.
  await restaurantRef.collection("dishes").doc("dish_to_delete").delete();

  const cancelRes = await call("cancelOrderItem", { restaurantId: RESTAURANT_ID, orderId, itemId }, waiter.idToken);
  if (!cancelRes.result) throw new Error(`cancelOrderItem failed: ${JSON.stringify(cancelRes)}`);
  assertEqual(cancelRes.result.cancelled, true, "cancelOrderItem result");

  const paneerAfterCancel = await restaurantRef.collection("ingredients").doc("paneer_orders").get();
  assertEqual(paneerAfterCancel.data().currentStock, 10, "paneer stock restored (8 + 2)");
  const onionAfterCancel = await restaurantRef.collection("ingredients").doc("onion_orders").get();
  assertEqual(onionAfterCancel.data().currentStock, 6, "onion stock restored (5 + 1)");

  const orderAfterCancel = await restaurantRef.collection("orders").doc(orderId).get();
  assertEqual(orderAfterCancel.data().items.length, 0, "item removed from order");
  assertEqual(orderAfterCancel.data().totalAmount, 0, "totalAmount back to 0");
});

test("cancelOrderItem skips an ingredient that was deleted, without crashing", async () => {
  await restaurantRef.collection("dishes").doc("dish_two_ingredients").set({
    name: "Two Ingredient Dish",
    price: 150,
    available: true,
    ingredients: [
      { ingredientId: "paneer_orders", qtyRequired: 1 },
      { ingredientId: "onion_orders", qtyRequired: 1 },
    ],
    ingredientIds: ["paneer_orders", "onion_orders"],
  });

  const addRes = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "dish_two_ingredients", qty: 1 },
    waiter.idToken
  );
  if (!addRes.result) throw new Error(`addOrderItem failed: ${JSON.stringify(addRes)}`);
  const { orderId } = addRes.result;
  const orderSnap = await restaurantRef.collection("orders").doc(orderId).get();
  const itemId = orderSnap.data().items[orderSnap.data().items.length - 1].itemId;

  // A manager deletes one ingredient outright (not just the dish).
  await restaurantRef.collection("ingredients").doc("onion_orders").delete();

  const cancelRes = await call("cancelOrderItem", { restaurantId: RESTAURANT_ID, orderId, itemId }, waiter.idToken);
  if (!cancelRes.result) throw new Error(`cancelOrderItem failed: ${JSON.stringify(cancelRes)}`);

  const paneerSnap = await restaurantRef.collection("ingredients").doc("paneer_orders").get();
  assertEqual(paneerSnap.data().currentStock, 10, "paneer restored even though onion doc is gone");
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
