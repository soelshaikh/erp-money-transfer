import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';
import { useLangStore } from '../store/langStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { NotesScreen } from '../features/notes/screens/NotesScreen';
import { PendingDeviceScreen } from '../features/auth/screens/PendingDeviceScreen';
import { LoadingScreen } from '../shared/components/LoadingScreen';
import { useSocket } from '../shared/hooks/useSocket';
import '../i18n';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getOrCreateDeviceId, getDeviceName } from '../utils/deviceId';
import { apiClient } from '../api/client';

function SocketManager() {
  useSocket();
  return null;
}

/**
 * Root navigator — the ONLY place where routing decisions based on state live.
 *
 * Decision tree:
 *   loading                → LoadingScreen
 *   !isConfigured          → NotesScreen  (user must enter branch code first)
 *   pendingDeviceInfo      → PendingDeviceScreen (device awaiting approval / suspended / rejected)
 *   isAuthenticated        → MainNavigator
 *   else                   → AuthNavigator (Login)
 */
export function AppNavigator() {
  const { isAuthenticated, isLoading: authLoading, finishLoading, pendingDeviceInfo } = useAuthStore();
  const { isConfigured, isLoading: configLoading, load: loadConfig } = useConfigStore();
  const loadLang = useLangStore((s) => s.load);

  useEffect(() => {
    loadConfig();
    finishLoading();
    loadLang();
    getOrCreateDeviceId().catch(() => {}); // generate UUID immediately on first launch
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    (async () => {
      try {
        const alreadyTracked = await SecureStore.getItemAsync('app_install_tracked');
        if (alreadyTracked) return;
        const deviceId = await getOrCreateDeviceId();
        const deviceName = getDeviceName();
        await apiClient.post('/app-install', {
          deviceId,
          deviceName,
          platform: Platform.OS,
          appVersion: null,
        });
        await SecureStore.setItemAsync('app_install_tracked', '1');
      } catch {
        // fire-and-forget — silently ignore errors
      }
    })();
  }, [isConfigured]);

  if (authLoading || configLoading) {
    return <LoadingScreen message="Starting up..." />;
  }

  if (!isConfigured) {
    return <NotesScreen />;
  }

  if (pendingDeviceInfo) {
    return <PendingDeviceScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <>
          <SocketManager />
          <MainNavigator />
        </>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
