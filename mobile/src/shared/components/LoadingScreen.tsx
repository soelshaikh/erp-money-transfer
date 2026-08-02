import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? (
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: theme.spacing.md }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
