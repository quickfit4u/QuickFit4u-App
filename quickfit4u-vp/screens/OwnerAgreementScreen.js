import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { signAgreement } from '../lib/api';
import { uploadBase64ToCloudinary } from '../lib/cloudinary';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.15)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

const AGREEMENT_TEXT = [
  { heading: '1. Purpose', body: 'QuickFit4u operates a digital platform that enables customers to discover, book, and access partner gyms through the QuickFit4u mobile application. You agree to onboard your fitness facility on the platform under these terms.' },
  { heading: '2. Appointment', body: 'You authorize QuickFit4u to list, promote, and market your gym through the QuickFit4u platform.' },
  { heading: '3. Commission', body: 'You agree to pay QuickFit4u 10% commission on every successful booking or visit generated through the app. The remaining amount is transferred to you after deducting the commission, taxes, and any statutory deductions.' },
  { heading: '4. Customer Experience', body: 'You agree to welcome every QuickFit4u customer professionally, treat them with courtesy and respect, provide equal service to app users and direct members, ensure staff behave professionally, and resolve complaints promptly.' },
  { heading: '5. Gym Maintenance', body: 'You will maintain cleanliness throughout the premises, keep equipment safe and functional, maintain proper lighting, ventilation and hygiene, keep changing rooms and washrooms clean, provide safe drinking water, and follow all health and safety regulations.' },
  { heading: '6. Booking Acceptance', body: 'You will honor all confirmed bookings received through QuickFit4u during operating hours, unless the gym is temporarily closed due to unavoidable circumstances.' },
  { heading: '7. QR Check-in', body: 'You will verify customer identity, allow entry only after successful QR code or digital check-in, and take reasonable steps to prevent misuse of memberships.' },
  { heading: '8. Pricing', body: 'The rates displayed on QuickFit4u shall be honored for all confirmed bookings. No additional charges shall be collected from customers unless clearly disclosed and accepted through the platform.' },
  { heading: '9. Cancellation', body: 'You will immediately notify QuickFit4u in case of temporary closure, renovation, maintenance, emergency, or holiday closure.' },
  { heading: '10. Payment Settlement', body: 'QuickFit4u shall settle payments to you according to the agreed settlement cycle after deducting the 10% commission, applicable taxes, and refunds (if any).' },
  { heading: '11. Quality Standards', body: 'You agree to maintain a minimum service standard, keep equipment operational, employ qualified trainers where required, ensure member safety, maintain CCTV where legally required or voluntarily installed, and comply with all applicable laws, licenses, and local regulations.' },
  { heading: '12. Customer Feedback', body: 'QuickFit4u may collect customer ratings and reviews. Repeated poor ratings or verified complaints may result in temporary suspension, delisting from the platform, or termination of this agreement.' },
  { heading: '13. Marketing Rights', body: 'You authorize QuickFit4u to use your gym name, logo, interior photographs, videos, and promotional content for marketing and promotional purposes.' },
  { heading: '14. Confidentiality', body: 'Both parties shall keep confidential all business information, pricing, customer data, and operational details shared during the partnership.' },
  { heading: '15. Term', body: 'This agreement remains valid for three (3) years from the date of execution and automatically renews for successive one-year terms unless terminated by either party with 30 days\u2019 written notice.' },
  { heading: '16. Termination', body: 'Either party may terminate this agreement with thirty (30) days\u2019 written notice. QuickFit4u may terminate immediately if you engage in fraud or misconduct, misuse the platform, provide unsafe facilities, repeatedly refuse confirmed bookings, or receive repeated verified customer complaints.' },
  { heading: '17. Indemnity', body: 'You are solely responsible for any injury, accident, loss, or damage occurring within your gym premises due to negligence or failure to maintain safe facilities. QuickFit4u acts only as a technology platform facilitating bookings and is not liable for your operational acts or omissions.' },
  { heading: '18. Governing Law', body: 'This agreement is governed by the laws of India. Disputes are subject to the jurisdiction of the competent courts at Patna, Bihar, unless otherwise mutually agreed.' },
];
const LEGAL_NOTE = 'Have a lawyer review this agreement before onboarding real gyms at scale — this reflects the terms you provided, adapted for in-app display.';
const ACCEPTANCE_CLAUSE = 'I have read and accept all the terms above, and I agree to grant entry to any verified QuickFit4u member who arrives at my gym with a confirmed booking made through the app.';

