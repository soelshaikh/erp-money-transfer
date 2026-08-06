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
import { parseApiError } from '../../../utils/apiError';
import { commissionSettlementApi } from '../api/commissionSettlementApi';

interface Props {
  navigation: any;
  route: any;
}

export function CommissionPayablesScreen({ navigation }: Props) {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [initiating, setInitiating] = useState<string | null>(null);

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

  // Summary view: grouped by branch pair
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['commissionPayables', 'summary'],
    queryFn: () => commissionSettlementApi.listPayables({ summaryOnly: true }),
  });

  const summary: any[] = (data as any)?.summary ?? [];

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

  if (isLoading) return <LoadingScreen message="Loading..." />;

  const renderItem = ({ item }: { item: any }) => {
    const key = `${item._id.fromBranchId}-${item._id.toBranchId}`;
    const isInitiating = initiating === key;
    return (
      <AppCard style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: withAlpha(theme.colors.warning, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.spacing.sm,
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={summary}
        keyExtractor={(item) => `${item._id.fromBranchId}-${item._id.toBranchId}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
        ListHeaderComponent={
          summary.length > 0 ? (
            <View style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Commission collected by payout branches on behalf of sending branches. Initiate a settlement to transfer the amount.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState icon="checkmark-circle-outline" title="All Settled" message="No pending commission payables. All commissions have been settled." />
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
