import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  count: number;
  color: string;
}

export function BadgeCount({ count, color }: Props) {
  if (!count) return null;
  return (
    <View style={{
      position: 'absolute',
      top: -4,
      right: -8,
      backgroundColor: color,
      borderRadius: 9999,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    }}>
      <Text
        style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}
        allowFontScaling={false}
      >
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
