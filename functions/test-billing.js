// Exercises closeOrder's new discount/paymentMethod handling and the
// historical-correctness fix (a closed order's persisted bill must never
// change even if the restaurant's serviceChargePct/gstPct changes later).
// Needs the Firestore + Functions + Auth emulators running:
//   firebase emulators:start --only firestore,functions,auth
// Run: npm run test:billing  (inside functions/)
const { randomUUID } = require("crypto");
const admin = require("firebase-admin");

const PROJECT_ID = "ctrlchef-b8ba2";
const RESTAURANT_ID = "test-restaurant-billing";
const TABLE_ID = "table_billing_test";
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
  const res = await fetch(`${FUNCTIONS_BASE}/closeOrder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

let waiter;
const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);

async function setup() {
  await restaurantRef.set({ name: "Billing Test Kitchen", serviceChargePct: 5, gstPct: 5 });
  await restaurantRef.collection("tables").doc(TABLE_ID).set({ number: 1, capacity: 4, status: "occupied" });

  const now = Date.now();
  waiter = await signUp(`waiter-billing-${now}@test.com`);
  await restaurantRef.collection("staff").doc(waiter.uid).set({ name: "Test Waiter", role: "waiter" });
}

// closeOrder can only run once per order — each case gets its own open
// order with a single served item at the given subtotal.
async function createOpenOrder(subtotal) {
  const orderRef = restaurantRef.collection("orders").doc();
  await orderRef.set({
    tableId: TABLE_ID,
    createdBy: waiter.uid,
    createdAt: admin.firestore.Timestamp.now(),
    status: "open",
    items: [
      {
        itemId: randomUUID(),
        dishId: "test_dish",
        dishName: "Test Dish",
        qty: 1,
        price: subtotal,
        ingredientsUsed: [],
        itemStatus: "served",
        addedAt: admin.firestore.Timestamp.now(),
      },
    ],
    totalAmount: subtotal,
  });
  return orderRef;
}

test("closeOrder with a flat discount computes the right bill", async () => {
  const orderRef = await createOpenOrder(1000);
  const res = await call(
    { restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "cash", discount: { type: "flat", value: 100 } },
    waiter.idToken
  );
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  const { bill } = res.result;
  // subtotal 1000 - flat 100 = taxable 900; 5% SC = 45, 5% GST = 45, total 990
  assertEqual(bill.discountAmount, 100, "discountAmount");
  assertEqual(bill.taxableAmount, 900, "taxableAmount");
  assertEqual(bill.serviceCharge, 45, "serviceCharge");
  assertEqual(bill.gst, 45, "gst");
  assertEqual(bill.total, 990, "total");
});

test("closeOrder with a pct discount computes the right bill", async () => {
  const orderRef = await createOpenOrder(1000);
  const res = await call(
    { restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "card", discount: { type: "pct", value: 10 } },
    waiter.idToken
  );
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  const { bill } = res.result;
  // subtotal 1000 - 10% = taxable 900; same as above
  assertEqual(bill.discountAmount, 100, "discountAmount");
  assertEqual(bill.total, 990, "total");
});

test("closeOrder rejects a flat discount larger than the subtotal", async () => {
  const orderRef = await createOpenOrder(100);
  const res = await call(
    { restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "cash", discount: { type: "flat", value: 200 } },
    waiter.idToken
  );
  if (!res.error || res.error.status !== "INVALID_ARGUMENT") {
    throw new Error(`expected INVALID_ARGUMENT, got ${JSON.stringify(res)}`);
  }
});

test("closeOrder rejects a pct discount over 100", async () => {
  const orderRef = await createOpenOrder(100);
  const res = await call(
    { restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "cash", discount: { type: "pct", value: 150 } },
    waiter.idToken
  );
  if (!res.error || res.error.status !== "INVALID_ARGUMENT") {
    throw new Error(`expected INVALID_ARGUMENT, got ${JSON.stringify(res)}`);
  }
});

test("closeOrder rejects a negative discount value", async () => {
  const orderRef = await createOpenOrder(100);
  const res = await call(
    { restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "cash", discount: { type: "flat", value: -10 } },
    waiter.idToken
  );
  if (!res.error || res.error.status !== "INVALID_ARGUMENT") {
    throw new Error(`expected INVALID_ARGUMENT, got ${JSON.stringify(res)}`);
  }
});

test("closeOrder rejects an invalid paymentMethod", async () => {
  const orderRef = await createOpenOrder(100);
  const res = await call({ restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "bitcoin" }, waiter.idToken);
  if (!res.error || res.error.status !== "INVALID_ARGUMENT") {
    throw new Error(`expected INVALID_ARGUMENT, got ${JSON.stringify(res)}`);
  }
});

test("a closed order's persisted bill does not change when gstPct changes later", async () => {
  const orderRef = await createOpenOrder(1000);
  const res = await call({ restaurantId: RESTAURANT_ID, orderId: orderRef.id, paymentMethod: "upi" }, waiter.idToken);
  if (!res.result) throw new Error(`expected a result, got ${JSON.stringify(res)}`);
  const billAtClose = res.result.bill;

  await restaurantRef.update({ gstPct: 18 }); // wildly different from the 5% seeded above

  const orderSnap = await orderRef.get();
  const persistedBill = orderSnap.data().bill;
  assertEqual(persistedBill.gst, billAtClose.gst, "persisted bill.gst unchanged after gstPct changed");
  assertEqual(persistedBill.total, billAtClose.total, "persisted bill.total unchanged after gstPct changed");
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
