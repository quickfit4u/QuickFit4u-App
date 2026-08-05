import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Image, RefreshControl, TextInput } from 'react-native';
import { fetchAdminGyms } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.12)',
  dangerText: '#B4463B',
  liveBg: '#E7EEDF',
  liveText: '#5E7A4E',
  pendingBg: '#FBEEDB',
  pendingText: '#A9781E',
};

export default function AdminGymsScreen({ onBack }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    fetchAdminGyms()
      .then(setGyms)
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? gyms.filter((g) =>
        [g.name, g.ownerName, g.city, g.area].some((v) => (v || '').toLowerCase().includes(q))
      )
    : gyms;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gym Management</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by gym, owner, or city"
          placeholderTextColor={COLORS.inkSoft}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} tintColor={COLORS.sageDark} />}
      >
        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.sageDark} />
          </View>
        )}

        {!loading && error !== '' && <Text style={styles.errorText}>{error}</Text>}

        {!loading && error === '' && filtered.length === 0 && (
          <Text style={styles.emptyText}>No gyms match that search.</Text>
        )}

        {filtered.map((g) => (
          <View key={g.id} style={styles.card}>
            <View style={styles.cardHeader}>
              {g.photos?.[0] ? (
                <Image source={{ uri: g.photos[0] }} style={styles.photo} />
              ) : (
                <View style={styles.photo} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.gymName}>{g.name}</Text>
                <Text style={styles.ownerLine}>Owner: {g.ownerName}</Text>
              </View>
              <View style={[styles.statusBadge, g.status === 'live' ? styles.statusLive : styles.statusPending]}>
                <Text style={[styles.statusText, g.status === 'live' ? styles.statusTextLive : styles.statusTextPending]}>
                  {g.status === 'live' ? 'Live' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <Detail label="Phone" value={g.phone || '—'} />
              <Detail label="Price" value={`₹${g.hourlyRate}/hr`} />
              <Detail label="City" value={g.city || '—'} />
              <Detail label="Rating" value={g.rating ? `★ ${g.rating} (${g.reviewCount})` : 'No reviews yet'} />
            </View>

            <Detail label="Address" value={g.address || '—'} full />

            {g.facilities?.length > 0 && (
              <View style={styles.tagRow}>
                {g.facilities.map((f) => (
                  <View key={f} style={styles.tag}>
                    <Text style={styles.tagText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Detail({ label, value, full }) {
  return (
    <View style={full ? styles.detailFull : styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  searchBar: { marginHorizontal: 20, marginBottom: 16 },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.ink,
  },
  errorText: { color: COLORS.dangerText, textAlign: 'center', marginTop: 20, paddingHorizontal: 20, fontSize: 13 },
  emptyText: { color: COLORS.inkSoft, textAlign: 'center', marginTop: 30, fontSize: 13.5 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  photo: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.sageLight, marginRight: 12 },
  gymName: { fontSize: 15.5, fontWeight: '700', color: COLORS.ink },
  ownerLine: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, marginLeft: 8 },
  statusLive: { backgroundColor: COLORS.liveBg },
  statusPending: { backgroundColor: COLORS.pendingBg },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  statusTextLive: { color: COLORS.liveText },
  statusTextPending: { color: COLORS.pendingText },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  detailItem: { width: '50%', marginBottom: 10 },
  detailFull: { marginBottom: 10 },
  detailLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailValue: { fontSize: 13.5, color: COLORS.ink, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: COLORS.sageLight, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100 },
  tagText: { fontSize: 11, color: COLORS.sageDark, fontWeight: '600' },
});
