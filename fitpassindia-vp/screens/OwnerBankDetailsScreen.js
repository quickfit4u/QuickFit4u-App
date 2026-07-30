import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchMyBankDetails, updateMyBankDetails } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  line: 'rgba(43,51,40,0.15)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

// Whether this is shown as onboarding step 3 of 4 (gym not yet live) or a
// later edit from the dashboard menu is decided by the caller (App.js) via
// the gym prop — this screen itself just shows the step indicator when the
// gym hasn't gone live yet.
export default function OwnerBankDetailsScreen({ gym, onBack, onSaved }) {
  const isOnboarding = !gym?.agreementSignedAt;

  const [loading, setLoading] = useState(true);
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [submittedAt, setSubmittedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyBankDetails()
      .then((d) => {
        setAccountHolder(d.accountHolder || '');
        setAccountNumber(d.accountNumber || '');
        setIfsc(d.ifsc || '');
        setUpiId(d.upiId || '');
        setSubmittedAt(d.submittedAt || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError('');

    const hasBankAccount = accountHolder.trim() && accountNumber.trim() && ifsc.trim();
    const hasUpi = upiId.trim();
    if (!hasBankAccount && !hasUpi) {
      return setError('Add either a full bank account (holder name, account number, IFSC) or a UPI ID.');
    }

    setSaving(true);
    try {
      const savedGym = await updateMyBankDetails({
        accountHolder: accountHolder.trim() || null,
        accountNumber: accountNumber.trim() || null,
        ifsc: ifsc.trim() || null,
        upiId: upiId.trim() || null,
      });
      onSaved(savedGym);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.sageDark} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 60 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      {isOnboarding && <Text style={styles.stepIndicator}>Step 3 of 4 — Payout details</Text>}
      <Text style={styles.title}>Where should we send your share?</Text>
      <Text style={styles.subtitle}>
        This is how you'll receive your payout for confirmed bookings. Add a bank account, a UPI ID, or both.
      </Text>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          Payouts are settled manually for now — the platform reviews confirmed bookings and transfers your share on
          a regular cycle. There's no automatic same-day transfer yet, but having this on file means we know exactly
          where to send it.
        </Text>
      </View>

      <Text style={styles.groupLabel}>Bank account (optional if you add UPI below)</Text>
      <Field label="Account holder name">
        <TextInput
          style={styles.input}
          value={accountHolder}
          onChangeText={setAccountHolder}
          placeholder="As it appears on your bank account"
          placeholderTextColor={COLORS.inkSoft}
        />
      </Field>
      <Field label="Account number">
        <TextInput
          style={styles.input}
          value={accountNumber}
          onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
          placeholder="Bank account number"
          placeholderTextColor={COLORS.inkSoft}
          keyboardType="number-pad"
        />
      </Field>
      <Field label="IFSC code">
        <TextInput
          style={styles.input}
          value={ifsc}
          onChangeText={(t) => setIfsc(t.toUpperCase())}
          placeholder="e.g. HDFC0001234"
          placeholderTextColor={COLORS.inkSoft}
          autoCapitalize="characters"
          maxLength={11}
        />
      </Field>

      <Text style={[styles.groupLabel, { marginTop: 8 }]}>UPI (optional if you add a bank account above)</Text>
      <Field label="UPI ID">
        <TextInput
          style={styles.input}
          value={upiId}
          onChangeText={setUpiId}
          placeholder="e.g. yourname@okhdfcbank"
          placeholderTextColor={COLORS.inkSoft}
          autoCapitalize="none"
        />
      </Field>

      {!!submittedAt && (
        <Text style={styles.savedNote}>Last updated {new Date(submittedAt).toLocaleDateString()}</Text>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTextStyle}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{isOnboarding ? 'Save & Next →' : 'Save'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700', marginBottom: 14 },
  stepIndicator: { fontSize: 12, fontWeight: '700', color: COLORS.sageDark, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 16, lineHeight: 19 },
  noticeBox: { backgroundColor: COLORS.sageLight, borderRadius: 12, padding: 14, marginBottom: 22 },
  noticeText: { fontSize: 12.5, color: COLORS.ink, lineHeight: 18 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.inkSoft, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: COLORS.ink,
  },
  savedNote: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4, marginBottom: 8 },
  errorBox: { backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 16 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
