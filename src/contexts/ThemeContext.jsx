import { createContext, useContext, useState } from "react";
import { OPS_THEME } from "../opsTheme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("ctrlchef-theme") || "dark");

  function setTheme(next) {
    localStorage.setItem("ctrlchef-theme", next);
    setMode(next);
  }

  return (
    <ThemeContext.Provider value={{ mode, setTheme, T: OPS_THEME[mode] }}>{children}</ThemeContext.Provider>
  );
}

export function useOpsTheme() {
  return useContext(ThemeContext);
}
