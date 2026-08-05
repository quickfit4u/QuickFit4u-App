import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { updateMyGym } from '../lib/api';

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


const AMENITY_GROUPS = [
  {
    label: 'Equipment',
    items: ['Free Weights', 'Cardio Machines', 'Treadmills', 'CrossFit Rig', 'Powerlifting Platform', 'Resistance Machines', 'Functional Training Zone'],
  },
  {
    label: 'Facilities',
    items: ['AC', 'Lockers', 'Showers', 'Sauna', 'Parking', 'WiFi', 'Drinking Water'],
  },
  {
    label: 'Services',
    items: ['Personal Training', 'Group Classes', 'Yoga Studio', 'Ladies-Only Hours', 'Nutrition Counselling'],
  },
];

export default function OwnerAmenitiesScreen({ gym, onBack, onSaved }) {
  const [selected, setSelected] = useState(new Set(gym?.tags || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(item) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  async function handleSave() {
    setError('');
    if (selected.size === 0) {
      return setError('Pick at least one amenity so members know what to expect.');
    }
    setSaving(true);
    try {
      const saved = await updateMyGym({ tags: Array.from(selected) });
      onSaved(saved);
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

      <Text style={styles.stepIndicator}>Step 2 of 4 — Amenities</Text>
      <Text style={styles.title}>What does your gym offer?</Text>
      <Text style={styles.subtitle}>Select everything that applies — members filter by these.</Text>

      {AMENITY_GROUPS.map((group) => (
        <View key={group.label} style={{ marginBottom: 22 }}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.chipsWrap}>
            {group.items.map((item) => {
              const active = selected.has(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggle(item)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTextStyle}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save & Next →</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700', marginBottom: 14 },
  stepIndicator: { fontSize: 12, fontWeight: '700', color: COLORS.sageDark, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 26, lineHeight: 19 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.line,
  },
  chipActive: { backgroundColor: COLORS.sageLight, borderColor: COLORS.sageDark },
  chipText: { fontSize: 13, color: COLORS.inkSoft, fontWeight: '600' },
  chipTextActive: { color: COLORS.ink },
  errorBox: { backgroundColor: COLORS.errorBg, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 16 },
  errorTextStyle: { color: COLORS.errorText, fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
