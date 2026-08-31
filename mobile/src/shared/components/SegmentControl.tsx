import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/TenantThemeProvider';
import { withAlpha } from '../../utils/colors';

export interface SegmentOption {
  label: string;
  value: string;
  subtitle?: string;
}

interface Props {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
}

export function SegmentControl({ options, value, onChange, size = 'md' }: Props) {
  const theme = useTheme();
  const paddingV = size === 'sm' ? 7 : 10;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: paddingV,
              paddingHorizontal: 6,
              borderRadius: theme.borderRadius.md,
              borderWidth: 1.5,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              backgroundColor: active ? withAlpha(theme.colors.primary, 0.08) : theme.colors.inputBackground,
              alignItems: 'center',
            }}
          >
            <Text
              style={[
                theme.typography.label,
                {
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  textAlign: 'center',
                  fontSize: size === 'sm' ? 12 : 13,
                },
              ]}
              allowFontScaling={false}
            >
              {opt.label}
            </Text>
            {opt.subtitle ? (
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: active ? theme.colors.primary : theme.colors.textSecondary,
                    textAlign: 'center',
                    marginTop: 2,
                    opacity: 0.75,
                    fontSize: 10,
                  },
                ]}
                allowFontScaling={false}
                numberOfLines={2}
              >
                {opt.subtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
