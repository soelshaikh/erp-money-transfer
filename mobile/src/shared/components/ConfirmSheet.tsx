import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/TenantThemeProvider';
import { withAlpha } from '../../utils/colors';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  icon?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, loading = false, icon, onConfirm, onClose,
}: Props) {
  const theme = useTheme();
  const confirmColor = destructive ? theme.colors.error : theme.colors.primary;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={!loading ? onClose : undefined} />
      <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.divider, alignSelf: 'center', marginTop: 10, marginBottom: 20 }} />

        {/* Icon */}
        {icon ? (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: withAlpha(confirmColor, 0.12), justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 }}>
            <Ionicons name={icon as any} size={26} color={confirmColor} />
          </View>
        ) : null}

        {/* Title + message */}
        <Text style={[theme.typography.h3, { color: theme.colors.text, marginBottom: message ? 6 : 20 }]}>{title}</Text>
        {message ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: 20, lineHeight: 22 }]}>{message}</Text> : null}

        {/* Buttons */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={onClose}
            disabled={loading}
            activeOpacity={0.7}
            style={{ flex: 1, paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.inputBackground, alignItems: 'center' }}
          >
            <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.8}
            style={{ flex: 1, paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: confirmColor, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[theme.typography.label, { color: '#fff' }]}>{confirmLabel}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
