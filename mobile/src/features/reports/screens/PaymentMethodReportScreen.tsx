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

function methodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    neft: 'NEFT',
    rtgs: 'RTGS',
    bank_transfer: 'IMPS',
  };
  return map[method] ?? method.toUpperCase();
}

function methodIcon(method: string): React.ComponentProps<typeof Ionicons>['name'] {
  const iconMap: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    cash: 'cash-outline',
    neft: 'swap-horizontal-outline',
    rtgs: 'git-network-outline',
    bank_transfer: 'card-outline',
  };
  return iconMap[method] ?? 'ellipse-outline';
}

function methodColor(method: string, theme: any): string {
  const colorMap: Record<string, string> = {
    cash: theme.colors.success,
    neft: theme.colors.primary,
    rtgs: theme.colors.secondary,
    bank_transfer: theme.colors.warning,
  };
  return colorMap[method] ?? theme.colors.textSecondary;
}

export function PaymentMethodReportScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['paymentMethods', activeFilters],
    queryFn: () => (reportApi as any).getPaymentMethods(activeFilters),
  });

  const methods: any[] = (data as any)?.methods || [];
  const summary: any = (data as any)?.summary || {};

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'payment-methods', ...activeFilters });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading payment methods report..." />;

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

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load payment methods'} onRetry={refetch} />}

      {/* Method Cards */}
      {methods.length === 0 && !isError && (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Ionicons name="card-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
            No payment method data for selected period
          </Text>
        </View>
      )}

      {methods.map((item: any) => {
        const color = methodColor(item.method, theme);
        return (
          <AppCard key={item.method} style={{ marginBottom: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: withAlpha(color, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: theme.spacing.sm,
              }}>
                <Ionicons name={methodIcon(item.method)} size={20} color={color} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
                {methodLabel(item.method)}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm }} />

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Count</Text>
                <Text style={[theme.typography.h3, { color }]} allowFontScaling={false}>
                  {item.count ?? 0}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 2, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Total Amount</Text>
                <Text style={[theme.typography.label, { color: theme.colors.text }]} allowFontScaling={false}>
                  {fmtAmt(item.totalAmount ?? 0)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flex: 2, alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Commission</Text>
                <Text style={[theme.typography.label, { color: theme.colors.secondary }]} allowFontScaling={false}>
                  {fmtAmt(item.totalCommission ?? 0)}
                </Text>
              </View>
            </View>
          </AppCard>
        );
      })}

      {/* Summary Totals */}
      {Object.keys(summary).length > 0 && (
        <AppCard style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.md, backgroundColor: withAlpha(theme.colors.primary, 0.06) }}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Overall Summary</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Total Transactions</Text>
              <Text style={[theme.typography.h3, { color: theme.colors.primary }]} allowFontScaling={false}>
                {summary.totalCount ?? 0}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
            <View style={{ flex: 2, alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Total Amount</Text>
              <Text style={[theme.typography.label, { color: theme.colors.text }]} allowFontScaling={false}>
                {fmtAmt(summary.totalAmount ?? 0)}
              </Text>
            </View>
          </View>
        </AppCard>
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
