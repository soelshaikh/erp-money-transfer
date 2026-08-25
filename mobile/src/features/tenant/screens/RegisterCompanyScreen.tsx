import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TextInput, TouchableOpacity } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { withAlpha } from '../../../utils/colors';

type BusinessType = 'enterprise' | 'aangadia';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

interface Props {
  navigation: any;
}

export function RegisterCompanyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();

  const scrollRef = useRef<ScrollView>(null);
  const slugRef = useRef<TextInput>(null);
  const branchLimitRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const [form, setForm] = useState<{ name: string; slug: string; address: string; branchLimit: string; businessType: BusinessType }>({
    name: '', slug: '', address: '', branchLimit: '', businessType: 'enterprise',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: form.name,
        slug: form.slug,
        branchLimit: parseInt(form.branchLimit, 10),
        businessType: form.businessType,
      };
      if (form.address.trim()) payload.address = form.address.trim();
      return tenantApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      Alert.alert('Success', 'Company registered successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
  });

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.slug.trim()) {
      e.slug = 'Company ID is required';
    } else if (!SLUG_PATTERN.test(form.slug)) {
      e.slug = 'Only lowercase letters, numbers, and hyphens allowed';
    }
    if (!form.branchLimit.trim()) {
      e.branchLimit = 'Branch limit is required';
    } else if (!/^\d+$/.test(form.branchLimit.trim()) || parseInt(form.branchLimit, 10) < 1) {
      e.branchLimit = 'Branch limit must be a number (minimum 1)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) mutation.mutate();
  };

  const apiError = parseApiError(mutation.error);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorMessage message={apiError} />

        <AppInput
          label="Company Name"
          value={form.name}
          onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
          placeholder="e.g. Acme Corp"
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => slugRef.current?.focus()}
        />
        <AppInput
          ref={slugRef}
          label="Company ID (slug)"
          value={form.slug}
          onChangeText={(v: string) => setForm((f) => ({ ...f, slug: v.toLowerCase() }))}
          placeholder="e.g. acme-corp"
          error={errors.slug}
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => branchLimitRef.current?.focus()}
        />
        <AppInput
          ref={branchLimitRef}
          label={t('company.branchLimit')}
          value={form.branchLimit}
          onChangeText={(v: string) => setForm((f) => ({ ...f, branchLimit: v.replace(/[^0-9]/g, '') }))}
          placeholder="e.g. 5"
          error={errors.branchLimit}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
        />

        <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
          Business Type
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <TouchableOpacity
            onPress={() => setForm((f) => ({ ...f, businessType: 'enterprise' }))}
            style={{
              flex: 1,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1.5,
              borderColor: form.businessType === 'enterprise' ? theme.colors.primary : theme.colors.divider,
              backgroundColor: form.businessType === 'enterprise' ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.label, { color: form.businessType === 'enterprise' ? theme.colors.primary : theme.colors.textSecondary }]}>
              Enterprise
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setForm((f) => ({ ...f, businessType: 'aangadia' }))}
            style={{
              flex: 1,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1.5,
              borderColor: form.businessType === 'aangadia' ? theme.colors.primary : theme.colors.divider,
              backgroundColor: form.businessType === 'aangadia' ? withAlpha(theme.colors.primary, 0.08) : theme.colors.surface,
              alignItems: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.label, { color: form.businessType === 'aangadia' ? theme.colors.primary : theme.colors.textSecondary }]}>
              Aangadia
            </Text>
          </TouchableOpacity>
        </View>

        <AppInput
          ref={addressRef}
          label="Address (optional)"
          value={form.address}
          onChangeText={(v: string) => setForm((f) => ({ ...f, address: v }))}
          placeholder="Company address"
          autoCapitalize="sentences"
          autoCorrect={true}
          multiline
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
        />

        <AppButton
          title={t('nav.registerCompany')}
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
