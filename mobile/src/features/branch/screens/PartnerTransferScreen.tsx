import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt } from '../../../utils/fmt';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
import { externalAccountApi, partnerTransferApi } from '../api/externalAccountApi';
import { branchApi } from '../api/branchApi';

const COMMISSION_SIDES = [
  { value: 'none', label: 'None' },
  { value: 'collection', label: 'Sender Pays' },
  { value: 'payout', label: 'Receiver Pays' },
  { value: 'payout_extra', label: 'Rcvr Pays Extra' },
] as const;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
] as const;

function FieldRow({ label, value, color, theme }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: color || theme.colors.text }} allowFontScaling={false}>{value}</Text>
    </View>
  );
}

function SectionLabel({ text, theme }: any) {
  return <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4, marginTop: theme.spacing.sm }}>{text}</Text>;
}

function InlineInput({ label, value, onChangeText, placeholder, keyboardType, theme }: any) {
  return (
    <View style={{ flex: 1 }}>
      <SectionLabel text={label} theme={theme} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType || 'default'}
        style={{
          borderWidth: 1, borderColor: theme.colors.border,
          borderRadius: theme.borderRadius.sm, padding: 10,
          color: theme.colors.text, fontSize: 14,
        }}
      />
    </View>
  );
}

export function PartnerTransferScreen() {
  const theme = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);
  const isHO = user?.role === 'head_office';
  const myBranchId: string | undefined = user?.branchId;

  const { accountId, accountName } = route.params || {};

  const [fromBranchId, setFromBranchId] = useState<string>(myBranchId || '');
  const [toBranchId, setToBranchId] = useState('');
  const [amountStr, setAmountStr] = useState('');

  // People
  const [senderName, setSenderName] = useState('');
  const [senderMobile, setSenderMobile] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [customerTokenNo, setCustomerTokenNo] = useState('');

  // Commission
  const [commissionSide, setCommissionSide] = useState<string>('none');
  const [commissionType, setCommissionType] = useState<string>('flat');
  const [commissionValueStr, setCommissionValueStr] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [remarks, setRemarks] = useState('');

  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: branchesRaw, isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
    staleTime: 60_000,
  });
  const branches: any[] = (branchesRaw as any) || [];

  const { data: accountsRaw, isLoading: loadingAccounts } = useQuery({
    queryKey: ['external-accounts', 'active'],
    queryFn: () => externalAccountApi.list('active'),
    staleTime: 30_000,
  });
  const accounts: any[] = (accountsRaw as any) || [];

  const selectedAccount = useMemo(() => accounts.find((a: any) => a._id === accountId), [accounts, accountId]);

  const amount = Math.round(parseFloat(amountStr) || 0);
  const commissionValue = Math.round(parseFloat(commissionValueStr) || 0);

  const commissionAmount = useMemo(() => {
    if (commissionSide === 'none' || commissionValue <= 0) return 0;
    return commissionType === 'percentage' ? Math.round(amount * commissionValue / 100) : commissionValue;
  }, [commissionSide, commissionType, commissionValue, amount]);

  const finalAmount = commissionSide === 'payout' ? Math.max(0, amount - commissionAmount) : amount;

  const fromBranchBalance: number = useMemo(() => {
    if (!selectedAccount || !fromBranchId) return 0;
    const bals = selectedAccount.balances || {};
    return bals[fromBranchId] ?? 0;
  }, [selectedAccount, fromBranchId]);

  const fromBranchOnHold: number = useMemo(() => {
    if (!selectedAccount || !fromBranchId) return 0;
    const holds = selectedAccount.onHolds || {};
    return holds[fromBranchId] ?? 0;
  }, [selectedAccount, fromBranchId]);

  const fromBranchAvailable = Math.max(0, fromBranchBalance - fromBranchOnHold);

  const toBranchBalance: number = useMemo(() => {
    if (!selectedAccount || !toBranchId) return 0;
    const bals = selectedAccount.balances || {};
    return bals[toBranchId] ?? 0;
  }, [selectedAccount, toBranchId]);

  // Shortfall calculation (informational — we always allow)
  const partnerCoversAmount = Math.min(amount, fromBranchAvailable);
  const branchCoversAmount = amount - partnerCoversAmount;

  const fromBranch = branches.find((b: any) => b._id === fromBranchId);
  const toBranch = branches.find((b: any) => b._id === toBranchId);

  const validationError = useMemo(() => {
    if (!fromBranchId) return 'Select source branch';
    if (!toBranchId) return 'Select destination branch';
    if (fromBranchId === toBranchId) return 'Source and destination branches must be different';
    if (amount <= 0) return 'Enter a valid amount';
    if (commissionSide !== 'none' && commissionValue <= 0) return 'Enter commission value';
    return null;
  }, [fromBranchId, toBranchId, amount, commissionSide, commissionValue]);

  const mutation = useMutation({
    mutationFn: () => partnerTransferApi.create({
      externalAccountId: accountId,
      fromBranchId,
      toBranchId,
      amount,
      remarks: remarks.trim() || undefined,
      senderName: senderName.trim() || undefined,
      senderMobile: senderMobile.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      receiverMobile: receiverMobile.trim() || undefined,
      customerTokenNo: customerTokenNo.trim() || undefined,
      commissionSide,
      commissionType: commissionSide !== 'none' ? commissionType : undefined,
      commissionValue: commissionSide !== 'none' ? commissionValue : undefined,
      paymentMethod,
    }),
    onSuccess: (data: any) => {
      setShowConfirm(false);
      navigation.replace('PartnerTransferDetail', { transferId: data._id });
    },
    onError: (err: any) => {
      setShowConfirm(false);
      setError(parseApiError(err) || 'Failed to create transfer');
    },
  });

  const handleSubmit = () => {
    setError('');
    if (validationError) { setError(validationError); return; }
    setShowConfirm(true);
  };

  if (loadingBranches || loadingAccounts) return <LoadingScreen />;

  const BranchSelector = ({ label, value, onChange, excludeId }: any) => (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <SectionLabel text={label} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
        {branches.filter((b: any) => b._id !== excludeId).map((b: any) => {
          const active = value === b._id;
          return (
            <TouchableOpacity
              key={b._id}
              onPress={() => onChange(b._id)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primary : theme.colors.surface }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : theme.colors.text }}>{b.code}</Text>
              <Text style={{ fontSize: 10, color: active ? withAlpha('#fff', 0.8) : theme.colors.textSecondary, textAlign: 'center' }}>{b.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const ChipSelector = ({ label, options, value, onChange }: any) => (
    <View>
      <SectionLabel text={label} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
        {options.map((opt: any) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primary : theme.colors.surface }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : theme.colors.text }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const commissionDesc = useMemo(() => {
    if (commissionSide === 'none' || !commissionAmount) return null;
    if (commissionSide === 'collection') {
      return `Mokalnar pays ₹${fmtAmt(commissionAmount)} extra commission → stays at ${fromBranch?.code || 'source'} branch`;
    }
    if (commissionSide === 'payout') {
      return `Commission deducted from transfer → Lenar receives ₹${fmtAmt(finalAmount)} (₹${fmtAmt(commissionAmount)} kept at ${fromBranch?.code || 'source'})`;
    }
    if (commissionSide === 'payout_extra') {
      return `Lenar pays ₹${fmtAmt(commissionAmount)} extra at ${toBranch?.code || 'dest'} branch`;
    }
    return null;
  }, [commissionSide, commissionAmount, finalAmount, fromBranch, toBranch]);

  const showPreview = fromBranchId && toBranchId && fromBranchId !== toBranchId && amount > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm }} keyboardShouldPersistTaps="handled">

        {/* Partner info */}
        <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.06), borderRadius: theme.borderRadius.md, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(theme.colors.primary, 0.15), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="business-outline" size={20} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{accountName || selectedAccount?.name}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Partner Fund Transfer</Text>
          </View>
        </View>

        {/* Sender (Mokalnar) */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <InlineInput label="SENDER NAME (MOKALNAR)" value={senderName} onChangeText={setSenderName} placeholder="Full name" theme={theme} />
          <InlineInput label="SENDER MOBILE" value={senderMobile} onChangeText={setSenderMobile} placeholder="10-digit" keyboardType="phone-pad" theme={theme} />
        </View>

        {/* Receiver (Lenar) */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <InlineInput label="RECEIVER NAME (LENAR)" value={receiverName} onChangeText={setReceiverName} placeholder="Full name" theme={theme} />
          <InlineInput label="RECEIVER MOBILE" value={receiverMobile} onChangeText={setReceiverMobile} placeholder="10-digit" keyboardType="phone-pad" theme={theme} />
        </View>

        {/* Token number */}
        <View>
          <SectionLabel text="CUSTOMER TOKEN NO (OPTIONAL)" theme={theme} />
          <TextInput
            value={customerTokenNo}
            onChangeText={setCustomerTokenNo}
            placeholder="e.g. TK-2024-00123"
            placeholderTextColor={theme.colors.textSecondary}
            style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 14 }}
          />
        </View>

        {/* From branch */}
        {isHO ? (
          <BranchSelector label="FROM BRANCH (MOKALNAR)" value={fromBranchId} onChange={setFromBranchId} excludeId={toBranchId} />
        ) : (
          <View>
            <SectionLabel text="FROM BRANCH (MOKALNAR)" theme={theme} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: withAlpha(theme.colors.primary, 0.06), borderRadius: theme.borderRadius.sm }}>
              <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{fromBranch?.code} — {fromBranch?.name}</Text>
              <Text style={{ marginLeft: 'auto', fontSize: 11, color: theme.colors.textSecondary }}>(your branch)</Text>
            </View>
          </View>
        )}

        {/* Arrow */}
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="arrow-down" size={20} color={theme.colors.textSecondary} />
        </View>

        {/* To branch */}
        <BranchSelector label="TO BRANCH (LENAR)" value={toBranchId} onChange={setToBranchId} excludeId={fromBranchId} />

        {/* Amount */}
        <View>
          <SectionLabel text="AMOUNT" theme={theme} />
          <TextInput
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholder="₹0"
            placeholderTextColor={theme.colors.textSecondary}
            style={{ borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 12, color: theme.colors.text, fontSize: 22, fontWeight: '700' }}
          />
          {fromBranchId && (
            <View style={{ marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Available at {fromBranch?.code || '—'}: {fmtAmt(fromBranchAvailable)}
                {fromBranchOnHold > 0 ? ` (${fmtAmt(fromBranchOnHold)} on hold)` : ''}
              </Text>
              {branchCoversAmount > 0 && amount > 0 && (
                <Text style={{ fontSize: 11, color: theme.colors.warning, fontWeight: '600' }}>Branch covers {fmtAmt(branchCoversAmount)}</Text>
              )}
            </View>
          )}
        </View>

        {/* Payment method */}
        <ChipSelector label="PAYMENT METHOD" options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />

        {/* Commission side */}
        <ChipSelector label="COMMISSION" options={COMMISSION_SIDES} value={commissionSide} onChange={(v: string) => { setCommissionSide(v); }} />

        {/* Commission type + value */}
        {commissionSide !== 'none' && (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {/* Type toggle */}
              <View style={{ flex: 1 }}>
                <SectionLabel text="COMMISSION TYPE" theme={theme} />
                <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, overflow: 'hidden' }}>
                  {['flat', 'percentage'].map((t) => {
                    const active = commissionType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setCommissionType(t)}
                        style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? theme.colors.primary : theme.colors.surface }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : theme.colors.text }}>{t === 'flat' ? 'Flat ₹' : 'Percent %'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {/* Value */}
              <View style={{ flex: 1 }}>
                <SectionLabel text={commissionType === 'percentage' ? 'PERCENTAGE (%)' : 'AMOUNT (₹)'} theme={theme} />
                <TextInput
                  value={commissionValueStr}
                  onChangeText={setCommissionValueStr}
                  keyboardType="decimal-pad"
                  placeholder={commissionType === 'percentage' ? '0.00%' : '₹0'}
                  placeholderTextColor={theme.colors.textSecondary}
                  style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 16, fontWeight: '700' }}
                />
              </View>
            </View>

            {/* Commission preview */}
            {commissionAmount > 0 && commissionDesc && (
              <View style={{ backgroundColor: withAlpha(theme.colors.warning, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, borderLeftWidth: 3, borderLeftColor: theme.colors.warning }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.warning, marginBottom: 2 }}>Commission: {fmtAmt(commissionAmount)}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{commissionDesc}</Text>
              </View>
            )}
          </View>
        )}

        {/* Remarks */}
        <View>
          <SectionLabel text="REMARKS (OPTIONAL)" theme={theme} />
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Reason for transfer..."
            placeholderTextColor={theme.colors.textSecondary}
            style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 14, minHeight: 60 }}
            multiline
          />
        </View>

        {/* Live preview */}
        {showPreview && (
          <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.06), padding: theme.spacing.sm }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.primary }}>TRANSFER PREVIEW</Text>
            </View>
            <View style={{ padding: theme.spacing.md }}>
              {/* Source */}
              <View style={{ marginBottom: theme.spacing.sm }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 }}>{fromBranch?.code} — SOURCE (MOKALNAR)</Text>
                <FieldRow label="Partner Balance" value={fmtAmt(fromBranchBalance)} theme={theme} />
                <FieldRow label="On Hold" value={fmtAmt(fromBranchOnHold)} color={fromBranchOnHold > 0 ? theme.colors.warning : theme.colors.textSecondary} theme={theme} />
                <FieldRow label="Available" value={fmtAmt(fromBranchAvailable)} color={theme.colors.success} theme={theme} />
                {partnerCoversAmount > 0 && <FieldRow label="Partner covers" value={`− ${fmtAmt(partnerCoversAmount)}`} color={theme.colors.error} theme={theme} />}
                {branchCoversAmount > 0 && <FieldRow label="Branch covers (on hold)" value={fmtAmt(branchCoversAmount)} color={theme.colors.warning} theme={theme} />}
                {commissionSide === 'collection' && commissionAmount > 0 && (
                  <FieldRow label="Commission earned" value={`+ ${fmtAmt(commissionAmount)}`} color={theme.colors.success} theme={theme} />
                )}
                {commissionSide === 'payout' && commissionAmount > 0 && (
                  <FieldRow label="Commission earned (on complete)" value={`+ ${fmtAmt(commissionAmount)}`} color={theme.colors.success} theme={theme} />
                )}
              </View>

              {/* Arrow */}
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                <Ionicons name="arrow-down" size={16} color={theme.colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>{fmtAmt(finalAmount)}</Text>
              </View>

              {/* Destination */}
              <View style={{ marginTop: theme.spacing.sm }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 }}>{toBranch?.code} — DESTINATION (LENAR)</Text>
                <FieldRow label="Current Balance" value={fmtAmt(toBranchBalance)} theme={theme} />
                <FieldRow label="Receives" value={`+ ${fmtAmt(finalAmount)}`} color={theme.colors.success} theme={theme} />
                {commissionSide === 'payout' && commissionAmount > 0 && (
                  <FieldRow label="Commission deducted" value={`− ${fmtAmt(commissionAmount)}`} color={theme.colors.error} theme={theme} />
                )}
                {commissionSide === 'payout_extra' && commissionAmount > 0 && (
                  <FieldRow label="Commission earned (on complete)" value={`+ ${fmtAmt(commissionAmount)}`} color={theme.colors.success} theme={theme} />
                )}
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />
                <FieldRow label="After Transfer" value={fmtAmt(toBranchBalance + finalAmount)} color={theme.colors.primary} theme={theme} />
              </View>
            </View>
          </View>
        )}

        {fromBranchId === toBranchId && fromBranchId && toBranchId && (
          <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center' }}>Source and destination branches must be different</Text>
        )}

        {!!error && (
          <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.error, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <AppButton
          title={isHO ? 'Transfer Now' : 'Submit for Approval'}
          onPress={handleSubmit}
          disabled={!!validationError}
          style={{ marginTop: theme.spacing.sm }}
        />

        {!isHO && (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            Branch transfers require head office approval before funds move
          </Text>
        )}
      </ScrollView>

      {/* Confirmation modal */}
      <Modal visible={showConfirm} animationType="fade" transparent onRequestClose={() => setShowConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.md }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, width: '100%', maxWidth: 400 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Confirm Transfer</Text>

            <View style={{ gap: 4, marginBottom: theme.spacing.md }}>
              <Text style={{ fontSize: 26, fontWeight: '800', color: theme.colors.primary, textAlign: 'center' }} allowFontScaling={false}>{fmtAmt(amount)}</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' }}>{accountName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginTop: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{fromBranch?.code}</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.textSecondary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{toBranch?.code}</Text>
              </View>
              {(senderName || receiverName) && (
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 2 }}>
                  {senderName || '—'} → {receiverName || '—'}
                </Text>
              )}
            </View>

            <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md, gap: 4 }}>
              {partnerCoversAmount > 0 && <FieldRow label="Partner covers" value={fmtAmt(partnerCoversAmount)} theme={theme} />}
              {branchCoversAmount > 0 && <FieldRow label="Branch covers" value={fmtAmt(branchCoversAmount)} color={theme.colors.warning} theme={theme} />}
              <FieldRow label="Lenar receives" value={fmtAmt(finalAmount)} color={theme.colors.success} theme={theme} />
              {commissionSide !== 'none' && commissionAmount > 0 && (
                <FieldRow label="Commission" value={fmtAmt(commissionAmount)} color={theme.colors.warning} theme={theme} />
              )}
              <FieldRow label="Payment method" value={paymentMethod.toUpperCase()} theme={theme} />
            </View>

            {!isHO && (
              <Text style={[theme.typography.caption, { color: theme.colors.warning, marginBottom: theme.spacing.sm, textAlign: 'center' }]}>
                This will be submitted for head office approval
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <AppButton title="Cancel" variant="outline" onPress={() => setShowConfirm(false)} style={{ flex: 1 }} />
              <AppButton title={isHO ? 'Transfer' : 'Submit'} onPress={() => mutation.mutate()} loading={mutation.isPending} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
