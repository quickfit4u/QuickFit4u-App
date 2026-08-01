import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fetchMySlots, addMySlot } from '../lib/api';

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
};

function nextSevenDays() {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({ label: i === 0 ? 'Today' : labels[d.getDay()], date: d.getDate(), full: d.toISOString().slice(0, 10) });
  }
  return days;
}

export default function OwnerSlotsScreen({ onBack }) {
  const days = nextSevenDays();
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [hourLabel, setHourLabel] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    fetchMySlots(days[selectedDay].full)
      .then((data) => setSlots(data.slots))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedDay]);

  async function handleAddSlot() {
    setAddError('');
    if (!hourLabel.trim()) return setAddError('Enter a time, e.g. "6 PM".');
    const cap = Number(capacity) || 1;

    setAdding(true);
    try {
      await addMySlot({ date: days[selectedDay].full, hourLabel: hourLabel.trim(), capacity: cap });
      setHourLabel('');
      setCapacity('1');
      load();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Booked Slots</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {days.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayPill, selectedDay === i && styles.dayPillActive]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{d.label}</Text>
            <Text style={[styles.dayNum, selectedDay === i && styles.dayLabelActive]}>{d.date}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Open a new slot for {days[selectedDay].full}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="e.g. 6 PM"
              placeholderTextColor={COLORS.inkSoft}
              value={hourLabel}
              onChangeText={setHourLabel}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Capacity"
              placeholderTextColor={COLORS.inkSoft}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </View>
          {!!addError && <Text style={styles.errorInline}>{addError}</Text>}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddSlot} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>+ Open Slot</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Slots for this date</Text>

        {loading && <ActivityIndicator color={COLORS.sageDark} />}
        {!loading && error !== '' && <Text style={styles.errorInline}>{error}</Text>}
        {!loading && error === '' && slots.length === 0 && (
          <Text style={styles.emptyText}>No slots opened for this date yet — add one above.</Text>
        )}

        {slots.map((s) => (
          <View key={s.id} style={styles.slotCard}>
            <Text style={styles.slotHour}>{s.hourLabel}</Text>
            <Text style={styles.slotStatus}>
              {s.booked}/{s.capacity} booked{s.spotsLeft <= 0 ? ' · Full' : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  dayStrip: { marginBottom: 18 },
  dayPill: { width: 56, paddingVertical: 12, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.line },
  dayPillActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  dayLabel: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 },
  dayNum: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  dayLabelActive: { color: '#fff' },
  addCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 28, borderWidth: 1, borderColor: COLORS.line },
  addTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 14 },
  input: { backgroundColor: COLORS.cream, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.ink },
  errorInline: { fontSize: 12.5, color: COLORS.errorText, marginTop: 8 },
  addBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  emptyText: { fontSize: 13.5, color: COLORS.inkSoft },
  slotCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.line },
  slotHour: { fontSize: 14.5, fontWeight: '700', color: COLORS.ink },
  slotStatus: { fontSize: 12.5, color: COLORS.sageDark, fontWeight: '600' },
});
