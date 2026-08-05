import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { fetchGyms, fetchNotifications, deleteAccount } from '../lib/api';

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
  'Discipline is choosing between what you want now and what you want most.',
  'Your body can stand almost anything. It\u2019s your mind you have to convince.',
  'Small daily improvements are the key to staggering long-term results.',
  'Push yourself, because no one else is going to do it for you.',
  'Sweat is just fat crying.',
  'A one hour workout is 4% of your day. No excuses.',
  'Strength doesn\u2019t come from what you can do. It comes from overcoming what you thought you couldn\u2019t.',
];

function getWeekStrip() {
  const days = [];
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7; 
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayIndex);

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      label: labels[i],
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  return days;
}

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

export default function HomeScreen({ user, onOpenGym, onLogout, onNavigate, onAccountDeleted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [locationLabel, setLocationLabel] = useState('Finding your location...');
  const [gyms, setGyms] = useState([]);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const week = getWeekStrip();
  const quote = getDailyQuote();
  const isSearching = searchQuery.trim().length > 0;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return; 
    fetchNotifications()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {});
  }, [user]);

  function handleDeleteAccount() {
    setMenuOpen(false);
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, bookings, and reviews. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            
            Alert.alert(
              'Are you absolutely sure?',
              'Your account and all its data will be gone for good.',
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

  async function loadEverything({ isRefresh = false } = {}) {
    if (isRefresh) setRefreshing(true);
    else setLoadingGyms(true);
    setLoadError('');

    let cityForSearch = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('Enable location to see gyms near you');
      } else {
        const pos = await Location.getCurrentPositionAsync({});
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const place = places[0];
        if (place) {
          setLocationLabel(`Near ${place.district || place.city || place.subregion || 'you'}`);
          cityForSearch = place.city || place.subregion || null;
        } else {
          setLocationLabel('Nearby gyms');
        }
      }
    } catch (e) {
      setLocationLabel('Nearby gyms');
    }

    try {
      const results = await fetchGyms(cityForSearch);
      setGyms(results);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoadingGyms(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadEverything();
  }, []);

 
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    const timer = setTimeout(async () => {
      try {
        const results = await fetchGyms({ search: q });
        setSearchResults(results);
      } catch (e) {
        setSearchError(e.message);
      } finally {
        setSearching(false);
      }
    }, 400); 

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)}>
          <View style={styles.hamburger}>
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => (user ? onNavigate('notifications') : onLogout && onLogout())}
        >
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadEverything({ isRefresh: true })} tintColor={COLORS.sageDark} />
        }
      >
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingLine}>Hello,</Text>
          <Text style={styles.greetingLine}>
            {user?.name || 'there'} <Text style={styles.wave}>👋</Text>
          </Text>
          {!user && (
            <TouchableOpacity style={styles.loginBanner} onPress={() => onLogout && onLogout()}>
              <Text style={styles.loginBannerText}>Log in or sign up to book slots and save your bookings →</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchBar}>
          <Text style={{ opacity: 0.5, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="Search gyms, areas..."
            placeholderTextColor={COLORS.inkSoft}
            style={{ flex: 1, color: COLORS.ink }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: COLORS.inkSoft, fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Calendar strip — hidden while searching to keep focus on results */}
        {!isSearching && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip} contentContainerStyle={{ paddingRight: 20 }}>
            {week.map((d, i) => {
              const active = selectedDay === i || (selectedDay === null && d.isToday);
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
        )}

        {!!user && (
          <TouchableOpacity style={styles.scanQrButton} onPress={() => onNavigate('memberScanQr')}>
            <Text style={styles.scanQrIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanQrTitle}>Scan Gym QR</Text>
              <Text style={styles.scanQrSub}>Check in at the gym's front desk</Text>
            </View>
            <Text style={styles.scanQrArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Nearby gyms, or search results when the user is typing */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {isSearching ? `Results for "${searchQuery.trim()}"` : locationLabel}
          </Text>
          {!isSearching && (
            <TouchableOpacity onPress={() => onOpenGym && onOpenGym(null, true)}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {(isSearching ? searching : loadingGyms) && (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.sageDark} />
          </View>
        )}

        {isSearching && !searching && searchError !== '' && (
          <Text style={styles.errorText}>{searchError}</Text>
        )}

        {isSearching && !searching && searchError === '' && searchResults.length === 0 && (
          <Text style={styles.emptyText}>No gyms match "{searchQuery.trim()}".</Text>
        )}

        {!isSearching && !loadingGyms && loadError !== '' && (
          <Text style={styles.errorText}>{loadError}</Text>
        )}

        {!isSearching && !loadingGyms && loadError === '' && gyms.length === 0 && (
          <Text style={styles.emptyText}>No gyms listed near you yet.</Text>
        )}

        {(isSearching ? searchResults : gyms.slice(0, 5)).map((g) => (
          <TouchableOpacity key={g.id} style={styles.gymCard} onPress={() => onOpenGym && onOpenGym(g)}>
            <View style={styles.gymPhotoHeader}>
              {g.photos && g.photos[0] ? (
                <Image source={{ uri: g.photos[0] }} style={styles.gymPhotoImg} />
              ) : (
                <View style={styles.gymPhotoImg} />
              )}
              <Text style={styles.gymPhotoChevron}>›</Text>
            </View>
            <View style={styles.gymCardBody}>
              <Text style={styles.gymName}>{g.name}</Text>
              <Text style={styles.gymArea}>📍 {g.area}</Text>
              <View style={styles.gymBottomRow}>
                <View style={styles.gymTagRow}>
                  <Text style={styles.gymTag}>{g.tags?.[0] || 'Gym'}</Text>
                  {g.rating != null && <Text style={styles.gymRating}>★ {g.rating}</Text>}
                </View>
                <Text style={styles.gymPrice}>₹{g.hourlyRate}/hr</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Thought of the day — placed last, styled as a standalone quote */}
        <View style={styles.quoteBlock}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{quote}</Text>
          <View style={styles.quoteRule} />
          <Text style={styles.quoteLabel}>Thought of the day</Text>
        </View>
      </ScrollView>

      {/* Dashboard menu */}
      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuPanel}>
            <Text style={styles.menuUser}>{user?.name || 'Guest'}</Text>
            <View style={styles.menuDivider} />
            <MenuItem label="My Profile" onPress={() => { setMenuOpen(false); onNavigate('profile'); }} />
            <MenuItem label="Find a Gym" onPress={() => { setMenuOpen(false); onOpenGym && onOpenGym(null, true); }} />
            <MenuItem label="Your Bookings" onPress={() => { setMenuOpen(false); onNavigate('myBookings'); }} />
            {!!user && (
              <MenuItem label="Scan Gym QR" onPress={() => { setMenuOpen(false); onNavigate('memberScanQr'); }} />
            )}
            <MenuItem label="How it Works" onPress={() => { setMenuOpen(false); onNavigate('howItWorks'); }} />
            <MenuItem label="Settings" onPress={() => { setMenuOpen(false); onNavigate('settings'); }} />
            <MenuItem label="Privacy Policy" onPress={() => { setMenuOpen(false); onNavigate('privacyPolicy'); }} />
            <MenuItem label="Terms & Conditions" onPress={() => { setMenuOpen(false); onNavigate('termsConditions'); }} />
            <View style={styles.menuDivider} />
            <MenuItem
              label={user ? 'Log Out' : 'Log In'}
              danger={!!user}
              onPress={() => { setMenuOpen(false); onLogout && onLogout(); }}
            />
            {!!user && (
              <MenuItem label="Delete Account" danger onPress={handleDeleteAccount} />
            )}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 10,
  },
  hamburger: { width: 26, justifyContent: 'space-between', height: 16 },
  hbLine: { height: 2.4, backgroundColor: COLORS.ink, borderRadius: 2 },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellDot: {
    position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#B4463B', borderWidth: 1.5, borderColor: '#fff',
  },
  greetingBlock: { paddingHorizontal: 20, marginTop: 6, marginBottom: 18 },
  loginBanner: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 12, marginTop: 12 },
  loginBannerText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  greetingLine: { fontSize: 42, fontWeight: '800', color: COLORS.ink, lineHeight: 46 },
  wave: { fontSize: 34 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.line, marginBottom: 22,
  },
  calendarStrip: { paddingLeft: 20, marginBottom: 22 },
  dayPill: {
    width: 56, paddingVertical: 12, borderRadius: 18, backgroundColor: '#fff',
    alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.line,
  },
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
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  seeAll: { fontSize: 13, color: COLORS.sageDark, fontWeight: '600' },
  errorText: { color: '#B4463B', textAlign: 'center', marginBottom: 20, paddingHorizontal: 20, fontSize: 13 },
  emptyText: { color: COLORS.inkSoft, textAlign: 'center', marginBottom: 20, fontSize: 13.5 },
  gymCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20, borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden',
  },
  gymPhotoHeader: { width: '100%', height: 150, backgroundColor: COLORS.sageLight, position: 'relative' },
  gymPhotoImg: { width: '100%', height: '100%' },
  gymPhotoChevron: {
    position: 'absolute', top: '42%', right: 12, fontSize: 30, fontWeight: '700',
    color: '#fff', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4,
  },
  gymCardBody: { padding: 14 },
  gymName: { fontSize: 15.5, fontWeight: '700', color: COLORS.ink },
  gymArea: { fontSize: 12.5, color: COLORS.inkSoft, marginTop: 3, marginBottom: 10 },
  gymBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gymTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gymTag: {
    fontSize: 10.5, backgroundColor: COLORS.sageLight, color: COLORS.sageDark,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, fontWeight: '600',
  },
  gymRating: { fontSize: 11.5, color: COLORS.gold, fontWeight: '700' },
  gymPrice: { fontSize: 14.5, fontWeight: '700', color: COLORS.sageDark },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row' },
  menuPanel: {
    width: '72%', height: '100%', backgroundColor: COLORS.cream,
    paddingTop: 70, paddingHorizontal: 24,
  },
  menuUser: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 16 },
  menuDivider: { height: 1, backgroundColor: COLORS.line, marginVertical: 10 },
  menuItem: { paddingVertical: 14 },
  menuItemText: { fontSize: 15.5, color: COLORS.ink, fontWeight: '500' },
});