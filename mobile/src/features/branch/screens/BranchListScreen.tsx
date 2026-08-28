import React, { useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
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

function BranchItem({ item, theme, onDelete, onToggle, onViewLedger, onEditCommission }: BranchItemProps) {
  const { t } = useTranslation();
  const isActive = item.status === 'active';
  const actualBalance: number = item.balance ?? 0;
  const committed: number = item.committedPayout ?? 0;
  const pendingPayout: number = item.pendingPayout ?? 0;
  const payoutCompleted: number = item.payoutCompleted ?? 0;
  const commissionPayable: number = item.commissionPayable ?? 0;
  const effectiveBalance: number = actualBalance - committed - pendingPayout + payoutCompleted - commissionPayable;
  const isNeg = effectiveBalance < 0;
  const effColor = isNeg ? theme.colors.error : effectiveBalance === 0 ? theme.colors.textSecondary : theme.colors.success;

  const handleMenu = () => {
    const buttons: any[] = [];
    if (item.type !== 'head_office') {
      buttons.push({ text: t('branch.editCommission'), onPress: () => onEditCommission(item) });
    }
    buttons.push({
      text: isActive ? t('branch.disableBtn') : t('branch.enableBtn'),
      style: isActive ? 'destructive' : 'default',
      onPress: () => onToggle(item),
    });
    buttons.push({ text: t('branch.deleteBtn'), style: 'destructive', onPress: () => onDelete(item) });
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(item.name, undefined, buttons);
  };

  return (
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
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: theme.borderRadius.full,
            }}>
              <Text style={[theme.typography.caption, {
                color: isActive ? theme.colors.success : theme.colors.error,
                fontWeight: '600',
              }]} allowFontScaling={false}>
                {isActive ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleMenu}
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

        {/* Row 3: commission footer — always shown for non-HO branches */}
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
  );
}

export function BranchListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (err: any) => Alert.alert('Error', parseApiError(err) ?? 'Failed to delete'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => branchApi.toggleStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (err: any) => Alert.alert('Error', parseApiError(err) ?? 'Failed to update status'),
  });

  const handleDelete = (item: any) => {
    Alert.alert(t('branch.deleteTitle'), `${t('branch.deleteMsg')} "${item.name}"?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('branch.deleteConfirm'), style: 'destructive', onPress: () => deleteMutation.mutate(item._id) },
    ]);
  };

  const handleToggle = (item: any) => {
    const isActive = item.status === 'active';
    Alert.alert(
      isActive ? t('branch.disableBtn') : t('branch.enableBtn'),
      isActive
        ? `"${item.name}" ${t('branch.disableMsg')}`
        : `"${item.name}" ${t('branch.enableMsg')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isActive ? t('branch.disableConfirm') : t('branch.enableConfirm'),
          style: isActive ? 'destructive' : 'default',
          onPress: () => toggleMutation.mutate(item._id),
        },
      ]
    );
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
        <TouchableOpacity
          onPress={() => {
            if (atLimit) {
              Alert.alert('Branch Limit Reached', `This company allows a maximum of ${branchLimit} branch${branchLimit === 1 ? '' : 'es'}.`);
              return;
            }
            navigation.navigate('CreateBranch');
          }}
          style={{ marginRight: theme.spacing.md }}
        >
          <Ionicons name="add" size={26} color={atLimit ? theme.colors.textSecondary : theme.colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, atLimit, branchLimit]);

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
        <BranchItem item={item} theme={theme} onDelete={handleDelete} onToggle={handleToggle} onViewLedger={handleViewLedger} onEditCommission={handleEditCommission} />
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
  );
}
