import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/TenantThemeProvider';

type StatusKey = 'pending' | 'approved' | 'rejected' | 'completed';

interface StatusConfig {
  label: string;
  colorKey: string;
}

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  pending: { label: 'Pending', colorKey: 'statusPending' },
  approved: { label: 'Approved', colorKey: 'statusApproved' },
  rejected: { label: 'Rejected', colorKey: 'statusRejected' },
  completed: { label: 'Completed', colorKey: 'statusCompleted' },
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const theme = useTheme();
  const config: StatusConfig = STATUS_CONFIG[status as StatusKey] || { label: status, colorKey: 'textSecondary' };
  const color = (theme.colors as any)[config.colorKey];

  return (
    <View style={{ backgroundColor: color + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full, alignSelf: 'flex-start' }}>
      <Text style={[theme.typography.caption, { color, fontWeight: '600' }]} allowFontScaling={false} numberOfLines={1}>
        {config.label.toUpperCase()}
      </Text>
    </View>
  );
}
