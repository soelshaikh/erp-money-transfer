import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { transactionApi } from '../api/transactionApi';
import { branchApi } from '../../branch/api/branchApi';
import { settingsApi } from '../../settings/api/settingsApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { AppCard } from '../../../shared/components/AppCard';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt } from '../../../utils/fmt';
import { ImagePickerButton } from '../../../shared/components/ImagePickerButton';
import BranchPicker from '../components/BranchPicker';
import { withAlpha } from '../../../utils/colors';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'bank_transfer', label: 'IMPS' },
];

interface Props {
  navigation: any;
}

export function CreateTransactionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const user = useAuthStore((s: any) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);

  const canOverrideCommission = user?.permissions?.canOverrideCommission === true;

  const [form, setForm] = useState<{
    payoutBranchId: any;
    amount: string;
    remarks: string;
    customerTokenNo: string;
    paymentMethod: string;
    collectionPhotoUrl: string | null;
    overrideCommission: boolean;
    commissionType: string;
    commissionValue: string;
    commissionSide: 'collection' | 'payout';
  }>({
    payoutBranchId: null,
    amount: '',
    remarks: '',
    customerTokenNo: '',
    paymentMethod: 'cash',
    collectionPhotoUrl: null,
    overrideCommission: false,
    commissionType: 'flat',
    commissionValue: '',
    commissionSide: 'collection',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
    staleTime: 60_000,
  });
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 300_000,
  });
  const allBranches = (branchesData as any) || [];
  const payoutBranches = allBranches.filter((b: any) => b._id !== user?.branchId);
  const myBranch = allBranches.find((b: any) => b._id === user?.branchId);

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.payoutBranchId) e.payoutBranchId = 'Select payout branch';
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) e.amount = 'Enter a valid amount';
    if (form.overrideCommission) {
      const cv = parseFloat(form.commissionValue);
      if (isNaN(cv) || cv < 0) e.commissionValue = 'Enter a valid commission value';
      if (form.commissionType === 'percentage' && cv > 100) e.commissionValue = 'Percentage cannot exceed 100';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return transactionApi.create({
        collectionBranchId: user?.branchId,
        payoutBranchId: form.payoutBranchId,
        amount: parseFloat(form.amount),
        paymentMethod: form.paymentMethod,
        commissionSide: form.commissionSide,
        ...(form.collectionPhotoUrl && { collectionPhotoUrl: form.collectionPhotoUrl }),
        ...(form.remarks.trim() && { remarks: form.remarks.trim() }),
        ...(form.customerTokenNo.trim() && { customerTokenNo: form.customerTokenNo.trim() }),
        ...(form.overrideCommission && canOverrideCommission && {
          commissionOverride: {
            type: form.commissionType,
            value: parseFloat(form.commissionValue) || 0,
          },
        }),
      }, idempotencyKey);
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Transaction Created', `Token: ${data.tokenNumber}\nAmount: ${fmtAmt(Number(data.amount))}`, [
        { text: 'View', onPress: () => navigation.replace('TransactionDetail', { transactionId: data._id }) },
        { text: 'New', onPress: () => navigation.goBack() },
      ]);
    },
  });

  const apiError = parseApiError(mutation.error);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {apiError && <ErrorMessage message={apiError} />}

        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>{t('txn.branchDetails')}</Text>

          <View style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>{t('txn.yourBranchLabel')}</Text>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 12,
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1, borderColor: theme.colors.border,
              flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={[theme.typography.label, { color: theme.colors.primary, marginRight: theme.spacing.sm }]}>
                {myBranch?.code || '—'}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                {myBranch?.name || t('txn.yourBranchDefault')}
              </Text>
            </View>
          </View>

          <BranchPicker
            label={t('txn.payoutBranchLabel')}
            branches={payoutBranches}
            selectedId={form.payoutBranchId}
            onSelect={(id: any) => setForm((f) => ({ ...f, payoutBranchId: id }))}
            error={errors.payoutBranchId}
            theme={theme}
          />

          <View style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {t('txn.paymentMethodLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {PAYMENT_METHODS.map((m) => {
                const selected = form.paymentMethod === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setForm((f) => ({ ...f, paymentMethod: m.value }))}
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: 9,
                      borderRadius: theme.borderRadius.md,
                      borderWidth: 1.5,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[theme.typography.body, { color: selected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: selected ? '600' : '400' }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ImagePickerButton
            label={t('txn.photoOptional')}
            value={form.collectionPhotoUrl}
            onChange={(url) => setForm((f) => ({ ...f, collectionPhotoUrl: url }))}
          />
        </AppCard>

        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>{t('txn.amountSection')}</Text>

          {/* Commission side selector */}
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('txn.commissionSide')}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            {([
              { value: 'collection', label: t('txn.senderPays'), sub: t('txn.senderPaysSub') },
              { value: 'payout',     label: t('txn.receiverPays'), sub: t('txn.receiverPaysSub') },
            ] as const).map((opt) => {
              const sel = form.commissionSide === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setForm((f) => ({ ...f, commissionSide: opt.value }))}
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
                  <Text style={[theme.typography.label, { color: sel ? theme.colors.primary : theme.colors.textSecondary, marginBottom: 2 }]}>
                    {opt.label}
                  </Text>
                  <Text style={[theme.typography.caption, { color: sel ? theme.colors.primary : theme.colors.textSecondary, textAlign: 'center' }]} allowFontScaling={false}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Contextual note */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: withAlpha(theme.colors.primary, 0.06),
            borderRadius: theme.borderRadius.sm,
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            gap: 6,
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, lineHeight: 18, flex: 1 }]}>
              {form.commissionSide === 'collection'
                ? `${t('txn.commCollectionNote')} ${myBranch?.name || t('txn.collectionBranch')}.`
                : t('txn.commPayoutNote')}
            </Text>
          </View>

          <AppInput
            label={form.commissionSide === 'collection' ? t('txn.transferAmount') : t('txn.totalFromSender')}
            value={form.amount}
            onChangeText={(v: string) => setForm((f) => ({ ...f, amount: v }))}
            placeholder={t('txn.amountPlaceholder')}
            keyboardType="decimal-pad"
            error={errors.amount}
            returnKeyType="next"
          />

          {/* Commission override (inline, before preview) */}
          {canOverrideCommission && (
            <View style={{ marginBottom: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.overrideCommission ? theme.spacing.md : 0 }}>
                <View>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('txn.overrideCommission')}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    {t('txn.overrideCommissionSub')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setForm((f) => ({ ...f, overrideCommission: !f.overrideCommission }))}
                  style={{
                    width: 44, height: 26, borderRadius: 13,
                    backgroundColor: form.overrideCommission ? theme.colors.primary : theme.colors.border,
                    justifyContent: 'center', paddingHorizontal: 2,
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: theme.colors.surface,
                    alignSelf: form.overrideCommission ? 'flex-end' : 'flex-start',
                  }} />
                </TouchableOpacity>
              </View>
              {form.overrideCommission && (
                <>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
                    {t('txn.commissionType')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                    {(['flat', 'percentage'] as const).map((commType) => {
                      const selected = form.commissionType === commType;
                      return (
                        <TouchableOpacity
                          key={commType}
                          onPress={() => setForm((f) => ({ ...f, commissionType: commType }))}
                          style={{
                            paddingHorizontal: theme.spacing.md, paddingVertical: 9,
                            borderRadius: theme.borderRadius.md, borderWidth: 1.5,
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[theme.typography.body, { color: selected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: selected ? '600' : '400' }]}>
                            {commType === 'flat' ? t('txn.flatType') : t('txn.percentType')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <AppInput
                    label={form.commissionType === 'flat' ? t('txn.commAmt') : t('txn.commPct')}
                    value={form.commissionValue}
                    onChangeText={(v: string) => setForm((f) => ({ ...f, commissionValue: v }))}
                    placeholder={form.commissionType === 'flat' ? t('txn.eg50') : t('txn.eg25')}
                    keyboardType="decimal-pad"
                    error={errors.commissionValue}
                    returnKeyType="done"
                  />
                </>
              )}
            </View>
          )}

          {/* Live commission preview — reacts to override values */}
          {(() => {
            const parsedAmt = parseFloat(form.amount) || 0;
            if (parsedAmt <= 0 || !form.payoutBranchId) return null;
            const selectedPayoutBranch = payoutBranches.find((b: any) => b._id === form.payoutBranchId);
            const globalComm = (settingsData as any)?.settings?.commission || {};
            const sourceBranch = form.commissionSide === 'payout' ? selectedPayoutBranch : myBranch;
            const isOverrideActive = form.overrideCommission && canOverrideCommission && !!form.commissionValue;
            const isBranchConfig = !isOverrideActive && !!sourceBranch?.commissionConfig?.enabled;
            const cType = isOverrideActive ? form.commissionType : (isBranchConfig ? sourceBranch.commissionConfig.type : (globalComm.type || 'flat'));
            const cValue = isOverrideActive ? (parseFloat(form.commissionValue) || 0) : (isBranchConfig ? sourceBranch.commissionConfig.value : (globalComm.value || 0));
            const cAmount = cType === 'percentage' ? Math.round(parsedAmt * cValue / 100) : cValue;
            const senderPays = form.commissionSide === 'collection' ? parsedAmt + cAmount : parsedAmt;
            const receiverGets = form.commissionSide === 'collection' ? parsedAmt : parsedAmt - cAmount;
            const accentColor = isOverrideActive ? '#7c3aed' : (isBranchConfig ? '#d97706' : theme.colors.primary);
            const badgeText = isOverrideActive ? 'OVERRIDE' : (isBranchConfig ? 'BRANCH' : 'GLOBAL');
            const rateLabel = isOverrideActive
              ? `Override: ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`
              : (isBranchConfig
                ? `Branch Commission (${sourceBranch?.code}): ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`
                : `Global Commission: ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`);
            return (
              <View style={{
                backgroundColor: withAlpha(accentColor, 0.07),
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.sm,
                marginBottom: theme.spacing.md,
                borderWidth: 1,
                borderColor: withAlpha(accentColor, 0.22),
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="pricetag-outline" size={13} color={accentColor} />
                  <Text style={[theme.typography.caption, { color: accentColor, fontWeight: '700', flex: 1 }]}>{rateLabel}</Text>
                  <View style={{ backgroundColor: withAlpha(accentColor, 0.15), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: accentColor, fontWeight: '700' }} allowFontScaling={false}>{badgeText}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
                  <View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Sender pays</Text>
                    <Text style={[theme.typography.label, { color: theme.colors.text }]} allowFontScaling={false}>₹{senderPays.toLocaleString('en-IN')}</Text>
                  </View>
                  <View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Commission</Text>
                    <Text style={[theme.typography.label, { color: accentColor }]} allowFontScaling={false}>₹{cAmount.toLocaleString('en-IN')}</Text>
                  </View>
                  <View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Receiver gets</Text>
                    <Text style={[theme.typography.label, { color: theme.colors.success }]} allowFontScaling={false}>₹{receiverGets.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            );
          })()}

          <AppInput
            label={t('txn.remarksOptional')}
            value={form.remarks}
            onChangeText={(v: string) => setForm((f) => ({ ...f, remarks: v }))}
            placeholder={t('txn.remarksPlaceholder')}
            multiline
            autoCapitalize="sentences"
            autoCorrect={true}
            returnKeyType="next"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
          />
          <AppInput
            label={t('txn.tokenOptional')}
            value={form.customerTokenNo}
            onChangeText={(v: string) => setForm((f) => ({ ...f, customerTokenNo: v }))}
            placeholder={t('txn.tokenPlaceholder')}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
          />
        </AppCard>

        <AppButton
          title={t('txn.createTxnBtn')}
          onPress={() => validate() && mutation.mutate()}
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
