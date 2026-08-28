import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/TenantThemeProvider';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { withAlpha } from '../utils/colors';
import { BadgeCount } from '../shared/components/BadgeCount';
import { fmtAmt, fmtAmtSigned } from '../utils/fmt';

// Screens — common
import { DashboardScreen } from '../features/dashboard/screens/DashboardScreen';
import { TransactionListScreen } from '../features/transaction/screens/TransactionListScreen';
import { TransactionDetailScreen } from '../features/transaction/screens/TransactionDetailScreen';
import { CreateTransactionScreen } from '../features/transaction/screens/CreateTransactionScreen';
import { ShakhaEntryScreen } from '../features/transaction/screens/ShakhaEntryScreen';
import { CompletePaymentScreen } from '../features/transaction/screens/CompletePaymentScreen';
import { CompleteByTokenScreen } from '../features/transaction/screens/CompleteByTokenScreen';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { EditSettingsScreen } from '../features/settings/screens/EditSettingsScreen';
import { DaySignOffsScreen } from '../features/signOff/screens/DaySignOffsScreen';

// Screens — head office
import { BranchListScreen } from '../features/branch/screens/BranchListScreen';
import { CreateBranchScreen } from '../features/branch/screens/CreateBranchScreen';
import { BranchLedgerScreen } from '../features/branch/screens/BranchLedgerScreen';
import { BranchDailyBalancesScreen } from '../features/branch/screens/BranchDailyBalancesScreen';
import { EditBranchCommissionScreen } from '../features/branch/screens/EditBranchCommissionScreen';
import { UserListScreen } from '../features/user/screens/UserListScreen';
import { CreateUserScreen } from '../features/user/screens/CreateUserScreen';
import { UserDevicesScreen } from '../features/user/screens/UserDevicesScreen';
import { DeviceApprovalsScreen } from '../features/user/screens/DeviceApprovalsScreen';

// Screens — wallet / statement
import { MyStatementScreen } from '../features/branch/screens/MyStatementScreen';
import { BalanceSummaryScreen } from '../features/branch/screens/BalanceSummaryScreen';

// Screens — commission
import { CommissionDetailScreen } from '../features/transaction/screens/CommissionDetailScreen';
import { CommissionSummaryScreen } from '../features/transaction/screens/CommissionSummaryScreen';
import { CommissionPayablesScreen } from '../features/branch/screens/CommissionPayablesScreen';
import { CommissionSettlementsScreen } from '../features/branch/screens/CommissionSettlementsScreen';
import { CommissionSettlementDetailScreen } from '../features/branch/screens/CommissionSettlementDetailScreen';

// Screens — super admin
import { TenantListScreen } from '../features/tenant/screens/TenantListScreen';
import { TenantDetailScreen } from '../features/tenant/screens/TenantDetailScreen';
import { TenantStaffScreen } from '../features/tenant/screens/TenantStaffScreen';
import { RegisterCompanyScreen } from '../features/tenant/screens/RegisterCompanyScreen';
import { CreateHeadOfficeScreen } from '../features/tenant/screens/CreateHeadOfficeScreen';
import { AppAccessRequestsScreen } from '../features/tenant/screens/AppAccessRequestsScreen';
import { ExternalAccountListScreen } from '../features/branch/screens/ExternalAccountListScreen';
import { ExternalAccountDetailScreen } from '../features/branch/screens/ExternalAccountDetailScreen';

// Screens — HQ commission
import { HQCommissionItemsScreen } from '../features/hqCommission/screens/HQCommissionItemsScreen';
import { HQCommissionSettlementsScreen } from '../features/hqCommission/screens/HQCommissionSettlementsScreen';
import { HQCommissionSettlementDetailScreen } from '../features/hqCommission/screens/HQCommissionSettlementDetailScreen';

