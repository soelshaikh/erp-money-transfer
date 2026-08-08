import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  StatusBar, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useConfigStore } from '../../../store/configStore';
import { apiClient } from '../../../api/client';
import { getOrCreateDeviceId, getDeviceName } from '../../../utils/deviceId';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

const LINE_HEIGHT   = 36;
const LINE_COLOR    = '#C8D6E0';
const PAPER_COLOR   = '#FDFCF5';
const INK_COLOR     = '#2C3E50';
const MARGIN_COLOR  = '#E8A0A0';

export function NotesScreen() {
  const { t } = useTranslation();
  const { branchCode, save, deviceApprovalStatus, setDeviceStatus } = useConfigStore();

  // Mode: 'gate' = secret code entry, 'slug' = company slug entry (existing behaviour)
  const mode = deviceApprovalStatus === 'approved' ? 'slug' : 'gate';

  const [text, setText] = useState<string>(mode === 'slug' ? (branchCode || '') : '');
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // ── Gate mode: validate secret code against backend ──────────────────────
  const handleGateSave = async () => {
    if (loading) return;
    const trimmed = text.trim();
    if (!trimmed) { setSaved(true); return; }

    setLoading(true);
    try {
      const deviceId   = await getOrCreateDeviceId();
      const deviceName = getDeviceName();
      const res = await apiClient.post('/app-install/request-access', {
        secretCode: trimmed,
        deviceId,
        deviceName,
        platform: Platform.OS,
      });
      const status: string = res.data?.data?.status;
      if (status === 'approved') {
        await setDeviceStatus('approved');
        Alert.alert('✅ Approved', 'Device approved! Now enter your company slug.');
      } else {
        Alert.alert('❌ Wrong Code', `Server returned: "${status}"\nYou entered: "${trimmed}"`);
      }
    } catch (e: any) {
      Alert.alert('🔴 Network Error', `Could not reach the server.\n\n${e?.message || 'Unknown error'}\n\nURL: ${e?.config?.url || 'n/a'}`);
    }
    setSaved(true);
    setLoading(false);
  };

  // ── Slug mode: existing behaviour (validate company, save slug) ──────────
  const handleSlugSave = async () => {
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
      if (!data?.valid || data?.status !== 'active') {
        setSaved(true);
        setLoading(false);
        return;
      }
    } catch (_e) {}
    setLoading(false);
    await save(trimmed);
    setSaved(true);
  };

  const handleSave = mode === 'gate' ? handleGateSave : handleSlugSave;

  const saveBtnLabel = loading
    ? '...'
    : saved
      ? `${t('common.success')} ✓`
      : t('common.done');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#E8E0D0" />

      <View style={styles.header}>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>{saveBtnLabel}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.paper}>
        <View style={styles.margin} />
        <View style={styles.linesContainer} pointerEvents="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <View key={i} style={[styles.line, { top: LINE_HEIGHT * (i + 1) }]} />
          ))}
        </View>
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

      <View style={styles.footer}>
        {mode === 'gate' && <Text style={styles.devHintText}>DEV: ERP@Secret2024</Text>}
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
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
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  devHintText: {
    fontSize: 13,
    color: '#E74C3C',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  versionText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
});
