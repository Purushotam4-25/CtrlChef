import { createContext, useContext, useState } from "react";
import { OPS_THEME } from "../opsTheme";
import { GUEST_THEME } from "../guestTheme";

// Same light/dark-toggle shape for both surfaces — just different token
// sets and their own localStorage key, so a staff member's preference and a
// guest's preference never leak into each other.
function makeThemeContext({ storageKey, defaultMode }) {
  const Context = createContext(null);

  function Provider({ themes, children }) {
    const [mode, setMode] = useState(() => localStorage.getItem(storageKey) || defaultMode);

    function setTheme(next) {
      localStorage.setItem(storageKey, next);
      setMode(next);
    }

    return <Context.Provider value={{ mode, setTheme, T: themes[mode] }}>{children}</Context.Provider>;
  }

  return { Provider, useTheme: () => useContext(Context) };
}

const ops = makeThemeContext({ storageKey: "ctrlchef-ops-theme", defaultMode: "dark" });
export function ThemeProvider({ children }) {
  return <ops.Provider themes={OPS_THEME}>{children}</ops.Provider>;
}
export const useOpsTheme = ops.useTheme;

const guest = makeThemeContext({ storageKey: "ctrlchef-guest-theme", defaultMode: "light" });
export function GuestThemeProvider({ children }) {
  return <guest.Provider themes={GUEST_THEME}>{children}</guest.Provider>;
}
export const useGuestTheme = guest.useTheme;
