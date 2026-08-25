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
import { getOrCreateDeviceId } from '../utils/deviceId';

function SocketManager() {
  useSocket();
  return null;
}

/**
 * Root navigator — the ONLY place where routing decisions based on state live.
 *
 * Decision tree:
 *   loading                           → LoadingScreen
 *   !isDeviceApproved                 → NotesScreen (secret code gate mode)
 *   isDeviceApproved && !isConfigured → NotesScreen (company slug mode — existing behaviour)
 *   pendingDeviceInfo                 → PendingDeviceScreen (login-level device approval)
 *   isAuthenticated                   → MainNavigator
 *   else                              → AuthNavigator (Login)
 */
export function AppNavigator() {
  const { isAuthenticated, isLoading: authLoading, finishLoading, pendingDeviceInfo, isSignedOff, loadSignOffState } = useAuthStore();
  const { isConfigured, isDeviceApproved, isLoading: configLoading, load: loadConfig } = useConfigStore();
  const loadLang = useLangStore((s) => s.load);

  useEffect(() => {
    loadConfig();
    finishLoading();
    loadLang();
    loadSignOffState();
    getOrCreateDeviceId().catch(() => {});
  }, []);

  if (authLoading || configLoading) {
    return <LoadingScreen message="Starting up..." />;
  }

  // Device not yet approved — show secret code gate (NotesScreen handles the mode internally)
  if (!isDeviceApproved) {
    return <NotesScreen />;
  }

  // Device approved but company slug not yet configured — show slug entry (existing NotesScreen behaviour)
  if (!isConfigured) {
    return <NotesScreen />;
  }

  // Staff has signed off for today — show NotesScreen in sign-off mode
  if (isSignedOff) {
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
