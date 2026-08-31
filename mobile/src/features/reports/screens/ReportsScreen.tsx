import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { reportApi, downloadReport } from '../api/reportApi';
import { transactionApi } from '../../transaction/api/transactionApi';
import { settingsApi } from '../../settings/api/settingsApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { FilterPanel } from '../../../shared/components/FilterPanel';
import { FilterChipGroup } from '../../../shared/components/FilterChipGroup';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { showToast } from '../../../utils/toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function thisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function fmtPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'All time';
  if (startDate && endDate && startDate === endDate) return fmtDate(startDate);
  if (startDate && !endDate) return `From ${fmtDate(startDate)}`;
  if (!startDate && endDate) return `Up to ${fmtDate(endDate)}`;
  return `${fmtDate(startDate!)} – ${fmtDate(endDate!)}`;
}

// Converts "2026-07" or "Jul 2026" → { fromDate, toDate } covering the whole month
function monthRange(ym: string): { fromDate: string; toDate: string } {
  // Try YYYY-MM first
  const dashMatch = ym.match(/^(\d{4})-(\d{2})$/);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month, 0); // day 0 = last day of previous month = last of `month`
    const toDate = toYMD(lastDate);
    return { fromDate: firstDay, toDate };
  }
  // Fallback: treat as-is
  return { fromDate: ym, toDate: ym };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, theme }: { label: string; value: any; color?: string; theme: any }) {
  return (
    <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.md }}>
      <Text
        style={[theme.typography.h2, { color: color || theme.colors.primary }]}
        allowFontScaling={false}
      >
        {value ?? '—'}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xs }]}>
        {label}
      </Text>
    </AppCard>
  );
}

interface ColDef { label: string; flex: number; align?: 'left' | 'right' }

