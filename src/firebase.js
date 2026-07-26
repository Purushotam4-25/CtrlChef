import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// The hosting emulator (proxied by vite.config.js in dev, served for real in
// prod) hands back the project's actual config — no copy of it needs to live
// in this repo.
const config = await fetch("/__/firebase/init.json").then((res) => res.json());

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
if (isLocalhost) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// Single hardcoded tenant for the demo — see the spec's multi-tenant note.
export const RESTAURANT_ID = "demo-restaurant-1";
