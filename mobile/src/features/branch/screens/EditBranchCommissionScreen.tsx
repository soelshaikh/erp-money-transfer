import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { branchApi } from '../api/branchApi';
import { ActionList, ActionItem } from '../../../shared/components/ActionList';
import { SegmentControl } from '../../../shared/components/SegmentControl';
import { AppCard } from '../../../shared/components/AppCard';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
import { showToast } from '../../../utils/toast';
import { withAlpha } from '../../../utils/colors';

interface Props {
  navigation: any;
  route: any;
}

export function EditBranchCommissionScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { branchId, branchName } = route.params;
  const theme = useTheme();
  const qc = useQueryClient();

  const { data: branch, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () => branchApi.getOne(branchId),
  });

  // ── Commission modal state ──
  const [showCommModal, setShowCommModal] = useState(false);
  const [commEnabled, setCommEnabled] = useState(false);
  const [commType, setCommType] = useState<'flat' | 'percentage'>('flat');
  const [commValue, setCommValue] = useState('');
  const [commValueError, setCommValueError] = useState('');
  const commValueRef = useRef<TextInput>(null);

  // ── HQ Share modal state ──
  const [showHqModal, setShowHqModal] = useState(false);
  const [hqPct, setHqPct] = useState('');
  const [hqPctError, setHqPctError] = useState('');
  const hqPctRef = useRef<TextInput>(null);

  // ── Working Hours modal state ──
  const [showWhModal, setShowWhModal] = useState(false);
  const [whEnabled, setWhEnabled] = useState(false);
  const [whStart, setWhStart] = useState('09:00');
  const [whEnd, setWhEnd] = useState('18:00');
  const [whError, setWhError] = useState('');
  const whStartRef = useRef<TextInput>(null);
  const whEndRef = useRef<TextInput>(null);

  useEffect(() => {
    if (branch) {
      setCommEnabled(branch.commissionConfig?.enabled || false);
      setCommType(branch.commissionConfig?.type || 'flat');
      setCommValue(String(branch.commissionConfig?.value ?? '0'));
      setHqPct(String(branch.masterCommissionPct ?? '0'));
      setWhEnabled(branch.workingHours?.enabled === true);
      setWhStart(branch.workingHours?.startTime || '09:00');
      setWhEnd(branch.workingHours?.endTime || '18:00');
    }
  }, [branch]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['branches'] });
    qc.invalidateQueries({ queryKey: ['branch', branchId] });
  };

  const commMutation = useMutation({
    mutationFn: () => branchApi.update(branchId, {
      commissionConfig: {
        enabled: commEnabled,
        type: commType,
        value: parseFloat(commValue || '0') || 0,
      },
    }),
    onSuccess: () => { invalidate(); setShowCommModal(false); showToast('success', 'Saved', 'Commission settings saved'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to save'),
  });

  const hqMutation = useMutation({
    mutationFn: () => branchApi.update(branchId, { masterCommissionPct: parseFloat(hqPct || '0') || 0 }),
    onSuccess: () => { invalidate(); setShowHqModal(false); showToast('success', 'Saved', 'HQ commission saved'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to save'),
  });

  const whMutation = useMutation({
    mutationFn: () => branchApi.update(branchId, {
      workingHours: {
        enabled: whEnabled,
        startTime: whStart.trim() || '09:00',
        endTime: whEnd.trim() || '18:00',
      },
    }),
    onSuccess: () => { invalidate(); setShowWhModal(false); showToast('success', 'Saved', 'Working hours saved'); },
    onError: (e: any) => showToast('error', 'Error', parseApiError(e) ?? 'Failed to save'),
  });

  const handleSaveComm = () => {
    setCommValueError('');
    if (commEnabled) {
      const cv = parseFloat(commValue || '');
      if (isNaN(cv) || cv < 0) { setCommValueError('Enter a valid value'); return; }
      if (commType === 'percentage' && cv > 100) { setCommValueError('Cannot exceed 100%'); return; }
    }
    commMutation.mutate();
  };

  const handleSaveHq = () => {
    setHqPctError('');
    const mp = parseFloat(hqPct || '0');
    if (isNaN(mp) || mp < 0 || mp > 100) { setHqPctError('Enter a value between 0 and 100'); return; }
    hqMutation.mutate();
  };

  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const handleSaveWh = () => {
    setWhError('');
    if (whEnabled) {
      if (!TIME_RE.test(whStart.trim())) { setWhError('Start time must be HH:MM (e.g. 09:00)'); return; }
      if (!TIME_RE.test(whEnd.trim())) { setWhError('End time must be HH:MM (e.g. 18:00)'); return; }
      if (whStart.trim() >= whEnd.trim()) { setWhError('Start time must be before end time'); return; }
    }
    whMutation.mutate();
  };

  const commLabel = () => {
    if (!branch?.commissionConfig?.enabled) return 'Global (inherits company)';
    const cfg = branch.commissionConfig;
    return cfg.type === 'flat' ? `Flat ₹${cfg.value}` : `${cfg.value}%`;
  };

  const hqLabel = () => {
    const pct = branch?.masterCommissionPct ?? 0;
    return pct === 0 ? 'Not set (0%)' : `${pct}%`;
  };

  const whLabel = () => {
    const wh = branch?.workingHours;
    if (!wh?.enabled) return 'Inherits company hours';
    return `${wh.startTime} – ${wh.endTime}`;
  };

  if (isLoading) return <LoadingScreen message={t('branch.loadingBranch')} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[theme.colors.primary]} />}
      >
        {/* Branch info header */}
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: withAlpha(theme.colors.primary, 0.1), justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{branchName}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                {branch?.code} · {branch?.city || branch?.type || ''}
              </Text>
            </View>
          </View>
        </AppCard>

        <ActionList title="COMMISSION">
          <ActionItem
            icon="pricetag-outline"
            label="Branch Commission"
            value={commLabel()}
            subtitle={branch?.commissionConfig?.enabled ? 'Branch-specific override' : 'Using global rate'}
            onPress={() => {
              setCommEnabled(branch?.commissionConfig?.enabled || false);
              setCommType(branch?.commissionConfig?.type || 'flat');
              setCommValue(String(branch?.commissionConfig?.value ?? '0'));
              setCommValueError('');
              setShowCommModal(true);
            }}
            isLast
          />
        </ActionList>

        <ActionList title="HQ COMMISSION">
          <ActionItem
            icon="git-network-outline"
            label="HQ Share"
            value={hqLabel()}
            subtitle="% of branch commission sent to head office each settlement"
            onPress={() => {
              setHqPct(String(branch?.masterCommissionPct ?? '0'));
              setHqPctError('');
              setShowHqModal(true);
              setTimeout(() => hqPctRef.current?.focus(), 300);
            }}
            isLast
          />
        </ActionList>

        <ActionList title="SCHEDULE">
          <ActionItem
            icon="time-outline"
            label="Working Hours"
            value={whLabel()}
            subtitle={branch?.workingHours?.enabled ? 'Branch-specific schedule' : 'Inherits from company'}
            onPress={() => {
              setWhEnabled(branch?.workingHours?.enabled === true);
              setWhStart(branch?.workingHours?.startTime || '09:00');
              setWhEnd(branch?.workingHours?.endTime || '18:00');
              setShowWhModal(true);
            }}
            isLast
          />
        </ActionList>
      </ScrollView>

      {/* ── Commission Modal ── */}
      <Modal visible={showCommModal} transparent animationType="fade" onRequestClose={() => setShowCommModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="pricetag-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>Branch Commission</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Override the global commission rate for this branch only.
              </Text>

              {/* Enable toggle */}
              <TouchableOpacity
                onPress={() => setCommEnabled(v => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}
              >
                <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>
                  {commEnabled ? 'Branch-specific rate' : 'Using global rate'}
                </Text>
                <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: commEnabled ? theme.colors.primary : theme.colors.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.surface, alignSelf: commEnabled ? 'flex-end' : 'flex-start' }} />
                </View>
              </TouchableOpacity>

              {commEnabled && (
                <>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>Commission Type</Text>
                  <View style={{ marginBottom: theme.spacing.md }}>
                    <SegmentControl
                      options={[{ label: 'Flat (₹)', value: 'flat' }, { label: 'Percentage (%)', value: 'percentage' }]}
                      value={commType}
                      onChange={(v) => setCommType(v as 'flat' | 'percentage')}
                    />
                  </View>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
                    {commType === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                  </Text>
                  <TextInput
                    ref={commValueRef}
                    value={commValue}
                    onChangeText={(v) => { setCommValue(v.replace(/[^0-9.]/g, '')); setCommValueError(''); }}
                    placeholder={commType === 'flat' ? 'e.g. 50' : 'e.g. 2.5'}
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveComm}
                    style={{ borderWidth: 1.5, borderColor: commValueError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}
                  />
                  {commValueError ? <Text style={[theme.typography.caption, { color: theme.colors.error, marginBottom: theme.spacing.sm }]}>{commValueError}</Text> : <View style={{ height: theme.spacing.sm }} />}
                </>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => setShowCommModal(false)} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveComm} disabled={commMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center', opacity: commMutation.isPending ? 0.6 : 1 }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{commMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── HQ Share Modal ── */}
      <Modal visible={showHqModal} transparent animationType="fade" onRequestClose={() => setShowHqModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="git-network-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>HQ Share</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Percentage of this branch's commission forwarded to head office at each settlement.{'\n'}Set to 0 to disable.
              </Text>
              <TextInput
                ref={hqPctRef}
                value={hqPct}
                onChangeText={(v) => { setHqPct(v.replace(/[^0-9.]/g, '')); setHqPctError(''); }}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSaveHq}
                style={{ borderWidth: 1.5, borderColor: hqPctError ? theme.colors.error : theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}
              />
              {hqPctError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{hqPctError}</Text> : <View style={{ height: theme.spacing.sm }} />}
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.md }]}>Enter a value between 0 – 100</Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <TouchableOpacity onPress={() => setShowHqModal(false)} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveHq} disabled={hqMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center', opacity: hqMutation.isPending ? 0.6 : 1 }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{hqMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Working Hours Modal ── */}
      <Modal visible={showWhModal} transparent animationType="fade" onRequestClose={() => { setShowWhModal(false); setWhError(''); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}>
            <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: theme.spacing.md }}>
                <Ionicons name="time-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[theme.typography.h3, { color: theme.colors.text, textAlign: 'center', marginBottom: theme.spacing.xs }]}>Working Hours</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg }]}>
                Override company-wide hours for this branch only.
              </Text>

              {/* Enable toggle */}
              <TouchableOpacity
                onPress={() => setWhEnabled(v => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}
              >
                <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>
                  {whEnabled ? 'Custom hours set' : 'Inherit company hours'}
                </Text>
                <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: whEnabled ? theme.colors.primary : theme.colors.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.surface, alignSelf: whEnabled ? 'flex-end' : 'flex-start' }} />
                </View>
              </TouchableOpacity>

              {whEnabled && (
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>Start</Text>
                    <TextInput
                      ref={whStartRef}
                      value={whStart}
                      onChangeText={setWhStart}
                      placeholder="09:00"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      returnKeyType="next"
                      onSubmitEditing={() => whEndRef.current?.focus()}
                      style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>End</Text>
                    <TextInput
                      ref={whEndRef}
                      value={whEnd}
                      onChangeText={setWhEnd}
                      placeholder="18:00"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveWh}
                      style={{ borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}
                    />
                  </View>
                </View>
              )}

              {whError ? <Text style={[theme.typography.caption, { color: theme.colors.error, textAlign: 'center', marginBottom: theme.spacing.sm }]}>{whError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: whEnabled ? 0 : theme.spacing.sm }}>
                <TouchableOpacity onPress={() => { setShowWhModal(false); setWhError(''); }} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.divider, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveWh} disabled={whMutation.isPending} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center', opacity: whMutation.isPending ? 0.6 : 1 }} activeOpacity={0.8}>
                  <Text style={[theme.typography.label, { color: '#fff' }]}>{whMutation.isPending ? 'Saving…' : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
