import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: boolean;
}

export function AppCard({ children, style, padding = true }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: padding ? theme.spacing.md : 0,
          ...theme.shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