// Screens — notifications & reports
import { NotificationsScreen } from '../features/notifications/screens/NotificationsScreen';
import { ReportsScreen } from '../features/reports/screens/ReportsScreen';
import { ReportTransactionsScreen } from '../features/reports/screens/ReportTransactionsScreen';
import { LoginActivityScreen } from '../features/reports/screens/LoginActivityScreen';
import { ActivityLogScreen } from '../features/audit/screens/ActivityLogScreen';
import { DailyReportScreen } from '../features/reports/screens/DailyReportScreen';
import { PendingQueueScreen } from '../features/reports/screens/PendingQueueScreen';
import { OutstandingPaymentsScreen } from '../features/reports/screens/OutstandingPaymentsScreen';
import { RejectedTransactionsScreen } from '../features/reports/screens/RejectedTransactionsScreen';
import { BranchCollectionReportScreen } from '../features/reports/screens/BranchCollectionReportScreen';
import { BranchFlowMatrixScreen } from '../features/reports/screens/BranchFlowMatrixScreen';
import { DailyTallyScreen } from '../features/reports/screens/DailyTallyScreen';
import { AllBranchBalancesScreen } from '../features/reports/screens/AllBranchBalancesScreen';
import { CashPositionScreen } from '../features/reports/screens/CashPositionScreen';
import { StaffReportScreen } from '../features/reports/screens/StaffReportScreen';
import { CommissionOverrideReportScreen } from '../features/reports/screens/CommissionOverrideReportScreen';
import { PeriodComparisonScreen } from '../features/reports/screens/PeriodComparisonScreen';
import { PaymentMethodReportScreen } from '../features/reports/screens/PaymentMethodReportScreen';

// APIs for wallet chip data
import { dashboardApi } from '../features/dashboard/api/dashboardApi';
import { branchApi } from '../features/branch/api/branchApi';
import { transactionApi } from '../features/transaction/api/transactionApi';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HEAD_OFFICE: 'head_office',
  BRANCH: 'branch',
};

// ── Wallet Chips ─────────────────────────────────────────────────────────────

function BranchWalletChip({ theme }: { theme: any }) {
  const navigation = useNavigation<any>();
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const actual: number = (data as any)?.balance ?? 0;
  const committed: number = (data as any)?.committedPayout ?? 0;
  const pending: number = (data as any)?.pendingPayout ?? 0;
  const onHold: number = committed + pending;
  const holdColor = onHold > 0 ? theme.colors.statusPending : theme.colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('MyStatement')}
      style={{
        backgroundColor: withAlpha(theme.colors.primary, 0.08),
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignItems: 'flex-end',
        marginRight: 4,
      }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9, lineHeight: 12 }]}>
            ACTUAL
          </Text>
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12, lineHeight: 15 }} allowFontScaling={false}>
            {fmtAmt(actual)}
          </Text>
        </View>
        <View style={{ width: 1, height: 24, backgroundColor: theme.colors.divider }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9, lineHeight: 12 }]}>
            ON HOLD
          </Text>
          <Text style={{ color: holdColor, fontWeight: '700', fontSize: 12, lineHeight: 15 }} allowFontScaling={false}>
            {onHold > 0 ? '− ' : ''}{fmtAmt(onHold)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function HeadOfficeWalletChip({ theme }: { theme: any }) {
  const navigation = useNavigation<any>();
  const { data } = useQuery({ queryKey: ['balance-summary'], queryFn: branchApi.getBalanceSummary });
  const totals = (data as any)?.totals || { actual: 0, effective: 0 };
  // Positive effective = retained commission (normal). Only negative = real deficit.
  const isDeficit = totals.effective < 0;
  const netColor = isDeficit ? theme.colors.error : theme.colors.success;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('BalanceSummary')}
      style={{
        backgroundColor: withAlpha(netColor, 0.08),
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignItems: 'flex-end',
        marginRight: 4,
      }}
      activeOpacity={0.7}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9, lineHeight: 12 }]}>
        NET BALANCE
      </Text>
      <Text style={{ color: netColor, fontWeight: '700', fontSize: 12, lineHeight: 15 }} allowFontScaling={false}>
        {fmtAmtSigned(totals.effective)}
      </Text>
      <Text style={[theme.typography.caption, { color: netColor, fontSize: 9, lineHeight: 11 }]}>
        {isDeficit ? 'Deficit !' : 'Balanced ✓'}
      </Text>
    </TouchableOpacity>
  );
}

