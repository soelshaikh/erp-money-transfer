import React from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { branchApi } from '../api/branchApi';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../../utils/colors';
import { fmtAmtSigned, fmtAmt } from '../../../utils/fmt';

function amtColor(n: number, theme: any) {
  return n < 0 ? theme.colors.error : n === 0 ? theme.colors.textSecondary : theme.colors.success;
}

const TYPE_ICONS: Record<string, string> = {
  head_office: 'business',
  collection: 'arrow-down-circle',
  payout: 'arrow-up-circle',
  branch: 'location',
};

export function BalanceSummaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['balance-summary'],
    queryFn: branchApi.getBalanceSummary,
  });

  if (isLoading) return <LoadingScreen message={t('ledger.loadingSummary')} />;

  const branches: any[] = (data as any)?.branches || [];
  const totals = (data as any)?.totals || { actual: 0, pending: 0, committed: 0, effective: 0 };

  // Positive net effective = retained commission (correct)
  // Negative net effective = deficit (something is wrong)
  const isDeficit = totals.effective < 0;
  const statusColor = isDeficit ? theme.colors.error : theme.colors.success;

  const renderBranch = ({ item }: { item: any }) => {
    const effColor = amtColor(item.effectiveBalance, theme);
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => navigation.navigate('BranchLedger', { branchId: item.id, branchName: item.name })}
      >
        <AppCard style={{ marginBottom: theme.spacing.sm }}>
          {/* Row: icon + name + effective + chevron */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: withAlpha(theme.colors.primary, 0.08),
              justifyContent: 'center', alignItems: 'center',
              marginRight: theme.spacing.sm,
            }}>
              <Ionicons name={(TYPE_ICONS[item.type] || 'location') as any} size={17} color={theme.colors.primary} />
            </View>

            {/* Name + code */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[theme.typography.label, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {item.code} · {item.type?.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>

            {/* Balance: ACTUAL + EFFECTIVE stacked */}
            <View style={{ alignItems: 'flex-end', marginLeft: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>
                    ACTUAL
                  </Text>
                  <Text style={{ color: amtColor(item.actualBalance, theme), fontWeight: '700', fontSize: 12 }} allowFontScaling={false}>
                    {fmtAmtSigned(item.actualBalance)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>
                    EFFECTIVE
                  </Text>
                  <Text style={{ color: effColor, fontWeight: '700', fontSize: 12 }} allowFontScaling={false}>
                    {fmtAmtSigned(item.effectiveBalance)}
                  </Text>
                </View>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
          </View>

          {/* Pending/committed banners */}
          {item.pendingPayout > 0 && (
            <View style={{
              marginTop: theme.spacing.sm,
              backgroundColor: withAlpha(theme.colors.statusPending, 0.08),
              borderRadius: theme.borderRadius.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
              <Ionicons name="hourglass-outline" size={12} color={theme.colors.statusPending} />
              <Text style={[theme.typography.caption, { color: theme.colors.statusPending, fontSize: 11 }]}>
                − {fmtAmt(item.pendingPayout)} {t('ledger.pendingOutgoing')}
              </Text>
            </View>
          )}
          {item.committedPayout > 0 && (
            <View style={{
              marginTop: theme.spacing.sm,
              backgroundColor: withAlpha('#f59e0b', 0.08),
              borderRadius: theme.borderRadius.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
              <Ionicons name="time-outline" size={12} color="#f59e0b" />
              <Text style={[theme.typography.caption, { color: '#f59e0b', fontSize: 11 }]}>
                − {fmtAmt(item.committedPayout)} {t('ledger.approvedReady')}
              </Text>
            </View>
          )}
        </AppCard>
      </TouchableOpacity>
    );
  };

  const TotalRow = () => (
    <AppCard style={{
      marginTop: theme.spacing.sm,
      borderWidth: 1.5,
      borderColor: withAlpha(statusColor, 0.4),
    }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}>
          <Ionicons
            name={isDeficit ? 'alert-circle' : 'checkmark-circle'}
            size={20}
            color={statusColor}
          />
          <View>
            <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('ledger.netTotal')}</Text>
            <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '600' }]}>
              {isDeficit
                ? t('ledger.deficit')
                : totals.effective === 0
                  ? t('ledger.booksBalanced')
                  : t('ledger.commRetained')}
            </Text>
          </View>
        </View>

        {/* Totals */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>ACTUAL</Text>
            <Text style={{ color: amtColor(totals.actual, theme), fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
              {fmtAmtSigned(totals.actual)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9 }]}>EFFECTIVE</Text>
            <Text style={{ color: amtColor(totals.effective, theme), fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
              {fmtAmtSigned(totals.effective)}
            </Text>
          </View>
        </View>
      </View>

      {/* Commission explanation when net is positive */}
      {totals.effective > 0 && (
        <View style={{
          backgroundColor: withAlpha(theme.colors.success, 0.08),
          borderRadius: theme.borderRadius.sm,
          padding: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: (totals.pending > 0 || totals.committed > 0) ? 4 : 0,
        }}>
          <Ionicons name="cash-outline" size={13} color={theme.colors.success} />
          <Text style={[theme.typography.caption, { color: theme.colors.success }]}>
            + {fmtAmt(totals.effective)} {t('ledger.commRetainedLabel')}
          </Text>
        </View>
      )}

      {totals.pending > 0 && (
        <View style={{
          backgroundColor: withAlpha(theme.colors.statusPending, 0.08),
          borderRadius: theme.borderRadius.sm,
          padding: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: totals.committed > 0 ? 4 : 0,
        }}>
          <Ionicons name="hourglass-outline" size={13} color={theme.colors.statusPending} />
          <Text style={[theme.typography.caption, { color: theme.colors.statusPending }]}>
            − {fmtAmt(totals.pending)} {t('ledger.totalPending')}
          </Text>
        </View>
      )}
      {totals.committed > 0 && (
        <View style={{
          backgroundColor: withAlpha('#f59e0b', 0.08),
          borderRadius: theme.borderRadius.sm,
          padding: theme.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <Ionicons name="time-outline" size={13} color="#f59e0b" />
          <Text style={[theme.typography.caption, { color: '#f59e0b' }]}>
            − {fmtAmt(totals.committed)} {t('ledger.totalApproved')}
          </Text>
        </View>
      )}
    </AppCard>
  );

  return (
    <FlatList
      data={branches}
      keyExtractor={(item: any) => String(item.id)}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      renderItem={renderBranch}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load'} onRetry={refetch} />}
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} · {t('branch.tapHint')}
          </Text>
        </>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="business-outline" size={48} color={withAlpha(theme.colors.textSecondary, 0.38)} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 12 }]}>
            {t('ledger.noBranches')}
          </Text>
        </View>
      }
      ListFooterComponent={branches.length > 0 ? <TotalRow /> : null}
    />
  );
}
