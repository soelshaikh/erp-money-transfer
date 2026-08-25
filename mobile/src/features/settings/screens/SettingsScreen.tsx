import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/TenantThemeProvider';
import { useAuthStore } from '../../../store/authStore';
import { useLangStore } from '../../../store/langStore';
import { settingsApi } from '../api/settingsApi';
import { signOffApi } from '../../signOff/api/signOffApi';
import { AppCard } from '../../../shared/components/AppCard';
import { AppButton } from '../../../shared/components/AppButton';
import { LoadingScreen } from '../../../shared/components/LoadingScreen';
import { withAlpha } from '../../../utils/colors';
import { FEATURES } from '../../../config/features';

interface SettingRowProps {
  label: string;
  value: any;
  theme: any;
}

function SettingRow({ label, value, theme }: SettingRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm }}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[theme.typography.label, { color: theme.colors.text }]}>{String(value ?? '—')}</Text>
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, tenant, logout, signOff } = useAuthStore();
  const [signingOff, setSigningOff] = useState(false);
  const { lang, setLang } = useLangStore();
  const isHeadOffice = (user as any)?.role === 'head_office';
  const isBranch = (user as any)?.role === 'branch';

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60_000,
  });

  const confirmLogout = () => {
    Alert.alert(t('common.signOut'), t('common.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: logout },
    ]);
  };

  const confirmSignOff = () => {
    Alert.alert(
      t('signOff.title'),
      t('signOff.confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('signOff.title'),
          style: 'destructive',
          onPress: async () => {
            if (signingOff) return;
            setSigningOff(true);
            try {
              await signOffApi.signOff();
            } catch (_e) { /* ignore — still sign off locally */ }
            await signOff((user as any)?._id || (user as any)?.id || '');
          },
        },
      ]
    );
  };

  if (isLoading) return <LoadingScreen />;

  const settings = (data as any)?.settings;
  const features = (data as any)?.features;
  const branding = (data as any)?.branding;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md }}
    >
      {/* Profile */}
      <AppCard style={{ marginBottom: theme.spacing.md, alignItems: 'center', paddingVertical: theme.spacing.lg }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: withAlpha(theme.colors.primary, 0.12), justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <Text style={[theme.typography.h2, { color: theme.colors.primary }]}>{(user as any)?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{(user as any)?.name}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>@{(user as any)?.username}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.primary, marginTop: 4 }]}>{(user as any)?.role?.replace('_', ' ').toUpperCase()}</Text>
      </AppCard>

      {/* Language */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {t('settings.language').toUpperCase()}
        </Text>
        <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: theme.spacing.sm }} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <TouchableOpacity
            onPress={() => setLang('en')}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.borderRadius.md,
              alignItems: 'center',
              backgroundColor: lang === 'en' ? theme.colors.primary : withAlpha(theme.colors.primary, 0.08),
              borderWidth: 1,
              borderColor: lang === 'en' ? theme.colors.primary : theme.colors.border,
            }}
          >
            <Text style={[theme.typography.label, { color: lang === 'en' ? '#fff' : theme.colors.primary }]}>
              {t('settings.english')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLang('gu')}
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.borderRadius.md,
              alignItems: 'center',
              backgroundColor: lang === 'gu' ? theme.colors.primary : withAlpha(theme.colors.primary, 0.08),
              borderWidth: 1,
              borderColor: lang === 'gu' ? theme.colors.primary : theme.colors.border,
            }}
          >
            <Text style={[theme.typography.label, { color: lang === 'gu' ? '#fff' : theme.colors.primary }]}>
              {t('settings.gujarati')} (ગુ)
            </Text>
          </TouchableOpacity>
        </View>
      </AppCard>

      {/* Company info */}
      <AppCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
          {t('settings.company').toUpperCase()}
        </Text>
        <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <SettingRow label={t('settings.companyName')} value={branding?.appName || (tenant as any)?.name} theme={theme} />
        <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <SettingRow label={t('settings.companyId')} value={(tenant as any)?.slug} theme={theme} />
        <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <SettingRow label={t('settings.timezone')} value={settings?.timezone} theme={theme} />
        <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{t('settings.commission')}</Text>
            <View style={{ backgroundColor: withAlpha(theme.colors.primary, 0.12), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700', fontSize: 9 }]} allowFontScaling={false}>GLOBAL</Text>
            </View>
          </View>
          <Text style={[theme.typography.label, { color: theme.colors.text }]}>
            {settings?.commission
              ? (settings.commission.type === 'flat' ? `₹ ${settings.commission.value}` : `${settings.commission.value}%`)
              : '—'}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <View style={{ paddingVertical: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, lineHeight: 16 }]}>
            Branches can override this with their own rate. Override is visible in the Branches tab.
          </Text>
        </View>
      </AppCard>

      {/* Features */}
      {features && (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {t('settings.features').toUpperCase()}
          </Text>
          <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
          {features.reportExport !== undefined && (
            <SettingRow
              label={t('settings.reportExport')}
              value={features.reportExport ? t('common.enabled') : t('common.disabled')}
              theme={theme}
            />
          )}
          {features.exportFormats && features.exportFormats.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, alignItems: 'center' }}>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Export Formats</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['csv', 'excel', 'pdf'] as const).map((fmt) => {
                    const enabled = (features.exportFormats as string[]).includes(fmt);
                    return (
                      <View
                        key={fmt}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: enabled ? withAlpha(theme.colors.primary, 0.12) : withAlpha(theme.colors.divider, 0.5),
                        }}
                      >
                        <Text
                          style={[theme.typography.caption, { color: enabled ? theme.colors.primary : theme.colors.textSecondary, fontWeight: '600' }]}
                          allowFontScaling={false}
                        >
                          {fmt.toUpperCase()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </AppCard>
      )}

      {/* HQ Commission — branch users only */}
      {isBranch && (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            COMMISSION
          </Text>
          <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
          <TouchableOpacity
            onPress={() => navigation.navigate('HQCommissionItems')}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}
            activeOpacity={0.7}
          >
            <Ionicons name="cash-outline" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.label, { color: theme.colors.text }]}>HQ Commission</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                Settle commission owed to head office
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </AppCard>
      )}

      {/* Activity — hidden when FEATURES.SHOW_LOGIN_ACTIVITY is false and user is branch */}
      {(FEATURES.SHOW_LOGIN_ACTIVITY || isHeadOffice) && (
        <AppCard style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            ACTIVITY
          </Text>
          {FEATURES.SHOW_LOGIN_ACTIVITY && (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              <TouchableOpacity
                onPress={() => navigation.navigate('LoginActivity')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}
              >
                <Ionicons name="log-in-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.label, { color: theme.colors.text }]}>Login Activity</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    {isHeadOffice ? 'All staff login history & active sessions' : 'Your login history & active devices'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
          {isHeadOffice && (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              <TouchableOpacity
                onPress={() => navigation.navigate('ActivityLog')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}
              >
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.label, { color: theme.colors.text }]}>Full Audit Log</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    All system activity across branches
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              <TouchableOpacity
                onPress={() => navigation.navigate('DaySignOffs')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}
              >
                <Ionicons name="moon-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.label, { color: theme.colors.text }]}>{t('signOff.staffSignOffs')}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    {t('signOff.staffSignOffsHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </AppCard>
      )}

      {isHeadOffice && (
        <AppButton
          title={t('settings.editSettings')}
          onPress={() => navigation.navigate('EditSettings')}
          style={{ marginBottom: theme.spacing.sm }}
        />
      )}
      {isBranch && (
        <AppButton
          title={signingOff ? '...' : t('signOff.title')}
          onPress={confirmSignOff}
          variant="outline"
          style={{ marginBottom: theme.spacing.sm, borderColor: theme.colors.warning }}
        />
      )}
      <AppButton title={t('common.signOut')} onPress={confirmLogout} variant="outline" />
    </ScrollView>
  );
}
