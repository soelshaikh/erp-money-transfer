import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform, Modal, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { dashboardApi } from '../api/dashboardApi';
import { transactionApi } from '../../transaction/api/transactionApi';
import { AppCard } from '../../../shared/components/AppCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtAmtSigned, fmtDateShort } from '../../../utils/fmt';
import { hqCommissionApi } from '../../hqCommission/api/hqCommissionApi';

interface RecentTxnTableProps {
  transactions: any[];
  loading: boolean;
  theme: any;
  onRowPress: (txn: any) => void;
  onViewAll: () => void;
  t: (key: string) => string;
}

function RecentTransactionsTable({ transactions, loading, theme, onRowPress, onViewAll, t }: RecentTxnTableProps) {
  return (
    <AppCard style={{ marginTop: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('dash.recentTxns')}</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
            {t('common.viewAll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View style={{
        flexDirection: 'row',
        paddingBottom: 6,
        marginBottom: 2,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 3 }]}>{t('dash.token')}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 2, textAlign: 'right' }]}>{t('dash.amount')}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700', flex: 2.5, textAlign: 'right' }]}>{t('dash.status')}</Text>
      </View>

      {loading && (
        <View style={{ paddingVertical: theme.spacing.md, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {!loading && transactions.length === 0 && (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: theme.spacing.md }]}>
          {t('dash.noTxns')}
        </Text>
      )}

      {!loading && transactions.map((txn: any, index: number) => {
        const fromCode = txn.collectionBranchId?.code || '—';
        const toCode = txn.payoutBranchId?.code || '—';
        const isLast = index === transactions.length - 1;

        return (
          <TouchableOpacity
            key={txn._id}
            onPress={() => onRowPress(txn)}
            activeOpacity={0.6}
            style={{
              paddingVertical: 9,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            {/* Line 1: token | amount | status */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', flex: 3 }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {txn.tokenNumber}
              </Text>
              <Text
                style={{ color: theme.colors.text, fontWeight: '700', fontSize: 12, flex: 2, textAlign: 'right' }}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {fmtAmt(Number(txn.amount))}
              </Text>
              <View style={{ flex: 2.5, alignItems: 'flex-end' }}>
                <StatusBadge status={txn.approvalStatus} />
              </View>
            </View>
            {/* Line 2: route */}
            <Text
              style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}
              numberOfLines={1}
            >
              {fromCode} → {toCode}
            </Text>
          </TouchableOpacity>
        );
      })}
    </AppCard>
  );
}

interface StatCardProps {
  label: string;
  value: any;
  color?: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  const theme = useTheme();
  return (
    <AppCard style={{ flex: 1, alignItems: 'center', marginHorizontal: 4 }}>
      <Text
        style={[theme.typography.h2, { color: color || theme.colors.primary }]}
        allowFontScaling={false}
      >
        {value ?? '—'}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
        {label}
      </Text>
    </AppCard>
  );
}

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}

const QUICK_FILTERS = [
  {
    labelKey: 'dash.today',
    range: () => { const d = new Date(); return { from: startOfDay(d), to: endOfDay(d) }; },
  },
  {
    labelKey: 'dash.yesterday',
    range: () => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return { from: startOfDay(d), to: endOfDay(d) };
    },
  },
  {
    labelKey: 'dash.last7',
    range: () => {
      const to = new Date();
      const from = new Date(); from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    labelKey: 'dash.lastWeek',
    range: () => {
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      const lastMonday = new Date(now); lastMonday.setDate(now.getDate() - day - 6);
      const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: startOfDay(lastMonday), to: endOfDay(lastSunday) };
    },
  },
  {
    labelKey: 'dash.thisMonth',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from), to: endOfDay(now) };
    },
  },
  {
    labelKey: 'dash.lastMonth',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
  {
    labelKey: 'dash.lastQuarter',
    range: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), (q - 1) * 3, 1);
      const to = new Date(now.getFullYear(), q * 3, 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    },
  },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDateLabel(from: Date, to: Date, todayLabel?: string): string {
  const today = new Date();
  if (isSameDay(from, to) && isSameDay(from, today)) return todayLabel ?? 'Today';
  const f = fmtDateShort(from);
  const t = fmtDateShort(to);
  return isSameDay(from, to) ? f : `${f} — ${t}`;
}

