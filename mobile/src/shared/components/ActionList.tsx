import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';
import { AppCard } from './AppCard';

export interface ActionItemProps {
  icon: string;
  label: string;
  value?: string;
  subtitle?: string;
  onPress: () => void;
  variant?: 'default' | 'danger';
  loading?: boolean;
  isLast?: boolean;
}

export function ActionItem({
  icon, label, value, subtitle, onPress,
  variant = 'default', loading = false, isLast = false,
}: ActionItemProps) {
  const theme = useTheme();
  const isDanger = variant === 'danger';
  const tint = isDanger ? theme.colors.error : theme.colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: theme.spacing.md,
        minHeight: 50,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.divider,
      }}
    >
      <View style={{ width: 30, alignItems: 'center', marginRight: theme.spacing.sm }}>
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.body, { color: isDanger ? theme.colors.error : theme.colors.text }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginRight: 4, maxWidth: 130, textAlign: 'right' }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {value}
        </Text>
      ) : null}
      {loading
        ? <ActivityIndicator size="small" color={tint} />
        : <Ionicons name="chevron-forward" size={15} color={theme.colors.textSecondary} />
      }
    </TouchableOpacity>
  );
}

interface ActionListProps {
  title?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function ActionList({ title, style, children }: ActionListProps) {
  const theme = useTheme();
  return (
    <View style={[{ marginBottom: theme.spacing.md }, style]}>
      {title ? (
        <Text
          style={[
            theme.typography.label,
            { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, paddingHorizontal: 2, letterSpacing: 0.4, fontSize: 11 },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <AppCard padding={false} style={{ overflow: 'hidden' }}>
        {children}
      </AppCard>
    </View>
  );
}
