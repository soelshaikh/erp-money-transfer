import React from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { fmtDate } from '../../../utils/fmt';

const ROLE_LABELS: Record<string, string> = {
  head_office: 'Head Office',
  branch: 'Branch Staff',
};

const ROLE_COLORS: Record<string, string> = {
  head_office: 'primary',
  branch: 'secondary',
};

interface Props {
  route: any;
  navigation: any;
}

export function TenantStaffScreen({ route, navigation }: Props) {
  const { tenantId, tenantName } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tenant-users', tenantId],
    queryFn: () => tenantApi.listTenantUsers(tenantId),
  });

  if (isLoading) return <LoadingScreen message={t('common.loading')} />;

  const users: any[] = (data as any)?.data || [];

  const headOffice = users.filter((u: any) => u.role === 'head_office');
  const staff = users.filter((u: any) => u.role !== 'head_office');

  const allUsers = [...headOffice, ...staff];

  return (
    <FlatList
      data={allUsers}
      keyExtractor={(item: any) => item._id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={15}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />
      }
      renderItem={({ item }) => {
        const roleColorKey = ROLE_COLORS[item.role] || 'textSecondary';
        const roleColor = theme.colors[roleColorKey];
        const isActive = item.status === 'active';

        return (
          <AppCard style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: withAlpha(isActive ? roleColor : theme.colors.textSecondary, 0.12),
                justifyContent: 'center', alignItems: 'center', marginRight: 12,
              }}>
                <Text style={[theme.typography.label, { color: isActive ? roleColor : theme.colors.textSecondary }]}>
                  {item.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={[theme.typography.label, { color: isActive ? theme.colors.text : theme.colors.textSecondary }]}>
                    {item.name}
                  </Text>
                  <View style={{ backgroundColor: withAlpha(roleColor, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={[theme.typography.caption, { color: roleColor, fontWeight: '600' }]}>
                      {ROLE_LABELS[item.role] || item.role}
                    </Text>
                  </View>
                  {!isActive && (
                    <View style={{ backgroundColor: withAlpha(theme.colors.error, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]}>
                        {t('common.disabled').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  {item.username}
                </Text>
                {item.lastLoginAt && (
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Last login: {fmtDate(item.lastLoginAt)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('UserDevices', {
                  userId: item._id,
                  userName: item.name,
                  crossTenantId: tenantId,
                })}
                style={{
                  padding: 10,
                  backgroundColor: withAlpha(theme.colors.primary, 0.08),
                  borderRadius: theme.borderRadius.md,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </AppCard>
        );
      }}
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load staff'} onRetry={refetch} />}
          <AppCard style={{ marginBottom: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
              <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1 }]}>
                {tenantName} — Staff & Devices
              </Text>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 6 }]}>
              Tap the device icon on any user to view and manage their authorized devices.
            </Text>
          </AppCard>
          {allUsers.length > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
              {allUsers.length} user{allUsers.length !== 1 ? 's' : ''} · {headOffice.length} head office · {staff.length} branch staff
            </Text>
          )}
        </>
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title={t('common.noRecords')}
          subtitle={t('nav.createHOAccount') + ' for this company first.'}
        />
      }
    />
  );
}
