import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { transactionApi } from '../api/transactionApi';
import { branchApi } from '../../branch/api/branchApi';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';
import { fmtAmt } from '../../../utils/fmt';
import { todayIST } from '../../../utils/dateIST';
import { ImagePickerButton } from '../../../shared/components/ImagePickerButton';
import { settingsApi } from '../../settings/api/settingsApi';

const PAYMENT_METHODS = [
  { value: 'cash',         label: 'Cash' },
  { value: 'neft',         label: 'NEFT' },
  { value: 'rtgs',         label: 'RTGS' },
  { value: 'bank_transfer',label: 'IMPS' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayDisplay() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function todayISO() {
  return todayIST();
}

function extractLenar(remarks?: string | null): string {
  if (!remarks) return '—';
  const m = remarks.match(/L:\s*([^|]+)/);
  if (m) return m[1].trim().split(' ')[0] || '—';
  return remarks.split('|')[0].trim() || '—';
}

function extractMokalnar(remarks?: string | null): string {
  if (!remarks) return '—';
  const m = remarks.match(/M:\s*([^|]+)/);
  if (m) return m[1].trim().split(' ')[0] || '—';
  return '—';
}

// ─── Inline labeled field with icon ───────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: string;
  error?: string;
  theme: any;
  children: React.ReactNode;
}

function Field({ label, icon, error, theme, children }: FieldProps) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: error ? theme.colors.error : theme.colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 11,
        backgroundColor: theme.colors.surface,
        gap: 8,
      }}>
        <Ionicons name={icon as any} size={15} color={theme.colors.primary} />
        {children}
      </View>
      {!!error && (
        <Text style={{ fontSize: 11, color: theme.colors.error, marginTop: 3 }}>{error}</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  navigation: any;
}

export function ShakhaEntryScreen({ navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s: any) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canOverride = user?.permissions?.canOverrideCommission === true;

  // form
  const [amount, setAmount] = useState('');
  const [lenarName, setLenarName] = useState('');
  const [lenarMobile, setLenarMobile] = useState('');
  const [vigat, setVigat] = useState('');
  const [payoutBranchId, setPayoutBranchId] = useState<string | null>(null);
  const [mokalnarName, setMokalnarName] = useState('');
  const [mokalnarMobile, setMokalnarMobile] = useState('');
  const [commissionSide, setCommissionSide] = useState<'collection' | 'payout'>('collection');
  const [overrideCommission, setOverrideCommission] = useState(false);
  const [commissionType, setCommissionType] = useState<'flat' | 'percentage'>('flat');
  const [commissionValue, setCommissionValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [collectionPhotoUrl, setCollectionPhotoUrl] = useState<string | null>(null);
  const [customerTokenNo, setCustomerTokenNo] = useState('');
  const [showMukabam, setShowMukabam] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // keyboard refs
  const lenarNameRef = useRef<TextInput>(null);
  const lenarMobileRef = useRef<TextInput>(null);
  const vigatRef = useRef<TextInput>(null);
  const mokalnarNameRef = useRef<TextInput>(null);
  const mokalnarMobileRef = useRef<TextInput>(null);
  const customerTokenNoRef = useRef<TextInput>(null);
  const commissionValueRef = useRef<TextInput>(null);

  // branches
  const { data: branchesData, refetch: refetchBranches } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
    staleTime: 60_000,
  });
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 300_000,
  });
  const allBranches: any[] = (branchesData as any) || [];
  const myBranch = allBranches.find((b: any) => b._id === user?.branchId);
  const payoutBranches = allBranches.filter((b: any) => b._id !== user?.branchId);
  const selectedBranch = payoutBranches.find((b: any) => b._id === payoutBranchId);

  // today's entries
  const { data: todayRaw, refetch: refetchToday } = useQuery({
    queryKey: ['transactions', 'shakha-today', user?.branchId, todayISO()],
    queryFn: () => {
      const today = todayIST();
      return transactionApi.list({ fromDate: today, toDate: today, page: 1, limit: 50 });
    },
    staleTime: 0,
  });
  const todayEntries: any[] = (todayRaw as any)?.data ?? [];

  // dynamic header: title = branch code, right = refresh
  useLayoutEffect(() => {
    navigation.setOptions({
      title: myBranch?.code || 'Entry',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => { refetchBranches(); refetchToday(); }}
          style={{ marginRight: 14, alignItems: 'center' }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
          <Text style={{ fontSize: 9, color: theme.colors.primary, marginTop: 1 }}>{t('common.refresh')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, myBranch, theme]);

  const clearForm = useCallback(() => {
    setAmount('');
    setLenarName('');
    setLenarMobile('');
    setVigat('');
    setPayoutBranchId(null);
    setMokalnarName('');
    setMokalnarMobile('');
    setCommissionSide('collection');
    setOverrideCommission(false);
    setCommissionType('flat');
    setCommissionValue('');
    setPaymentMethod('cash');
    setCollectionPhotoUrl(null);
    setCustomerTokenNo('');
    setErrors({});
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!payoutBranchId) e.mukbam = t('txn.payoutBranchRequired');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) e.amount = t('txn.amountRequired');
    if (overrideCommission) {
      const cv = parseFloat(commissionValue);
      if (isNaN(cv) || cv < 0) e.commissionValue = t('txn.commissionValueInvalid');
      if (commissionType === 'percentage' && cv > 100) e.commissionValue = t('txn.commissionPctMax');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const parts: string[] = [];
      if (vigat.trim()) parts.push(vigat.trim());
      if (lenarName.trim() || lenarMobile.trim())
        parts.push(`L: ${[lenarName.trim(), lenarMobile.trim()].filter(Boolean).join(' ')}`);
      if (mokalnarName.trim() || mokalnarMobile.trim())
        parts.push(`M: ${[mokalnarName.trim(), mokalnarMobile.trim()].filter(Boolean).join(' ')}`);

      const idempotencyKey = `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return transactionApi.create(
        {
          collectionBranchId: user?.branchId,
          payoutBranchId,
          amount: parseFloat(amount),
          paymentMethod,
          commissionSide,
          ...(collectionPhotoUrl && { collectionPhotoUrl }),
          ...(customerTokenNo.trim() && { customerTokenNo: customerTokenNo.trim() }),
          ...(parts.length > 0 && { remarks: parts.join(' | ') }),
          ...(canOverride && overrideCommission && {
            commissionOverride: { type: commissionType, value: parseFloat(commissionValue) || 0 },
          }),
        },
        idempotencyKey,
      );
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      refetchToday();
      clearForm();
      Alert.alert(t('common.success'), `Token: ${data.tokenNumber}\n${fmtAmt(Number(data.amount))}`);
    },
    onError: (err: any) => {
      Alert.alert('Error', parseApiError(err) || 'Something went wrong');
    },
  });

  const tin = { flex: 1 as const, color: theme.colors.text, fontSize: 14, padding: 0 };

  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000' as const,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: tabBarHeight + 16 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Form card ───────────────────────────────────── */}
        <View style={cardStyle}>

          {/* Row 1: Amount (labeled with branch code) + Date */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Field label="KG" icon="business-outline" error={errors.amount} theme={theme}>
              <TextInput
                style={tin}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={`₹ ${t('txn.amount')}`}
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="next"
                onSubmitEditing={() => lenarNameRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>

            <Field label={t('txn.date')} icon="calendar-outline" theme={theme}>
              <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13 }} allowFontScaling={false}>
                {todayDisplay()}
              </Text>
            </Field>
          </View>

          {/* Commission side */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }}>
              {t('txn.commissionSide')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { value: 'collection', label: t('txn.senderPays'), sub: t('txn.senderPaysSub') },
                { value: 'payout',     label: t('txn.receiverPays'), sub: t('txn.receiverPaysSub') },
              ] as const).map((opt) => {
                const sel = commissionSide === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setCommissionSide(opt.value)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1, paddingVertical: 9, paddingHorizontal: 8,
                      borderRadius: 8, borderWidth: 1.5,
                      borderColor: sel ? theme.colors.primary : theme.colors.border,
                      backgroundColor: sel ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: sel ? theme.colors.primary : theme.colors.text, marginBottom: 1 }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 10, color: sel ? theme.colors.primary : theme.colors.textSecondary }} allowFontScaling={false}>
                      {opt.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Mukkam dropdown */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>
              {t('txn.payoutBranchLabel')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowMukabam(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center',
                borderWidth: 1, borderColor: errors.mukbam ? theme.colors.error : theme.colors.border,
                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12,
                backgroundColor: theme.colors.surface, gap: 8,
              }}
            >
              <Ionicons name="people-outline" size={15} color={theme.colors.primary} />
              <Text style={{ flex: 1, color: selectedBranch ? theme.colors.text : theme.colors.textSecondary, fontSize: 14 }}>
                {selectedBranch ? `${selectedBranch.code} — ${selectedBranch.name}` : t('txn.payoutBranchLabel')}
              </Text>
              <Ionicons name="chevron-down" size={15} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            {!!errors.mukbam && (
              <Text style={{ fontSize: 11, color: theme.colors.error, marginTop: 3 }}>{errors.mukbam}</Text>
            )}
          </View>

          {/* Commission override — inline, before preview */}
          {canOverride && (
            <View style={{ marginBottom: 12 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: overrideCommission ? 12 : 0,
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>
                    {t('txn.overrideCommission')}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>
                    {t('txn.overrideCommissionSub')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setOverrideCommission((v) => !v)}
                  activeOpacity={0.8}
                  style={{
                    width: 44, height: 26, borderRadius: 13,
                    backgroundColor: overrideCommission ? theme.colors.primary : theme.colors.border,
                    justifyContent: 'center', paddingHorizontal: 2,
                  }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: theme.colors.surface,
                    alignSelf: overrideCommission ? 'flex-end' : 'flex-start',
                  }} />
                </TouchableOpacity>
              </View>
              {overrideCommission && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }}>
                    {t('txn.commissionType')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {(['flat', 'percentage'] as const).map((cType) => {
                      const selected = commissionType === cType;
                      return (
                        <TouchableOpacity
                          key={cType}
                          onPress={() => setCommissionType(cType)}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5,
                            borderColor: selected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
                          }}
                        >
                          <Text style={{ fontWeight: '600', fontSize: 13, color: selected ? theme.colors.primary : theme.colors.textSecondary }}>
                            {cType === 'flat' ? t('txn.flatType') : t('txn.percentType')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Field
                    label={commissionType === 'flat' ? t('txn.commAmt') : t('txn.commPct')}
                    icon="cube-outline"
                    error={errors.commissionValue}
                    theme={theme}
                  >
                    <TextInput
                      ref={commissionValueRef}
                      style={tin}
                      value={commissionValue}
                      onChangeText={setCommissionValue}
                      placeholder={commissionType === 'flat' ? 'e.g. 50' : 'e.g. 2.5'}
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                  </Field>
                </>
              )}
            </View>
          )}

          {/* Live commission preview — reacts to override values */}
          {(() => {
            const parsedAmt = parseFloat(amount) || 0;
            if (parsedAmt <= 0 || !payoutBranchId) return null;
            const globalComm = (settingsData as any)?.settings?.commission || {};
            const sourceBranch = commissionSide === 'payout' ? selectedBranch : myBranch;
            const isOverrideActive = overrideCommission && canOverride && !!commissionValue;
            const isBranchConfig = !isOverrideActive && !!sourceBranch?.commissionConfig?.enabled;
            const cType = isOverrideActive ? commissionType : (isBranchConfig ? sourceBranch.commissionConfig.type : (globalComm.type || 'flat'));
            const cValue = isOverrideActive ? (parseFloat(commissionValue) || 0) : (isBranchConfig ? sourceBranch.commissionConfig.value : (globalComm.value || 0));
            const cAmount = cType === 'percentage' ? Math.round(parsedAmt * cValue / 100) : cValue;
            const senderPays = commissionSide === 'collection' ? parsedAmt + cAmount : parsedAmt;
            const receiverGets = commissionSide === 'collection' ? parsedAmt : parsedAmt - cAmount;
            const accentColor = isOverrideActive ? '#7c3aed' : (isBranchConfig ? '#d97706' : theme.colors.primary);
            const badgeText = isOverrideActive ? 'OVERRIDE' : (isBranchConfig ? 'BRANCH' : 'GLOBAL');
            const rateLabel = isOverrideActive
              ? `Override: ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`
              : (isBranchConfig
                ? `Branch Comm. (${sourceBranch?.code}): ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`
                : `Global Comm.: ${cType === 'percentage' ? `${cValue}%` : `₹${cValue}`}`);
            return (
              <View style={{
                backgroundColor: withAlpha(accentColor, 0.07),
                borderRadius: 8, padding: 10, marginBottom: 12,
                borderWidth: 1, borderColor: withAlpha(accentColor, 0.22),
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="pricetag-outline" size={12} color={accentColor} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: accentColor, flex: 1 }}>{rateLabel}</Text>
                  <View style={{ backgroundColor: withAlpha(accentColor, 0.15), paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: accentColor, fontWeight: '700' }} allowFontScaling={false}>{badgeText}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>Sender pays</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }} allowFontScaling={false}>₹{senderPays.toLocaleString('en-IN')}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>Commission</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: accentColor }} allowFontScaling={false}>₹{cAmount.toLocaleString('en-IN')}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>Receiver gets</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.success }} allowFontScaling={false}>₹{receiverGets.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Row 2: Lenar Name + Lenar Mobile */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Field label={t('txn.receiverName')} icon="person-outline" theme={theme}>
              <TextInput
                ref={lenarNameRef}
                style={tin}
                value={lenarName}
                onChangeText={setLenarName}
                placeholder={t('txn.receiverDeducted')}
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="next"
                autoCapitalize="words"
                onSubmitEditing={() => lenarMobileRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>
            <Field label={t('txn.receiverMobile')} icon="call-outline" theme={theme}>
              <TextInput
                ref={lenarMobileRef}
                style={tin}
                value={lenarMobile}
                onChangeText={setLenarMobile}
                placeholder={t('txn.mobilePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => vigatRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>
          </View>

          {/* Vigat — full width */}
          <View style={{ marginBottom: 12 }}>
            <Field label={t('txn.remarks')} icon="document-text-outline" theme={theme}>
              <TextInput
                ref={vigatRef}
                style={tin}
                value={vigat}
                onChangeText={setVigat}
                placeholder={t('txn.remarksPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="next"
                autoCapitalize="sentences"
                onSubmitEditing={() => mokalnarNameRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>
          </View>

          {/* Row: Mokalnar + Mobile */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Field label={t('txn.senderName')} icon="send-outline" theme={theme}>
              <TextInput
                ref={mokalnarNameRef}
                style={tin}
                value={mokalnarName}
                onChangeText={setMokalnarName}
                placeholder={t('txn.senderAdded')}
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="next"
                autoCapitalize="words"
                onSubmitEditing={() => mokalnarMobileRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>
            <Field label={t('txn.senderMobile')} icon="call-outline" theme={theme}>
              <TextInput
                ref={mokalnarMobileRef}
                style={tin}
                value={mokalnarMobile}
                onChangeText={setMokalnarMobile}
                placeholder={t('txn.mobilePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => customerTokenNoRef.current?.focus()}
                blurOnSubmit={false}
              />
            </Field>
          </View>

          {/* Customer Token (optional) */}
          <View style={{ marginBottom: 12 }}>
            <Field label={t('txn.tokenOptional')} icon="key-outline" theme={theme}>
              <TextInput
                ref={customerTokenNoRef}
                style={tin}
                value={customerTokenNo}
                onChangeText={setCustomerTokenNo}
                placeholder={t('txn.tokenPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </Field>
          </View>

          {/* Payment method */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }}>
              {t('txn.paymentMethodLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PAYMENT_METHODS.map((m) => {
                const selected = paymentMethod === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setPaymentMethod(m.value)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
                    }}
                  >
                    <Text style={{ fontWeight: selected ? '700' : '400', fontSize: 13, color: selected ? theme.colors.primary : theme.colors.textSecondary }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Collection slip photo */}
          <ImagePickerButton
            label={t('txn.photoOptional')}
            value={collectionPhotoUrl}
            onChange={setCollectionPhotoUrl}
          />

          {/* Buttons row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={clearForm}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
                borderRadius: 8,
                paddingVertical: 13,
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                {t('common.clear')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => validate() && mutation.mutate()}
              disabled={mutation.isPending}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: mutation.isPending ? theme.colors.border : theme.colors.primary,
                borderRadius: 8,
                paddingVertical: 13,
              }}
            >
              <Ionicons name="send-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {mutation.isPending ? '...' : t('txn.createTxnBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recent entries table ─────────────────────────── */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.07,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 14, padding: 12, paddingBottom: 8 }}>
            {t('txn.todayEntries')}
          </Text>

          {/* header row */}
          <View style={{ flexDirection: 'row', backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 6 }}>
            {[
              { label: '#',                          flex: 0.4 },
              { label: 'KG',                         flex: 1.1 },
              { label: t('txn.receiverCol'),         flex: 1.4 },
              { label: t('txn.senderCol'),           flex: 1.4 },
              { label: t('txn.payoutBranchCol'),     flex: 0.9 },
              { label: t('txn.commissionCol'),       flex: 0.9 },
            ].map((col) => (
              <Text key={col.label} style={{ flex: col.flex, color: '#fff', fontWeight: '700', fontSize: 10, textAlign: 'center' }}>
                {col.label}
              </Text>
            ))}
          </View>

          {/* body */}
          {todayEntries.length === 0 ? (
            <View style={{ paddingVertical: 36, alignItems: 'center' }}>
              <Ionicons name="folder-open-outline" size={40} color={withAlpha(theme.colors.textSecondary, 0.35)} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 10, fontSize: 13 }}>
                {t('common.noRecords')}
              </Text>
            </View>
          ) : (
            todayEntries.map((tx: any, i: number) => (
              <View
                key={tx._id}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 9,
                  paddingHorizontal: 6,
                  backgroundColor: i % 2 === 1
                    ? withAlpha(theme.colors.primary, 0.04)
                    : theme.colors.surface,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                }}
              >
                <Text style={{ flex: 0.4, fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center' }} allowFontScaling={false}>
                  {i + 1}
                </Text>
                <Text style={{ flex: 1.1, fontSize: 10, color: theme.colors.primary, fontWeight: '700', textAlign: 'center' }} allowFontScaling={false}>
                  {fmtAmt(Number(tx.amount || 0))}
                </Text>
                <Text style={{ flex: 1.4, fontSize: 10, color: theme.colors.text, textAlign: 'center' }} numberOfLines={1} allowFontScaling={false}>
                  {extractLenar(tx.remarks)}
                </Text>
                <Text style={{ flex: 1.4, fontSize: 10, color: theme.colors.text, textAlign: 'center' }} numberOfLines={1} allowFontScaling={false}>
                  {extractMokalnar(tx.remarks)}
                </Text>
                <Text style={{ flex: 0.9, fontSize: 10, color: theme.colors.text, fontWeight: '600', textAlign: 'center' }} allowFontScaling={false}>
                  {tx.payoutBranchId?.code || '—'}
                </Text>
                <Text style={{ flex: 0.9, fontSize: 10, color: theme.colors.primary, textAlign: 'center' }} allowFontScaling={false}>
                  {fmtAmt(tx.commissionAmount || 0)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Mukkam picker (bottom sheet modal) ──────────────── */}
      <Modal
        visible={showMukabam}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMukabam(false)}
      >
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={() => setShowMukabam(false)}
          />
          <View style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '55%',
          }}>
            {/* modal header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text }}>
                {t('txn.selectPayoutBranch')}
              </Text>
              <TouchableOpacity onPress={() => setShowMukabam(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={payoutBranches}
              keyExtractor={(item: any) => item._id}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={10}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: { item: any }) => {
                const isSelected = payoutBranchId === item._id;
                return (
                  <TouchableOpacity
                    onPress={() => { setPayoutBranchId(item._id); setShowMukabam(false); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: isSelected ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
                      gap: 12,
                    }}
                  >
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: withAlpha(theme.colors.primary, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.primary, fontSize: 11 }} allowFontScaling={false}>
                        {item.code}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: theme.colors.text, fontSize: 14 }}>{item.name}</Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{item.code}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
