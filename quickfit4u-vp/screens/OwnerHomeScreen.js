import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { fetchTodayBookings, fetchNotifications, markNotificationRead, fetchBookingRequests, fetchMyDashboard, deleteAccount } from '../lib/api';

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

const QUOTES = [
  'The only bad workout is the one that didn\u2019t happen.',
  'A year from now you may wish you had started today.',
  'Discipline is choosing between what you want now and what you want most.',
  'Keep working even when no one is watching.',
  'Your body can stand almost anything. It\u2019s your mind you have to convince.',
  'Small daily improvements are the key to staggering long-term results.',
  'Push yourself, because no one else is going to do it for you.',
  'It\u2019s hard to beat a person who never gives up.',
  'Confidence comes from discipline and training.',
  'Action is the foundational key to all success.',
  'Sweat is just fat crying.',
  'The real workout starts when you want to stop.',
  'All progress takes place outside the comfort zone.',
  'We are what we repeatedly do. Excellence then is not an act but a habit.',
  'The body achieves what the mind believes.',
  'A one hour workout is 4% of your day. No excuses.',
  'Strength doesn\u2019t come from what you can do. It comes from overcoming what you thought you couldn\u2019t.',
];

function getWeekStrip() {
  const days = [];
  const today = new Date();
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      label: labels[d.getDay()],
      date: d.getDate(),
      full: d.toISOString().slice(0, 10),
      isToday: i === 0,
    });
  }
  return days;
}

const NOTIF_ICON = {
  booking_requested: '📩',
  booking_confirmed: '✅',
  booking_rejected: '❌',
};

