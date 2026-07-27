import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Toast } from "../components/ops/primitives";

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 6000;

// Stack bottom-right, auto-dismiss, click to dismiss early — a useState
// array and a map, nothing fancier. No history/notification centre, the
// trigger table doesn't need one.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({ kind = "info", title, body }) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, kind, title, body }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
