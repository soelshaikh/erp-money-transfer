import React, { useState, useLayoutEffect } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { reportApi, downloadReport } from '../api/reportApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt } from '../../../utils/fmt';
import { showToast } from '../../../utils/toast';

export function CashPositionScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['cashPosition'],
    queryFn: () => (reportApi as any).getCashPosition(),
  });

  const branches: any[] = (data as any)?.branches || [];
  const totals: any = (data as any)?.totals || {};

  // Refresh button in navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => refetch()}
          style={{ marginRight: 16, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFetching ? 'sync' : 'refresh-outline'}
            size={22}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, refetch, isFetching, theme.colors.primary]);

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'cash-position' });
    } catch (err: any) {
      showToast('error', 'Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading cash position..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={branches}
        keyExtractor={(item: any) => item.branchId ?? item.branchCode ?? String(Math.random())}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
        ListHeaderComponent={() => (
          <>
            {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load cash position'} onRetry={refetch} />}

            {/* Summary Card */}
            {Object.keys(totals).length > 0 && (
              <AppCard style={{
                marginBottom: theme.spacing.md,
                backgroundColor: withAlpha(theme.colors.primary, 0.06),
              }}>
                <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                  Total Cash Position
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Actual Balance</Text>
                    <Text style={[theme.typography.label, { color: theme.colors.primary }]} allowFontScaling={false}>
                      {fmtAmt(totals.actualBalance ?? 0)}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Effective Balance</Text>
                    <Text style={[theme.typography.label, { color: theme.colors.success }]} allowFontScaling={false}>
                      {fmtAmt(totals.effectiveBalance ?? 0)}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>Committed</Text>
                    <Text style={[theme.typography.label, { color: theme.colors.warning }]} allowFontScaling={false}>
                      {fmtAmt(totals.committedPayout ?? 0)}
                    </Text>
                  </View>
                </View>
              </AppCard>
            )}

            {branches.length > 0 && (
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
                Branch Positions
              </Text>
            )}
          </>
        )}
        renderItem={({ item }: { item: any }) => (
          <AppCard style={{ marginBottom: theme.spacing.sm }}>
            {/* Branch header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.label, { color: theme.colors.text }]}>{item.branchName}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{item.branchCode}</Text>
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.primary }]} allowFontScaling={false}>
                {fmtAmt(item.actualBalance ?? 0)}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm }} />

            {/* Balance breakdown */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Effective</Text>
                <Text style={[theme.typography.label, { color: theme.colors.success }]} allowFontScaling={false}>
                  {fmtAmt(item.effectiveBalance ?? 0)}
                </Text>
              </View>
              {(item.committedPayout ?? 0) > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Committed</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.warning }]} allowFontScaling={false}>
                    {fmtAmt(item.committedPayout)}
                  </Text>
                </View>
              )}
              {(item.pendingPayout ?? 0) > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Pending</Text>
                  <Text style={[theme.typography.label, { color: '#F59E0B' }]} allowFontScaling={false}>
                    {fmtAmt(item.pendingPayout)}
                  </Text>
                </View>
              )}
              {(item.payoutCompleted ?? 0) > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Paid Out</Text>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]} allowFontScaling={false}>
                    {fmtAmt(item.payoutCompleted)}
                  </Text>
                </View>
              )}
            </View>
          </AppCard>
        )}
        ListEmptyComponent={() => (
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
              <Ionicons name="wallet-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm }]}>
                No branch data available
              </Text>
            </View>
          ) : null
        )}
        ListFooterComponent={() => (
          <View style={{ marginTop: theme.spacing.md }}>
            <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Export</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <AppButton title="PDF" variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
              <AppButton title="Excel" variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
              <AppButton title="CSV" variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      />
    </View>
  );
}
