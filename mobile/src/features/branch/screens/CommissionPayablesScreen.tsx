import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { FilterChipGroup } from '../../../shared/components/FilterChipGroup';
import { parseApiError } from '../../../utils/apiError';
import { commissionSettlementApi } from '../api/commissionSettlementApi';

interface Props {
  navigation: any;
  route: any;
}

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending_settlement' },
  { label: 'Expected', value: 'expected' },
  { label: 'Approved', value: 'approved' },
  { label: 'In Settlement', value: 'in_settlement' },
  { label: 'Settled', value: 'settled' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Reversed', value: 'reversed' },
];

function statusMeta(status: string, theme: any) {
  switch (status) {
    case 'expected':
      return { label: 'EXPECTED', color: theme.colors.primary, icon: 'time-outline' as const };
    case 'approved':
      return { label: 'APPROVED', color: '#6366F1', icon: 'checkmark-outline' as const };
    case 'pending_settlement':
      return { label: 'PENDING', color: theme.colors.warning, icon: 'swap-horizontal-outline' as const };
    case 'in_settlement':
      return { label: 'IN SETTLEMENT', color: '#8B5CF6', icon: 'hourglass-outline' as const };
    case 'settled':
      return { label: 'SETTLED', color: theme.colors.success, icon: 'checkmark-circle-outline' as const };
    case 'cancelled':
      return { label: 'CANCELLED', color: theme.colors.textSecondary, icon: 'close-circle-outline' as const };
    case 'reversed':
      return { label: 'REVERSED', color: theme.colors.error, icon: 'arrow-undo-outline' as const };
    default:
      return { label: status.toUpperCase(), color: theme.colors.textSecondary, icon: 'ellipse-outline' as const };
  }
}

export function CommissionPayablesScreen({ navigation }: Props) {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending_settlement');
  const [initiating, setInitiating] = useState<string | null>(null);

  const isPendingView = statusFilter === 'pending_settlement';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: theme.spacing.md }}
          onPress={() => navigation.navigate('CommissionSettlements')}
        >
          <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme]);

  // Grouped summary — only used for pending_settlement to initiate settlements
  const summaryQuery = useQuery({
    queryKey: ['commissionPayables', 'summary'],
    queryFn: () => commissionSettlementApi.listPayables({ summaryOnly: true }),
    enabled: isPendingView,
  });

  // Individual records — used for all other statuses
  const listQuery = useQuery({
    queryKey: ['commissionPayables', 'list', statusFilter],
    queryFn: () => commissionSettlementApi.listPayables({ status: statusFilter, limit: 100 }),
    enabled: !isPendingView,
  });

  const isLoading = isPendingView ? summaryQuery.isLoading : listQuery.isLoading;
  const isFetching = isPendingView ? summaryQuery.isFetching : listQuery.isFetching;
  const refetch = isPendingView ? summaryQuery.refetch : listQuery.refetch;

  const summary: any[] = (summaryQuery.data as any)?.summary ?? [];
  const records: any[] = (listQuery.data as any)?.data ?? [];

  const handleInitiateSettlement = (item: any) => {
    Alert.alert(
      'Initiate Settlement',
      `Settle ${fmtAmt(item.totalAmount)} (${item.count} transaction${item.count === 1 ? '' : 's'}) owed by ${item.fromBranchName} to ${item.toBranchName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initiate',
          onPress: async () => {
            const key = `${item._id.fromBranchId}-${item._id.toBranchId}`;
            setInitiating(key);
            try {
              const settlement = await commissionSettlementApi.createSettlement({
                fromBranchId: item._id.fromBranchId.toString(),
                toBranchId: item._id.toBranchId.toString(),
              });
              qc.invalidateQueries({ queryKey: ['commissionPayables'] });
              qc.invalidateQueries({ queryKey: ['commissionSettlements'] });
              navigation.navigate('CommissionSettlementDetail', { settlementId: settlement._id });
            } catch (e: any) {
              Alert.alert('Error', parseApiError(e) ?? 'Failed to initiate settlement');
            } finally {
              setInitiating(null);
            }
          },
        },
      ],
    );
  };

  const renderSummaryItem = ({ item }: { item: any }) => {
    const key = `${item._id.fromBranchId}-${item._id.toBranchId}`;
    const isInitiating = initiating === key;
    return (
      <AppCard style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: withAlpha(theme.colors.warning, 0.12),
            alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.sm,
          }}>
            <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '700' }]}>
              {item.fromBranchName} ({item.fromBranchCode})
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              owes → {item.toBranchName} ({item.toBranchCode})
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Pending Amount</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.warning, fontWeight: '700' }]} allowFontScaling={false}>
              {fmtAmt(item.totalAmount)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Transactions</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} allowFontScaling={false}>
              {item.count}
            </Text>
          </View>
        </View>

        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          Oldest: {fmtDate(item.oldestAt)}
        </Text>

        <AppButton
          title={isInitiating ? 'Initiating…' : 'Initiate Settlement'}
          onPress={() => handleInitiateSettlement(item)}
          loading={isInitiating}
          disabled={!!initiating}
          size="sm"
        />
      </AppCard>
    );
  };

  const renderRecordItem = ({ item }: { item: any }) => {
    const meta = statusMeta(item.status, theme);
    return (
      <AppCard style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.xs }}>
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: withAlpha(meta.color, 0.12),
            alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.sm,
          }}>
            <Ionicons name={meta.icon} size={17} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '700' }]}>
                {item.tokenNumber}
              </Text>
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
                backgroundColor: withAlpha(meta.color, 0.12),
              }}>
                <Text style={[theme.typography.caption, { color: meta.color, fontWeight: '700' }]} allowFontScaling={false}>
                  {meta.label}
                </Text>
              </View>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              {item.fromBranchName} ({item.fromBranchCode}) → {item.toBranchName} ({item.toBranchCode})
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.divider }}>
          <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '700' }]} allowFontScaling={false}>
            {fmtAmt(item.amount)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {fmtDate(item.createdAt)}
          </Text>
        </View>
      </AppCard>
    );
  };

  if (isLoading) return <LoadingScreen message="Loading..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={isPendingView ? summary : records}
        keyExtractor={(item) =>
          isPendingView
            ? `${item._id.fromBranchId}-${item._id.toBranchId}`
            : item._id
        }
        renderItem={isPendingView ? renderSummaryItem : renderRecordItem}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.md }}>
            <FilterChipGroup
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onSelect={setStatusFilter}
              label="Status"
              theme={theme}
            />
            {isPendingView && summary.length > 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                Commission collected by payout branches on behalf of sending branches. Initiate a settlement to transfer.
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isPendingView
            ? <EmptyState icon="checkmark-circle-outline" title="All Settled" message="No pending commission payables. All commissions have been settled." />
            : <EmptyState icon="file-tray-outline" title="No Records" message={`No commission payables with status "${statusFilter.replace('_', ' ')}".`} />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
