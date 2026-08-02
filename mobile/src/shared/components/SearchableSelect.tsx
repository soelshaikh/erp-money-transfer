import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';

export interface SelectItem {
  value: any;
  label: string;
  sublabel?: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  items: SelectItem[];
  selectedValue: any;
  onSelect: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label, placeholder = 'Select...', items, selectedValue, onSelect, error, disabled,
}: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = items.find((i) => i.value === selectedValue);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || (i.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  const handleSelect = (value: any) => {
    onSelect(value);
    setOpen(false);
    setQuery('');
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={() => { if (!disabled) setOpen(true); }}
        activeOpacity={0.7}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.inputBackground,
            borderColor: error ? theme.colors.error : theme.colors.border,
            borderRadius: theme.borderRadius.md,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {selected ? (
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>{selected.label}</Text>
            {selected.sublabel ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                {selected.sublabel}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, flex: 1 }]}>
            {placeholder}
          </Text>
        )}
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 4 }]}>{error}</Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
            <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1, fontSize: 16 }]}>
              {label || 'Select'}
            </Text>
            <TouchableOpacity onPress={close} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[
            styles.searchRow,
            {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius.md,
              margin: 16,
            },
          ]}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} style={{ marginLeft: 12 }} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or code..."
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
              style={[theme.typography.body, { flex: 1, color: theme.colors.text, paddingHorizontal: 10, paddingVertical: 10 }]}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} style={{ paddingRight: 12 }}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <TouchableOpacity
                  onPress={() => handleSelect(item.value)}
                  activeOpacity={0.6}
                  style={[
                    styles.item,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.primary + '10' : 'transparent',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.body, { color: theme.colors.text, fontWeight: isSelected ? '600' : '400' }]}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={theme.colors.primary} /> : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="search-outline" size={32} color={theme.colors.border} />
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                  No results found
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
