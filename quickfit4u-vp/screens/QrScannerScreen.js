import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

const COLORS = {
  ink: '#2B3328',
  sageDark: '#5E7A4E',
  gold: '#C9A227',
  cream: '#F5F1E6',
};


export default function QrScannerScreen({ title, instructions, onBack, onScanned, onManualCode, manualLabel }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const lockRef = useRef(false);

  // vision-camera asks for permission itself but doesn't auto-request on mount —
  // do it once up front so the person isn't stuck on a blank screen.
  useEffect(() => {
    if (!hasPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCodeScanned(codes) {
    if (lockRef.current) return;
    const data = codes?.[0]?.value;
    if (!data) return;

    lockRef.current = true;
    setLocked(true);
    setError('');

    let parsed = null;
    try {
      parsed = JSON.parse(data);
    } catch (e) {

    }

    if (!parsed || parsed.app !== 'QuickFit4u') {
      setError("That doesn't look like a QuickFit4u QR code. Try again.");
      setTimeout(() => {
        lockRef.current = false;
        setLocked(false);
      }, 1500);
      return;
    }

    onScanned(parsed);
  }

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: locked ? () => {} : handleCodeScanned,
  });

  async function handleManualSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await onManualCode(code.trim());
    } finally {
      setSubmitting(false);
    }
  }

  if (hasPermission === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.sageDark} />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>QuickFit4u needs your camera to scan QR codes for check-in.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        {!!onManualCode && (
          <TouchableOpacity onPress={() => setManualMode(true)} style={{ marginTop: 20 }}>
            <Text style={styles.manualLink}>Or enter the booking code manually</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (manualMode) {
    return (
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.permTitle}>Enter Booking Code</Text>
        <Text style={styles.permBody}>{manualLabel || 'Type the code shown on the booking (e.g. FI-123456).'}</Text>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="FI-123456"
          placeholderTextColor="#9AA396"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.permBtn} onPress={handleManualSubmit} disabled={submitting || !code.trim()}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.permBtnText}>Check In</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setManualMode(false)} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>‹ Back to scanning</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>No camera found</Text>
        <Text style={styles.permBody}>This device doesn't have a usable back camera.</Text>
        {!!onManualCode && (
          <TouchableOpacity onPress={() => setManualMode(true)} style={{ marginTop: 20 }}>
            <Text style={styles.manualLink}>Enter the booking code manually instead</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={!manualMode}
        codeScanner={codeScanner}
        onInitialized={() => setCameraReady(true)}
        onError={(e) => setError(`Camera error: ${e.message}`)}
      />

      <View style={styles.overlay}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.instructions}>{instructions}</Text>

        <View style={styles.frame}>
          {!cameraReady && (
            <View style={styles.frameLoading}>
              <ActivityIndicator color={COLORS.gold} />
              <Text style={styles.frameLoadingText}>Starting camera…</Text>
            </View>
          )}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {locked && !error && (
          <View style={styles.errorBox}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {!!onManualCode && (
          <TouchableOpacity onPress={() => setManualMode(true)} style={styles.manualBtn}>
            <Text style={styles.manualBtnText}>Trouble scanning? Enter code manually</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, padding: 20, paddingTop: 54, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 24 },
  instructions: { color: '#e8e8e0', fontSize: 13.5, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  frame: {
    width: 240, height: 240, borderRadius: 20, borderWidth: 3, borderColor: COLORS.gold,
    marginTop: 50, alignItems: 'center', justifyContent: 'center',
  },
  frameLoading: { alignItems: 'center', gap: 8 },
  frameLoadingText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  errorBox: { marginTop: 30, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 14, maxWidth: '85%' },
  errorText: { color: '#fff', fontSize: 13.5, textAlign: 'center' },
  center: { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center', padding: 30 },
  permTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  permBody: { fontSize: 13.5, color: '#6B7566', textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingHorizontal: 26, paddingVertical: 14, minWidth: 160, alignItems: 'center' },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backLink: { color: COLORS.sageDark, fontWeight: '700', fontSize: 14 },
  manualBtn: { position: 'absolute', bottom: 40, alignSelf: 'center' },
  manualBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' },
  manualLink: { color: COLORS.sageDark, fontWeight: '700', fontSize: 13.5, textDecorationLine: 'underline' },
  codeInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(43,51,40,0.15)',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', letterSpacing: 1,
    color: COLORS.ink, textAlign: 'center', width: '100%', marginBottom: 20,
  },
});