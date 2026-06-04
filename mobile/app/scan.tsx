import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const handledRef = useRef(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  function handleScan(data: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setLastScan(data);

    const slug = extractTournamentSlug(data);
    if (slug) {
      router.replace({
        pathname: '/[tournamentSlug]',
        params: { tournamentSlug: slug },
      });
      return;
    }

    Alert.alert(
      'Code not recognised',
      `This QR code doesn't look like a Tournamate tournament link.\n\nRaw value: ${data}`,
      [
        { text: 'Scan again', onPress: () => (handledRef.current = false) },
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
      ],
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Scan' }} />
        <View style={styles.centered}>
          <Text style={styles.text}>Loading camera…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Scan' }} />
        <View style={styles.centered}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.text}>
            Tournamate uses the camera to scan tournament QR codes at venues.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fullscreen}>
      <Stack.Screen options={{ title: 'Scan QR' }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(result) => handleScan(result.data)}
      />
      <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Point at a Tournamate QR code</Text>
        </View>
        {lastScan ? (
          <View style={styles.lastScanPill}>
            <Text style={styles.lastScanText} numberOfLines={1}>
              Last: {lastScan}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

/**
 * Parse a scanned QR value. Returns the tournament slug if the QR encodes a
 * tournamate.app tournament URL, otherwise null.
 *
 * Accepts (case-insensitive on host):
 *   https://tournamate.app/<slug>
 *   https://www.tournamate.app/<slug>
 *   tournamate://<slug>            (the app's own deep-link scheme)
 *
 * Anything else returns null so the caller can show a fallback message.
 */
export function extractTournamentSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Deep link form
  if (/^tournamate:\/\//i.test(trimmed)) {
    const after = trimmed.replace(/^tournamate:\/\//i, '');
    const slug = after.split(/[\/?#]/)[0];
    return slug || null;
  }

  // HTTPS link form
  const match = trimmed.match(
    /^https?:\/\/(?:www\.)?tournamate\.app\/([^\/?#]+)/i,
  );
  if (match) return match[1];

  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  text: { color: '#475569', textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '600' },

  overlayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  frameWrap: { alignItems: 'center', marginTop: 80 },
  frame: {
    width: 240,
    height: 240,
    borderColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  frameHint: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  lastScanPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: '85%',
  },
  lastScanText: { color: '#ffffff', fontSize: 12 },
});
