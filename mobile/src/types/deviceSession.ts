export interface DeviceSession {
  _id: string;
  userId: { _id: string; name: string; username: string; role: string } | null;
  deviceId: string;
  deviceName: string;
  platform: string;
  ip: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  suspendedAt: string | null;
}
