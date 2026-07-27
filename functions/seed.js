// One-off script: writes demo menu + ingredient data into Firestore.
// Run: npm run seed  (inside functions/, with the Firestore emulator running)
//
// Defaults to the local emulator so this can never accidentally write to
// prod. Set SEED_PROD=true to target the real project instead (needs
// GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key).
//
// Note the old approach of just unsetting FIRESTORE_EMULATOR_HOST doesn't
// work — `||=` treats "unset" as "fill in the default", the opposite of
// what you'd want. This flag is the actual opt-in.
if (process.env.SEED_PROD !== "true") {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
}

const { randomUUID } = require("crypto");
const admin = require("firebase-admin");
const { computeAvailable, computeLowStock } = require("./lib/availability");
const { computeBill } = require("./lib/billing");

admin.initializeApp({ projectId: "ctrlchef-b8ba2" });
const db = admin.firestore();
// Some networks (corporate proxy, VPN, antivirus doing HTTP/2 inspection)
// silently swallow the gRPC transport the SDK uses by default — the process
// just hangs forever with no error. REST works everywhere gRPC does and
// costs nothing for a one-off script.
db.settings({ preferRest: true });

const RESTAURANT_ID = "demo-restaurant-1";

// Deliberate overlap (paneer, basmati_rice, base_gravy, ...) so ordering a
// bunch of one dish visibly greys out every other dish sharing an ingredient.
const ingredients = [
  // Stock levels are tuned against seedOrderHistory below: Base Gravy and
  // Chicken are deliberately kept tight (a few days of runway) and Garam
  // Masala moderately so, so the Forecast tab has a real 2-3-card story
  // instead of either zero or all eleven — see the projected-forecast
  // summary npm run seed prints. The rest are kept comfortable but still
  // modest, so ordering a bunch of one dish live during the demo can still
  // visibly grey out every other dish sharing that ingredient.
  // costPerUnit is INR per the ingredient's unit (kg/L), rough wholesale
  // prices — landed against the seeded menu prices below, weighted by
  // DISH_WEIGHT, this comes out to a ~29% blended food cost, right in the
  // 28-35% rule-of-thumb range (npm run seed doesn't print this — checked
  // by hand when these numbers were picked).
  { id: "paneer", name: "Paneer", unit: "kg", currentStock: 33, lowStockThreshold: 2, costPerUnit: 320 },
  { id: "chicken", name: "Chicken", unit: "kg", currentStock: 17, lowStockThreshold: 2, costPerUnit: 220 },
  { id: "basmati_rice", name: "Basmati Rice", unit: "kg", currentStock: 60, lowStockThreshold: 3, costPerUnit: 120 },
  { id: "base_gravy", name: "Base Gravy", unit: "L", currentStock: 11, lowStockThreshold: 1.5, costPerUnit: 80 },
  { id: "lentils", name: "Lentils", unit: "kg", currentStock: 9, lowStockThreshold: 1, costPerUnit: 110 },
  { id: "tomato", name: "Tomato", unit: "kg", currentStock: 16, lowStockThreshold: 1, costPerUnit: 40 },
  { id: "onion", name: "Onion", unit: "kg", currentStock: 28, lowStockThreshold: 1, costPerUnit: 35 },
  { id: "garam_masala", name: "Garam Masala", unit: "kg", currentStock: 1, lowStockThreshold: 0.2, costPerUnit: 600 },
  { id: "flour", name: "Flour", unit: "kg", currentStock: 17, lowStockThreshold: 2, costPerUnit: 45 },
  { id: "sugar", name: "Sugar", unit: "kg", currentStock: 5, lowStockThreshold: 1, costPerUnit: 45 },
  { id: "milk", name: "Milk", unit: "L", currentStock: 8, lowStockThreshold: 2, costPerUnit: 55 },
];

