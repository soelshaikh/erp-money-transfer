import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { withAlpha } from '../../../utils/colors';
import { fmtTime, fmtDate } from '../../../utils/fmt';
import { signOffApi } from '../api/signOffApi';

export function DaySignOffsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [enablingId, setEnablingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['daySignOffs'],
    queryFn: () => signOffApi.list(),
    staleTime: 30_000,
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => signOffApi.enableReLogin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daySignOffs'] });
      setEnablingId(null);
    },
    onError: () => {
      setEnablingId(null);
      Alert.alert(t('common.error'), t('signOff.enableFailed'));
    },
  });

  const handleEnable = (item: any) => {
    if (item.reLoginEnabled) return;
    Alert.alert(
      t('signOff.enableTitle'),
      t('signOff.enableConfirm', { name: item.userId?.name || '—' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('signOff.enableBtn'),
          onPress: () => {
            setEnablingId(item._id);
            enableMutation.mutate(item._id);
          },
        },
      ]
    );
  };

  if (isLoading) return <LoadingScreen />;

  const records: any[] = (data as any) || [];

  const renderItem = ({ item }: { item: any }) => {
    const user = item.userId || {};
    const branch = item.branchId || {};
    const isEnabled = item.reLoginEnabled === true;
    const isEnabling = enablingId === item._id;

    return (
      <AppCard style={{ marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: withAlpha(isEnabled ? theme.colors.success : theme.colors.warning, 0.15),
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons
              name={isEnabled ? 'checkmark-circle-outline' : 'moon-outline'}
              size={20}
              color={isEnabled ? theme.colors.success : theme.colors.warning}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.label, { color: theme.colors.text }]}>
              {user.name || '—'}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              @{user.username || '—'}
              {branch.code ? `  ·  ${branch.code}` : ''}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {t('signOff.signedOffAt')}: {item.signedOffAt ? fmtTime(new Date(item.signedOffAt)) : '—'}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {isEnabled ? (
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                backgroundColor: withAlpha(theme.colors.success, 0.12),
              }}>
                <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '700' }]} allowFontScaling={false}>
                  {t('signOff.reLoginEnabled')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleEnable(item)}
                disabled={isEnabling}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.primary, opacity: isEnabling ? 0.5 : 1,
                }}
              >
                <Text style={[theme.typography.caption, { color: '#fff', fontWeight: '700' }]} allowFontScaling={false}>
                  {isEnabling ? '...' : t('signOff.enableBtn')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isEnabled && item.enabledBy && (
          <View style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {t('signOff.enabledBy')}: {item.enabledBy?.name || '—'}  ·  {item.enabledAt ? fmtTime(new Date(item.enabledAt)) : '—'}
            </Text>
          </View>
        )}
      </AppCard>
    );
  };

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      contentContainerStyle={{
        padding: theme.spacing.md,
        paddingBottom: tabBarHeight + theme.spacing.md,
      }}
      ListHeaderComponent={
        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {t('signOff.todayDate')}: {fmtDate(new Date())}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingVertical: 60, gap: theme.spacing.md }}>
          <Ionicons name="sunny-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            {t('signOff.noneToday')}
          </Text>
        </View>
      }
      onRefresh={refetch}
      refreshing={false}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
    />
  );
}
