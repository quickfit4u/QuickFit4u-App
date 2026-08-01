import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { fetchGymDetail, requestReschedule } from '../lib/api';

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

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function nextDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      full: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNum: d.getDate(),
    });
  }
  return days;
}

export default function BookingDetailScreen({ booking: initialBooking, onBack, onScanToCheckIn }) {
  const [booking, setBooking] = useState(initialBooking);
  const [modalVisible, setModalVisible] = useState(false);
  const [days] = useState(nextDays(7));
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  function openModal() {
    setModalVisible(true);
    setSelectedSlotId(null);
    setNote('');
    setModalError('');
    loadSlots(days[selectedDay].full);
  }

  async function loadSlots(date) {
    setSlotsLoading(true);
    try {
      const data = await fetchGymDetail(booking.gymId, date);
      // Exclude the booking's own current slot from the picker — that's
      // already booked, picking it again wouldn't be a reschedule.
      setSlots(data.slots.filter((s) => s.spotsLeft > 0));
    } catch (e) {
      setModalError(e.message);
    } finally {
      setSlotsLoading(false);
    }
  }

  function handlePickDay(i) {
    setSelectedDay(i);
    setSelectedSlotId(null);
    loadSlots(days[i].full);
  }

  async function handleSubmitReschedule() {
    if (!selectedSlotId) return;
    setSubmitting(true);
    setModalError('');
    try {
      await requestReschedule(booking.id, selectedSlotId, note.trim());
      const picked = slots.find((s) => s.id === selectedSlotId);
      setBooking((prev) => ({
        ...prev,
        rescheduleRequested: true,
        rescheduleDate: days[selectedDay].full,
        rescheduleHour: picked?.hour,
      }));
      setModalVisible(false);
    } catch (e) {
      setModalError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 50 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <View style={styles.headRow}>
        <Text style={styles.gymName}>{booking.gymName}</Text>
        <Text
          style={[
            styles.statusPill,
            booking.status === 'rejected' && styles.statusRejected,
            booking.status === 'checked_in' && styles.statusCheckedIn,
          ]}
        >
          {STATUS_LABEL[booking.status] || booking.status}
        </Text>
      </View>
      <Text style={styles.loc}>📍 {booking.gymArea}, {booking.gymCity}</Text>

      <View style={styles.card}>
        <Row label="Date" value={formatDate(booking.date)} />
        <Row label="Time" value={booking.hour} />
        {(() => {
          const showAmount = booking.paymentStatus === 'paid' && !!booking.amount;
          const showNote = !!booking.note;
          return (
            <>
              <Row label="Booking Code" value={booking.bookingCode} last={!showAmount && !showNote} />
              {showAmount && <Row label="Amount Paid" value={`₹${booking.amount}`} last={!showNote} />}
              {showNote && <Row label="Note" value={booking.note} last />}
            </>
          );
        })()}
      </View>

      {booking.rescheduleRequested && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Reschedule requested — {formatDate(booking.rescheduleDate)} at {booking.rescheduleHour}. Waiting for the gym to confirm; your original slot above still stands until then.
          </Text>
        </View>
      )}

      {booking.status === 'confirmed' && !!booking.qrDataUrl && (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Your booking QR</Text>
          <Image source={{ uri: booking.qrDataUrl }} style={styles.qrImage} />
          <Text style={styles.qrCaption}>
            Show this to the front desk, or scan the gym's own QR yourself below if there's no staff around.
          </Text>

          <TouchableOpacity style={styles.scanBtn} onPress={onScanToCheckIn}>
            <Text style={styles.scanBtnText}>📷 Scan Gym QR to Check In</Text>
          </TouchableOpacity>
        </View>
      )}

      {booking.status === 'confirmed' && !booking.rescheduleRequested && (
        <TouchableOpacity style={styles.rescheduleBtn} onPress={openModal}>
          <Text style={styles.rescheduleBtnText}>Running late or need a different time? Request reschedule</Text>
        </TouchableOpacity>
      )}

      {booking.status === 'checked_in' && (
        <View style={styles.checkedInBanner}>
          <Text style={styles.checkedInText}>✅ You're checked in — have a great workout!</Text>
        </View>
      )}

      {booking.status === 'rejected' && (
        <View style={styles.rejectedBanner}>
          <Text style={styles.rejectedText}>This booking was declined by the gym. Try another time.</Text>
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Request a new time</Text>
            <Text style={styles.modalSub}>Your current slot stays booked until the gym confirms this change.</Text>

            <View style={styles.dayRow}>
              {days.map((d, i) => (
                <TouchableOpacity
                  key={d.full}
                  style={[styles.dayChip, selectedDay === i && styles.dayChipActive]}
                  onPress={() => handlePickDay(i)}
                >
                  <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{d.label}</Text>
                  <Text style={[styles.dayNum, selectedDay === i && styles.dayLabelActive]}>{d.dayNum}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {slotsLoading ? (
              <ActivityIndicator color={COLORS.sageDark} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.slotWrap}>
                {slots.length === 0 ? (
                  <Text style={styles.noSlots}>No open slots this day.</Text>
                ) : (
                  slots.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.slotChip, selectedSlotId === s.id && styles.slotChipActive]}
                      onPress={() => setSelectedSlotId(s.id)}
                    >
                      <Text style={[styles.slotText, selectedSlotId === s.id && styles.slotTextActive]}>{s.hour}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <TextInput
              style={styles.noteInput}
              placeholder="Optional note for the gym (e.g. running 20 min late)"
              placeholderTextColor={COLORS.inkSoft}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {!!modalError && <Text style={styles.modalError}>{modalError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!selectedSlotId || submitting) && styles.modalSubmitBtnDisabled]}
                disabled={!selectedSlotId || submitting}
                onPress={handleSubmitReschedule}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.rowBorder]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  label: { fontSize: 13, color: COLORS.inkSoft, fontWeight: '600' },
  value: { fontSize: 13.5, color: COLORS.ink, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700', marginBottom: 18 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  gymName: { fontSize: 22, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 },
  loc: { fontSize: 13.5, color: COLORS.inkSoft, marginTop: 4, marginBottom: 20 },
  statusPill: {
    fontSize: 11, fontWeight: '700', color: COLORS.sageDark, backgroundColor: COLORS.sageLight,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, overflow: 'hidden',
  },
  statusRejected: { color: COLORS.errorText, backgroundColor: COLORS.errorBg },
  statusPending: { color: '#8A6D1F', backgroundColor: '#F7EFD8' },
  statusCheckedIn: { color: '#fff', backgroundColor: COLORS.sageDark },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.line },
  qrCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.line, marginBottom: 16,
  },
  qrTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  qrImage: { width: 180, height: 180, borderRadius: 10 },
  qrCaption: { fontSize: 12, color: COLORS.inkSoft, textAlign: 'center', marginTop: 14, marginBottom: 18, lineHeight: 17 },
  scanBtn: { backgroundColor: COLORS.gold, borderRadius: 100, paddingHorizontal: 22, paddingVertical: 14, width: '100%', alignItems: 'center' },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkedInBanner: { backgroundColor: COLORS.sageLight, borderRadius: 14, padding: 16 },
  checkedInText: { color: COLORS.sageDark, fontWeight: '700', fontSize: 13.5, textAlign: 'center' },
  pendingBanner: { backgroundColor: '#F7EFD8', borderRadius: 14, padding: 16 },
  pendingText: { color: '#8A6D1F', fontWeight: '700', fontSize: 13.5, textAlign: 'center' },
  rejectedBanner: { backgroundColor: COLORS.errorBg, borderRadius: 14, padding: 16 },
  rejectedText: { color: COLORS.errorText, fontWeight: '700', fontSize: 13.5, textAlign: 'center' },
  rescheduleBtn: {
    borderWidth: 1.5, borderColor: COLORS.sageDark, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 16, alignItems: 'center', marginBottom: 16,
  },
  rescheduleBtnText: { color: COLORS.sageDark, fontWeight: '700', fontSize: 13.5, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  modalSub: { fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 16 },
  dayRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  dayChipActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  dayLabel: { fontSize: 11, color: COLORS.inkSoft, fontWeight: '600' },
  dayNum: { fontSize: 14, color: COLORS.ink, fontWeight: '700', marginTop: 2 },
  dayLabelActive: { color: '#fff' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, minHeight: 40 },
  noSlots: { color: COLORS.inkSoft, fontSize: 13, paddingVertical: 10 },
  slotChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  slotChipActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  slotText: { fontSize: 12.5, color: COLORS.ink, fontWeight: '600' },
  slotTextActive: { color: '#fff' },
  noteInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    padding: 12, fontSize: 13, color: COLORS.ink, minHeight: 60, textAlignVertical: 'top', marginBottom: 8,
  },
  modalError: { color: COLORS.errorText, fontSize: 12.5, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 100, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  modalCancelText: { color: COLORS.ink, fontWeight: '700', fontSize: 13.5 },
  modalSubmitBtn: { flex: 1.4, paddingVertical: 14, borderRadius: 100, alignItems: 'center', backgroundColor: COLORS.sageDark },
  modalSubmitBtnDisabled: { opacity: 0.5 },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});
