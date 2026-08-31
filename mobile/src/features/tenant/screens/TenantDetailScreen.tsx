import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Alert, RefreshControl, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { showToast } from '../../../utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { AppActionSheet } from '../../../shared/components/AppActionSheet';
import { ConfirmSheet } from '../../../shared/components/ConfirmSheet';
import { ActionList, ActionItem } from '../../../shared/components/ActionList';
import { SegmentControl } from '../../../shared/components/SegmentControl';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt, fmtDate } from '../../../utils/fmt';
import { withAlpha } from '../../../utils/colors';
import { Ionicons } from '@expo/vector-icons';

const STATUS_COLORS: { [key: string]: string } = {
  active: 'success',
  inactive: 'textSecondary',
  suspended: 'error',
};

type TabKey = 'info' | 'settings' | 'actions';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'settings', label: 'Settings' },
  { key: 'actions', label: 'Actions' },
];

function TabBar({ active, onChange, theme }: { active: TabKey; onChange: (k: TabKey) => void; theme: any }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.borderRadius.md,
      padding: 3,
      marginBottom: theme.spacing.md,
    }}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: theme.borderRadius.sm,
              alignItems: 'center',
              backgroundColor: isActive ? theme.colors.surface : 'transparent',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isActive ? 0.08 : 0,
              shadowRadius: 2,
              elevation: isActive ? 2 : 0,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: isActive ? '700' : '500', color: isActive ? theme.colors.primary : theme.colors.textSecondary }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: any; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.text, flex: 2, textAlign: 'right' }]}>{value || '—'}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={{ height: 1, backgroundColor: theme.colors.divider }} />;
}

function ToggleRow({ label, subtitle, value, onToggle, saving, theme }: any) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => !saving && onToggle(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: value ? withAlpha(theme.colors.primary, 0.07) : withAlpha(theme.colors.textSecondary, 0.06),
        borderWidth: 1,
        borderColor: value ? withAlpha(theme.colors.primary, 0.25) : theme.colors.divider,
      }}
    >
      <View style={{ flex: 1, marginRight: theme.spacing.md }}>
        <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>{label}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? theme.colors.primary : theme.colors.divider, justifyContent: 'center', paddingHorizontal: 2 }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.surface, alignSelf: value ? 'flex-end' : 'flex-start' }} />
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  route: any;
  navigation: any;
}

