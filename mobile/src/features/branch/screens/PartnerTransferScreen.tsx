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

  // Per-branch balance data for live preview
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

  const fromBranch = branches.find((b: any) => b._id === fromBranchId);
  const toBranch = branches.find((b: any) => b._id === toBranchId);

  const validationError = useMemo(() => {
    if (!fromBranchId) return 'Select source branch';
    if (!toBranchId) return 'Select destination branch';
    if (fromBranchId === toBranchId) return 'Source and destination branches must be different';
    if (amount <= 0) return 'Enter a valid amount';
    if (amount > fromBranchAvailable) return `Insufficient available balance at ${fromBranch?.code || 'source'}. Available: ${fmtAmt(fromBranchAvailable)}`;
    return null;
  }, [fromBranchId, toBranchId, amount, fromBranchAvailable, fromBranch]);

  const mutation = useMutation({
    mutationFn: () => partnerTransferApi.create({
      externalAccountId: accountId,
      fromBranchId,
      toBranchId,
      amount,
      remarks: remarks.trim() || undefined,
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

        {/* From branch */}
        {isHO ? (
          <BranchSelector label="FROM BRANCH" value={fromBranchId} onChange={setFromBranchId} excludeId={toBranchId} />
        ) : (
          <View>
            <SectionLabel text="FROM BRANCH" theme={theme} />
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
        <BranchSelector label="TO BRANCH" value={toBranchId} onChange={setToBranchId} excludeId={fromBranchId} />

        {/* Amount */}
        <View>
          <SectionLabel text="AMOUNT" theme={theme} />
          <TextInput
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholder="₹0"
            placeholderTextColor={theme.colors.textSecondary}
            style={{ borderWidth: 1.5, borderColor: amount > fromBranchAvailable && amount > 0 ? theme.colors.error : theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 12, color: theme.colors.text, fontSize: 22, fontWeight: '700' }}
          />
          {fromBranchId && (
            <Text style={{ marginTop: 4, fontSize: 12, color: amount > fromBranchAvailable && amount > 0 ? theme.colors.error : theme.colors.textSecondary }}>
              Available at {fromBranch?.code || '—'}: {fmtAmt(fromBranchAvailable)}
              {fromBranchOnHold > 0 ? ` (${fmtAmt(fromBranchOnHold)} on hold)` : ''}
            </Text>
          )}
        </View>

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
        {fromBranchId && toBranchId && fromBranchId !== toBranchId && amount > 0 && (
          <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.06), padding: theme.spacing.sm }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.primary }}>TRANSFER PREVIEW</Text>
            </View>
            <View style={{ padding: theme.spacing.md }}>
              {/* Source */}
              <View style={{ marginBottom: theme.spacing.sm }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 }}>{fromBranch?.code} (SOURCE)</Text>
                <FieldRow label="Current Balance" value={fmtAmt(fromBranchBalance)} theme={theme} />
                <FieldRow label="On Hold" value={fmtAmt(fromBranchOnHold)} color={fromBranchOnHold > 0 ? theme.colors.warning : theme.colors.textSecondary} theme={theme} />
                <FieldRow label="Available" value={fmtAmt(fromBranchAvailable)} color={theme.colors.success} theme={theme} />
                <FieldRow label="Transfer Amount" value={`− ${fmtAmt(amount)}`} color={theme.colors.error} theme={theme} />
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />
                <FieldRow label="After Transfer" value={fmtAmt(Math.max(0, fromBranchBalance - amount))} color={theme.colors.primary} theme={theme} />
              </View>

              {/* Arrow */}
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                <Ionicons name="arrow-down" size={16} color={theme.colors.textSecondary} />
              </View>

              {/* Destination */}
              <View style={{ marginTop: theme.spacing.sm }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 }}>{toBranch?.code} (DESTINATION)</Text>
                <FieldRow label="Current Balance" value={fmtAmt(toBranchBalance)} theme={theme} />
                <FieldRow label="Transfer Amount" value={`+ ${fmtAmt(amount)}`} color={theme.colors.success} theme={theme} />
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />
                <FieldRow label="After Transfer" value={fmtAmt(toBranchBalance + amount)} color={theme.colors.primary} theme={theme} />
              </View>

              {/* Total unchanged */}
              <View style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Partner Total Balance</Text>
                <Text style={{ fontSize: 12, color: theme.colors.success, fontWeight: '700' }}>No Change · {fmtAmt(selectedAccount?.totalBalance ?? selectedAccount?.balance ?? 0)}</Text>
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
            </View>

            <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md, gap: 4 }}>
              <FieldRow label={`${fromBranch?.code} after`} value={fmtAmt(Math.max(0, fromBranchBalance - amount))} color={theme.colors.error} theme={theme} />
              <FieldRow label={`${toBranch?.code} after`} value={fmtAmt(toBranchBalance + amount)} color={theme.colors.success} theme={theme} />
              <FieldRow label="Partner total" value={`${fmtAmt(selectedAccount?.totalBalance ?? 0)} (no change)`} theme={theme} />
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
