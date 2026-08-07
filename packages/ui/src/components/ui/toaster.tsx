'use client';

import * as React from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = {
  id: string;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'info';
  autoClose?: number | boolean;
  onClose?: () => void;
  // Spread onto the Radix Toast root; the reducer and toast() both set these.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type Toast = Omit<ToasterToast, 'id'>;

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: string;
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case 'DISMISS_TOAST':
      const { toastId } = action;
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };

    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type ToastWithId = Toast & { id: string };

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: Toast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });

  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({
        id,
        title,
        description,
        action,
        variant = 'default',
        icon,
        ...props
      }) => {
        let toastIcon = icon;
        if (!toastIcon) {
          switch (variant) {
            case 'destructive':
              toastIcon = <X className="h-4 w-4" />;
              break;
            case 'success':
              toastIcon = <Check className="h-4 w-4" />;
              break;
            case 'info':
              toastIcon = <Info className="h-4 w-4" />;
              break;
            default:
              toastIcon = null;
          }
        }

        return (
          <Toast
            key={id}
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className="group"
            {...props}
          >
            <div className="flex items-start">
              {toastIcon && (
                <div className="mr-3 flex-shrink-0">
                  {toastIcon}
                </div>
              )}
              <div className="flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action && (
                <ToastAction altText={action.label} onClick={action.onClick}>
                  {action.label}
                </ToastAction>
              )}
              <ToastClose />
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

// Export the toast function for direct usage
declare global {
  interface Window {
    toast: typeof toast;
  }
}

// Add toast to window for direct usage in the browser
if (typeof window !== 'undefined') {
  window.toast = toast;
}

export { Toaster, useToast, toast };
