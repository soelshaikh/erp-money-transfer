import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { showToast } from '../../../utils/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { userApi } from '../api/userApi';
import { branchApi } from '../../branch/api/branchApi';
import { AppInput } from '../../../shared/components/AppInput';
import { AppButton } from '../../../shared/components/AppButton';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';
import { BranchCodeDropdown } from '../../../shared/components/BranchCodeDropdown';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { useTranslation } from 'react-i18next';

interface Props {
  navigation: any;
}

export function CreateUserScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const scrollRef = useRef<ScrollView>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [form, setForm] = useState<{
    name: string;
    username: string;
    password: string;
    branchId: string;
  }>({
    name: '',
    username: '',
    password: '',
    branchId: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: branchApi.listActive,
  });

  const mutation = useMutation({
    mutationFn: () => userApi.create({
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
      role: 'branch',
      branchId: form.branchId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('success', 'User created');
      navigation.goBack();
    },
  });

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (!/^[a-z0-9@_]+$/.test(form.username.trim())) e.username = 'Only letters, numbers, @ and _';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.branchId) e.branchId = 'Branch is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) mutation.mutate();
  };

  const apiError = parseApiError(mutation.error);

  if (branchesLoading) return <LoadingScreen message={t('user.loadingBranches')} />;

  const branchList = Array.isArray(branches) ? branches : ((branches as any)?.data || []);

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
          label={t('user.fullName')}
          value={form.name}
          onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
          placeholder={t('user.fullNamePlaceholder')}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
        />

        <AppInput
          ref={usernameRef}
          label="Username"
          value={form.username}
          onChangeText={(v: string) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9@_]/g, '') }))}
          placeholder={t('user.usernamePlaceholder')}
          error={errors.username}
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <AppInput
          ref={passwordRef}
          label="Password"
          value={form.password}
          onChangeText={(v: string) => setForm((f) => ({ ...f, password: v }))}
          placeholder={t('user.passwordHint')}
          secureTextEntry
          error={errors.password}
          returnKeyType="next"
          onSubmitEditing={handleSubmit}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
        />

        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('user.role')}
          </Text>
          <View style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primary + '15',
            alignSelf: 'flex-start',
          }}>
            <Text style={[theme.typography.body, { color: theme.colors.primary, fontWeight: '600' }]}>
              {t('user.branchStaff')}
            </Text>
          </View>
        </View>

        <BranchCodeDropdown
          label={t('user.branchLabel')}
          branches={branchList}
          selectedId={form.branchId || null}
          onSelect={(id) => setForm((f) => ({ ...f, branchId: id }))}
        />
        {errors.branchId ? (
          <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: -theme.spacing.xs, marginBottom: theme.spacing.sm }]}>{errors.branchId}</Text>
        ) : null}

        <AppButton
          title={t('user.createBtn')}
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
