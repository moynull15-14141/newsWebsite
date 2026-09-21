import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

export const ToastContext = createContext<ToastApi>({ show: () => undefined });

/** Non-blocking feedback. Outside a ToastProvider it is a no-op, so components stay usable in isolation. */
export const useToast = () => useContext(ToastContext);
