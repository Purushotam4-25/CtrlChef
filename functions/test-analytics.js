// Exercises getSalesAnalytics and getTableTurnoverStats. Writes controlled
// order fixtures directly via the admin SDK (bypassing the real order-flow
// functions) so the expected totals can be hand-calculated and checked.
// Needs the Firestore + Functions + Auth emulators running first:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:analytics  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-analytics"; // isolated from demo-restaurant-1 so seed data doesn't skew the math
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
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

async function signUp(email) {
  const res = await fetch(AUTH_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", returnSecureToken: true }),
  });
  const body = await res.json();
  return { uid: body.localId, idToken: body.idToken };
}

function assertStatus(res, status, label) {
  if (!res.error || res.error.status !== status) {
    throw new Error(`${label}: expected error.status "${status}", got ${JSON.stringify(res)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let manager, waiterUid;

async function setup() {
  const stamp = Date.now();
  manager = await signUp(`analytics-manager-${stamp}@test.com`);
  waiterUid = `analytics-waiter-${stamp}`;

  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({ name: "Analytics Test Restaurant" });
  await restaurantRef.collection("staff").doc(manager.uid).set({ name: "Test Manager", role: "manager" });
  await restaurantRef.collection("staff").doc(waiterUid).set({ name: "Test Waiter", role: "waiter" });

  await restaurantRef.collection("dishes").doc("dish_a").set({ name: "Dish A", price: 100 });
  // Never ordered — should still show up in byDish at qty 0, and count as a slow mover.
  await restaurantRef.collection("dishes").doc("dish_b").set({ name: "Dish B", price: 150 });

  await restaurantRef.collection("tables").doc("t1").set({ number: 1, capacity: 4, partySize: 4, status: "empty" });

  // flour_x has a cost, salt_x deliberately doesn't — exercises the
  // missing-costPerUnit fallback and the missingCostIngredientIds flag.
  await restaurantRef.collection("ingredients").doc("flour_x").set({ name: "Flour X", unit: "kg", currentStock: 10, lowStockThreshold: 1, costPerUnit: 10 });
  await restaurantRef.collection("ingredients").doc("salt_x").set({ name: "Salt X", unit: "kg", currentStock: 10, lowStockThreshold: 1 });

  const now = Date.now();
  const order1CreatedAt = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const order1ClosedAt = new Date(order1CreatedAt.getTime() + 30 * 60 * 1000); // 30 min
  const order2CreatedAt = new Date(now - 1 * 24 * 60 * 60 * 1000);
  const order2ClosedAt = new Date(order2CreatedAt.getTime() + 50 * 60 * 1000); // 50 min

  await restaurantRef.collection("orders").doc("order1").set({
    tableId: "t1",
    createdBy: waiterUid,
    status: "closed",
    createdAt: order1CreatedAt,
    closedAt: order1ClosedAt,
    totalAmount: 300,
    items: [{
      itemId: "i1", dishId: "dish_a", dishName: "Dish A", qty: 3, price: 100, itemStatus: "served", addedAt: order1CreatedAt,
      ingredientsUsed: [{ ingredientId: "flour_x", qtyRequired: 2 }], // 2 * 10/unit * qty 3 = 60 cost
    }],
  });

  await restaurantRef.collection("orders").doc("order2").set({
    tableId: "t1",
    createdBy: waiterUid,
    status: "closed",
    createdAt: order2CreatedAt,
    closedAt: order2ClosedAt,
    totalAmount: 200,
    items: [{
      itemId: "i2", dishId: "dish_a", dishName: "Dish A", qty: 2, price: 100, itemStatus: "served", addedAt: order2CreatedAt,
      ingredientsUsed: [{ ingredientId: "salt_x", qtyRequired: 1 }], // no costPerUnit -> 0 cost, flagged as missing
    }],
  });

  // dish_deleted doesn't exist in the dishes collection (simulates a
  // manager having deleted it after this order was placed) — the item
  // still carries its own snapshotted dishName. On a separate table/capacity
  // and a separate staff member so it doesn't perturb the capacity-4 turnover
  // or byStaff numbers hand-calculated below.
  await restaurantRef.collection("tables").doc("t2").set({ number: 2, capacity: 6, status: "empty" });
  await restaurantRef.collection("orders").doc("order3").set({
    tableId: "t2",
    createdBy: null,
    status: "closed",
    createdAt: order2CreatedAt,
    closedAt: order2ClosedAt,
    totalAmount: 400,
    items: [{ itemId: "i3", dishId: "dish_deleted", dishName: "Deleted Dish", qty: 4, price: 100, itemStatus: "served", addedAt: order2CreatedAt }],
  });

  // Hand-calculated: dish_a sold 3+2=5 for 300+200=500 revenue.
  // Turnover for party-of-4 (t1's partySize): (30 + 50) / 2 = 40 min average, 2 samples.
}

test("getSalesAnalytics with no auth is rejected", async () => {
  const res = await call("getSalesAnalytics", { restaurantId: RESTAURANT_ID });
  assertStatus(res, "UNAUTHENTICATED", "getSalesAnalytics no-auth");
});

test("getTableTurnoverStats with no auth is rejected", async () => {
  const res = await call("getTableTurnoverStats", { restaurantId: RESTAURANT_ID });
  assertStatus(res, "UNAUTHENTICATED", "getTableTurnoverStats no-auth");
});

test("getSalesAnalytics totals match hand-calculated values", async () => {
  const res = await call("getSalesAnalytics", { restaurantId: RESTAURANT_ID }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);

  const dishA = res.result.byDish.find((d) => d.dishId === "dish_a");
  assertEqual(dishA.qty, 5, "dish_a qty");
  assertEqual(dishA.revenue, 500, "dish_a revenue");

  const dishB = res.result.byDish.find((d) => d.dishId === "dish_b");
  assertEqual(dishB.qty, 0, "dish_b qty (never ordered)");

  assertEqual(res.result.topSellers[0].dishId, "dish_a", "top seller");
  if (!res.result.slowMovers.some((d) => d.dishId === "dish_b")) {
    throw new Error("expected dish_b (0 sales) to appear in slowMovers");
  }

  const staffEntry = res.result.byStaff.find((s) => s.staffId === waiterUid);
  assertEqual(staffEntry.qty, 5, "byStaff qty");
  assertEqual(staffEntry.revenue, 500, "byStaff revenue");
  assertEqual(staffEntry.orderCount, 2, "byStaff orderCount");
});

test("getSalesAnalytics computes ingredient cost from ingredientsUsed and flags missing costPerUnit", async () => {
  const res = await call("getSalesAnalytics", { restaurantId: RESTAURANT_ID }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);

  const dishA = res.result.byDish.find((d) => d.dishId === "dish_a");
  // order1: flour_x (costPerUnit 10) * 2 qtyRequired * 3 ordered = 60.
  // order2: salt_x has no costPerUnit -> resolves to 0, but still flags missing.
  assertEqual(dishA.cost, 60, "dish_a cost");
  assertEqual(dishA.missingCost, true, "dish_a missingCost flag");

  if (!res.result.missingCostIngredientIds.includes("salt_x")) {
    throw new Error(`expected missingCostIngredientIds to include salt_x, got ${JSON.stringify(res.result.missingCostIngredientIds)}`);
  }

  // order3's item has no ingredientsUsed at all -> 0 cost, not flagged missing.
  const deletedDish = res.result.byDish.find((d) => d.dishId === "dish_deleted");
  assertEqual(deletedDish.cost, 0, "dish_deleted cost (no ingredientsUsed snapshot)");
  assertEqual(deletedDish.missingCost, false, "dish_deleted missingCost flag");

  // Totals: revenue 300+200+400=900, cost only from order1's flour_x line = 60.
  assertEqual(res.result.totalRevenue, 900, "totalRevenue");
  assertEqual(res.result.totalCost, 60, "totalCost");
});

test("getTableTurnoverStats matches hand-calculated average", async () => {
  const res = await call("getTableTurnoverStats", { restaurantId: RESTAURANT_ID }, manager.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);

  const party4 = res.result.byPartySize.find((c) => c.partySize === 4);
  if (!party4) throw new Error(`expected a party-of-4 bucket, got ${JSON.stringify(res.result.byPartySize)}`);
  assertEqual(party4.sampleCount, 2, "party-of-4 sampleCount");
  assertEqual(party4.avgDurationMinutes, 40, "party-of-4 avgDurationMinutes");
});

test("getSalesAnalytics still totals a since-deleted dish, using its snapshotted name", async () => {
  const res = await call("getSalesAnalytics", { restaurantId: RESTAURANT_ID }, manager.idToken);
  const deleted = res.result.byDish.find((d) => d.dishId === "dish_deleted");
  if (!deleted) throw new Error("expected dish_deleted to still appear in byDish");
  assertEqual(deleted.name, "Deleted Dish", "dish_deleted name (from item snapshot)");
  assertEqual(deleted.qty, 4, "dish_deleted qty");
  assertEqual(deleted.revenue, 400, "dish_deleted revenue");
});

test("getSalesAnalytics rejects a negative days", async () => {
  const res = await call("getSalesAnalytics", { restaurantId: RESTAURANT_ID, days: -5 }, manager.idToken);
  assertStatus(res, "INVALID_ARGUMENT", "getSalesAnalytics negative days");
});

test("getTableTurnoverStats rejects a negative days", async () => {
  const res = await call("getTableTurnoverStats", { restaurantId: RESTAURANT_ID, days: -5 }, manager.idToken);
  assertStatus(res, "INVALID_ARGUMENT", "getTableTurnoverStats negative days");
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
