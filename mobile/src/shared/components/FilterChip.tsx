import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { withAlpha } from '../../utils/colors';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}

export function FilterChip({ label, active, onPress, theme }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.07),
        borderWidth: 1,
        borderColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.2),
      }}
    >
      <Text
        style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : theme.colors.primary }}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