export default function OwnerAgreementScreen({ gym, onBack, onSigned }) {
  const sigRef = useRef(null);
  const [signedName, setSignedName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSignedGym, setJustSignedGym] = useState(null);

  const alreadySigned = !!gym?.agreementSignedAt;

  function handleSignatureOK(base64) {
    submitWithSignature(base64);
  }

  function handleClear() {
    sigRef.current?.clearSignature();
    setHasDrawn(false);
  }

  async function submitWithSignature(base64) {
    setSubmitting(true);
    setError('');
    try {
      const signatureUrl = await uploadBase64ToCloudinary(base64);
      const updatedGym = await signAgreement({ signedName: signedName.trim(), signatureUrl, accepted });
      setJustSignedGym(updatedGym);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    setError('');
    if (!signedName.trim()) return setError('Type your full name.');
    if (!hasDrawn) return setError('Please draw your signature above before submitting.');
    if (!accepted) return setError('Please check the box to accept the agreement.');
    setSubmitting(true);
   
    sigRef.current?.readSignature();
  }

  // Just finished signing — show the QR before continuing to the dashboard.
  if (justSignedGym) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={styles.title}>You're all set!</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
          <View style={styles.signedCard}>
            <Text style={styles.signedIcon}>🎉</Text>
            <Text style={styles.signedTitle}>{justSignedGym.name} is live!</Text>
            <Text style={styles.signedBy}>Your gym is now visible to QuickFit4u members.</Text>
            {!!justSignedGym.qrDataUrl && (
              <>
                <Image source={{ uri: justSignedGym.qrDataUrl }} style={styles.qrImage} />
                <Text style={styles.qrCaption}>
                  This QR code has also been emailed to your registered address, and is saved in your Gym Profile.
                </Text>
              </>
            )}
            <TouchableOpacity style={styles.submitBtn} onPress={() => onSigned(justSignedGym)}>
              <Text style={styles.submitText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (alreadySigned) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Partnership Agreement</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.signedCard}>
          <Text style={styles.signedIcon}>✅</Text>
          <Text style={styles.signedTitle}>Agreement signed</Text>
          <Text style={styles.signedBy}>Signed by {gym.agreementSignedName}</Text>
          <Text style={styles.signedDate}>{new Date(gym.agreementSignedAt).toLocaleString()}</Text>
          {!!gym.qrDataUrl ? (
            <Image source={{ uri: gym.qrDataUrl }} style={styles.qrImage} />
          ) : (
            !!gym.agreementSignatureUrl && (
              <View style={styles.sigPreviewBox}>
                <Text style={styles.sigPreviewLabel}>Signature on file</Text>
              </View>
            )
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Step 4 of 4 — Agreement</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} scrollEnabled={scrollEnabled}>
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            Your gym won't appear to members in search until this is signed.
          </Text>
        </View>

        {AGREEMENT_TEXT.map((s, i) => (
          <View key={i} style={styles.block}>
            <Text style={styles.blockHeading}>{s.heading}</Text>
            <Text style={styles.blockBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.legalNote}>{LEGAL_NOTE}</Text>

        <Text style={styles.fieldLabel}>Type your full legal name</Text>
        <TextInput
          style={styles.input}
          value={signedName}
          onChangeText={setSignedName}
          placeholder="e.g. Rohan Sharma"
          placeholderTextColor={COLORS.inkSoft}
        />

        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Draw your signature</Text>
        <View
          style={styles.sigPadBox}
          onStartShouldSetResponderCapture={() => {
            setScrollEnabled(false);
            return false;
          }}
          onTouchEnd={() => setScrollEnabled(true)}
        >
          <SignatureScreen
            ref={sigRef}
            onOK={handleSignatureOK}
            onBegin={() => setHasDrawn(true)}
            webStyle={sigWebStyle}
            autoClear={false}
          />
        </View>
        <TouchableOpacity onPress={handleClear} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
          <Text style={styles.clearText}>Clear signature</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => setAccepted((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{ACCEPTANCE_CLAUSE}</Text>
        </TouchableOpacity>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTextStyle}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>I Agree & Sign</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const sigWebStyle = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  body,html { background-color: #fff; }
`;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  noticeBanner: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 12, marginBottom: 18 },
  noticeText: { color: '#fff', fontWeight: '700', fontSize: 12.5, textAlign: 'center' },
  block: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.line },
  blockHeading: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  blockBody: { fontSize: 13, color: COLORS.inkSoft, lineHeight: 19 },
  legalNote: { fontSize: 11.5, color: COLORS.inkSoft, fontStyle: 'italic', marginBottom: 24, lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.inkSoft, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14.5, color: COLORS.ink },
  sigPadBox: { height: 180, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  clearText: { color: COLORS.sageDark, fontWeight: '600', fontSize: 12.5 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.line,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 12.5, color: COLORS.ink, lineHeight: 18 },
  qrImage: { width: 200, height: 200, marginVertical: 18, borderRadius: 12, backgroundColor: '#fff' },
  qrCaption: { fontSize: 12, color: COLORS.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 22, paddingHorizontal: 10 },
  errorBox: { backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginTop: 18 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  signedCard: { margin: 20, backgroundColor: '#fff', borderRadius: 18, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: COLORS.line },
  signedIcon: { fontSize: 34, marginBottom: 10 },
  signedTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  signedBy: { fontSize: 14, color: COLORS.inkSoft },
  signedDate: { fontSize: 12, color: COLORS.inkSoft, marginTop: 4, marginBottom: 16 },
  sigPreviewBox: { backgroundColor: COLORS.sageLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  sigPreviewLabel: { fontSize: 12, color: COLORS.sageDark, fontWeight: '600' },
});