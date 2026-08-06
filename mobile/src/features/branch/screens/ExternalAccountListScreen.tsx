import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { externalAccountApi } from '../api/externalAccountApi';

function BalancePill({ balance, theme }: { balance: number; theme: any }) {
  const isNeg  = balance < 0;
  const isZero = balance === 0;
  const color  = isNeg ? theme.colors.error : isZero ? theme.colors.textSecondary : theme.colors.success;
  const label  = isNeg ? 'OWES US' : isZero ? 'NIL' : 'CREDIT';
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>
        {fmtAmt(Math.abs(balance))}
      </Text>
    </View>
  );
}

function CreateModal({ visible, onClose, onCreated, theme }: any) {
  const [form, setForm] = useState({ name: '', code: '', contactPerson: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => externalAccountApi.create({
      name: form.name.trim(),
      code: form.code.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: (data) => { onCreated(data); setForm({ name: '', code: '', contactPerson: '', phone: '', address: '', notes: '' }); },
    onError: (err: any) => setError(parseApiError(err) || 'Failed to create partner'),
  });

  const field = (label: string, key: keyof typeof form, opts?: any) => (
    <View style={{ marginBottom: theme.spacing.sm }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, padding: 10, color: theme.colors.text, fontSize: 15 }}
        placeholderTextColor={theme.colors.textSecondary}
        {...opts}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: theme.spacing.lg, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>New Partner Account</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {field('Name *', 'name', { placeholder: 'ABC Trading' })}
              {field('Code * (short, unique)', 'code', { placeholder: 'ABCT', autoCapitalize: 'characters' })}
              {field('Contact Person', 'contactPerson', { placeholder: 'Ramesh Shah' })}
              {field('Phone', 'phone', { placeholder: '9876543210', keyboardType: 'phone-pad' })}
              {field('Address', 'address', { placeholder: 'City, State' })}
              {field('Notes', 'notes', { placeholder: 'Any notes...', multiline: true })}
              {!!error && <Text style={{ color: theme.colors.error, marginBottom: theme.spacing.sm, fontSize: 13 }}>{error}</Text>}
              <AppButton
                title="Create Partner"
                onPress={() => { setError(''); if (!form.name.trim() || !form.code.trim()) { setError('Name and Code are required'); return; } mutation.mutate(); }}
                loading={mutation.isPending}
                style={{ marginTop: theme.spacing.sm }}
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ExternalAccountListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const role = useAuthStore((s: any) => s.user?.role);
  const isHO = role === 'head_office';

  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: accounts = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['external-accounts', showInactive],
    queryFn: () => externalAccountApi.list(showInactive ? undefined : 'active'),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Filter toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
        <TouchableOpacity
          onPress={() => setShowInactive((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}
        >
          <Ionicons name={showInactive ? 'eye' : 'eye-off-outline'} size={16} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {showInactive ? 'Showing all' : 'Show inactive'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={accounts as any[]}
        keyExtractor={(item: any) => item._id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: tabBarHeight + theme.spacing.md }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={15}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState title="No partner accounts yet" subtitle={isHO ? 'Tap + to add your first partner' : undefined} />}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('ExternalAccountDetail', { accountId: item._id, accountName: item.name })}>
            <AppCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: withAlpha(theme.colors.primary, 0.1), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: theme.colors.primary }}>{item.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>{item.name}</Text>
                  {item.contactPerson ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{item.contactPerson}</Text> : null}
                  {item.status === 'inactive' && (
                    <Text style={{ fontSize: 10, color: theme.colors.error, fontWeight: '700', marginTop: 2 }}>INACTIVE</Text>
                  )}
                </View>
                <BalancePill balance={item.balance ?? 0} theme={theme} />
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </View>
            </AppCard>
          </TouchableOpacity>
        )}
      />

      {isHO && (
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={{ position: 'absolute', bottom: tabBarHeight + 16, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', ...theme.shadow.card }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <CreateModal
        visible={showCreate}
        theme={theme}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['external-accounts'] }); }}
      />
    </View>
  );
}
