import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { transactionApi } from '../api/transactionApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { showToast } from '../../../utils/toast';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { withAlpha } from '../../../utils/colors';
import { Ionicons } from '@expo/vector-icons';

const ROLES = { HEAD_OFFICE: 'head_office', BRANCH: 'branch' };

const PAYMENT_METHOD_LABELS: { [key: string]: string } = {
  cash: 'Cash',
  neft: 'NEFT',
  rtgs: 'RTGS',
  bank_transfer: 'IMPS',
};

interface InfoRowProps {
  label: string;
  value: any;
  theme: any;
}

function InfoRow({ label, value, theme }: InfoRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.text, flex: 2, textAlign: 'right' }]}>{value || '—'}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={{ height: 1, backgroundColor: theme.colors.divider }} />;
}

const EVENT_LABEL: Record<string, string> = {
  collection: 'Collection',
  payout_committed: 'Payout Committed',
  payout_completed: 'Payout Completed',
  collection_reversed: 'Collection Reversed',
  commission_earned: 'Commission Earned',
  commission_payable: 'Commission Payable',
  commission_receivable: 'Commission Receivable',
  commission_settlement_out: 'Settlement Out',
  commission_settlement_in: 'Settlement In',
  hq_commission_out: 'HQ Commission Out',
  hq_commission_in: 'HQ Commission In',
  partner_deposit: 'Partner Deposit',
  partner_due: 'Partner Due',
};

function TimelineStep({ dot, title, subtitle, time, theme, last = false }: any) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', width: 20 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary, marginTop: 4 }} />
        {!last && <View style={{ width: 2, flex: 1, backgroundColor: theme.colors.divider, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 20 }}>
        <Text style={[theme.typography.label, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text> : null}
        {time ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{time}</Text> : null}
        {dot}
      </View>
    </View>
  );
}

