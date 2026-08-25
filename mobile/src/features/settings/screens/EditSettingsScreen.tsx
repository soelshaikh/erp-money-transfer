import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { settingsApi } from '../api/settingsApi';
import { AppInput } from '../../../shared/components/AppInput';
import { AppButton } from '../../../shared/components/AppButton';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { withAlpha } from '../../../utils/colors';
import { useTranslation } from 'react-i18next';

// Labels for commission types are set dynamically via t() inside the component

interface Props {
  navigation: any;
}

export function EditSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const COMMISSION_TYPES = [
    { value: 'flat', label: t('settings.flat') },
    { value: 'percentage', label: t('settings.percentage') },
  ];

  const [form, setForm] = useState<{
    appName: string;
    commissionType: string;
    commissionValue: string;
    whEnabled: boolean;
    whStart: string;
    whEnd: string;
  }>({
    appName: '',
    commissionType: 'flat',
    commissionValue: '',
    whEnabled: false,
    whStart: '09:00',
    whEnd: '18:00',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const wh = (data as any).settings?.workingHours;
    setForm({
      appName: (data as any).branding?.appName || '',
      commissionType: (data as any).settings?.commission?.type || 'flat',
      commissionValue: String((data as any).settings?.commission?.value ?? ''),
      whEnabled: wh?.enabled === true,
      whStart: wh?.startTime || '09:00',
      whEnd: wh?.endTime || '18:00',
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({
      branding: { appName: form.appName.trim() },
      settings: {
        commission: {
          type: form.commissionType,
          value: parseFloat(form.commissionValue) || 0,
        },
        workingHours: {
          enabled: form.whEnabled,
          startTime: form.whStart.trim() || '09:00',
          endTime: form.whEnd.trim() || '18:00',
        },
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      Alert.alert('Success', 'Settings saved', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
  });

  const apiError = parseApiError(mutation.error);

  if (isLoading) return <LoadingScreen message={t('settings.loading')} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorMessage message={apiError} />

        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {t('settings.branding')}
        </Text>

        <AppInput
          label={t('settings.appName')}
          value={form.appName}
          onChangeText={(v: string) => setForm((f) => ({ ...f, appName: v }))}
          placeholder={t('settings.appNamePlaceholder')}
          autoCapitalize="words"
        />

        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.xs }]}>
          {t('settings.settingsSection')}
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
            {t('settings.commissionType')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {COMMISSION_TYPES.map((t) => {
              const selected = form.commissionType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setForm((f) => ({ ...f, commissionType: t.value }))}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 9,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      theme.typography.body,
                      { color: selected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: selected ? '600' : '400' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <AppInput
          label={form.commissionType === 'percentage' ? t('settings.commValuePct') : t('settings.commValueFlat')}
          value={form.commissionValue}
          onChangeText={(v: string) => setForm((f) => ({ ...f, commissionValue: v.replace(/[^0-9.]/g, '') }))}
          placeholder={t('settings.egValue')}
          keyboardType="decimal-pad"
        />

        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>
          {t('signOff.workingHours').toUpperCase()}
        </Text>

        {/* Enable toggle */}
        <TouchableOpacity
          onPress={() => setForm((f) => ({ ...f, whEnabled: !f.whEnabled }))}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.sm,
          }}
          activeOpacity={0.7}
        >
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{t('signOff.enabled')}</Text>
          <View style={{
            width: 44, height: 24, borderRadius: 12,
            backgroundColor: form.whEnabled ? theme.colors.primary : theme.colors.border,
            justifyContent: 'center', paddingHorizontal: 2,
          }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
              alignSelf: form.whEnabled ? 'flex-end' : 'flex-start',
            }} />
          </View>
        </TouchableOpacity>

        {form.whEnabled && (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label={t('signOff.startTime')}
                value={form.whStart}
                onChangeText={(v: string) => setForm((f) => ({ ...f, whStart: v }))}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label={t('signOff.endTime')}
                value={form.whEnd}
                onChangeText={(v: string) => setForm((f) => ({ ...f, whEnd: v }))}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
        )}

        <AppButton
          title={t('settings.saveBtn')}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.lg }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
