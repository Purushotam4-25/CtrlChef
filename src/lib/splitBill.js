// Client-only. Mirrors functions/lib/billing.js's tax formula for a live
// preview before closeOrder is called — the same duplication OrdersTab.jsx
// already has today, for the same reason (functions/ and src/ can't share
// code across the Cloud Functions/Vite boundary).
export function computeBillPreview({ subtotal, discount, serviceChargePct, gstPct }) {
  const discountType = discount ? discount.type : null;
  const discountValue = discount ? discount.value : 0;
  const discountAmount = !discount ? 0 : discountType === "flat" ? discountValue : (subtotal * discountValue) / 100;

  const taxableAmount = subtotal - discountAmount;
  const serviceChargePctSafe = serviceChargePct || 0;
  const gstPctSafe = gstPct || 0;
  const serviceCharge = (taxableAmount * serviceChargePctSafe) / 100;
  const gst = (taxableAmount * gstPctSafe) / 100;

  return {
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    taxableAmount,
    serviceChargePct: serviceChargePctSafe,
    serviceCharge,
    gstPct: gstPctSafe,
    gst,
    total: taxableAmount + serviceCharge + gst,
  };
}

// Hamilton's largest-remainder method: floor each weighted share, then hand
// the integer leftover to the highest-remainder entries (ties broken by
// lowest index, so the result is deterministic). Guarantees the shares sum
// EXACTLY to `amount` — no fractional-rupee drift from naive per-share
// rounding, which matters because these numbers are what people actually
// hand over in cash.
export function largestRemainderSplit(amount, weights) {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return largestRemainderSplit(amount, weights.map(() => 1));

  const raw = weights.map((w) => (amount * w) / totalWeight);
  const floors = raw.map(Math.floor);
  const remainders = raw.map((r, i) => r - floors[i]);
  const leftover = amount - floors.reduce((s, f) => s + f, 0);
  const order = remainders
    .map((_, i) => i)
    .sort((a, b) => remainders[b] - remainders[a] || a - b);

  const shares = [...floors];
  for (let k = 0; k < leftover; k++) shares[order[k]] += 1;
  return shares;
}

// Splits the whole bill evenly across `names`. Only `total` per person is
// guaranteed exact (see byItemSplit for why per-component breakdown isn't
// attempted) — this is a display-only calculator, nothing is settled
// against it.
export function evenSplit(bill, names) {
  const shares = largestRemainderSplit(Math.round(bill.total), names.map(() => 1));
  return names.map((name, i) => ({ name, total: shares[i] }));
}

// `assignments`: { [itemId]: { [personName]: unitsAssigned } }. Every
// item's assigned units must sum to that item's qty, or this throws — the
// caller (TableMap's split UI) should keep "confirm" disabled until it
// doesn't, rather than let this crash on a half-finished assignment.
//
// Deliberate simplification: only `total` per person is guaranteed exact
// (via the same largestRemainderSplit as evenSplit). `subtotal` per person
// is exact by construction (a plain sum of price*unitsAssigned). Per-person
// service charge/GST/discount are NOT independently broken out — reconciling
// several rounded components per person against both a per-component total
// and a per-person total is the classic apportionment paradox, and isn't
// worth it for a calculator nothing settles against. Each person's row is
// meant to show "your items: subtotal, your share of the bill: total" — two
// honest numbers, not five straining to reconcile.
export function byItemSplit(bill, items, assignments) {
  const names = [...new Set(items.flatMap((it) => Object.keys(assignments[it.itemId] || {})))];
  const subtotalByName = Object.fromEntries(names.map((n) => [n, 0]));

  for (const item of items) {
    const perItem = assignments[item.itemId] || {};
    const assignedUnits = Object.values(perItem).reduce((s, u) => s + u, 0);
    if (assignedUnits !== item.qty) {
      throw new Error(`item ${item.itemId}: assigned ${assignedUnits}, expected ${item.qty}`);
    }
    for (const [name, units] of Object.entries(perItem)) {
      subtotalByName[name] += item.price * units;
    }
  }

  const weights = names.map((n) => subtotalByName[n]);
  const totalShares = largestRemainderSplit(Math.round(bill.total), weights);
  return names.map((name, i) => ({ name, subtotal: subtotalByName[name], total: totalShares[i] }));
}