function notifTimeAgo(dateStr) {
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

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

export default function OwnerHomeScreen({ user, gym, onNavigate, onLogout, onAccountDeleted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const week = getWeekStrip();
  const todayIndex = week.findIndex((d) => d.isToday);
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const quote = getDailyQuote();
 
  const [unreadOnHome, setUnreadOnHome] = useState([]);
  const bellPulse = useRef(new Animated.Value(1)).current;
  const knownUnreadIdsRef = useRef(null); // null until first load completes
  const [pendingCount, setPendingCount] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function pulseBell() {
    bellPulse.setValue(1);
    Animated.sequence([
      Animated.timing(bellPulse, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(bellPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(bellPulse, { toValue: 1.18, duration: 150, useNativeDriver: true }),
      Animated.timing(bellPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  const loadDashboard = useCallback(() => {
    fetchNotifications()
      .then((data) => {
        const unread = data.notifications.filter((n) => !n.read);
        const unreadIds = new Set(unread.map((n) => n.id));
        if (knownUnreadIdsRef.current) {
          const hasNew = unread.some((n) => !knownUnreadIdsRef.current.has(n.id));
          if (hasNew) pulseBell();
        }
        knownUnreadIdsRef.current = unreadIds;
        setUnreadOnHome(unread);
      })
      .catch(() => {});
    fetchBookingRequests().then((reqs) => setPendingCount(reqs.length)).catch(() => {});
    if (gym?.agreementSignedAt) {
      return fetchMyDashboard()
        .then(setDashboard)
        .catch(() => {})
        .finally(() => setDashboardLoading(false));
    }
    setDashboardLoading(false);
    return Promise.resolve();
  }, [gym?.agreementSignedAt]);

  useEffect(() => {
    loadDashboard();
  
    const interval = setInterval(loadDashboard, 20000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Notifications screen.
  function handleHomeNotifPress(n) {
    setUnreadOnHome((prev) => prev.filter((item) => item.id !== n.id));
    markNotificationRead(n.id).catch(() => {});
    onNavigate('notifications');
  }

  function handleRefresh() {
    setRefreshing(true);
    Promise.all([loadDashboard(), load(week[selectedDay].full)]).finally(() => setRefreshing(false));
  }

  const load = useCallback((dateStr) => {
    setLoading(true);
    setError('');
    fetchTodayBookings(dateStr)
      .then((data) => setBookings(data.bookings))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(week[selectedDay].full);
  }, [selectedDay]);

  function handleDeleteAccount() {
    setMenuOpen(false);
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and your gym listing, including its slots and bookings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            
            Alert.alert(
              'Are you absolutely sure?',
              'Your account, gym listing, and all its data will be gone for good.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount();
                      onAccountDeleted && onAccountDeleted();
                    } catch (e) {
                      Alert.alert('Could not delete account', e.message);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)}>
          <View style={styles.hamburger}>
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => onNavigate('notifications')}>
          <Animated.View style={{ transform: [{ scale: bellPulse }] }}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </Animated.View>
          {unreadOnHome.length > 0 && (
            <View style={styles.bellDot}>
              {unreadOnHome.length > 1 && (
                <Text style={styles.bellDotText}>{unreadOnHome.length > 9 ? '9+' : unreadOnHome.length}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingLine}>Hello,</Text>
          <Text style={styles.greetingLine}>
            {gym?.name || user?.name} <Text style={styles.wave}>👋</Text>
          </Text>
          {!gym && (
            <TouchableOpacity style={styles.setupBanner} onPress={() => onNavigate('ownerGymProfile')}>
              <Text style={styles.setupBannerText}>Set up your gym profile to start accepting bookings →</Text>
            </TouchableOpacity>
          )}
          {!!gym && !gym.agreementSignedAt && (
            <TouchableOpacity style={styles.setupBanner} onPress={() => onNavigate('ownerAgreement')}>
              <Text style={styles.setupBannerText}>Sign the partnership agreement so members can find your gym →</Text>
            </TouchableOpacity>
          )}
          {pendingCount > 0 && (
            <TouchableOpacity style={styles.requestBanner} onPress={() => onNavigate('ownerRequests')}>
              <Text style={styles.requestBannerText}>
                {pendingCount} reschedule request{pendingCount > 1 ? 's' : ''} waiting →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip} contentContainerStyle={{ paddingRight: 20 }}>
          {week.map((d, i) => {
            const active = selectedDay === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{d.label}</Text>
                <Text style={[styles.dayNum, active && styles.dayLabelActive]}>{d.date}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* No permanent notifications section — a card only appears here
            for unread notifications, and disappears once tapped/read. */}
        {unreadOnHome.length > 0 && (
          <View style={styles.notifPreviewBlock}>
            <View style={styles.notifPreviewHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.notifPreviewTitle}>New notification{unreadOnHome.length > 1 ? 's' : ''}</Text>
                <View style={styles.notifNewPill}>
                  <Text style={styles.notifNewPillText}>{unreadOnHome.length}</Text>
                </View>
              </View>
              {unreadOnHome.length > 1 && (
                <TouchableOpacity onPress={() => onNavigate('notifications')}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {unreadOnHome.slice(0, 3).map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifPreviewCard, styles.notifPreviewCardUnread]}
                onPress={() => handleHomeNotifPress(n)}
              >
                <Text style={styles.notifPreviewIcon}>{NOTIF_ICON[n.type] || '🔔'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifPreviewCardTitle} numberOfLines={1}>{n.title}</Text>
                  {!!n.body && <Text style={styles.notifPreviewCardBody} numberOfLines={1}>{n.body}</Text>}
                </View>
                <Text style={styles.notifPreviewTime}>{notifTimeAgo(n.createdAt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!!gym?.agreementSignedAt && (
          <TouchableOpacity style={styles.scanQrButton} onPress={() => onNavigate('ownerScanQr')}>
            <Text style={styles.scanQrIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanQrTitle}>Scan Customer QR</Text>
              <Text style={styles.scanQrSub}>Check a member in when they arrive</Text>
            </View>
            <Text style={styles.scanQrArrow}>→</Text>
          </TouchableOpacity>
        )}

        {!!gym?.agreementSignedAt && !dashboardLoading && dashboard && (
          <View style={{ marginBottom: 26 }}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Dashboard</Text>
            </View>
            <View style={styles.statGrid}>
              <StatCard label="Today's Revenue" value={`₹${dashboard.todayRevenue}`} />
              <StatCard label="This Week" value={`₹${dashboard.weekRevenue}`} />
              <StatCard label="This Month" value={`₹${dashboard.monthRevenue}`} />
              <StatCard label="Total Customers" value={String(dashboard.totalCustomers)} />
              <StatCard label="Average Rating" value={dashboard.averageRating ? `★ ${dashboard.averageRating}` : '—'} />
              <StatCard label="No-shows" value={String(dashboard.noShowCount)} warn={dashboard.noShowCount > 0} />
            </View>

            <View style={styles.payoutCard}>
              <View style={styles.payoutRow}>
                <View>
                  <Text style={styles.payoutLabel}>Pending Payout</Text>
                  <Text style={styles.payoutValue}>₹{dashboard.pendingPayoutRupees}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.payoutLabel}>Last Payout</Text>
                  <Text style={styles.payoutLastValue}>
                    {dashboard.lastPayoutAmountRupees != null
                      ? `₹${dashboard.lastPayoutAmountRupees} · ${formatPayoutDate(dashboard.lastPayoutAt)}`
                      : 'Not paid out yet'}
                  </Text>
                </View>
              </View>
              <Text style={styles.payoutHint}>
                {dashboard.pendingPayoutRupees > 0
                  ? 'This is what QuickFit4u still owes you from paid bookings.'
                  : "You're all settled up — nothing pending right now."}
              </Text>
            </View>

            {dashboard.upcomingBookings.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.subListTitle}>Upcoming bookings</Text>
                {dashboard.upcomingBookings.slice(0, 5).map((b) => (
                  <View key={b.id} style={styles.miniRow}>
                    <Text style={styles.miniRowLeft}>{b.customerName}</Text>
                    <Text style={styles.miniRowRight}>{b.date} · {b.hourLabel}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {week[selectedDay].isToday ? "Today's Bookings" : `Bookings — ${week[selectedDay].full}`}
          </Text>
          <TouchableOpacity onPress={() => onNavigate('ownerSlots')}>
            <Text style={styles.seeAll}>Manage slots</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginTop: 10 }} />}
        {!loading && error !== '' && <Text style={styles.errorText}>{error}</Text>}

        {!loading && error === '' && bookings.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No bookings for this date yet.</Text>
          </View>
        )}

        {bookings.map((b) => (
          <View key={b.id} style={styles.bookingCard}>
            <View style={styles.bookingTimeBox}>
              <Text style={styles.bookingTime}>{b.hourLabel}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingCustomer}>{b.customerName}</Text>
              <Text style={styles.bookingEmail}>{b.customerEmail}</Text>
            </View>
            <Text style={styles.bookingCode}>{b.bookingCode}</Text>
          </View>
        ))}

        {/* Thought of the day — placed last, styled as a standalone quote (matches the member home screen) */}
        <View style={styles.quoteBlock}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{quote}</Text>
          <View style={styles.quoteRule} />
          <Text style={styles.quoteLabel}>Thought of the day</Text>
        </View>
      </ScrollView>

      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuPanel}>
            <Text style={styles.menuUser}>{gym?.name || user?.name}</Text>
            <View style={styles.menuDivider} />
            <MenuItem label="My Profile" onPress={() => { setMenuOpen(false); onNavigate('profile'); }} />
            <MenuItem
              label="Gym Profile"
              onPress={() => {
                setMenuOpen(false);
                if (gym?.agreementSignedAt) onNavigate('ownerGymView');
                else if (gym) onNavigate('ownerAgreement');
                else onNavigate('ownerGymProfile');
              }}
            />
            <MenuItem label="Home" onPress={() => setMenuOpen(false)} />
            <MenuItem
              label={`Booking Requests${pendingCount > 0 ? `  ·  ${pendingCount}` : ''}`}
              onPress={() => { setMenuOpen(false); onNavigate('ownerRequests'); }}
            />
            <MenuItem label="Booked Slots" onPress={() => { setMenuOpen(false); onNavigate('ownerSlots'); }} />
            <MenuItem label="Previous Customers" onPress={() => { setMenuOpen(false); onNavigate('ownerCustomers'); }} />
            <MenuItem label="Payout / Bank Details" onPress={() => { setMenuOpen(false); onNavigate('ownerBankDetails'); }} />
            <MenuItem label="Help & Feedback" onPress={() => { setMenuOpen(false); onNavigate('feedback'); }} />
            <MenuItem label="Settings" onPress={() => { setMenuOpen(false); onNavigate('settings'); }} />
            <MenuItem label="Privacy Policy" onPress={() => { setMenuOpen(false); onNavigate('privacyPolicy'); }} />
            <MenuItem label="Terms & Conditions" onPress={() => { setMenuOpen(false); onNavigate('termsConditions'); }} />
            <View style={styles.menuDivider} />
            <MenuItem label="Log Out" danger onPress={() => { setMenuOpen(false); onLogout && onLogout(); }} />
            <MenuItem label="Delete Account" danger onPress={handleDeleteAccount} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuItem({ label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, danger && { color: '#B4463B' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatPayoutDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StatCard({ label, value, warn }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, warn && styles.statValueWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10 },
  hamburger: { width: 26, justifyContent: 'space-between', height: 16 },
  hbLine: { height: 2.4, backgroundColor: COLORS.ink, borderRadius: 2 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellDot: {
    position: 'absolute', top: 5, right: 5, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#B4463B', borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  requestBanner: { backgroundColor: COLORS.ink, borderRadius: 12, padding: 12, marginTop: 14 },
  requestBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  greetingBlock: { paddingHorizontal: 20, marginTop: 6, marginBottom: 18 },
  greetingLine: { fontSize: 42, fontWeight: '800', color: COLORS.ink, lineHeight: 46 },
  wave: { fontSize: 34 },
  setupBanner: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 12, marginTop: 14 },
  setupBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  calendarStrip: { paddingLeft: 20, marginBottom: 22 },
  dayPill: { width: 56, paddingVertical: 12, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.line },
  dayPillActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  dayLabel: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 },
  dayNum: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  dayLabelActive: { color: '#fff' },
  quoteBlock: {
    marginHorizontal: 20, marginTop: 6, marginBottom: 10,
    backgroundColor: COLORS.ink, borderRadius: 20,
    paddingHorizontal: 26, paddingTop: 18, paddingBottom: 26,
    alignItems: 'center',
  },
  quoteMark: {
    fontSize: 54, lineHeight: 54, color: COLORS.gold, fontWeight: '700', marginBottom: 4,
  },
  quoteText: {
    fontSize: 16.5, color: COLORS.cream, fontStyle: 'italic', lineHeight: 25,
    textAlign: 'center', fontWeight: '500',
  },
  quoteRule: {
    width: 34, height: 2, backgroundColor: COLORS.gold, borderRadius: 2,
    marginTop: 18, marginBottom: 10,
  },
  quoteLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.sage, letterSpacing: 1.4, textTransform: 'uppercase',
  },
  scanQrButton: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: COLORS.ink, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 18,
  },
  scanQrIcon: { fontSize: 26 },
  scanQrTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  scanQrSub: { fontSize: 12, color: COLORS.sage, marginTop: 2 },
  scanQrArrow: { fontSize: 18, color: COLORS.gold, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 },
  seeAll: { fontSize: 13, color: COLORS.sageDark, fontWeight: '600' },
  notifPreviewBlock: { marginHorizontal: 20, marginBottom: 20 },
  notifPreviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  notifPreviewTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  notifPreviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.line,
  },
  notifPreviewCardUnread: { borderColor: COLORS.gold, borderWidth: 1.5, backgroundColor: '#FBF3DC' },
  notifNewPill: {
    backgroundColor: COLORS.gold, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2.5,
  },
  notifNewPillText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  notifPreviewIcon: { fontSize: 18 },
  notifPreviewCardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  notifPreviewCardBody: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 },
  notifPreviewTime: { fontSize: 10.5, color: COLORS.inkSoft },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10 },
  statCard: {
    width: '30%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.line,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.sageDark },
  statValueWarn: { color: '#B4463B' },
  statLabel: { fontSize: 10.5, color: COLORS.inkSoft, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  payoutCard: {
    marginHorizontal: 14, marginTop: 12, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.line,
  },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  payoutLabel: { fontSize: 11, color: COLORS.inkSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  payoutValue: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginTop: 4 },
  payoutLastValue: { fontSize: 13, fontWeight: '700', color: COLORS.sageDark, marginTop: 6 },
  payoutHint: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 10 },
  subListTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginHorizontal: 20, marginBottom: 8 },
  miniRow: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff',
    marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6,
    borderWidth: 1, borderColor: COLORS.line,
  },
  miniRowLeft: { fontSize: 12.5, fontWeight: '700', color: COLORS.ink },
  miniRowRight: { fontSize: 11.5, color: COLORS.inkSoft },
  errorText: { color: '#B4463B', textAlign: 'center', marginHorizontal: 20, fontSize: 13 },
  emptyCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderStyle: 'dashed' },
  emptyText: { color: COLORS.inkSoft, fontSize: 14 },
  bookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.line },
  bookingTimeBox: { backgroundColor: COLORS.sageLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginRight: 12 },
  bookingTime: { fontSize: 12.5, fontWeight: '700', color: COLORS.sageDark },
  bookingCustomer: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  bookingEmail: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 },
  bookingCode: { fontSize: 11.5, fontWeight: '700', color: COLORS.gold },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row' },
  menuPanel: { width: '72%', height: '100%', backgroundColor: COLORS.cream, paddingTop: 70, paddingHorizontal: 24 },
  menuUser: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  menuDivider: { height: 1, backgroundColor: COLORS.line, marginVertical: 10 },
  menuItem: { paddingVertical: 14 },
  menuItemText: { fontSize: 15.5, color: COLORS.ink, fontWeight: '500' },
});