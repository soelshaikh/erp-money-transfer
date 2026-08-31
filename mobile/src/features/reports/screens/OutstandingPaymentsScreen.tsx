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

export function OutstandingPaymentsScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const query = useInfiniteQuery({
    queryKey: ['outstandingPayments', activeFilters],
    queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
      (reportApi as any).getOutstandingPayments({ ...activeFilters, page: pageParam }),
    getNextPageParam: (last: any) =>
      last.page < Math.ceil(last.total / last.limit) ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const items: any[] = query.data?.pages.flatMap((p: any) => p.data) || [];

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'outstanding', ...activeFilters });
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

  if (query.isLoading) return <LoadingScreen message="Loading outstanding payments..." />;

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
            {query.isError && (
              <ErrorMessage message={parseApiError(query.error) ?? 'Failed to load outstanding payments'} onRetry={query.refetch} />
            )}
            {items.length > 0 && (
              <View style={{
                backgroundColor: withAlpha(theme.colors.warning, 0.12),
                borderRadius: theme.borderRadius.md,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.warning,
                padding: theme.spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.colors.warning} />
                <Text style={[theme.typography.label, { color: theme.colors.warning, flex: 1 }]}>
                  {items.length} approved payment{items.length !== 1 ? 's' : ''} awaiting payout
                </Text>
              </View>
            )}
          </>
        )}
        renderItem={({ item }: { item: any }) => (
          <AppCard style={{
            marginBottom: theme.spacing.sm,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.warning,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.label, { color: theme.colors.text, fontWeight: '700' }]}>
                  #{item.tokenNumber}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  Payout: {item.payoutBranchId?.name ?? '—'} ({item.payoutBranchId?.code ?? '—'})
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  Collection: {item.collectionBranchId?.name ?? '—'} ({item.collectionBranchId?.code ?? '—'})
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  Approved: {item.approvedAt ? fmtDate(item.approvedAt) : '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[theme.typography.label, { color: theme.colors.warning, fontSize: 16 }]} allowFontScaling={false}>
                  {fmtAmt(item.finalAmount ?? 0)}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Collected: <Text allowFontScaling={false}>{fmtAmt(item.amount ?? 0)}</Text>
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
              <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.colors.success} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No outstanding payments
              </Text>
            </View>
          ) : null
        )}
      />
    </View>
  );
}