function CommissionChip({ theme, isBranch }: { theme: any; isBranch: boolean }) {
  const navigation = useNavigation<any>();
  const { data } = useQuery({
    queryKey: ['commission-summary'],
    queryFn: () => transactionApi.getCommissionSummary(),
  });
  const grandTotal = (data as any)?.grandTotal || { totalCommission: 0 };
  const amount: number = grandTotal.totalCommission;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate(isBranch ? 'CommissionDetail' : 'CommissionSummary')}
      style={{
        backgroundColor: withAlpha(theme.colors.secondary, 0.08),
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignItems: 'flex-end',
        marginRight: 4,
      }}
      activeOpacity={0.7}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 9, lineHeight: 12 }]}>
        COMM.
      </Text>
      <Text style={{ color: theme.colors.secondary, fontWeight: '700', fontSize: 12, lineHeight: 15 }} allowFontScaling={false}>
        {fmtAmt(amount)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Dashboard Stack ───────────────────────────────────────────────────────────

function DashboardHeaderRight({ theme, isBranch, isHeadOffice }: { theme: any; isBranch: boolean; isHeadOffice: boolean }) {
  const navigation = useNavigation<any>();
  const unreadCount = useNotificationStore((s: any) => s.unreadCount);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 }}>
      {isBranch && <BranchWalletChip theme={theme} />}
      {isHeadOffice && <HeadOfficeWalletChip theme={theme} />}
      {(isBranch || isHeadOffice) && <CommissionChip theme={theme} isBranch={isBranch} />}
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={{ padding: 4 }}
      >
        <View>
          <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
          <BadgeCount count={unreadCount} color={theme.colors.error} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function DashboardStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isBranch = role === ROLES.BRANCH;
  const isHeadOffice = role === ROLES.HEAD_OFFICE;

  const s = {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.primary,
  };

  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{
          title: theme.appName || 'Dashboard',
          headerRight: () => <DashboardHeaderRight theme={theme} isBranch={isBranch} isHeadOffice={isHeadOffice} />,
        }}
      />
      {isBranch && (
        <Stack.Screen
          name="MyStatement"
          component={MyStatementScreen}
          options={{ title: t('nav.myStatement') }}
        />
      )}
      {isHeadOffice && (
        <>
          <Stack.Screen
            name="BalanceSummary"
            component={BalanceSummaryScreen}
            options={{ title: t('nav.balanceSummary') }}
          />
          <Stack.Screen
            name="BranchLedger"
            component={BranchLedgerScreen}
            options={({ route }: any) => ({ title: `${route.params?.branchName || t('nav.branches')} Statement` })}
          />
          <Stack.Screen
            name="BranchDailyBalances"
            component={BranchDailyBalancesScreen}
            options={({ route }: any) => ({ title: `${route.params?.branchName || t('nav.branches')} — ${t('nav.dailyHistory')}` })}
          />
          <Stack.Screen
            name="CommissionSummary"
            component={CommissionSummaryScreen}
            options={{ title: t('nav.commissionSummary') }}
          />
        </>
      )}
      {(isBranch || isHeadOffice) && (
        <Stack.Screen
          name="CommissionDetail"
          component={CommissionDetailScreen}
          options={({ route }: any) => ({
            title: route.params?.branchName ? `${route.params.branchName} — ${t('nav.commission')}` : t('nav.commissionDetail'),
          })}
        />
      )}
      {(isBranch || isHeadOffice) && (
        <>
          <Stack.Screen
            name="CommissionPayables"
            component={CommissionPayablesScreen}
            options={{ title: t('nav.commissionPayables') }}
          />
          <Stack.Screen
            name="CommissionSettlements"
            component={CommissionSettlementsScreen}
            options={{ title: t('nav.commissionSettlements') }}
          />
          <Stack.Screen
            name="CommissionSettlementDetail"
            component={CommissionSettlementDetailScreen}
            options={{ title: 'Settlement Detail' }}
          />
          <Stack.Screen
            name="HQCommissionItems"
            component={HQCommissionItemsScreen}
            options={{ title: t('nav.hqCommissionItems') }}
          />
          <Stack.Screen
            name="HQCommissionSettlements"
            component={HQCommissionSettlementsScreen}
            options={{ title: t('nav.hqCommissionSettlements') }}
          />
          <Stack.Screen
            name="HQCommissionSettlementDetail"
            component={HQCommissionSettlementDetailScreen}
            options={{ title: t('nav.hqCommissionDetail') }}
          />
        </>
      )}
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: t('nav.transactionDetails') }}
      />
    </Stack.Navigator>
  );
}

