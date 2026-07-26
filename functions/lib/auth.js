const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/https");

// Shared role lists, waiters handle order/table actions, managers can do anything a waiter can
const WAITER_OR_MANAGER = ["waiter", "manager"];
// A kitchen refusing an item it cannot cook is a real workflow, so chefs get
// the same cancel power as waiters/managers — used by cancelOrderItem only.
const KITCHEN_OR_SERVICE = ["waiter", "chef", "manager"];

// Confirms the caller is signed in and holds one of the given roles on
// restaurants/{restaurantId}/staff/{uid}, staff doc IDs are expected to
// equal the caller's Firebase Auth uid. Throws HttpsError otherwise.
async function requireStaffRole(request, restaurantId, allowedRoles) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }

  const staffSnap = await getFirestore()
    .collection("restaurants")
    .doc(restaurantId)
    .collection("staff")
    .doc(request.auth.uid)
    .get();

  if (!staffSnap.exists || !allowedRoles.includes(staffSnap.data().role)) {
    throw new HttpsError("permission-denied", `Requires one of: ${allowedRoles.join(", ")}`);
  }

  return staffSnap.data();
}

module.exports = { requireStaffRole, WAITER_OR_MANAGER, KITCHEN_OR_SERVICE };
