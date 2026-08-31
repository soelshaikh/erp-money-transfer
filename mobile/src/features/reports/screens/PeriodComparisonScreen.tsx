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

type Period = 'week' | 'month' | 'quarter';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

function growthColor(pct: number | null | undefined, theme: any): string {
  if (pct == null || pct === 0) return theme.colors.textSecondary;
  return pct > 0 ? theme.colors.success : theme.colors.error;
}

function formatPct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function PeriodComparisonScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [period, setPeriod] = useState<Period>('month');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['periodComparison', period],
    queryFn: () => (reportApi as any).getPeriodComparison({ period }),
  });

  const current: any = (data as any)?.current ?? {};
  const previous: any = (data as any)?.previous ?? {};
  const growth: any = (data as any)?.growth ?? {};

  const comparisonRows = [
    {
      label: 'Transactions',
      currentValue: String(current.count ?? 0),
      previousValue: String(previous.count ?? 0),
      growthPct: growth.countPct,
      isCurrency: false,
    },
    {
      label: 'Amount',
      currentValue: fmtAmt(current.totalAmount ?? 0),
      previousValue: fmtAmt(previous.totalAmount ?? 0),
      growthPct: growth.amountPct,
      isCurrency: true,
    },
    {
      label: 'Commission',
      currentValue: fmtAmt(current.totalCommission ?? 0),
      previousValue: fmtAmt(previous.totalCommission ?? 0),
      growthPct: growth.commissionPct,
      isCurrency: true,
    },
  ];

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'period-comparison', period });
    } catch (err: any) {
      showToast('error', 'Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading period comparison..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      {/* Period Chip Selector */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Period</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {PERIOD_OPTIONS.map((opt) => {
            const isSelected = period === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPeriod(opt.value)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: 1.5,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: isSelected ? withAlpha(theme.colors.primary, 0.10) : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={[
                  theme.typography.label,
                  { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load comparison'} onRetry={refetch} />}

      {/* Date Range Subtitle */}
      {(current.startDate || previous.startDate) && (
        <View style={{ marginBottom: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: 2 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary }} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Current: {current.startDate ? fmtDate(current.startDate) : '—'} → {current.endDate ? fmtDate(current.endDate) : '—'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.textSecondary }} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Previous: {previous.startDate ? fmtDate(previous.startDate) : '—'} → {previous.endDate ? fmtDate(previous.endDate) : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* Comparison Table */}
      {Object.keys(current).length > 0 && (
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
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, fontWeight: '600' }]}>Metric</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Current</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1, textAlign: 'center', fontWeight: '600' }]}>Growth</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Previous</Text>
          </View>

          {comparisonRows.map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.sm,
                alignItems: 'center',
                backgroundColor: index % 2 === 1 ? withAlpha(theme.colors.primary, 0.06) : 'transparent',
                borderBottomWidth: index < comparisonRows.length - 1 ? 1 : 0,
                borderBottomColor: theme.colors.divider,
              }}
            >
              <Text style={[theme.typography.label, { color: theme.colors.text, flex: 2 }]}>
                {row.label}
              </Text>
              <Text
                style={[theme.typography.label, { color: theme.colors.primary, flex: 2, textAlign: 'right' }]}
                allowFontScaling={false}
              >
                {row.currentValue}
              </Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  style={[
                    theme.typography.label,
                    { color: growthColor(row.growthPct, theme), fontSize: 12 },
                  ]}
                  allowFontScaling={false}
                >
                  {formatPct(row.growthPct)}
                </Text>
                {row.growthPct != null && row.growthPct !== 0 && (
                  <Ionicons
                    name={row.growthPct > 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={growthColor(row.growthPct, theme)}
                  />
                )}
              </View>
              <Text
                style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right' }]}
                allowFontScaling={false}
              >
                {row.previousValue}
              </Text>
            </View>
          ))}
        </AppCard>
      )}

      {/* Completed count summary */}
      {(current.completedCount != null || previous.completedCount != null) && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Completed (Current)</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.success }]} allowFontScaling={false}>
              {current.completedCount ?? 0}
            </Text>
          </AppCard>
          <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Completed (Prev)</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
              {previous.completedCount ?? 0}
            </Text>
          </AppCard>
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
