import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The hosting emulator serves /__/firebase/init.json with real project config —
// proxying it means the app never needs its own copy of the Firebase config.
export default defineConfig({
  plugins: [react()],
  // top-level await in src/firebase.js needs this
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
  server: {
    proxy: {
      "/__/firebase": "http://127.0.0.1:5000",
    },
  },
});
