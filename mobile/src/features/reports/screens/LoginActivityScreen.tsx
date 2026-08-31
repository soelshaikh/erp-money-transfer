import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { showToast } from '../../../utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { reportApi } from '../api/reportApi';
import { userApi } from '../../user/api/userApi';
import { AppCard } from '../../../shared/components/AppCard';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtDateTime } from '../../../utils/fmt';
import type { DeviceSession } from '../../../types/deviceSession';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LoginEvent {
  _id: string;
  name: string;
  username: string;
  role: string;
  ipAddress: string | null;
  loginAt: string;
  employeeId?: string | null;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function RoleBadge({ role, theme }: { role: string; theme: any }) {
  const isHO = role === 'head_office';
  const isBranch = role === 'branch';
  const color = isHO ? theme.colors.primary : isBranch ? theme.colors.secondary : theme.colors.textSecondary;
  const label = isHO ? 'Head Office' : isBranch ? 'Branch' : 'Super Admin';
  return (
    <View style={{ backgroundColor: withAlpha(color, 0.12), borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.xs, paddingVertical: 2 }}>
      <Text style={[theme.typography.caption, { color, fontSize: 10, fontWeight: '600' }]} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

function AvatarCircle({ name, theme }: { name: string; theme: any }) {
  const initials = (name || '?').split(' ').map((w: string) => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(theme.colors.primary, 0.12), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }} allowFontScaling={false}>{initials}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={{ height: 1, backgroundColor: withAlpha(theme.colors.textSecondary, 0.10), marginVertical: theme.spacing.sm }} />;
}

// ── Login event card ───────────────────────────────────────────────────────────

function LoginEventCard({ item, theme }: { item: LoginEvent; theme: any }) {
  return (
    <AppCard style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AvatarCircle name={item.name} theme={theme} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
              {item.name || '—'}
            </Text>
            {item.role ? <RoleBadge role={item.role} theme={theme} /> : null}
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {item.username}
          </Text>
          {item.employeeId ? (
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600', marginTop: 2 }]} numberOfLines={1} allowFontScaling={false}>
              ID: {item.employeeId}
            </Text>
          ) : null}
        </View>
      </View>
      <Divider theme={theme} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 }}>
          <Ionicons name="time-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {fmtDateTime(item.loginAt)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="wifi-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false} selectable>
            {item.ipAddress || '—'}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

// ── Active session card ────────────────────────────────────────────────────────

function DeviceSessionCard({
  item,
  isSelf,
  isSigningOut,
  onSignOut,
  theme,
}: {
  item: DeviceSession;
  isSelf: boolean;
  isSigningOut: boolean;
  onSignOut: (id: string) => void;
  theme: any;
}) {
  const user = item.userId;
  const platformIcon: any =
    item.platform === 'ios' ? 'logo-apple' :
    item.platform === 'android' ? 'logo-android' :
    'phone-portrait-outline';

  return (
    <AppCard style={{ marginBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AvatarCircle name={user?.name || '?'} theme={theme} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
              {user?.name || '—'}
            </Text>
            {user?.role ? <RoleBadge role={user.role} theme={theme} /> : null}
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {user?.username || '—'}{isSelf ? '  (you)' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, backgroundColor: withAlpha(theme.colors.success, 0.12), borderRadius: theme.borderRadius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success }} />
          <Text style={[theme.typography.caption, { color: theme.colors.success, fontSize: 10, fontWeight: '600' }]} allowFontScaling={false}>ACTIVE</Text>
        </View>
      </View>
      <Divider theme={theme} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
        <Ionicons name={platformIcon} size={15} color={theme.colors.primary} />
        <Text style={[theme.typography.label, { color: theme.colors.text }]} numberOfLines={1}>
          {item.deviceName || 'Unknown Device'}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          ({item.platform || 'unknown'})
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flex: 1 }}>
          <Ionicons name="wifi-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} allowFontScaling={false} selectable>
            {item.ip || '—'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="time-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {fmtDateTime(item.approvedAt || item.createdAt)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSignOut(item._id)}
        disabled={isSigningOut}
        style={{
          marginTop: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          backgroundColor: withAlpha(theme.colors.error, 0.08),
          borderWidth: 1,
          borderColor: withAlpha(theme.colors.error, 0.20),
          borderRadius: theme.borderRadius.sm,
          paddingVertical: theme.spacing.sm,
        }}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color={theme.colors.error} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={14} color={theme.colors.error} />
            <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '600' }]} allowFontScaling={false}>
              {isSelf ? 'Sign Out (logs you out)' : 'Sign Out'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </AppCard>
  );
}

