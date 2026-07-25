// Exercises firestore.rules against a batch of real read/write attempts,
// one per role/collection combination that matters. Needs the Firestore
// emulator running first: firebase emulators:start --only firestore
// Run: npm run test:rules  (inside functions/)
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");

const PROJECT_ID = "ctrlchef-rules-test";
const RESTAURANT_ID = "demo-restaurant-1";

let testEnv;
const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

async function setup() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  // Fixture data, written bypassing rules — this is what each case below
  // reads or tries to mutate.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const restaurantRef = context.firestore().collection("restaurants").doc(RESTAURANT_ID);
    await restaurantRef.set({ name: "Tandoor & Tales" });
    await restaurantRef.collection("dishes").doc("paneer_tikka").set({ name: "Paneer Tikka", price: 220, available: true });
    await restaurantRef.collection("ingredients").doc("paneer").set({ name: "Paneer", currentStock: 8, lowStockThreshold: 2 });
    await restaurantRef.collection("tables").doc("table_1").set({ number: 1, capacity: 2, status: "empty" });
    await restaurantRef.collection("orders").doc("order_1").set({ tableId: "table_1", status: "open", items: [], totalAmount: 0 });
    await restaurantRef.collection("staff").doc("waiter-uid").set({ name: "W", role: "waiter" });
    await restaurantRef.collection("staff").doc("manager-uid").set({ name: "M", role: "manager" });
    await restaurantRef.collection("members").doc("member-uid").set({ name: "Mem" });
  });
}

function dish(db) {
  return db.collection("restaurants").doc(RESTAURANT_ID).collection("dishes").doc("paneer_tikka");
}
function ingredient(db) {
  return db.collection("restaurants").doc(RESTAURANT_ID).collection("ingredients").doc("paneer");
}
function order(db) {
  return db.collection("restaurants").doc(RESTAURANT_ID).collection("orders").doc("order_1");
}
function member(db, uid) {
  return db.collection("restaurants").doc(RESTAURANT_ID).collection("members").doc(uid);
}

test("guest can read the public menu", async () => {
  await assertSucceeds(dish(testEnv.unauthenticatedContext().firestore()).get());
});

test("guest cannot flip a dish's availability directly", async () => {
  await assertFails(dish(testEnv.unauthenticatedContext().firestore()).update({ available: false }));
});

test("manager can edit a dish's name", async () => {
  await assertSucceeds(dish(testEnv.authenticatedContext("manager-uid").firestore()).update({ name: "Paneer Tikka Deluxe" }));
});

test("manager cannot flip a dish's availability directly", async () => {
  await assertFails(dish(testEnv.authenticatedContext("manager-uid").firestore()).update({ available: false }));
});

test("waiter cannot edit ingredients", async () => {
  await assertFails(ingredient(testEnv.authenticatedContext("waiter-uid").firestore()).update({ lowStockThreshold: 1 }));
});

test("manager can edit an ingredient's low-stock threshold", async () => {
  await assertSucceeds(ingredient(testEnv.authenticatedContext("manager-uid").firestore()).update({ lowStockThreshold: 1 }));
});

test("manager cannot hand-edit an ingredient's stock count", async () => {
  await assertFails(ingredient(testEnv.authenticatedContext("manager-uid").firestore()).update({ currentStock: 999 }));
});

test("unauthenticated user cannot read orders", async () => {
  await assertFails(order(testEnv.unauthenticatedContext().firestore()).get());
});

test("staff can read orders", async () => {
  await assertSucceeds(order(testEnv.authenticatedContext("waiter-uid").firestore()).get());
});

test("nobody can write an order directly, not even a manager", async () => {
  await assertFails(order(testEnv.authenticatedContext("manager-uid").firestore()).update({ totalAmount: 0 }));
});

test("anyone can create a queue check-in with no login", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(
    db.collection("restaurants").doc(RESTAURANT_ID).collection("queue").add({ partySize: 2, status: "waiting" })
  );
});

test("a member can write their own profile", async () => {
  await assertSucceeds(member(testEnv.authenticatedContext("member-uid").firestore(), "member-uid").set({ name: "Updated" }));
});

test("a member cannot write someone else's profile", async () => {
  await assertFails(member(testEnv.authenticatedContext("member-uid").firestore(), "someone-else-uid").set({ name: "Hijacked" }));
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
  await testEnv.cleanup();
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}

run();
