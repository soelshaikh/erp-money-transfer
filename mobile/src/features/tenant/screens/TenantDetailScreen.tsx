import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { fmtAmt } from '../../../utils/fmt';
import { withAlpha } from '../../../utils/colors';
import { Ionicons } from '@expo/vector-icons';

const STATUS_COLORS: { [key: string]: string } = {
  active: 'success',
  inactive: 'textSecondary',
  suspended: 'error',
};

interface InfoRowProps {
  label: string;
  value: any;
  theme: any;
}

function InfoRow({ label, value, theme }: InfoRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.text, flex: 2, textAlign: 'right' }]}>{value || '—'}</Text>
    </View>
  );
}

interface DividerProps {
  theme: any;
}

function Divider({ theme }: DividerProps) {
  return <View style={{ height: 1, backgroundColor: theme.colors.divider }} />;
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

  const [showTxnLimitsModal, setShowTxnLimitsModal] = useState(false);
  const [maxAmountPerTxn, setMaxAmountPerTxn] = useState('');
  const [dailyLimitPerBranch, setDailyLimitPerBranch] = useState('');
  const maxAmountRef = useRef<TextInput>(null);
  const dailyLimitRef = useRef<TextInput>(null);

  const [localExportFormats, setLocalExportFormats] = useState<string[]>(['csv', 'excel', 'pdf']);
  const [creditCommFlag, setCreditCommFlag] = useState(false);
  const [savingCreditCommFlag, setSavingCreditCommFlag] = useState(false);
  const [deviceApprovalFlag, setDeviceApprovalFlag] = useState(false);
  const [savingDeviceApproval, setSavingDeviceApproval] = useState(false);

  const { data: tenant, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantApi.getOne(tenantId),
  });

  useEffect(() => {
    if (tenant) {
      setLocalExportFormats((tenant as any)?.features?.exportFormats ?? ['csv', 'excel', 'pdf']);
      setCreditCommFlag((tenant as any)?.features?.creditCommissionToSendingBranch ?? false);
      setDeviceApprovalFlag((tenant as any)?.features?.deviceApprovalRequired ?? false);
    }
  }, [tenant]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
    qc.invalidateQueries({ queryKey: ['tenants'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => tenantApi.updateStatus(tenantId, status),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update status'),
  });

  const branchLimitMutation = useMutation({
    mutationFn: (limit: number) => tenantApi.updateBranchLimit(tenantId, limit),
    onSuccess: () => {
      invalidate();
      setShowLimitModal(false);
      setNewLimit('');
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update branch limit'),
  });

  const staffLimitMutation = useMutation({
    mutationFn: (limit: number) => tenantApi.updateStaffLimit(tenantId, limit),
    onSuccess: () => {
      invalidate();
      setShowStaffLimitModal(false);
      setNewStaffLimit('');
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update staff limit'),
  });

  const txnLimitsMutation = useMutation({
    mutationFn: () => tenantApi.updateTransactionLimits(tenantId, {
      maxAmountPerTransaction: parseFloat(maxAmountPerTxn) || 0,
      dailyLimitPerBranch: parseFloat(dailyLimitPerBranch) || 0,
    }),
    onSuccess: () => {
      invalidate();
      setShowTxnLimitsModal(false);
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update transaction limits'),
  });

  const commissionMutation = useMutation({
    mutationFn: (commission: { type: string; value: number }) =>
      tenantApi.updateCommission(tenantId, commission),
    onSuccess: () => {
      invalidate();
      setShowCommissionModal(false);
      setCommValue('');
    },
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update commission'),
  });

  const exportFormatsMutation = useMutation({
    mutationFn: () => tenantApi.updateExportFormats(tenantId, localExportFormats),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', parseApiError(e) ?? 'Failed to update export formats'),
  });

  const handleToggleDeviceApproval = async (newVal: boolean) => {
    setDeviceApprovalFlag(newVal);
    setSavingDeviceApproval(true);
    try {
      await tenantApi.updateDeviceApproval(tenantId, newVal);
      invalidate();
    } catch (e: any) {
      setDeviceApprovalFlag(!newVal);
      Alert.alert('Error', parseApiError(e) ?? 'Failed to update setting');
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
    } catch (e: any) {
      setCreditCommFlag(!newVal);
      Alert.alert('Error', parseApiError(e) ?? 'Failed to update setting');
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
    Alert.alert('Change Status', 'Select new status for this company:', [
      { text: t('company.active'), onPress: () => statusMutation.mutate('active') },
      { text: t('company.inactive'), onPress: () => statusMutation.mutate('inactive') },
      { text: t('common.suspended'), style: 'destructive', onPress: () => statusMutation.mutate('suspended') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleOpenLimitModal = () => {
    setNewLimit(String((tenant as any)?.branchLimit ?? ''));
    setShowLimitModal(true);
    setTimeout(() => limitInputRef.current?.focus(), 300);
  };

  const handleSaveLimit = () => {
    const parsed = parseInt(newLimit, 10);
    if (!newLimit.trim() || isNaN(parsed) || parsed < 1) {
      Alert.alert('Invalid', 'Enter a number of at least 1.');
      return;
    }
    branchLimitMutation.mutate(parsed);
  };

  const handleOpenStaffLimitModal = () => {
    setNewStaffLimit(String((tenant as any)?.staffLimit ?? ''));
    setShowStaffLimitModal(true);
    setTimeout(() => staffLimitInputRef.current?.focus(), 300);
  };

  const handleSaveStaffLimit = () => {
    const parsed = parseInt(newStaffLimit, 10);
    if (!newStaffLimit.trim() || isNaN(parsed) || parsed < 1) {
      Alert.alert('Invalid', 'Enter a number of at least 1.');
      return;
    }
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
    const parsed = parseFloat(commValue);
    if (!commValue.trim() || isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid', 'Enter a valid commission value (0 or more).');
      return;
    }
    commissionMutation.mutate({ type: commType, value: parsed });
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
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
    >
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text, flex: 1, marginRight: 8 }]}>{(tenant as any).name}</Text>
          <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={[theme.typography.caption, { color: statusColor, fontWeight: '600' }]}>
              {((tenant as any).status || '').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{(tenant as any).slug}</Text>
      </AppCard>

      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>{t('nav.companyDetails').toUpperCase()}</Text>
        <InfoRow label="Contact Email" value={(tenant as any).contactEmail} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label="Address" value={(tenant as any).address} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label={t('company.branchLimit')} value={(tenant as any).branchLimit ?? '—'} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label={t('company.staffLimit')} value={(tenant as any).staffLimit ?? '—'} theme={theme} />
        <Divider theme={theme} />
        <InfoRow label="Commission" value={formatCommission((tenant as any).settings)} theme={theme} />
        <Divider theme={theme} />
        <InfoRow
          label="Max Per Transaction"
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
        <InfoRow label="Registered" value={(tenant as any).createdAt ? new Date((tenant as any).createdAt).toLocaleDateString('en-IN') : '—'} theme={theme} />
      </AppCard>

      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>EXPORT FORMATS</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          Which export formats are available to this company's head office.
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          {(['csv', 'excel', 'pdf'] as const).map((fmt) => {
            const active = localExportFormats.includes(fmt);
            return (
              <TouchableOpacity
                key={fmt}
                onPress={() => toggleExportFormat(fmt)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.borderRadius.md,
                  alignItems: 'center',
                  backgroundColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.07),
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.2),
                }}
              >
                <Text
                  style={[theme.typography.label, { color: active ? '#fff' : theme.colors.primary }]}
                  allowFontScaling={false}
                >
                  {fmt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <AppButton
          title={exportFormatsMutation.isPending ? 'Saving…' : 'Save Export Formats'}
          onPress={() => exportFormatsMutation.mutate()}
          loading={exportFormatsMutation.isPending}
          disabled={exportFormatsMutation.isPending}
        />
      </AppCard>

      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>DEVICE APPROVAL</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          When enabled, each new phone a branch staff logs in from must be approved by head office before access is granted.
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => !savingDeviceApproval && handleToggleDeviceApproval(!deviceApprovalFlag)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor: deviceApprovalFlag ? withAlpha(theme.colors.primary, 0.07) : withAlpha(theme.colors.textSecondary, 0.06),
            borderWidth: 1,
            borderColor: deviceApprovalFlag ? withAlpha(theme.colors.primary, 0.25) : theme.colors.divider,
          }}
        >
          <View style={{ flex: 1, marginRight: theme.spacing.md }}>
            <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>
              Require Device Approval
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              {deviceApprovalFlag ? 'Enabled — new devices need HO approval' : 'Disabled — staff logs in on any device instantly'}
            </Text>
          </View>
          <View style={{
            width: 44, height: 24, borderRadius: 12,
            backgroundColor: deviceApprovalFlag ? theme.colors.primary : theme.colors.divider,
            justifyContent: 'center', paddingHorizontal: 2,
          }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: theme.colors.surface,
              alignSelf: deviceApprovalFlag ? 'flex-end' : 'flex-start',
            }} />
          </View>
        </TouchableOpacity>
      </AppCard>

      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>COMMISSION ROUTING</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          When enabled, commission on receiver-pays transactions is credited to the sending branch. The payout branch shows a pending payable until settled.
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => !savingCreditCommFlag && handleToggleCreditCommFlag(!creditCommFlag)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor: creditCommFlag ? withAlpha(theme.colors.primary, 0.07) : withAlpha(theme.colors.textSecondary, 0.06),
            borderWidth: 1,
            borderColor: creditCommFlag ? withAlpha(theme.colors.primary, 0.25) : theme.colors.divider,
          }}
        >
          <View style={{ flex: 1, marginRight: theme.spacing.md }}>
            <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>
              Credit Commission to Sending Branch
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              {creditCommFlag ? 'Enabled — sending branch earns commission' : 'Disabled — payout branch earns commission (default)'}
            </Text>
          </View>
          <View style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: creditCommFlag ? theme.colors.primary : theme.colors.divider,
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: theme.colors.surface,
              alignSelf: creditCommFlag ? 'flex-end' : 'flex-start',
            }} />
          </View>
        </TouchableOpacity>
      </AppCard>

      <AppCard>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>ACTIONS</Text>
        <AppButton
          title={t('nav.createHOAccount')}
          onPress={() => navigation.navigate('CreateHeadOffice', { tenantId })}
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title="View Staff & Devices"
          onPress={() => navigation.navigate('TenantStaff', { tenantId, tenantName: (tenant as any).name })}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title={t('common.edit') + ' ' + t('company.branchLimit')}
          onPress={handleOpenLimitModal}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title={t('common.edit') + ' ' + t('company.staffLimit')}
          onPress={handleOpenStaffLimitModal}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title={t('common.edit') + ' Transaction Limits'}
          onPress={handleOpenTxnLimitsModal}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title={t('common.edit') + ' Commission'}
          onPress={handleOpenCommissionModal}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm }}
        />
        <AppButton
          title="Change Status"
          onPress={handleChangeStatus}
          variant="outline"
          loading={statusMutation.isPending}
        />
      </AppCard>

      <Modal
        visible={showLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowLimitModal(false); setNewLimit(''); }}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: withAlpha(theme.colors.primary, 0.12),
                justifyContent: 'center', alignItems: 'center',
                alignSelf: 'center', marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="git-branch-outline" size={26} color={theme.colors.primary} />
              </View>

              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>
                {t('common.edit')} {t('company.branchLimit')}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Current limit: {(tenant as any)?.branchLimit ?? '—'}. New limit must be ≥ the number of existing branches.
              </Text>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                New {t('company.branchLimit')}
              </Text>
              <TextInput
                ref={limitInputRef}
                value={newLimit}
                onChangeText={setNewLimit}
                placeholder="e.g. 10"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSaveLimit}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                  marginBottom: theme.spacing.md,
                  textAlign: 'center',
                }}
              />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowLimitModal(false); setNewLimit(''); }}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveLimit}
                  disabled={branchLimitMutation.isPending}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>
                    {branchLimitMutation.isPending ? 'Saving…' : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Staff Limit Modal */}
      <Modal
        visible={showStaffLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowStaffLimitModal(false); setNewStaffLimit(''); }}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: withAlpha(theme.colors.primary, 0.12),
                justifyContent: 'center', alignItems: 'center',
                alignSelf: 'center', marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="person-outline" size={26} color={theme.colors.primary} />
              </View>

              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>
                {t('common.edit')} {t('company.staffLimit')}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Current limit: {(tenant as any)?.staffLimit ?? '—'}. New limit must be ≥ the number of active staff.
              </Text>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                New {t('company.staffLimit')}
              </Text>
              <TextInput
                ref={staffLimitInputRef}
                value={newStaffLimit}
                onChangeText={setNewStaffLimit}
                placeholder="e.g. 10"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSaveStaffLimit}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                  marginBottom: theme.spacing.md,
                  textAlign: 'center',
                }}
              />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowStaffLimitModal(false); setNewStaffLimit(''); }}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveStaffLimit}
                  disabled={staffLimitMutation.isPending}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>
                    {staffLimitMutation.isPending ? 'Saving…' : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction Limits Modal */}
      <Modal
        visible={showTxnLimitsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTxnLimitsModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: withAlpha(theme.colors.primary, 0.12),
                justifyContent: 'center', alignItems: 'center',
                alignSelf: 'center', marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="swap-horizontal-outline" size={26} color={theme.colors.primary} />
              </View>

              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>
                Transaction Limits
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Set to 0 to disable a limit.
              </Text>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                Max Amount per Transaction (₹)
              </Text>
              <TextInput
                ref={maxAmountRef}
                value={maxAmountPerTxn}
                onChangeText={setMaxAmountPerTxn}
                placeholder="0 = no limit"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onSubmitEditing={() => dailyLimitRef.current?.focus()}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 16,
                  marginBottom: theme.spacing.md,
                }}
              />

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                Daily Collection Limit per Branch (₹)
              </Text>
              <TextInput
                ref={dailyLimitRef}
                value={dailyLimitPerBranch}
                onChangeText={setDailyLimitPerBranch}
                placeholder="0 = no limit"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={() => txnLimitsMutation.mutate()}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 16,
                  marginBottom: theme.spacing.md,
                }}
              />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => setShowTxnLimitsModal(false)}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => txnLimitsMutation.mutate()}
                  disabled={txnLimitsMutation.isPending}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>
                    {txnLimitsMutation.isPending ? 'Saving…' : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCommissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCommissionModal(false); setCommValue(''); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: withAlpha(theme.colors.primary, 0.12),
                justifyContent: 'center', alignItems: 'center',
                alignSelf: 'center', marginBottom: theme.spacing.md,
              }}>
                <Ionicons name="pricetag-outline" size={26} color={theme.colors.primary} />
              </View>

              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>
                {t('common.edit')} Commission
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Set the default commission for this company.
              </Text>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                Commission Type
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                <TouchableOpacity
                  onPress={() => setCommType('flat')}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: commType === 'flat' ? theme.colors.primary : theme.colors.divider,
                    backgroundColor: commType === 'flat' ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: commType === 'flat' ? theme.colors.primary : theme.colors.textSecondary }]}>
                    Flat (₹)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCommType('percentage')}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: commType === 'percentage' ? theme.colors.primary : theme.colors.divider,
                    backgroundColor: commType === 'percentage' ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: commType === 'percentage' ? theme.colors.primary : theme.colors.textSecondary }]}>
                    Percentage (%)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
                {commType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
              </Text>
              <TextInput
                ref={commValueRef}
                value={commValue}
                onChangeText={setCommValue}
                placeholder={commType === 'flat' ? 'e.g. 50' : 'e.g. 2.5'}
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSaveCommission}
                style={{
                  borderWidth: 1.5,
                  borderColor: theme.colors.divider,
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                  marginBottom: theme.spacing.md,
                  textAlign: 'center',
                }}
              />

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowCommissionModal(false); setCommValue(''); }}
                  style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveCommission}
                  disabled={commissionMutation.isPending || !commValue.trim() || isNaN(parseFloat(commValue))}
                  style={{
                    flex: 1,
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: (!commValue.trim() || isNaN(parseFloat(commValue))) ? withAlpha(theme.colors.primary, 0.38) : theme.colors.primary,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[theme.typography.label, { color: '#fff' }]}>
                    {commissionMutation.isPending ? 'Saving…' : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
