import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { showToast } from '../../../utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { AppCard } from '../../../shared/components/AppCard';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { SegmentControl } from '../../../shared/components/SegmentControl';
import { parseApiError } from '../../../utils/apiError';

type BusinessType = 'enterprise' | 'aangadia';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const BUSINESS_TYPES = [
  { label: 'Enterprise', value: 'enterprise' },
  { label: 'Juna Aangadia', value: 'aangadia' },
];

interface Props {
  navigation: any;
}

export function RegisterCompanyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();

  const slugRef = useRef<TextInput>(null);
  const branchLimitRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const [form, setForm] = useState<{
    name: string; slug: string; address: string;
    branchLimit: string; businessType: BusinessType;
  }>({ name: '', slug: '', address: '', branchLimit: '', businessType: 'enterprise' });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        branchLimit: parseInt(form.branchLimit, 10),
        businessType: form.businessType,
      };
      if (form.address.trim()) payload.address = form.address.trim();
      return tenantApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      showToast('success', 'Company registered successfully.');
      navigation.goBack();
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.slug.trim()) {
      e.slug = 'Company ID is required';
    } else if (!SLUG_PATTERN.test(form.slug)) {
      e.slug = 'Only lowercase letters, numbers, and hyphens';
    }
    if (!form.branchLimit.trim()) {
      e.branchLimit = 'Required';
    } else if (!/^\d+$/.test(form.branchLimit.trim()) || parseInt(form.branchLimit, 10) < 1) {
      e.branchLimit = 'Min 1';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => { if (validate()) mutation.mutate(); };
  const apiError = parseApiError(mutation.error as any);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorMessage message={apiError} />

        <AppCard style={{ marginBottom: theme.spacing.md }}>

          <AppInput
            label="Company Name"
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Acme Financials"
            error={errors.name}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => slugRef.current?.focus()}
          />

          <AppInput
            ref={slugRef}
            label="Company ID"
            value={form.slug}
            onChangeText={(v) => setForm((f) => ({ ...f, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            placeholder="e.g. acme-financials"
            error={errors.slug}
            helper="Lowercase, hyphens only · cannot be changed later"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => branchLimitRef.current?.focus()}
          />

          {/* Branch Limit + Business Type — same row */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>

            {/* Branch Limit */}
            <View style={{ flex: 0.36 }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
                {t('company.branchLimit')}
              </Text>
              <TextInput
                ref={branchLimitRef}
                value={form.branchLimit}
                onChangeText={(v) => setForm((f) => ({ ...f, branchLimit: v.replace(/[^0-9]/g, '') }))}
                placeholder="5"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                style={{
                  borderWidth: 1,
                  borderColor: errors.branchLimit ? theme.colors.error : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.inputBackground,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  color: theme.colors.text,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              />
              {errors.branchLimit ? (
                <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 4 }]}>
                  {errors.branchLimit}
                </Text>
              ) : null}
            </View>

            {/* Business Type */}
            <View style={{ flex: 0.64 }}>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
                Business Type
              </Text>
              <SegmentControl
                options={BUSINESS_TYPES}
                value={form.businessType}
                onChange={(v) => setForm((f) => ({ ...f, businessType: v as BusinessType }))}
              />
            </View>

          </View>

          <AppInput
            ref={addressRef}
            label="Address (optional)"
            value={form.address}
            onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
            placeholder="Company address"
            autoCapitalize="sentences"
            autoCorrect={true}
            multiline
          />

        </AppCard>

        <AppButton
          title={t('nav.registerCompany')}
          onPress={handleSubmit}
          loading={mutation.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
