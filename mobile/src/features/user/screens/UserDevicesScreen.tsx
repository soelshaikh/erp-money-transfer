import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { showToast } from '../../../utils/toast';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { userApi } from '../api/userApi';
import { tenantApi } from '../../tenant/api/tenantApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { EmptyState } from '../../../shared/components/EmptyState';
import { AppButton } from '../../../shared/components/AppButton';
import { parseApiError } from '../../../utils/apiError';
import { fmtDateTime } from '../../../utils/fmt';
import { useTranslation } from 'react-i18next';

interface Props {
  route: any;
}

export function UserDevicesScreen({ route }: Props) {
  const { userId, userName, crossTenantId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const queryKey = ['user-devices', userId, crossTenantId ?? null];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: crossTenantId
      ? () => tenantApi.listUserDevices(crossTenantId, userId)
      : () => userApi.listDevices(userId),
  });

  const removeMutation = useMutation({
    mutationFn: (deviceId: string) => crossTenantId
      ? tenantApi.removeUserDevice(crossTenantId, userId, deviceId)
      : userApi.removeDevice(userId, deviceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); showToast('success', 'Removed', 'Device removed'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to remove device'),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const payload = { deviceId: newDeviceId.trim(), deviceName: newDeviceName.trim() || undefined };
      return crossTenantId
        ? tenantApi.addUserDevice(crossTenantId, userId, payload)
        : userApi.addDevice(userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setNewDeviceId('');
      setNewDeviceName('');
      setShowAddForm(false);
      showToast('success', 'Added', 'Device added successfully');
    },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to add device'),
  });

  const handleRemove = (device: any) => {
    setConfirmSheet({
      title: t('user.removeDevice'),
      message: `Remove "${device.deviceName}"?\n\n${t('user.removeDeviceMsg')}`,
      confirmLabel: t('user.removeDevice'),
      destructive: true,
      icon: 'trash-outline',
      onConfirm: () => removeMutation.mutate(device.deviceId),
    });
  };

  const handleAdd = () => {
    if (!newDeviceId.trim()) {
      showToast('error', 'Error', t('user.deviceIdRequired'));
      return;
    }
    addMutation.mutate();
  };

  if (isLoading) return <LoadingScreen message={t('user.loadingDevices')} />;

  const devices: any[] = data || [];

  return (
    <>
    <FlatList
      data={devices}
      keyExtractor={(item: any) => item.deviceId}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={({ item }) => (
        <AppCard style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary + '18', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.label, { color: theme.colors.text }]}>{item.deviceName}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {item.deviceId}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              Added {fmtDateTime(item.registeredAt)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleRemove(item)} style={{ padding: 8 }}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.error || '#ef4444'} />
          </TouchableOpacity>
        </AppCard>
      )}
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}

          <AppCard style={{ marginBottom: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('user.deviceWhitelistTitle')} {userName}</Text>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {t('user.deviceWhitelistHint')}
            </Text>
          </AppCard>

          {/* Add device form */}
          {showAddForm ? (
            <AppCard style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 10 }]}>{t('user.addDevice')}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('user.deviceId')}</Text>
              <TextInput
                value={newDeviceId}
                onChangeText={setNewDeviceId}
                placeholder={t('user.deviceIdPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                  padding: 10,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  marginBottom: 10,
                  fontSize: 13,
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('user.deviceName')}</Text>
              <TextInput
                value={newDeviceName}
                onChangeText={setNewDeviceName}
                placeholder={t('user.deviceNamePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                  padding: 10,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <AppButton title={t('common.cancel')} onPress={() => { setShowAddForm(false); setNewDeviceId(''); setNewDeviceName(''); }} style={{ flex: 1, backgroundColor: theme.colors.border }} />
                <AppButton title={t('user.addDeviceBtn')} onPress={handleAdd} loading={addMutation.isPending} style={{ flex: 1 }} />
              </View>
            </AppCard>
          ) : (
            <TouchableOpacity
              onPress={() => setShowAddForm(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: theme.colors.primary + '12',
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.primary + '30',
                borderStyle: 'dashed',
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={[theme.typography.label, { color: theme.colors.primary }]}>{t('user.addDeviceManually')}</Text>
            </TouchableOpacity>
          )}

          {devices.length > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
              {devices.length} authorized device{devices.length !== 1 ? 's' : ''}
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <EmptyState
          icon="phone-portrait-outline"
          title={t('user.noDevices')}
          subtitle={t('user.noDevicesHint')}
        />
      }
    />
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
