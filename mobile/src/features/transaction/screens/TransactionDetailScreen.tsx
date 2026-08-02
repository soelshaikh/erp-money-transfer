import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, Image, TouchableOpacity, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { transactionApi } from '../api/transactionApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt, fmtDateTime } from '../../../utils/fmt';
import { withAlpha } from '../../../utils/colors';

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

  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const { data: tx, isLoading, isError, error } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionApi.getOne(transactionId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transaction', transactionId] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => transactionApi.approve(transactionId),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (remarks: string) => transactionApi.reject(transactionId, remarks),
    onSuccess: () => {
      invalidate();
      setShowRejectInput(false);
      setRejectReason('');
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Rejection failed'),
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
    Alert.alert(
      t('txn.approve'),
      `${t('txn.approveConfirm')} ${fmtAmt(Number((tx as any).amount))} (Token: ${(tx as any).tokenNumber})?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('txn.approveConfirm'), onPress: () => approveMutation.mutate() },
      ],
    );
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(rejectReason.trim());
  };

  return (
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
            : `Sender gives ${fmtAmt(Number((tx as any).amount) + Number((tx as any).commissionAmount))} · Receiver gets ${fmtAmt(Number((tx as any).amount))} · Commission ${fmtAmt(Number((tx as any).commissionAmount))} → Collection branch`}
        </Text>
        {/* Collect from sender callout — shown for collection-side commission */}
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
        <Divider theme={theme} />
        <InfoRow
          label={t('txn.commissionPaidBy')}
          value={(tx as any).commissionSide === 'payout' ? t('txn.receiverDeducted') : t('txn.senderAdded')}
          theme={theme}
        />
        <Divider theme={theme} />
        <InfoRow label={t('txn.createdBy')} value={(tx as any).createdBy?.name} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label={t('txn.createdAt')} value={fmtDateTime((tx as any).createdAt)} theme={theme} />
        {(tx as any).approvedBy && (
          <>
            <Divider theme={theme} />
            <InfoRow
              label={(tx as any).approvalStatus === 'approved' ? t('txn.approvedBy') : t('txn.rejectedBy')}
              value={(tx as any).approvedBy?.name}
              theme={theme}
            />
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
  );
}
