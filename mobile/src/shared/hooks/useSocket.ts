import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { storage } from '../../utils/storage';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { queryClient } from '../../api/queryClient';

const DEVICE_ID_KEY = 'app_device_id';

// After this many failed reconnects (~17s with default backoff), treat the server as down.
const RECONNECTION_ATTEMPTS = 5;

export function useSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const { user, tenant, isAuthenticated, forceLogout } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const connect = async () => {
      const [token, deviceId, tenantApiUrl] = await Promise.all([
        storage.getItemAsync('accessToken'),
        storage.getItemAsync(DEVICE_ID_KEY),
        storage.getItemAsync('tenant_api_url'),
      ]);

      // Use the company's dedicated backend URL, fall back to the central server.
      // Guard against a corrupted stored value (e.g. the literal string "undefined").
      const resolvedApi = (tenantApiUrl && tenantApiUrl.startsWith('http'))
        ? tenantApiUrl
        : (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1');
      const socketUrl = resolvedApi.replace('/api/v1', '');

      socketRef.current = io(socketUrl, {
        transports: ['websocket'],
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
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

      // Fired by the server when an admin ends a session manually
      socketRef.current.on('force_logout', () => {
        forceLogout('account_disabled');
      });

      // All reconnection attempts exhausted — server is unreachable or shut down
      socketRef.current.on('reconnect_failed', () => {
        forceLogout('server_down');
      });
    };

    connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?._id]);
}
