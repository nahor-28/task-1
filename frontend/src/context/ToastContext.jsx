import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const STYLES = {
  success: 'alert-success',
  error: 'alert-error',
};

const ICONS = {
  success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast toast-end toast-top z-50">
        {toasts.map((t) => (
          <div key={t.id} role="alert" className={`alert ${STYLES[t.type]} shadow-lg animate-toast-in`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[t.type]} />
            </svg>
            <span className="text-sm">{t.message}</span>
            <button onClick={() => remove(t.id)} className="btn btn-ghost btn-xs btn-circle" aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