function LedgerEntry({ entry, theme }: { entry: any; theme: any }) {
  const branch = entry.branchId;
  const isCredit = entry.type === 'credit';
  const amtColor = isCredit ? theme.colors.success : theme.colors.error;
  const effAfter: number = entry.effectiveBalanceAfter ?? 0;
  const effNegative = effAfter < 0;
  return (
    <View style={{
      marginTop: 10, padding: 10, borderRadius: 8,
      backgroundColor: effNegative ? withAlpha(theme.colors.error, 0.05) : withAlpha(theme.colors.primary, 0.04),
      borderWidth: 1,
      borderColor: effNegative ? withAlpha(theme.colors.error, 0.3) : theme.colors.divider,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]} allowFontScaling={false}>
            {branch?.code || '—'} · {EVENT_LABEL[entry.event] || entry.event}
          </Text>
          {effNegative && (
            <View style={{ backgroundColor: theme.colors.error, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }} allowFontScaling={false}>LOW</Text>
            </View>
          )}
        </View>
        <Text style={[theme.typography.caption, { color: amtColor, fontWeight: '600' }]} allowFontScaling={false}>
          {isCredit ? '+' : '−'}{fmtAmt(entry.amount)}
        </Text>
      </View>
      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Actual balance</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text }]} allowFontScaling={false}>
            {fmtAmt(entry.actualBalanceBefore)} → {fmtAmt(entry.actualBalanceAfter)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Effective balance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.text }]} allowFontScaling={false}>
              {fmtAmt(entry.effectiveBalanceBefore)} →
            </Text>
            <Text style={[theme.typography.caption, { color: effNegative ? theme.colors.error : theme.colors.text, fontWeight: effNegative ? '700' : '400' }]} allowFontScaling={false}>
              {fmtAmt(effAfter)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface Props {
  route: any;
  navigation: any;
}

export function TransactionDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { transactionId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s: any) => s.user);
  const qc = useQueryClient();

  const [showApproveSheet, setShowApproveSheet] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { data: tx, isLoading, isError, error } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionApi.getOne(transactionId),
  });

  const { data: ledgerTrail } = useQuery({
    queryKey: ['transaction-ledger-trail', transactionId],
    queryFn: () => transactionApi.getLedgerTrail(transactionId),
    enabled: timelineOpen,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transaction', transactionId] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['external-ledger'] });
    qc.invalidateQueries({ queryKey: ['external-accounts'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => transactionApi.approve(transactionId),
    onSuccess: () => { invalidate(); showToast('success', 'Approved', 'Transaction approved'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (remarks: string) => transactionApi.reject(transactionId, remarks),
    onSuccess: () => {
      invalidate();
      setShowRejectInput(false);
      setRejectReason('');
      showToast('success', 'Rejected', 'Transaction rejected');
    },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Rejection failed'),
  });

  if (isLoading) return <LoadingScreen message={t('txn.loadingDetail')} />;
  if (isError) return (
    <View style={{ flex: 1, padding: theme.spacing.md }}>
      <ErrorMessage message={parseApiError(error) ?? 'Failed to load transaction'} />
    </View>
  );

  const canApprove = user.role === ROLES.HEAD_OFFICE && (tx as any).approvalStatus === 'pending';
  const canReject = user.role === ROLES.HEAD_OFFICE && (tx as any).approvalStatus === 'pending';
  const canComplete = user.role === ROLES.BRANCH && (tx as any).approvalStatus === 'approved' && (tx as any).paymentStatus === 'pending';

  const confirmApprove = () => {
    setShowApproveSheet(true);
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(rejectReason.trim());
  };

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header card */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
            {(tx as any).tokenNumber}
          </Text>
          <StatusBadge status={(tx as any).approvalStatus} />
        </View>
        <Text style={[theme.typography.h1, { color: theme.colors.text }]} allowFontScaling={false}>
          {fmtAmt(Number((tx as any).amount))}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
          {(tx as any).commissionSide === 'payout'
            ? `Sender gives ${fmtAmt(Number((tx as any).amount))} · Receiver gets ${fmtAmt(Number((tx as any).finalAmount))} · Commission ${fmtAmt(Number((tx as any).commissionAmount))} → Payout branch`
            : (tx as any).commissionSide === 'payout_extra'
              ? `Sender gives ${fmtAmt(Number((tx as any).amount))} · Receiver gets ${fmtAmt(Number((tx as any).amount))} · Receiver pays ${fmtAmt(Number((tx as any).commissionAmount))} → Payout branch`
              : `Sender gives ${fmtAmt(Number((tx as any).amount) + Number((tx as any).commissionAmount))} · Receiver gets ${fmtAmt(Number((tx as any).amount))} · Commission ${fmtAmt(Number((tx as any).commissionAmount))} → Collection branch`}
        </Text>
        {/* Collect from sender callout — collection side */}
        {(tx as any).commissionSide === 'collection' && Number((tx as any).commissionAmount) > 0 && (
          <View style={{
            marginTop: theme.spacing.sm,
            backgroundColor: withAlpha(theme.colors.primary, 0.08),
            borderRadius: theme.borderRadius.sm,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]}>
              {t('txn.collectFromSender')}
            </Text>
            <Text style={[theme.typography.h3, { color: theme.colors.primary }]} allowFontScaling={false}>
              {fmtAmt(Number((tx as any).amount) + Number((tx as any).commissionAmount))}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {fmtAmt(Number((tx as any).amount))} + {fmtAmt(Number((tx as any).commissionAmount))} commission
            </Text>
          </View>
        )}
        {/* Collect from receiver callout — payout_extra side */}
        {(tx as any).commissionSide === 'payout_extra' && Number((tx as any).commissionAmount) > 0 && (
          <View style={{
            marginTop: theme.spacing.sm,
            backgroundColor: withAlpha(theme.colors.warning, 0.08),
            borderRadius: theme.borderRadius.sm,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.warning,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]}>
              {t('txn.collectFromReceiver')}
            </Text>
            <Text style={[theme.typography.h3, { color: theme.colors.warning }]} allowFontScaling={false}>
              {fmtAmt(Number((tx as any).commissionAmount))}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Receiver pays commission to payout branch
            </Text>
          </View>
        )}
        <View style={{ marginTop: theme.spacing.sm }}>
          <StatusBadge status={(tx as any).paymentStatus} />
        </View>
      </AppCard>

      {/* Details */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>{t('txn.transferDetails')}</Text>
        <InfoRow label={t('txn.collectionBranch')} value={(tx as any).collectionBranchId?.name} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label={t('txn.payoutBranch')} value={(tx as any).payoutBranchId?.name} theme={theme} />
        {(tx as any).externalAccountId && (
          <>
            <Divider theme={theme} />
            <InfoRow
              label={t('txn.partnerAccount')}
              value={`${(tx as any).externalAccountId?.name || ''}${(tx as any).externalAccountId?.code ? ` (${(tx as any).externalAccountId.code})` : ''}`}
              theme={theme}
            />
            {(tx as any).partnerCoveredAmount > 0 && (
              <>
                <Divider theme={theme} />
                <InfoRow label={t('txn.partnerCovered')} value={fmtAmt((tx as any).partnerCoveredAmount)} theme={theme} />
              </>
            )}
          </>
        )}
        <Divider theme={theme} />
        <InfoRow
          label={t('txn.commissionPaidBy')}
          value={(tx as any).commissionSide === 'payout'
            ? t('txn.receiverDeducted')
            : (tx as any).commissionSide === 'payout_extra'
              ? t('txn.receiverExtraDetail')
              : t('txn.senderAdded')}
          theme={theme}
        />
        {(tx as any).customerTokenNo && (
          <>
            <Divider theme={theme} />
            <InfoRow label={t('txn.tokenNo')} value={(tx as any).customerTokenNo} theme={theme} />
          </>
        )}
        {(tx as any).paymentMethod && (
          <>
            <Divider theme={theme} />
            <InfoRow label={t('txn.paymentMethod')} value={PAYMENT_METHOD_LABELS[(tx as any).paymentMethod] || (tx as any).paymentMethod} theme={theme} />
          </>
        )}
        {(tx as any).remarks && (
          <>
            <Divider theme={theme} />
            <InfoRow label={t('txn.remarks')} value={(tx as any).remarks} theme={theme} />
          </>
        )}
      </AppCard>

      {/* Transaction Timeline — collapsible */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <TouchableOpacity
          onPress={() => setTimelineOpen((v) => !v)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>TRANSACTION TIMELINE</Text>
          <Ionicons name={timelineOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {timelineOpen && (
          <View style={{ marginTop: theme.spacing.md }}>
            {/* Step 1 — Created */}
            <TimelineStep
              theme={theme}
              title={`Created by ${(tx as any).createdBy?.name || '—'}`}
              subtitle={(tx as any).createdBy?.username}
              time={fmtDateTime((tx as any).createdAt)}
              last={!(tx as any).approvedAt && !(tx as any).completedAt}
            />

            {/* Step 2 — Approved / Rejected */}
            {(tx as any).approvedAt && (
              <TimelineStep
                theme={theme}
                title={`${(tx as any).approvalStatus === 'approved' ? 'Approved' : 'Rejected'} by ${(tx as any).approvedBy?.name || '—'}`}
                subtitle={(tx as any).approvedBy?.username}
                time={fmtDateTime((tx as any).approvedAt)}
                last={!(tx as any).completedAt}
              />
            )}

            {/* Step 3 — Completed */}
            {(tx as any).completedAt && (
              <TimelineStep
                theme={theme}
                title={`Completed by ${(tx as any).completedBy?.name || '—'}`}
                subtitle={(tx as any).completedBy?.username}
                time={fmtDateTime((tx as any).completedAt)}
                last
              />
            )}

            {/* Commission breakdown */}
            <View style={{ marginTop: theme.spacing.md, padding: 12, borderRadius: theme.borderRadius.sm, backgroundColor: withAlpha(theme.colors.primary, 0.06) }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 8 }]}>COMMISSION</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Type</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>
                  {(tx as any).commissionType === 'flat' ? `Flat ₹${(tx as any).commissionValue}` : `${(tx as any).commissionValue}% of amount`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Amount</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '700' }]} allowFontScaling={false}>
                  {fmtAmt(Number((tx as any).commissionAmount))}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Who pays</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>
                  {(tx as any).commissionSide === 'payout'
                    ? 'Cut from receiver payout'
                    : (tx as any).commissionSide === 'payout_extra'
                      ? 'Receiver pays extra'
                      : 'Added on top from sender'}
                </Text>
              </View>
            </View>

            {/* Balance trail — lazy loaded */}
            {Array.isArray(ledgerTrail) && ledgerTrail.length > 0 && (
              <View style={{ marginTop: theme.spacing.md }}>
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>BALANCE IMPACT</Text>
                {(ledgerTrail as any[]).map((entry: any) => (
                  <LedgerEntry key={entry._id} entry={entry} theme={theme} />
                ))}
              </View>
            )}
          </View>
        )}
      </AppCard>

      {/* Photos */}
      {((tx as any).collectionPhotoUrl || (tx as any).payoutPhotoUrl) && (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>{t('txn.photos')}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {(tx as any).collectionPhotoUrl && (
              <TouchableOpacity onPress={() => Linking.openURL((tx as any).collectionPhotoUrl)} activeOpacity={0.8}>
                <Image source={{ uri: (tx as any).collectionPhotoUrl }} style={{ width: 120, height: 120, borderRadius: theme.borderRadius.md }} resizeMode="cover" />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>{t('txn.photoCollection')}</Text>
              </TouchableOpacity>
            )}
            {(tx as any).payoutPhotoUrl && (
              <TouchableOpacity onPress={() => Linking.openURL((tx as any).payoutPhotoUrl)} activeOpacity={0.8}>
                <Image source={{ uri: (tx as any).payoutPhotoUrl }} style={{ width: 120, height: 120, borderRadius: theme.borderRadius.md }} resizeMode="cover" />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>{t('txn.photoPayout')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </AppCard>
      )}

      {/* Actions */}
      {(canApprove || canReject || canComplete) && (
        <AppCard>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>{t('txn.actions')}</Text>

          {canApprove && (
            <AppButton
              title={t('txn.approve')}
              onPress={confirmApprove}
              loading={approveMutation.isPending}
              style={{ marginBottom: canReject ? theme.spacing.sm : 0 }}
            />
          )}

          {/* Inline reject flow — works on both iOS and Android (Alert.prompt is iOS-only) */}
          {canReject && !showRejectInput && (
            <AppButton
              title={t('txn.reject')}
              onPress={() => {
                setShowRejectInput(true);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
              }}
              variant="danger"
            />
          )}
          {canReject && showRejectInput && (
            <View>
              <AppInput
                label={t('txn.rejectionReason')}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t('txn.rejectionPlaceholder')}
                returnKeyType="done"
                onSubmitEditing={handleConfirmReject}
                autoCapitalize="sentences"
                autoCorrect={true}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <AppButton
                  title={t('common.cancel')}
                  variant="outline"
                  onPress={() => { setShowRejectInput(false); setRejectReason(''); }}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title={t('txn.confirmReject')}
                  variant="danger"
                  onPress={handleConfirmReject}
                  loading={rejectMutation.isPending}
                  disabled={!rejectReason.trim()}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}

          {canComplete && (
            <AppButton
              title={t('txn.complete')}
              onPress={() => navigation.navigate('CompletePayment', {
                transactionId,
                tokenNumber: (tx as any).tokenNumber,
                finalAmount: (tx as any).finalAmount,
                commissionSide: (tx as any).commissionSide,
                commissionAmount: (tx as any).commissionAmount,
                amount: (tx as any).amount,
              })}
            />
          )}
        </AppCard>
      )}
    </ScrollView>
    </KeyboardAvoidingView>

    <ConfirmSheet
      visible={showApproveSheet}
      title={t('txn.approve')}
      message="Are you sure you want to approve this transaction?"
      confirmLabel={t('txn.approve')}
      icon="checkmark-circle-outline"
      loading={approveMutation.isPending}
      onConfirm={() => { setShowApproveSheet(false); approveMutation.mutate(); }}
      onClose={() => setShowApproveSheet(false)}
    />
    </>
  );
}
