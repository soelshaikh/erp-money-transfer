import React, { useState, useLayoutEffect } from 'react';
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
import { fmtAmt, fmtDate, fmtTime } from '../../../utils/fmt';

interface Props {
  route: any;
}

export function CommissionDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const [page, setPage] = useState(1);
  const limit = 30;

  // branchId is passed when head office drills into a specific branch; absent = all / own branch
  const { branchId, branchName } = route.params || {};

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['commission-detail', branchId, page],
    queryFn: () => transactionApi.getCommissionDetail({ branchId: branchId || undefined, page, limit }),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <RefreshButton onPress={refetch} isFetching={isFetching} style={{ marginRight: 8 }} />,
    });
  }, [refetch, isFetching]);

  if (isLoading) return <LoadingScreen message={t('txn.loadingComm')} />;

  const entries: any[] = (data as any)?.data || [];
  const total: number = (data as any)?.total || 0;
  const totals = (data as any)?.totals || { totalCommission: 0, totalAmount: 0, totalFinal: 0 };
  const hasMore = page * limit < total;

  const renderEntry = ({ item }: { item: any }) => {
    const hasCommission = item.commissionAmount > 0;
    const commColor = hasCommission ? theme.colors.secondary : theme.colors.textSecondary;
    const collectionBranch = item.collectionBranchId?.name || item.collectionBranchId;
    const payoutBranch = item.payoutBranchId?.name || item.payoutBranchId;

    return (
      <AppCard style={{ marginBottom: theme.spacing.sm }}>
        {/* Header row: token + date */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
          <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.08), paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.sm }}>
            <Text style={[theme.typography.label, { color: theme.colors.primary, fontSize: 12 }]} allowFontScaling={false}>
              {item.tokenNumber}
            </Text>
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}
          </Text>
        </View>

        {/* Amount breakdown */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.success, 0.06), borderRadius: theme.borderRadius.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>{t('txn.collected')}</Text>
            <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 14, marginTop: 2 }} allowFontScaling={false}>
              {fmtAmt(item.amount)}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm, backgroundColor: withAlpha(commColor, 0.06), borderRadius: theme.borderRadius.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>{t('txn.commissionCol')}</Text>
            <Text style={{ color: commColor, fontWeight: '700', fontSize: 14, marginTop: 2 }} allowFontScaling={false}>
              {fmtAmt(item.commissionAmount)}
            </Text>
            {item.commissionType === 'percentage' && item.commissionValue > 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>
                {item.commissionValue}%
              </Text>
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.error, 0.06), borderRadius: theme.borderRadius.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>{t('txn.totalPayout')}</Text>
            <Text style={{ color: theme.colors.error, fontWeight: '700', fontSize: 14, marginTop: 2 }} allowFontScaling={false}>
              {fmtAmt(item.finalAmount)}
            </Text>
          </View>
        </View>

        {/* Branch info */}
        <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm, gap: 6, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="arrow-down-circle-outline" size={12} color={theme.colors.success} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{collectionBranch}</Text>
          </View>
          <Ionicons name="arrow-forward" size={12} color={theme.colors.textSecondary} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="arrow-up-circle-outline" size={12} color={theme.colors.error} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{payoutBranch}</Text>
          </View>
        </View>

        {/* Enterprise commission split breakdown */}
        {item.commissionSplit && (
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4,
            marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm,
            borderTopWidth: 1, borderTopColor: theme.colors.divider,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
              Own {fmtAmt(item.commissionSplit.ownShareAmount)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
              {item.commissionSplit.otherBranchId?.name || item.commissionSplit.otherBranchId || 'Other'} {fmtAmt(item.commissionSplit.otherBranchShareAmount)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
              HO {fmtAmt(item.commissionSplit.headOfficeOwnShareAmount)}
            </Text>
          </View>
        )}
      </AppCard>
    );
  };

  return (
    <FlatList
      data={entries}
      keyExtractor={(item: any) => item._id || item.tokenNumber}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={renderEntry}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={(error as any)?.response?.data?.error?.message || 'Failed to load'} onRetry={refetch} />}

          {/* Summary totals */}
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            {branchName && (
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                {branchName}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.totalCollected')}</Text>
                <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                  {fmtAmt(totals.totalAmount)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.totalCommission')}</Text>
                <Text style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                  {fmtAmt(totals.totalCommission)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('txn.totalPayout')}</Text>
                <Text style={{ color: theme.colors.error, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                  {fmtAmt(totals.totalFinal)}
                </Text>
              </View>
            </View>
          </AppCard>

          {total > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {total} transaction{total !== 1 ? 's' : ''} · newest first
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="cash-outline" size={48} color={withAlpha(theme.colors.textSecondary, 0.38)} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
            {t('txn.noCommYet')}
          </Text>
        </View>
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            onPress={() => setPage((p) => p + 1)}
            style={{ marginTop: 12, padding: theme.spacing.md, backgroundColor: withAlpha(theme.colors.primary, 0.08), borderRadius: theme.borderRadius.md, alignItems: 'center' }}
          >
            <Text style={[theme.typography.label, { color: theme.colors.primary }]}>{t('common.loadMore')}</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );
}
