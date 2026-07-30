import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchNotifications, markAllNotificationsRead } from '../lib/api';

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

const ICON = {
  booking_requested: '📩',
  booking_confirmed: '✅',
  booking_rejected: '❌',
};

function timeAgo(dateStr) {
  const then = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen({ onBack, onNavigate, role }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications()
      .then((data) => {
        setNotifications(data.notifications);
        // Mark everything read now that the user has opened the bell.
        if (data.unreadCount > 0) markAllNotificationsRead().catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handlePress(n) {
    if (n.type === 'booking_requested') {
      onNavigate(role === 'owner' ? 'ownerRequests' : 'home');
    } else if (n.type === 'booking_confirmed' || n.type === 'booking_rejected') {
      onNavigate('myBookings');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 30 }} />}
      {!loading && error !== '' && <Text style={styles.empty}>{error}</Text>}

      {!loading && error === '' && (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 34, marginBottom: 10 }}>🔔</Text>
              <Text style={styles.emptyStateTitle}>No notifications yet</Text>
              <Text style={styles.empty}>Booking requests and updates will show up here.</Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <TouchableOpacity style={styles.card} onPress={() => handlePress(n)} activeOpacity={0.7}>
              <Text style={styles.icon}>{ICON[n.type] || '🔔'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                {!!n.body && <Text style={styles.notifBody}>{n.body}</Text>}
                <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
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
  emptyState: { alignItems: 'center', paddingTop: 50 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.line,
  },
  icon: { fontSize: 20, marginTop: 2 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 3 },
  notifBody: { fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: COLORS.inkSoft },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, marginTop: 4 },
});
