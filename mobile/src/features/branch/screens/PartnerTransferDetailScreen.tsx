import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
import { partnerTransferApi } from '../api/externalAccountApi';

const STATUS_META: Record<string, { label: string; color: string; icon: string; description: string }> = {
  pending:   { label: 'Pending Approval',  color: '#f59e0b', icon: 'time-outline',             description: 'Waiting for head office approval' },
  approved:  { label: 'Approved',          color: '#3b82f6', icon: 'checkmark-circle-outline', description: 'Approved — awaiting destination branch to complete' },
  completed: { label: 'Completed',         color: '#10b981', icon: 'checkmark-circle',         description: 'Transfer completed successfully' },
  cancelled: { label: 'Cancelled',         color: '#6b7280', icon: 'close-circle-outline',     description: 'Transfer was cancelled' },
  rejected:  { label: 'Rejected',          color: '#ef4444', icon: 'close-circle',             description: 'Transfer was rejected by head office' },
};

function InfoRow({ label, value, theme, color, mono }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: withAlpha(theme.colors.border, 0.5) }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: color || theme.colors.text, textAlign: 'right', flex: 1.5, fontFamily: mono ? 'monospace' : undefined }} allowFontScaling={false}>{value ?? '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children, theme }: any) {
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border }}>
      {title && <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>{title}</Text>}
      {children}
    </View>
  );
}

function AuditStep({ label, name, at, color, icon, theme }: any) {
  if (!at && !name) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, marginBottom: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(color, 0.12), alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{label}</Text>
        {name && <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{name}</Text>}
        {at && <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{fmtDateTime(at)}</Text>}
      </View>
    </View>
  );
}

