import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { withAlpha } from '../../../utils/colors';
import { branchApi } from '../api/branchApi';
import { AppCard } from '../../../shared/components/AppCard';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { FilterPanel } from '../../../shared/components/FilterPanel';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { Ionicons } from '@expo/vector-icons';
import { fmtAmt, fmtDate, fmtTime } from '../../../utils/fmt';

interface EventMeta {
  label: string;
  icon: string;
  affectsLabel: string;
  isActual: boolean;
}

const EVENT_ICONS: Record<string, { icon: string; isActual: boolean }> = {
  collection: { icon: 'arrow-down-circle', isActual: true },
  payout_committed: { icon: 'time-outline', isActual: false },
  payout_completed: { icon: 'arrow-up-circle', isActual: true },
  collection_reversed: { icon: 'close-circle', isActual: true },
  pending_payout: { icon: 'hourglass-outline', isActual: false },
  pending_payout_reversed: { icon: 'checkmark-circle-outline', isActual: false },
};

interface Props {
  route: any;
}

function formatDisplayDate(dateStr: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = dateStr.split('-');
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function BalancePill({ label, value, theme }: { label: string; value: number; theme: any }) {
  const isNeg = value < 0;
  const color = isNeg ? theme.colors.error : value === 0 ? theme.colors.textSecondary : theme.colors.success;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{label}</Text>
      <Text style={{ color, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
        {isNeg ? '−' : '+'}{fmtAmt(value)}
      </Text>
    </View>
  );
}

export function BranchLedgerScreen({ route }: Props) {
  const { t } = useTranslation();
  const { branchId, branchName } = route.params;
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const EVENT_META: Record<string, EventMeta> = {
    collection: { label: t('ledger.collectionReceived'), icon: 'arrow-down-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    payout_committed: { label: t('ledger.payoutApproved'), icon: 'time-outline', affectsLabel: t('ledger.effectiveOnly'), isActual: false },
    payout_completed: { label: t('ledger.payoutMade'), icon: 'arrow-up-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    collection_reversed: { label: t('ledger.cancelled'), icon: 'close-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    pending_payout: { label: t('ledger.pendingReserved'), icon: 'hourglass-outline', affectsLabel: t('ledger.effectiveOnly'), isActual: false },
    pending_payout_reversed: { label: t('ledger.pendingCleared'), icon: 'checkmark-circle-outline', affectsLabel: t('ledger.effectiveOnly'), isActual: false },
    commission_earned: { label: 'Commission Earned', icon: 'cash-outline', affectsLabel: t('ledger.actualEffective'), isActual: true },
    commission_payable: { label: 'Commission Payable', icon: 'swap-horizontal-outline', affectsLabel: 'Effective Only', isActual: false },
    commission_receivable: { label: 'Commission Receivable', icon: 'swap-horizontal-outline', affectsLabel: 'Effective Only', isActual: false },
    commission_settlement_out: { label: 'Commission Settled (Out)', icon: 'arrow-up-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    commission_settlement_in: { label: 'Commission Settled (In)', icon: 'arrow-down-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    hq_commission_out: { label: 'HQ Commission Settled', icon: 'arrow-up-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
    hq_commission_in: { label: 'HQ Commission Received', icon: 'arrow-down-circle', affectsLabel: t('ledger.actualEffective'), isActual: true },
  };

  const [page, setPage] = useState(1);
  const limit = 30;

  // Pending filter inputs
  const [showFilters, setShowFilters] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  // Applied filters (drive the query)
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');

  const hasActiveFilters = !!(activeFrom || activeTo);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.md, gap: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CommissionPayables')}
          >
            <Ionicons name="swap-horizontal-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('BranchDailyBalances', { branchId, branchName: branchName || 'Branch' })}
          >
            <Ionicons name="stats-chart-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFilters((v) => !v)}>
            <Ionicons
              name="calendar-outline"
              size={22}
              color={hasActiveFilters ? theme.colors.secondary : theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, branchId, branchName, hasActiveFilters]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branch-ledger', branchId, page, activeFrom, activeTo],
    queryFn: () => branchApi.getLedger(branchId, {
      page,
      limit,
      fromDate: activeFrom || undefined,
      toDate: activeTo || undefined,
    }),
  });

  const applyFilters = () => {
    setPage(1);
    setActiveFrom(fromInput);
    setActiveTo(toInput);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFromInput('');
    setToInput('');
    setActiveFrom('');
    setActiveTo('');
    setPage(1);
  };

  if (isLoading) return <LoadingScreen message={t('ledger.loading')} />;

  const branch = (data as any)?.branch || {};
  const entries: any[] = (data as any)?.data || [];
  const total: number = (data as any)?.total || 0;
  const totalCredits: number = (data as any)?.totalCredits || 0;
  const totalDebits: number = (data as any)?.totalDebits || 0;
  const hasMore = page * limit < total;

  const actualBalance: number = branch.actualBalance ?? 0;
  const committedPayout: number = branch.committedPayout ?? 0;
  const pendingPayout: number = branch.pendingPayout ?? 0;
  const commissionPayable: number = branch.commissionPayable ?? 0;
  const commissionReceivable: number = branch.commissionReceivable ?? 0;
  const effectiveBalance: number = branch.effectiveBalance ?? (actualBalance - committedPayout - pendingPayout);
  const openingBalance: number | null = branch.openingBalance ?? null;

  const renderEntry = ({ item }: { item: any }) => {
    const meta = EVENT_META[item.event] || { label: item.event, icon: 'swap-horizontal', affectsLabel: '', isActual: true };
    const isCredit = item.type === 'credit';
    const isCommitted = item.type === 'committed_debit';
    const isPending = item.type === 'pending_debit';
    const isPendingReversed = item.type === 'pending_reversed';

    const amountColor = isCredit
      ? theme.colors.success
      : isCommitted ? '#f59e0b'
      : isPending ? theme.colors.statusPending
      : isPendingReversed ? theme.colors.primary
      : theme.colors.error;

    const sign = (isCredit || isPendingReversed) ? '+' : '−';

    return (
      <View style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        marginBottom: 8,
        padding: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        ...theme.shadow.card,
        borderLeftWidth: 3,
        borderLeftColor: amountColor,
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: withAlpha(amountColor, 0.09),
          justifyContent: 'center', alignItems: 'center',
          marginRight: 12, marginTop: 2,
        }}>
          <Ionicons name={meta.icon as any} size={17} color={amountColor} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[theme.typography.label, { color: theme.colors.text, fontSize: 13 }]}>
                {meta.label}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: amountColor, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
                {sign}{fmtAmt(item.amount)}
              </Text>
              {isCommitted && (
                <Text style={[theme.typography.caption, { color: '#f59e0b', fontSize: 10 }]}>{t('ledger.committedLabel')}</Text>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('ledger.actualShort')}</Text>
              <Text style={[theme.typography.caption, {
                color: item.actualBalanceAfter < 0 ? theme.colors.error : theme.colors.text,
                fontWeight: '600',
              }]} allowFontScaling={false}>
                {item.actualBalanceAfter < 0 ? '−' : ''}{fmtAmt(item.actualBalanceAfter)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('ledger.effectiveShort')}</Text>
              <Text style={[theme.typography.caption, {
                color: item.effectiveBalanceAfter < 0 ? theme.colors.error : theme.colors.success,
                fontWeight: '600',
              }]} allowFontScaling={false}>
                {item.effectiveBalanceAfter < 0 ? '−' : ''}{fmtAmt(item.effectiveBalanceAfter)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.08), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                  {item.tokenNumber}
                </Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {fmtDate(item.createdAt)} · {fmtTime(item.createdAt)}
              </Text>
            </View>
            <View style={{ backgroundColor: withAlpha(amountColor, 0.08), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={[theme.typography.caption, { color: amountColor, fontWeight: '600', fontSize: 10 }]}>
                {meta.affectsLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={entries}
      keyExtractor={(item: any) => item._id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={renderEntry}
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}

          {/* Date filter panel */}
          <FilterPanel visible={showFilters} onClear={clearFilters} onApply={applyFilters} theme={theme} style={{ marginBottom: theme.spacing.md }}>
            <DateRangeFilter
              fromDate={fromInput}
              toDate={toInput}
              onFromChange={setFromInput}
              onToChange={setToInput}
              theme={theme}
            />
          </FilterPanel>

          {/* Opening Balance card — only when fromDate filter is active */}
          {hasActiveFilters && openingBalance !== null && (
            <AppCard style={{
              marginBottom: theme.spacing.md,
              borderLeftWidth: 4,
              borderLeftColor: theme.colors.primary,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {t('ledger.openingBalance')}
                  </Text>
                  {activeFrom && (
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]}>
                      {t('ledger.asOf')} {formatDisplayDate(activeFrom)}
                    </Text>
                  )}
                </View>
                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 20 }} allowFontScaling={false}>
                  {fmtAmt(openingBalance)}
                </Text>
              </View>
            </AppCard>
          )}

          {/* Summary */}
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
              <View>
                <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{branch.name}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {branch.code} · {branch.type?.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Actual vs Effective */}
            <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.sm, gap: 8 }}>
              <BalancePill label={t('ledger.actualBalance')} value={actualBalance} theme={theme} />
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <BalancePill label={t('ledger.effectiveBalance')} value={effectiveBalance} theme={theme} />
            </View>

            {pendingPayout > 0 && (
              <View style={{ backgroundColor: withAlpha(theme.colors.statusPending, 0.08), borderRadius: theme.borderRadius.sm, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: committedPayout > 0 ? 6 : 0 }}>
                <Ionicons name="hourglass-outline" size={14} color={theme.colors.statusPending} />
                <Text style={[theme.typography.caption, { color: theme.colors.statusPending, flex: 1 }]}>
                  {fmtAmt(pendingPayout)} {t('ledger.pendingOutgoing')}
                </Text>
              </View>
            )}
            {committedPayout > 0 && (
              <View style={{ backgroundColor: withAlpha('#f59e0b', 0.09), borderRadius: theme.borderRadius.sm, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: (commissionPayable > 0 || commissionReceivable > 0) ? 6 : 0 }}>
                <Ionicons name="time-outline" size={14} color="#f59e0b" />
                <Text style={[theme.typography.caption, { color: '#f59e0b', flex: 1 }]}>
                  {fmtAmt(committedPayout)} {t('ledger.committed')}
                </Text>
              </View>
            )}
            {commissionPayable > 0 && (
              <View style={{ backgroundColor: withAlpha(theme.colors.warning, 0.08), borderRadius: theme.borderRadius.sm, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: commissionReceivable > 0 ? 6 : 0 }}>
                <Ionicons name="swap-horizontal-outline" size={14} color={theme.colors.warning} />
                <Text style={[theme.typography.caption, { color: theme.colors.warning, flex: 1 }]}>
                  {fmtAmt(commissionPayable)} commission payable to sending branch
                </Text>
              </View>
            )}
            {commissionReceivable > 0 && (
              <View style={{ backgroundColor: withAlpha(theme.colors.success, 0.08), borderRadius: theme.borderRadius.sm, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="swap-horizontal-outline" size={14} color={theme.colors.success} />
                <Text style={[theme.typography.caption, { color: theme.colors.success, flex: 1 }]}>
                  {fmtAmt(commissionReceivable)} commission receivable from payout branch
                </Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.sm }} />

            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('ledger.totalCollected')}</Text>
                <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
                  +{fmtAmt(totalCredits)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('ledger.totalPaidOut')}</Text>
                <Text style={{ color: theme.colors.error, fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
                  −{fmtAmt(totalDebits)}
                </Text>
              </View>
            </View>
          </AppCard>

          {/* Legend */}
          <AppCard style={{ marginBottom: theme.spacing.md, padding: theme.spacing.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 6, fontWeight: '600' }]}>{t('ledger.legend')}</Text>
            <View style={{ gap: 4 }}>
              {[
                { color: theme.colors.success, label: t('ledger.legendGreen') },
                { color: theme.colors.statusPending, label: t('ledger.legendAmber') },
                { color: '#f59e0b', label: t('ledger.legendOrange') },
                { color: theme.colors.error, label: t('ledger.legendRed') },
              ].map((l) => (
                <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{l.label}</Text>
                </View>
              ))}
            </View>
          </AppCard>

          {total > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
              {total} entr{total !== 1 ? 'ies' : 'y'} · {t('common.newestFirst')}
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="document-text-outline" size={48} color={withAlpha(theme.colors.textSecondary, 0.38)} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
            {t('ledger.noEntries')}
          </Text>
        </View>
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            onPress={() => setPage((p) => p + 1)}
            style={{
              marginTop: 12, padding: theme.spacing.md,
              backgroundColor: withAlpha(theme.colors.primary, 0.08),
              borderRadius: theme.borderRadius.md,
              alignItems: 'center',
            }}
          >
            <Text style={[theme.typography.label, { color: theme.colors.primary }]}>{t('ledger.loadMore')}</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );
}
