const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/https");

// Shared role lists, waiters handle order/table actions, managers can do anything a waiter can
const WAITER_OR_MANAGER = ["waiter", "manager"];
// A kitchen refusing an item it cannot cook is a real workflow, so chefs get
// the same cancel power as waiters/managers — used by cancelOrderItem only.
const KITCHEN_OR_SERVICE = ["waiter", "chef", "manager"];

// Module-scope, so it only helps repeat calls hitting the same warm
// instance — a role change (or removal) can take up to this long to take
// effect on calls already in flight to that instance. Fine at demo scale;
// see plans/11.
const ROLE_CACHE_TTL_MS = 30000;
const roleCache = new Map(); // `${restaurantId}:${uid}` -> { staff, expiresAt }

// Confirms the caller is signed in and holds one of the given roles on
// restaurants/{restaurantId}/staff/{uid}, staff doc IDs are expected to
// equal the caller's Firebase Auth uid. Throws HttpsError otherwise.
async function requireStaffRole(request, restaurantId, allowedRoles) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }

  const cacheKey = `${restaurantId}:${request.auth.uid}`;
  const cached = roleCache.get(cacheKey);
  let staff;
  if (cached && cached.expiresAt > Date.now()) {
    staff = cached.staff;
  } else {
    const staffSnap = await getFirestore()
      .collection("restaurants")
      .doc(restaurantId)
      .collection("staff")
      .doc(request.auth.uid)
      .get();
    staff = staffSnap.exists ? staffSnap.data() : null;
    roleCache.set(cacheKey, { staff, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  }

  if (!staff || !allowedRoles.includes(staff.role)) {
    throw new HttpsError("permission-denied", `Requires one of: ${allowedRoles.join(", ")}`);
  }

  return staff;
}

module.exports = { requireStaffRole, WAITER_OR_MANAGER, KITCHEN_OR_SERVICE };
