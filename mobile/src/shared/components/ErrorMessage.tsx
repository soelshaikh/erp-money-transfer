import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  message?: string | null;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: Props) {
  const theme = useTheme();
  if (!message) return null;

  const lines = message.split('\n').filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: '#FFF0F0',
        borderColor: theme.colors.error,
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: theme.spacing.md,
      }}
    >
      <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {lines.map((line, i) => (
          <Text
            key={i}
            style={[theme.typography.bodySmall, { color: theme.colors.error, marginTop: i > 0 ? 4 : 0 }]}
          >
            {lines.length > 1 ? `• ${line}` : line}
          </Text>
        ))}
      </View>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={[theme.typography.label, { color: theme.colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
