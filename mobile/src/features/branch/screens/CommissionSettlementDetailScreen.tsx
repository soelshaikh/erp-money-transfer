import React from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
import { commissionSettlementApi } from '../api/commissionSettlementApi';

interface Props {
  route: any;
  navigation: any;
}

function AuditRow({ icon, label, name, time, color, theme }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: theme.spacing.sm }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: withAlpha(color, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.sm,
      }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '600' }]}>{name}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{fmtDateTime(time)}</Text>
      </View>
    </View>
  );
}

export function CommissionSettlementDetailScreen({ route, navigation }: Props) {
  const { settlementId } = route.params;
  const theme = useTheme();
  const qc = useQueryClient();

  const { data: settlement, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['commissionSettlement', settlementId],
    queryFn: () => commissionSettlementApi.getSettlement(settlementId),
  });

  const completeMutation = useMutation({
    mutationFn: () => commissionSettlementApi.completeSettlement(settlementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commissionSettlement', settlementId] });
      qc.invalidateQueries({ queryKey: ['commissionSettlements'] });
      qc.invalidateQueries({ queryKey: ['commissionPayables'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['branchLedger'] });
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to complete settlement'),
  });

  const handleComplete = () => {
    Alert.alert(
      'Complete Settlement',
      `Confirm that ${fmtAmt((settlement as any)?.totalAmount)} has been physically transferred from ${(settlement as any)?.fromBranchName} to ${(settlement as any)?.toBranchName}?\n\nThis will update both branch balances and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Complete',
          onPress: () => completeMutation.mutate(),
        },
      ],
    );
  };

  if (isLoading) return <LoadingScreen message="Loading..." />;
  if (!settlement) return null;

  const s = settlement as any;
  const isPending = s.status === 'pending';
  const statusColor = isPending ? theme.colors.warning : theme.colors.success;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      {/* Status header */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: withAlpha(statusColor, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.spacing.md,
          }}>
            <Ionicons
              name={isPending ? 'time-outline' : 'checkmark-circle-outline'}
              size={22}
              color={statusColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, fontWeight: '700' }]}>
              Commission Settlement
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 99,
                backgroundColor: withAlpha(statusColor, 0.12),
              }}>
                <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '700' }]} allowFontScaling={false}>
                  {s.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Total Amount</Text>
          <Text style={[theme.typography.h1, { color: theme.colors.text, fontWeight: '800', marginTop: 4 }]} allowFontScaling={false}>
            {fmtAmt(s.totalAmount)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            {s.transactionCount} transaction{s.transactionCount === 1 ? '' : 's'}
          </Text>
        </View>
      </AppCard>

      {/* Branch flow */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>BRANCH FLOW</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Payout Branch (Pays)</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '700' }]}>{s.fromBranchName}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{s.fromBranchCode}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.primary} style={{ marginHorizontal: theme.spacing.sm }} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Sending Branch (Receives)</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '700' }]}>{s.toBranchName}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{s.toBranchCode}</Text>
          </View>
        </View>
      </AppCard>

      {/* Notes */}
      {s.notes ? (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>NOTES</Text>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{s.notes}</Text>
        </AppCard>
      ) : null}

      {/* Audit trail */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>HISTORY</Text>
        <AuditRow
          icon="create-outline"
          label="Settlement Initiated By"
          name={s.initiatedByName}
          time={s.initiatedAt}
          color={theme.colors.primary}
          theme={theme}
        />
        {s.completedByName && (
          <>
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.xs }} />
            <AuditRow
              icon="checkmark-circle-outline"
              label="Settlement Completed By"
              name={s.completedByName}
              time={s.completedAt}
              color={theme.colors.success}
              theme={theme}
            />
          </>
        )}
      </AppCard>

      {/* Complete action — only for pending settlements */}
      {isPending && (
        <AppCard>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>COMPLETE SETTLEMENT</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
            Only mark as complete once {s.fromBranchName} has physically transferred {fmtAmt(s.totalAmount)} to {s.toBranchName}. This updates both branch balances immediately.
          </Text>
          <AppButton
            title={completeMutation.isPending ? 'Processing…' : `Mark Transferred — ${fmtAmt(s.totalAmount)}`}
            onPress={handleComplete}
            loading={completeMutation.isPending}
            disabled={completeMutation.isPending}
          />
        </AppCard>
      )}
    </ScrollView>
  );
}
