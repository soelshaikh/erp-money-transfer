import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { storage } from '../../utils/storage';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { queryClient } from '../../api/queryClient';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
const DEVICE_ID_KEY = 'app_device_id';

export function useSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const { user, tenant, isAuthenticated, logout } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const connect = async () => {
      const [token, deviceId] = await Promise.all([
        storage.getItemAsync('accessToken'),
        storage.getItemAsync(DEVICE_ID_KEY),
      ]);

      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          tenantId: tenant?._id,
          userId: user._id,
          role: user.role,
          branchId: user.branchId || null,
          deviceId: deviceId || null,
        },
        extraHeaders: { Authorization: `Bearer ${token}` },
      });

      socketRef.current.on('connect', () => {
        queryClient.invalidateQueries();
      });

      socketRef.current.on('notification', (payload: any) => {
        addNotification(payload);
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      });

      socketRef.current.on('force_logout', () => {
        logout();
        Alert.alert('Session Ended', 'Your session was ended by an administrator.');
      });

      socketRef.current.on('connect_error', (err: Error) => {
        console.warn('[Socket] connect error', err.message);
      });
    };

    connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?._id]);
}
