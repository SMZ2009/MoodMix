import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';

const InteractionContext = createContext(null);

export const useInteraction = () => {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteraction must be used within an InteractionProvider');
  }
  return context;
};

export const InteractionProvider = ({ children }) => {
  const [activeElement, setActiveElement] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, duration = 2000, type = 'default') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({ message, type, visible: true });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
      setTimeout(() => setToast(null), 300);
    }, duration);
  }, []);

  const triggerHaptic = useCallback((type = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [40],
        success: [10, 50, 10],
        warning: [30, 50, 30],
        error: [50, 50, 50]
      };
      navigator.vibrate(patterns[type] || patterns.light);
    }
  }, []);

  const setActive = useCallback((elementId) => {
    setActiveElement(elementId);
  }, []);

  const clearActive = useCallback(() => {
    setActiveElement(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        clearActive();
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
          setToast(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearActive]);

  const value = {
    activeElement,
    setActive,
    clearActive,
    toast,
    showToast,
    triggerHaptic
  };

  return (
    <InteractionContext.Provider value={value}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '12px 24px',
            background: toast.type === 'success' ? '#10B981' 
              : toast.type === 'error' ? '#EF4444'
              : toast.type === 'warning' ? '#F59E0B'
              : 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(8px)',
            opacity: toast.visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            maxWidth: '80vw'
          }}
        >
          {toast.message}
        </div>
      )}
    </InteractionContext.Provider>
  );
};

export default InteractionContext;