// ── Other Stacks ──────────────────────────────────────────────────────────────

function TransactionStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="TransactionList" component={TransactionListScreen} options={{ title: t('nav.transactions') }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: t('nav.transactionDetails') }} />
      <Stack.Screen name="CreateTransaction" component={CreateTransactionScreen} options={{ title: t('txn.newEntry') }} />
      <Stack.Screen name="ShakhaEntry" component={ShakhaEntryScreen} options={{ title: t('txn.shakhaEntry') }} />
      <Stack.Screen name="CompletePayment" component={CompletePaymentScreen} options={{ title: t('txn.complete') }} />
      <Stack.Screen name="CompleteByToken" component={CompleteByTokenScreen} options={{ title: t('txn.complete') }} />
    </Stack.Navigator>
  );
}

function BranchStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="BranchList" component={BranchListScreen} options={{ title: t('nav.branches') }} />
      <Stack.Screen name="CreateBranch" component={CreateBranchScreen} options={{ title: t('nav.addBranch') }} />
      <Stack.Screen
        name="BranchLedger"
        component={BranchLedgerScreen}
        options={({ route }: any) => ({ title: `${route.params?.branchName || t('nav.branches')} Statement` })}
      />
      <Stack.Screen
        name="BranchDailyBalances"
        component={BranchDailyBalancesScreen}
        options={({ route }: any) => ({ title: `${route.params?.branchName || t('nav.branches')} — ${t('nav.dailyHistory')}` })}
      />
      <Stack.Screen
        name="EditBranchCommission"
        component={EditBranchCommissionScreen}
        options={({ route }: any) => ({ title: `${route.params?.branchName || t('nav.branches')} — ${t('nav.commission')}` })}
      />
      <Stack.Screen
        name="CommissionPayables"
        component={CommissionPayablesScreen}
        options={{ title: t('nav.commissionPayables') }}
      />
      <Stack.Screen
        name="CommissionSettlements"
        component={CommissionSettlementsScreen}
        options={{ title: t('nav.commissionSettlements') }}
      />
      <Stack.Screen
        name="CommissionSettlementDetail"
        component={CommissionSettlementDetailScreen}
        options={{ title: 'Settlement Detail' }}
      />
      <Stack.Screen
        name="HQCommissionItems"
        component={HQCommissionItemsScreen}
        options={{ title: t('nav.hqCommissionItems') }}
      />
      <Stack.Screen
        name="HQCommissionSettlements"
        component={HQCommissionSettlementsScreen}
        options={{ title: t('nav.hqCommissionSettlements') }}
      />
      <Stack.Screen
        name="HQCommissionSettlementDetail"
        component={HQCommissionSettlementDetailScreen}
        options={{ title: t('nav.hqCommissionDetail') }}
      />
    </Stack.Navigator>
  );
}

function PartnersStack() {
  const theme = useTheme();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="ExternalAccountList" component={ExternalAccountListScreen} options={{ title: 'Partners' }} />
      <Stack.Screen
        name="ExternalAccountDetail"
        component={ExternalAccountDetailScreen}
        options={({ route }: any) => ({ title: route.params?.accountName || 'Partner Detail' })}
      />
    </Stack.Navigator>
  );
}

function UserStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="UserList" component={UserListScreen} options={{ title: t('nav.staff') }} />
      <Stack.Screen name="CreateUser" component={CreateUserScreen} options={{ title: t('nav.addStaff') }} />
      <Stack.Screen
        name="UserDevices"
        component={UserDevicesScreen}
        options={({ route }: any) => ({ title: `${route.params?.userName || t('nav.staff')} — ${t('nav.devices')}` })}
      />
      <Stack.Screen
        name="DeviceApprovals"
        component={DeviceApprovalsScreen}
        options={{ title: 'Device Approvals' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} options={{ title: t('nav.settings') }} />
      <Stack.Screen name="EditSettings" component={EditSettingsScreen} options={{ title: t('nav.editSettings') }} />
      <Stack.Screen name="LoginActivity" component={LoginActivityScreen} options={{ title: t('nav.loginActivity') }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: t('nav.auditLog') }} />
      <Stack.Screen name="DaySignOffs" component={DaySignOffsScreen} options={{ title: t('signOff.staffSignOffs') }} />
      <Stack.Screen name="HQCommissionItems" component={HQCommissionItemsScreen} options={{ title: t('nav.hqCommissionItems') }} />
      <Stack.Screen name="HQCommissionSettlements" component={HQCommissionSettlementsScreen} options={{ title: t('nav.hqCommissionSettlements') }} />
      <Stack.Screen name="HQCommissionSettlementDetail" component={HQCommissionSettlementDetailScreen} options={{ title: t('nav.hqCommissionDetail') }} />
    </Stack.Navigator>
  );
}

function TenantStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="TenantList" component={TenantListScreen} options={{ title: t('nav.companies') }} />
      <Stack.Screen name="RegisterCompany" component={RegisterCompanyScreen} options={{ title: t('nav.registerCompany') }} />
      <Stack.Screen name="TenantDetail" component={TenantDetailScreen} options={{ title: t('nav.companyDetails') }} />
      <Stack.Screen name="CreateHeadOffice" component={CreateHeadOfficeScreen} options={{ title: t('nav.createHOAccount') }} />
      <Stack.Screen
        name="TenantStaff"
        component={TenantStaffScreen}
        options={({ route }: any) => ({ title: `${route.params?.tenantName || t('nav.companies')} — ${t('nav.staff')}` })}
      />
      <Stack.Screen
        name="UserDevices"
        component={UserDevicesScreen}
        options={({ route }: any) => ({ title: `${route.params?.userName || t('nav.staff')} — ${t('nav.devices')}` })}
      />
      <Stack.Screen name="AppAccessRequests" component={AppAccessRequestsScreen} options={{ title: 'App Access Requests' }} />
    </Stack.Navigator>
  );
}

function ReportsStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="ReportsMain" component={ReportsScreen} options={{ title: t('nav.reports') }} />
      <Stack.Screen
        name="ReportTransactions"
        component={ReportTransactionsScreen}
        options={({ route }: any) => ({ title: route.params?.title || 'Transactions' })}
      />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: t('nav.transactionDetails') }} />
      <Stack.Screen name="LoginActivity" component={LoginActivityScreen} options={{ title: t('nav.loginActivity') }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: t('nav.auditLog') }} />
      <Stack.Screen name="DailyReport" component={DailyReportScreen} options={{ title: 'Daily Report' }} />
      <Stack.Screen name="PendingQueue" component={PendingQueueScreen} options={{ title: 'Pending Approval Queue' }} />
      <Stack.Screen name="OutstandingPayments" component={OutstandingPaymentsScreen} options={{ title: 'Outstanding Payments' }} />
      <Stack.Screen name="RejectedTransactions" component={RejectedTransactionsScreen} options={{ title: 'Rejected Transactions' }} />
      <Stack.Screen name="BranchCollectionReport" component={BranchCollectionReportScreen} options={{ title: 'Branch Collection Report' }} />
      <Stack.Screen name="BranchFlowMatrix" component={BranchFlowMatrixScreen} options={{ title: 'Branch Flow Matrix' }} />
      <Stack.Screen name="DailyTally" component={DailyTallyScreen} options={{ title: 'Daily Balance Tally' }} />
      <Stack.Screen name="AllBranchBalances" component={AllBranchBalancesScreen} options={{ title: 'All Branch Balances' }} />
      <Stack.Screen name="CashPosition" component={CashPositionScreen} options={{ title: 'Cash Position' }} />
      <Stack.Screen name="StaffReport" component={StaffReportScreen} options={{ title: 'Staff Report' }} />
      <Stack.Screen name="CommissionOverrideReport" component={CommissionOverrideReportScreen} options={{ title: 'Commission Overrides' }} />
      <Stack.Screen name="PeriodComparison" component={PeriodComparisonScreen} options={{ title: 'Period Comparison' }} />
      <Stack.Screen name="PaymentMethodReport" component={PaymentMethodReportScreen} options={{ title: 'Payment Methods' }} />
    </Stack.Navigator>
  );
}

function NotificationsStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = { headerStyle: { backgroundColor: theme.colors.surface }, headerTintColor: theme.colors.primary };
  return (
    <Stack.Navigator screenOptions={s}>
      <Stack.Screen name="NotificationsMain" component={NotificationsScreen} options={{ title: t('nav.notifications') }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: t('nav.transactionDetails') }} />
    </Stack.Navigator>
  );
}

// ── Tab Navigator ─────────────────────────────────────────────────────────────

export function MainNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s: any) => s.unreadCount);
  const role = user?.role;

  const tabBarStyle = {
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textSecondary,
    tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
  };

  const icon = (name: string) => ({ focused }: { focused: boolean }) => (
    <Ionicons
      name={focused ? name : (`${name}-outline` as any)}
      size={24}
      color={focused ? theme.colors.primary : theme.colors.textSecondary}
    />
  );

  const notificationsIcon = ({ focused }: { focused: boolean }) => (
    <View>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
        size={24}
        color={focused ? theme.colors.primary : theme.colors.textSecondary}
      />
      <BadgeCount count={unreadCount} color={theme.colors.error} />
    </View>
  );

  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const isHeadOffice = role === ROLES.HEAD_OFFICE;
  const isBranch = role === ROLES.BRANCH;

  return (
    <Tab.Navigator screenOptions={{ headerShown: false, ...tabBarStyle }}>
      {/* Dashboard — all roles; wallet chip lives inside DashboardStack */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ title: t('nav.dashboard'), tabBarIcon: icon('grid') }}
      />

      {(isHeadOffice || isBranch) && (
        <Tab.Screen
          name="Transactions"
          component={TransactionStack}
          options={{ title: t('nav.transactions'), tabBarIcon: icon('swap-horizontal') }}
        />
      )}

      {isHeadOffice && (
        <Tab.Screen
          name="Branches"
          component={BranchStack}
          options={{ title: t('nav.branches'), tabBarIcon: icon('business') }}
        />
      )}

      {isHeadOffice && (
        <Tab.Screen
          name="Users"
          component={UserStack}
          options={{ title: t('nav.staff'), tabBarIcon: icon('person') }}
        />
      )}

      {isHeadOffice && (
        <Tab.Screen
          name="Reports"
          component={ReportsStack}
          options={{ title: t('nav.reports'), tabBarIcon: icon('bar-chart') }}
        />
      )}

      {(isHeadOffice || isBranch) && (
        <Tab.Screen
          name="Partners"
          component={PartnersStack}
          options={{ title: 'Partners', tabBarIcon: icon('people') }}
        />
      )}

      {isSuperAdmin && (
        <Tab.Screen
          name="Companies"
          component={TenantStack}
          options={{ title: t('nav.companies'), tabBarIcon: icon('business') }}
        />
      )}

      {(isHeadOffice || isBranch) && (
        <Tab.Screen
          name="Notifications"
          component={NotificationsStack}
          options={{
            title: t('nav.notifications'),
            tabBarIcon: notificationsIcon,
          }}
        />
      )}

      <Tab.Screen
        name="Settings"
        component={SettingsStack}
        options={{ title: t('nav.settings'), tabBarIcon: icon('settings') }}
      />
    </Tab.Navigator>
  );
}
