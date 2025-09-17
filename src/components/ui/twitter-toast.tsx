import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TwitterToast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

interface TwitterToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

const TwitterToastContext = createContext<TwitterToastContextType | null>(null);

export function useTwitterToast() {
  const context = useContext(TwitterToastContext);
  if (!context) {
    throw new Error('useTwitterToast must be used within TwitterToastProvider');
  }
  return context;
}

interface TwitterToastProviderProps {
  children: React.ReactNode;
}

export function TwitterToastProvider({ children }: TwitterToastProviderProps) {
  const [toasts, setToasts] = useState<TwitterToast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) => {
    const id = Date.now().toString();
    const newToast: TwitterToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <TwitterToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all duration-300 ease-in-out animate-in slide-in-from-top-2 fade-in-0",
              "max-w-sm text-center",
              {
                'bg-green-500 text-white': toast.type === 'success',
                'bg-red-500 text-white': toast.type === 'error', 
                'bg-blue-500 text-white': toast.type === 'info',
              }
            )}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </TwitterToastContext.Provider>
  );
}