import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The hosting emulator serves /__/firebase/init.json with real project config —
// proxying it means the app never needs its own copy of the Firebase config.
export default defineConfig({
  plugins: [react()],
  // top-level await in src/firebase.js needs this
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        // The Firebase SDK is most of the 907kB single-chunk bundle — its
        // own chunk means it's cached separately from app code that changes
        // far more often, so a normal deploy doesn't force everyone to
        // re-download it.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"],
        },
      },
    },
  },
  esbuild: { target: "esnext" },
  server: {
    proxy: {
      "/__/firebase": "http://127.0.0.1:5000",
    },
  },
});
