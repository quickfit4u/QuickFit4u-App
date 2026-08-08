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
import Svg, { Circle, Path } from 'react-native-svg';
import { requestSignupOtp, verifySignup, login } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.15)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

export default function AuthScreen({ onSkip, onAuthSuccess, onForgotPassword }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState('details'); // 'details' | 'code' (signup only)
  const [role, setRole] = useState('member'); // 'member' | 'owner'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const isLogin = mode === 'login';

  // ---------- LOGIN: single step, email + password ----------
  async function handleLogin() {
    setError('');
    if (!email.trim()) return setError('Enter your email address.');
    if (!password) return setError('Enter your password.');

    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      onAuthSuccess && onAuthSuccess(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- SIGNUP step 1: send the code ----------
  async function handleSendCode() {
    setError('');
    if (!name.trim()) return setError('Enter your name.');
    if (!email.trim()) return setError('Enter your email address.');

    setLoading(true);
    try {
      const res = await requestSignupOtp({
        name: name.trim(),
        email: email.trim(),
        role,
        referredBy: referredBy.trim() || undefined,
      });
      setInfoMsg(res.message);
      setStep('code');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- SIGNUP step 2: verify code + set password ----------
  async function handleVerifySignup() {
    setError('');
    if (!code.trim()) return setError('Enter the 6-digit code.');
    if (!password) return setError('Create a password.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const user = await verifySignup({
        email: email.trim(),
        code: code.trim(),
        password,
        confirmPassword,
      });
      onAuthSuccess && onAuthSuccess(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(isLogin ? 'signup' : 'login');
    setStep('details');
    setError('');
    setInfoMsg('');
    setCode('');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

        <View style={styles.topArt}>
          <Svg width={64} height={64} viewBox="0 0 90 90">
            <Circle cx="45" cy="45" r="34" stroke={COLORS.sage} strokeWidth="9" fill="none" />
            <Path d="M45 45 L45 22" stroke={COLORS.ink} strokeWidth="5" strokeLinecap="round" />
            <Circle cx="74" cy="22" r="4" fill={COLORS.gold} />
          </Svg>
        </View>

        {/* ---------------- LOGIN ---------------- */}
        {isLogin && (
          <>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in with your email and password.</Text>

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

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.inkSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity onPress={() => onForgotPassword && onForgotPassword(email.trim())} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextStyle}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Log In</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ---------------- SIGNUP: step 1 — details ---------------- */}
        {!isLogin && step === 'details' && (
          <>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join QuickFit4u — we'll email you a code to verify it's you.</Text>

            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'member' && styles.roleBtnActive]}
                onPress={() => setRole('member')}
              >
                <Text style={[styles.roleText, role === 'member' && styles.roleTextActive]}>I'm a Member</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'owner' && styles.roleBtnActive]}
                onPress={() => setRole('owner')}
              >
                <Text style={[styles.roleText, role === 'owner' && styles.roleTextActive]}>I'm a Gym Owner</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder={role === 'owner' ? 'Your name / gym contact name' : 'Full name'}
                placeholderTextColor={COLORS.inkSoft}
                value={name}
                onChangeText={setName}
              />
            </View>

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

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Referral code (optional)"
                placeholderTextColor={COLORS.inkSoft}
                value={referredBy}
                onChangeText={setReferredBy}
                autoCapitalize="characters"
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextStyle}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ---------------- SIGNUP: step 2 — code + password ---------------- */}
        {!isLogin && step === 'code' && (
          <>
            <Text style={styles.title}>Verify &amp; Set Password</Text>
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
                placeholder="Create a password (min. 6 characters)"
                placeholderTextColor={COLORS.inkSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
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

            <TouchableOpacity style={styles.submitBtn} onPress={handleVerifySignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('details'); setError(''); }} style={{ marginTop: 16 }}>
              <Text style={styles.switchModeText}>Wrong email? Go back</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={switchMode} style={{ marginTop: 22 }}>
          <Text style={styles.switchModeText}>
            {isLogin ? "Not a member? " : 'Already have an account? '}
            <Text style={{ color: COLORS.sageDark, fontWeight: '700' }}>{isLogin ? 'Join now' : 'Log in'}</Text>
          </Text>
        </TouchableOpacity>
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
    alignItems: 'center',
  },
  skipBtn: { position: 'absolute', top: 50, right: 20, paddingVertical: 6, paddingHorizontal: 12 },
  skipText: { color: COLORS.inkSoft, fontSize: 13.5, fontWeight: '600' },
  topArt: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 22, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 6 },
  roleToggle: { flexDirection: 'row', width: '100%', backgroundColor: '#fff', borderRadius: 100, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.line },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: 'center' },
  roleBtnActive: { backgroundColor: COLORS.sageDark },
  roleText: { fontSize: 13, fontWeight: '600', color: COLORS.inkSoft },
  roleTextActive: { color: '#fff' },
  field: { width: '100%', marginBottom: 14 },
  input: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14.5, color: COLORS.ink,
  },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -6 },
  forgotLinkText: { fontSize: 13, color: COLORS.sageDark, fontWeight: '600' },
  errorBox: { width: '100%', backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  submitBtn: { width: '100%', backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  switchModeText: { fontSize: 13.5, color: COLORS.inkSoft },
});
