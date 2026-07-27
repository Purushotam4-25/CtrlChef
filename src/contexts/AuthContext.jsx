import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db, RESTAURANT_ID } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = not resolved yet, null = signed out
  const [staffByUid, setStaffByUid] = useState({}); // uid -> staff doc | null, once resolved
  const [memberByUid, setMemberByUid] = useState({}); // uid -> member doc | null, once resolved
  const provisioning = useRef(new Set()); // uids currently mid-write, guards against a duplicate create while the snapshot round-trips

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    const staffRef = doc(db, "restaurants", RESTAURANT_ID, "staff", user.uid);
    return onSnapshot(
      staffRef,
      (snap) => {
        setStaffByUid((prev) => ({ ...prev, [user.uid]: snap.exists() ? { id: snap.id, ...snap.data() } : null }));
      },
      // Rules deny reading a staff doc that doesn't exist (the isStaff() check
      // does a get() on it), so a signed-in account with no staff doc errors
      // here instead of just returning "not found". Without this, staffByUid
      // never resolves for that uid and the app spins on "Loading…" forever —
      // treat it the same as "no staff doc" so the explicit message shows.
      () => setStaffByUid((prev) => ({ ...prev, [user.uid]: null }))
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const memberRef = doc(db, "restaurants", RESTAURANT_ID, "members", user.uid);
    return onSnapshot(
      memberRef,
      (snap) => {
        setMemberByUid((prev) => ({ ...prev, [user.uid]: snap.exists() ? { id: snap.id, ...snap.data() } : null }));
      },
      // Same reasoning as the staff listener above — resolve to "no member
      // doc" rather than leaving memberByUid unresolved forever.
      () => setMemberByUid((prev) => ({ ...prev, [user.uid]: null }))
    );
  }, [user]);

  // Keyed by uid (rather than a separate "loading" flag set in an effect) so
  // there's no render where a just-signed-in user momentarily reads as
  // "resolved, nothing found" before its fetch has actually run.
  const staffResolved = !user || user.uid in staffByUid;
  const memberResolved = !user || user.uid in memberByUid;
  const staff = user ? staffByUid[user.uid] ?? null : null;
  const member = user ? memberByUid[user.uid] ?? null : null;

  // Anyone signed in who's neither staff nor already a member becomes a
  // member automatically — there's no separate "request access" step on the
  // guest side, and firestore.rules already permits exactly this write
  // (create/update your own members/{memberId}, nothing else). signUpMember
  // below writes this doc itself right after account creation (with the
  // name from the signup form), so in practice this effect only ever fires
  // as a fallback for a signed-in account that reached the app some other
  // way with no doc yet.
  useEffect(() => {
    if (!user || !staffResolved || !memberResolved) return;
    if (staff || member) return;
    if (provisioning.current.has(user.uid)) return;
    provisioning.current.add(user.uid);
    setDoc(doc(db, "restaurants", RESTAURANT_ID, "members", user.uid), {
      name: user.displayName || user.email || "Member",
      email: user.email || "",
    }).finally(() => provisioning.current.delete(user.uid));
  }, [user, staff, member, staffResolved, memberResolved]);

  const accountType = staff ? "staff" : member ? "member" : null;

  const value = {
    user,
    staff,
    member,
    role: staff?.role || null,
    accountType, // "staff" | "member" | null
    loading: user === undefined || !staffResolved || !memberResolved,
    emailVerified: !!user?.emailVerified,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signUp: async (email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      return cred.user;
    },
    // Member self-signup — staff accounts are still manager-provisioned only
    // (createStaffMember). Writes the member doc itself with the real name
    // instead of relying on the fallback effect above, which cannot see a
    // freshly-set displayName until the next auth-state event.
    signUpMember: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged can fire as soon as the account exists, before
      // the writes below finish — without this guard the fallback effect
      // above can race in first and stamp the generic fallback name instead
      // of the one entered here.
      provisioning.current.add(cred.user.uid);
      try {
        if (name) await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "restaurants", RESTAURANT_ID, "members", cred.user.uid), { name: name || email, email });
      } finally {
        provisioning.current.delete(cred.user.uid);
      }
      return cred;
    },
    resendVerification: () => sendEmailVerification(auth.currentUser),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => fbSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
