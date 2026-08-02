import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppCard } from './AppCard';
import { AppButton } from './AppButton';

interface Props {
  visible: boolean;
  onClear: () => void;
  onApply: () => void;
  theme: any;
  children: React.ReactNode;
  style?: any;
}

export function FilterPanel({ visible, onClear, onApply, theme, children, style }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <AppCard style={[{ marginBottom: theme.spacing.sm }, style]}>
      {children}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <AppButton title={t('common.clear')} variant="outline" onPress={onClear} style={{ flex: 1 }} />
        <AppButton title={t('common.apply')} onPress={onApply} style={{ flex: 2 }} />
      </View>
    </AppCard>
  );
}
