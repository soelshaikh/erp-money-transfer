import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';
import { withAlpha } from '../../utils/colors';

export interface ActionSheetOption {
  icon: string;
  label: string;
  subtitle?: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

export function AppActionSheet({ visible, title, subtitle, options, onClose }: Props) {
  const theme = useTheme();

  const variantColor = (variant: ActionSheetOption['variant']) => {
    if (variant === 'danger') return theme.colors.error;
    if (variant === 'success') return theme.colors.success;
    if (variant === 'warning') return (theme.colors as any).warning ?? '#d97706';
    return theme.colors.text;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.divider, alignSelf: 'center', marginTop: 10, marginBottom: 16 }} />

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>

        {/* Options */}
        {options.map((opt, idx) => {
          const color = variantColor(opt.variant);
          return (
            <TouchableOpacity
              key={idx}
              onPress={opt.onPress}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: idx < options.length - 1 ? 1 : 0, borderBottomColor: theme.colors.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(color, 0.1), justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name={opt.icon as any} size={19} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.body, { color, fontWeight: '600' }]}>{opt.label}</Text>
                {opt.subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>{opt.subtitle}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Cancel */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={{ marginHorizontal: 20, marginTop: 10, paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' }}
        >
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
