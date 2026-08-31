import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { transactionApi } from '../api/transactionApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppCard } from '../../../shared/components/AppCard';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { showToast } from '../../../utils/toast';
import { fmtAmt } from '../../../utils/fmt';
import { withAlpha } from '../../../utils/colors';
import { ImagePickerButton } from '../../../shared/components/ImagePickerButton';

interface Props {
  route: any;
  navigation: any;
}

export function CompletePaymentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { transactionId, tokenNumber, finalAmount, commissionSide, commissionAmount, amount } = route.params;
  const theme = useTheme();
  const qc = useQueryClient();
  const [payoutPhotoUrl, setPayoutPhotoUrl] = useState<string | null>(null);

  // payout_extra is a legacy commission side (no longer created via UI).
  // Both payout and payout_extra use the same UI — just the default mode differs:
  //   payout       → default 'deduct' (receiver gets finalAmount, collection branch earns commission)
  //   payout_extra → default 'extra'  (backward compat: receiver gets full amount, payout branch earns)
  const isPayoutSide = commissionSide === 'payout' || commissionSide === 'payout_extra';
  const [payoutMode, setPayoutMode] = useState<'deduct' | 'extra'>(
    commissionSide === 'payout_extra' ? 'extra' : 'deduct'
  );

  // Deduct mode: pay finalAmount to receiver, commission goes to collection branch
  // Extra mode:  pay full amount to receiver, collect commission separately, payout branch earns it
  const displayPayAmount = payoutMode === 'deduct' ? Number(finalAmount) : Number(amount);

  const mutation = useMutation({
    mutationFn: () => transactionApi.completePayment(
      transactionId,
      payoutPhotoUrl,
      // commissionDeducted: true = deduct mode (collection branch earns)
      // commissionDeducted: false/undefined = extra mode (payout branch earns)
      isPayoutSide ? payoutMode === 'deduct' : undefined,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['external-accounts'] });
      let msg = `Token ${tokenNumber} — ${fmtAmt(displayPayAmount)} paid to receiver.`;
      if (isPayoutSide && payoutMode === 'extra') msg += ` Collect ${fmtAmt(Number(commissionAmount))} from receiver as commission.`;
      if (isPayoutSide && payoutMode === 'deduct') msg += ` Commission ${fmtAmt(Number(commissionAmount))} deducted from payout.`;
      showToast('success', 'Payment Complete', msg);
      navigation.popToTop();
    },
  });

  const apiError = parseApiError(mutation.error);

  // Reusable mode toggle button
  const ModeToggle = ({ opts }: { opts: { value: 'deduct' | 'extra'; label: string; sub: string }[] }) => (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      {opts.map((opt) => {
        const sel = payoutMode === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setPayoutMode(opt.value)}
            activeOpacity={0.7}
            style={{
              flex: 1, paddingHorizontal: theme.spacing.sm, paddingVertical: 10,
              borderRadius: theme.borderRadius.md, borderWidth: 1.5, alignItems: 'center',
              borderColor: sel ? theme.colors.primary : theme.colors.border,
              backgroundColor: sel ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
            }}
          >
            <Text style={[theme.typography.label, { color: sel ? theme.colors.primary : theme.colors.textSecondary, marginBottom: 2, fontSize: 12 }]}>
              {opt.label}
            </Text>
            <Text style={[theme.typography.caption, { color: sel ? theme.colors.primary : theme.colors.textSecondary, textAlign: 'center', fontSize: 10 }]} allowFontScaling={false}>
              {opt.sub}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* Token + amount card */}
        <AppCard style={{ marginBottom: theme.spacing.lg }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('txn.tokenLabel')}</Text>
          <Text style={[theme.typography.h2, { color: theme.colors.primary, marginTop: 4 }]}>{tokenNumber}</Text>

          {/* ── payout side (payout + legacy payout_extra): choose deduct or extra ── */}
          {isPayoutSide && (
            <>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }]}>
                How is commission handled?
              </Text>
              <ModeToggle opts={[
                { value: 'deduct', label: 'Deducted', sub: `Receiver gets ${fmtAmt(Number(finalAmount))}` },
                { value: 'extra',  label: 'Receiver pays extra', sub: `Receiver gets ${fmtAmt(Number(amount))}` },
              ]} />
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('txn.amountToPay')}</Text>
              <Text style={[theme.typography.h1, { color: theme.colors.success, marginTop: 4 }]} allowFontScaling={false}>
                {fmtAmt(displayPayAmount)}
              </Text>
              {payoutMode === 'deduct' && (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                  Commission {fmtAmt(Number(commissionAmount))} deducted — credited to collection branch
                </Text>
              )}
              {payoutMode === 'extra' && (
                <View style={{ marginTop: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.warning, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, borderLeftWidth: 3, borderLeftColor: theme.colors.warning }}>
                  <Text style={[theme.typography.label, { color: theme.colors.warning, fontSize: 11 }]}>COLLECT FROM RECEIVER</Text>
                  <Text style={[theme.typography.h3, { color: theme.colors.warning, marginTop: 2 }]} allowFontScaling={false}>{fmtAmt(Number(commissionAmount))}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>Commission — receiver pays this to you separately</Text>
                </View>
              )}
            </>
          )}

          {/* ── collection side: no commission choice ── */}
          {!isPayoutSide && (
            <>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginTop: theme.spacing.md }]}>{t('txn.amountToPay')}</Text>
              <Text style={[theme.typography.h1, { color: theme.colors.success, marginTop: 4 }]} allowFontScaling={false}>
                {fmtAmt(Number(finalAmount))}
              </Text>
            </>
          )}
        </AppCard>

        {/* Photo verification */}
        <AppCard style={{ marginBottom: theme.spacing.lg }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
            {t('txn.tokenVerification')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('txn.tokenPhotoHint')}
          </Text>
          <ImagePickerButton
            value={payoutPhotoUrl}
            onChange={setPayoutPhotoUrl}
          />
        </AppCard>

        {apiError && <ErrorMessage message={apiError} />}

        <AppButton
          title={t('txn.completePaymentBtn')}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
