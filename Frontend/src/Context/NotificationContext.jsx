import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

const NotificationContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = 'info', timeout = 3500, options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setNotifications((prev) => [...prev, { id, message, type, position: 'center' }]);

      if (timeout > 0) {
        setTimeout(() => dismissNotification(id), timeout);
      }

      return id;
    },
    [dismissNotification]
  );

  const value = useMemo(
    () => ({
      notify,
      dismissNotification,
    }),
    [notify, dismissNotification]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-110 flex justify-center p-4">
        <div className="flex w-full max-w-md flex-col gap-2">
          {notifications.map((notification) => {
            const Icon = ICONS[notification.type] || ICONS.info;
            const style = STYLES[notification.type] || STYLES.info;

            return (
              <div key={notification.id} className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-md ${style}`}>
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="flex-1 text-sm">{notification.message}</p>
                  <button
                    type="button"
                    onClick={() => dismissNotification(notification.id)}
                    className="rounded p-0.5 opacity-70 hover:opacity-100"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }

  return context;
};
