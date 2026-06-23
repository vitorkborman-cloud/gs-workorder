"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const colors: Record<ToastType, string> = {
    success: "bg-[#80b02d] text-white",
    error: "bg-red-500 text-white",
    info: "bg-[#391e2a] text-white",
  };

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "i",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${colors[t.type]} flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold max-w-sm w-full animate-in slide-in-from-top-4 duration-300`}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black shrink-0">
              {icons[t.type]}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
