import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'tournamate.deviceId';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = uuidv4();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
  return fresh;
}
