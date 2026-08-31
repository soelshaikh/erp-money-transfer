import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';
import { withAlpha } from '../../utils/colors';

interface Branch {
  _id: string;
  code: string;
  name?: string;
}

interface Props {
  branches: Branch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

export function BranchCodeDropdown({
  branches, selectedId, onSelect, placeholder = 'Select branch', label, error,
}: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = branches.find((b) => b._id === selectedId);

  const filtered = useMemo(() => {
    if (!query.trim()) return branches;
    const q = query.toLowerCase();
    return branches.filter(
      (b) => b.code.toLowerCase().includes(q) || (b.name?.toLowerCase().includes(q) ?? false),
    );
  }, [branches, query]);

  const handleSelect = (id: string) => {
    onSelect(id);
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

      {/* Trigger */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.inputBackground,
            borderColor: error ? theme.colors.error : theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.body,
            { color: selected ? theme.colors.text : theme.colors.textSecondary, flex: 1, fontWeight: selected ? '700' : '400' },
          ]}
          allowFontScaling={false}
        >
          {selected ? selected.code : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.error, marginTop: 4 }]}>{error}</Text>
      ) : null}

      {/* Modal picker */}
      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
            <Text style={[theme.typography.label, { color: theme.colors.text, flex: 1, fontSize: 16 }]}>
              {label || 'Select Branch'}
            </Text>
            <TouchableOpacity onPress={close} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
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
              placeholder="Search branch code..."
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

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item._id === selectedId;
              return (
                <TouchableOpacity
                  onPress={() => handleSelect(item._id)}
                  activeOpacity={0.6}
                  style={[
                    styles.item,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: isSelected ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[theme.typography.body, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '400', flex: 1 }]}
                    allowFontScaling={false}
                  >
                    {item.code}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={theme.colors.primary} /> : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="search-outline" size={32} color={theme.colors.border} />
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                  No branches found
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
