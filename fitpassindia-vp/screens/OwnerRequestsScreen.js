import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { fetchBookingRequests, acceptBooking, rejectBooking } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.12)',
  dangerBg: '#FBEDEC',
  dangerText: '#B4463B',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function OwnerRequestsScreen({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState(null); // id currently being accepted/rejected

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchBookingRequests()
      .then(setRequests)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(id) {
    setActingOn(id);
    try {
      await acceptBooking(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      Alert.alert('Could not accept', e.message);
    } finally {
      setActingOn(null);
    }
  }

  function handleReject(id) {
    Alert.alert('Decline this reschedule?', "The member's original booking stays exactly as it was — no refund needed since it was never touched.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActingOn(id);
          try {
            await rejectBooking(id);
            setRequests((prev) => prev.filter((r) => r.id !== id));
          } catch (e) {
            Alert.alert('Could not decline', e.message);
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reschedule Requests</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 30 }} />}
      {!loading && error !== '' && <Text style={styles.empty}>{error}</Text>}

      {!loading && error === '' && (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 34, marginBottom: 10 }}>📭</Text>
              <Text style={styles.emptyStateTitle}>No pending requests</Text>
              <Text style={styles.empty}>Paid bookings confirm automatically — this list is for members asking to reschedule an existing booking.</Text>
            </View>
          }
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.customerName}>{r.customerName}</Text>
                <Text style={styles.code}>{r.bookingCode}</Text>
              </View>
              <Text style={styles.customerEmail}>{r.customerEmail}</Text>
              <View style={styles.timeSwap}>
                <Text style={styles.timeFrom}>{formatDate(r.originalDate)} · {r.originalHour}</Text>
                <Text style={styles.timeArrow}>→</Text>
                <Text style={styles.timeTo}>{formatDate(r.requestedDate)} · {r.requestedHour}</Text>
              </View>
              {!!r.note && <Text style={styles.note}>“{r.note}”</Text>}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(r.id)}
                  disabled={actingOn === r.id}
                >
                  <Text style={styles.rejectText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleAccept(r.id)}
                  disabled={actingOn === r.id}
                >
                  {actingOn === r.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acceptText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
  emptyState: { alignItems: 'center', paddingTop: 50 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  customerName: { fontSize: 15, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 },
  code: { fontSize: 11.5, fontWeight: '700', color: COLORS.inkSoft },
  timeSwap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  timeFrom: { fontSize: 12.5, color: COLORS.inkSoft, textDecorationLine: 'line-through' },
  timeArrow: { fontSize: 12.5, color: COLORS.sageDark, fontWeight: '700' },
  timeTo: { fontSize: 12.5, color: COLORS.ink, fontWeight: '700' },
  customerEmail: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 },
  note: { fontSize: 12.5, color: COLORS.ink, fontStyle: 'italic', backgroundColor: COLORS.sageLight, padding: 10, borderRadius: 10, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 100, alignItems: 'center' },
  rejectBtn: { backgroundColor: COLORS.dangerBg },
  rejectText: { color: COLORS.dangerText, fontWeight: '700', fontSize: 13.5 },
  acceptBtn: { backgroundColor: COLORS.sageDark },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});
