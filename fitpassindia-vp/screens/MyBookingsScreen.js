import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchMyBookings } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.12)',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
};

export default function MyBookingsScreen({ onBack, onOpenGym, onOpenBooking }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyBookings()
      .then(setBookings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Bookings</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 30 }} />}
      {!loading && error !== '' && <Text style={styles.empty}>{error}</Text>}

      {!loading && error === '' && (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No bookings yet</Text>
              <Text style={styles.empty}>Once you book a slot, it'll show up here with your check-in code.</Text>
              <TouchableOpacity style={styles.findBtn} onPress={() => onOpenGym && onOpenGym()}>
                <Text style={styles.findBtnText}>Find a Gym</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: b }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onOpenBooking && onOpenBooking(b)}>
              <View style={styles.rowBetween}>
                <Text style={styles.gymName}>{b.gymName}</Text>
                <Text
                  style={[
                    styles.statusPill,
                    b.status === 'rejected' && styles.statusRejected,
                    b.status === 'cancelled' && styles.statusCancelled,
                    b.rescheduleRequested && styles.statusPending,
                  ]}
                >
                  {b.rescheduleRequested ? 'Reschedule pending' : (STATUS_LABEL[b.status] || b.status)}
                </Text>
              </View>
              <Text style={styles.gymLoc}>📍 {b.gymArea}, {b.gymCity}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.dateHour}>{formatDate(b.date)} · {b.hour}</Text>
                <Text style={styles.code}>{b.bookingCode}</Text>
              </View>
              <View style={styles.rowBetween}>
                {!!b.note && <Text style={styles.noteText}>“{b.note}”</Text>}
                {b.paymentStatus === 'paid' && !!b.amount && (
                  <Text style={styles.paidPill}>₹{b.amount} paid</Text>
                )}
              </View>
              {b.rescheduleRequested && (
                <Text style={styles.pendingHint}>
                  Reschedule requested — {formatDate(b.rescheduleDate)} · {b.rescheduleHour}. Your slot above still stands until the gym confirms.
                </Text>
              )}
              {b.status === 'confirmed' && (
                <Text style={styles.tapHint}>Tap to view your QR & check in →</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  empty: { textAlign: 'center', color: COLORS.inkSoft, marginTop: 10, paddingHorizontal: 20, lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyStateTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  findBtn: { backgroundColor: COLORS.sageDark, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13, marginTop: 18 },
  findBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.line },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  gymName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 },
  gymLoc: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 10 },
  dateHour: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  code: { fontSize: 12.5, fontWeight: '700', color: COLORS.gold, letterSpacing: 0.5 },
  statusPill: { fontSize: 10.5, fontWeight: '700', color: COLORS.sageDark, backgroundColor: COLORS.sageLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusCancelled: { color: '#B4463B', backgroundColor: '#F7E3E1' },
  statusRejected: { color: '#B4463B', backgroundColor: '#F7E3E1' },
  statusPending: { color: '#8A6D1F', backgroundColor: '#F7EFD8' },
  noteText: { fontSize: 12, color: COLORS.inkSoft, fontStyle: 'italic', marginTop: 8 },
  paidPill: { fontSize: 11, fontWeight: '700', color: COLORS.sageDark, marginTop: 8 },
  pendingHint: { fontSize: 11.5, color: '#8A6D1F', marginTop: 6, fontWeight: '600' },
  tapHint: { fontSize: 11.5, color: COLORS.sageDark, marginTop: 8, fontWeight: '700' },
});