const dishes = [
  { id: "paneer_tikka", name: "Paneer Tikka", category: "starter", price: 220, veg: true,
    desc: "Charcoal-grilled cottage cheese, smoky and marinated.",
    ingredients: [{ ingredientId: "paneer", qtyRequired: 0.2 }, { ingredientId: "garam_masala", qtyRequired: 0.02 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "chicken_tikka", name: "Chicken Tikka", category: "starter", price: 260, veg: false,
    desc: "Yogurt-marinated chicken, char-grilled to order.",
    ingredients: [{ ingredientId: "chicken", qtyRequired: 0.25 }, { ingredientId: "garam_masala", qtyRequired: 0.02 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "paneer_butter_masala", name: "Paneer Butter Masala", category: "main", price: 280, veg: true,
    desc: "Cottage cheese in a rich tomato-butter gravy.",
    ingredients: [{ ingredientId: "paneer", qtyRequired: 0.25 }, { ingredientId: "base_gravy", qtyRequired: 0.3 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "chicken_butter_masala", name: "Chicken Butter Masala", category: "main", price: 320, veg: false,
    desc: "Tomato-cream gravy, kasuri methi — the classic.",
    ingredients: [{ ingredientId: "chicken", qtyRequired: 0.3 }, { ingredientId: "base_gravy", qtyRequired: 0.3 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "dal_makhani", name: "Dal Makhani", category: "main", price: 220, veg: true,
    desc: "Slow-simmered black lentils, butter and cream.",
    ingredients: [{ ingredientId: "lentils", qtyRequired: 0.2 }, { ingredientId: "base_gravy", qtyRequired: 0.2 }, { ingredientId: "tomato", qtyRequired: 0.1 }] },
  { id: "veg_biryani", name: "Veg Biryani", category: "main", price: 240, veg: true,
    desc: "Layered basmati rice with garden vegetables.",
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.3 }, { ingredientId: "paneer", qtyRequired: 0.1 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "chicken_biryani", name: "Chicken Biryani", category: "main", price: 300, veg: false,
    desc: "Dum-cooked basmati rice with tender chicken.",
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.3 }, { ingredientId: "chicken", qtyRequired: 0.25 }, { ingredientId: "onion", qtyRequired: 0.1 }] },
  { id: "jeera_rice", name: "Jeera Rice", category: "main", price: 160, veg: true,
    desc: "Basmati rice tempered with cumin.",
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.25 }] },
  { id: "butter_naan", name: "Butter Naan", category: "main", price: 60, veg: true,
    desc: "Tandoor-blistered flatbread, brushed with butter.",
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.15 }] },
  { id: "garlic_naan", name: "Garlic Naan", category: "main", price: 70, veg: true,
    desc: "Naan topped with fresh garlic and coriander.",
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.15 }] },
  { id: "gulab_jamun", name: "Gulab Jamun", category: "dessert", price: 120, veg: true,
    desc: "Milk dumplings soaked in cardamom syrup.",
    ingredients: [{ ingredientId: "flour", qtyRequired: 0.1 }, { ingredientId: "sugar", qtyRequired: 0.15 }, { ingredientId: "milk", qtyRequired: 0.1 }] },
  { id: "kheer", name: "Kheer", category: "dessert", price: 130, veg: true,
    desc: "Slow-cooked rice pudding, milk and sugar.",
    ingredients: [{ ingredientId: "basmati_rice", qtyRequired: 0.1 }, { ingredientId: "milk", qtyRequired: 0.3 }, { ingredientId: "sugar", qtyRequired: 0.1 }] },
];