// ── User picker modal ──────────────────────────────────────────────────────────

function UserPickerModal({
  visible,
  onClose,
  onSelect,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (user: any | null) => void;
  theme: any;
}) {
  const [search, setSearch] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users-picker'],
    queryFn: () => userApi.list({ limit: 200 }),
    enabled: visible,
  });

  const allUsers: any[] = (usersData as any)?.data || [];
  const filtered = search.trim()
    ? allUsers.filter((u: any) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
      )
    : allUsers;

  const handleSelect = (user: any | null) => {
    onSelect(user);
    onClose();
    setSearch('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.borderRadius.lg, borderTopRightRadius: theme.borderRadius.lg, maxHeight: '72%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: withAlpha(theme.colors.textSecondary, 0.10) }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, flex: 1 }]}>Select User</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(theme.colors.textSecondary, 0.08), borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm, gap: theme.spacing.xs }}>
              <Ionicons name="search-outline" size={15} color={theme.colors.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or username…"
                placeholderTextColor={theme.colors.textSecondary}
                style={[theme.typography.body, { color: theme.colors.text, flex: 1, paddingVertical: 0 }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={15} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={[null as any, ...filtered]}
            keyExtractor={(item) => item?._id || '__all__'}
            contentContainerStyle={{ padding: theme.spacing.md, gap: 2 }}
            renderItem={({ item }) =>
              item === null ? (
                <TouchableOpacity
                  onPress={() => handleSelect(null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.sm }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(theme.colors.textSecondary, 0.10), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="people-outline" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1 }]}>All Users</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.sm }}
                >
                  <AvatarCircle name={item.name} theme={theme} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.label, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{item.username}</Text>
                  </View>
                  <RoleBadge role={item.role} theme={theme} />
                </TouchableOpacity>
              )
            }
            removeClippedSubviews
            maxToRenderPerBatch={20}
            windowSize={5}
            initialNumToRender={15}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Tab switcher ───────────────────────────────────────────────────────────────

