import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image, TouchableOpacity, TextInput } from 'react-native';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import Constants from 'expo-constants';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { useConfigStore } from '../../../store/configStore';
import { authApi } from '../api/authApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { getOrCreateDeviceId, getDeviceName } from '../../../utils/deviceId';
import { parseApiError } from '../../../utils/apiError';

export function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const login = useAuthStore((s: any) => s.login);
  const setPendingDevice = useAuthStore((s: any) => s.setPendingDevice);
  const setPendingLoginParams = useAuthStore((s: any) => s.setPendingLoginParams);
  const clearPendingDevice = useAuthStore((s: any) => s.clearPendingDevice);
  const { branchCode, clear: clearConfig, save: saveConfig } = useConfigStore();

  const [form, setForm] = useState<{ tenantSlug: string; username: string; password: string }>({
    tenantSlug: branchCode || '',
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const deviceIdRef = useRef<string>('');
  const deviceNameRef = useRef<string>('');
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    getOrCreateDeviceId().then((id) => {
      deviceIdRef.current = id;
      deviceNameRef.current = getDeviceName();
    });
  }, []);

  const mutation = useMutation({
    mutationFn: () => authApi.login({
      ...form,
      deviceId: deviceIdRef.current,
      deviceName: deviceNameRef.current,
      platform: Platform.OS,
    }),
    onSuccess: (data: any) => {
      if (form.tenantSlug.trim()) saveConfig(form.tenantSlug.trim());
      if (data.deviceStatus === 'approved') {
        login(data.user, data.tenant, data.accessToken, data.refreshToken);
      } else {
        setPendingDevice(data.deviceStatus, data.user, data.tenant);
        setPendingLoginParams({
          tenantSlug:  form.tenantSlug,
          username:    form.username,
          password:    form.password,
          deviceId:    deviceIdRef.current,
          deviceName:  deviceNameRef.current,
          platform:    Platform.OS,
        });
      }
    },
  });

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.tenantSlug.trim()) e.tenantSlug = t('auth.companyId') + ' is required';
    if (!form.username.trim()) e.username = t('auth.username') + ' is required';
    if (form.password.length < 6) e.password = t('auth.password') + ' must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = () => {
    if (!validate()) return;
    // Clear any leftover pending state from a previous login attempt
    clearPendingDevice();
    mutation.mutate();
  };

  const handleTitleLongPress = () => {
    setConfirmSheet({
      title: t('auth.resetConfig'),
      message: t('auth.resetConfigMsg'),
      confirmLabel: t('auth.reset'),
      destructive: true,
      icon: 'refresh-outline',
      onConfirm: () => clearConfig(),
    });
  };

  const apiError = parseApiError(mutation.error);

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onLongPress={handleTitleLongPress}
          delayLongPress={3000}
          activeOpacity={1}
          style={{ alignItems: 'center', marginBottom: theme.spacing.xxl }}
        >
          {theme.logoUrl ? (
            <Image
              source={{ uri: theme.logoUrl }}
              style={{ width: 80, height: 80, borderRadius: 12, marginBottom: theme.spacing.md }}
              resizeMode="contain"
            />
          ) : null}
          <Text style={[theme.typography.h1, { color: theme.colors.primary }]}>
            {theme.appName || t('auth.title')}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            {t('auth.subtitle')}
          </Text>
        </TouchableOpacity>

        <ErrorMessage message={apiError} />

        <AppInput
          label={t('auth.companyId')}
          value={form.tenantSlug}
          onChangeText={(v: string) => setForm((f) => ({ ...f, tenantSlug: v.toLowerCase() }))}
          placeholder={t('auth.companyIdPlaceholder')}
          error={errors.tenantSlug}
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
        />

        <AppInput
          ref={usernameRef}
          label={t('auth.username')}
          value={form.username}
          onChangeText={(v: string) => setForm((f) => ({ ...f, username: v.toLowerCase() }))}
          placeholder={t('auth.usernamePlaceholder')}
          error={errors.username}
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <AppInput
          ref={passwordRef}
          label={t('auth.password')}
          value={form.password}
          onChangeText={(v: string) => setForm((f) => ({ ...f, password: v }))}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          error={errors.password}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <AppButton
          title={t('auth.signIn')}
          onPress={handleLogin}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />

        <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontSize: 12, marginTop: theme.spacing.xl }}>
          {Constants.expoConfig?.version ?? '—'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
    <ConfirmSheet
      visible={!!confirmSheet}
      title={confirmSheet?.title ?? ''}
      message={confirmSheet?.message}
      confirmLabel={confirmSheet?.confirmLabel}
      destructive={confirmSheet?.destructive}
      icon={confirmSheet?.icon}
      onConfirm={() => { confirmSheet?.onConfirm(); setConfirmSheet(null); }}
      onClose={() => setConfirmSheet(null)}
    />
    </>
  );
}
