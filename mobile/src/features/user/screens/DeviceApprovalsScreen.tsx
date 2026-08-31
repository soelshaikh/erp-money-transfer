import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { showToast } from '../../../utils/toast';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtDateTime } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { deviceSessionApi } from '../api/deviceSessionApi';
import type { DeviceSession } from '../../../types/deviceSession';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPlatformIcon(platform: string): keyof typeof Ionicons.glyphMap {
  if (platform === 'ios') return 'logo-apple';
  if (platform === 'android') return 'logo-android';
  return 'phone-portrait-outline';
}

function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'pending':
      return theme.colors.statusPending;
    case 'approved':
      return theme.colors.success;
    case 'rejected':
      return theme.colors.error;
    case 'suspended':
      return theme.colors.textSecondary;
    default:
      return theme.colors.textSecondary;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'suspended':
      return 'Suspended';
    default:
      return status;
  }
}

function getRoleLabel(role: string): string {
  if (role === 'head_office') return 'Head Office';
  if (role === 'branch') return 'Branch';
  if (role === 'super_admin') return 'Super Admin';
  return role;
}

function getRoleColor(role: string, theme: any): string {
  if (role === 'head_office') return theme.colors.primary;
  if (role === 'branch') return theme.colors.secondary;
  return theme.colors.textSecondary;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AvatarCircle({ name, theme }: { name: string; theme: any }) {
  const initials = (name || '?')
    .split(' ')
    .map((w: string) => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: withAlpha(theme.colors.primary, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }}
        allowFontScaling={false}
      >
        {initials}
      </Text>
    </View>
  );
}

