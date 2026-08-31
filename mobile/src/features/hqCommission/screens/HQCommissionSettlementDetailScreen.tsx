import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Platform } from 'react-native';
import { showToast } from '../../../utils/toast';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
import { useAuthStore } from '../../../store/authStore';
import { hqCommissionApi, HQCommissionItem, HQCommissionSettlementWithItems } from '../api/hqCommissionApi';

interface Props {
  route: any;
  navigation: any;
}

function AuditRow({ icon, label, name, time, color, theme }: {
  icon: string; label: string; name: string; time: string; color: string; theme: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: theme.spacing.sm }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: withAlpha(color, 0.12),
        alignItems: 'center', justifyContent: 'center',
        marginRight: theme.spacing.sm,
      }}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '600' }]}>{name}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{fmtDateTime(time)}</Text>
      </View>
    </View>
  );
}

function LineItemRow({ item, theme, t }: { item: HQCommissionItem; theme: any; t: any }) {
  return (
    <View style={{
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }) }]}
            allowFontScaling={false}
          >
            {item.tokenNumber}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {t('hqComm.totalCommission')}: {fmtAmt(item.commissionAmount)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {item.hqSharePct}% {t('hqComm.hqShare')}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.error, fontWeight: '700' }]} allowFontScaling={false}>
            {fmtAmt(item.hqShareAmount)}
          </Text>
        </View>
      </View>
      {!!item.otherBranchId && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Owed to {item.otherBranchName || 'other branch'} / HO's own
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text }]} allowFontScaling={false}>
            {fmtAmt(item.otherBranchShareAmount || 0)} / {fmtAmt(item.headOfficeOwnShareAmount || 0)}
          </Text>
        </View>
      )}
    </View>
  );
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  neft: 'NEFT',
  rtgs: 'RTGS',
  bank_transfer: 'IMPS',
  cheque: 'Cheque',
};

export function HQCommissionSettlementDetailScreen({ route, navigation }: Props) {
  const { settlementId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const user = useAuthStore((s: any) => s.user);
  const isHO = user?.role === 'head_office';

  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const { data: settlement, isLoading, isFetching, refetch } = useQuery<HQCommissionSettlementWithItems>({
    queryKey: ['hqCommissionSettlement', settlementId],
    queryFn: () => hqCommissionApi.getSettlement(settlementId),
  });

  const completeMutation = useMutation({
    mutationFn: () => hqCommissionApi.completeSettlement(settlementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hqCommissionSettlement', settlementId] });
      qc.invalidateQueries({ queryKey: ['hqCommissionSettlements'] });
      qc.invalidateQueries({ queryKey: ['hqCommissionItems'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['branchLedger'] });
    },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to complete settlement'),
  });

  const handleComplete = () => {
    if (!settlement) return;
    setConfirmSheet({
      title: t('hqComm.markReceived'),
      message: t('hqComm.markReceivedConfirm')
        .replace('{branch}', settlement.branchName)
        .replace('{amount}', fmtAmt(settlement.totalHQShare)),
      confirmLabel: t('hqComm.markReceived'),
      onConfirm: () => completeMutation.mutate(),
    });
  };

  if (isLoading) return <LoadingScreen message={t('hqComm.loading')} />;
  if (!settlement) return null;

  const isPending = settlement.status === 'pending';
  const statusColor = isPending ? theme.colors.warning : theme.colors.success;
  const initiatedLabel = settlement.initiatedBySide === 'branch'
    ? t('hqComm.initiatedByBranch')
    : t('hqComm.initiatedByHO');

  const canComplete = isPending && isHO;

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      {/* Status header */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: withAlpha(statusColor, 0.12),
            alignItems: 'center', justifyContent: 'center',
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
              {t('hqComm.settlementTitle')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: 99, backgroundColor: withAlpha(statusColor, 0.12) }}>
                <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '700' }]} allowFontScaling={false}>
                  {settlement.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalHQShare')}</Text>
          <Text style={[theme.typography.h1, { color: theme.colors.error, fontWeight: '800', marginTop: 4 }]} allowFontScaling={false}>
            {fmtAmt(settlement.totalHQShare)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            {settlement.itemCount} {t('hqComm.items')} · {PAYMENT_MODE_LABELS[settlement.paymentMode] ?? settlement.paymentMode}
          </Text>
        </View>
      </AppCard>

      {/* Branch & amounts */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          {t('hqComm.branchDetails').toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.branch')}</Text>
          <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '700' }]}>
            {settlement.branchName} ({settlement.branchCode})
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalCommission')}</Text>
          <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} allowFontScaling={false}>
            {fmtAmt(settlement.totalCommission)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.initiatedBy')}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{initiatedLabel}</Text>
        </View>
      </AppCard>

      {/* Notes */}
      {settlement.notes ? (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
            {t('hqComm.notes').toUpperCase()}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{settlement.notes}</Text>
        </AppCard>
      ) : null}

      {/* Line items */}
      {settlement.items && settlement.items.length > 0 && (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('hqComm.lineItems').toUpperCase()} ({settlement.items.length})
          </Text>
          {settlement.items.map((item) => (
            <LineItemRow key={item._id} item={item} theme={theme} t={t} />
          ))}
        </AppCard>
      )}

      {/* Audit trail */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {t('hqComm.history').toUpperCase()}
        </Text>
        <AuditRow
          icon="create-outline"
          label={t('hqComm.initiatedLabel')}
          name={settlement.initiatedByName}
          time={settlement.initiatedAt}
          color={theme.colors.primary}
          theme={theme}
        />
        {settlement.completedByName && settlement.completedAt && (
          <>
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.xs }} />
            <AuditRow
              icon="checkmark-circle-outline"
              label={t('hqComm.completedLabel')}
              name={settlement.completedByName}
              time={settlement.completedAt}
              color={theme.colors.success}
              theme={theme}
            />
          </>
        )}
      </AppCard>

      {/* Complete action — HO only, pending settlements */}
      {canComplete && (
        <AppCard>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
            {t('hqComm.markReceived').toUpperCase()}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
            {t('hqComm.markReceivedHint').replace('{amount}', fmtAmt(settlement.totalHQShare)).replace('{branch}', settlement.branchName)}
          </Text>
          <AppButton
            title={completeMutation.isPending ? `${t('hqComm.processing')}…` : `${t('hqComm.markReceived')} — ${fmtAmt(settlement.totalHQShare)}`}
            onPress={handleComplete}
            loading={completeMutation.isPending}
            disabled={completeMutation.isPending}
          />
        </AppCard>
      )}
    </ScrollView>
    <ConfirmSheet
      visible={!!confirmSheet}
      title={confirmSheet?.title ?? ''}
      message={confirmSheet?.message}
      confirmLabel={confirmSheet?.confirmLabel}
      destructive={confirmSheet?.destructive}
      icon={confirmSheet?.icon}
      onConfirm={() => { confirmSheet?.onConfirm(); setConfirmSheet(null); }}
      onClose={() => setConfirmSheet(null)}
    />
    </>
  );
}
