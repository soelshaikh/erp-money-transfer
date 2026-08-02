import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = 'app_device_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) return stored;
    const id = generateUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return generateUUID();
  }
}

export function getDeviceName(): string {
  const name = (Constants as any).deviceName;
  if (name && typeof name === 'string') return name;
  return `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} Device`;
}
