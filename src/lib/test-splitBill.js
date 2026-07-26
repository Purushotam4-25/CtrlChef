// Plain-node self-check for the split-allocation math — no framework, same
// hand-rolled style as functions/test-*.js. Run: node src/lib/test-splitBill.js
import { byItemSplit, evenSplit, largestRemainderSplit } from "./splitBill.js";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

test("largestRemainderSplit sums exactly to the amount for an odd total", () => {
  const shares = largestRemainderSplit(1001, [1, 1, 1]);
  assertEqual(shares.reduce((s, n) => s + n, 0), 1001, "sum of shares");
  assertEqual(shares.every((n) => Number.isInteger(n)), true, "all shares are whole numbers");
});

test("evenSplit of an odd total across 3 people sums exactly", () => {
  const bill = { total: 1001 };
  const rows = evenSplit(bill, ["Alice", "Bob", "Cara"]);
  assertEqual(rows.reduce((s, r) => s + r.total, 0), 1001, "sum of per-person totals");
});

test("byItemSplit with a shared multi-qty item sums exactly to the persisted total", () => {
  const bill = { total: 997 }; // deliberately not evenly divisible
  const items = [
    { itemId: "a", price: 100, qty: 1 },
    { itemId: "b", price: 50, qty: 3 }, // shared 3-ways, 1 unit each
  ];
  const assignments = {
    a: { Alice: 1 },
    b: { Alice: 1, Bob: 1, Cara: 1 },
  };
  const rows = byItemSplit(bill, items, assignments);
  assertEqual(rows.reduce((s, r) => s + r.total, 0), 997, "sum of per-person totals");
  assertEqual(rows.reduce((s, r) => s + r.subtotal, 0), 250, "sum of per-person item subtotals (100 + 50*3)");
});

test("byItemSplit throws when an item's assigned units don't match its qty", () => {
  const bill = { total: 100 };
  const items = [{ itemId: "a", price: 100, qty: 2 }];
  const assignments = { a: { Alice: 1 } }; // only 1 of 2 units assigned
  let threw = false;
  try {
    byItemSplit(bill, items, assignments);
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "byItemSplit should throw on a mis-assigned item");
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
