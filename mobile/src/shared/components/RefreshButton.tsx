import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';

interface Props {
  onPress: () => void;
  isFetching?: boolean;
  style?: any;
}

export function RefreshButton({ onPress, isFetching, style }: Props) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isFetching}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[{ padding: 4 }, style]}
    >
      <Ionicons
        name="refresh-outline"
        size={20}
        color={isFetching ? theme.colors.textSecondary : theme.colors.primary}
      />
    </TouchableOpacity>
  );
}
