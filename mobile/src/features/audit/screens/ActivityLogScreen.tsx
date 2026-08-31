import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RefreshButton } from '../../../shared/components/RefreshButton';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { FilterChipGroup } from '../../../shared/components/FilterChipGroup';
import { FilterPanel } from '../../../shared/components/FilterPanel';
import { auditLogApi } from '../api/auditLogApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtDateTime } from '../../../utils/fmt';

const LIMIT = 20;

const MODULE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Transactions', value: 'Transaction' },
  { label: 'Branches', value: 'Branch' },
  { label: 'Users', value: 'User' },
  { label: 'Auth', value: 'Auth' },
  { label: 'Settings', value: 'Settings' },
];

const MODULE_COLORS: Record<string, string> = {
  Transaction: '#1A73E8',
  Branch: '#34A853',
  User: '#8B5CF6',
  Auth: '#F59E0B',
  Settings: '#6B7280',
  Default: '#6B7280',
};

const MODULE_ICONS: Record<string, any> = {
  Transaction: 'swap-horizontal-outline',
  Branch: 'git-branch-outline',
  User: 'person-outline',
  Auth: 'lock-closed-outline',
  Settings: 'settings-outline',
  Default: 'document-text-outline',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#34A853',
  UPDATE: '#1A73E8',
  DELETE: '#EF4444',
  APPROVE: '#0D9488',
  REJECT: '#F59E0B',
  LOGIN: '#8B5CF6',
  PAYMENT_COMPLETE: '#0D9488',
  COMMISSION_OVERRIDE: '#D97706',
  PASSWORD_RESET: '#6B7280',
  EXPORT: '#6B7280',
};

function ActionBadge({ action, theme }: { action: string; theme: any }) {
  const color = ACTION_COLORS[action] || '#6B7280';
  return (
    <View style={{
      backgroundColor: withAlpha(color, 0.12),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }} allowFontScaling={false}>
        {action.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  username: 'Username',
  role: 'Role',
  status: 'Status',
  loginAllowedFrom: 'Login From',
  loginAllowedTo: 'Login To',
  amount: 'Amount (₹)',
  tokenNumber: 'Token',
  type: 'Type',
  city: 'City',
  state: 'State',
  code: 'Code',
  remarks: 'Remarks',
  paymentMethod: 'Payment Method',
  value: 'Value',
  enabled: 'Enabled',
  commissionType: 'Commission Type',
};

const SKIP_FIELDS = new Set([
  'tenantId', 'branchId', 'payoutBranchId', 'collectionBranchId', 'createdBy',
  '_id', '__v', 'updatedAt', 'createdAt', 'passwordHash', 'otpHash',
  'otpExpiry', 'refreshTokenHash', 'userId',
]);

function humanizeKey(key: string): string {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

interface DetailSectionProps { log: any; theme: any; }
function DetailSection({ log, theme }: DetailSectionProps) {
  const action: string = log.action;
  if (action !== 'CREATE' && action !== 'UPDATE') return null;

  const after = log.after;
  const before = log.before;
  if (!after) return null;

  const rows: Array<{ label: string; from?: string; to: string }> = [];

  for (const [k, v] of Object.entries(after)) {
    if (SKIP_FIELDS.has(k) || v === null || v === undefined || v === '') continue;
    if (action === 'UPDATE') {
      const prevVal = before?.[k];
      const toStr = formatValue(v);
      const fromStr = prevVal !== undefined && prevVal !== null ? formatValue(prevVal) : undefined;
      if (fromStr === toStr) continue; // unchanged
      rows.push({ label: humanizeKey(k), from: fromStr, to: toStr });
    } else {
      rows.push({ label: humanizeKey(k), to: formatValue(v) });
    }
  }

  if (rows.length === 0) return null;

  return (
    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 3, flexWrap: 'wrap' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, width: 90 }]}>
            {row.label}
          </Text>
          {row.from !== undefined ? (
            <Text style={[theme.typography.caption, { flex: 1 }]}>
              <Text style={{ color: theme.colors.textSecondary, textDecorationLine: 'line-through' }}>{row.from}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>{' → '}</Text>
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{row.to}</Text>
            </Text>
          ) : (
            <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 1 }]}>
              {row.to}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

interface LogRowProps { log: any; theme: any; }
function LogRow({ log, theme }: LogRowProps) {
  const modColor = MODULE_COLORS[log.module] || MODULE_COLORS.Default;
  const modIcon = MODULE_ICONS[log.module] || MODULE_ICONS.Default;
  const actorLine = log.actorName
    ? `${log.actorName} (@${log.actorUsername})`
    : log.actorUsername
    ? `@${log.actorUsername}`
    : 'System';

  return (
    <AppCard style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: withAlpha(modColor, 0.12),
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}>
          <Ionicons name={modIcon} size={18} color={modColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <ActionBadge action={log.action} theme={theme} />
            <Text style={[theme.typography.caption, { color: modColor, fontWeight: '600' }]}>
              {log.module}
            </Text>
          </View>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginBottom: 2 }]}>
            {actorLine}
          </Text>
          {log.entityId && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              #{String(log.entityId).slice(-8)}
            </Text>
          )}
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {fmtDateTime(log.createdAt)}
          </Text>
        </View>
      </View>
      <DetailSection log={log} theme={theme} />
    </AppCard>
  );
}

