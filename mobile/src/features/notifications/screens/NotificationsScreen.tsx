import React, { useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RefreshButton } from '../../../shared/components/RefreshButton';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { withAlpha } from '../../../utils/colors';
import { useNotificationStore } from '../../../store/notificationStore';
import { notificationApi } from '../api/notificationApi';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NOTIF_ICONS: { [key: string]: string } = {
  PAYMENT_COMPLETED: 'checkmark-circle',
  TRANSACTION_REJECTED: 'close-circle',
  TRANSACTION_APPROVED: 'checkmark-done-circle',
};

interface NotifItemProps {
  item: any;
  theme: any;
  onPress: () => void;
}

function NotifItem({ item, theme, onPress }: NotifItemProps) {
  const isUnread = !item.isRead;
  const iconName = (NOTIF_ICONS[item.type] || 'notifications') as any;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={{
        flexDirection: 'row',
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        backgroundColor: isUnread ? withAlpha(theme.colors.primary, 0.06) : theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        borderLeftWidth: isUnread ? 3 : 0,
        borderLeftColor: theme.colors.primary,
        ...theme.shadow.card,
      }}>
        <Ionicons name={iconName} size={22} color={theme.colors.primary} style={{ marginRight: theme.spacing.sm + 4, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.label, { color: theme.colors.text }]}>{item.title || item.type}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{item.body || ''}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        {isUnread && (
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: theme.colors.primary,
            alignSelf: 'center',
          }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export function NotificationsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const markAllRead = useNotificationStore((s: any) => s.markAllRead);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => { markAllRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: theme.spacing.sm }}>
          <RefreshButton onPress={refetch} isFetching={isFetching} />
          <TouchableOpacity onPress={() => markAllMutation.mutate()} style={{ padding: 4 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
              {t('notifs.markAllRead')}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, refetch, isFetching]);

  if (isLoading) return <LoadingScreen message={t('notifs.loading')} />;
  const notifications: any[] = data || [];

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item._id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={15}
      windowSize={5}
      initialNumToRender={15}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={({ item }) => (
        <NotifItem
          item={item}
          theme={theme}
          onPress={() => {
            if (item.data?.transactionId) {
              navigation.navigate('TransactionDetail', { transactionId: item.data.transactionId });
            }
          }}
        />
      )}
      ListEmptyComponent={<EmptyState icon="notifications-outline" title={t('notifs.none')} subtitle={t('notifs.allCaughtUp')} />}
    />
  );
}
