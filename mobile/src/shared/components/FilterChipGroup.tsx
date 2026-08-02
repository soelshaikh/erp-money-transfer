import React from 'react';
import { View, Text } from 'react-native';
import { FilterChip } from './FilterChip';

export interface ChipOption {
  label: string;
  value: string;
}

interface Props {
  options: ChipOption[];
  selected: string;
  onSelect: (value: string) => void;
  theme: any;
  label?: string;
}

export function FilterChipGroup({ options, selected, onSelect, theme, label }: Props) {
  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      {label ? (
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={selected === opt.value}
            onPress={() => onSelect(opt.value)}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
}
