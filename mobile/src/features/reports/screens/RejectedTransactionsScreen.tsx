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

export function RejectedTransactionsScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const query = useInfiniteQuery({
    queryKey: ['rejectedTransactions', activeFilters],
    queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
      (reportApi as any).getRejectedTransactions({ ...activeFilters, page: pageParam }),
    getNextPageParam: (last: any) =>
      last.page < Math.ceil(last.total / last.limit) ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const items: any[] = query.data?.pages.flatMap((p: any) => p.data) || [];

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'rejected', ...activeFilters });
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

  if (query.isLoading) return <LoadingScreen message="Loading rejected transactions..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item: any, index: number) => item.tokenNumber ?? String(index)}
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
              <ErrorMessage message={parseApiError(query.error) ?? 'Failed to load rejected transactions'} onRetry={query.refetch} />
            )}
          </>
        )}
        renderItem={({ item }: { item: any }) => (
          <AppCard style={{
            marginBottom: theme.spacing.sm,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.error,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                <Text style={[theme.typography.label, { color: theme.colors.text, fontWeight: '700' }]}>
                  #{item.tokenNumber}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  {item.collectionBranchId?.name ?? '—'} → {item.payoutBranchId?.name ?? '—'}
                </Text>
                {item.remarks ? (
                  <View style={{
                    marginTop: theme.spacing.xs,
                    backgroundColor: withAlpha(theme.colors.error, 0.06),
                    borderRadius: theme.borderRadius.sm,
                    padding: theme.spacing.xs,
                  }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.error }]}>
                      "{item.remarks}"
                    </Text>
                  </View>
                ) : null}
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                  Rejected by {item.approvedBy?.name ?? '—'} · {item.approvedAt ? fmtDate(item.approvedAt) : fmtDate(item.createdAt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[theme.typography.label, { color: theme.colors.error }]} allowFontScaling={false}>
                  {fmtAmt(item.amount ?? 0)}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {fmtDate(item.createdAt)}
                </Text>
              </View>
            </View>
          </AppCard>
        )}
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
              <Ionicons name="close-circle-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No rejected transactions
              </Text>
            </View>
          ) : null
        )}
      />
    </View>
  );
}
