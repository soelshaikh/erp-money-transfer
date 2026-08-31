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

export function DailyReportScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dailyReport', activeFilters],
    queryFn: () => (reportApi as any).getDailyReport(activeFilters),
  });

  const rows: any[] = (data as any)?.rows || [];
  const summary: any = (data as any)?.summary || {};

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'daily', ...activeFilters });
    } catch (err: any) {
      showToast('error', 'Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading daily report..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
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

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load report'} onRetry={refetch} />}

      {/* Summary Cards */}
      {Object.keys(summary).length > 0 && (
        <>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Summary</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.h2, { color: theme.colors.primary }]} allowFontScaling={false}>
                {summary.totalCount ?? 0}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Total Txns</Text>
            </AppCard>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.h2, { color: theme.colors.success }]} allowFontScaling={false}>
                {summary.completedCount ?? 0}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Completed</Text>
            </AppCard>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                {fmtAmt(summary.totalAmount ?? 0)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Total Amount</Text>
            </AppCard>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.label, { color: theme.colors.secondary }]} allowFontScaling={false}>
                {fmtAmt(summary.totalCommission ?? 0)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Total Commission</Text>
            </AppCard>
          </View>
        </>
      )}

      {/* Daily Rows Table */}
      {rows.length > 0 && (
        <>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Daily Breakdown</Text>
          <AppCard style={{ marginBottom: theme.spacing.md, padding: 0 }}>
            {/* Table Header */}
            <View style={{
              flexDirection: 'row',
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
              backgroundColor: withAlpha(theme.colors.primary, 0.08),
              borderTopLeftRadius: theme.borderRadius.md,
              borderTopRightRadius: theme.borderRadius.md,
            }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, fontWeight: '600' }]}>Date</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1, textAlign: 'center', fontWeight: '600' }]}>Count</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Amount</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Commission</Text>
            </View>
            <FlatList
              data={rows}
              keyExtractor={(item: any, index: number) => item.date ?? String(index)}
              scrollEnabled={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }: { item: any; index: number }) => (
                <View style={{
                  flexDirection: 'row',
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.sm,
                  backgroundColor: index % 2 === 1 ? withAlpha(theme.colors.primary, 0.06) : 'transparent',
                  alignItems: 'center',
                }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2 }]}>{fmtDate(item.date)}</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1, textAlign: 'center' }]} allowFontScaling={false}>
                    {item.count ?? 0}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.primary, flex: 2, textAlign: 'right' }]} allowFontScaling={false}>
                    {fmtAmt(item.totalAmount ?? 0)}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.secondary, flex: 2, textAlign: 'right' }]} allowFontScaling={false}>
                    {fmtAmt(item.totalCommission ?? 0)}
                  </Text>
                </View>
              )}
            />
          </AppCard>
        </>
      )}

      {/* Export */}
      <View style={{ marginTop: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Export</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <AppButton title="PDF" variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
          <AppButton title="Excel" variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
          <AppButton title="CSV" variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
        </View>
      </View>
    </ScrollView>
  );
}
