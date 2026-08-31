import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  Modal, TextInput, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { BranchCodeDropdown } from '../../../shared/components/BranchCodeDropdown';
import { showToast } from '../../../utils/toast';
import { externalAccountApi, partnerTransferApi } from '../api/externalAccountApi';
import { branchApi } from '../api/branchApi';

const TYPE_META: Record<string, { icon: string; label: string; color?: string }> = {
  deposit:      { icon: 'arrow-down-circle',  label: 'Deposit'      },
  due:          { icon: 'arrow-up-circle',    label: 'Due'          },
  withdrawal:   { icon: 'cash-outline',       label: 'Withdrawal'   },
  adjustment:   { icon: 'swap-horizontal',    label: 'Adjustment'   },
  transfer_out: { icon: 'arrow-forward-circle', label: 'Transfer Out' },
  transfer_in:  { icon: 'arrow-back-circle',    label: 'Transfer In'  },
};

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#f59e0b', icon: 'time-outline'            },
  approved:  { label: 'Approved',  color: '#3b82f6', icon: 'checkmark-circle-outline'},
  completed: { label: 'Completed', color: '#10b981', icon: 'checkmark-circle'        },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: 'close-circle-outline'    },
  rejected:  { label: 'Rejected',  color: '#ef4444', icon: 'close-circle'            },
};

function LedgerRow({ item, theme, navigation }: { item: any; theme: any; navigation: any }) {
  const meta     = TYPE_META[item.type] || TYPE_META.adjustment;
  const isCredit = item.direction === 'credit';
  const amtColor = isCredit ? theme.colors.success : theme.colors.error;
  const sign     = isCredit ? '+' : '−';
  const txn      = item.transactionId;

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(amtColor, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={meta.icon as any} size={18} color={amtColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>{meta.label}</Text>
        {txn?.tokenNumber ? (
          <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]} numberOfLines={1}>
            Token {txn.tokenNumber}
          </Text>
        ) : item.description ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{item.entryDate} · {item.createdByName || 'System'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: amtColor, fontWeight: '700', fontSize: 15 }} allowFontScaling={false}>
          {sign}{fmtAmt(item.amount)}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
          Bal: {fmtAmt(item.balanceAfter)}
        </Text>
      </View>
      {txn?._id && <Ionicons name="chevron-forward" size={14} color={theme.colors.textSecondary} />}
    </View>
  );

  if (txn?._id) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('TransactionDetail', { transactionId: txn._id })}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

