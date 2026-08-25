import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { branchApi } from '../api/branchApi';
import { AppInput } from '../../../shared/components/AppInput';
import { AppButton } from '../../../shared/components/AppButton';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { parseApiError } from '../../../utils/apiError';

const BRANCH_TYPE_KEYS: { value: string; labelKey: string }[] = [
  { value: 'collection', labelKey: 'branch.typeColl' },
  { value: 'payout', labelKey: 'branch.typePayout' },
  { value: 'both', labelKey: 'branch.typeBoth' },
];

interface Props {
  navigation: any;
}

export function CreateBranchScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const scrollRef = useRef<ScrollView>(null);
  const codeRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);

  const [form, setForm] = useState<{
    name: string;
    code: string;
    type: string;
    contactPerson: string;
    city: string;
    state: string;
    whEnabled: boolean;
    whStart: string;
    whEnd: string;
  }>({
    name: '',
    code: '',
    type: '',
    contactPerson: '',
    city: '',
    state: '',
    whEnabled: false,
    whStart: '09:00',
    whEnd: '18:00',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const mutation = useMutation({
    mutationFn: () => branchApi.create({
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      contactPerson: form.contactPerson.trim(),
      ...(form.city.trim() && { city: form.city.trim() }),
      ...(form.state.trim() && { state: form.state.trim() }),
      workingHours: {
        enabled: form.whEnabled,
        startTime: form.whStart.trim() || '09:00',
        endTime: form.whEnd.trim() || '18:00',
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      Alert.alert('Success', 'Branch created', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
  });

  const validate = () => {
    const e: { [key: string]: string } = {};
    if (!form.name.trim()) e.name = 'Branch name is required';
    if (!form.code.trim()) e.code = 'Branch code is required';
    else if (form.code.trim().length < 2 || form.code.trim().length > 10) e.code = 'Code must be 2–10 characters';
    if (!form.type) e.type = 'Branch type is required';
    if (!form.contactPerson.trim()) e.contactPerson = 'Contact person is required';
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
          label={t('branch.branchName')}
          value={form.name}
          onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
          placeholder={t('branch.branchNamePlaceholder')}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => codeRef.current?.focus()}
        />

        <AppInput
          ref={codeRef}
          label={t('branch.branchCode')}
          value={form.code}
          onChangeText={(v: string) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
          placeholder={t('branch.branchCodePlaceholder')}
          error={errors.code}
          autoCapitalize="characters"
          returnKeyType="next"
          onSubmitEditing={() => contactRef.current?.focus()}
        />

        <View style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('branch.type')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {BRANCH_TYPE_KEYS.map((bt) => {
              const selected = form.type === bt.value;
              return (
                <TouchableOpacity
                  key={bt.value}
                  onPress={() => setForm((f) => ({ ...f, type: bt.value }))}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: theme.borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? theme.colors.primary + '15' : theme.colors.inputBackground,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[theme.typography.body, { color: selected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: selected ? '600' : '400' }]}>
                    {t(bt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.type ? (
            <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 4 }]}>{errors.type}</Text>
          ) : null}
        </View>

        <AppInput
          ref={contactRef}
          label={t('branch.contactPerson')}
          value={form.contactPerson}
          onChangeText={(v: string) => setForm((f) => ({ ...f, contactPerson: v }))}
          placeholder={t('branch.contactPlaceholder')}
          error={errors.contactPerson}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => cityRef.current?.focus()}
        />

        <AppInput
          ref={cityRef}
          label={t('branch.city')}
          value={form.city}
          onChangeText={(v: string) => setForm((f) => ({ ...f, city: v }))}
          placeholder={t('branch.cityPlaceholder')}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => stateRef.current?.focus()}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
        />

        <AppInput
          ref={stateRef}
          label={t('branch.state')}
          value={form.state}
          onChangeText={(v: string) => setForm((f) => ({ ...f, state: v }))}
          placeholder={t('branch.statePlaceholder')}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
        />

        {/* Working Hours */}
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>
          {t('signOff.workingHours').toUpperCase()}
        </Text>
        <TouchableOpacity
          onPress={() => setForm((f) => ({ ...f, whEnabled: !f.whEnabled }))}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.sm }}
          activeOpacity={0.7}
        >
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{t('signOff.enabled')}</Text>
          <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form.whEnabled ? theme.colors.primary : theme.colors.border, justifyContent: 'center', paddingHorizontal: 2 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: form.whEnabled ? 'flex-end' : 'flex-start' }} />
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
          title={t('branch.createBtn')}
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
