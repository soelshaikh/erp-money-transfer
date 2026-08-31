import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CONFIG = {
  success: { bg: '#10B981', icon: 'checkmark-circle' as const },
  error:   { bg: '#EF4444', icon: 'close-circle' as const },
  warning: { bg: '#F59E0B', icon: 'warning' as const },
  info:    { bg: '#3B82F6', icon: 'information-circle' as const },
};

function ToastBase({ type, text1, text2 }: { type: keyof typeof CONFIG; text1?: string; text2?: string }) {
  const { bg, icon } = CONFIG[type];
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color="rgba(255,255,255,0.95)" />
      <View style={{ flex: 1 }}>
        {text1 ? <Text style={styles.title} numberOfLines={2}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message} numberOfLines={3}>{text2}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 7,
    minHeight: 52,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 19,
  },
  message: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
});

export const toastConfig = {
  success: ({ text1, text2 }: any) => <ToastBase type="success" text1={text1} text2={text2} />,
  error:   ({ text1, text2 }: any) => <ToastBase type="error"   text1={text1} text2={text2} />,
  warning: ({ text1, text2 }: any) => <ToastBase type="warning" text1={text1} text2={text2} />,
  info:    ({ text1, text2 }: any) => <ToastBase type="info"    text1={text1} text2={text2} />,
};
