import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
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
import { externalAccountApi } from '../api/externalAccountApi';

const TYPE_META: Record<string, { icon: string; label: string }> = {
  deposit:    { icon: 'arrow-down-circle',  label: 'Deposit'    },
  due:        { icon: 'arrow-up-circle',    label: 'Due'        },
  adjustment: { icon: 'swap-horizontal',    label: 'Adjustment' },
};

function LedgerRow({ item, theme }: { item: any; theme: any }) {
  const meta   = TYPE_META[item.type] || TYPE_META.adjustment;
  const isCredit = item.direction === 'credit';
  const amtColor = isCredit ? theme.colors.success : theme.colors.error;
  const sign     = isCredit ? '+' : '−';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(amtColor, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={meta.icon as any} size={18} color={amtColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>{meta.label}</Text>
        {item.description ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.description}</Text> : null}
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
    </View>
  );
}

type EntryType = 'deposit' | 'due' | 'adjustment';

function AddEntryModal({ visible, onClose, onAdded, accountId, theme }: any) {
  const [entryType, setEntryType] = useState<EntryType>('deposit');
  const [adjDir, setAdjDir] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const dir = entryType === 'deposit' ? 'credit' : entryType === 'due' ? 'debit' : adjDir;
      return externalAccountApi.addEntry(accountId, {
        type: entryType,
        direction: dir,
        amount: Math.round(parseFloat(amount) * 100),
        description: description.trim() || undefined,
      });
    },
    onSuccess: (data) => { onAdded(data); setAmount(''); setDescription(''); setError(''); },
    onError: (err: any) => setError(parseApiError(err) || 'Failed to add entry'),
  });

  const handleSubmit = () => {
    setError('');
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount'); return; }
    mutation.mutate();
  };

  const typeBtn = (t: EntryType, label: string, icon: string) => {
    const active = entryType === t;
    return (
      <TouchableOpacity
        key={t}
        onPress={() => setEntryType(t)}
        style={{ flex: 1, paddingVertical: 8, borderRadius: theme.borderRadius.sm, backgroundColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.08), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
      >
        <Ionicons name={icon as any} size={14} color={active ? '#fff' : theme.colors.primary} />
        <Text style={{ color: active ? '#fff' : theme.colors.primary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Add Entry</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>

            {/* Entry type selector */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
              {typeBtn('deposit', 'Deposit', 'arrow-down-circle-outline')}
              {typeBtn('due', 'Due', 'arrow-up-circle-outline')}
              {typeBtn('adjustment', 'Adjust', 'swap-horizontal-outline')}
            </View>

            {/* Adjustment direction */}
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

            {/* Amount */}
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

            {/* Description */}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ExternalAccountDetailScreen() {
  const theme   = useTheme();
  const route   = useRoute<any>();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const qc      = useQueryClient();
  const role    = useAuthStore((s: any) => s.user?.role);
  const isHO    = role === 'head_office';

  const { accountId } = route.params;
  const [showEntry, setShowEntry] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['external-ledger', accountId],
    queryFn: () => externalAccountApi.getLedger(accountId),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => externalAccountApi.update(accountId, { status: account?.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['external-ledger', accountId] }),
    onError: (err: any) => Alert.alert('Error', parseApiError(err) || 'Failed'),
  });

  if (isLoading) return <LoadingScreen />;

  const account: any = (data as any)?.account;
  const entries: any[] = (data as any)?.entries || [];
  const balance: number = account?.balance ?? 0;
  const isNeg  = balance < 0;
  const balColor = isNeg ? theme.colors.error : balance === 0 ? theme.colors.textSecondary : theme.colors.success;

  const handleToggleStatus = () => {
    const next = account?.status === 'active' ? 'inactive' : 'active';
    Alert.alert(`Mark as ${next}?`, `This partner account will be marked ${next}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: next === 'inactive' ? 'destructive' : 'default', onPress: () => toggleStatusMutation.mutate() },
    ]);
  };

  const ListHeader = (
    <View>
      {/* Balance card */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <View>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{account?.name}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Code: {account?.code}</Text>
            {account?.contactPerson ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{account.contactPerson}{account.phone ? ` · ${account.phone}` : ''}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600', marginBottom: 4 }}>
              {isNeg ? 'OWES US' : balance === 0 ? 'SETTLED' : 'CREDIT WITH US'}
            </Text>
            <Text style={{ color: balColor, fontWeight: '800', fontSize: 24 }} allowFontScaling={false}>
              ₹{fmtAmt(Math.abs(balance))}
            </Text>
          </View>
        </View>

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
      </AppCard>

      <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
        HISTORY ({entries.length} entries)
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={entries}
        keyExtractor={(item: any) => item._id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }: { item: any }) => <LedgerRow item={item} theme={theme} />}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        ListEmptyComponent={<EmptyState title="No entries yet" subtitle="Tap 'Add Entry' to record a deposit or due" />}
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
        onClose={() => setShowEntry(false)}
        onAdded={() => {
          setShowEntry(false);
          qc.invalidateQueries({ queryKey: ['external-ledger', accountId] });
          qc.invalidateQueries({ queryKey: ['external-accounts'] });
        }}
      />
    </View>
  );
}
