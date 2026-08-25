import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { parseApiError } from '../../../utils/apiError';
import { hqCommissionApi, HQCommissionItem } from '../api/hqCommissionApi';

interface Props {
  navigation: any;
}

const PAYMENT_MODE_OPTIONS = [
  { label: 'Cash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'IMPS', value: 'bank_transfer' },
];

export function HQCommissionItemsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');

  const { data: items = [], isLoading, isFetching, refetch } = useQuery<HQCommissionItem[]>({
    queryKey: ['hqCommissionItems'],
    queryFn: () => hqCommissionApi.listItems(),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('HQCommissionSettlements')} style={{ marginRight: 12 }}>
          <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i._id)));
    }
  };

  const selectedItems = items.filter((i) => selectedIds.has(i._id));
  const totalCommission = selectedItems.reduce((s, i) => s + i.commissionAmount, 0);
  const totalHQShare = selectedItems.reduce((s, i) => s + i.hqShareAmount, 0);

  const mutation = useMutation({
    mutationFn: () => {
      const firstSelected = items.find((i) => selectedIds.has(i._id));
      return hqCommissionApi.createSettlement({
        branchId: firstSelected?.branchId,
        itemIds: Array.from(selectedIds),
        paymentMode,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (settlement) => {
      qc.invalidateQueries({ queryKey: ['hqCommissionItems'] });
      qc.invalidateQueries({ queryKey: ['hqCommissionSettlements'] });
      setSelectedIds(new Set());
      navigation.navigate('HQCommissionSettlementDetail', { settlementId: settlement._id });
    },
    onError: (err: any) => {
      Alert.alert('Error', parseApiError(err) || 'Failed to create settlement');
    },
  });

  const handleProcess = () => {
    if (selectedIds.size === 0) {
      Alert.alert('Select Items', 'Please select at least one commission item to process.');
      return;
    }
    Alert.alert(
      t('hqComm.processSelected'),
      `${selectedIds.size} ${t('hqComm.selected')} · ${t('hqComm.totalHQShare')}: ${fmtAmt(totalHQShare)}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('hqComm.processSelected'), onPress: () => mutation.mutate() },
      ],
    );
  };

  if (isLoading) return <LoadingScreen message={t('hqComm.loading')} />;

  const renderItem = ({ item }: { item: HQCommissionItem }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => toggleItem(item._id)}>
        <AppCard style={{
          marginBottom: theme.spacing.sm,
          borderWidth: 1.5,
          borderColor: isSelected ? theme.colors.primary : 'transparent',
          backgroundColor: isSelected ? withAlpha(theme.colors.primary, 0.04) : theme.colors.surface,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 22, height: 22, borderRadius: 4,
              borderWidth: 2,
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              backgroundColor: isSelected ? theme.colors.primary : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: theme.spacing.sm,
            }}>
              {isSelected && <Ionicons name="checkmark" size={14} color={theme.colors.surface} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={[theme.typography.label, { color: theme.colors.primary, fontFamily: 'Courier New' }]} allowFontScaling={false}>
                  {item.tokenNumber}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {fmtDate(item.createdAt)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
                <View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {t('hqComm.totalCommission')}
                  </Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} allowFontScaling={false}>
                    {fmtAmt(item.commissionAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {t('hqComm.totalHQShare')} ({item.hqSharePct}%)
                  </Text>
                  <Text style={[theme.typography.body, { color: theme.colors.error, fontWeight: '700' }]} allowFontScaling={false}>
                    {fmtAmt(item.hqShareAmount)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + 180 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} colors={[theme.colors.primary]} />}
        ListHeaderComponent={
          items.length > 0 ? (
            <TouchableOpacity
              onPress={toggleAll}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md, gap: theme.spacing.xs }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                borderColor: allSelected ? theme.colors.primary : theme.colors.border,
                backgroundColor: allSelected ? theme.colors.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {allSelected && <Ionicons name="checkmark" size={13} color={theme.colors.surface} />}
              </View>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                {allSelected ? t('hqComm.deselectAll') : t('hqComm.selectAll')}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                ({items.length})
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="cash-outline"
            title={t('hqComm.itemsEmpty')}
            message={t('hqComm.itemsEmptyHint')}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
      />

      {/* Bottom action panel */}
      {items.length > 0 && (
        <View style={{
          position: 'absolute', bottom: tabBarHeight, left: 0, right: 0,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1, borderTopColor: theme.colors.divider,
          padding: theme.spacing.md, gap: theme.spacing.sm,
        }}>
          {selectedIds.size > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <View>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalCommission')}</Text>
                <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]} allowFontScaling={false}>{fmtAmt(totalCommission)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('hqComm.totalHQShare')}</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.error, fontWeight: '700' }]} allowFontScaling={false}>{fmtAmt(totalHQShare)}</Text>
              </View>
            </View>
          )}

          {/* Payment mode chips */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            {PAYMENT_MODE_OPTIONS.map((m) => {
              const sel = paymentMode === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setPaymentMode(m.value)}
                  style={{
                    paddingHorizontal: theme.spacing.sm, paddingVertical: 6,
                    borderRadius: theme.borderRadius.md, borderWidth: 1.5,
                    borderColor: sel ? theme.colors.primary : theme.colors.border,
                    backgroundColor: sel ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.caption, { color: sel ? theme.colors.primary : theme.colors.textSecondary, fontWeight: sel ? '700' : '400' }]} allowFontScaling={false}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppButton
            title={`${t('hqComm.processSelected')} (${selectedIds.size})`}
            onPress={handleProcess}
            loading={mutation.isPending}
            disabled={selectedIds.size === 0}
          />
        </View>
      )}
    </View>
  );
}
