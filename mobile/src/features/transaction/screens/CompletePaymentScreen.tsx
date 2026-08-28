import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { transactionApi } from '../api/transactionApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppCard } from '../../../shared/components/AppCard';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
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
  // Only relevant when commissionSide === 'payout'
  // 'deduct' = receiver got less (default), 'extra' = receiver got full amount and pays commission separately
  const [payoutMode, setPayoutMode] = useState<'deduct' | 'extra'>('deduct');

  const isPayoutSide = commissionSide === 'payout';

  const mutation = useMutation({
    mutationFn: () => transactionApi.completePayment(transactionId, payoutPhotoUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['external-accounts'] });
      const msg = isPayoutSide && payoutMode === 'extra'
        ? `Token ${tokenNumber} — Paid ${fmtAmt(Number(amount))} to receiver. Collect ${fmtAmt(Number(commissionAmount))} commission from them.`
        : `Token ${tokenNumber} — ${fmtAmt(Number(finalAmount))} paid to receiver.`;
      Alert.alert('Payment Complete', msg, [
        { text: 'Done', onPress: () => navigation.popToTop() },
      ]);
    },
  });

  const apiError = parseApiError(mutation.error);

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

          {isPayoutSide ? (
            <>
              {/* Mode toggle */}
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }]}>
                How did receiver pay commission?
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                {([
                  { value: 'deduct', label: 'Deducted', sub: `Receiver gets ${fmtAmt(Number(finalAmount))}` },
                  { value: 'extra',  label: 'Paid separately', sub: `Receiver gets ${fmtAmt(Number(amount))}` },
                ] as const).map((opt) => {
                  const sel = payoutMode === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setPayoutMode(opt.value)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 10,
                        borderRadius: theme.borderRadius.md,
                        borderWidth: 1.5,
                        borderColor: sel ? theme.colors.primary : theme.colors.border,
                        backgroundColor: sel ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                        alignItems: 'center',
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

              {payoutMode === 'deduct' ? (
                <>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('txn.amountToPay')}</Text>
                  <Text style={[theme.typography.h1, { color: theme.colors.success, marginTop: 4 }]} allowFontScaling={false}>
                    {fmtAmt(Number(finalAmount))}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                    Commission ₹{fmtAmt(Number(commissionAmount))} already deducted
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>PAY TO RECEIVER</Text>
                  <Text style={[theme.typography.h1, { color: theme.colors.success, marginTop: 4 }]} allowFontScaling={false}>
                    {fmtAmt(Number(amount))}
                  </Text>
                  <View style={{
                    marginTop: theme.spacing.sm,
                    backgroundColor: '#fff8ed',
                    borderRadius: theme.borderRadius.sm,
                    padding: theme.spacing.sm,
                    borderLeftWidth: 3,
                    borderLeftColor: '#d97706',
                  }}>
                    <Text style={[theme.typography.label, { color: '#d97706', fontSize: 11 }]}>
                      COLLECT FROM RECEIVER
                    </Text>
                    <Text style={[theme.typography.h3, { color: '#d97706', marginTop: 2 }]} allowFontScaling={false}>
                      {fmtAmt(Number(commissionAmount))}
                    </Text>
                    <Text style={[theme.typography.caption, { color: '#92400e', marginTop: 2 }]}>
                      Commission — receiver pays this separately to you
                    </Text>
                  </View>
                </>
              )}
            </>
          ) : (
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
