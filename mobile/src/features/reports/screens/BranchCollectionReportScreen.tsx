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

export function BranchCollectionReportScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branchCollectionReport', activeFilters],
    queryFn: () => (reportApi as any).getBranchCollectionReport(activeFilters),
  });

  const branches: any[] = (data as any)?.branches || [];

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'branch-collection', ...activeFilters });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading branch collection report..." />;

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

      {/* Branch Cards */}
      {branches.length === 0 && !isError && (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Ionicons name="business-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
            No data for selected period
          </Text>
        </View>
      )}

      {branches.map((branch: any) => (
        <AppCard key={branch.branchId} style={{ marginBottom: theme.spacing.md }}>
          {/* Branch Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.divider,
          }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: withAlpha(theme.colors.primary, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: theme.spacing.sm,
            }}>
              <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                {branch.branchCode?.slice(0, 2).toUpperCase() ?? '--'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>{branch.branchName}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{branch.branchCode}</Text>
            </View>
          </View>

          {/* Two-column section: Collection | Payout */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {/* Collection Side */}
            <View style={{
              flex: 1,
              backgroundColor: withAlpha(theme.colors.primary, 0.06),
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
                <Ionicons name="arrow-down-circle-outline" size={14} color={theme.colors.primary} />
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', marginLeft: 4 }]}>Collection</Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {branch.collection?.count ?? 0} txns collected
              </Text>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginTop: 2 }]} allowFontScaling={false}>
                {fmtAmt(branch.collection?.totalAmount ?? 0)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.secondary, marginTop: 2 }]} allowFontScaling={false}>
                Comm: {fmtAmt(branch.collection?.totalCommission ?? 0)}
              </Text>
            </View>

            {/* Payout Side */}
            <View style={{
              flex: 1,
              backgroundColor: withAlpha(theme.colors.success, 0.06),
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
                <Ionicons name="arrow-up-circle-outline" size={14} color={theme.colors.success} />
                <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '600', marginLeft: 4 }]}>Payout</Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {branch.payout?.count ?? 0} txns paid out
              </Text>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginTop: 2 }]} allowFontScaling={false}>
                {fmtAmt(branch.payout?.totalFinalAmount ?? 0)}
              </Text>
            </View>
          </View>
        </AppCard>
      ))}

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
