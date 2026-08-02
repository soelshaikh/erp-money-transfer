import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../../utils/colors';
import { fmtDate } from '../../utils/fmt';

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const PRESETS = [
  {
    label: 'Today',
    range: (): { from: string; to: string } => {
      const d = toYMD(new Date());
      return { from: d, to: d };
    },
  },
  {
    label: 'Yesterday',
    range: (): { from: string; to: string } => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const s = toYMD(d);
      return { from: s, to: s };
    },
  },
  {
    label: 'Last 7',
    range: (): { from: string; to: string } => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toYMD(from), to: toYMD(to) };
    },
  },
  {
    label: 'This Week',
    range: (): { from: string; to: string } => {
      const now = new Date();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      return { from: toYMD(mon), to: toYMD(now) };
    },
  },
  {
    label: 'This Month',
    range: (): { from: string; to: string } => {
      const now = new Date();
      return {
        from: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toYMD(now),
      };
    },
  },
  {
    label: 'Last Month',
    range: (): { from: string; to: string } => {
      const now = new Date();
      return {
        from: toYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toYMD(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
];

interface Props {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  theme: any;
}

export function DateRangeFilter({ fromDate, toDate, onFromChange, onToChange, theme }: Props) {
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.from === fromDate && r.to === toDate;
  })?.label;

  const pickerDate =
    pickerTarget === 'from'
      ? fromDate ? fromYMD(fromDate) : new Date()
      : toDate ? fromYMD(toDate) : new Date();

  const handlePickerChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
      setPickerTarget(null);
    }
    if (!selected) return;
    const ymd = toYMD(selected);
    if (pickerTarget === 'from') {
      onFromChange(ymd);
      if (toDate && ymd > toDate) onToChange(ymd);
    } else {
      onToChange(ymd);
      if (fromDate && ymd < fromDate) onFromChange(ymd);
    }
  };

  const toggleTarget = (target: 'from' | 'to') => {
    if (pickerTarget === target) {
      setPickerTarget(null);
    } else {
      setPickerTarget(target);
      if (Platform.OS === 'android') setShowAndroidPicker(true);
    }
  };

  const dateBtn = (target: 'from' | 'to', value: string, placeholder: string) => {
    const isActive = pickerTarget === target;
    const hasValue = !!value;
    return (
      <TouchableOpacity
        onPress={() => toggleTarget(target)}
        activeOpacity={0.7}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.sm,
          borderWidth: 1.5,
          borderColor: isActive ? theme.colors.primary : theme.colors.border,
          backgroundColor: isActive
            ? withAlpha(theme.colors.primary, 0.08)
            : (theme.colors.inputBackground ?? theme.colors.background),
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={hasValue ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text
          style={{ fontSize: 13, color: hasValue ? theme.colors.text : theme.colors.textSecondary }}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {hasValue ? fmtDate(fromYMD(value)) : placeholder}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ marginBottom: theme.spacing.sm }}>
      {/* Preset chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 10 }}
        contentContainerStyle={{ gap: 6, paddingRight: 4 }}
      >
        {PRESETS.map((p) => {
          const active = activePreset === p.label;
          return (
            <TouchableOpacity
              key={p.label}
              onPress={() => {
                const r = p.range();
                onFromChange(r.from);
                onToChange(r.to);
                setPickerTarget(null);
              }}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.07),
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.2),
              }}
            >
              <Text
                style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : theme.colors.primary }}
                allowFontScaling={false}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* From → To date buttons */}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {dateBtn('from', fromDate, 'From')}
        <Ionicons name="arrow-forward" size={14} color={theme.colors.textSecondary} />
        {dateBtn('to', toDate, 'To')}
      </View>

      {/* iOS inline spinner */}
      {Platform.OS === 'ios' && pickerTarget !== null && (
        <View style={{
          marginTop: 8,
          backgroundColor: withAlpha(theme.colors.primary, 0.04),
          borderRadius: theme.borderRadius.sm,
          overflow: 'hidden',
        }}>
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            style={{ width: '100%', height: 150 }}
            onChange={handlePickerChange}
          />
          <TouchableOpacity
            onPress={() => setPickerTarget(null)}
            style={{
              alignSelf: 'flex-end',
              margin: 8,
              paddingVertical: 6,
              paddingHorizontal: 16,
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.sm,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} allowFontScaling={false}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Android native dialog */}
      {Platform.OS === 'android' && showAndroidPicker && pickerTarget !== null && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}
