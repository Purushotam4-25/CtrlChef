// Exercises the member-scoped callables: a member can only read their own
// history/recommendations, addOrderItem's optional memberId sticks to the
// order, and recommendations are filtered to dishes still available.
// Needs the Firestore + Functions + Auth emulators running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:members  (inside functions/)
const { randomUUID } = require("crypto");
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-members";
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

function assertOk(res, label) {
  if (!res.result) {
    throw new Error(`${label}: expected a result, got ${JSON.stringify(res)}`);
  }
}

let waiter, memberA, memberB;
const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);

function makeOrder({ memberId, dishId, dishName, qty, price }) {
  return restaurantRef.collection("orders").add({
    tableId: "table_members_test",
    createdBy: waiter.uid,
    createdAt: admin.firestore.Timestamp.now(),
    status: "closed",
    items: [
      {
        itemId: randomUUID(),
        dishId,
        dishName,
        qty,
        price,
        ingredientsUsed: [],
        itemStatus: "served",
        addedAt: admin.firestore.Timestamp.now(),
      },
    ],
    totalAmount: price * qty,
    ...(memberId ? { memberId } : {}),
  });
}

async function setup() {
  await restaurantRef.set({ name: "Members Test Kitchen", serviceChargePct: 5, gstPct: 5 });

  const now = Date.now();
  waiter = await signUp(`waiter-members-${now}@test.com`);
  memberA = await signUp(`member-a-${now}@test.com`);
  memberB = await signUp(`member-b-${now}@test.com`);
  await restaurantRef.collection("staff").doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });

  // addOrderItem's affected-dish lookup needs a real ingredientIds array
  // (array-contains-any rejects an empty array), so these carry one
  // plentiful ingredient rather than an empty recipe.
  await restaurantRef.collection("ingredients").doc("ing_test").set({ name: "Test Ingredient", currentStock: 1000, lowStockThreshold: 5 });
  const recipe = [{ ingredientId: "ing_test", qtyRequired: 1 }];
  await restaurantRef.collection("dishes").doc("dish_avail").set({
    name: "Paneer Tikka", price: 200, available: true, ingredients: recipe, ingredientIds: ["ing_test"],
  });
  await restaurantRef.collection("dishes").doc("dish_soldout").set({
    name: "Chicken Biryani", price: 300, available: false, ingredients: recipe, ingredientIds: ["ing_test"],
  });

  // memberA ordered the available dish 3x and the sold-out dish once.
  await makeOrder({ memberId: memberA.uid, dishId: "dish_avail", dishName: "Paneer Tikka", qty: 3, price: 200 });
  await makeOrder({ memberId: memberA.uid, dishId: "dish_soldout", dishName: "Chicken Biryani", qty: 1, price: 300 });
  // memberB's own order — must never show up in memberA's results.
  await makeOrder({ memberId: memberB.uid, dishId: "dish_avail", dishName: "Paneer Tikka", qty: 5, price: 200 });
}

test("getMyOrderHistory with no auth is rejected", async () => {
  const res = await call("getMyOrderHistory", { restaurantId: RESTAURANT_ID, memberId: memberA.uid });
  if (!res.error || res.error.status !== "UNAUTHENTICATED") {
    throw new Error(`expected UNAUTHENTICATED, got ${JSON.stringify(res)}`);
  }
});

test("getMyOrderHistory rejects reading someone else's history", async () => {
  const res = await call("getMyOrderHistory", { restaurantId: RESTAURANT_ID, memberId: memberA.uid }, memberB.idToken);
  if (!res.error || res.error.status !== "PERMISSION_DENIED") {
    throw new Error(`expected PERMISSION_DENIED, got ${JSON.stringify(res)}`);
  }
});

test("getMyOrderHistory returns only the caller's own orders", async () => {
  const res = await call("getMyOrderHistory", { restaurantId: RESTAURANT_ID, memberId: memberA.uid }, memberA.idToken);
  assertOk(res, "getMyOrderHistory as memberA");
  assertEqual(res.result.orders.length, 2, "memberA order count");
});

test("getMyRecommendations counts frequency and filters out unavailable dishes", async () => {
  const res = await call("getMyRecommendations", { restaurantId: RESTAURANT_ID, memberId: memberA.uid }, memberA.idToken);
  assertOk(res, "getMyRecommendations as memberA");
  const { recommendations } = res.result;
  assertEqual(recommendations.length, 1, "recommendation count (sold-out dish filtered out)");
  assertEqual(recommendations[0].dishId, "dish_avail", "recommended dish");
  assertEqual(recommendations[0].orderCount, 3, "recommended dish frequency");
});

test("addOrderItem's optional memberId sticks to the order it creates", async () => {
  await restaurantRef.collection("tables").doc("table_addorder_member").set({ number: 99, capacity: 4, status: "occupied" });
  const res = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: "table_addorder_member", dishId: "dish_avail", qty: 1, memberId: memberA.uid },
    waiter.idToken
  );
  assertOk(res, "addOrderItem with memberId");
  const orderSnap = await restaurantRef.collection("orders").doc(res.result.orderId).get();
  assertEqual(orderSnap.data().memberId, memberA.uid, "order.memberId");
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
