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

export function BranchFlowMatrixScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branchFlowMatrix', activeFilters],
    queryFn: () => (reportApi as any).getBranchFlowMatrix({ fromDate: activeFilters.startDate, toDate: activeFilters.endDate }),
  });

  // Sort corridors by totalAmount descending
  const corridors: any[] = [...((data as any)?.corridors || [])].sort(
    (a: any, b: any) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0)
  );
  const totalCorridors: number = (data as any)?.totalCorridors ?? 0;

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'branch-flow', ...activeFilters });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading branch flow matrix..." />;

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

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load matrix'} onRetry={refetch} />}

      {totalCorridors > 0 && (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {totalCorridors} active corridor{totalCorridors !== 1 ? 's' : ''}
        </Text>
      )}

      {corridors.length > 0 && (
        <AppCard style={{ padding: 0, marginBottom: theme.spacing.md }}>
          {/* Table Header */}
          <View style={{
            flexDirection: 'row',
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm,
            backgroundColor: withAlpha(theme.colors.primary, 0.08),
            borderTopLeftRadius: theme.borderRadius.md,
            borderTopRightRadius: theme.borderRadius.md,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 3, fontWeight: '600' }]}>Corridor</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1, textAlign: 'center', fontWeight: '600' }]}>Count</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Amount</Text>
          </View>
          <FlatList
            data={corridors}
            keyExtractor={(item: any, index: number) =>
              `${item.fromBranchCode ?? ''}-${item.toBranchCode ?? ''}-${index}`
            }
            scrollEnabled={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={10}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
            )}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <View style={{
                flexDirection: 'row',
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.sm,
                alignItems: 'center',
                backgroundColor: index % 2 === 1 ? withAlpha(theme.colors.primary, 0.06) : 'transparent',
              }}>
                <View style={{ flex: 3 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.fromBranchName ?? '—'} ({item.fromBranchCode ?? '—'})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="arrow-forward" size={10} color={theme.colors.textSecondary} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginLeft: 2 }]} numberOfLines={1}>
                      {item.toBranchName ?? '—'} ({item.toBranchCode ?? '—'})
                    </Text>
                  </View>
                </View>
                <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1, textAlign: 'center' }]} allowFontScaling={false}>
                  {item.count ?? 0}
                </Text>
                <View style={{ flex: 2, alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.primary }]} allowFontScaling={false}>
                    {fmtAmt(item.totalAmount ?? 0)}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
                    Comm: {fmtAmt(item.totalCommission ?? 0)}
                  </Text>
                </View>
              </View>
            )}
          />
        </AppCard>
      )}

      {corridors.length === 0 && !isError && (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Ionicons name="git-branch-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
            No corridor data for selected period
          </Text>
        </View>
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
