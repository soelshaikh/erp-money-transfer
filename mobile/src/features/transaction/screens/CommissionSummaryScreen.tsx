import React, { useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { transactionApi } from '../api/transactionApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { Ionicons } from '@expo/vector-icons';
import { RefreshButton } from '../../../shared/components/RefreshButton';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt } from '../../../utils/fmt';

export function CommissionSummaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['commission-summary'],
    queryFn: () => transactionApi.getCommissionSummary(),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <RefreshButton onPress={refetch} isFetching={isFetching} style={{ marginRight: 8 }} />,
    });
  }, [refetch, isFetching]);

  if (isLoading) return <LoadingScreen message={t('txn.loadingCommSummary')} />;

  const branches: any[] = (data as any)?.branches || [];
  const grandTotal = (data as any)?.grandTotal || { totalCommission: 0, totalAmount: 0, txnCount: 0 };

  const renderBranchRow = ({ item }: { item: any }) => {
    const pct = grandTotal.totalCommission > 0
      ? ((item.totalCommission / grandTotal.totalCommission) * 100).toFixed(1)
      : '0';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CommissionDetail', { branchId: item.branchId, branchName: item.branchName })}
      >
        <AppCard style={{ marginBottom: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            {/* Branch info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.1), paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.borderRadius.sm }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.primary, fontSize: 10 }]} allowFontScaling={false}>
                    {item.branchCode}
                  </Text>
                </View>
                <Text style={[theme.typography.label, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.branchName || 'Unknown Branch'}
                </Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {item.txnCount} txn{item.txnCount !== 1 ? 's' : ''} · Collected {fmtAmt(item.totalAmount)}
              </Text>
            </View>

            {/* Commission amount */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                {fmtAmt(item.totalCommission)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {pct}% {t('txn.commShare')}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </View>

          {/* Progress bar showing share of total */}
          <View style={{ height: 3, backgroundColor: withAlpha(theme.colors.secondary, 0.12), borderRadius: 2, marginTop: theme.spacing.sm, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.colors.secondary, borderRadius: 2 }} />
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={branches}
      keyExtractor={(item: any) => String(item.branchId)}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={renderBranchRow}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={15}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={(error as any)?.response?.data?.error?.message || 'Failed to load'} onRetry={refetch} />}

          {/* Grand total card */}
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {t('txn.allBranchesSummary')}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.transactions')}</Text>
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 18 }} allowFontScaling={false}>
                  {grandTotal.txnCount}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.totalCollected')}</Text>
                <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                  {fmtAmt(grandTotal.totalAmount)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.totalCommission')}</Text>
                <Text style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                  {fmtAmt(grandTotal.totalCommission)}
                </Text>
              </View>
            </View>
          </AppCard>

          {branches.length > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {branches.length} branch{branches.length !== 1 ? 'es' : ''} · {t('txn.sortedByComm')}
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="business-outline" size={48} color={withAlpha(theme.colors.textSecondary, 0.38)} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
            {t('txn.noCommDataYet')}
          </Text>
        </View>
      }
    />
  );
}
