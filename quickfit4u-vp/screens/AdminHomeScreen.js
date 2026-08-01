import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchAdminStats } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.12)',
  dangerText: '#B4463B',
};

export default function AdminHomeScreen({ user, onNavigate, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    fetchAdminStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>{user?.name || 'Admin'}</Text>
        </View>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Log Out</Text>
        </TouchableOpacity>
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

        {!loading && error === '' && stats && (
          <>
            <View style={styles.grid}>
              <StatCard label="Total Users" value={stats.totalUsers} sub={`${stats.totalMembers} members · ${stats.totalOwners} owners`} />
              <StatCard label="Total Gyms" value={stats.totalGyms} sub={`${stats.liveGyms} live · ${stats.pendingGyms} pending`} />
              <StatCard label="Today's Bookings" value={stats.todaysBookings} wide />
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Manage</Text>
            </View>

            <TouchableOpacity style={styles.linkCard} onPress={() => onNavigate('adminGyms')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>Gym Management</Text>
                <Text style={styles.linkSub}>Name, owner, contact, pricing, facilities, rating</Text>
              </View>
              <Text style={styles.linkChevron}>›</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub, wide }) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {!!sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: COLORS.sageDark, letterSpacing: 1.4 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink, marginTop: 4 },
  logout: { fontSize: 13.5, fontWeight: '700', color: COLORS.dangerText },
  errorText: { color: COLORS.dangerText, textAlign: 'center', marginTop: 20, paddingHorizontal: 20, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  statCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.line,
  },
  statCardWide: { flexBasis: '100%' },
  statValue: { fontSize: 30, fontWeight: '800', color: COLORS.ink },
  statLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.sageDark, marginTop: 4 },
  statSub: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4 },
  sectionHead: { paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.line,
  },
  linkTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  linkSub: { fontSize: 12, color: COLORS.inkSoft, marginTop: 3 },
  linkChevron: { fontSize: 22, color: COLORS.sageDark, fontWeight: '700' },
});
