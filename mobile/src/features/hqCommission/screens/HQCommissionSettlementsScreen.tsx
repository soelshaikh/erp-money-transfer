import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { FilterChipGroup } from '../../../shared/components/FilterChipGroup';
import { hqCommissionApi, HQCommissionSettlement } from '../api/hqCommissionApi';

interface Props {
  navigation: any;
}

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
];

export function HQCommissionSettlementsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['hqCommissionSettlements', statusFilter],
    queryFn: () =>
      hqCommissionApi.listSettlements({ status: statusFilter || undefined, limit: 50 }),
  });

  const settlements: HQCommissionSettlement[] = (data as any)?.data ?? [];

  if (isLoading) return <LoadingScreen message={t('hqComm.loading')} />;

  const renderItem = ({ item }: { item: HQCommissionSettlement }) => {
    const isPending = item.status === 'pending';
    const statusColor = isPending ? theme.colors.warning : theme.colors.success;
    const initiatedLabel = item.initiatedBySide === 'branch'
      ? t('hqComm.initiatedByBranch')
      : t('hqComm.initiatedByHO');

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('HQCommissionSettlementDetail', { settlementId: item._id })}
      >
        <AppCard style={{ marginBottom: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: withAlpha(statusColor, 0.12),
              alignItems: 'center', justifyContent: 'center',
              marginRight: theme.spacing.sm,
            }}>
              <Ionicons
                name={isPending ? 'time-outline' : 'checkmark-circle-outline'}
                size={18}
                color={statusColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '700', flex: 1 }]} numberOfLines={1}>
                  {item.branchName} ({item.branchCode})
                </Text>
                <View style={{
                  paddingHorizontal: theme.spacing.sm, paddingVertical: 2,
                  borderRadius: 99,
                  backgroundColor: withAlpha(statusColor, 0.12),
                  marginLeft: theme.spacing.xs,
                }}>
                  <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '700' }]} allowFontScaling={false}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                {item.itemCount} {t('hqComm.items')} · {initiatedLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs }}>
            <View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalHQShare')}</Text>
              <Text style={[theme.typography.h3, { color: theme.colors.error, fontWeight: '700' }]} allowFontScaling={false}>
                {fmtAmt(item.totalHQShare)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalCommission')}</Text>
              <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} allowFontScaling={false}>
                {fmtAmt(item.totalCommission)}
              </Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: theme.spacing.xs, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>
              {item.initiatedByName} · {fmtDateTime(item.initiatedAt)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.textSecondary} />
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={settlements}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} colors={[theme.colors.primary]} />}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.md }}>
            <FilterChipGroup
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onSelect={setStatusFilter}
              label="Status"
              theme={theme}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-tray-outline"
            title={t('hqComm.settlementsEmpty')}
            message={t('hqComm.settlementsEmptyHint')}
          />
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