// Demo staff logins — fixed emails/password so the ops app has something to
// sign in with in the emulator without a manual Auth Console step.
const DEMO_PASSWORD = "ctrlchef123";
const staff = [
  { email: "priya@ctrlchef.demo", name: "Priya Nair", role: "waiter" },
  { email: "ramesh@ctrlchef.demo", name: "Ramesh Gowda", role: "chef" },
  { email: "anita@ctrlchef.demo", name: "Anita Rao", role: "manager" },
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

// ---------------------------------------------------------------------
// Backdated order history: gives Analytics, Forecast and table turnover
// something real to show on demo day instead of empty charts. Written
// directly via the admin SDK -- NOT via addOrderItem -- because that would
// decrement currentStock (these orders represent past consumption, not a
// live decrement) and stamp createdAt as "now" instead of backdated.
// ---------------------------------------------------------------------

const DAYS_BACK = 7;
const LUNCH = { startHour: 12, endHour: 14.5 };
const DINNER = { startHour: 19, endHour: 22.5 };
const TRICKLE = { startHour: 16, endHour: 18 }; // light off-peak trickle, keeps the trough from reading as a hard zero

// Relative popularity -- biryanis and butter chicken are clear winners,
// jeera rice and kheer are clear slow movers, per the demo data plan.
const DISH_WEIGHT = {
  chicken_butter_masala: 10,
  chicken_biryani: 9,
  veg_biryani: 7,
  butter_naan: 8,
  chicken_tikka: 6,
  paneer_butter_masala: 6,
  paneer_tikka: 5,
  garlic_naan: 5,
  dal_makhani: 4,
  gulab_jamun: 3,
  jeera_rice: 1,
  kheer: 1,
};

// Spread unevenly across all three staff so "Sales by Staff" ranks.
const STAFF_WEIGHT = { waiter: 60, manager: 25, chef: 15 };

// Deterministic PRNG (not Math.random) so re-runs are reproducible while
// tuning the forecast -- see the console summary seedOrderHistory prints.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// entries: [[item, weight], ...]
function weightedPick(rand, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let r = rand() * total;
  for (const [item, weight] of entries) {
    r -= weight;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function durationMinutesForCapacity(rand, capacity) {
  if (capacity <= 2) return 20 + rand() * 20;
  if (capacity <= 4) return 35 + rand() * 30;
  return 55 + rand() * 40;
}

function pickSession(rand) {
  const r = rand();
  if (r < 0.47) return LUNCH;
  if (r < 0.94) return DINNER;
  return TRICKLE;
}

function timeWithinSession(rand, session, dayDate) {
  // Built in UTC deliberately: the Cloud Functions runtime (and its
  // emulator) reads Firestore Timestamps back with getHours()/getDay() in
  // UTC, which is not necessarily this machines local zone. Using
  // setUTCHours here is what makes the lunch/dinner windows actually land
  // on the intended hours in analytics.js and forecast.js.
  const frac = (rand() + rand()) / 2;
  const minutesSinceMidnight = session.startHour * 60 + frac * (session.endHour - session.startHour) * 60;
  const d = new Date(dayDate);
  d.setUTCHours(0, Math.round(minutesSinceMidnight), 0, 0);
  return d;
}

function pickDishes(rand, dishPool, count) {
  const pool = [...dishPool];
  const chosen = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const entries = pool.map((d) => [d, DISH_WEIGHT[d.id] || 1]);
    const dish = weightedPick(rand, entries);
    chosen.push(dish);
    pool.splice(pool.indexOf(dish), 1);
  }
  return chosen;
}

async function deleteCollection(ref) {
  const snap = await ref.get();
  if (snap.empty) return;
  const commits = [];
  let batch = db.batch();
  let count = 0;
  snap.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
    if (count === 400) {
      commits.push(batch.commit());
      batch = db.batch();
      count = 0;
    }
  });
  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function seedOrderHistory({ restaurantRef, dishList, ingredientsById, staffUids, serviceChargePct, gstPct }) {
  const ordersRef = restaurantRef.collection("orders");
  await deleteCollection(ordersRef);

  const rand = mulberry32(20260726);
  const staffEntries = Object.entries(STAFF_WEIGHT).map(([role, weight]) => [staffUids[role], weight]);
  const consumedByIngredient = {};
  let tableCursor = 0;
  const now = Date.now();
  let written = 0;
  let batch = db.batch();

  for (let offsetDays = 0; offsetDays < DAYS_BACK; offsetDays++) {
    const dayDate = new Date(now - offsetDays * 24 * 60 * 60 * 1000);
    const isWeekend = dayDate.getUTCDay() === 0 || dayDate.getUTCDay() === 6; // matches how analytics.js buckets by day
    const baseCount = randInt(rand, 15, 30);
    const orderCount = isWeekend ? Math.round(baseCount * 1.3) : baseCount;

    for (let i = 0; i < orderCount; i++) {
      const createdAtDate = timeWithinSession(rand, pickSession(rand), dayDate);
      if (createdAtDate.getTime() > now) continue;

      const table = tables[tableCursor % tables.length];
      tableCursor++;
      const durationMin = durationMinutesForCapacity(rand, table.capacity);
      const closedAtDate = new Date(createdAtDate.getTime() + durationMin * 60 * 1000);

      const itemCount = weightedPick(rand, [[1, 55], [2, 30], [3, 15]]);
      const items = [];
      let totalAmount = 0;
      for (const dish of pickDishes(rand, dishList, itemCount)) {
        const qty = weightedPick(rand, [[1, 65], [2, 30], [3, 5]]);
        const addedAtOffsetMin = rand() * Math.min(durationMin * 0.4, 15);
        items.push({
          itemId: randomUUID(),
          dishId: dish.id,
          dishName: dish.name,
          qty,
          price: dish.price,
          ingredientsUsed: dish.ingredients,
          itemStatus: "served",
          addedAt: admin.firestore.Timestamp.fromDate(new Date(createdAtDate.getTime() + addedAtOffsetMin * 60 * 1000)),
        });
        totalAmount += dish.price * qty;

        for (const req of dish.ingredients) {
          consumedByIngredient[req.ingredientId] = (consumedByIngredient[req.ingredientId] || 0) + req.qtyRequired * qty;
        }
      }
      // India-context weighting; no discounts in seed data — that branch of
      // computeBill is already covered by a real test, and realistic demo
      // data doesn't need it. Reusing computeBill (not hand-rolling the
      // formula a third time) means seed data can never drift from real
      // billing math.
      const paymentMethod = weightedPick(rand, [["upi", 45], ["cash", 35], ["card", 20]]);
      const bill = computeBill({ subtotal: totalAmount, discount: null, serviceChargePct, gstPct });

      const orderRef = ordersRef.doc(`seed_order_${String(offsetDays).padStart(2, "0")}_${String(i).padStart(3, "0")}`);
      batch.set(orderRef, {
        tableId: table.id,
        createdBy: weightedPick(rand, staffEntries),
        createdAt: admin.firestore.Timestamp.fromDate(createdAtDate),
        closedAt: admin.firestore.Timestamp.fromDate(closedAtDate),
        status: "closed",
        items,
        totalAmount,
        bill,
        paymentMethod,
      });
      written++;
      if (written % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }
  await batch.commit();

  console.log(`\nSeeded ${written} backdated orders over ${DAYS_BACK} days. Projected forecast (avg/day over ${DAYS_BACK}d):`);
  const rows = Object.values(ingredientsById).map((ingredient) => {
    const avgDaily = (consumedByIngredient[ingredient.id] || 0) / DAYS_BACK;
    const days = avgDaily > 0 ? ingredient.currentStock / avgDaily : Infinity;
    return { ingredient, avgDaily, days };
  });
  rows.sort((a, b) => a.days - b.days);
  for (const { ingredient, avgDaily, days } of rows) {
    const daysLabel = Number.isFinite(days) ? days.toFixed(1) : "-";
    console.log(`  ${ingredient.name.padEnd(16)} stock=${ingredient.currentStock}  avgDaily=${avgDaily.toFixed(2)}  daysToStockout=${daysLabel}`);
  }

  return { ordersWritten: written };
}

async function seedLiveDemoState({ restaurantRef, dishesById, staffUids }) {
  const queueRef = restaurantRef.collection("queue");
  await deleteCollection(queueRef);

  const now = Date.now();
  await queueRef.doc("seed_queue_1").set({
    name: "Rohan Mehta",
    partySize: 4,
    status: "waiting",
    checkedInAt: admin.firestore.Timestamp.fromMillis(now - 6 * 60 * 1000),
  });
  await queueRef.doc("seed_queue_2").set({
    name: "Fatima Sheikh",
    partySize: 2,
    status: "waiting",
    checkedInAt: admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 1000),
  });

  const liveTableId = "table_4";
  const seatedAt = admin.firestore.Timestamp.fromMillis(now - 12 * 60 * 1000);
  await restaurantRef.collection("tables").doc(liveTableId).set({ status: "occupied", seatedAt }, { merge: true });

  const dishA = dishesById["chicken_biryani"];
  const dishB = dishesById["garlic_naan"];
  await restaurantRef.collection("orders").doc("seed_order_live_open").set({
    tableId: liveTableId,
    createdBy: staffUids.waiter,
    createdAt: seatedAt,
    status: "open",
    items: [
      {
        itemId: randomUUID(),
        dishId: dishA.id,
        dishName: dishA.name,
        qty: 2,
        price: dishA.price,
        ingredientsUsed: dishA.ingredients,
        itemStatus: "preparing",
        addedAt: seatedAt,
      },
      {
        itemId: randomUUID(),
        dishId: dishB.id,
        dishName: dishB.name,
        qty: 2,
        price: dishB.price,
        ingredientsUsed: dishB.ingredients,
        itemStatus: "received",
        addedAt: admin.firestore.Timestamp.fromMillis(now - 5 * 60 * 1000),
      },
    ],
    totalAmount: dishA.price * 2 + dishB.price * 2,
  });
}

async function seed() {
  const restaurantRef = db.collection("restaurants").doc(RESTAURANT_ID);
  await restaurantRef.set({
    name: "CtrlChef",
    cuisine: "Indian multi-cuisine",
    address: "", // no real address yet — guest UI hides the line when empty
    serviceChargePct: 5,
    gstPct: 5,
    dishTags: ["Vegan", "Vegetarian", "High Protein", "High Carb", "Low Carb", "Gluten-Free", "Healthy", "Spicy"],
  });

  const ingredientsById = {};
  for (const ing of ingredients) {
    ingredientsById[ing.id] = ing;
    await restaurantRef.collection("ingredients").doc(ing.id).set({
      name: ing.name,
      unit: ing.unit,
      currentStock: ing.currentStock,
      lowStockThreshold: ing.lowStockThreshold,
      costPerUnit: ing.costPerUnit,
      lowStock: computeLowStock(ing),
      lastRestockedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const dishesById = {};
  for (const dish of dishes) {
    dishesById[dish.id] = dish;
    await restaurantRef.collection("dishes").doc(dish.id).set({
      name: dish.name,
      category: dish.category,
      price: dish.price,
      desc: dish.desc,
      veg: dish.veg,
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

  const staffUids = {}; // role -> uid, resolved here so seeded orders can set a real createdBy
  for (const person of staff) {
    // Recreate on every seed run so the login stays predictable — not
    // meant to be run against anything but the emulator (see the
    // FIRESTORE_EMULATOR_HOST guard above).
    const existing = await admin.auth().getUserByEmail(person.email).catch(() => null);
    const user =
      existing || (await admin.auth().createUser({ email: person.email, password: DEMO_PASSWORD, displayName: person.name }));

    staffUids[person.role] = user.uid;
    await restaurantRef.collection("staff").doc(user.uid).set({
      name: person.name,
      email: person.email,
      role: person.role,
      clockedIn: false,
    });
  }

  console.log(
    `Seeded ${ingredients.length} ingredients, ${dishes.length} dishes, ${tables.length} tables, and ${staff.length} staff logins into restaurants/${RESTAURANT_ID}`
  );
  console.log(`Staff password for all demo accounts: ${DEMO_PASSWORD}`);

  await seedOrderHistory({ restaurantRef, dishList: dishes, ingredientsById, staffUids, serviceChargePct: 5, gstPct: 5 });
  await seedLiveDemoState({ restaurantRef, dishesById, staffUids });
  console.log("Seeded 2 queue entries and one occupied table with an open order.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
