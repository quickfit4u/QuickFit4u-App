import React, { useState } from 'react';
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
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createMyGym, updateMyGym } from '../lib/api';
import { uploadBase64ToCloudinary } from '../lib/cloudinary';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  line: 'rgba(43,51,40,0.15)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

export default function OwnerGymProfileScreen({ gym, onBack, onSaved, mode }) {
  const isEdit = mode ? mode === 'edit' : !!gym;
  const isCreateStep = !isEdit;
  const [name, setName] = useState(gym?.name || '');
  const [phone, setPhone] = useState(gym?.phone || '');
  const [area, setArea] = useState(gym?.area || '');
  const [city, setCity] = useState(gym?.city || '');
  const [description, setDescription] = useState(gym?.description || '');
  const [tagsText, setTagsText] = useState((gym?.tags || []).join(', '));
  const [hourlyRate, setHourlyRate] = useState(gym?.hourlyRate ? String(gym.hourlyRate) : '');
  const [openingHours, setOpeningHours] = useState(gym?.openingHours || '');
  const [peakHours, setPeakHours] = useState(gym?.peakHours || '');
  const [latitude, setLatitude] = useState(gym?.latitude ?? null);
  const [longitude, setLongitude] = useState(gym?.longitude ?? null);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState(gym?.photos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleAddPhoto() {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return setError('Photo library permission is needed to add gym photos.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const localUri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const url = await uploadBase64ToCloudinary(`data:image/jpeg;base64,${base64}`);
      setPhotos((prev) => [...prev, url]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto(url) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  async function handleUseCurrentLocation() {
    setError('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to pin your gym on the map.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
    } catch (e) {
      setError('Could not get your current location. Try again.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) return setError('Gym name is required.');
    if (!phone.trim() || phone.trim().length < 10) return setError('Enter a valid phone number.');
    const rate = Number(hourlyRate);
    if (!rate || rate <= 0) return setError('Enter a valid hourly rate.');

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      area: area.trim(),
      city: city.trim(),
      description: description.trim(),
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      hourlyRate: rate,
      openingHours: openingHours.trim() || null,
      peakHours: peakHours.trim() || null,
      latitude,
      longitude,
      photos,
    };

    setSaving(true);
    try {
      const saved = isEdit ? await updateMyGym(payload) : await createMyGym(payload);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 60 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      {isCreateStep && <Text style={styles.stepIndicator}>Step 1 of 4 — Gym details</Text>}
      <Text style={styles.title}>{isEdit ? 'Edit Gym Profile' : 'Set Up Your Gym'}</Text>
      <Text style={styles.subtitle}>
        {isEdit ? 'Keep your gym details up to date.' : 'This is what members will see when they search for gyms. Amenities and the partnership agreement come next.'}
      </Text>

      <Field label="Gym name">
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Iron Peak Fitness" placeholderTextColor={COLORS.inkSoft} />
      </Field>

      <Field label="Phone number">
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 9876543210"
          placeholderTextColor={COLORS.inkSoft}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </Field>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Area">
            <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="e.g. Hauz Khas" placeholderTextColor={COLORS.inkSoft} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="City">
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Delhi" placeholderTextColor={COLORS.inkSoft} />
          </Field>
        </View>
      </View>

      <Field label="Hourly rate (₹)">
        <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="number-pad" placeholder="149" placeholderTextColor={COLORS.inkSoft} />
      </Field>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Opening hours">
            <TextInput
              style={styles.input}
              value={openingHours}
              onChangeText={setOpeningHours}
              placeholder="e.g. 6:00 AM - 10:00 PM"
              placeholderTextColor={COLORS.inkSoft}
            />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Peak hours">
            <TextInput
              style={styles.input}
              value={peakHours}
              onChangeText={setPeakHours}
              placeholder="e.g. 7-9 AM, 6-8 PM"
              placeholderTextColor={COLORS.inkSoft}
            />
          </Field>
        </View>
      </View>

      {!isCreateStep && (
        <Field label="Amenities (comma separated)">
          <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} placeholder="Free Weights, AC, Lockers" placeholderTextColor={COLORS.inkSoft} />
        </Field>
      )}

      <Field label="Description">
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Tell travelers what makes your gym worth a visit..."
          placeholderTextColor={COLORS.inkSoft}
        />
      </Field>

      <Field label="Photos">
        <View style={styles.photoGrid}>
          {photos.map((url) => (
            <View key={url} style={styles.photoThumbWrap}>
              <Image source={{ uri: url }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(url)}>
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color={COLORS.sageDark} />
            ) : (
              <Text style={styles.addPhotoText}>+ Add</Text>
            )}
          </TouchableOpacity>
        </View>
      </Field>

      <Field label="Gym location (for the map on your listing)">
        <TouchableOpacity style={styles.locationBtn} onPress={handleUseCurrentLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color={COLORS.sageDark} />
          ) : (
            <Text style={styles.locationBtnText}>
              📍 {latitude ? 'Update to my current location' : 'Use my current location'}
            </Text>
          )}
        </TouchableOpacity>
        {latitude != null && (
          <Text style={styles.locationCaptured}>
            Captured: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        )}
      </Field>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTextStyle}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Save & Next →'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { marginBottom: 10 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, marginBottom: 6, fontFamily: undefined },
  stepIndicator: { fontSize: 12, fontWeight: '700', color: COLORS.sageDark, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  subtitle: { fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 26, lineHeight: 19 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.inkSoft, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14.5, color: COLORS.ink },
  errorBox: { backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  locationBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 13, alignItems: 'center' },
  locationBtnText: { color: COLORS.sageDark, fontWeight: '700', fontSize: 13.5 },
  locationCaptured: { fontSize: 12, color: COLORS.inkSoft, marginTop: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: '#eee' },
  photoRemoveBtn: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addPhotoBtn: {
    width: 84, height: 84, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: COLORS.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoText: { color: COLORS.sageDark, fontWeight: '700', fontSize: 13 },
  saveBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});