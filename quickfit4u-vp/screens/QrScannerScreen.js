import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const COLORS = {
  ink: '#2B3328',
  sageDark: '#5E7A4E',
  gold: '#C9A227',
  cream: '#F5F1E6',
};

// Runs entirely inside the WebView. Uses the browser's own camera pathway
// (getUserMedia) instead of a native RN camera module, and the browser's
// built-in BarcodeDetector API to read QR codes from the live video feed.
// This sidesteps native Camera2/CameraX preview-binding issues entirely,
// since it's a completely different rendering pipeline.
const SCANNER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; background: #000; overflow: hidden; height: 100%; width: 100%; }
    video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <video id="video" autoplay muted playsinline></video>
  <script>
    function send(type, payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
    }

    async function start() {
      if (!('BarcodeDetector' in window)) {
        send('unsupported', null);
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (e) {
        send('camera_error', e.message || String(e));
        return;
      }

      const video = document.getElementById('video');
      video.srcObject = stream;
      await video.play();
      send('ready', null);

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let busy = false;

      setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            send('scanned', codes[0].rawValue);
          }
        } catch (e) {
          // transient decode errors are normal between frames, ignore
        }
        busy = false;
      }, 350);
    }

    start();
  </script>
</body>
</html>
`;

export default function QrScannerScreen({ title, instructions, onBack, onScanned, onManualCode, manualLabel }) {
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const lockRef = useRef(false);

  function handleWebViewMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'ready') {
      setCameraReady(true);
      return;
    }

    if (msg.type === 'unsupported') {
      setUnsupported(true);
      setManualMode(true);
      return;
    }

    if (msg.type === 'camera_error') {
      setError('Could not access the camera: ' + msg.payload);
      return;
    }

    if (msg.type === 'scanned') {
      if (lockRef.current) return;
      lockRef.current = true;
      setLocked(true);
      setError('');

      let parsed = null;
      try {
        parsed = JSON.parse(msg.payload);
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
  }

  async function handleManualSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await onManualCode(code.trim());
    } finally {
      setSubmitting(false);
    }
  }

  if (manualMode) {
    return (
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.permTitle}>Enter Booking Code</Text>
        <Text style={styles.permBody}>
          {unsupported
            ? "This device's browser engine doesn't support QR scanning. Use the code instead:"
            : (manualLabel || 'Type the code shown on the booking (e.g. FI-123456).')}
        </Text>
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
        {!unsupported && (
          <TouchableOpacity onPress={() => setManualMode(false)} style={{ marginTop: 16 }}>
            <Text style={styles.backLink}>‹ Back to scanning</Text>
          </TouchableOpacity>
        )}
        {unsupported && (
          <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
            <Text style={styles.backLink}>‹ Back</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        source={{ html: SCANNER_HTML }}
        style={StyleSheet.absoluteFillObject}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        originWhitelist={['*']}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.instructions}>{instructions}</Text>

        <View style={styles.frame} pointerEvents="none">
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