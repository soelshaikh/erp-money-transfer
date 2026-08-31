import React, { useState, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { showToast } from '../../../utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { RefreshButton } from '../../../shared/components/RefreshButton';
import { fmtAmt } from '../../../utils/fmt';
import { userApi } from '../api/userApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { useTranslation } from 'react-i18next';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';

function getStatusBadge(status: string, theme: any, t: (key: string) => string) {
  if (status === 'active') return { bg: withAlpha(theme.colors.success, 0.12), color: theme.colors.success, label: t('common.active') };
  if (status === 'disabled') return { bg: withAlpha(theme.colors.statusPending, 0.15), color: theme.colors.statusPending, label: t('common.disabled') };
  return { bg: withAlpha(theme.colors.error, 0.12), color: theme.colors.error, label: t('common.suspended') };
}

interface UserItemProps {
  item: any;
  theme: any;
  onToggle: (item: any) => void;
  onSuspend: (item: any) => void;
  onUnsuspend: (item: any) => void;
  onManageDevices: (item: any) => void;
  onToggleCommissionPermission: (item: any) => void;
  suspendingId: string | null;
  unsuspendingId: string | null;
  disablingId: string | null;
  t: (key: string) => string;
}

function UserItem({ item, theme, onToggle, onSuspend, onUnsuspend, onManageDevices, onToggleCommissionPermission, suspendingId, unsuspendingId, disablingId, t }: UserItemProps) {
  const isActive = item.status === 'active';
  const isSuspended = item.status === 'suspended';
  const canOverride = item.permissions?.canOverrideCommission === true;
  const badge = getStatusBadge(item.status, theme, t);
  const avatarColor = isSuspended
    ? theme.colors.textSecondary
    : isActive ? theme.colors.secondary : theme.colors.statusPending;

  return (
    <AppCard style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar */}
        <View style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: withAlpha(avatarColor, 0.12),
          justifyContent: 'center', alignItems: 'center', marginRight: 12,
        }}>
          <Text style={[theme.typography.label, { color: avatarColor }]}>
            {item.name[0]?.toUpperCase()}
          </Text>
        </View>

        {/* Name + username */}
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.label, { color: isSuspended ? theme.colors.textSecondary : theme.colors.text }]}>
            {item.name}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {item.username} · {item.role === 'head_office' ? t('user.headOffice') : item.role === 'branch' ? t('user.branch') : item.role === 'super_admin' ? t('user.superAdmin') : item.role}
          </Text>
          {item.role === 'branch' && item.branchId?.code && (
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', marginTop: 1 }]} numberOfLines={1}>
              {item.branchId.code} — {item.branchId.name}
            </Text>
          )}
        </View>

        {/* Status badge */}
        <View style={{ backgroundColor: badge.bg, paddingHorizontal: theme.spacing.sm, paddingVertical: 3, borderRadius: theme.borderRadius.full }}>
          <Text style={[theme.typography.caption, { color: badge.color, fontWeight: '600' }]} allowFontScaling={false}>
            {badge.label}
          </Text>
        </View>

        {/* Manage devices — always visible */}
        <TouchableOpacity onPress={() => onManageDevices(item)} style={{ padding: theme.spacing.sm, marginLeft: 4 }}>
          <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Disable / Enable */}
        {!isSuspended && (
          <TouchableOpacity onPress={() => onToggle(item)} style={{ padding: theme.spacing.sm }} disabled={disablingId === item._id}>
            {disablingId === item._id && isActive
              ? <ActivityIndicator size="small" color={theme.colors.statusPending} />
              : <Ionicons
                  name={isActive ? 'ban-outline' : 'checkmark-circle-outline'}
                  size={22}
                  color={isActive ? theme.colors.statusPending : theme.colors.success}
                />
            }
          </TouchableOpacity>
        )}

        {/* Suspend — only for non-suspended, non-head_office */}
        {!isSuspended && item.role !== 'head_office' && (
          <TouchableOpacity
            onPress={() => onSuspend(item)}
            style={{ padding: theme.spacing.sm }}
            disabled={suspendingId === item._id}
          >
            {suspendingId === item._id
              ? <ActivityIndicator size="small" color={theme.colors.error} />
              : <Ionicons name="lock-closed-outline" size={18} color={theme.colors.error} />
            }
          </TouchableOpacity>
        )}

        {/* Unsuspend — only when suspended */}
        {isSuspended && (
          <TouchableOpacity
            onPress={() => onUnsuspend(item)}
            style={{ padding: theme.spacing.sm }}
            disabled={unsuspendingId === item._id}
          >
            {unsuspendingId === item._id
              ? <ActivityIndicator size="small" color={theme.colors.success} />
              : <Ionicons name="lock-open-outline" size={18} color={theme.colors.success} />
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Commission override row — branch users only */}
      {item.role === 'branch' && (
        <TouchableOpacity
          onPress={() => onToggleCommissionPermission(item)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm,
            borderTopWidth: 1, borderTopColor: theme.colors.border,
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={canOverride ? 'shield-checkmark' : 'shield-outline'}
            size={15}
            color={canOverride ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[theme.typography.caption, { color: canOverride ? theme.colors.primary : theme.colors.textSecondary, marginLeft: 5, flex: 1 }]}>
            {canOverride ? t('user.commOverrideAllowed') : t('user.commOverrideDenied')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
            {canOverride ? t('user.revokeCommTitle') : t('user.grantCommTitle')}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}

export function UserListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();

  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [unsuspendingId, setUnsuspendingId] = useState<string | null>(null);
  const [suspendModal, setSuspendModal] = useState<{ user: any; transactions: any[] } | null>(null);
  const [disableModal, setDisableModal] = useState<{ user: any; transactions: any[] } | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string;
    message?: string;
    confirmLabel?: string;
    destructive?: boolean;
    icon?: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => userApi.toggleStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); showToast('success', 'Updated', 'User status updated'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to update status'),
  });

  const toggleDisableMutation = useMutation({
    mutationFn: (id: string) => userApi.toggleStatus(id),
    onSuccess: () => { setDisableModal(null); qc.invalidateQueries({ queryKey: ['users'] }); showToast('success', 'Updated', 'User status updated'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to update status'),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => userApi.suspend(id),
    onSuccess: () => {
      setSuspendModal(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast('success', 'Suspended', 'User suspended');
    },
    onError: (err: any) => {
      setSuspendModal(null);
      showToast('error', 'Error', parseApiError(err) ?? 'Failed to suspend user');
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => userApi.unsuspend(id),
    onMutate: (id) => setUnsuspendingId(id),
    onSettled: () => setUnsuspendingId(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); showToast('success', 'Updated', 'User unsuspended'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to unsuspend user'),
  });

  const commissionPermMutation = useMutation({
    mutationFn: ({ id, canOverride }: { id: string; canOverride: boolean }) =>
      userApi.update(id, { permissions: { canOverrideCommission: canOverride } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); showToast('success', 'Updated', 'Permission updated'); },
    onError: (err: any) => showToast('error', 'Error', parseApiError(err) ?? 'Failed to update permission'),
  });

  const handleToggle = (item: any) => {
    const isActive = item.status === 'active';
    if (!isActive) {
      // enabling — simple confirm
      setConfirmSheet({
        title: t('user.enableTitle'),
        message: `"${item.name}" ${t('user.enableMsg')}`,
        confirmLabel: t('user.enableBtn'),
        onConfirm: () => toggleMutation.mutate(item._id),
      });
      return;
    }
    // disabling — fetch transactions first, show modal
    setDisablingId(item._id);
    userApi.getActiveTransactions(item._id)
      .then((txns: any) => setDisableModal({ user: item, transactions: Array.isArray(txns) ? txns : [] }))
      .catch(() => setDisableModal({ user: item, transactions: [] }))
      .finally(() => setDisablingId(null));
  };

  const handleSuspend = async (item: any) => {
    setSuspendingId(item._id);
    try {
      const txns = await userApi.getActiveTransactions(item._id);
      setSuspendModal({ user: item, transactions: Array.isArray(txns) ? txns : [] });
    } catch {
      setSuspendModal({ user: item, transactions: [] });
    } finally {
      setSuspendingId(null);
    }
  };

  const handleUnsuspend = (item: any) => {
    setConfirmSheet({
      title: t('user.unsuspendTitle'),
      message: `"${item.name}" ${t('user.unsuspendMsg')}`,
      confirmLabel: t('user.unsuspendBtn'),
      onConfirm: () => unsuspendMutation.mutate(item._id),
    });
  };

  const handleManageDevices = (item: any) => {
    navigation.navigate('UserDevices', { userId: item._id, userName: item.name });
  };

  const handleToggleCommissionPermission = (item: any) => {
    const current = item.permissions?.canOverrideCommission === true;
    setConfirmSheet({
      title: current ? t('user.revokeCommTitle') : t('user.grantCommTitle'),
      message: current
        ? `"${item.name}"${t('user.revokeCommMsg')}`
        : `Allow "${item.name}" ${t('user.grantCommMsg')}`,
      confirmLabel: current ? t('common.revoke') : t('common.grant'),
      destructive: current,
      onConfirm: () => commissionPermMutation.mutate({ id: item._id, canOverride: !current }),
    });
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.list({ limit: 100 }),
  });

  const users = (data as any)?.data || [];
  const staffLimit: number | null = (data as any)?.staffLimit ?? null;
  const activeCount: number = (data as any)?.activeStaffCount ?? users.filter((u: any) => u.status === 'active').length;
  const atLimit = staffLimit !== null && activeCount >= staffLimit;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: theme.spacing.sm }}>
          <RefreshButton onPress={refetch} isFetching={isFetching} />
          <TouchableOpacity
            onPress={() => navigation.navigate('DeviceApprovals')}
            style={{ padding: 4 }}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (atLimit) {
                showToast('info', t('user.staffLimitTitle'), `${t('user.staffLimitMsg')} ${staffLimit} staff member${staffLimit === 1 ? '' : 's'}.`);
                return;
              }
              navigation.navigate('CreateUser');
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="add" size={26} color={atLimit ? theme.colors.textSecondary : theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, atLimit, staffLimit, refetch, isFetching]);

  if (isLoading) return <LoadingScreen message={t('user.loading')} />;

  const LimitBanner = staffLimit !== null ? (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: atLimit ? withAlpha(theme.colors.error, 0.07) : withAlpha(theme.colors.primary, 0.06),
      borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 10,
      marginBottom: theme.spacing.sm, borderWidth: 1,
      borderColor: atLimit ? withAlpha(theme.colors.error, 0.25) : withAlpha(theme.colors.primary, 0.18),
    }}>
      <Text style={[theme.typography.body, { color: atLimit ? theme.colors.error : theme.colors.primary, fontWeight: '600' }]}>
        {t('user.staffUsed')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[theme.typography.label, { color: atLimit ? theme.colors.error : theme.colors.text, fontWeight: '700' }]} allowFontScaling={false}>
          {activeCount} / {staffLimit}
        </Text>
        {atLimit && (
          <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full }}>
            <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]} allowFontScaling={false}>
              LIMIT REACHED
            </Text>
          </View>
        )}
      </View>
    </View>
  ) : null;

  return (
    <>
      <FlatList
        data={users}
        keyExtractor={(item: any) => item._id}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <UserItem
            item={item}
            theme={theme}
            onToggle={handleToggle}
            onSuspend={handleSuspend}
            onUnsuspend={handleUnsuspend}
            onManageDevices={handleManageDevices}
            onToggleCommissionPermission={handleToggleCommissionPermission}
            suspendingId={suspendingId}
            unsuspendingId={unsuspendingId}
            disablingId={disablingId}
            t={t}
          />
        )}
        ListHeaderComponent={
          <>
            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}
            {LimitBanner}
          </>
        }
        ListEmptyComponent={<EmptyState icon="person-outline" title={t('user.noUsers')} subtitle={t('user.noUsersHint')} />}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      />

      {/* Suspend confirmation modal */}
      <Modal
        visible={suspendModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !suspendMutation.isPending && setSuspendModal(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: theme.spacing.lg, maxHeight: '82%',
          }}>
            {/* Title */}
            <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
              {t('user.suspendTitle')} "{suspendModal?.user?.name}"?
            </Text>

            {/* Permanent warning */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: withAlpha(theme.colors.error, 0.08),
              borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm,
              marginBottom: theme.spacing.md,
            }}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.error} />
              <Text style={[theme.typography.caption, { color: theme.colors.error, flex: 1 }]}>
                {t('user.suspendWarning')}
              </Text>
            </View>

            {/* Active transactions list */}
            {suspendModal && suspendModal.transactions.length > 0 && (
              <>
                <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                  ⚠ {suspendModal.transactions.length} open transaction{suspendModal.transactions.length > 1 ? 's' : ''} {t('user.openTxnsAffected')}
                </Text>
                <ScrollView
                  style={{ maxHeight: 200, marginBottom: theme.spacing.md }}
                  showsVerticalScrollIndicator={false}
                >
                  {suspendModal.transactions.map((t: any) => (
                    <View key={t._id} style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
                    }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', flex: 1 }]} allowFontScaling={false}>
                        {t.tokenNumber}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text, marginHorizontal: 8 }]} allowFontScaling={false}>
                        {fmtAmt(Number(t.amount))}
                      </Text>
                      <View style={{ backgroundColor: withAlpha(theme.colors.statusPending, 0.15), paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.borderRadius.sm }}>
                        <Text style={{ color: theme.colors.statusPending, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }} allowFontScaling={false}>
                          {t.approvalStatus}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {suspendModal && suspendModal.transactions.length === 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
                {t('user.noOpenTxns')}
              </Text>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <TouchableOpacity
                onPress={() => setSuspendModal(null)}
                disabled={suspendMutation.isPending}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.md,
                  borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => suspendMutation.mutate(suspendModal!.user._id)}
                disabled={suspendMutation.isPending}
                style={{
                  flex: 2, paddingVertical: 12, borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.error, alignItems: 'center',
                  opacity: suspendMutation.isPending ? 0.6 : 1,
                }}
                activeOpacity={0.8}
              >
                {suspendMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[theme.typography.label, { color: '#fff' }]}>{t('user.suspendBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Disable confirmation modal */}
      <Modal
        visible={disableModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !toggleDisableMutation.isPending && setDisableModal(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: theme.spacing.lg, maxHeight: '80%',
          }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
              Disable "{disableModal?.user?.name}"?
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: withAlpha(theme.colors.statusPending, 0.08),
              borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm,
              marginBottom: theme.spacing.md,
            }}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.statusPending} />
              <Text style={[theme.typography.caption, { color: theme.colors.statusPending, flex: 1 }]}>
                This temporarily blocks them from logging in. You can re-enable later.
              </Text>
            </View>

            {disableModal && disableModal.transactions.length > 0 && (
              <>
                <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                  ⚠ {disableModal.transactions.length} open transaction{disableModal.transactions.length > 1 ? 's' : ''} may be affected
                </Text>
                <ScrollView style={{ maxHeight: 180, marginBottom: theme.spacing.md }} showsVerticalScrollIndicator={false}>
                  {disableModal.transactions.map((txn: any) => (
                    <View key={txn._id} style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
                    }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', flex: 1 }]} allowFontScaling={false}>
                        {txn.tokenNumber}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text, marginHorizontal: 8 }]} allowFontScaling={false}>
                        {fmtAmt(Number(txn.amount))}
                      </Text>
                      <View style={{ backgroundColor: withAlpha(theme.colors.statusPending, 0.15), paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.borderRadius.sm }}>
                        <Text style={{ color: theme.colors.statusPending, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }} allowFontScaling={false}>
                          {txn.approvalStatus}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {disableModal && disableModal.transactions.length === 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
                No open transactions affected.
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <TouchableOpacity
                onPress={() => setDisableModal(null)}
                disabled={toggleDisableMutation.isPending}
                style={{ flex: 1, paddingVertical: 12, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={[theme.typography.label, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleDisableMutation.mutate(disableModal!.user._id)}
                disabled={toggleDisableMutation.isPending}
                style={{ flex: 2, paddingVertical: 12, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.statusPending, alignItems: 'center', opacity: toggleDisableMutation.isPending ? 0.6 : 1 }}
                activeOpacity={0.8}
              >
                {toggleDisableMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[theme.typography.label, { color: '#fff' }]}>Disable</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
