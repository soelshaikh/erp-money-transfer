import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { transactionApi } from '../api/transactionApi';
import { AppInput } from '../../../shared/components/AppInput';
import { AppButton } from '../../../shared/components/AppButton';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { FilterChipGroup } from '../../../shared/components/FilterChipGroup';
import { FilterPanel } from '../../../shared/components/FilterPanel';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt } from '../../../utils/fmt';
import { Ionicons } from '@expo/vector-icons';

interface TransactionItemProps {
  item: any;
  onPress: (item: any) => void;
  theme: any;
}

function TransactionItem({ item, onPress, theme }: TransactionItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        ...theme.shadow.card,
      }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
          {item.tokenNumber}
        </Text>
        <StatusBadge status={item.approvalStatus} />
      </View>
      <Text style={[theme.typography.h3, { color: theme.colors.text }]} allowFontScaling={false}>
        {fmtAmt(Number(item.amount))}
      </Text>
      {!!item.customerTokenNo && (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]} numberOfLines={1} allowFontScaling={false}>
          Token: {item.customerTokenNo}
        </Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {item.collectionBranchId?.name} → {item.payoutBranchId?.name}
        </Text>
        <StatusBadge status={item.paymentStatus} />
      </View>
    </TouchableOpacity>
  );
}

const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Completed', value: 'completed' },
];

const LIMIT = 20;

interface Props {
  navigation: any;
}

export function TransactionListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((s: any) => s.user);
  const tabBarHeight = useBottomTabBarHeight();

  // Applied filters — changing this resets the infinite query to page 1
  const [activeFilters, setActiveFilters] = useState<any>({});

  // Pending filter inputs (editing state, not yet applied)
  const [showFilters, setShowFilters] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showChooser, setShowChooser] = useState(false);

  const activeFilterCount = [
    activeFilters.tokenNumber,
    activeFilters.fromDate,
    activeFilters.toDate,
    activeFilters.approvalStatus || activeFilters.paymentStatus,
  ].filter(Boolean).length;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['transactions', activeFilters],
    queryFn: ({ pageParam }) =>
      transactionApi.list({ ...activeFilters, page: pageParam, limit: LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      const { page, limit, total } = lastPage;
      return page * limit < total ? page + 1 : undefined;
    },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {user?.role === 'branch' && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('CompleteByToken')} style={{ marginRight: theme.spacing.sm + 4 }}>
                <Ionicons name="barcode-outline" size={26} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowChooser(true)} style={{ marginRight: theme.spacing.sm + 4 }}>
                <Ionicons name="add-circle-outline" size={26} color={theme.colors.primary} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setShowFilters((prev) => !prev)}
            style={{ marginRight: theme.spacing.md }}
          >
            <View>
              <Ionicons name="options-outline" size={22} color={activeFilterCount > 0 ? theme.colors.secondary : theme.colors.primary} />
              {activeFilterCount > 0 && (
                <View style={{
                  position: 'absolute', top: -4, right: -6,
                  backgroundColor: theme.colors.secondary,
                  borderRadius: 999, minWidth: 14, height: 14,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }} allowFontScaling={false}>
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, showFilters, user, activeFilterCount]);

  const applyFilters = () => {
    setActiveFilters({
      tokenNumber: tokenSearch || undefined,
      fromDate: startDate || undefined,
      toDate: endDate || undefined,
      approvalStatus: statusFilter !== 'all' && ['pending', 'approved', 'rejected'].includes(statusFilter) ? statusFilter : undefined,
      paymentStatus: statusFilter === 'completed' ? 'completed' : undefined,
    });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setTokenSearch('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setActiveFilters({});
  };

  if (isLoading) return <LoadingScreen message={t('txn.loading')} />;

  const transactions = data?.pages.flatMap((p: any) => p.data) ?? [];
  const total: number = data?.pages[0]?.total ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }}>
        <FilterPanel visible={showFilters} onClear={clearFilters} onApply={applyFilters} theme={theme}>
          <AppInput
            label={t('common.search')}
            value={tokenSearch}
            onChangeText={setTokenSearch}
            placeholder={t('common.search')}
            returnKeyType="search"
            onSubmitEditing={applyFilters}
            autoCorrect={false}
          />
          <DateRangeFilter
            fromDate={startDate}
            toDate={endDate}
            onFromChange={setStartDate}
            onToChange={setEndDate}
            theme={theme}
          />
          <FilterChipGroup
            label={t('common.filter')}
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onSelect={setStatusFilter}
            theme={theme}
          />
        </FilterPanel>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item: any) => item._id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            theme={theme}
            onPress={(t) => navigation.navigate('TransactionDetail', { transactionId: t._id })}
          />
        )}
        ListHeaderComponent={
          <>
            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}
            {total > 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]} allowFontScaling={false}>
                {transactions.length} {t('txn.of')} {total} {t('txn.transactions')}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState icon="swap-horizontal-outline" title={t('txn.noTxns')} subtitle={t('txn.noTxnsHint')} />
        }
        ListFooterComponent={
          hasNextPage ? (
            <View style={{ paddingTop: theme.spacing.sm }}>
              {isFetchingNextPage ? (
                <ActivityIndicator color={theme.colors.primary} style={{ paddingVertical: theme.spacing.md }} />
              ) : (
                <AppButton
                  title={`${t('common.loadMore')}  (${transactions.length} ${t('txn.of')} ${total})`}
                  variant="outline"
                  onPress={() => fetchNextPage()}
                  style={{ marginTop: theme.spacing.xs }}
                />
              )}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={refetch} colors={[theme.colors.primary]} />
        }
      />
      {/* ── New entry chooser (bottom sheet) ──────────── */}
      <Modal
        visible={showChooser}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChooser(false)}
      >
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => setShowChooser(false)}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20,
            gap: 10,
          }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text, marginBottom: 4 }}>
              {t('txn.newEntry')}
            </Text>

            <TouchableOpacity
              onPress={() => { setShowChooser(false); navigation.navigate('ShakhaEntry'); }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
              }}
            >
              <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 15 }}>
                  {t('txn.shakhaEntry')}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {t('txn.gujaratiForm')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowChooser(false); navigation.navigate('CreateTransaction'); }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
              }}
            >
              <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 15 }}>
                  {t('txn.englishForm')}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {t('txn.englishFormSub')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
