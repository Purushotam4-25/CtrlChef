import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, RESTAURANT_ID } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = not resolved yet, null = signed out
  const [staffByUid, setStaffByUid] = useState({}); // uid -> staff doc | null, once resolved

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    const staffRef = doc(db, "restaurants", RESTAURANT_ID, "staff", user.uid);
    return onSnapshot(staffRef, (snap) => {
      setStaffByUid((prev) => ({ ...prev, [user.uid]: snap.exists() ? { id: snap.id, ...snap.data() } : null }));
    });
  }, [user]);

  // Keyed by uid (rather than a separate "loading" flag set in an effect) so
  // there's no render where a just-signed-in user momentarily reads as
  // "resolved, no staff doc" before its fetch has actually run.
  const staffResolved = !user || user.uid in staffByUid;
  const staff = user ? staffByUid[user.uid] ?? null : null;

  const value = {
    user,
    staff,
    role: staff?.role || null,
    loading: user === undefined || !staffResolved,
    emailVerified: !!user?.emailVerified,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signUp: async (email, password) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      return cred.user;
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
