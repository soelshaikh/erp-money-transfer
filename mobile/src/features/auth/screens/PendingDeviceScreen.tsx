import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { authApi } from '../api/authApi';
import { withAlpha } from '../../../utils/colors';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type StatusConfig = { icon: any; iconColor: string; title: string; body: string; hint: string };

export function PendingDeviceScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pendingDeviceInfo = useAuthStore((s: any) => s.pendingDeviceInfo);
  const pendingLoginParams = useAuthStore((s: any) => s.pendingLoginParams);
  const clearPendingDevice = useAuthStore((s: any) => s.clearPendingDevice);
  const setPendingDevice = useAuthStore((s: any) => s.setPendingDevice);
  const login = useAuthStore((s: any) => s.login);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);

  const STATUS_CONFIG: Record<string, StatusConfig> = {
    pending: {
      icon: 'time-outline',
      iconColor: '#F59E0B',
      title: t('pending.pendingTitle'),
      body: t('pending.pendingBody'),
      hint: t('pending.pendingHint'),
    },
    suspended: {
      icon: 'ban-outline',
      iconColor: '#EF4444',
      title: t('pending.suspendedTitle'),
      body: t('pending.suspendedBody'),
      hint: t('pending.suspendedHint'),
    },
    rejected: {
      icon: 'close-circle-outline',
      iconColor: '#EF4444',
      title: t('pending.rejectedTitle'),
      body: t('pending.rejectedBody'),
      hint: t('pending.rejectedHint'),
    },
    blocked: {
      icon: 'lock-closed-outline',
      iconColor: '#EF4444',
      title: t('pending.blockedTitle'),
      body: t('pending.blockedBody'),
      hint: t('pending.blockedHint'),
    },
    expired: {
      icon: 'hourglass-outline',
      iconColor: '#6B7280',
      title: t('pending.expiredTitle'),
      body: t('pending.expiredBody'),
      hint: t('pending.expiredHint'),
    },
  };

  const status = pendingDeviceInfo?.deviceStatus || 'pending';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const userName = pendingDeviceInfo?.user?.name || '';
  const tenantName = pendingDeviceInfo?.tenant?.name || '';

  // Poll the login endpoint every 10 seconds while status is 'pending'.
  // When approved the server returns tokens and we auto-login.
  // When rejected/suspended we update the card status and stop polling.
  useEffect(() => {
    if (status !== 'pending' || !pendingLoginParams) return;

    pollStartedAtRef.current = Date.now();

    const poll = async () => {
      // Stop polling if the request has been pending too long
      if (Date.now() - pollStartedAtRef.current > MAX_POLL_DURATION_MS) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPendingDevice('expired', pendingDeviceInfo?.user, pendingDeviceInfo?.tenant);
        return;
      }
      try {
        const data = await authApi.login(pendingLoginParams);
        if (data.deviceStatus === 'approved' && data.accessToken) {
          login(data.user, data.tenant, data.accessToken, data.refreshToken);
        } else if (data.deviceStatus === 'rejected' || data.deviceStatus === 'suspended') {
          setPendingDevice(data.deviceStatus, data.user, data.tenant);
        }
      } catch {
        // network error — will retry on next tick
      }
    };

    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, pendingLoginParams]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xxl }}>
          <Text style={[theme.typography.h2, { color: theme.colors.primary }]}>
            {tenantName || t('auth.title')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {t('auth.subtitle')}
          </Text>
        </View>

        {/* Status card */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.xl,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: theme.spacing.lg,
        }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: withAlpha(config.iconColor, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.lg,
          }}>
            <Ionicons name={config.icon} size={36} color={config.iconColor} />
          </View>

          <Text style={[theme.typography.h2, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.sm }]}>
            {config.title}
          </Text>

          {userName ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
              {t('pending.loggedInAs')} {userName}
            </Text>
          ) : null}

          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
            {config.body}
          </Text>

          {/* Auto-check indicator — only when still pending */}
          {status === 'pending' && pendingLoginParams ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg, gap: theme.spacing.xs }}>
              <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {t('pending.checkingApproval')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Hint */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: withAlpha(theme.colors.primary, 0.06),
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.xl,
          gap: theme.spacing.sm,
        }}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} style={{ marginTop: 1 }} />
          <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 1, lineHeight: 20 }]}>
            {config.hint}
          </Text>
        </View>

        {/* Back to login */}
        <TouchableOpacity
          onPress={clearPendingDevice}
          style={{
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}
          activeOpacity={0.7}
        >
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
            {t('pending.backToLogin')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
