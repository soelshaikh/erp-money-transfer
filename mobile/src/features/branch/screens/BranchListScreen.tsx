import React, { useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { showToast } from '../../../utils/toast';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { branchApi } from '../api/branchApi';
import { withAlpha } from '../../../utils/colors';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { Ionicons } from '@expo/vector-icons';
import { RefreshButton } from '../../../shared/components/RefreshButton';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt } from '../../../utils/fmt';

const TYPE_ICONS: { [key: string]: string } = {
  collection: 'arrow-down-circle',
  payout: 'arrow-up-circle',
  head_office: 'business',
};

interface BranchItemProps {
  item: any;
  theme: any;
  onDelete: (item: any) => void;
  onToggle: (item: any) => void;
  onViewLedger: (item: any) => void;
  onEditCommission: (item: any) => void;
}

function BranchActionSheet({ visible, item, theme, t, onClose, onDelete, onToggle, onEditCommission }: any) {
  if (!item) return null;
  const isActive = item.status === 'active';

  const actions = [
    ...(item.type !== 'head_office' ? [{
      icon: 'settings-outline',
      label: 'Branch Settings',
      color: theme.colors.text,
      onPress: () => { onClose(); onEditCommission(item); },
    }] : []),
    {
      icon: isActive ? 'pause-circle-outline' : 'play-circle-outline',
      label: isActive ? t('branch.disableBtn') : t('branch.enableBtn'),
      color: isActive ? theme.colors.warning ?? '#d97706' : theme.colors.success,
      onPress: () => { onClose(); onToggle(item); },
    },
    {
      icon: 'trash-outline',
      label: t('branch.deleteBtn'),
      color: theme.colors.error,
      onPress: () => { onClose(); onDelete(item); },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      {/* Sheet */}
      <View style={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 32,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.divider, alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />

        {/* Branch name header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{item.name}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {item.code}{item.city ? ` · ${item.city}` : ''}
          </Text>
        </View>

        {/* Actions */}
        {actions.map((action, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={action.onPress}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: idx < actions.length - 1 ? 1 : 0,
              borderBottomColor: theme.colors.divider,
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: withAlpha(action.color, 0.1),
              justifyContent: 'center', alignItems: 'center',
              marginRight: 14,
            }}>
              <Ionicons name={action.icon} size={19} color={action.color} />
            </View>
            <Text style={[theme.typography.body, { color: action.color, fontWeight: '600' }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Cancel */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={{
            marginHorizontal: 20,
            marginTop: 10,
            paddingVertical: 14,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.inputBackground,
            alignItems: 'center',
          }}
        >
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
            {t('common.cancel')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function BranchItem({ item, theme, onDelete, onToggle, onViewLedger, onEditCommission }: BranchItemProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = item.status === 'active';
  const actualBalance: number = item.balance ?? 0;
  const committed: number = item.committedPayout ?? 0;
  const pendingPayout: number = item.pendingPayout ?? 0;
  const payoutCompleted: number = item.payoutCompleted ?? 0;
  const commissionPayable: number = item.commissionPayable ?? 0;
  const effectiveBalance: number = actualBalance - committed - pendingPayout + payoutCompleted - commissionPayable;
  const isNeg = effectiveBalance < 0;
  const effColor = isNeg ? theme.colors.error : effectiveBalance === 0 ? theme.colors.textSecondary : theme.colors.success;

  return (
    <>
      <BranchActionSheet
        visible={menuOpen}
        item={item}
        theme={theme}
        t={t}
        onClose={() => setMenuOpen(false)}
        onDelete={onDelete}
        onToggle={onToggle}
        onEditCommission={onEditCommission}
      />

      <TouchableOpacity activeOpacity={0.8} onPress={() => onViewLedger(item)}>
        <AppCard style={{ marginBottom: 10 }}>
          {/* Row 1: icon · name · badge · kebab */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 36, height: 36, borderRadius: 8,
              backgroundColor: withAlpha(isActive ? theme.colors.primary : theme.colors.textSecondary, 0.08),
              justifyContent: 'center', alignItems: 'center', marginRight: 10,
            }}>
              <Ionicons name={(TYPE_ICONS[item.type] || 'location') as any} size={18} color={isActive ? theme.colors.primary : theme.colors.textSecondary} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Text
                style={[theme.typography.label, { color: isActive ? theme.colors.text : theme.colors.textSecondary, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <View style={{
                backgroundColor: isActive ? withAlpha(theme.colors.success, 0.12) : withAlpha(theme.colors.error, 0.10),
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.borderRadius.full,
              }}>
                <Text style={[theme.typography.caption, { color: isActive ? theme.colors.success : theme.colors.error, fontWeight: '600' }]} allowFontScaling={false}>
                  {isActive ? 'ACTIVE' : 'DISABLED'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={{ padding: theme.spacing.sm, marginLeft: theme.spacing.xs }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Row 2: type · code · city  +  effective balance */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]} numberOfLines={1}>
              {t(`branch.${item.type === 'collection' ? 'collection' : item.type === 'payout' ? 'payout' : 'headOffice'}`)} · {item.code}{item.city || item.state ? ` · ${item.city || item.state}` : ''}
            </Text>
            <View style={{ alignItems: 'flex-end', marginLeft: theme.spacing.sm }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{t('branch.effective')}</Text>
              <Text style={{ color: effColor, fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
                {isNeg ? '− ' : ''}{fmtAmt(effectiveBalance)}
              </Text>
              {(committed > 0 || pendingPayout > 0 || commissionPayable > 0) && (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]} allowFontScaling={false}>
                  {t('ledger.actualShort')} {fmtAmt(actualBalance)}
                </Text>
              )}
            </View>
          </View>

          {/* Row 3: commission footer */}
          {item.type !== 'head_office' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              {item.commissionConfig?.enabled ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="pricetag" size={12} color="#d97706" />
                    <Text style={[theme.typography.caption, { color: '#d97706' }]}>
                      {t('branch.branchCommission')}: {item.commissionConfig.type === 'flat' ? `₹ ${item.commissionConfig.value}` : `${item.commissionConfig.value}%`}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: withAlpha('#d97706', 0.12), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: '#d97706', fontWeight: '700' }} allowFontScaling={false}>BRANCH SPECIFIC</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="pricetag-outline" size={12} color={theme.colors.textSecondary} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      Uses Global Commission
                    </Text>
                  </View>
                  <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.10), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: theme.colors.primary, fontWeight: '700' }} allowFontScaling={false}>GLOBAL</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Row 4: working hours footer */}
          {item.type !== 'head_office' && (() => {
            const wh = item.workingHours;
            const whOn = wh?.enabled === true;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name={whOn ? 'time' : 'time-outline'} size={12} color={whOn ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[theme.typography.caption, { color: whOn ? theme.colors.primary : theme.colors.textSecondary }]}>
                    {whOn ? `${wh.startTime} – ${wh.endTime}` : 'Inherits company hours'}
                  </Text>
                </View>
                <View style={{ backgroundColor: whOn ? withAlpha(theme.colors.primary, 0.10) : withAlpha(theme.colors.textSecondary, 0.10), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, color: whOn ? theme.colors.primary : theme.colors.textSecondary, fontWeight: '700' }} allowFontScaling={false}>
                    {whOn ? 'CUSTOM' : 'DEFAULT'}
                  </Text>
                </View>
              </View>
            );
          })()}
        </AppCard>
      </TouchableOpacity>
    </>
  );
}

export function BranchListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); showToast('success', 'Deleted', 'Branch deleted'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to delete'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => branchApi.toggleStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); showToast('success', 'Updated', 'Branch status updated'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to update status'),
  });

  const handleDelete = (item: any) => {
    setConfirmSheet({
      title: t('branch.deleteTitle'),
      message: `${t('branch.deleteMsg')} "${item.name}"?`,
      confirmLabel: t('branch.deleteConfirm'),
      destructive: true,
      icon: 'trash-outline',
      onConfirm: () => deleteMutation.mutate(item._id),
    });
  };

  const handleToggle = (item: any) => {
    const isActive = item.status === 'active';
    setConfirmSheet({
      title: isActive ? t('branch.disableBtn') : t('branch.enableBtn'),
      message: isActive
        ? `"${item.name}" ${t('branch.disableMsg')}`
        : `"${item.name}" ${t('branch.enableMsg')}`,
      confirmLabel: isActive ? t('branch.disableConfirm') : t('branch.enableConfirm'),
      destructive: isActive,
      icon: isActive ? 'pause-circle-outline' : 'play-circle-outline',
      onConfirm: () => toggleMutation.mutate(item._id),
    });
  };

  const handleViewLedger = (item: any) => {
    navigation.navigate('BranchLedger', { branchId: item._id, branchName: item.name });
  };

  const handleEditCommission = (item: any) => {
    navigation.navigate('EditBranchCommission', { branchId: item._id, branchName: item.name });
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list({ limit: 100 }),
  });

  const branchCount: number = (data as any)?.branchCount ?? 0;
  const branchLimit: number | null = (data as any)?.branchLimit ?? null;
  const atLimit = branchLimit !== null && branchCount >= branchLimit;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: theme.spacing.sm }}>
          <RefreshButton onPress={refetch} isFetching={isFetching} />
          <TouchableOpacity
            onPress={() => {
              if (atLimit) {
                showToast('info', 'Branch Limit Reached', `This company allows a maximum of ${branchLimit} branch${branchLimit === 1 ? '' : 'es'}.`);
                return;
              }
              navigation.navigate('CreateBranch');
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="add" size={26} color={atLimit ? theme.colors.textSecondary : theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, atLimit, branchLimit, refetch, isFetching]);

  if (isLoading) return <LoadingScreen message={t('branch.loading')} />;
  const branches = (data as any)?.data || [];

  const LimitBanner = branchLimit !== null ? (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: atLimit ? withAlpha(theme.colors.error, 0.07) : withAlpha(theme.colors.primary, 0.06),
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 10,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: atLimit ? withAlpha(theme.colors.error, 0.25) : withAlpha(theme.colors.primary, 0.18),
    }}>
      <Text style={[theme.typography.body, { color: atLimit ? theme.colors.error : theme.colors.primary, fontWeight: '600' }]}>
        {t('branch.branchesUsed')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[theme.typography.label, { color: atLimit ? theme.colors.error : theme.colors.text, fontWeight: '700' }]} allowFontScaling={false}>
          {branchCount} / {branchLimit}
        </Text>
        {atLimit && (
          <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full }}>
            <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]} allowFontScaling={false}>
              {t('branch.limitReached')}
            </Text>
          </View>
        )}
      </View>
    </View>
  ) : null;

  return (
    <>
      <FlatList
        data={branches}
        keyExtractor={(item: any) => item._id}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <BranchItem
            item={item}
            theme={theme}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onViewLedger={handleViewLedger}
            onEditCommission={handleEditCommission}
          />
        )}
        ListHeaderComponent={
          <>
            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}
            {LimitBanner}
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {t('branch.tapHint')}
            </Text>
          </>
        }
        ListEmptyComponent={<EmptyState icon="business-outline" title={t('branch.noBranches')} subtitle={t('branch.noBranchesHint')} />}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      />
      <ConfirmSheet
        visible={!!confirmSheet}
        title={confirmSheet?.title ?? ''}
        message={confirmSheet?.message}
        confirmLabel={confirmSheet?.confirmLabel}
        destructive={confirmSheet?.destructive}
        icon={confirmSheet?.icon}
        onConfirm={() => { confirmSheet?.onConfirm(); setConfirmSheet(null); }}
        onClose={() => setConfirmSheet(null)}
      />
    </>
  );
}
