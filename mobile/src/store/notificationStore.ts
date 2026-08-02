import { create } from 'zustand';

interface Notification {
  id: number;
  isRead: boolean;
  [key: string]: any;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: any) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification: any) => {
    set((state) => ({
      notifications: [{ ...notification, id: Date.now(), isRead: false }, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
