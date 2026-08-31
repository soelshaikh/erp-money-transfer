import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/toastConfig';
import { queryClient } from './src/api/queryClient';
import { TenantThemeProvider } from './src/theme/TenantThemeProvider';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* TenantThemeProvider reads from authStore (Zustand) — no prop drilling */}
          <TenantThemeProvider>
            <StatusBar style="auto" />
            <AppNavigator />
          </TenantThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}
