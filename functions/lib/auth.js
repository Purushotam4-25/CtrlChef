const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/https");

// Confirms the caller is signed in and holds one of the given roles on
// restaurants/{restaurantId}/staff/{uid} — staff doc IDs are expected to
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

module.exports = { requireStaffRole };