export function PartnerTransferDetailScreen() {
  const theme = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s: any) => s.user);
  const isHO = user?.role === 'head_office';
  const myBranchId: string | undefined = user?.branchId;

  const { transferId } = route.params;

  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: transfer, isLoading, refetch } = useQuery({
    queryKey: ['partner-transfer', transferId],
    queryFn: () => partnerTransferApi.getOne(transferId),
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: () => partnerTransferApi.approve(transferId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['partner-transfer', transferId] }); qc.invalidateQueries({ queryKey: ['partner-transfers'] }); refetch(); },
    onError: (err: any) => setActionError(parseApiError(err) || 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: () => partnerTransferApi.complete(transferId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['partner-transfer', transferId] }); qc.invalidateQueries({ queryKey: ['partner-transfers'] }); refetch(); },
    onError: (err: any) => setActionError(parseApiError(err) || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => partnerTransferApi.reject(transferId, reason),
    onSuccess: () => { setShowRejectInput(false); setReason(''); qc.invalidateQueries({ queryKey: ['partner-transfer', transferId] }); refetch(); },
    onError: (err: any) => setActionError(parseApiError(err) || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => partnerTransferApi.cancel(transferId, reason || undefined),
    onSuccess: () => { setShowCancelInput(false); setReason(''); qc.invalidateQueries({ queryKey: ['partner-transfer', transferId] }); refetch(); },
    onError: (err: any) => setActionError(parseApiError(err) || 'Failed'),
  });

  if (isLoading) return <LoadingScreen />;
  if (!transfer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textSecondary }}>Transfer not found</Text>
      </View>
    );
  }

  const s = STATUS_META[transfer.status] || STATUS_META.pending;
  const from = transfer.fromBranchId;
  const to   = transfer.toBranchId;
  const partner = transfer.externalAccountId;

  // Action visibility
  const isFromBranch = myBranchId && from?._id === myBranchId;
  const isToBranch   = myBranchId && to?._id === myBranchId;
  const canApprove   = isHO && transfer.status === 'pending';
  const canComplete  = transfer.status === 'approved' && (isHO || isToBranch);
  const canReject    = isHO && transfer.status === 'pending';
  const canCancelBranch = transfer.status === 'pending' && !isHO && isFromBranch;
  const canCancelHO     = isHO && ['pending', 'approved'].includes(transfer.status);

  const anyPending = approveMutation.isPending || completeMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl }}
    >
      {/* Status banner */}
      <View style={{ backgroundColor: withAlpha(s.color, 0.08), borderRadius: theme.borderRadius.md, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: withAlpha(s.color, 0.25) }}>
        <Ionicons name={s.icon as any} size={24} color={s.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: s.color }}>{s.label}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{s.description}</Text>
        </View>
      </View>

      {/* Transfer summary */}
      <SectionCard theme={theme}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 8 }}>TRANSFER DETAILS</Text>
        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginBottom: 2 }}>{transfer.transferRef}</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.colors.primary, marginBottom: 8 }} allowFontScaling={false}>{fmtAmt(transfer.amount)}</Text>

        {/* Partner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm }}>
          <Ionicons name="business-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={{ fontSize: 13, color: theme.colors.text, fontWeight: '600' }}>{partner?.name || '—'}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>({partner?.code})</Text>
        </View>

        {/* From → To */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.primary, 0.04), borderRadius: theme.borderRadius.sm }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.error }} allowFontScaling={false}>{from?.code || '?'}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{from?.name || '—'}</Text>
            <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: '600' }}>− {fmtAmt(transfer.amount)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.textSecondary} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.success }} allowFontScaling={false}>{to?.code || '?'}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{to?.name || '—'}</Text>
            <Text style={{ fontSize: 11, color: theme.colors.success, fontWeight: '600' }}>+ {fmtAmt(transfer.finalAmount ?? transfer.amount)}</Text>
          </View>
        </View>

        {/* Commission summary */}
        {transfer.commissionSide && transfer.commissionSide !== 'none' && (transfer.commissionAmount ?? 0) > 0 && (
          <View style={{ marginTop: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.warning, 0.07), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, gap: 4 }}>
            <InfoRow label="Commission" value={fmtAmt(transfer.commissionAmount)} theme={theme} color={theme.colors.warning} />
            <InfoRow label="Commission on"
              value={transfer.commissionSide === 'collection' ? 'Sender Pays' : transfer.commissionSide === 'payout' ? 'Receiver Pays' : 'Receiver Pays Extra'}
              theme={theme} />
            {transfer.commissionType === 'percentage'
              ? <InfoRow label="Rate" value={`${transfer.commissionValue}%`} theme={theme} />
              : <InfoRow label="Flat amount" value={fmtAmt(transfer.commissionValue)} theme={theme} />
            }
            {(transfer.finalAmount ?? 0) !== transfer.amount && (
              <InfoRow label="Amount to Lenar" value={fmtAmt(transfer.finalAmount)} theme={theme} color={theme.colors.success} />
            )}
          </View>
        )}

        {/* Payment & coverage */}
        {((transfer.branchCoversAmount ?? 0) > 0 || (transfer.partnerCoversAmount ?? 0) < transfer.amount) && (
          <View style={{ marginTop: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.warning, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, gap: 4 }}>
            <InfoRow label="Partner covers" value={fmtAmt(transfer.partnerCoversAmount ?? transfer.amount)} theme={theme} />
            {(transfer.branchCoversAmount ?? 0) > 0 && (
              <InfoRow label="Branch covers" value={fmtAmt(transfer.branchCoversAmount)} theme={theme} color={theme.colors.warning} />
            )}
          </View>
        )}

        {transfer.paymentMethod && transfer.paymentMethod !== 'cash' && (
          <InfoRow label="Payment Method" value={(transfer.paymentMethod as string).toUpperCase()} theme={theme} />
        )}

        {transfer.remarks && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: theme.spacing.sm }]}>"{transfer.remarks}"</Text>
        )}
      </SectionCard>

      {/* People info */}
      {(transfer.senderName || transfer.receiverName || transfer.customerTokenNo) && (
        <SectionCard title="SENDER / RECEIVER" theme={theme}>
          {transfer.senderName && <InfoRow label="Sender (Mokalnar)" value={transfer.senderName} theme={theme} />}
          {transfer.senderMobile && <InfoRow label="Sender Mobile" value={transfer.senderMobile} theme={theme} />}
          {transfer.receiverName && <InfoRow label="Receiver (Lenar)" value={transfer.receiverName} theme={theme} />}
          {transfer.receiverMobile && <InfoRow label="Receiver Mobile" value={transfer.receiverMobile} theme={theme} />}
          {transfer.customerTokenNo && <InfoRow label="Customer Token No" value={transfer.customerTokenNo} theme={theme} mono />}
        </SectionCard>
      )}

      {/* Audit trail */}
      <SectionCard title="AUDIT TRAIL" theme={theme}>
        <AuditStep label="Created" name={transfer.createdByName} at={transfer.createdAt} color={theme.colors.primary} icon="person-outline" theme={theme} />
        {transfer.approvedAt && <AuditStep label="Approved" name={transfer.approvedByName} at={transfer.approvedAt} color="#3b82f6" icon="checkmark-circle-outline" theme={theme} />}
        {transfer.completedAt && <AuditStep label="Completed" name={transfer.completedByName} at={transfer.completedAt} color={theme.colors.success} icon="checkmark-circle" theme={theme} />}
        {transfer.rejectedAt && <AuditStep label="Rejected" name={transfer.rejectedByName} at={transfer.rejectedAt} color={theme.colors.error} icon="close-circle" theme={theme} />}
        {transfer.cancelledAt && <AuditStep label="Cancelled" name={transfer.cancelledByName} at={transfer.cancelledAt} color="#6b7280" icon="close-circle-outline" theme={theme} />}
      </SectionCard>

      {/* Rejection/cancellation reason */}
      {(transfer.rejectionReason || transfer.cancellationReason) && (
        <SectionCard theme={theme}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.error, marginBottom: 4 }}>
            {transfer.rejectionReason ? 'REJECTION REASON' : 'CANCELLATION REASON'}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>
            {transfer.rejectionReason || transfer.cancellationReason}
          </Text>
        </SectionCard>
      )}

      {/* Error */}
      {!!actionError && (
        <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.error, fontSize: 13 }}>{actionError}</Text>
        </View>
      )}

      {/* Actions */}
      {/* HO approve + reject on pending */}
      {canApprove && !showRejectInput && (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
          <AppButton
            title="Approve Transfer"
            onPress={() => { setActionError(''); approveMutation.mutate(); }}
            loading={approveMutation.isPending}
            disabled={anyPending}
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            onPress={() => { setShowRejectInput(true); setReason(''); setActionError(''); }}
            disabled={anyPending}
            style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 12, borderRadius: theme.borderRadius.sm, borderWidth: 1.5, borderColor: theme.colors.error, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.error, fontWeight: '700' }}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reject inline input */}
      {showRejectInput && (
        <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.04), borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: withAlpha(theme.colors.error, 0.2) }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.error, marginBottom: 8 }}>Reject Transfer</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for rejection..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 14, minHeight: 60, marginBottom: 10 }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <AppButton title="Cancel" variant="outline" onPress={() => setShowRejectInput(false)} style={{ flex: 1 }} />
            <AppButton
              title="Confirm Rejection"
              variant="danger"
              onPress={() => { if (!reason.trim()) { setActionError('Please provide a rejection reason'); return; } rejectMutation.mutate(); }}
              loading={rejectMutation.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      {/* Complete transfer */}
      {canComplete && !showCancelInput && (
        <AppButton
          title="Complete Transfer"
          onPress={() => { setActionError(''); completeMutation.mutate(); }}
          loading={completeMutation.isPending}
          disabled={anyPending}
          style={{ marginBottom: theme.spacing.sm }}
        />
      )}

      {/* Cancel options */}
      {(canCancelBranch || canCancelHO) && !showCancelInput && !showRejectInput && (
        <TouchableOpacity
          onPress={() => { setShowCancelInput(true); setReason(''); setActionError(''); }}
          disabled={anyPending}
          style={{ paddingVertical: 12, borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', marginBottom: theme.spacing.sm }}
        >
          <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel Transfer</Text>
        </TouchableOpacity>
      )}

      {/* Cancel inline input */}
      {showCancelInput && (
        <View style={{ backgroundColor: withAlpha(theme.colors.border, 0.2), borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 8 }}>Cancel Transfer</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (optional)..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 14, minHeight: 50, marginBottom: 10 }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <AppButton title="Back" variant="outline" onPress={() => setShowCancelInput(false)} style={{ flex: 1 }} />
            <AppButton
              title="Confirm Cancellation"
              variant="danger"
              onPress={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
