import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'document-outline', title, subtitle }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }}>
      <Ionicons name={icon} size={64} color={theme.colors.border} />
      <Text style={[theme.typography.h3, { color: theme.colors.textSecondary, marginTop: theme.spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.sm, textAlign: 'center' }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