function StatusBadge({ status, theme }: { status: string; theme: any }) {
  const color = getStatusColor(status, theme);
  return (
    <View
      style={{
        backgroundColor: withAlpha(color, 0.12),
        borderRadius: theme.borderRadius.sm,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text
        style={[theme.typography.caption, { color, fontSize: 10, fontWeight: '600' }]}
        allowFontScaling={false}
      >
        {getStatusLabel(status)}
      </Text>
    </View>
  );
}

function RoleBadge({ role, theme }: { role: string; theme: any }) {
  const color = getRoleColor(role, theme);
  return (
    <View
      style={{
        backgroundColor: withAlpha(color, 0.12),
        borderRadius: theme.borderRadius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text
        style={[theme.typography.caption, { color, fontSize: 10, fontWeight: '600' }]}
        allowFontScaling={false}
      >
        {getRoleLabel(role)}
      </Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: withAlpha(theme.colors.textSecondary, 0.10),
        marginVertical: theme.spacing.sm,
      }}
    />
  );
}

// ── Tab switcher ───────────────────────────────────────────────────────────────

function TabSwitcher({
  activeTab,
  onSwitch,
  theme,
}: {
  activeTab: 'pending' | 'all';
  onSwitch: (t: 'pending' | 'all') => void;
  theme: any;
}) {
  const tabs: Array<{ key: 'pending' | 'all'; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'all', label: 'All Sessions' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: withAlpha(theme.colors.textSecondary, 0.08),
        borderRadius: theme.borderRadius.sm,
        padding: 3,
        marginBottom: theme.spacing.md,
      }}
    >
      {tabs.map(({ key, label }) => {
        const active = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSwitch(key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: theme.borderRadius.sm - 2,
              alignItems: 'center',
              backgroundColor: active ? theme.colors.surface : 'transparent',
              elevation: active ? 2 : 0,
              shadowColor: active ? '#000' : 'transparent',
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: active ? 3 : 0,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <Text
              style={[
                theme.typography.caption,
                {
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: active ? '700' : '400',
                },
              ]}
              allowFontScaling={false}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Session card ───────────────────────────────────────────────────────────────

function SessionCard({
  item,
  actionLoadingId,
  onApprove,
  onReject,
  onSuspend,
  theme,
}: {
  item: DeviceSession;
  actionLoadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSuspend: (id: string) => void;
  theme: any;
}) {
  const user = item.userId;
  const name = user?.name || 'Unknown User';
  const username = user?.username || '—';
  const role = user?.role || '';
  const platformIcon = getPlatformIcon(item.platform);
  const isLoading = actionLoadingId === item._id;

  return (
    <AppCard style={{ marginBottom: theme.spacing.sm }}>
      {/* Top row: Avatar + Name / Username + Role + Status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AvatarCircle name={name} theme={theme} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[theme.typography.label, { color: theme.colors.text, flex: 1 }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <StatusBadge status={item.status} theme={theme} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text
              style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {username}
            </Text>
            {role ? <RoleBadge role={role} theme={theme} /> : null}
          </View>
        </View>
      </View>

      <Divider theme={theme} />

      {/* Device row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.xs }}>
        <Ionicons name={platformIcon} size={13} color={theme.colors.textSecondary} />
        <Text
          style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}
          numberOfLines={1}
        >
          {item.deviceName} ({item.platform})
        </Text>
      </View>

      {/* IP + Date row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
          <Ionicons name="wifi-outline" size={13} color={theme.colors.textSecondary} />
          <Text
            style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
            selectable
          >
            {item.ip || '—'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {fmtDateTime(item.createdAt)}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      {item.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          {/* Reject — outline, red */}
          <TouchableOpacity
            onPress={() => onReject(item._id)}
            disabled={isLoading}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.colors.error,
              borderRadius: theme.borderRadius.sm,
              paddingVertical: 9,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Text
                style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]}
                allowFontScaling={false}
              >
                Reject
              </Text>
            )}
          </TouchableOpacity>

          {/* Approve — filled, primary */}
          <TouchableOpacity
            onPress={() => onApprove(item._id)}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.sm,
              paddingVertical: 9,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
            ) : (
              <Text
                style={[theme.typography.caption, { color: theme.colors.textOnPrimary, fontWeight: '600' }]}
                allowFontScaling={false}
              >
                Approve
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'approved' && (
        <TouchableOpacity
          onPress={() => onSuspend(item._id)}
          disabled={isLoading}
          style={{ marginTop: theme.spacing.sm, alignSelf: 'flex-end' }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.error} />
          ) : (
            <Text
              style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]}
              allowFontScaling={false}
            >
              Suspend
            </Text>
          )}
        </TouchableOpacity>
      )}

      {item.status === 'suspended' && (
        <TouchableOpacity
          onPress={() => onApprove(item._id)}
          disabled={isLoading}
          style={{
            marginTop: theme.spacing.sm,
            backgroundColor: theme.colors.success,
            borderRadius: theme.borderRadius.sm,
            paddingVertical: 9,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              style={[theme.typography.caption, { color: '#fff', fontWeight: '600' }]}
              allowFontScaling={false}
            >
              Unsuspend
            </Text>
          )}
        </TouchableOpacity>
      )}

      {item.status === 'rejected' && (
        <TouchableOpacity
          onPress={() => onApprove(item._id)}
          disabled={isLoading}
          style={{
            marginTop: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            borderRadius: theme.borderRadius.sm,
            paddingVertical: 9,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text
              style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}
              allowFontScaling={false}
            >
              Re-approve
            </Text>
          )}
        </TouchableOpacity>
      )}
    </AppCard>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function DeviceApprovalsScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const pendingQuery = useQuery({
    queryKey: ['device-sessions', 'pending'],
    queryFn: () => deviceSessionApi.list({ status: 'pending' }),
  });

  const allQuery = useQuery({
    queryKey: ['device-sessions', 'all'],
    queryFn: () => deviceSessionApi.list(),
  });

  const activeQuery = activeTab === 'pending' ? pendingQuery : allQuery;
  const sessions: DeviceSession[] = (activeQuery.data as any) || [];

  // ── Invalidate both query keys on any mutation success ────────────────────────

  const invalidateBoth = () => {
    queryClient.invalidateQueries({ queryKey: ['device-sessions', 'pending'] });
    queryClient.invalidateQueries({ queryKey: ['device-sessions', 'all'] });
  };

  // ── Mutations ────────────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: (id: string) => deviceSessionApi.approve(id),
    onMutate: (id) => setActionLoadingId(id),
    onSettled: () => setActionLoadingId(null),
    onSuccess: () => invalidateBoth(),
    onError: (err: any) => {
      showToast('error', 'Error', parseApiError(err) ?? 'Failed to approve session');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => deviceSessionApi.reject(id),
    onMutate: (id) => setActionLoadingId(id),
    onSettled: () => setActionLoadingId(null),
    onSuccess: () => invalidateBoth(),
    onError: (err: any) => {
      showToast('error', 'Error', parseApiError(err) ?? 'Failed to reject session');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => deviceSessionApi.suspend(id),
    onMutate: (id) => setActionLoadingId(id),
    onSettled: () => setActionLoadingId(null),
    onSuccess: () => invalidateBoth(),
    onError: (err: any) => {
      showToast('error', 'Error', parseApiError(err) ?? 'Failed to suspend session');
    },
  });

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    setConfirmSheet({
      title: 'Reject Device Session',
      message: 'The user will not be able to log in from this device.',
      confirmLabel: 'Reject',
      destructive: true,
      icon: 'close-circle-outline',
      onConfirm: () => rejectMutation.mutate(id),
    });
  };

  const handleSuspend = (id: string) => {
    setConfirmSheet({
      title: 'Suspend Device Session',
      message: 'The user will be logged out from this device immediately.',
      confirmLabel: 'Suspend',
      destructive: true,
      icon: 'lock-closed-outline',
      onConfirm: () => suspendMutation.mutate(id),
    });
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (activeQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: theme.spacing.md }}>
          <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} theme={theme} />
        </View>
        <LoadingScreen message="Loading device sessions…" />
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <FlatList<DeviceSession>
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.md,
        paddingBottom: tabBarHeight + theme.spacing.md,
      }}
      data={sessions}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={
        <>
          <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} theme={theme} />
          {activeQuery.isError && (
            <View
              style={{
                backgroundColor: withAlpha(theme.colors.error, 0.08),
                borderRadius: theme.borderRadius.sm,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text style={[theme.typography.caption, { color: theme.colors.error, flex: 1 }]}>
                {parseApiError(activeQuery.error) ?? 'Failed to load sessions'}
              </Text>
              <TouchableOpacity onPress={() => activeQuery.refetch()}>
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {!activeQuery.isError && sessions.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: theme.spacing.sm,
              }}
            >
              <Ionicons name="phone-portrait-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                {activeTab === 'pending' ? ' awaiting approval' : ' total'}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        activeQuery.isError ? null : (
          <EmptyState
            icon={activeTab === 'pending' ? 'checkmark-circle-outline' : 'phone-portrait-outline'}
            title={
              activeTab === 'pending'
                ? 'No pending requests'
                : 'No device sessions found'
            }
            subtitle={
              activeTab === 'pending'
                ? 'All device login requests have been handled.'
                : 'No devices have connected to this system yet.'
            }
          />
        )
      }
      renderItem={({ item }) => (
        <SessionCard
          item={item}
          actionLoadingId={actionLoadingId}
          onApprove={handleApprove}
          onReject={handleReject}
          onSuspend={handleSuspend}
          theme={theme}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={activeQuery.isFetching && !activeQuery.isLoading}
          onRefresh={() => activeQuery.refetch()}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
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
