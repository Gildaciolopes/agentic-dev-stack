"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { IslandToast } from "@/components/fluid/island-toast/IslandToast";

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

/** `const toast = useToast(); toast.show("Install complete")`. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const VISIBLE_MS = 2800;

/** Hosts the single IslandToast for the whole site. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((next: string) => {
    clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-2 z-[70] flex justify-center">
        <IslandToast message={message} />
      </div>
    </ToastContext.Provider>
  );
}