function TabSwitcher({ activeTab, onSwitch, theme }: { activeTab: 'history' | 'sessions'; onSwitch: (t: 'history' | 'sessions') => void; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: withAlpha(theme.colors.textSecondary, 0.08), borderRadius: theme.borderRadius.sm, padding: theme.spacing.xs, marginBottom: theme.spacing.md }}>
      {(['history', 'sessions'] as const).map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onSwitch(tab)}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.borderRadius.sm - 2,
              alignItems: 'center',
              backgroundColor: active ? theme.colors.surface : 'transparent',
              elevation: active ? 2 : 0,
              shadowColor: active ? '#000' : 'transparent',
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: active ? 3 : 0,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <Text
              style={[theme.typography.caption, { color: active ? theme.colors.primary : theme.colors.textSecondary, fontWeight: active ? '700' : '400' }]}
              allowFontScaling={false}
            >
              {tab === 'history' ? 'Login History' : 'Active Sessions'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function LoginActivityScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const currentUser = useAuthStore((s: any) => s.user);
  const isHeadOffice = currentUser?.role === 'head_office';

  const [activeTab, setActiveTab] = useState<'history' | 'sessions'>('history');
  const [showFilters, setShowFilters] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState<{
    title: string; message?: string; confirmLabel?: string;
    destructive?: boolean; icon?: string; onConfirm: () => void;
  } | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Branch users always see only their own data
  const branchUserId = !isHeadOffice ? currentUser?._id || currentUser?.id : undefined;
  const [activeFilters, setActiveFilters] = useState<{ startDate?: string; endDate?: string; userId?: string }>(
    branchUserId ? { userId: branchUserId } : {}
  );

  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['login-activity', activeFilters],
    queryFn: () => reportApi.getLoginActivity(activeFilters),
    enabled: activeTab === 'history',
  });

  const sessionsQuery = useQuery({
    queryKey: isHeadOffice ? ['device-sessions-approved'] : ['device-sessions-mine'],
    queryFn: isHeadOffice
      ? () => reportApi.getDeviceSessions({ status: 'approved' })
      : () => reportApi.getMyDeviceSessions(),
    enabled: activeTab === 'sessions',
  });

  const [signingOutId, setSigningOutId] = useState<string | null>(null);

  const suspendAllMutation = useMutation({
    mutationFn: () => reportApi.suspendAllSessions(),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['device-sessions-approved'] });
      showToast('success', 'Done', `${result?.suspended ?? 0} session${result?.suspended !== 1 ? 's' : ''} signed out.`);
    },
    onError: () => showToast('error', 'Error', 'Failed to sign out sessions. Please try again.'),
  });

  const suspendOneMutation = useMutation({
    mutationFn: (id: string) => reportApi.suspendSession(id),
    onMutate: (id) => setSigningOutId(id),
    onSettled: () => setSigningOutId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-sessions-approved'] });
      queryClient.invalidateQueries({ queryKey: ['device-sessions-mine'] });
    },
    onError: () => showToast('error', 'Error', 'Failed to sign out this session. Please try again.'),
  });

  const handleSignOutOne = (sessionId: string) => {
    const session = sessions.find((s) => s._id === sessionId);
    const userId = session?.userId?._id || '';
    const isSelf = !!userId && (userId === currentUser?._id || userId === currentUser?.id);
    const name = session?.userId?.name || 'this user';
    const device = session?.deviceName || 'their device';
    setConfirmSheet({
      title: 'Sign Out Session',
      message: isSelf
        ? 'This will sign YOU out immediately. You will need to log in again.'
        : `Sign out ${name} from ${device}?`,
      confirmLabel: isSelf ? 'Sign Me Out' : 'Sign Out',
      destructive: true,
      icon: 'log-out-outline',
      onConfirm: () => suspendOneMutation.mutate(sessionId),
    });
  };

  const handleSignOutAll = () => {
    setConfirmSheet({
      title: 'Sign Out All Sessions',
      message: 'This will immediately sign out all active devices across all users. They will need to log in again.',
      confirmLabel: 'Sign Out All',
      destructive: true,
      icon: 'power-outline',
      onConfirm: () => suspendAllMutation.mutate(),
    });
  };

  const events: LoginEvent[] = (historyQuery.data as any) || [];
  const sessions: DeviceSession[] = (sessionsQuery.data as any) || [];
  const isHistory = activeTab === 'history';
  const activeQuery = isHistory ? historyQuery : sessionsQuery;

  const applyFilters = () => {
    setActiveFilters({
      startDate: fromDate.trim() || undefined,
      endDate: toDate.trim() || undefined,
      // Branch users always filter by their own userId
      userId: branchUserId || selectedUser?._id || undefined,
    });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedUser(null);
    // Branch users keep their userId constraint when clearing
    setActiveFilters(branchUserId ? { userId: branchUserId } : {});
    setShowFilters(false);
  };

  // ── Filter bar (history tab only) ─────────────────────────────────────────

  const hasDateFilters = !!(activeFilters.startDate || activeFilters.endDate);
  const hasUserFilter = isHeadOffice && !!activeFilters.userId;
  const hasAnyFilter = hasDateFilters || hasUserFilter;

  const FilterBar = isHistory ? (
    <>
      <TouchableOpacity
        onPress={() => setShowFilters(!showFilters)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: hasAnyFilter ? withAlpha(theme.colors.primary, 0.08) : withAlpha(theme.colors.textSecondary, 0.08),
          borderRadius: theme.borderRadius.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="filter-outline" size={14} color={hasAnyFilter ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: hasAnyFilter ? theme.colors.primary : theme.colors.textSecondary, fontWeight: hasAnyFilter ? '600' : '400' }]}>
            {hasAnyFilter
              ? `Filters active${isHeadOffice && selectedUser ? ` · ${selectedUser.name}` : ''}`
              : isHeadOffice ? 'Filter by date or user' : 'Filter by date'}
          </Text>
        </View>
        <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {showFilters && (
        <AppCard style={{ marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Date Range</Text>
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            theme={theme}
          />
          {isHeadOffice && (
            <>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs }]}>User</Text>
              <TouchableOpacity
                onPress={() => setShowUserPicker(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: withAlpha(theme.colors.textSecondary, 0.20),
                  borderRadius: theme.borderRadius.sm,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  gap: theme.spacing.sm,
                }}
              >
                <Ionicons name="person-outline" size={15} color={theme.colors.textSecondary} />
                <Text style={[theme.typography.label, { color: selectedUser ? theme.colors.text : theme.colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                  {selectedUser ? `${selectedUser.name}  (${selectedUser.username})` : 'All Users'}
                </Text>
                {selectedUser ? (
                  <TouchableOpacity onPress={() => setSelectedUser(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <TouchableOpacity
              onPress={applyFilters}
              style={{ flex: 1, backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.sm, alignItems: 'center' }}
            >
              <Text style={[theme.typography.label, { color: theme.colors.textOnPrimary }]}>Apply</Text>
            </TouchableOpacity>
            {(fromDate || toDate || (isHeadOffice && selectedUser)) && (
              <TouchableOpacity
                onPress={clearFilters}
                style={{ paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.sm, alignItems: 'center', backgroundColor: withAlpha(theme.colors.error, 0.10) }}
              >
                <Text style={[theme.typography.label, { color: theme.colors.error }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </AppCard>
      )}
    </>
  ) : null;

  // ── Sign out all button (sessions tab, head_office only) ─────────────────

  const SignOutAllButton = !isHistory && isHeadOffice ? (
    <TouchableOpacity
      onPress={handleSignOutAll}
      disabled={suspendAllMutation.isPending || sessions.length === 0}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: withAlpha(theme.colors.error, 0.08),
        borderWidth: 1,
        borderColor: withAlpha(theme.colors.error, 0.20),
        borderRadius: theme.borderRadius.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        opacity: sessions.length === 0 ? 0.45 : 1,
      }}
    >
      <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
      <Text style={[theme.typography.label, { color: theme.colors.error, flex: 1 }]}>
        {suspendAllMutation.isPending ? 'Signing out…' : 'Sign Out All Active Sessions'}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={theme.colors.error} />
    </TouchableOpacity>
  ) : null;

  // ── Count row ──────────────────────────────────────────────────────────────

  const CountRow = !activeQuery.isError ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
      <Ionicons name={isHistory ? 'log-in-outline' : 'phone-portrait-outline'} size={14} color={theme.colors.textSecondary} />
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
        {isHistory
          ? `${events.length} login ${events.length !== 1 ? 'events' : 'event'}${hasAnyFilter ? ' (filtered)' : ''}`
          : `${sessions.length} active ${sessions.length !== 1 ? 'sessions' : 'session'}`}
      </Text>
    </View>
  ) : null;

  // ── Loading ────────────────────────────────────────────────────────────────

  if (activeQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: theme.spacing.md }}>
          <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} theme={theme} />
        </View>
        <LoadingScreen message={isHistory ? 'Loading login history…' : 'Loading active sessions…'} />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <FlatList<any>
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        data={isHistory ? events : sessions}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <>
            <TabSwitcher activeTab={activeTab} onSwitch={setActiveTab} theme={theme} />
            {FilterBar}
            {SignOutAllButton}
            {activeQuery.isError && (
              <ErrorMessage message={parseApiError(activeQuery.error) ?? 'Failed to load'} onRetry={activeQuery.refetch} />
            )}
            {CountRow}
          </>
        }
        ListEmptyComponent={
          activeQuery.isError ? null : (
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl, gap: theme.spacing.sm }}>
              <Ionicons
                name={isHistory ? 'log-in-outline' : 'phone-portrait-outline'}
                size={48}
                color={withAlpha(theme.colors.textSecondary, 0.38)}
              />
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
                {isHistory ? 'No login events found' : 'No active sessions'}
              </Text>
              {isHistory && hasAnyFilter && (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Try adjusting the filters
                </Text>
              )}
            </View>
          )
        }
        renderItem={({ item }) => {
          if (isHistory) return <LoginEventCard item={item} theme={theme} />;
          const userId = item.userId?._id || '';
          const isSelf = !!userId && (userId === currentUser?._id || userId === currentUser?.id);
          return (
            <DeviceSessionCard
              item={item}
              isSelf={isSelf}
              isSigningOut={signingOutId === item._id}
              onSignOut={handleSignOutOne}
              theme={theme}
            />
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={activeQuery.isFetching && !activeQuery.isLoading}
            onRefresh={activeQuery.refetch}
            colors={[theme.colors.primary]}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={15}
        keyboardShouldPersistTaps="handled"
      />
      <UserPickerModal
        visible={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        onSelect={setSelectedUser}
        theme={theme}
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
