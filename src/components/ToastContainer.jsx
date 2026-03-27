import { X } from 'lucide-react';
import useStore from '../store/useStore';

export default function ToastContainer() {
  const toasts = useStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
