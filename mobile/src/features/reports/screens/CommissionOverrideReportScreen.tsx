import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { reportApi, downloadReport } from '../api/reportApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { showToast } from '../../../utils/toast';

export function CommissionOverrideReportScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const query = useInfiniteQuery({
    queryKey: ['commissionOverrides', activeFilters],
    queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
      (reportApi as any).getCommissionOverrides({ ...activeFilters, page: pageParam }),
    getNextPageParam: (last: any) =>
      last.page < Math.ceil(last.total / last.limit) ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const items: any[] = query.data?.pages.flatMap((p: any) => p.data) || [];

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'commission-overrides', ...activeFilters });
    } catch (err: any) {
      showToast('error', 'Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  };

  if (query.isLoading) return <LoadingScreen message="Loading commission overrides..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item: any, index: number) =>
          `${item.actorUsername ?? ''}-${item.after?.tokenNumber ?? ''}-${index}`
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={
          <RefreshControl refreshing={query.isFetching && !query.isFetchingNextPage} onRefresh={query.refetch} colors={[theme.colors.primary]} />
        }
        ListHeaderComponent={() => (
          <>
            {/* Date Range Filter */}
            <AppCard style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 8, color: theme.colors.text, fontSize: 13 }}
                  placeholder="From (YYYY-MM-DD)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={startDate}
                  onChangeText={setStartDate}
                />
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 8, color: theme.colors.text, fontSize: 13 }}
                  placeholder="To (YYYY-MM-DD)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
              <TouchableOpacity
                onPress={() => setActiveFilters({ startDate: startDate || undefined, endDate: endDate || undefined })}
                style={{ backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: theme.colors.textOnPrimary, fontWeight: '600' }}>Apply</Text>
              </TouchableOpacity>
            </AppCard>

            {query.isError && (
              <ErrorMessage message={parseApiError(query.error) ?? 'Failed to load overrides'} onRetry={query.refetch} />
            )}
          </>
        )}
        renderItem={({ item }: { item: any }) => {
          const after = item.after ?? {};
          const originalAmt = after.originalAmount ?? 0;
          const overrideAmt = after.commissionAmount ?? 0;
          const isDiff = overrideAmt !== originalAmt;

          return (
            <AppCard style={{
              marginBottom: theme.spacing.sm,
              borderLeftWidth: 3,
              borderLeftColor: isDiff ? theme.colors.warning : theme.colors.divider,
            }}>
              {/* Line 1: actor + date */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 }}>
                  <Ionicons name="person-outline" size={13} color={theme.colors.textSecondary} />
                  <Text style={[theme.typography.label, { color: theme.colors.text }]}>
                    {item.actorName ?? item.actorUsername}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    @{item.actorUsername}
                  </Text>
                </View>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {fmtDate(item.createdAt)}
                </Text>
              </View>

              {/* Line 2: token number */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: 4 }}>
                <Ionicons name="receipt-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Token:{' '}
                  <Text style={[theme.typography.label, { color: theme.colors.text }]}>
                    #{after.tokenNumber ?? '—'}
                  </Text>
                </Text>
              </View>

              {/* Line 3: commission original → override */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                backgroundColor: withAlpha(isDiff ? theme.colors.warning : theme.colors.primary, 0.06),
                borderRadius: theme.borderRadius.sm,
                padding: theme.spacing.xs,
              }}>
                <Ionicons name="swap-horizontal-outline" size={14} color={isDiff ? theme.colors.warning : theme.colors.textSecondary} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Commission:</Text>
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
                  {fmtAmt(originalAmt)}
                </Text>
                <Ionicons name="arrow-forward" size={12} color={theme.colors.textSecondary} />
                <Text style={[theme.typography.label, { color: isDiff ? theme.colors.warning : theme.colors.text }]} allowFontScaling={false}>
                  {fmtAmt(overrideAmt)}
                </Text>
              </View>
            </AppCard>
          );
        }}
        ListFooterComponent={() => (
          <>
            {query.hasNextPage && (
              <AppButton
                title={query.isFetchingNextPage ? 'Loading...' : 'Load More'}
                variant="outline"
                onPress={handleLoadMore}
                loading={query.isFetchingNextPage}
                disabled={query.isFetchingNextPage}
                style={{ marginBottom: theme.spacing.sm }}
              />
            )}
            <View style={{ marginTop: theme.spacing.md }}>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Export</Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <AppButton title="PDF" variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
                <AppButton title="Excel" variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
                <AppButton title="CSV" variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
              </View>
            </View>
          </>
        )}
        ListEmptyComponent={() => (
          !query.isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.colors.success} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No commission overrides found
              </Text>
            </View>
          ) : null
        )}
      />
    </View>
  );
}