export function ActivityLogScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const [showFilters, setShowFilters] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeFilters, setActiveFilters] = useState<any>({});

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['auditLogs', activeFilters],
    queryFn: ({ pageParam }) =>
      auditLogApi.getAuditLogs({ ...activeFilters, page: pageParam, limit: LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });

  const logs = data?.pages.flatMap((p: any) => p.logs) ?? [];
  const total: number = data?.pages[0]?.total ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <RefreshButton onPress={() => refetch()} isFetching={isFetching && !isFetchingNextPage} style={{ marginRight: 8 }} />,
    });
  }, [refetch, isFetching, isFetchingNextPage]);

  const applyFilters = () => {
    const f: any = {};
    if (moduleFilter) f.module = moduleFilter;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    setActiveFilters(f);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setModuleFilter('');
    setDateFrom('');
    setDateTo('');
    setActiveFilters({});
  };

  if (isLoading) return <LoadingScreen message={t('common.loading')} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Filter toggle */}
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: Object.keys(activeFilters).length > 0 ? theme.colors.primary : theme.colors.border,
            backgroundColor: Object.keys(activeFilters).length > 0
              ? withAlpha(theme.colors.primary, 0.08)
              : theme.colors.inputBackground,
            alignSelf: 'flex-start',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons
            name="filter-outline"
            size={16}
            color={Object.keys(activeFilters).length > 0 ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[theme.typography.caption, {
            color: Object.keys(activeFilters).length > 0 ? theme.colors.primary : theme.colors.textSecondary,
            fontWeight: '600',
          }]}>
            {Object.keys(activeFilters).length > 0 ? t('reports.applyFilter') + ' Active' : t('reports.applyFilter')}
          </Text>
        </TouchableOpacity>

        <FilterPanel visible={showFilters} onClear={clearFilters} onApply={applyFilters} theme={theme}>
          <FilterChipGroup
            label="Module"
            options={MODULE_FILTERS}
            selected={moduleFilter}
            onSelect={setModuleFilter}
            theme={theme}
          />
          <DateRangeFilter
            fromDate={dateFrom}
            toDate={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            theme={theme}
          />
        </FilterPanel>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item: any) => item._id}
        renderItem={({ item }) => <LogRow log={item} theme={theme} />}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: tabBarHeight + theme.spacing.md,
        }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[theme.colors.primary]}
          />
        }
        ListHeaderComponent={
          total > 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {logs.length} of {total} entries
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="document-text-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.md }]}>
                {t('common.noRecords')}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasNextPage ? (
            <TouchableOpacity
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                padding: theme.spacing.md,
                alignItems: 'center',
                backgroundColor: withAlpha(theme.colors.primary, 0.08),
                borderRadius: theme.borderRadius.md,
                marginBottom: theme.spacing.md,
              }}
              activeOpacity={0.7}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
                  {t('common.loadMore')} ({logs.length} of {total})
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      {isError && (
        <View style={{ padding: theme.spacing.md }}>
          <ErrorMessage message={parseApiError(error) ?? 'Failed to load audit log'} onRetry={refetch} />
        </View>
      )}
    </View>
  );
}
