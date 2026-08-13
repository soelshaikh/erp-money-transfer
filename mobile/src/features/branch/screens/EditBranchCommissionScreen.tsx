import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { branchApi } from '../api/branchApi';
import { AppInput } from '../../../shared/components/AppInput';
import { AppButton } from '../../../shared/components/AppButton';
import { AppCard } from '../../../shared/components/AppCard';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { parseApiError } from '../../../utils/apiError';
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

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () => branchApi.getOne(branchId),
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [commissionType, setCommissionType] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState<string | null>(null);
  const [valueError, setValueError] = useState('');
  const [masterPct, setMasterPct] = useState<string>('');
  const [masterPctError, setMasterPctError] = useState('');

  // Once branch data loads, seed state (only once)
  React.useEffect(() => {
    if (branch && enabled === null) {
      setEnabled(branch.commissionConfig?.enabled || false);
      setCommissionType(branch.commissionConfig?.type || 'flat');
      setCommissionValue(String(branch.commissionConfig?.value ?? ''));
      setMasterPct(String(branch.masterCommissionPct ?? '0'));
    }
  }, [branch]);

  const mutation = useMutation({
    mutationFn: () => {
      const cv = parseFloat(commissionValue || '0') || 0;
      const mp = parseFloat(masterPct || '0') || 0;
      return branchApi.update(branchId, {
        commissionConfig: {
          enabled: enabled ?? false,
          type: commissionType || 'flat',
          value: cv,
        },
        masterCommissionPct: mp,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['branch', branchId] });
      Alert.alert('Saved', 'Branch commission updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
  });

  const handleSave = () => {
    setValueError('');
    setMasterPctError('');
    if (enabled) {
      const cv = parseFloat(commissionValue || '');
      if (isNaN(cv) || cv < 0) { setValueError('Enter a valid commission value'); return; }
      if (commissionType === 'percentage' && cv > 100) { setValueError('Percentage cannot exceed 100'); return; }
    }
    const mp = parseFloat(masterPct || '0');
    if (isNaN(mp) || mp < 0 || mp > 100) { setMasterPctError('Enter a value between 0 and 100'); return; }
    mutation.mutate();
  };

  if (isLoading || enabled === null) return <LoadingScreen message={t('branch.loadingBranch')} />;

  const apiError = parseApiError(mutation.error);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorMessage message={apiError} />

        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>{t('branch.branchLabel')}</Text>
          <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: '600' }]}>{branchName}</Text>
        </AppCard>

        <AppCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: enabled ? theme.spacing.lg : 0 }}>
            <View>
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('branch.branchSpecificComm')}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                {enabled ? t('branch.overridesGlobal') : t('branch.usesGlobal')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setEnabled((v) => !v)}
              style={{
                width: 44, height: 26, borderRadius: 13,
                backgroundColor: enabled ? theme.colors.primary : theme.colors.border,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
              activeOpacity={0.8}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: theme.colors.surface,
                alignSelf: enabled ? 'flex-end' : 'flex-start',
              }} />
            </TouchableOpacity>
          </View>

          {enabled && (
            <>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
                {t('branch.type')}
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                {(['flat', 'percentage'] as const).map((ct) => {
                  const selected = commissionType === ct;
                  return (
                    <TouchableOpacity
                      key={ct}
                      onPress={() => setCommissionType(ct)}
                      style={{
                        paddingHorizontal: theme.spacing.md, paddingVertical: 9,
                        borderRadius: theme.borderRadius.md, borderWidth: 1.5,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[theme.typography.body, { color: selected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: selected ? '600' : '400' }]}>
                        {ct === 'flat' ? t('branch.commFlat') : t('branch.commPct')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppInput
                label={commissionType === 'flat' ? t('branch.commAmtField') : t('branch.commPctField')}
                value={commissionValue ?? ''}
                onChangeText={(v: string) => { setCommissionValue(v); setValueError(''); }}
                placeholder={commissionType === 'flat' ? t('branch.eg50') : t('branch.eg25')}
                keyboardType="decimal-pad"
                error={valueError}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </>
          )}
        </AppCard>

        <AppCard style={{ marginTop: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 2 }]}>
            {t('branch.masterCommTitle')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
            {t('branch.masterCommSub')}
          </Text>
          <AppInput
            label={t('branch.masterCommField')}
            value={masterPct}
            onChangeText={(v: string) => { setMasterPct(v); setMasterPctError(''); }}
            placeholder="0"
            keyboardType="decimal-pad"
            error={masterPctError}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </AppCard>

        <AppButton
          title={t('branch.saveComm')}
          onPress={handleSave}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.lg }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
