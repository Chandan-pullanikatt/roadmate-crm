import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNotificationStore = create(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => set((state) => {
        const newNotification = {
          id: Date.now(),
          timestamp: new Date(),
          read: false,
          ...notification
        };
        return {
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
          unreadCount: state.unreadCount + 1
        };
      }),

      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id)?.read ? 0 : 1))
      })),

      markAllRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      })),

      clearAll: () => set({
        notifications: [],
        unreadCount: 0
      })
    }),
    {
      name: 'roadmate-notifications'
    }
  )
);
