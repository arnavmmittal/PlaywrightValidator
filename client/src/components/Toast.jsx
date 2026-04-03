import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: 'bg-[#4ECDC4]/10',
    border: 'border-[#4ECDC4]/40',
    text: 'text-[#4ECDC4]',
  },
  error: {
    icon: XCircle,
    bg: 'bg-[#FF2D2D]/10',
    border: 'border-[#FF2D2D]/40',
    text: 'text-[#FF2D2D]',
  },
  info: {
    icon: Info,
    bg: 'bg-[#E8FF47]/10',
    border: 'border-[#E8FF47]/40',
    text: 'text-[#E8FF47]',
  },
};

/**
 * Single toast notification.
 * @param {{ message: string, type: 'success'|'error'|'info', onClose: () => void }} props
 */
function ToastItem({ message, type = 'info', onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in on next frame
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        ${config.bg} ${config.border}
        transition-all duration-300 ease-out
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
    >
      <Icon size={18} className={config.text} />
      <span className="text-sm text-white flex-1">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="text-[#7B8794] hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Toast container -- renders a list of toasts in the bottom-right corner.
 * @param {{ toasts: Array<{ id: string|number, message: string, type: string }>, removeToast: (id: string|number) => void }} props
 */
export function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Hook for managing toast state. Returns [toasts, addToast, removeToast].
 */
let toastCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return [toasts, addToast, removeToast];
}