function TableHeader({ cols, theme }: { cols: ColDef[]; theme: any }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: withAlpha(theme.colors.primary, 0.06),
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      marginBottom: theme.spacing.xs,
    }}>
      {cols.map((col) => (
        <Text
          key={col.label}
          style={[theme.typography.caption, {
            color: theme.colors.textSecondary,
            fontWeight: '700',
            flex: col.flex,
            textAlign: col.align || 'left',
          }]}
          allowFontScaling={false}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

function EmptyRow({ message, theme }: { message: string; theme: any }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
      <Ionicons name="bar-chart-outline" size={32} color={withAlpha(theme.colors.textSecondary, 0.38)} />
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
        {message}
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const [isExporting, setIsExporting] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const DEFAULT_FROM = thisMonthStart();
  const DEFAULT_TO = toYMD(new Date());

  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);
  const [type, setType] = useState('daily');
  const [activeFilters, setActiveFilters] = useState<any>({
    startDate: DEFAULT_FROM,
    endDate: DEFAULT_TO,
    type: 'daily',
  });

  const isHeadOffice = user?.role === 'head_office';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', activeFilters],
    queryFn: () => reportApi.getReports(activeFilters),
  });

  const { data: commissionData } = useQuery({
    queryKey: ['commissionSummary', activeFilters],
    queryFn: () => transactionApi.getCommissionSummary({ fromDate: activeFilters.startDate, toDate: activeFilters.endDate }),
    enabled: isHeadOffice,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60_000,
  });

  const { data: balancesData } = useQuery({
    queryKey: ['allBranchBalances', activeFilters],
    queryFn: () => reportApi.getAllBranchBalances(activeFilters),
    enabled: isHeadOffice && activeFilters.type === 'daily',
  });

  const allowedFormats: string[] = (settingsData as any)?.features?.exportFormats ?? ['csv', 'excel', 'pdf'];

  const applyFilters = () => {
    setActiveFilters({ startDate: fromDate || undefined, endDate: toDate || undefined, type });
  };

  const clearFilters = () => {
    setFromDate(DEFAULT_FROM);
    setToDate(DEFAULT_TO);
    setType('daily');
    setActiveFilters({ startDate: DEFAULT_FROM, endDate: DEFAULT_TO, type: 'daily' });
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({
        format,
        reportType: activeFilters.type || type,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate,
      });
    } catch (err: any) {
      showToast('error', 'Export failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message={t('reports.loading')} />;

  const summary = (data as any)?.summary || {};
  const branchBreakdown: any[] = (data as any)?.branchBreakdown || [];
  const dailyBreakdown: any[] = (data as any)?.dailyBreakdown || [];
  const monthlyBreakdown: any[] = (data as any)?.monthlyBreakdown || [];
  const commissionBranches: any[] = (commissionData as any)?.branches || [];
  const balanceDates: any[] = (balancesData as any)?.dates || [];

  const hasSummary = Object.keys(summary).length > 0;

  const TYPE_OPTIONS = [
    { label: t('reports.daily'), value: 'daily' },
    { label: t('reports.monthly'), value: 'monthly' },
    ...(isHeadOffice ? [{ label: t('reports.branchActivity'), value: 'branch' }] : []),
  ];

  const rowStyle = (index: number) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: index % 2 === 1 ? withAlpha(theme.colors.primary, 0.04) : 'transparent',
    borderRadius: theme.borderRadius.sm,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <FilterPanel
        visible
        onClear={clearFilters}
        onApply={applyFilters}
        theme={theme}
        style={{ marginBottom: theme.spacing.md }}
      >
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          theme={theme}
        />
        <FilterChipGroup
          options={TYPE_OPTIONS}
          selected={type}
          onSelect={setType}
          theme={theme}
          label="Group By"
        />
      </FilterPanel>

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}

      {/* ── Active period label ───────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        <Ionicons name="calendar-outline" size={14} color={theme.colors.primary} />
        <Text
          style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}
          allowFontScaling={false}
        >
          {fmtPeriod(activeFilters.startDate, activeFilters.endDate)}
        </Text>
      </View>

      {/* ── Summary grid ─────────────────────────────────────────────────────── */}
      <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
        {t('reports.summary')}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <SummaryCard label={t('reports.total')} value={summary.totalTransactions ?? 0} theme={theme} />
        <SummaryCard label={t('reports.completed')} value={summary.completedCount ?? 0} color={theme.colors.success} theme={theme} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <SummaryCard label={t('reports.pending')} value={summary.pendingCount ?? 0} color={theme.colors.warning} theme={theme} />
        <SummaryCard label={t('reports.rejected')} value={summary.rejectedCount ?? 0} color={theme.colors.error} theme={theme} />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        <SummaryCard label={t('reports.totalAmount')} value={fmtAmt(summary.totalAmountPaisa || 0)} theme={theme} />
        <SummaryCard label={t('reports.commission')} value={fmtAmt(summary.totalCommissionPaisa || 0)} color={theme.colors.secondary} theme={theme} />
      </View>

      {/* ── Daily breakdown ───────────────────────────────────────────────────── */}
      {activeFilters.type === 'daily' && (
        <>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {t('reports.daily')}
          </Text>
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            {dailyBreakdown.length === 0 ? (
              <EmptyRow message="No daily data for this period" theme={theme} />
            ) : (
              <>
                <TableHeader
                  cols={[
                    { label: 'Date', flex: 2.5 },
                    { label: 'Txns', flex: 1, align: 'right' },
                    { label: 'Amount', flex: 2.5, align: 'right' },
                    { label: 'Commission', flex: 2.5, align: 'right' },
                  ]}
                  theme={theme}
                />
                {dailyBreakdown.map((entry: any, index: number) => (
                  <TouchableOpacity
                    key={entry.date}
                    onPress={() => navigation.navigate('ReportTransactions', {
                      fromDate: entry.date,
                      toDate: entry.date,
                      title: fmtDate(entry.date),
                    })}
                    activeOpacity={0.7}
                  >
                    <View style={rowStyle(index)}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2.5 }]} numberOfLines={1}>
                        {entry.date}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', flex: 1, textAlign: 'right' }]} allowFontScaling={false}>
                        {entry.count}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 2.5, textAlign: 'right' }]} allowFontScaling={false} numberOfLines={1}>
                        {fmtAmt(entry.totalAmount || 0)}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.secondary, flex: 2.5, textAlign: 'right' }]} allowFontScaling={false} numberOfLines={1}>
                        {fmtAmt(entry.totalCommission || 0)}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={withAlpha(theme.colors.textSecondary, 0.5)} style={{ marginLeft: theme.spacing.xs }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </AppCard>

          {/* Daily EOD Balance — HO only, expandable per branch */}
          {isHeadOffice && balanceDates.length > 0 && (
            <>
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                Daily Balance (EOD)
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
                Tap a row to see per-branch breakdown
              </Text>
              <AppCard style={{ marginBottom: theme.spacing.md }}>
                <TableHeader
                  cols={[
                    { label: 'Date', flex: 1.5 },
                    { label: 'Opening', flex: 1.5, align: 'right' },
                    { label: 'EOD', flex: 1.5, align: 'right' },
                    { label: 'Change', flex: 1, align: 'right' },
                  ]}
                  theme={theme}
                />
                {balanceDates.map((entry: any, index: number) => {
                  const branches: any[] = entry.branches || [];
                  const totalOpening = branches.reduce(
                    (sum: number, b: any) => sum + (b.openingBalance ?? 0),
                    0,
                  );
                  const eodBalance = entry.netClosing ?? 0;
                  const change = eodBalance - totalOpening;
                  const changeColor = change >= 0 ? theme.colors.success : theme.colors.error;
                  const isExpanded = expandedDates.has(entry.date);
                  return (
                    <View key={entry.date}>
                      {/* Date summary row — tappable to expand */}
                      <TouchableOpacity onPress={() => toggleDate(entry.date)} activeOpacity={0.7}>
                        <View style={rowStyle(index)}>
                          <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                            <Ionicons
                              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                              size={12}
                              color={theme.colors.primary}
                            />
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                              {entry.date}
                            </Text>
                          </View>
                          <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 1.5, textAlign: 'right' }]} allowFontScaling={false}>
                            {fmtAmt(totalOpening)}
                          </Text>
                          <Text style={[theme.typography.label, { color: theme.colors.primary, flex: 1.5, textAlign: 'right' }]} allowFontScaling={false}>
                            {fmtAmt(eodBalance)}
                          </Text>
                          <Text style={[theme.typography.caption, { color: changeColor, flex: 1, textAlign: 'right', fontWeight: '600' }]} allowFontScaling={false}>
                            {change >= 0 ? '+' : ''}{fmtAmt(change)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded: per-branch rows */}
                      {isExpanded && branches.length > 0 && (
                        <View style={{
                          marginLeft: theme.spacing.md,
                          marginTop: theme.spacing.xs,
                          marginBottom: theme.spacing.sm,
                          borderLeftWidth: 2,
                          borderLeftColor: withAlpha(theme.colors.primary, 0.2),
                          paddingLeft: theme.spacing.sm,
                        }}>
                          {/* Branch sub-header */}
                          <View style={{ flexDirection: 'row', paddingVertical: theme.spacing.xs }}>
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 2 }]}>Branch</Text>
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 1.5, textAlign: 'right' }]}>Opening</Text>
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 1.5, textAlign: 'right' }]}>EOD</Text>
                            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 1, textAlign: 'right' }]}>Change</Text>
                          </View>
                          {branches.map((b: any, bi: number) => {
                            const bOpen = b.openingBalance ?? 0;
                            const bEod = b.closingBalance ?? b.eodBalance ?? b.balance ?? 0;
                            const bChange = bEod - bOpen;
                            const bChangeColor = bChange >= 0 ? theme.colors.success : theme.colors.error;
                            return (
                              <View
                                key={b.branchId || bi}
                                style={{
                                  flexDirection: 'row',
                                  paddingVertical: theme.spacing.xs,
                                  backgroundColor: bi % 2 === 1 ? withAlpha(theme.colors.primary, 0.04) : 'transparent',
                                  borderRadius: theme.borderRadius.sm,
                                }}
                              >
                                <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 2 }]} numberOfLines={1}>
                                  {b.branchName || b.name || '—'}
                                </Text>
                                <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 1.5, textAlign: 'right' }]} allowFontScaling={false}>
                                  {fmtAmt(bOpen)}
                                </Text>
                                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', flex: 1.5, textAlign: 'right' }]} allowFontScaling={false}>
                                  {fmtAmt(bEod)}
                                </Text>
                                <Text style={[theme.typography.caption, { color: bChangeColor, fontWeight: '600', flex: 1, textAlign: 'right' }]} allowFontScaling={false}>
                                  {bChange >= 0 ? '+' : ''}{fmtAmt(bChange)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </AppCard>
            </>
          )}
        </>
      )}

      {/* ── Monthly breakdown ─────────────────────────────────────────────────── */}
      {activeFilters.type === 'monthly' && (
        <>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {t('reports.monthly')}
          </Text>
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            {monthlyBreakdown.length === 0 ? (
              <EmptyRow message="No monthly data for this period" theme={theme} />
            ) : (
              <>
                <TableHeader
                  cols={[
                    { label: 'Month', flex: 2.5 },
                    { label: 'Txns', flex: 1, align: 'right' },
                    { label: 'Amount', flex: 2.5, align: 'right' },
                    { label: 'Commission', flex: 2.5, align: 'right' },
                  ]}
                  theme={theme}
                />
                {monthlyBreakdown.map((entry: any, index: number) => {
                  const range = monthRange(entry.month);
                  return (
                    <TouchableOpacity
                      key={entry.month}
                      onPress={() => navigation.navigate('ReportTransactions', {
                        fromDate: range.fromDate,
                        toDate: range.toDate,
                        title: entry.month,
                      })}
                      activeOpacity={0.7}
                    >
                      <View style={rowStyle(index)}>
                        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2.5 }]} numberOfLines={1}>
                          {entry.month}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', flex: 1, textAlign: 'right' }]} allowFontScaling={false}>
                          {entry.count}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 2.5, textAlign: 'right' }]} allowFontScaling={false} numberOfLines={1}>
                          {fmtAmt(entry.totalAmount || 0)}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.secondary, flex: 2.5, textAlign: 'right' }]} allowFontScaling={false} numberOfLines={1}>
                          {fmtAmt(entry.totalCommission || 0)}
                        </Text>
                        <Ionicons name="chevron-forward" size={12} color={withAlpha(theme.colors.textSecondary, 0.5)} style={{ marginLeft: theme.spacing.xs }} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </AppCard>
        </>
      )}

      {/* ── Branch breakdown (HO only) ────────────────────────────────────────── */}
      {isHeadOffice && activeFilters.type === 'branch' && (
        <>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {t('reports.branchActivity')}
          </Text>
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            {branchBreakdown.length === 0 ? (
              <EmptyRow message="No branch data for this period" theme={theme} />
            ) : (
              <>
                <TableHeader
                  cols={[
                    { label: 'Branch', flex: 3 },
                    { label: 'Txns', flex: 1, align: 'right' },
                    { label: 'Amount', flex: 3, align: 'right' },
                  ]}
                  theme={theme}
                />
                {branchBreakdown.map((b: any, index: number) => (
                  <TouchableOpacity
                    key={b.branchId}
                    onPress={() => navigation.navigate('ReportTransactions', {
                      fromDate: activeFilters.startDate,
                      toDate: activeFilters.endDate,
                      branchId: b.branchId,
                      branchRole: 'collection',
                      title: b.branchName,
                    })}
                    activeOpacity={0.7}
                  >
                    <View style={rowStyle(index)}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 3 }]} numberOfLines={1}>
                        {b.branchName}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', flex: 1, textAlign: 'right' }]} allowFontScaling={false}>
                        {b.count}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 3, textAlign: 'right' }]} allowFontScaling={false} numberOfLines={1}>
                        {fmtAmt(b.totalAmountPaisa || 0)}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={withAlpha(theme.colors.textSecondary, 0.5)} style={{ marginLeft: theme.spacing.xs }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </AppCard>

          {commissionBranches.length > 0 && (
            <>
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                {t('reports.commByBranch')}
              </Text>
              <AppCard style={{ marginBottom: theme.spacing.md }}>
                <TableHeader
                  cols={[
                    { label: 'Branch', flex: 3 },
                    { label: 'Commission', flex: 3, align: 'right' },
                  ]}
                  theme={theme}
                />
                {commissionBranches.map((b: any, index: number) => (
                  <View key={String(b.branchId)} style={rowStyle(index)}>
                    <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 3 }]} numberOfLines={1}>
                      {b.branchName || 'Unknown Branch'}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.secondary, fontWeight: '600', flex: 3, textAlign: 'right' }]} allowFontScaling={false}>
                      {fmtAmt(b.totalCommission || 0)}
                    </Text>
                  </View>
                ))}
              </AppCard>
            </>
          )}
        </>
      )}

      {/* ── Export ───────────────────────────────────────────────────────────── */}
      {hasSummary && allowedFormats.length > 0 && (
        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {t('reports.export')}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {allowedFormats.includes('excel') && (
              <AppButton title={t('reports.excel')} variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
            )}
            {allowedFormats.includes('pdf') && (
              <AppButton title={t('reports.pdf')} variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
            )}
            {allowedFormats.includes('csv') && (
              <AppButton title={t('reports.csv')} variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
