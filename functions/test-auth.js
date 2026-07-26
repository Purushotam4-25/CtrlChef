// Exercises the requireStaffRole guards on the callable Cloud Functions —
// unauthenticated/wrong-role/correct-role, including the chef/waiter split
// on advanceOrderItemStatus. Needs the Firestore + Functions + Auth
// emulators running first:
//   firebase emulators:start --only firestore,functions,auth
// (and the demo data seeded: npm run seed)
// Run: npm run test:auth  (inside functions/)
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "demo-restaurant-1";
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key";
const TABLE_ID = "table_2";

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

function assertOk(res, label) {
  if (!res.result) {
    throw new Error(`${label}: expected a result, got ${JSON.stringify(res)}`);
  }
}

let waiter, chef, manager, orderId, itemId;

async function setup() {
  const stamp = Date.now();
  waiter = await signUp(`waiter-${stamp}@test.com`);
  chef = await signUp(`chef-${stamp}@test.com`);
  manager = await signUp(`manager-${stamp}@test.com`);

  const staffRef = db.collection("restaurants").doc(RESTAURANT_ID).collection("staff");
  await staffRef.doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });
  await staffRef.doc(chef.uid).set({ name: "Test Chef", role: "chef" });
  await staffRef.doc(manager.uid).set({ name: "Test Manager", role: "manager" });

  // Reset the table this run uses, in case a previous run left it occupied.
  await db.collection("restaurants").doc(RESTAURANT_ID).collection("tables").doc(TABLE_ID).set(
    { status: "empty" },
    { merge: true }
  );
}

test("addOrderItem with no auth is rejected", async () => {
  const res = await call("addOrderItem", { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "chicken_tikka", qty: 1 });
  assertStatus(res, "UNAUTHENTICATED", "addOrderItem no-auth");
});

test("addOrderItem as chef (wrong role) is rejected", async () => {
  const res = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "chicken_tikka", qty: 1 },
    chef.idToken
  );
  assertStatus(res, "PERMISSION_DENIED", "addOrderItem as chef");
});

test("addOrderItem as waiter succeeds", async () => {
  const res = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "chicken_tikka", qty: 1 },
    waiter.idToken
  );
  assertOk(res, "addOrderItem as waiter");
  orderId = res.result.orderId;

  const orderSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("orders").doc(orderId).get();
  itemId = orderSnap.data().items[orderSnap.data().items.length - 1].itemId;
});

test("cancelOrderItem as chef succeeds (kitchen can refuse what it cannot cook)", async () => {
  // Add a second item to the same order so the item used by the
  // advance/close tests below is untouched.
  const addRes = await call(
    "addOrderItem",
    { restaurantId: RESTAURANT_ID, tableId: TABLE_ID, dishId: "chicken_tikka", qty: 1 },
    waiter.idToken
  );
  assertOk(addRes, "addOrderItem for chef-cancel test");
  const orderSnap = await db.collection("restaurants").doc(RESTAURANT_ID).collection("orders").doc(orderId).get();
  const items = orderSnap.data().items;
  const secondItemId = items[items.length - 1].itemId;

  const res = await call(
    "cancelOrderItem",
    { restaurantId: RESTAURANT_ID, orderId, itemId: secondItemId },
    chef.idToken
  );
  assertOk(res, "cancelOrderItem as chef");
});

test("advanceOrderItemStatus received->preparing as waiter (wrong role) is rejected", async () => {
  const res = await call(
    "advanceOrderItemStatus",
    { restaurantId: RESTAURANT_ID, orderId, itemId, newStatus: "preparing" },
    waiter.idToken
  );
  assertStatus(res, "PERMISSION_DENIED", "advance received->preparing as waiter");
});

test("advanceOrderItemStatus received->preparing as chef succeeds", async () => {
  const res = await call(
    "advanceOrderItemStatus",
    { restaurantId: RESTAURANT_ID, orderId, itemId, newStatus: "preparing" },
    chef.idToken
  );
  assertOk(res, "advance received->preparing as chef");
});

test("advanceOrderItemStatus preparing->ready as chef succeeds", async () => {
  const res = await call(
    "advanceOrderItemStatus",
    { restaurantId: RESTAURANT_ID, orderId, itemId, newStatus: "ready" },
    chef.idToken
  );
  assertOk(res, "advance preparing->ready as chef");
});

test("advanceOrderItemStatus ready->served as chef (wrong role) is rejected", async () => {
  const res = await call(
    "advanceOrderItemStatus",
    { restaurantId: RESTAURANT_ID, orderId, itemId, newStatus: "served" },
    chef.idToken
  );
  assertStatus(res, "PERMISSION_DENIED", "advance ready->served as chef");
});

test("advanceOrderItemStatus ready->served as waiter succeeds", async () => {
  const res = await call(
    "advanceOrderItemStatus",
    { restaurantId: RESTAURANT_ID, orderId, itemId, newStatus: "served" },
    waiter.idToken
  );
  assertOk(res, "advance ready->served as waiter");
});

test("seatTable with no auth is rejected", async () => {
  const res = await call("seatTable", { restaurantId: RESTAURANT_ID, tableId: TABLE_ID });
  assertStatus(res, "UNAUTHENTICATED", "seatTable no-auth");
});

test("closeOrder as waiter succeeds once every item is served, with the right bill", async () => {
  const res = await call("closeOrder", { restaurantId: RESTAURANT_ID, orderId }, waiter.idToken);
  assertOk(res, "closeOrder as waiter");

  // chicken_tikka x1 @ 260, demo-restaurant-1 is seeded at 5% service charge + 5% GST.
  const { bill } = res.result;
  if (bill.subtotal !== 260 || bill.serviceCharge !== 13 || bill.gst !== 13 || bill.total !== 286) {
    throw new Error(`closeOrder bill: expected {subtotal:260,serviceCharge:13,gst:13,total:286}, got ${JSON.stringify(bill)}`);
  }
});

test("cancelOrderItem with no auth is rejected", async () => {
  const res = await call("cancelOrderItem", { restaurantId: RESTAURANT_ID, orderId, itemId: "whatever" });
  assertStatus(res, "UNAUTHENTICATED", "cancelOrderItem no-auth");
});

test("markTableClean with no auth is rejected", async () => {
  const res = await call("markTableClean", { restaurantId: RESTAURANT_ID, tableId: TABLE_ID });
  assertStatus(res, "UNAUTHENTICATED", "markTableClean no-auth");
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
