import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { showToast } from '../../../utils/toast';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { tenantApi } from '../api/tenantApi';
import { AppButton } from '../../../shared/components/AppButton';
import { AppInput } from '../../../shared/components/AppInput';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';

const USERNAME_PATTERN = /^[a-z0-9@_]+$/;

interface Props {
  route: any;
  navigation: any;
}

export function CreateHeadOfficeScreen({ route, navigation }: Props) {
  const { tenantId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();

  const [form, setForm] = useState<{ name: string; username: string; password: string }>({ name: '', username: '', password: '' });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const mutation = useMutation({
    mutationFn: () => tenantApi.createHeadOffice(tenantId, form),
    onSuccess: (data: any) => {
      showToast('success', 'Account Created', `Head office account created. Username: ${data.username || form.username}`);
      navigation.goBack();
    },
  });

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.username.trim()) {
      e.username = 'Username is required';
    } else if (!USERNAME_PATTERN.test(form.username)) {
      e.username = 'Only letters, numbers, @ and _';
    }
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
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
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <ErrorMessage message={apiError} />

        <AppInput
          label="Full Name"
          value={form.name}
          onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
          placeholder="e.g. John Smith"
          error={errors.name}
          autoCapitalize="words"
        />
        <AppInput
          label="Username"
          value={form.username}
          onChangeText={(v: string) => setForm((f) => ({ ...f, username: v.toLowerCase() }))}
          placeholder="e.g. johnsmith"
          error={errors.username}
          autoCapitalize="none"
        />
        <AppInput
          label="Password"
          value={form.password}
          onChangeText={(v: string) => setForm((f) => ({ ...f, password: v }))}
          placeholder="Min. 8 characters"
          error={errors.password}
          secureTextEntry
        />

        <AppButton
          title={t('nav.createHOAccount')}
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