export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const { t } = useTranslation();

  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [toDate, setToDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showDateModal, setShowDateModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');
  // Android only: controls dialog visibility. iOS spinner is always visible inside modal.
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date>(fromDate);
  const [tempTo, setTempTo] = useState<Date>(toDate);

  const toStr = (d: Date) => d.toISOString();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', fromDate.toDateString(), toDate.toDateString()],
    queryFn: () => dashboardApi.get({ fromDate: toStr(fromDate), toDate: toStr(toDate) }),
  });

  const { data: recentTxnData, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent-txns', fromDate.toDateString(), toDate.toDateString()],
    queryFn: () => transactionApi.list({ fromDate: toStr(fromDate), toDate: toStr(toDate), limit: 10, page: 1 }),
    enabled: !isLoading,
  });
  const recentTxns: any[] = (recentTxnData as any)?.data ?? [];

  const isBranchUser = user?.role === 'branch';
  const isHOUser = user?.role === 'head_office';
  const { data: hqPendingItems = [] } = useQuery({
    queryKey: ['hqCommissionItems'],
    queryFn: () => hqCommissionApi.listItems(),
    enabled: isBranchUser || isHOUser,
  });
  const hqPendingCount = (hqPendingItems as any[]).length;

  const { data: hqPendingSettlementsData } = useQuery({
    queryKey: ['hqCommissionSettlements', 'pending'],
    queryFn: () => hqCommissionApi.listSettlements({ status: 'pending', limit: 50 }),
    enabled: isHOUser,
  });
  const hqPendingSettlements = ((hqPendingSettlementsData as any)?.data ?? []) as any[];
  const hqPendingSettlementsCount = hqPendingSettlements.length;

  if (isLoading) return <LoadingScreen message={t('dash.loading')} />;

  const today = (data as any)?.today;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      >
        {/* Date selector */}
        <TouchableOpacity
          onPress={() => {
            setTempFrom(fromDate);
            setTempTo(toDate);
            setShowDateModal(true);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            backgroundColor: withAlpha(theme.colors.primary, 0.08),
            borderRadius: theme.borderRadius.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
            gap: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
          <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
            {formatDateLabel(fromDate, toDate, t('dash.today'))}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.primary} />
        </TouchableOpacity>

        {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load dashboard'} onRetry={refetch} />}

        {/* Branch balance — shown first so payout branches immediately see their position */}
        {user?.role === 'branch' && (data as any)?.balance !== undefined && (() => {
          const balance = Number((data as any).balance || 0);
          const committed = Number((data as any).committedPayout || 0);
          const pending = Number((data as any).pendingPayout || 0);
          const onHold = committed + pending;
          const holdColor = onHold > 0 ? theme.colors.statusPending : theme.colors.textSecondary;
          const commPayable = Number((data as any).commissionPayable || 0);
          const commReceivable = Number((data as any).commissionReceivable || 0);
          return (
            <AppCard style={{ marginBottom: theme.spacing.lg }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, fontWeight: '600' }]}>
                {t('dash.branchBalance')}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('dash.actual')}</Text>
                  <Text style={[theme.typography.h2, { color: theme.colors.primary }]} allowFontScaling={false}>
                    {fmtAmtSigned(balance)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('dash.onHold')}</Text>
                  <Text style={[theme.typography.h2, { color: holdColor }]} allowFontScaling={false}>
                    {onHold > 0 ? '− ' : ''}{fmtAmt(onHold)}
                  </Text>
                </View>
              </View>
              {(commPayable > 0 || commReceivable > 0) && (
                <View style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider, flexDirection: 'row', gap: theme.spacing.sm }}>
                  {commPayable > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={{ flex: 1, backgroundColor: withAlpha(theme.colors.warning, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, alignItems: 'center' }}
                      onPress={() => navigation.navigate('CommissionPayables')}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.warning, fontWeight: '600' }]}>Comm. Payable</Text>
                      <Text style={[theme.typography.label, { color: theme.colors.warning, fontWeight: '700' }]} allowFontScaling={false}>
                        {fmtAmt(commPayable)}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {commReceivable > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={{ flex: 1, backgroundColor: withAlpha(theme.colors.success, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, alignItems: 'center' }}
                      onPress={() => navigation.navigate('CommissionPayables')}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '600' }]}>Comm. Receivable</Text>
                      <Text style={[theme.typography.label, { color: theme.colors.success, fontWeight: '700' }]} allowFontScaling={false}>
                        {fmtAmt(commReceivable)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {hqPendingCount > 0 && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
                  onPress={() => navigation.navigate('HQCommissionItems')}
                >
                  <View style={{ flex: 1, backgroundColor: withAlpha(theme.colors.error, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <Ionicons name="cash-outline" size={14} color={theme.colors.error} />
                    <View style={{ flex: 1 }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]}>
                        {t('hqComm.pendingItems')}
                      </Text>
                    </View>
                    <Text style={[theme.typography.label, { color: theme.colors.error, fontWeight: '700' }]} allowFontScaling={false}>
                      {hqPendingCount}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={theme.colors.error} />
                  </View>
                </TouchableOpacity>
              )}
            </AppCard>
          );
        })()}

        {/* Partner balances — shown separately below branch balance */}
        {user?.role === 'branch' && ((data as any)?.partners?.length ?? 0) > 0 && (
          <AppCard style={{ marginBottom: theme.spacing.lg }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, fontWeight: '600' }]}>
              PARTNER BALANCES
            </Text>
            {((data as any).partners as any[]).map((p: any, idx: number) => {
              const bal = p.balance ?? 0;
              const held = p.onHold ?? 0;
              const avail = bal - held;
              const isNeg = bal < 0;
              const balColor = isNeg ? theme.colors.error : bal === 0 ? theme.colors.textSecondary : theme.colors.success;
              const isLast = idx === (data as any).partners.length - 1;
              return (
                <View
                  key={p._id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.xs + 2, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.colors.border }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(theme.colors.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.sm }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.primary }} allowFontScaling={false}>{p.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>{p.name}</Text>
                    {held > 0 && (
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
                        {fmtAmt(held)} on hold · avail {fmtAmt(Math.max(0, avail))}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600' }}>
                      {isNeg ? 'OWES US' : bal === 0 ? 'NIL' : 'CREDIT'}
                    </Text>
                    <Text style={{ color: balColor, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>
                      {fmtAmt(Math.abs(bal))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </AppCard>
        )}

        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {formatDateLabel(fromDate, toDate, t('dash.today')).toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: theme.spacing.md }}>
          <StatCard label="Transactions" value={today?.totalTransactions} />
          <StatCard
            label={t('dash.txnVolume')}
            value={today?.totalAmount ? fmtAmt(Number(today.totalAmount)) : '₹ 0'}
            color={theme.colors.secondary}
          />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: theme.spacing.md }}>
          <StatCard label={t('dash.pending')} value={today?.pendingCount} color={theme.colors.statusPending} />
          <StatCard label={t('dash.completed')} value={today?.completedCount} color={theme.colors.statusCompleted} />
        </View>

        <RecentTransactionsTable
          transactions={recentTxns}
          loading={recentLoading}
          theme={theme}
          onRowPress={(txn) => navigation.navigate('TransactionDetail', { transactionId: txn._id })}
          onViewAll={() => navigation.navigate('Transactions')}
          t={t}
        />

        {user?.role === 'head_office' && (data as any)?.branchBreakdown?.length > 0 && (
          <AppCard style={{ marginTop: theme.spacing.md }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>{t('dash.branchActivity')}</Text>
            {(data as any).branchBreakdown.map((b: any) => (
              <View
                key={b.branchId}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing.xs + 2,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.divider,
                }}
              >
                <Text style={[theme.typography.body, { color: theme.colors.text }]}>{b.branchName}</Text>
                <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                  {b.count} txns
                </Text>
              </View>
            ))}
          </AppCard>
        )}

        {isHOUser && hqPendingCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('HQCommissionItems')}
            style={{ marginTop: theme.spacing.md }}
          >
            <AppCard style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(theme.colors.error, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cash-outline" size={18} color={theme.colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.label, { color: theme.colors.error, fontWeight: '700' }]}>
                  {t('hqComm.pendingItems')}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {hqPendingCount} {t('hqComm.items')} {t('hqComm.awaitingSettlement')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </AppCard>
          </TouchableOpacity>
        )}

        {isHOUser && hqPendingSettlementsCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('HQCommissionSettlements')}
            style={{ marginTop: theme.spacing.md }}
          >
            <AppCard style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(theme.colors.warning, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={18} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.label, { color: theme.colors.warning, fontWeight: '700' }]}>
                  {t('hqComm.pendingSettlements')}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {hqPendingSettlementsCount} {t('hqComm.settlementsAwaitingApproval')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </AppCard>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Date range picker modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowDateModal(false)}
        >
          {/* Inner touchable stops tap-to-dismiss when tapping inside the sheet */}
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.borderRadius.lg,
              borderTopRightRadius: theme.borderRadius.lg,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
              paddingBottom: theme.spacing.lg + (Platform.OS === 'ios' ? 16 : 0),
            }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
                {t('dash.selectRange')}
              </Text>

              {/* Quick filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: theme.spacing.md }}
                contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.sm }}
              >
                {QUICK_FILTERS.map((qf) => {
                  const { from, to } = qf.range();
                  const isActive = isSameDay(tempFrom, from) && isSameDay(tempTo, to);
                  return (
                    <TouchableOpacity
                      key={qf.labelKey}
                      onPress={() => { setTempFrom(from); setTempTo(to); }}
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.xs + 2,
                        borderRadius: 999,
                        backgroundColor: isActive
                          ? theme.colors.primary
                          : withAlpha(theme.colors.primary, 0.08),
                        borderWidth: 1,
                        borderColor: isActive ? theme.colors.primary : withAlpha(theme.colors.primary, 0.2),
                      }}
                    >
                      <Text style={[
                        theme.typography.caption,
                        { color: isActive ? theme.colors.surface : theme.colors.primary, fontWeight: '600' },
                      ]}>
                        {t(qf.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* From / To selector rows — tapping switches which date the spinner edits */}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                <TouchableOpacity
                  onPress={() => { setPickerTarget('from'); if (Platform.OS === 'android') setShowAndroidPicker(true); }}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    backgroundColor: pickerTarget === 'from'
                      ? withAlpha(theme.colors.primary, 0.12)
                      : withAlpha(theme.colors.primary, 0.04),
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: pickerTarget === 'from' ? theme.colors.primary : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>{t('dash.from')}</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                    {fmtDateShort(tempFrom)}
                  </Text>
                </TouchableOpacity>

                <View style={{ justifyContent: 'center' }}>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.textSecondary} />
                </View>

                <TouchableOpacity
                  onPress={() => { setPickerTarget('to'); if (Platform.OS === 'android') setShowAndroidPicker(true); }}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    backgroundColor: pickerTarget === 'to'
                      ? withAlpha(theme.colors.primary, 0.12)
                      : withAlpha(theme.colors.primary, 0.04),
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: pickerTarget === 'to' ? theme.colors.primary : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>{t('dash.to')}</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                    {fmtDateShort(tempTo)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* iOS: spinner always visible, compact height, switches between from/to via pickerTarget */}
              {Platform.OS === 'ios' && (
                <DateTimePicker
                  value={pickerTarget === 'from' ? tempFrom : tempTo}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  style={{ width: '100%', height: 150, marginBottom: theme.spacing.sm }}
                  onChange={(_event: any, selected?: Date) => {
                    if (!selected) return;
                    if (pickerTarget === 'from') {
                      const d = new Date(selected);
                      d.setHours(0, 0, 0, 0);
                      setTempFrom(d);
                      if (d > tempTo) { const e = new Date(d); e.setHours(23, 59, 59, 999); setTempTo(e); }
                    } else {
                      const d = new Date(selected);
                      d.setHours(23, 59, 59, 999);
                      setTempTo(d);
                    }
                  }}
                />
              )}

              {/* Android: dialog opens when tapping a row */}
              {Platform.OS === 'android' && showAndroidPicker && (
                <DateTimePicker
                  value={pickerTarget === 'from' ? tempFrom : tempTo}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event: any, selected?: Date) => {
                    setShowAndroidPicker(false);
                    if (!selected) return;
                    if (pickerTarget === 'from') {
                      const d = new Date(selected);
                      d.setHours(0, 0, 0, 0);
                      setTempFrom(d);
                      if (d > tempTo) { const e = new Date(d); e.setHours(23, 59, 59, 999); setTempTo(e); }
                    } else {
                      const d = new Date(selected);
                      d.setHours(23, 59, 59, 999);
                      setTempTo(d);
                    }
                  }}
                />
              )}

              {/* Android: hint to tap a row */}
              {Platform.OS === 'android' && (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.md }]}>
                  {t('dash.tapToOpen')}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowDateModal(false); setShowAndroidPicker(false); }}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.divider,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setFromDate(tempFrom);
                    setToDate(tempTo);
                    setShowDateModal(false);
                    setShowAndroidPicker(false);
                  }}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.surface }]}>{t('common.apply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
