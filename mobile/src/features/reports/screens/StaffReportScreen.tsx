import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
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
import { fmtAmt } from '../../../utils/fmt';

export function StaffReportScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['staffReport', activeFilters],
    queryFn: () => (reportApi as any).getStaffReport({ fromDate: activeFilters.startDate, toDate: activeFilters.endDate }),
  });

  // Sort by count descending
  const staff: any[] = [...((data as any)?.staff || [])].sort(
    (a: any, b: any) => (b.count ?? 0) - (a.count ?? 0)
  );

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'staff', ...activeFilters });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading staff report..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={staff}
        keyExtractor={(item: any) => item.userId ?? item.username ?? String(Math.random())}
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

            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load staff report'} onRetry={refetch} />}

            {staff.length > 0 && (
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                Staff Performance
              </Text>
            )}
          </>
        )}
        renderItem={({ item, index }: { item: any; index: number }) => (
          <AppCard style={{ marginBottom: theme.spacing.sm }}>
            {/* Top row: name + count */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                <Text style={[theme.typography.label, { color: theme.colors.text }]}>
                  {item.name ?? item.username}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  @{item.username}
                </Text>
              </View>
              <View style={{
                backgroundColor: withAlpha(theme.colors.primary, 0.12),
                borderRadius: theme.borderRadius.full,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                alignItems: 'center',
              }}>
                <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                  {item.count ?? 0} txns
                </Text>
              </View>
            </View>

            {/* Bottom row: branch + amounts */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.divider,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {item.branchName ?? 'Head Office'}{item.branchCode ? ` (${item.branchCode})` : ''}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {item.role}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>
                  Total: <Text style={{ color: theme.colors.primary, fontWeight: '600' }} allowFontScaling={false}>{fmtAmt(item.totalAmount ?? 0)}</Text>
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Comm: <Text allowFontScaling={false}>{fmtAmt(item.totalCommission ?? 0)}</Text>
                </Text>
              </View>
            </View>
          </AppCard>
        )}
        ListEmptyComponent={() => (
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No staff data for selected period
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
