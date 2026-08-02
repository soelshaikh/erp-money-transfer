import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  style?: ViewStyle;
}

export function AppButton({ title, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const theme = useTheme();

  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  const bgColor = disabled || loading
    ? theme.colors.border
    : isDanger
      ? theme.colors.error
      : isOutline
        ? 'transparent'
        : theme.colors.primary;

  const textColor = isOutline
    ? theme.colors.primary
    : theme.colors.textOnPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        {
          backgroundColor: bgColor,
          borderColor: isOutline ? theme.colors.primary : 'transparent',
          borderWidth: isOutline ? 1.5 : 0,
          borderRadius: theme.borderRadius.md,
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? theme.colors.primary : '#fff'} />
      ) : (
        <Text style={[theme.typography.label, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
});
