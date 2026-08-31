import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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
import { ImagePickerButton } from '../../../shared/components/ImagePickerButton';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  navigation: any;
}

export function CompleteByTokenScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();

  const [tokenInput, setTokenInput] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [foundTx, setFoundTx] = useState<any>(null);
  const [payoutPhotoUrl, setPayoutPhotoUrl] = useState<string | null>(null);

  const handleSearch = async () => {
    const token = tokenInput.trim().toUpperCase();
    if (!token) {
      setSearchError(t('txn.tokenRequired'));
      return;
    }
    setSearchError('');
    setFoundTx(null);
    setPayoutPhotoUrl(null);
    setSearching(true);
    try {
      const result = await transactionApi.list({
        tokenNumber: token,
        approvalStatus: 'approved',
        paymentStatus: 'pending',
        limit: 1,
      });
      const tx = result?.data?.[0] || null;
      if (!tx) {
        setSearchError(t('txn.tokenNotFound'));
      } else {
        setFoundTx(tx);
      }
    } catch (e: any) {
      setSearchError(parseApiError(e) ?? 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const completeMutation = useMutation({
    mutationFn: () => transactionApi.completePayment(foundTx._id, payoutPhotoUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast('success', 'Payment Complete', `Token ${foundTx.tokenNumber} — ${fmtAmt(Number(foundTx.finalAmount))} paid successfully.`);
      setFoundTx(null);
      setTokenInput('');
      setPayoutPhotoUrl(null);
      navigation.goBack();
    },
    onError: (e: any) => {
      showToast('error', 'Error', parseApiError(e) ?? 'Failed to complete payment');
    },
  });

  const apiError = parseApiError(completeMutation.error);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Token search */}
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('txn.enterToken')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '600',
                backgroundColor: theme.colors.inputBackground,
                letterSpacing: 0.5,
              }}
              placeholder={t('txn.tokenInputPlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={tokenInput}
              onChangeText={(v) => { setTokenInput(v); setSearchError(''); setFoundTx(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <AppButton
              title={t('txn.find')}
              onPress={handleSearch}
              loading={searching}
              style={{ paddingHorizontal: 20 }}
            />
          </View>
          {!!searchError && (
            <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 8 }]}>
              {searchError}
            </Text>
          )}
        </AppCard>

        {/* Found transaction card */}
        {foundTx && (
          <>
            <AppCard style={{ marginBottom: theme.spacing.md, borderWidth: 1.5, borderColor: theme.colors.success + '60' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} style={{ marginRight: 8 }} />
                <Text style={[theme.typography.label, { color: theme.colors.success }]}>{t('txn.txnFound')}</Text>
              </View>

              <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{t('txn.tokenLabel')}</Text>
                <Text style={[theme.typography.label, { color: theme.colors.primary }]}>{foundTx.tokenNumber}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{t('txn.amountToPayLabel')}</Text>
                <Text style={[theme.typography.label, { color: theme.colors.success, fontWeight: '700' }]}>
                  {fmtAmt(Number(foundTx.finalAmount))}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{t('txn.collectionBranch')}</Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>
                  {foundTx.collectionBranchId?.name}
                </Text>
              </View>
            </AppCard>

            {/* Photo upload */}
            <AppCard style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
                {t('txn.tokenSlipPhoto')}
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
              title={`${t('txn.completeFor')} ${fmtAmt(Number(foundTx.finalAmount))}`}
              onPress={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
              style={{ marginTop: theme.spacing.sm }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
