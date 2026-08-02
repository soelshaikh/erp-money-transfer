import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { transactionApi } from '../../transaction/api/transactionApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';

// ── Constants ──────────────────────────────────────────────────────────────────

const APPROVAL_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  neft: 'NEFT',
  rtgs: 'RTGS',
  bank_transfer: 'IMPS',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ label, color, theme }: { label: string; color: string; theme: any }) {
  return (
    <View style={{
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      backgroundColor: withAlpha(color, 0.12),
    }}>
      <Text
        style={[theme.typography.caption, { color, fontWeight: '700', textTransform: 'capitalize' }]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

function TransactionCard({ item, theme, onPress }: { item: any; theme: any; onPress: () => void }) {
  const approvalColor = APPROVAL_COLORS[item.approvalStatus] || theme.colors.textSecondary;
  const isCompleted = item.paymentStatus === 'completed';
  const paymentColor = isCompleted ? theme.colors.success : theme.colors.warning;

  const collectionBranch = item.collectionBranchId?.name || '—';
  const payoutBranch = item.payoutBranchId?.name || '—';
  const createdBy = item.createdBy?.name || item.createdBy?.username || '—';
  const paymentMethod = PAYMENT_LABELS[item.paymentMethod] || 'Cash';

  const hasCommission = (item.commissionAmount ?? 0) > 0;
  const commissionSideLabel =
    item.commissionSide === 'payout' ? 'deducted from receiver' : 'added on sender';
  const showFinalAmt =
    item.finalAmount != null && item.finalAmount !== item.amount;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: theme.spacing.sm }}>
      <AppCard>
        {/* Token + badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Text
            style={[theme.typography.label, {
              color: theme.colors.primary,
              fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
              flex: 1,
            }]}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {item.tokenNumber}
          </Text>
          <StatusBadge label={item.approvalStatus} color={approvalColor} theme={theme} />
          {isCompleted && <StatusBadge label="paid" color={paymentColor} theme={theme} />}
          <Ionicons name="chevron-forward" size={14} color={withAlpha(theme.colors.textSecondary, 0.5)} />
        </View>

        {/* Branch route */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Ionicons name="business-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]} numberOfLines={1}>
            {collectionBranch}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 1, textAlign: 'right' }]} numberOfLines={1}>
            {payoutBranch}
          </Text>
        </View>

        {/* Amount + commission */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Amount</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]} allowFontScaling={false}>
              {fmtAmt(item.amount)}
            </Text>
            {showFinalAmt && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
                Final: {fmtAmt(item.finalAmount)}
              </Text>
            )}
          </View>
          {hasCommission && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Commission</Text>
              <Text style={[theme.typography.label, { color: theme.colors.secondary }]} allowFontScaling={false}>
                {fmtAmt(item.commissionAmount)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {commissionSideLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm }} />

        {/* Creator info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="person-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600', flex: 1 }]} numberOfLines={1}>
            {createdBy}
          </Text>
          <View style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            backgroundColor: withAlpha(theme.colors.primary, 0.08),
            borderRadius: theme.borderRadius.full,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary }]} allowFontScaling={false}>
              {paymentMethod}
            </Text>
          </View>
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: theme.spacing.xs }]}>
          {fmtDateTime(item.createdAt)}
        </Text>

        {/* Approved / completed by */}
        {item.approvedBy?.name && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: theme.spacing.xs }]}>
            {item.approvalStatus === 'rejected' ? 'Rejected' : 'Approved'} by {item.approvedBy.name}
            {item.approvedAt ? `  ·  ${fmtDateTime(item.approvedAt)}` : ''}
          </Text>
        )}

        {/* Remarks */}
        {item.remarks ? (
          <View style={{
            marginTop: theme.spacing.sm,
            backgroundColor: withAlpha(theme.colors.warning, 0.08),
            borderRadius: theme.borderRadius.sm,
            padding: theme.spacing.sm,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.warning }]} numberOfLines={2}>
              Remark: {item.remarks}
            </Text>
          </View>
        ) : null}
      </AppCard>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function ReportTransactionsScreen() {
  const theme = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const { fromDate, toDate, branchId, branchRole } = route.params as {
    fromDate: string;
    toDate: string;
    branchId?: string;
    branchRole?: string;
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-transactions', fromDate, toDate, branchId, branchRole],
    queryFn: () =>
      transactionApi.list({
        fromDate,
        toDate,
        ...(branchId ? { branchId } : {}),
        ...(branchRole ? { branchRole } : {}),
        page: 1,
        limit: 100,
      }),
  });

  const transactions: any[] = (data as any)?.data || [];
  const total: number = (data as any)?.total || 0;

  if (isLoading) return <LoadingScreen message="Loading transactions..." />;
  if (isError) return <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />;

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item._id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {total} transaction{total !== 1 ? 's' : ''}
          {total > 100 ? ' (showing first 100)' : ''}
        </Text>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="swap-horizontal-outline" size={48} color={withAlpha(theme.colors.textSecondary, 0.38)} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.md }]}>
            No transactions for this period
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TransactionCard
          item={item}
          theme={theme}
          onPress={() => navigation.navigate('TransactionDetail', { transactionId: item._id })}
        />
      )}
    />
  );
}
