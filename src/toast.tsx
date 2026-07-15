import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useState } from "preact/hooks";

interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "error";
}

type ShowToast = (message: string, kind?: "info" | "error") => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback<ShowToast>((message, kind = "info") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div class="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={`toast ${t.kind === "error" ? "toast--error" : ""}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