export function TenantDetailScreen({ route, navigation }: Props) {
  const { tenantId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showSuspendSheet, setShowSuspendSheet] = useState(false);
  const [showBizTypeSheet, setShowBizTypeSheet] = useState(false);

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const limitInputRef = useRef<TextInput>(null);

  const [showStaffLimitModal, setShowStaffLimitModal] = useState(false);
  const [newStaffLimit, setNewStaffLimit] = useState('');
  const staffLimitInputRef = useRef<TextInput>(null);

  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commType, setCommType] = useState<'flat' | 'percentage'>('flat');
  const [commValue, setCommValue] = useState('');
  const commValueRef = useRef<TextInput>(null);

  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitBranchPct, setSplitBranchPct] = useState('');
  const [splitHeadOfficePct, setSplitHeadOfficePct] = useState('');
  const splitBranchRef = useRef<TextInput>(null);
  const splitHoRef = useRef<TextInput>(null);

  const [showTxnLimitsModal, setShowTxnLimitsModal] = useState(false);
  const [maxAmountPerTxn, setMaxAmountPerTxn] = useState('');
  const [dailyLimitPerBranch, setDailyLimitPerBranch] = useState('');
  const maxAmountRef = useRef<TextInput>(null);
  const dailyLimitRef = useRef<TextInput>(null);

  // Inline validation errors for each modal (toasts don't work inside Modal — native layer blocks them)
  const [limitError, setLimitError] = useState('');
  const [staffLimitError, setStaffLimitError] = useState('');
  const [txnLimitsError, setTxnLimitsError] = useState('');
  const [commModalError, setCommModalError] = useState('');
  const [splitModalError, setSplitModalError] = useState('');

  const [showHoPasswordModal, setShowHoPasswordModal] = useState(false);
  const [hoNewPassword, setHoNewPassword] = useState('');
  const [hoShowPassword, setHoShowPassword] = useState(false);
  const hoPasswordRef = useRef<TextInput>(null);

  const [localExportFormats, setLocalExportFormats] = useState<string[]>(['csv', 'excel', 'pdf']);
  const [creditCommFlag, setCreditCommFlag] = useState(false);
  const [savingCreditCommFlag, setSavingCreditCommFlag] = useState(false);
  const [deviceApprovalFlag, setDeviceApprovalFlag] = useState(false);
  const [savingDeviceApproval, setSavingDeviceApproval] = useState(false);

  const { data: tenant, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantApi.getOne(tenantId),
  });

  const { data: hoUser, refetch: refetchHo } = useQuery({
    queryKey: ['tenant-ho', tenantId],
    queryFn: () => tenantApi.getHoUser(tenantId),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (tenant) {
      setLocalExportFormats((tenant as any)?.features?.exportFormats ?? ['csv', 'excel', 'pdf']);
      setCreditCommFlag((tenant as any)?.features?.creditCommissionToSendingBranch ?? false);
      setDeviceApprovalFlag((tenant as any)?.features?.deviceApprovalRequired ?? false);
    }
  }, [tenant]);

  useFocusEffect(useCallback(() => { refetchHo(); }, []));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
    qc.invalidateQueries({ queryKey: ['tenants'] });
    qc.invalidateQueries({ queryKey: ['tenant-ho', tenantId] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => tenantApi.updateStatus(tenantId, status),
    onSuccess: () => { invalidate(); showToast('success', 'Updated', 'Status updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update status'),
  });

  const businessTypeMutation = useMutation({
    mutationFn: (businessType: string) => tenantApi.updateBusinessType(tenantId, businessType),
    onSuccess: () => { invalidate(); showToast('success', 'Updated', 'Business type updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update business type'),
  });

  const branchLimitMutation = useMutation({
    mutationFn: (limit: number) => tenantApi.updateBranchLimit(tenantId, limit),
    onSuccess: () => { invalidate(); setShowLimitModal(false); setNewLimit(''); showToast('success', 'Updated', 'Branch limit updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update branch limit'),
  });

  const staffLimitMutation = useMutation({
    mutationFn: (limit: number) => tenantApi.updateStaffLimit(tenantId, limit),
    onSuccess: () => { invalidate(); setShowStaffLimitModal(false); setNewStaffLimit(''); showToast('success', 'Updated', 'Staff limit updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update staff limit'),
  });

  const txnLimitsMutation = useMutation({
    mutationFn: () => tenantApi.updateTransactionLimits(tenantId, {
      maxAmountPerTransaction: parseFloat(maxAmountPerTxn) || 0,
      dailyLimitPerBranch: parseFloat(dailyLimitPerBranch) || 0,
    }),
    onSuccess: () => { invalidate(); setShowTxnLimitsModal(false); showToast('success', 'Updated', 'Transaction limits updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update transaction limits'),
  });

  const commissionMutation = useMutation({
    mutationFn: (commission: { type: string; value: number }) => tenantApi.updateCommission(tenantId, commission),
    onSuccess: () => { invalidate(); setShowCommissionModal(false); setCommValue(''); showToast('success', 'Updated', 'Commission updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update commission'),
  });

  const commissionSplitMutation = useMutation({
    mutationFn: (commissionSplit: { branchPct: number; headOfficePct: number }) =>
      tenantApi.updateCommissionSplit(tenantId, commissionSplit),
    onSuccess: () => { invalidate(); setShowSplitModal(false); showToast('success', 'Updated', 'Commission split updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update commission split'),
  });

  const exportFormatsMutation = useMutation({
    mutationFn: () => tenantApi.updateExportFormats(tenantId, localExportFormats),
    onSuccess: () => { invalidate(); showToast('success', 'Updated', 'Export formats updated'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to update export formats'),
  });

  const resetHoPasswordMutation = useMutation({
    mutationFn: () => tenantApi.resetHoPassword(tenantId, hoNewPassword),
    onSuccess: () => {
      const pwd = hoNewPassword;
      setShowHoPasswordModal(false);
      setHoNewPassword('');
      setHoShowPassword(false);
      Alert.alert('Password Updated', `New password for head office:\n\n${pwd}\n\nShare this with the head office user.`);
    },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to reset password'),
  });

  const handleToggleDeviceApproval = async (newVal: boolean) => {
    setDeviceApprovalFlag(newVal);
    setSavingDeviceApproval(true);
    try {
      await tenantApi.updateDeviceApproval(tenantId, newVal);
      invalidate();
      showToast('success', 'Updated', 'Device approval setting saved');
    } catch (e: any) {
      setDeviceApprovalFlag(!newVal);
      showToast('error', 'Error', parseApiError(e) ?? 'Failed to update setting');
    } finally {
      setSavingDeviceApproval(false);
    }
  };

  const handleToggleCreditCommFlag = async (newVal: boolean) => {
    setCreditCommFlag(newVal);
    setSavingCreditCommFlag(true);
    try {
      await tenantApi.updateCreditCommissionFlag(tenantId, newVal);
      invalidate();
      showToast('success', 'Updated', 'Credit commission setting saved');
    } catch (e: any) {
      setCreditCommFlag(!newVal);
      showToast('error', 'Error', parseApiError(e) ?? 'Failed to update setting');
    } finally {
      setSavingCreditCommFlag(false);
    }
  };

  const toggleExportFormat = (fmt: string) => {
    setLocalExportFormats(prev =>
      prev.includes(fmt)
        ? prev.length > 1 ? prev.filter(f => f !== fmt) : prev
        : [...prev, fmt]
    );
  };

  const handleChangeStatus = () => {
    setShowStatusSheet(true);
  };

  const handleSuspend = () => {
    setShowSuspendSheet(true);
  };

  const handleChangeBusinessType = () => {
    setShowBizTypeSheet(true);
  };

  const handleOpenLimitModal = () => {
    setNewLimit(String((tenant as any)?.branchLimit ?? ''));
    setShowLimitModal(true);
    setTimeout(() => limitInputRef.current?.focus(), 300);
  };

  const handleSaveLimit = () => {
    setLimitError('');
    const parsed = parseInt(newLimit, 10);
    if (!newLimit.trim() || isNaN(parsed) || parsed < 1) { setLimitError('Enter a number of at least 1.'); return; }
    branchLimitMutation.mutate(parsed);
  };

  const handleOpenStaffLimitModal = () => {
    setNewStaffLimit(String((tenant as any)?.staffLimit ?? ''));
    setShowStaffLimitModal(true);
    setTimeout(() => staffLimitInputRef.current?.focus(), 300);
  };

  const handleSaveStaffLimit = () => {
    setStaffLimitError('');
    const parsed = parseInt(newStaffLimit, 10);
    if (!newStaffLimit.trim() || isNaN(parsed) || parsed < 1) { setStaffLimitError('Enter a number of at least 1.'); return; }
    staffLimitMutation.mutate(parsed);
  };

  const handleOpenTxnLimitsModal = () => {
    const limits = (tenant as any)?.settings?.transactionLimits;
    setMaxAmountPerTxn(String(limits?.maxAmountPerTransaction ?? 0));
    setDailyLimitPerBranch(String(limits?.dailyLimitPerBranch ?? 0));
    setShowTxnLimitsModal(true);
    setTimeout(() => maxAmountRef.current?.focus(), 300);
  };

  const handleOpenCommissionModal = () => {
    const currentComm = (tenant as any)?.settings?.commission;
    setCommType(currentComm?.type || 'flat');
    setCommValue(currentComm?.value != null ? String(currentComm.value) : '');
    setShowCommissionModal(true);
    setTimeout(() => commValueRef.current?.focus(), 300);
  };

  const handleSaveCommission = () => {
    setCommModalError('');
    const parsed = parseFloat(commValue);
    if (!commValue.trim() || isNaN(parsed) || parsed < 0) { setCommModalError('Enter a valid commission value (0 or more).'); return; }
    if (commType === 'percentage' && parsed > 100) { setCommModalError('Percentage cannot exceed 100.'); return; }
    commissionMutation.mutate({ type: commType, value: parsed });
  };

  const handleOpenSplitModal = () => {
    const split = (tenant as any)?.settings?.commissionSplit;
    setSplitBranchPct(split?.branchPct != null ? String(split.branchPct) : '');
    setSplitHeadOfficePct(split?.headOfficePct != null ? String(split.headOfficePct) : '');
    setShowSplitModal(true);
    setTimeout(() => splitBranchRef.current?.focus(), 300);
  };

  const handleSaveSplit = () => {
    setSplitModalError('');
    const branchPct = parseFloat(splitBranchPct);
    const headOfficePct = parseFloat(splitHeadOfficePct);
    if (!splitBranchPct.trim() || !splitHeadOfficePct.trim() || isNaN(branchPct) || isNaN(headOfficePct)) { setSplitModalError('Enter both percentages.'); return; }
    if (2 * branchPct + headOfficePct !== 100) { setSplitModalError('2 × Branch % + Head Office % must equal 100.'); return; }
    commissionSplitMutation.mutate({ branchPct, headOfficePct });
  };

  const handleSaveTxnLimits = () => {
    setTxnLimitsError('');
    const maxAmt = parseFloat(maxAmountPerTxn);
    const daily = parseFloat(dailyLimitPerBranch);
    if (maxAmountPerTxn.trim() && (isNaN(maxAmt) || maxAmt < 0)) {
      setTxnLimitsError('Enter a valid max transaction amount (0 = no limit).');
      return;
    }
    if (dailyLimitPerBranch.trim() && (isNaN(daily) || daily < 0)) {
      setTxnLimitsError('Enter a valid daily limit (0 = no limit).');
      return;
    }
    txnLimitsMutation.mutate();
  };

  const formatCommissionSplit = (settings: any) => {
    const split = settings?.commissionSplit;
    if (!split || split.branchPct == null || split.headOfficePct == null) return 'Not set';
    return `Branch ${split.branchPct}% · HO ${split.headOfficePct}%`;
  };

  const formatCommission = (settings: any) => {
    const comm = settings?.commission;
    if (!comm || comm.value == null) return 'Not set';
    if (comm.type === 'flat') return `Flat ${fmtAmt(comm.value)}`;
    return `${comm.value}%`;
  };

  if (isLoading) return <LoadingScreen message={t('common.loading')} />;
  if (isError) return (
    <View style={{ flex: 1, padding: 16 }}>
      <ErrorMessage message={parseApiError(error) ?? 'Failed to load company'} onRetry={refetch} />
    </View>
  );

  const statusColorKey = STATUS_COLORS[(tenant as any).status] || 'textSecondary';
  const statusColor = theme.colors[statusColorKey];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* Pinned header — always visible regardless of active tab */}
      <View style={{ paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md }}>
        <AppCard style={{ marginBottom: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text, flex: 1, marginRight: 8 }]}>{(tenant as any).name}</Text>
            <View style={{ backgroundColor: withAlpha(statusColor, 0.15), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '700' }]}>
                {((tenant as any).status || '').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{(tenant as any).slug}</Text>
        </AppCard>

        <TabBar active={activeTab} onChange={setActiveTab} theme={theme} />
      </View>

      {/* Scrollable tab content */}
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingTop: 0, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── INFO TAB ── */}
        {activeTab === 'info' && (
          <AppCard>
            <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
              {t('nav.companyDetails').toUpperCase()}
            </Text>
            <InfoRow label="Contact Email" value={(tenant as any).contactEmail} theme={theme} />
            <Divider theme={theme} />
            <InfoRow label="Address" value={(tenant as any).address} theme={theme} />
            <Divider theme={theme} />
            <InfoRow label={t('company.branchLimit')} value={(tenant as any).branchLimit ?? '—'} theme={theme} />
            <Divider theme={theme} />
            <InfoRow label={t('company.staffLimit')} value={(tenant as any).staffLimit ?? '—'} theme={theme} />
            <Divider theme={theme} />
            <InfoRow
              label="Business Type"
              value={(tenant as any).businessType === 'aangadia' ? 'Juna Aangadia' : 'Enterprise'}
              theme={theme}
            />
            <Divider theme={theme} />
            <InfoRow label="Commission" value={formatCommission((tenant as any).settings)} theme={theme} />
            <Divider theme={theme} />
            {(tenant as any).businessType === 'enterprise' && (
              <>
                <InfoRow label="Comm. Split" value={formatCommissionSplit((tenant as any).settings)} theme={theme} />
                <Divider theme={theme} />
              </>
            )}
            <InfoRow
              label="Max Per Txn"
              value={(tenant as any)?.settings?.transactionLimits?.maxAmountPerTransaction > 0
                ? fmtAmt((tenant as any).settings.transactionLimits.maxAmountPerTransaction)
                : 'No limit'}
              theme={theme}
            />
            <Divider theme={theme} />
            <InfoRow
              label="Daily Limit / Branch"
              value={(tenant as any)?.settings?.transactionLimits?.dailyLimitPerBranch > 0
                ? fmtAmt((tenant as any).settings.transactionLimits.dailyLimitPerBranch)
                : 'No limit'}
              theme={theme}
            />
            <Divider theme={theme} />
            <InfoRow label="Registered" value={(tenant as any).createdAt ? fmtDate(new Date((tenant as any).createdAt)) : '—'} theme={theme} />
          </AppCard>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <>
            {/* Export Formats */}
            <AppCard style={{ marginBottom: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>EXPORT FORMATS</Text>
                <TouchableOpacity
                  onPress={() => exportFormatsMutation.mutate()}
                  disabled={exportFormatsMutation.isPending}
                  style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primary, opacity: exportFormatsMutation.isPending ? 0.6 : 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} allowFontScaling={false}>
                    {exportFormatsMutation.isPending ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
                Tap to toggle which formats are available to head office.
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                {(['csv', 'excel', 'pdf'] as const).map((fmt) => {
                  const active = localExportFormats.includes(fmt);
                  return (
                    <TouchableOpacity
                      key={fmt}
                      onPress={() => toggleExportFormat(fmt)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: theme.borderRadius.md,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 4,
                        backgroundColor: active ? theme.colors.primary : theme.colors.inputBackground,
                        borderWidth: 1.5,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      }}
                    >
                      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={active ? '#fff' : theme.colors.textSecondary} />
                      <Text style={[theme.typography.label, { color: active ? '#fff' : theme.colors.textSecondary, fontSize: 13 }]} allowFontScaling={false}>
                        {fmt.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </AppCard>

            {/* Device Approval */}
            <AppCard style={{ marginBottom: theme.spacing.md }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>DEVICE APPROVAL</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
                When enabled, each new device a staff member logs in from must be approved by head office.
              </Text>
              <ToggleRow
                label="Require Device Approval"
                subtitle={deviceApprovalFlag ? 'Enabled — new devices need HO approval' : 'Disabled — staff logs in on any device instantly'}
                value={deviceApprovalFlag}
                onToggle={handleToggleDeviceApproval}
                saving={savingDeviceApproval}
                theme={theme}
              />
            </AppCard>

            {/* Commission Routing */}
            <AppCard>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>COMMISSION ROUTING</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
                When enabled, commission on receiver-pays transactions is credited to the sending branch.
              </Text>
              <ToggleRow
                label="Credit Commission to Sending Branch"
                subtitle={creditCommFlag ? 'Enabled — sending branch earns commission' : 'Disabled — payout branch earns commission (default)'}
                value={creditCommFlag}
                onToggle={handleToggleCreditCommFlag}
                saving={savingCreditCommFlag}
                theme={theme}
              />
            </AppCard>
          </>
        )}

        {/* ── ACTIONS TAB ── */}
        {activeTab === 'actions' && (
          <>
            {hoUser ? (
              <ActionList title="HEAD OFFICE ACCOUNT" style={{ marginBottom: theme.spacing.md }}>
                <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '700' }]}>
                        {(hoUser as any).name}
                      </Text>
                      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                        {(hoUser as any).username}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: withAlpha((hoUser as any).status === 'active' ? theme.colors.success : theme.colors.textSecondary, 0.15),
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                    }}>
                      <Text style={[theme.typography.caption, { color: (hoUser as any).status === 'active' ? theme.colors.success : theme.colors.textSecondary, fontWeight: '700' }]}>
                        {((hoUser as any).status || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <ActionItem
                  icon="key-outline"
                  label="Reset Password"
                  subtitle="Set a new password for this account"
                  onPress={() => { setHoNewPassword(''); setHoShowPassword(false); setShowHoPasswordModal(true); setTimeout(() => hoPasswordRef.current?.focus(), 300); }}
                  isLast
                />
              </ActionList>
            ) : (
              <AppButton
                title={t('nav.createHOAccount')}
                onPress={() => navigation.navigate('CreateHeadOffice', { tenantId })}
                style={{ marginBottom: theme.spacing.md }}
              />
            )}

            <ActionList title="CONFIGURATION">
              <ActionItem
                icon="people-outline"
                label="View Staff & Devices"
                onPress={() => navigation.navigate('TenantStaff', { tenantId, tenantName: (tenant as any).name })}
              />
              <ActionItem
                icon="git-branch-outline"
                label={t('company.branchLimit')}
                value={String((tenant as any).branchLimit ?? '—')}
                onPress={handleOpenLimitModal}
              />
              <ActionItem
                icon="person-outline"
                label={t('company.staffLimit')}
                value={String((tenant as any).staffLimit ?? '—')}
                onPress={handleOpenStaffLimitModal}
              />
              <ActionItem
                icon="swap-horizontal-outline"
                label="Transaction Limits"
                value={(tenant as any)?.settings?.transactionLimits?.maxAmountPerTransaction > 0
                  ? `Max ${fmtAmt((tenant as any).settings.transactionLimits.maxAmountPerTransaction)}`
                  : 'No limits'}
                onPress={handleOpenTxnLimitsModal}
              />
              <ActionItem
                icon="pricetag-outline"
                label="Commission"
                value={formatCommission((tenant as any).settings)}
                onPress={handleOpenCommissionModal}
              />
              {(tenant as any).businessType === 'enterprise' && (
                <ActionItem
                  icon="git-network-outline"
                  label="Commission Split"
                  value={formatCommissionSplit((tenant as any).settings)}
                  onPress={handleOpenSplitModal}
                />
              )}
              <ActionItem
                icon="storefront-outline"
                label="Business Type"
                value={(tenant as any).businessType === 'aangadia' ? 'Juna Aangadia' : 'Enterprise'}
                onPress={handleChangeBusinessType}
                loading={businessTypeMutation.isPending}
                isLast
              />
            </ActionList>

            <ActionList title="DANGER ZONE">
              <ActionItem
                icon="swap-vertical-outline"
                label="Change Status"
                value={((tenant as any).status || '').toUpperCase()}
                onPress={handleChangeStatus}
                variant="danger"
                loading={statusMutation.isPending && (tenant as any).status !== 'suspended'}
              />
              <ActionItem
                icon="ban-outline"
                label="Suspend Company"
                subtitle="Blocks all staff access immediately"
                onPress={handleSuspend}
                variant="danger"
                loading={statusMutation.isPending && (tenant as any).status === 'suspended'}
                isLast
              />
            </ActionList>
          </>
        )}

      </ScrollView>

      {/* ── MODALS (render over everything regardless of active tab) ── */}

      <Modal visible={showLimitModal} transparent animationType="fade" onRequestClose={() => { setShowLimitModal(false); setNewLimit(''); setLimitError(''); }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="git-branch-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>{t('common.edit')} {t('company.branchLimit')}</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Current: {(tenant as any)?.branchLimit ?? '—'}. New limit must be ≥ existing branches.
              </Text>
              <TextInput ref={limitInputRef} value={newLimit} onChangeText={(v) => { setNewLimit(v); setLimitError(''); }} placeholder="e.g. 10" placeholderTextColor={theme.colors.textSecondary} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={handleSaveLimit}
                style={{ borderWidth: 1.5, borderColor: limitError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: limitError ? theme.spacing.xs : theme.spacing.md, textAlign: 'center' }} />
              {limitError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{limitError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowLimitModal(false); setNewLimit(''); setLimitError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveLimit} disabled={branchLimitMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{branchLimitMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showStaffLimitModal} transparent animationType="fade" onRequestClose={() => { setShowStaffLimitModal(false); setNewStaffLimit(''); setStaffLimitError(''); }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="person-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>{t('common.edit')} {t('company.staffLimit')}</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Current: {(tenant as any)?.staffLimit ?? '—'}. New limit must be ≥ active staff.
              </Text>
              <TextInput ref={staffLimitInputRef} value={newStaffLimit} onChangeText={(v) => { setNewStaffLimit(v); setStaffLimitError(''); }} placeholder="e.g. 10" placeholderTextColor={theme.colors.textSecondary} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={handleSaveStaffLimit}
                style={{ borderWidth: 1.5, borderColor: staffLimitError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: staffLimitError ? theme.spacing.xs : theme.spacing.md, textAlign: 'center' }} />
              {staffLimitError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{staffLimitError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowStaffLimitModal(false); setNewStaffLimit(''); setStaffLimitError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveStaffLimit} disabled={staffLimitMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{staffLimitMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showTxnLimitsModal} transparent animationType="fade" onRequestClose={() => { setShowTxnLimitsModal(false); setTxnLimitsError(''); }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="swap-horizontal-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>Transaction Limits</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>Set to 0 to disable a limit.</Text>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>Max Amount per Transaction (₹)</Text>
              <TextInput ref={maxAmountRef} value={maxAmountPerTxn} onChangeText={(v) => setMaxAmountPerTxn(v.replace(/[^0-9.]/g, ''))} placeholder="0 = no limit" placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => dailyLimitRef.current?.focus()}
                style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 16, marginBottom: theme.spacing.md }} />
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>Daily Collection Limit per Branch (₹)</Text>
              <TextInput ref={dailyLimitRef} value={dailyLimitPerBranch} onChangeText={(v) => { setDailyLimitPerBranch(v.replace(/[^0-9.]/g, '')); setTxnLimitsError(''); }} placeholder="0 = no limit" placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={handleSaveTxnLimits}
                style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 16, marginBottom: txnLimitsError ? theme.spacing.xs : theme.spacing.md }} />
              {txnLimitsError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{txnLimitsError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowTxnLimitsModal(false); setTxnLimitsError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveTxnLimits} disabled={txnLimitsMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{txnLimitsMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCommissionModal} transparent animationType="fade" onRequestClose={() => { setShowCommissionModal(false); setCommValue(''); setCommModalError(''); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="pricetag-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>{t('common.edit')} Commission</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>Set the default commission for this company.</Text>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>Commission Type</Text>
              <View style={{ marginBottom: theme.spacing.md }}>
                <SegmentControl
                  options={[{ label: 'Flat (₹)', value: 'flat' }, { label: 'Percentage (%)', value: 'percentage' }]}
                  value={commType}
                  onChange={(v) => setCommType(v as 'flat' | 'percentage')}
                />
              </View>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>{commType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}</Text>
              <TextInput ref={commValueRef} value={commValue} onChangeText={(v) => { setCommValue(v.replace(/[^0-9.]/g, '')); setCommModalError(''); }} placeholder={commType === 'flat' ? 'e.g. 50' : 'e.g. 2.5'} placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={handleSaveCommission}
                style={{ borderWidth: 1.5, borderColor: commModalError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: commModalError ? theme.spacing.xs : theme.spacing.md, textAlign: 'center' }} />
              {commModalError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{commModalError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowCommissionModal(false); setCommValue(''); setCommModalError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveCommission} disabled={commissionMutation.isPending || !commValue.trim() || isNaN(parseFloat(commValue))}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: (!commValue.trim() || isNaN(parseFloat(commValue))) ? withAlpha(theme.colors.primary, 0.38) : theme.colors.primary, alignItems: 'center' }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{commissionMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSplitModal} transparent animationType="fade" onRequestClose={() => { setShowSplitModal(false); setSplitModalError(''); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="git-branch-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>{t('common.edit')} Commission Split</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Branch % applies to each branch on a transaction. 2 × Branch % + Head Office % must equal 100.
              </Text>
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>Branch %</Text>
              <TextInput ref={splitBranchRef} value={splitBranchPct} onChangeText={(v) => setSplitBranchPct(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 30" placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={() => splitHoRef.current?.focus()}
                style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: theme.spacing.md, textAlign: 'center' }} />
              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>Head Office %</Text>
              <TextInput ref={splitHoRef} value={splitHeadOfficePct} onChangeText={(v) => { setSplitHeadOfficePct(v.replace(/[^0-9.]/g, '')); setSplitModalError(''); }} placeholder="e.g. 40" placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={handleSaveSplit}
                style={{ borderWidth: 1.5, borderColor: splitModalError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: splitModalError ? theme.spacing.xs : theme.spacing.md, textAlign: 'center' }} />
              {splitModalError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{splitModalError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowSplitModal(false); setSplitModalError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveSplit} disabled={commissionSplitMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{commissionSplitMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AppActionSheet
        visible={showStatusSheet}
        title="Change Status"
        subtitle={`Current: ${((tenant as any)?.status || '').toUpperCase()}`}
        options={[
          {
            icon: 'radio-button-off-outline',
            label: 'Set Inactive',
            variant: 'warning',
            onPress: () => { setShowStatusSheet(false); statusMutation.mutate('inactive'); },
          },
          {
            icon: 'checkmark-circle-outline',
            label: 'Set Active',
            variant: 'success',
            onPress: () => { setShowStatusSheet(false); statusMutation.mutate('active'); },
          },
        ]}
        onClose={() => setShowStatusSheet(false)}
      />

      <ConfirmSheet
        visible={showSuspendSheet}
        title="Suspend Company?"
        message="All staff at this company will lose access immediately."
        confirmLabel="Suspend"
        destructive
        icon="ban-outline"
        onConfirm={() => { setShowSuspendSheet(false); statusMutation.mutate('suspended'); }}
        onClose={() => setShowSuspendSheet(false)}
        loading={statusMutation.isPending}
      />

      <AppActionSheet
        visible={showBizTypeSheet}
        title="Change Business Type"
        subtitle="Select how this company operates"
        options={[
          {
            icon: 'business-outline',
            label: 'Enterprise',
            onPress: () => { setShowBizTypeSheet(false); businessTypeMutation.mutate('enterprise'); },
          },
          {
            icon: 'storefront-outline',
            label: 'Juna Aangadia',
            onPress: () => { setShowBizTypeSheet(false); businessTypeMutation.mutate('aangadia'); },
          },
        ]}
        onClose={() => setShowBizTypeSheet(false)}
      />

      <Modal visible={showHoPasswordModal} transparent animationType="fade" onRequestClose={() => { setShowHoPasswordModal(false); setHoNewPassword(''); setHoShowPassword(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="key-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>Reset HO Password</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Set a new password for{'\n'}
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{(hoUser as any)?.username}</Text>
              </Text>
              <View style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <TextInput
                  ref={hoPasswordRef}
                  value={hoNewPassword}
                  onChangeText={setHoNewPassword}
                  placeholder="New password (min. 8 chars)"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!hoShowPassword}
                  returnKeyType="done"
                  onSubmitEditing={() => hoNewPassword.length >= 8 && resetHoPasswordMutation.mutate()}
                  style={{ flex: 1, padding: theme.spacing.md, color: theme.colors.text, fontSize: 16 }}
                />
                <TouchableOpacity onPress={() => setHoShowPassword(v => !v)} style={{ paddingHorizontal: 12 }} activeOpacity={0.7}>
                  <Ionicons name={hoShowPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowHoPasswordModal(false); setHoNewPassword(''); setHoShowPassword(false); }}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => resetHoPasswordMutation.mutate()}
                  disabled={resetHoPasswordMutation.isPending || hoNewPassword.length < 8}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: hoNewPassword.length < 8 ? withAlpha(theme.colors.primary, 0.38) : theme.colors.primary, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{resetHoPasswordMutation.isPending ? 'Saving…' : 'Update Password'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
