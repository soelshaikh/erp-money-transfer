import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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

type FlatItem =
  | { type: 'header'; date: string; netClosing: number; key: string }
  | { type: 'branch'; branchId: string; branchName: string; branchCode: string; openingBalance: number; closingBalance: number; dateKey: string; key: string };

export function AllBranchBalancesScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['allBranchBalances', activeFilters],
    queryFn: () => (reportApi as any).getAllBranchBalances(activeFilters),
  });

  const dates: any[] = (data as any)?.dates || [];

  // Flatten into a list of header + branch rows for a single FlatList
  const flatItems: FlatItem[] = dates.flatMap((entry: any) => {
    const headerItem: FlatItem = {
      type: 'header',
      date: entry.date,
      netClosing: entry.netClosing ?? 0,
      key: `header-${entry.date}`,
    };
    const branchItems: FlatItem[] = (entry.branches || []).map((b: any) => ({
      type: 'branch',
      branchId: b.branchId,
      branchName: b.branchName,
      branchCode: b.branchCode,
      openingBalance: b.openingBalance ?? 0,
      closingBalance: b.closingBalance ?? 0,
      dateKey: entry.date,
      key: `branch-${entry.date}-${b.branchId}`,
    }));
    return [headerItem, ...branchItems];
  });

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'all-branch-balances', ...activeFilters });
    } catch (err: any) {
      showToast('error', 'Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading branch balances..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={flatItems}
        keyExtractor={(item: FlatItem) => item.key}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
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

            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load balances'} onRetry={refetch} />}
          </>
        )}
        renderItem={({ item }: { item: FlatItem }) => {
          if (item.type === 'header') {
            return (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: withAlpha(theme.colors.primary, 0.10),
                borderRadius: theme.borderRadius.md,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                marginTop: theme.spacing.sm,
                marginBottom: 2,
              }}>
                <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
                  {fmtDate(item.date)}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Net Closing</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                    {fmtAmt(item.netClosing)}
                  </Text>
                </View>
              </View>
            );
          }

          // type === 'branch'
          const branchItem = item as Extract<FlatItem, { type: 'branch' }>;
          return (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingLeft: theme.spacing.lg + theme.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.divider,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600' }]}>
                  {branchItem.branchCode}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                  {branchItem.branchName}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Open: <Text style={{ color: theme.colors.text }} allowFontScaling={false}>{fmtAmt(branchItem.openingBalance)}</Text>
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Close: <Text style={{ color: theme.colors.primary, fontWeight: '600' }} allowFontScaling={false}>{fmtAmt(branchItem.closingBalance)}</Text>
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
              <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No balance data for selected period
              </Text>
            </View>
          ) : null
        )}
        ListFooterComponent={() => (
          <View style={{ marginTop: theme.spacing.md }}>
            <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Export</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <AppButton title="PDF" variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
              <AppButton title="Excel" variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
              <AppButton title="CSV" variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      />
    </View>
  );
}
