import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { requestPasswordReset, resetPassword } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  line: 'rgba(43,51,40,0.15)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

export default function ForgotPasswordScreen({ initialEmail = '', onBack, onResetSuccess }) {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  async function handleSendCode() {
    setError('');
    if (!email.trim()) return setError('Enter your email address.');

    setLoading(true);
    try {
      const res = await requestPasswordReset({ email: email.trim() });
      setInfoMsg(res.message);
      setStep('reset');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setError('');
    if (!code.trim()) return setError('Enter the 6-digit code.');
    if (!password) return setError('Enter a new password.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const user = await resetPassword({
        email: email.trim(),
        code: code.trim(),
        password,
        confirmPassword,
      });
      onResetSuccess && onResetSuccess(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        {step === 'email' ? (
          <>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your account email and we'll send you a 6-digit code to reset your password.
            </Text>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={COLORS.inkSoft}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextStyle}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send Reset Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter Code &amp; New Password</Text>
            <Text style={styles.subtitle}>{infoMsg || `We sent a 6-digit code to ${email}`}</Text>

            <View style={styles.field}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={COLORS.inkSoft}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="New password (min. 6 characters)"
                placeholderTextColor={COLORS.inkSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={COLORS.inkSoft}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextStyle}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Reset Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('email'); setError(''); }} style={{ marginTop: 16 }}>
              <Text style={styles.switchText}>Wrong email? Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.inkSoft, lineHeight: 20, marginBottom: 24 },
  field: { width: '100%', marginBottom: 14 },
  input: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14.5, color: COLORS.ink,
  },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  errorBox: { width: '100%', backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  submitBtn: { width: '100%', backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  switchText: { fontSize: 13.5, color: COLORS.inkSoft },
});
