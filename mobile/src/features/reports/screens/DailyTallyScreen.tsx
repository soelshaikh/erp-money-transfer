import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import { fmtAmt, fmtAmtSigned, fmtDate } from '../../../utils/fmt';
import { todayIST } from '../../../utils/dateIST';

export function DailyTallyScreen() {
  const theme = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const today = todayIST();
  const [dateInput, setDateInput] = useState<string>(today);
  const [activeDate, setActiveDate] = useState<string>(today);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dailyTally', activeDate],
    queryFn: () => (reportApi as any).getDailyTally({ date: activeDate }),
  });

  const tally: any = data ?? {};
  const branchRows: any[] = tally.branches || [];
  const isBalanced: boolean = tally.isBalanced ?? true;
  const netTotal: number = tally.netTotal ?? 0;
  const totalOpening: number = tally.totalOpeningBalance ?? 0;
  const totalClosing: number = tally.totalClosingBalance ?? 0;

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      await downloadReport({ format, reportType: 'daily-tally', date: activeDate });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading daily tally..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: tabBarHeight + theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      {/* Date Input */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Date</Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            padding: 8,
            color: theme.colors.text,
            fontSize: 13,
            marginBottom: theme.spacing.sm,
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textSecondary}
          value={dateInput}
          onChangeText={setDateInput}
        />
        <TouchableOpacity
          onPress={() => setActiveDate(dateInput)}
          style={{ backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: theme.colors.textOnPrimary, fontWeight: '600' }}>Apply</Text>
        </TouchableOpacity>
      </AppCard>

      {isError && <ErrorMessage message={parseApiError(error) ?? 'Failed to load tally'} onRetry={refetch} />}

      {/* Net Total Card */}
      {Object.keys(tally).length > 0 && (
        <>
          <View style={{
            borderRadius: theme.borderRadius.lg,
            backgroundColor: isBalanced ? theme.colors.success : theme.colors.error,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.md,
            alignItems: 'center',
          }}>
            <Text style={[theme.typography.caption, { color: theme.colors.surface, opacity: 0.85, marginBottom: 4 }]}>
              NET TOTAL — {tally.date ? fmtDate(tally.date) : activeDate}
            </Text>
            <Text style={[theme.typography.h1, { color: theme.colors.surface }]} allowFontScaling={false}>
              {fmtAmtSigned(netTotal)}
            </Text>
            <View style={{
              marginTop: theme.spacing.sm,
              backgroundColor: withAlpha(theme.colors.surface, 0.2),
              borderRadius: theme.borderRadius.full,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}>
              <Text style={[theme.typography.caption, { color: theme.colors.surface, fontWeight: '600' }]}>
                {isBalanced ? 'BALANCED' : 'OUT OF BALANCE'}
              </Text>
            </View>
          </View>

          {/* Opening / Closing Summary */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Total Opening</Text>
              <Text style={[theme.typography.label, { color: theme.colors.text }]} allowFontScaling={false}>
                {fmtAmt(totalOpening)}
              </Text>
            </AppCard>
            <AppCard style={{ flex: 1, alignItems: 'center', padding: theme.spacing.sm }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>Total Closing</Text>
              <Text style={[theme.typography.label, { color: theme.colors.text }]} allowFontScaling={false}>
                {fmtAmt(totalClosing)}
              </Text>
            </AppCard>
          </View>

          {/* Branch Rows */}
          {branchRows.length > 0 && (
            <>
              <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Branch Breakdown</Text>
              <AppCard style={{ padding: 0, marginBottom: theme.spacing.md }}>
                {/* Header */}
                <View style={{
                  flexDirection: 'row',
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.sm,
                  backgroundColor: withAlpha(theme.colors.primary, 0.08),
                  borderTopLeftRadius: theme.borderRadius.md,
                  borderTopRightRadius: theme.borderRadius.md,
                }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1, fontWeight: '600' }]}>Branch</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Opening</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Closing</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right', fontWeight: '600' }]}>Change</Text>
                </View>
                <FlatList
                  data={branchRows}
                  keyExtractor={(item: any) => item.branchId ?? item.branchCode ?? String(Math.random())}
                  scrollEnabled={false}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  initialNumToRender={10}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item, index }: { item: any; index: number }) => {
                    const change = (item.closingBalance ?? 0) - (item.openingBalance ?? 0);
                    const changeColor = change > 0 ? theme.colors.success : change < 0 ? theme.colors.error : theme.colors.textSecondary;
                    return (
                      <View style={{
                        flexDirection: 'row',
                        paddingVertical: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.sm,
                        backgroundColor: index % 2 === 1 ? withAlpha(theme.colors.primary, 0.06) : 'transparent',
                        alignItems: 'center',
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[theme.typography.caption, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
                            {item.branchCode ?? '—'}
                          </Text>
                          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]} numberOfLines={1}>
                            {item.branchName ?? '—'}
                          </Text>
                        </View>
                        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 2, textAlign: 'right' }]} allowFontScaling={false}>
                          {fmtAmt(item.openingBalance ?? 0)}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.text, flex: 2, textAlign: 'right' }]} allowFontScaling={false}>
                          {fmtAmt(item.closingBalance ?? 0)}
                        </Text>
                        <Text style={[theme.typography.caption, { color: changeColor, flex: 2, textAlign: 'right', fontWeight: '600' }]} allowFontScaling={false}>
                          {fmtAmtSigned(change)}
                        </Text>
                      </View>
                    );
                  }}
                />
              </AppCard>
            </>
          )}
        </>
      )}

      {/* Export */}
      <View style={{ marginTop: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>Export</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <AppButton title="PDF" variant="outline" onPress={() => handleExport('pdf')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
          <AppButton title="Excel" variant="outline" onPress={() => handleExport('excel')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
          <AppButton title="CSV" variant="outline" onPress={() => handleExport('csv')} loading={isExporting} disabled={isExporting} style={{ flex: 1 }} />
        </View>
      </View>
    </ScrollView>
  );
}
