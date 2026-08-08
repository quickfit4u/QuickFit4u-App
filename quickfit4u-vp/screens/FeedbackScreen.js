import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { submitComplaint } from '../lib/api';
import { uploadImageToCloudinary, uploadFileToCloudinary } from '../lib/cloudinary';

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

const CATEGORIES = [
  { value: 'booking', label: 'Booking' },
  { value: 'payment', label: 'Payment' },
  { value: 'gym', label: 'Gym / facility' },
  { value: 'app', label: 'App issue' },
  { value: 'other', label: 'Other' },
];

const MAX_ATTACHMENTS = 5;

export default function FeedbackScreen({ user, onBack }) {
  const [category, setCategory] = useState('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]); // [{ url, name, type }]
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleAddPhoto() {
    setError('');
    if (attachments.length >= MAX_ATTACHMENTS) return setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Photo library permission is needed to attach a photo.');

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const url = await uploadImageToCloudinary(asset.uri);
      setAttachments((prev) => [...prev, { url, name: asset.fileName || 'Photo', type: 'image' }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddDocument() {
    setError('');
    if (attachments.length >= MAX_ATTACHMENTS) return setError(`You can attach up to ${MAX_ATTACHMENTS} files.`);

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const { url } = await uploadFileToCloudinary(asset.uri, asset.mimeType, asset.name);
      setAttachments((prev) => [...prev, { url, name: asset.name || 'Document', type: 'document' }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveAttachment(url) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function handleSubmit() {
    setError('');
    if (!subject.trim()) return setError('Add a short subject for your message.');
    if (!message.trim()) return setError('Tell us what happened.');

    setSaving(true);
    try {
      await submitComplaint({ category, subject: subject.trim(), message: message.trim(), attachments });
      Alert.alert(
        'Thanks for letting us know',
        "We've received your message and will get back to you by email soon.",
        [{ text: 'OK', onPress: onBack }]
      );
      setSubject('');
      setMessage('');
      setAttachments([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 60 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Help & Feedback</Text>
      <Text style={styles.subtitle}>
        {user?.role === 'owner'
          ? "Report an issue or share feedback about the platform — we'll reply by email."
          : "Had a problem with a booking, a gym, or the app? Tell us here and we'll reply by email."}
      </Text>

      <Text style={styles.groupLabel}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={[styles.categoryChipText, category === c.value && styles.categoryChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Subject</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="e.g. Payment deducted but booking not confirmed"
        placeholderTextColor={COLORS.inkSoft}
      />

      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Message</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Describe what happened, including dates or booking codes if relevant."
        placeholderTextColor={COLORS.inkSoft}
        multiline
        textAlignVertical="top"
      />

      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Attachments (optional)</Text>
      <Text style={styles.attachHint}>Add a photo or document as proof — it's included with your message.</Text>
      <View style={styles.attachRow}>
        <TouchableOpacity style={styles.attachBtn} onPress={handleAddPhoto} disabled={uploading}>
          <Text style={styles.attachBtnText}>📷 Add Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={handleAddDocument} disabled={uploading}>
          <Text style={styles.attachBtnText}>📄 Add Document</Text>
        </TouchableOpacity>
      </View>
      {uploading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 10 }} />}
      {attachments.length > 0 && (
        <View style={styles.attachList}>
          {attachments.map((a) => (
            <View key={a.url} style={styles.attachChip}>
              <Text style={styles.attachChipText} numberOfLines={1}>
                {a.type === 'image' ? '🖼️' : '📄'} {a.name}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveAttachment(a.url)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.attachRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTextStyle}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={saving || uploading}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Send</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 20, lineHeight: 19 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.line,
  },
  categoryChipActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  categoryChipText: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.inkSoft, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: COLORS.ink,
  },
  textArea: { minHeight: 120, paddingTop: 12 },
  attachHint: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 10, lineHeight: 17 },
  attachRow: { flexDirection: 'row', gap: 10 },
  attachBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingVertical: 12, alignItems: 'center',
  },
  attachBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  attachList: { marginTop: 12, gap: 8 },
  attachChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.sageLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  attachChipText: { flex: 1, fontSize: 13, color: COLORS.ink, marginRight: 10 },
  attachRemove: { fontSize: 14, color: COLORS.inkSoft, fontWeight: '700' },
  errorBox: { backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginTop: 16 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
