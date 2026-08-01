import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchMyCustomers } from '../lib/api';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  line: 'rgba(43,51,40,0.12)',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OwnerCustomersScreen({ onBack }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyCustomers()
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Previous Customers</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 30 }} />}
      {!loading && error !== '' && <Text style={styles.empty}>{error}</Text>}

      {!loading && error === '' && (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>No one has booked your gym yet.</Text>}
          renderItem={({ item: c }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.email}>{c.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.visits}>{c.visitCount} visit{c.visitCount === 1 ? '' : 's'}</Text>
                <Text style={styles.lastVisit}>Last: {formatDate(c.lastVisit)}</Text>
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
  empty: { textAlign: 'center', color: COLORS.inkSoft, marginTop: 40, paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.line },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.sageLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.sageDark },
  name: { fontSize: 14.5, fontWeight: '700', color: COLORS.ink },
  email: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  visits: { fontSize: 12.5, fontWeight: '700', color: COLORS.sageDark },
  lastVisit: { fontSize: 11, color: COLORS.inkSoft, marginTop: 2 },
});