function TransferRow({ item, theme, navigation }: { item: any; theme: any; navigation: any }) {
  const s = STATUS_META[item.status] || STATUS_META.pending;
  const from = item.fromBranchId?.code || '?';
  const to   = item.toBranchId?.code || '?';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate('PartnerTransferDetail', { transferId: item._id })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(s.color, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={s.icon as any} size={18} color={s.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>
          {from} → {to}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {item.transferRef} · {fmtDate(item.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>{fmtAmt(item.amount)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
          <Text style={{ fontSize: 10, color: s.color, fontWeight: '700' }}>{s.label.toUpperCase()}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

type EntryType = 'deposit' | 'due' | 'withdrawal' | 'adjustment';

function AddEntryModal({ visible, onClose, onAdded, accountId, theme, myBranchId, myBranchCode, myBranchName, isHO }: any) {
  const [entryType, setEntryType] = useState<EntryType>('deposit');
  const [adjDir, setAdjDir] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  // Branch users are locked to their own branch; HO picks from dropdown
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(isHO ? null : (myBranchId || null));
  const [error, setError] = useState('');

  // Keep branch locked for branch users even if modal re-opens
  React.useEffect(() => {
    if (!isHO && myBranchId) setSelectedBranchId(myBranchId);
  }, [visible, isHO, myBranchId]);

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
    staleTime: 60_000,
    enabled: visible && isHO,   // branch users don't need the full list
  });
  const branches: any[] = (branchesRaw as any) || [];

  const mutation = useMutation({
    mutationFn: () => {
      let dir: string;
      if (entryType === 'deposit') dir = 'credit';
      else if (entryType === 'due' || entryType === 'withdrawal') dir = 'debit';
      else dir = adjDir;

      return externalAccountApi.addEntry(accountId, {
        type: entryType,
        direction: dir,
        amount: Math.round(parseFloat(amount)),
        description: description.trim() || undefined,
        branchId: selectedBranchId || undefined,
      });
    },
    onSuccess: (data: any) => {
      onAdded(data);
      setAmount('');
      setDescription('');
      // Keep branch locked for branch users; reset to null only for HO
      if (isHO) setSelectedBranchId(null);
      setError('');
    },
    onError: (err: any) => setError(parseApiError(err) || 'Failed to add entry'),
  });

  const handleSubmit = () => {
    setError('');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount'); return; }
    if (!selectedBranchId) { setError(isHO ? 'Select the branch where this cash movement happened' : 'Branch not found — please reload'); return; }
    mutation.mutate();
  };

  const typeBtn = (t: EntryType, label: string, icon: string, color?: string) => {
    const active = entryType === t;
    const btnColor = color || theme.colors.primary;
    return (
      <TouchableOpacity
        key={t}
        onPress={() => setEntryType(t)}
        style={{ flex: 1, paddingVertical: 8, borderRadius: theme.borderRadius.sm, backgroundColor: active ? btnColor : withAlpha(btnColor, 0.08), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
      >
        <Ionicons name={icon as any} size={14} color={active ? '#fff' : btnColor} />
        <Text style={{ color: active ? '#fff' : btnColor, fontWeight: '700', fontSize: 12 }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' }}>
            {/* Header OUTSIDE ScrollView so iOS scroll gesture never eats the X tap */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Add Entry</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
              {typeBtn('deposit',    'Deposit',  'arrow-down-circle-outline')}
              {typeBtn('due',        'Due',      'arrow-up-circle-outline')}
              {typeBtn('withdrawal', 'Withdraw', 'cash-outline', theme.colors.error)}
              {typeBtn('adjustment', 'Adjust',   'swap-horizontal-outline')}
            </View>

            {entryType === 'withdrawal' && (
              <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.06), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="information-circle-outline" size={14} color={theme.colors.error} />
                <Text style={[theme.typography.caption, { color: theme.colors.error, flex: 1 }]}>Partner is withdrawing cash. This reduces their balance at the selected branch.</Text>
              </View>
            )}

            {entryType === 'adjustment' && (
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
                {(['credit', 'debit'] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setAdjDir(d)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: theme.borderRadius.sm, backgroundColor: adjDir === d ? (d === 'credit' ? theme.colors.success : theme.colors.error) : withAlpha(theme.colors.border, 0.5), alignItems: 'center' }}
                  >
                    <Text style={{ color: adjDir === d ? '#fff' : theme.colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                      {d === 'credit' ? '+ Credit' : '− Debit'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {isHO ? (
              <BranchCodeDropdown
                label="Branch (cash held at) *"
                branches={branches}
                selectedId={selectedBranchId}
                onSelect={setSelectedBranchId}
              />
            ) : (
              <View style={{ marginBottom: theme.spacing.sm }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Branch</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.borderRadius.sm, backgroundColor: withAlpha(theme.colors.primary, 0.06), borderWidth: 1, borderColor: withAlpha(theme.colors.primary, 0.2) }}>
                  <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 15 }}>
                    {myBranchCode} — {myBranchName}
                  </Text>
                </View>
              </View>
            )}

            <View style={{ marginBottom: theme.spacing.sm }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Amount (₹)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
                style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 18, fontWeight: '600' }}
              />
            </View>

            <View style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Description (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Cash received for March batch"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 14, minHeight: 60 }}
              />
            </View>

            {!!error && <Text style={{ color: theme.colors.error, marginBottom: theme.spacing.sm, fontSize: 13 }}>{error}</Text>}
            <AppButton title="Save Entry" onPress={handleSubmit} loading={mutation.isPending} />
          </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type TabType = 'ledger' | 'transfers';

export function ExternalAccountDetailScreen() {
  const theme   = useTheme();
  const route   = useRoute<any>();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const qc      = useQueryClient();
  const user    = useAuthStore((s: any) => s.user);
  const role    = user?.role;
  const isHO    = role === 'head_office';
  const myBranchId: string | undefined = user?.branchId;

  const { accountId } = route.params;
  const [tab, setTab] = useState<TabType>('ledger');
  const [showEntry, setShowEntry] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const { data: branchesRaw } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
    staleTime: 60_000,
  });
  const branches: any[] = (branchesRaw as any) || [];
  const myBranch = branches.find((b: any) => b._id === myBranchId);

  const assignBranchMutation = useMutation({
    mutationFn: (branchId: string) => externalAccountApi.update(accountId, { branchId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-ledger', accountId] });
      qc.invalidateQueries({ queryKey: ['external-accounts'] });
      setShowBranchPicker(false);
      setSelectedBranchId(null);
    },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) || 'Failed'),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['external-ledger', accountId],
    queryFn: () => externalAccountApi.getLedger(accountId),
  });

  const { data: transfersData, refetch: refetchTransfers, isFetching: isFetchingTransfers } = useQuery({
    queryKey: ['partner-transfers', accountId],
    queryFn: () => partnerTransferApi.list({ externalAccountId: accountId, limit: 50 }),
    enabled: tab === 'transfers',
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => externalAccountApi.update(accountId, { status: account?.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['external-ledger', accountId] }); showToast('success', 'Updated', 'Account status updated'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) || 'Failed'),
  });

  if (isLoading) return <LoadingScreen />;

  const account: any = (data as any)?.account;
  const entries: any[] = (data as any)?.entries || [];
  const transfers: any[] = (transfersData as any)?.transfers || [];

  // Balance values — branch-specific for branch users, total for HO
  const totalBalance: number = account?.balance ?? 0;
  const myBalance: number = isHO
    ? totalBalance
    : ((account?.balances)?.[myBranchId!] ?? 0);
  const myOnHold: number = isHO
    ? (Object.values((account?.onHolds as Record<string, number>) || {}).reduce((s: number, v: any) => s + (v ?? 0), 0))
    : ((account?.onHolds)?.[myBranchId!] ?? 0);
  const myAvailable: number = Math.max(0, myBalance - myOnHold);

  // HO: per-branch breakdown with onHold + available
  const branchBalances: { branchId: string; balance: number; onHold: number; available: number }[] = account?.balances
    ? Object.entries(account.balances as Record<string, number>)
        .map(([bId, bal]) => {
          const hold = (account.onHolds as Record<string, number>)?.[bId] ?? 0;
          return { branchId: bId, balance: bal as number, onHold: hold, available: Math.max(0, (bal as number) - hold) };
        })
        .filter(b => b.balance !== 0 || b.onHold !== 0)
    : [];

  const isNeg     = myBalance < 0;
  const balColor  = isNeg ? theme.colors.error : myBalance === 0 ? theme.colors.textSecondary : theme.colors.success;

  const pendingTransferCount = transfers.filter(t => ['pending', 'approved'].includes(t.status)).length;

  const handleToggleStatus = () => {
    const next = account?.status === 'active' ? 'inactive' : 'active';
    setConfirmSheet({
      title: `Mark as ${next === 'active' ? 'Active' : 'Inactive'}?`,
      message: `This partner account will be marked ${next}.`,
      confirmLabel: 'Confirm',
      destructive: next === 'inactive',
      icon: next === 'active' ? 'checkmark-circle-outline' : 'pause-circle-outline',
      onConfirm: () => toggleStatusMutation.mutate(),
    });
  };

  const TabBar = (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, marginBottom: theme.spacing.sm }}>
      {(['ledger', 'transfers'] as TabType[]).map((t) => (
        <TouchableOpacity
          key={t}
          onPress={() => setTab(t)}
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? theme.colors.primary : 'transparent' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? theme.colors.primary : theme.colors.textSecondary }}>
            {t === 'ledger' ? `LEDGER (${entries.length})` : `TRANSFERS${pendingTransferCount > 0 ? ` (${pendingTransferCount} pending)` : ''}`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const ListHeader = (
    <View>
      {/* Header card */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        {/* Partner info + primary balance */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
          <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{account?.name}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Code: {account?.code}</Text>
            {account?.branchId?.name ? (
              <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                {account.branchId.code} — {account.branchId.name}
              </Text>
            ) : null}
            {account?.contactPerson ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {account.contactPerson}{account.phone ? ` · ${account.phone}` : ''}
              </Text>
            ) : null}
            {account?.status === 'inactive' && (
              <Text style={{ fontSize: 10, color: theme.colors.error, fontWeight: '700', marginTop: 2 }}>INACTIVE</Text>
            )}
          </View>
          {/* Primary balance */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600', marginBottom: 2 }}>
              {isHO ? 'TOTAL BALANCE' : 'MY BRANCH'} · {isNeg ? 'OWES US' : myBalance === 0 ? 'SETTLED' : 'CREDIT'}
            </Text>
            <Text style={{ color: balColor, fontWeight: '800', fontSize: 22 }} allowFontScaling={false}>
              {fmtAmt(Math.abs(myBalance))}
            </Text>
          </View>
        </View>

        {/* Balance breakdown — branch user: 3-line summary */}
        {!isHO && myBranchId && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            {[
              { label: 'Balance', value: myBalance, color: balColor },
              { label: 'On Hold', value: myOnHold, color: theme.colors.warning },
              { label: 'Available', value: myAvailable, color: theme.colors.success },
            ].map((item, i) => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: theme.colors.border }}>
                <Text style={{ fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600', marginBottom: 2 }}>{item.label.toUpperCase()}</Text>
                <Text style={{ color: item.color, fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>{fmtAmt(Math.abs(item.value))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HO: per-branch allocation table */}
        {isHO && branchBalances.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            {/* Table header */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ flex: 1.5, fontSize: 9, color: theme.colors.textSecondary, fontWeight: '700' }}>BRANCH</Text>
              <Text style={{ flex: 1, fontSize: 9, color: theme.colors.textSecondary, fontWeight: '700', textAlign: 'right' }}>BALANCE</Text>
              <Text style={{ flex: 1, fontSize: 9, color: theme.colors.textSecondary, fontWeight: '700', textAlign: 'right' }}>ON HOLD</Text>
              <Text style={{ flex: 1, fontSize: 9, color: theme.colors.textSecondary, fontWeight: '700', textAlign: 'right' }}>AVAILABLE</Text>
            </View>
            {branchBalances.map((b) => {
              const br = branches.find((x: any) => x._id === b.branchId);
              const label = br ? br.code : b.branchId.slice(-5);
              const bColor = b.balance < 0 ? theme.colors.error : b.balance === 0 ? theme.colors.textSecondary : theme.colors.success;
              return (
                <View key={b.branchId} style={{ flexDirection: 'row', paddingVertical: 3, borderTopWidth: 1, borderTopColor: withAlpha(theme.colors.border, 0.5) }}>
                  <Text style={{ flex: 1.5, fontSize: 12, color: theme.colors.text, fontWeight: '600' }}>{label}</Text>
                  <Text style={{ flex: 1, fontSize: 12, color: bColor, fontWeight: '600', textAlign: 'right' }} allowFontScaling={false}>{fmtAmt(Math.abs(b.balance))}</Text>
                  <Text style={{ flex: 1, fontSize: 12, color: b.onHold > 0 ? theme.colors.warning : theme.colors.textSecondary, fontWeight: '600', textAlign: 'right' }} allowFontScaling={false}>{fmtAmt(b.onHold)}</Text>
                  <Text style={{ flex: 1, fontSize: 12, color: b.available > 0 ? theme.colors.success : theme.colors.textSecondary, fontWeight: '600', textAlign: 'right' }} allowFontScaling={false}>{fmtAmt(b.available)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {account?.notes ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontStyle: 'italic', marginBottom: theme.spacing.sm }]}>{account.notes}</Text>
        ) : null}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <TouchableOpacity
            onPress={() => setShowEntry(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primary }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('PartnerTransfer', { accountId, accountName: account?.name })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.borderRadius.sm, backgroundColor: withAlpha(theme.colors.primary, 0.1), borderWidth: 1, borderColor: theme.colors.primary }}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }}>Transfer</Text>
          </TouchableOpacity>

          {isHO && (
            <TouchableOpacity
              onPress={handleToggleStatus}
              disabled={toggleStatusMutation.isPending}
              style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 10, borderRadius: theme.borderRadius.sm, backgroundColor: withAlpha(account?.status === 'active' ? theme.colors.error : theme.colors.success, 0.1), borderWidth: 1, borderColor: account?.status === 'active' ? theme.colors.error : theme.colors.success }}
            >
              {toggleStatusMutation.isPending
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <Text style={{ color: account?.status === 'active' ? theme.colors.error : theme.colors.success, fontWeight: '700', fontSize: 13 }}>
                    {account?.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Branch assignment — HO only */}
        {isHO && (
          <View style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '600' }]}>LINKED BRANCH</Text>
              <TouchableOpacity onPress={() => { setSelectedBranchId(account?.branchId?._id || account?.branchId || null); setShowBranchPicker((v) => !v); }}>
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                  {showBranchPicker ? 'Cancel' : account?.branchId ? 'Change' : 'Assign Branch'}
                </Text>
              </TouchableOpacity>
            </View>
            {!showBranchPicker && !account?.branchId && (
              <View style={{ backgroundColor: withAlpha(theme.colors.warning, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning-outline" size={14} color={theme.colors.warning} />
                <Text style={[theme.typography.caption, { color: theme.colors.warning, flex: 1 }]}>No branch assigned — branch users cannot see this partner</Text>
              </View>
            )}
            {showBranchPicker && (
              <View style={{ gap: theme.spacing.sm }}>
                <BranchCodeDropdown branches={branches} selectedId={selectedBranchId} onSelect={setSelectedBranchId} />
                <TouchableOpacity
                  onPress={() => selectedBranchId && assignBranchMutation.mutate(selectedBranchId)}
                  disabled={!selectedBranchId || assignBranchMutation.isPending}
                  style={{ paddingVertical: 10, borderRadius: theme.borderRadius.sm, backgroundColor: selectedBranchId ? theme.colors.primary : withAlpha(theme.colors.primary, 0.3), alignItems: 'center' }}
                >
                  {assignBranchMutation.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Branch</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </AppCard>

      {TabBar}
    </View>
  );

  const listData = tab === 'ledger' ? entries : transfers;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={listData}
        keyExtractor={(item: any) => item._id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }: { item: any }) =>
          tab === 'ledger'
            ? <LedgerRow item={item} theme={theme} navigation={navigation} />
            : <TransferRow item={item} theme={theme} navigation={navigation} />
        }
        refreshControl={<RefreshControl refreshing={tab === 'ledger' ? isFetching : isFetchingTransfers} onRefresh={tab === 'ledger' ? refetch : refetchTransfers} />}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        ListEmptyComponent={
          tab === 'ledger'
            ? <EmptyState title="No entries yet" subtitle="Tap 'Add Entry' to record a deposit or due" />
            : <EmptyState title="No transfers yet" subtitle="Tap 'Transfer' to move partner funds between branches" />
        }
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={5}
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
      />

      <AddEntryModal
        visible={showEntry}
        theme={theme}
        accountId={accountId}
        isHO={isHO}
        myBranchId={myBranchId}
        myBranchCode={myBranch?.code}
        myBranchName={myBranch?.name}
        onClose={() => setShowEntry(false)}
        onAdded={() => {
          setShowEntry(false);
          qc.invalidateQueries({ queryKey: ['external-ledger', accountId] });
          qc.invalidateQueries({ queryKey: ['external-accounts'] });
          qc.invalidateQueries({ queryKey: ['branches'] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />
      <ConfirmSheet
        visible={!!confirmSheet}
        title={confirmSheet?.title ?? ''}
        message={confirmSheet?.message}
        confirmLabel={confirmSheet?.confirmLabel}
        destructive={confirmSheet?.destructive}
        icon={confirmSheet?.icon}
        loading={toggleStatusMutation.isPending}
        onConfirm={() => { confirmSheet?.onConfirm(); setConfirmSheet(null); }}
        onClose={() => setConfirmSheet(null)}
      />
    </View>
  );
}
