const VALID_DISCOUNT_TYPES = ["flat", "pct"];
const VALID_PAYMENT_METHODS = ["cash", "card", "upi"];

function validateDiscount(discount, subtotal) {
  if (discount == null) return;
  if (typeof discount !== "object") throw new Error("discount must be an object");
  const { type, value } = discount;
  if (!VALID_DISCOUNT_TYPES.includes(type)) {
    throw new Error(`discount.type must be one of ${VALID_DISCOUNT_TYPES.join(", ")}`);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("discount.value must be a non-negative number");
  }
  if (type === "pct" && value > 100) throw new Error("discount.value (pct) cannot exceed 100");
  if (type === "flat" && value > subtotal) throw new Error("discount.value (flat) cannot exceed subtotal");
}

// Discount applies to `subtotal` before service charge/GST are computed —
// tax on the discounted amount, the standard order. Nothing here rounds;
// stored values stay fractional, same convention order.totalAmount already
// uses — rounding only happens at display time (fmtINR) or inside the
// split calculator (src/lib/splitBill.js), which needs whole rupees.
function computeBill({ subtotal, discount, serviceChargePct, gstPct }) {
  validateDiscount(discount, subtotal);
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

module.exports = { computeBill, validateDiscount, VALID_DISCOUNT_TYPES, VALID_PAYMENT_METHODS };
