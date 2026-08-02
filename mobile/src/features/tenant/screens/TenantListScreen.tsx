import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  Alert, TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { tenantApi } from '../api/tenantApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const STATUS_COLORS: { [key: string]: string } = {
  active: 'success',
  inactive: 'textSecondary',
  suspended: 'error',
};

interface TenantItemProps {
  item: any;
  onPress: (item: any) => void;
  theme: any;
}

function TenantItem({ item, onPress, theme }: TenantItemProps) {
  const colorKey = STATUS_COLORS[item.status] || 'textSecondary';
  const color = theme.colors[colorKey];
  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.7}>
      <AppCard style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: withAlpha(theme.colors.primary, 0.08), justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="business-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>{item.name}</Text>
              <View style={{ backgroundColor: withAlpha(color, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                <Text style={[theme.typography.caption, { color, fontWeight: '600' }]}>
                  {(item.status || '').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {item.slug} · {item.contactEmail}
            </Text>
          </View>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
}

interface Props {
  navigation: any;
}

export function TenantListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const user = useAuthStore((s: any) => s.user);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('UserDevices', {
            userId: user?.id,
            userName: user?.name || 'Super Admin',
            crossTenantId: user?.tenantId,
          })}
          style={{ marginRight: theme.spacing.md, padding: 4 }}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, user]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantApi.list({ limit: 100 }),
  });

  const resetMutation = useMutation({
    mutationFn: () => tenantApi.resetDevData(),
    onSuccess: (result: any) => {
      setShowResetModal(false);
      setConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      const d = result?.deleted || {};
      const summary = [
        `${d.tenants ?? 0} companies`,
        `${d.branches ?? 0} branches`,
        `${d.users ?? 0} users`,
        `${d.transactions ?? 0} transactions`,
      ].join(', ');
      Alert.alert('Done', `Deleted: ${summary}. Super admin credentials kept.`);
    },
    onError: (err: any) => {
      Alert.alert('Error', parseApiError(err) ?? 'Reset failed');
    },
  });

  const handleResetPress = () => {
    setConfirmText('');
    setShowResetModal(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleConfirmReset = () => {
    if (confirmText.trim() !== 'RESET') {
      Alert.alert('Type RESET', 'Please type RESET exactly to confirm.');
      return;
    }
    resetMutation.mutate();
  };

  if (isLoading) return <LoadingScreen message={t('common.loading')} />;
  const tenants = (data as any)?.data || [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={tenants}
        keyExtractor={(item: any) => item._id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        renderItem={({ item }) => (
          <TenantItem
            item={item}
            theme={theme}
            onPress={(t) => navigation.navigate('TenantDetail', { tenantId: t._id })}
          />
        )}
        ListHeaderComponent={isError ? <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} /> : null}
        ListEmptyComponent={<EmptyState icon="business-outline" title={t('company.title')} subtitle={t('common.noRecords')} />}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <TouchableOpacity
            onPress={handleResetPress}
            activeOpacity={0.8}
            style={{
              marginTop: theme.spacing.xl,
              padding: theme.spacing.md,
              backgroundColor: withAlpha(theme.colors.error, 0.08),
              borderRadius: theme.borderRadius.md,
              borderWidth: 1,
              borderColor: withAlpha(theme.colors.error, 0.25),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={[theme.typography.label, { color: theme.colors.error }]}>
              {t('common.delete')} All Data (Dev Only)
            </Text>
          </TouchableOpacity>
        }
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('RegisterCompany')}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          ...theme.shadow.card,
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Reset confirmation modal */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowResetModal(false); setConfirmText(''); }}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            padding: theme.spacing.lg,
          }}>
            <View style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.lg,
            }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: withAlpha(theme.colors.error, 0.12),
                justifyContent: 'center', alignItems: 'center',
                alignSelf: 'center', marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="warning-outline" size={26} color={theme.colors.error} />
              </View>

              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.sm }]}>
                {t('common.delete')} All Data
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                This will permanently delete all companies, branches, users, and transactions. Super admin credentials will be kept. This cannot be undone.
              </Text>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                Type RESET to {t('common.confirm')}
              </Text>
              <TextInput
                ref={inputRef}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="RESET"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleConfirmReset}
                style={{
                  borderWidth: 1.5,
                  borderColor: confirmText === 'RESET' ? theme.colors.error : theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: theme.spacing.md,
                  letterSpacing: 2,
                }}
              />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowResetModal(false); setConfirmText(''); }}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.divider,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmReset}
                  disabled={resetMutation.isPending || confirmText.trim() !== 'RESET'}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: confirmText.trim() === 'RESET' ? theme.colors.error : withAlpha(theme.colors.error, 0.35),
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>
                    {resetMutation.isPending ? 'Deleting…' : t('common.delete') + ' Everything'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
