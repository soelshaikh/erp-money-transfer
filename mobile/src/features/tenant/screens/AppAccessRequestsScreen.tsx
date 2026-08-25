import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { appAccessApi } from '../api/appAccessApi';
import { fmtDateTime } from '../../../utils/fmt';

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'];

function getPlatformIcon(platform: string): keyof typeof Ionicons.glyphMap {
  if (platform === 'ios') return 'logo-apple';
  if (platform === 'android') return 'logo-android';
  return 'phone-portrait-outline';
}

function getStatusColor(status: string, theme: any): string {
  if (status === 'pending')  return theme.colors.statusPending;
  if (status === 'approved') return theme.colors.success;
  if (status === 'rejected') return theme.colors.error;
  return theme.colors.textSecondary;
}

export function AppAccessRequestsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [filter, setFilter] = useState<string>('pending');

  const { data: records = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['app-access', filter],
    queryFn: () => appAccessApi.list(filter === 'all' ? undefined : filter),
  });

  const approveMutation = useMutation({
    mutationFn: (deviceId: string) => appAccessApi.approve(deviceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-access'] }); },
    onError: (err: any) => Alert.alert('Error', parseApiError(err) || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (deviceId: string) => appAccessApi.reject(deviceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-access'] }); },
    onError: (err: any) => Alert.alert('Error', parseApiError(err) || 'Failed to reject'),
  });

  const handleApprove = (deviceId: string, deviceName: string) => {
    Alert.alert('Approve Access', `Allow "${deviceName}" to access the app?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMutation.mutate(deviceId) },
    ]);
  };

  const handleReject = (deviceId: string, deviceName: string) => {
    Alert.alert('Reject Access', `Deny "${deviceName}" from accessing the app?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate(deviceId) },
    ]);
  };

  if (isLoading) return <LoadingScreen />;

  const apiError = error ? parseApiError(error) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, padding: theme.spacing.md, paddingBottom: 0 }}>
        {STATUS_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 6,
                borderRadius: theme.borderRadius.full,
                backgroundColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.1),
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? theme.colors.surface : theme.colors.primary,
                textTransform: 'capitalize',
              }}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {apiError ? (
        <View style={{ padding: theme.spacing.md }}>
          <Text style={{ color: theme.colors.error }}>{apiError}</Text>
        </View>
      ) : null}

      <FlatList
        data={records}
        keyExtractor={(item: any) => item._id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          paddingBottom: tabBarHeight + theme.spacing.md,
        }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState title="No access requests found" />}
        renderItem={({ item }: { item: any }) => {
          const statusColor = getStatusColor(item.status, theme);
          const isPending = item.status === 'pending';
          const mutating = approveMutation.isPending || rejectMutation.isPending;

          return (
            <AppCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: withAlpha(theme.colors.primary, 0.1),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={getPlatformIcon(item.platform)} size={20} color={theme.colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.body, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.deviceName || 'Unknown Device'}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {item.platform?.toUpperCase()} · {item.ip || 'No IP'}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {fmtDateTime(item.createdAt)}
                  </Text>
                </View>

                <View style={{
                  paddingHorizontal: theme.spacing.xs,
                  paddingVertical: 3,
                  borderRadius: theme.borderRadius.sm,
                  backgroundColor: withAlpha(statusColor, 0.15),
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor, textTransform: 'capitalize' }}>
                    {item.status}
                  </Text>
                </View>
              </View>

              {isPending && (
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => handleApprove(item.deviceId, item.deviceName)}
                    disabled={mutating}
                    style={{
                      flex: 1, paddingVertical: 9, borderRadius: theme.borderRadius.sm,
                      backgroundColor: mutating ? withAlpha(theme.colors.success, 0.5) : theme.colors.success,
                      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {approveMutation.isPending
                      ? <ActivityIndicator size="small" color={theme.colors.surface} />
                      : <Ionicons name="checkmark" size={16} color={theme.colors.surface} />}
                    <Text style={{ color: theme.colors.surface, fontWeight: '700', fontSize: 14 }}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleReject(item.deviceId, item.deviceName)}
                    disabled={mutating}
                    style={{
                      flex: 1, paddingVertical: 9, borderRadius: theme.borderRadius.sm,
                      backgroundColor: mutating ? withAlpha(theme.colors.error, 0.5) : withAlpha(theme.colors.error, 0.1),
                      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.error} />
                    <Text style={{ color: theme.colors.error, fontWeight: '700', fontSize: 14 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.approvedAt && (
                <Text style={[theme.typography.caption, { color: theme.colors.success, marginTop: theme.spacing.xs }]}>
                  Approved {fmtDateTime(item.approvedAt)}
                </Text>
              )}
              {item.rejectedAt && (
                <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: theme.spacing.xs }]}>
                  Rejected {fmtDateTime(item.rejectedAt)}
                </Text>
              )}
            </AppCard>
          );
        }}
      />
    </View>
  );
}
