import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
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
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { Ionicons } from '@expo/vector-icons';
import { fmtAmt } from '../../../utils/fmt';

const LIMIT = 30;

interface Props {
  route: any;
}

function formatDisplayDate(dateStr: string) {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

export function BranchDailyBalancesScreen({ route }: Props) {
  const { t } = useTranslation();
  const { branchId, branchName } = route.params;
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const [page, setPage] = useState(1);

  // Filter inputs (pending)
  const [showFilters, setShowFilters] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  // Applied filters
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowFilters((v) => !v)} style={{ marginRight: theme.spacing.md }}>
          <Ionicons
            name="calendar-outline"
            size={22}
            color={(activeFrom || activeTo) ? theme.colors.secondary : theme.colors.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, activeFrom, activeTo]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branch-daily-balances', branchId, page, activeFrom, activeTo],
    queryFn: () => branchApi.getDailyBalances(branchId, {
      page,
      limit: LIMIT,
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

  if (isLoading) return <LoadingScreen message={t('ledger.loadingDaily')} />;

  const branch = (data as any)?.branch || {};
  const records: any[] = (data as any)?.data || [];
  const total: number = (data as any)?.total || 0;
  const hasMore = page * LIMIT < total;

  const renderRow = ({ item }: { item: any }) => {
    const change = item.closingBalance - item.openingBalance;
    const isPositive = change >= 0;
    const changeColor = isPositive ? theme.colors.success : theme.colors.error;

    return (
      <View style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        marginBottom: 8,
        padding: theme.spacing.md,
        ...theme.shadow.card,
        borderLeftWidth: 3,
        borderLeftColor: changeColor,
      }}>
        {/* Date row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.label, { color: theme.colors.text }]}>
            {formatDisplayDate(item.date)}
          </Text>
          <View style={{
            backgroundColor: withAlpha(changeColor, 0.1),
            borderRadius: theme.borderRadius.sm,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={{ color: changeColor, fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
              {isPositive ? '+' : '−'}{fmtAmt(change)}
            </Text>
          </View>
        </View>

        {/* Opening / Closing */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.sm,
          padding: theme.spacing.sm,
        }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>
              {t('ledger.opening')}
            </Text>
            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>
              {fmtAmt(item.openingBalance)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.divider, marginVertical: 2 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>
              {t('ledger.closing')}
            </Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>
              {fmtAmt(item.closingBalance)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={records}
      keyExtractor={(item: any) => item._id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={renderRow}
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}

          <FilterPanel visible={showFilters} onClear={clearFilters} onApply={applyFilters} theme={theme} style={{ marginBottom: theme.spacing.md }}>
            <DateRangeFilter
              fromDate={fromInput}
              toDate={toInput}
              onFromChange={setFromInput}
              onToChange={setToInput}
              theme={theme}
            />
          </FilterPanel>

          {/* Branch header */}
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{branch.name || branchName}</Text>
            {branch.code && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                {branch.code} · {branch.type?.replace('_', ' ').toUpperCase()}
              </Text>
            )}
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.sm }} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {t('ledger.dailyHint')}
            </Text>
          </AppCard>

          {total > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
              {total} day{total !== 1 ? 's' : ''} {t('ledger.onRecord')}
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <EmptyState
          icon="calendar-outline"
          title={t('ledger.noRecords')}
          subtitle={t('ledger.noRecordsHint')}
        />
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            onPress={() => setPage((p) => p + 1)}
            style={{
              marginTop: 12,
              padding: theme.spacing.md,
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
