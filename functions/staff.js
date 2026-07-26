const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { onCall, HttpsError } = require("firebase-functions/https");
const { requireStaffRole } = require("./lib/auth");

const db = getFirestore();

// Manager-only hire flow. Needs the Admin SDK to create the Auth user, then
// pairs it with a staff doc keyed by that uid — same shape seed.js already
// uses for demo logins. No email/OTP invite flow exists yet, so the manager
// sets the password directly in the form, same as the seed script does.
// Role change and removal need no callable — firestore.rules already lets a
// manager update/delete any staff doc directly.
exports.createStaffMember = onCall(async (request) => {
  const { restaurantId, name, email, password, role } = request.data;

  if (
    !restaurantId ||
    !name ||
    typeof name !== "string" ||
    !email ||
    typeof email !== "string" ||
    !password ||
    typeof password !== "string" ||
    password.length < 6 ||
    !["waiter", "chef", "manager"].includes(role)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "name, email, a password of at least 6 characters, and role (waiter/chef/manager) are required"
    );
  }

  await requireStaffRole(request, restaurantId, ["manager"]);

  const user = await getAuth()
    .createUser({ email, password, displayName: name })
    .catch((err) => {
      throw new HttpsError("already-exists", err.message || "Couldn't create that account");
    });

  await db.collection("restaurants").doc(restaurantId).collection("staff").doc(user.uid).set({
    name,
    email,
    role,
    clockedIn: false,
  });

  return { staffId: user.uid };
});
