import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { updateProfile } from '../lib/api';
import { uploadBase64ToCloudinary } from '../lib/cloudinary';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  line: 'rgba(43,51,40,0.12)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
  dangerBg: '#FBEDEC',
  dangerText: '#B4463B',
};

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const FITNESS_GOALS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'general_fitness', label: 'General Fitness' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];


function isoToDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIsoDate(display) {
  const match = (display || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

export default function ProfileScreen({ user, onBack, onLogout, onUserUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [address, setAddress] = useState(user?.address || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [dateOfBirth, setDateOfBirth] = useState(isoToDisplayDate(user?.dateOfBirth));
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const [fitnessGoal, setFitnessGoal] = useState(user?.fitnessGoal || '');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startEditing() {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setGender(user?.gender || '');
    setAddress(user?.address || '');
    setAvatarUrl(user?.avatarUrl || '');
    setDateOfBirth(isoToDisplayDate(user?.dateOfBirth));
    setEmergencyContact(user?.emergencyContact || '');
    setFitnessGoal(user?.fitnessGoal || '');
    setBloodGroup(user?.bloodGroup || '');
    setError('');
    setEditing(true);
  }

  async function handlePickPhoto() {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return setError('Photo library permission is needed to change your profile photo.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const localUri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const url = await uploadBase64ToCloudinary(`data:image/jpeg;base64,${base64}`);
      setAvatarUrl(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setError('');

    if (!name.trim()) {
      return setError('Name cannot be empty.');
    }
    if (phone.trim() && !/^[0-9]{10}$/.test(phone.trim())) {
      return setError('Enter a valid 10-digit mobile number.');
    }
    if (emergencyContact.trim() && !/^[0-9]{10}$/.test(emergencyContact.trim())) {
      return setError('Enter a valid 10-digit emergency contact number.');
    }
    let dobIso = null;
    if (dateOfBirth.trim()) {
      dobIso = displayToIsoDate(dateOfBirth.trim());
      if (!dobIso) return setError('Enter your date of birth as DD/MM/YYYY.');
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        gender: gender || null,
        address: address.trim() || null,
        avatarUrl: avatarUrl || null,
        dateOfBirth: dobIso,
        emergencyContact: emergencyContact.trim() || null,
        fitnessGoal: fitnessGoal || null,
        bloodGroup: bloodGroup || null,
      });
      onUserUpdated && onUserUpdated(updated);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={editing ? () => setEditing(false) : onBack}>
          <Text style={styles.back}>‹ {editing ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        {!!user && !editing ? (
          <TouchableOpacity onPress={startEditing}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View style={styles.avatarBlock}>
        <TouchableOpacity
          style={styles.avatar}
          disabled={!editing || uploadingPhoto}
          onPress={handlePickPhoto}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color={COLORS.sageDark} />
          ) : (editing ? avatarUrl : user?.avatarUrl) ? (
            <Image source={{ uri: editing ? avatarUrl : user.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
          )}
          {editing && <View style={styles.avatarEditBadge}><Text style={styles.avatarEditBadgeText}>✎</Text></View>}
        </TouchableOpacity>
        {!editing && <Text style={styles.name}>{user?.name || 'Guest'}</Text>}
        {!editing && <Text style={styles.email}>{user?.email || 'Not signed in'}</Text>}
      </View>

      {error !== '' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      )}

      {editing ? (
        <View style={styles.form}>
          <Field label="Name">
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" />
          </Field>

          <Field label="Email">
            <TextInput style={[styles.input, styles.inputDisabled]} value={user?.email || ''} editable={false} />
          </Field>

          <Field label="Mobile number">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>

          <Field label="Gender">
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.genderPill, gender === g.value && styles.genderPillActive]}
                  onPress={() => setGender(gender === g.value ? '' : g.value)}
                >
                  <Text style={[styles.genderPillText, gender === g.value && styles.genderPillTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Address">
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="House no, street, city, state, PIN"
              multiline
              numberOfLines={3}
            />
          </Field>

          <Field label="Date of Birth">
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={(t) => {
               
                const digits = t.replace(/[^0-9]/g, '').slice(0, 8);
                let out = digits;
                if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                setDateOfBirth(out);
              }}
              placeholder="DD/MM/YYYY"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>

          <Field label="Emergency Contact">
            <TextInput
              style={styles.input}
              value={emergencyContact}
              onChangeText={(t) => setEmergencyContact(t.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="10-digit contact number"
              keyboardType="number-pad"
              maxLength={10}
            />
          </Field>

          <Field label="Fitness Goal">
            <View style={styles.genderRow}>
              {FITNESS_GOALS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.genderPill, fitnessGoal === g.value && styles.genderPillActive]}
                  onPress={() => setFitnessGoal(fitnessGoal === g.value ? '' : g.value)}
                >
                  <Text style={[styles.genderPillText, fitnessGoal === g.value && styles.genderPillTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Blood Group (optional)">
            <View style={styles.genderRow}>
              {BLOOD_GROUPS.map((bg) => (
                <TouchableOpacity
                  key={bg}
                  style={[styles.genderPill, bloodGroup === bg && styles.genderPillActive]}
                  onPress={() => setBloodGroup(bloodGroup === bg ? '' : bg)}
                >
                  <Text style={[styles.genderPillText, bloodGroup === bg && styles.genderPillTextActive]}>
                    {bg}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Row label="Account type" value={user?.role === 'owner' ? 'Gym Owner' : 'Member'} />
          <Row label="Email" value={user?.email || '—'} />
          <Row label="Mobile number" value={user?.phone || 'Not added'} />
          <Row label="Gender" value={GENDERS.find((g) => g.value === user?.gender)?.label || 'Not added'} />
          <Row label="Address" value={user?.address || 'Not added'} />
          <Row label="Date of Birth" value={isoToDisplayDate(user?.dateOfBirth) || 'Not added'} />
          <Row label="Emergency Contact" value={user?.emergencyContact || 'Not added'} />
          <Row label="Fitness Goal" value={FITNESS_GOALS.find((g) => g.value === user?.fitnessGoal)?.label || 'Not added'} />
          <Row label="Blood Group" value={user?.bloodGroup || 'Not added'} last />
        </View>
      )}

      {!user && (
        <Text style={styles.guestNote}>
          You're browsing as a guest. Log in from the menu to see your bookings and profile details.
        </Text>
      )}

      {!!user && !editing && (
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  editLink: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  avatarBlock: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.sageLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', position: 'relative' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 30, fontWeight: '700', color: COLORS.sageDark },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.sageDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.cream },
  avatarEditBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  name: { fontSize: 19, fontWeight: '700', color: COLORS.ink },
  email: { fontSize: 13, color: COLORS.inkSoft, marginTop: 3 },
  errorBox: { backgroundColor: COLORS.errorBg, marginHorizontal: 20, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBoxText: { color: COLORS.errorText, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 20, borderWidth: 1, borderColor: COLORS.line, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowLabel: { fontSize: 13.5, color: COLORS.inkSoft },
  rowValue: { fontSize: 13.5, color: COLORS.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  guestNote: { textAlign: 'center', color: COLORS.inkSoft, fontSize: 13, paddingHorizontal: 30, lineHeight: 19 },
  logoutBtn: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 100, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E8B5AC' },
  logoutText: { color: '#B4463B', fontWeight: '700', fontSize: 14.5 },

  form: { paddingHorizontal: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.inkSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: COLORS.ink },
  inputDisabled: { color: COLORS.inkSoft, backgroundColor: COLORS.sageLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  genderRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  genderPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  genderPillActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  genderPillText: { fontSize: 13.5, fontWeight: '600', color: COLORS.ink },
  genderPillTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});