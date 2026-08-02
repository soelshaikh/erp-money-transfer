import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  StatusBar, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../../store/configStore';
import { apiClient } from '../../../api/client';

// Notepad line height — fixed, no theme dependency (this screen has no tenant branding)
const LINE_HEIGHT = 36;
const LINE_COLOR = '#C8D6E0';
const PAPER_COLOR = '#FDFCF5';
const INK_COLOR = '#2C3E50';
const MARGIN_COLOR = '#E8A0A0';

export function NotesScreen() {
  const { t } = useTranslation();
  const { branchCode, save } = useConfigStore();
  const [text, setText] = useState<string>(branchCode || '');
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSave = async () => {
    if (loading) return;
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert(t('auth.companyId'), t('auth.companyIdPlaceholder'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get('/auth/validate-company', { params: { slug: trimmed } });
      const data = res.data?.data;
      // Company not found or not active — fake "saved" but don't navigate
      if (!data?.valid || data?.status !== 'active') {
        setSaved(true);
        setLoading(false);
        return;
      }
    } catch {
      // Network unreachable — proceed to login anyway; login will handle it
    }
    setLoading(false);
    await save(trimmed);
    setSaved(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={PAPER_COLOR} />

      {/* Top bar — looks like a notes app header */}
      <View style={styles.header}>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>{saved ? `${t('common.success')} ✓` : t('common.done')}</Text>
        </TouchableOpacity>
      </View>

      {/* Notepad paper */}
      <View style={styles.paper}>
        {/* Red margin line */}
        <View style={styles.margin} />

        {/* Lined background — decorative lines behind the input */}
        <View style={styles.linesContainer} pointerEvents="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <View key={i} style={[styles.line, { top: LINE_HEIGHT * (i + 1) }]} />
          ))}
        </View>

        {/* Actual text input */}
        <TextInput
          value={text}
          onChangeText={(v: string) => { setText(v); setSaved(false); }}
          placeholder="Write here..."
          placeholderTextColor="#BBCAD2"
          multiline
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8E0D0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: '#E8E0D0',
  },
  headerDate: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#FDFCF5',
    fontWeight: '700',
    fontSize: 14,
  },
  paper: {
    flex: 1,
    backgroundColor: PAPER_COLOR,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  margin: {
    position: 'absolute',
    left: 52,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: MARGIN_COLOR,
  },
  linesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LINE_COLOR,
  },
  input: {
    flex: 1,
    paddingLeft: 64,
    paddingRight: 20,
    paddingTop: 10,
    fontSize: 18,
    lineHeight: LINE_HEIGHT,
    color: INK_COLOR,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Light' : undefined,
    textAlignVertical: 'top',
  },
});
