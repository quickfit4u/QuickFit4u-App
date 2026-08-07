import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { fetchGyms } from '../lib/api';

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

const FACILITY_OPTIONS = [
  { key: 'ac', label: 'AC' },
  { key: 'personalTrainer', label: 'Personal Trainer' },
  { key: 'parking', label: 'Parking' },
  { key: 'shower', label: 'Shower' },
  { key: 'femaleFriendly', label: 'Female Friendly' },
];

const RATING_OPTIONS = [4.5, 4, 3.5, 3];

const SORT_OPTIONS = [
  { key: null, label: 'Default' },
  { key: 'distance', label: 'Nearest' },
  { key: 'price', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'rating', label: 'Top Rated' },
];

const DEFAULT_FILTERS = {
  minPrice: '',
  maxPrice: '',
  minRating: null,
  ac: false,
  personalTrainer: false,
  parking: false,
  shower: false,
  femaleFriendly: false,
  openNow: false,
  maxDistanceKm: '',
  sortBy: null,
};

const QUICK_CHIPS = [
  { key: 'nearest', label: '📍 Nearest' },
  { key: 'new', label: 'New to you' },
  { key: 'price', label: '₹ Price' },
  { key: 'top', label: '★ Top Rated' },
];

function isQuickChipActive(key, f) {
  if (key === 'nearest') return f.sortBy === 'distance';
  if (key === 'new') return f.sortBy == null && !f.minRating;
  if (key === 'price') return f.sortBy === 'price' || f.sortBy === 'price_desc';
  if (key === 'top') return f.sortBy === 'rating' && f.minRating === 4;
  return false;
}

function quickChipLabel(key, f) {
  if (key === 'price') return f.sortBy === 'price_desc' ? '₹ Price: High to Low' : '₹ Price: Low to High';
  return QUICK_CHIPS.find((c) => c.key === key).label;
}

function applyQuickChip(key, f) {
  if (key === 'price') {
    // Cycles: off -> Low to High -> High to Low -> off
    if (f.sortBy === 'price') return { ...f, sortBy: 'price_desc' };
    if (f.sortBy === 'price_desc') return { ...f, sortBy: null };
    return { ...f, sortBy: 'price' };
  }
  // Tapping an active quick chip again turns it off (back to default sort).
  if (isQuickChipActive(key, f)) {
    if (key === 'nearest') return { ...f, sortBy: null };
    if (key === 'top') return { ...f, sortBy: null, minRating: null };
    return f;
  }
  if (key === 'nearest') return { ...f, sortBy: 'distance' };
  if (key === 'new') return { ...f, sortBy: null, minRating: null };
  if (key === 'top') return { ...f, sortBy: 'rating', minRating: 4 };
  return f;
}

function countActiveFilters(f) {
  let n = 0;
  if (f.minPrice) n++;
  if (f.maxPrice) n++;
  if (f.minRating) n++;
  if (f.ac) n++;
  if (f.personalTrainer) n++;
  if (f.parking) n++;
  if (f.shower) n++;
  if (f.femaleFriendly) n++;
  if (f.openNow) n++;
  if (f.maxDistanceKm) n++;
  if (f.sortBy) n++;
  return n;
}

export default function GymListScreen({ onBack, onOpenGym }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coords, setCoords] = useState(null); 
  const [locatingUser, setLocatingUser] = useState(false);

  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function ensureLocation() {
    if (coords) return coords;
    setLocatingUser(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({});
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      return next;
    } catch (e) {
      return null;
    } finally {
      setLocatingUser(false);
    }
  }

  async function loadGyms({ isRefresh = false } = {}) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

   
    let loc = coords;
    if ((filters.sortBy === 'distance' || filters.maxDistanceKm) && !loc) {
      loc = await ensureLocation();
    }

    try {
      const results = await fetchGyms({
        search: debouncedQuery || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        minRating: filters.minRating || undefined,
        ac: filters.ac,
        personalTrainer: filters.personalTrainer,
        parking: filters.parking,
        shower: filters.shower,
        femaleFriendly: filters.femaleFriendly,
        openNow: filters.openNow,
        maxDistanceKm: filters.maxDistanceKm || undefined,
        sortBy: filters.sortBy || undefined,
        lat: loc?.lat,
        lng: loc?.lng,
      });
      setGyms(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadGyms();
    
  }, [debouncedQuery, filters]);

  function openFilters() {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }

  async function applyFilters() {
 
    if ((draftFilters.sortBy === 'distance' || draftFilters.maxDistanceKm) && !coords) {
      await ensureLocation();
    }
    setFilters(draftFilters);
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
  }

  function toggleFacility(key) {
    setDraftFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  const activeCount = countActiveFilters(filters);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Find a Gym</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Text style={{ opacity: 0.5, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="Search gyms, areas, amenities..."
            placeholderTextColor={COLORS.inkSoft}
            style={{ flex: 1, color: COLORS.ink }}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilters}>
          <Text style={styles.filterBtnIcon}>⚙︎</Text>
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickChipRow}
        contentContainerStyle={styles.quickChipRowContent}
      >
        <TouchableOpacity style={styles.quickChip} onPress={openFilters}>
          <Text style={styles.quickChipText}>Filters</Text>
          <Text style={styles.quickChipCaret}>▾</Text>
        </TouchableOpacity>
        {QUICK_CHIPS.map((chip) => {
          const active = isQuickChipActive(chip.key, filters);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.quickChip, active && styles.quickChipActive]}
              onPress={async () => {
                if (chip.key === 'nearest' && !coords) {
                  await ensureLocation();
                }
                setFilters((f) => applyQuickChip(chip.key, f));
              }}
            >
              <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                {quickChipLabel(chip.key, filters)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersText}>{activeCount} filter{activeCount > 1 ? 's' : ''} applied</Text>
          <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {(loading || locatingUser) && (
        <View style={{ paddingTop: 40 }}>
          <ActivityIndicator color={COLORS.sageDark} />
        </View>
      )}

      {!loading && error !== '' && <Text style={styles.empty}>{error}</Text>}

      {!loading && !locatingUser && error === '' && (
        <FlatList
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadGyms({ isRefresh: true })} tintColor={COLORS.sageDark} />
          }
          data={gyms}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>No gyms match your search and filters.</Text>}
          renderItem={({ item: g }) => (
            <TouchableOpacity style={styles.gymCard} onPress={() => onOpenGym(g)}>
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
                <Text style={styles.gymArea}>
                  📍 {g.area}, {g.city}{g.distanceKm != null ? ` · ${g.distanceKm} km away` : ''}
                </Text>
                <View style={styles.gymBottomRow}>
                  <View style={styles.gymTagRow}>
                    {(g.tags || []).slice(0, 2).map((t) => (
                      <Text key={t} style={styles.gymTag}>{t}</Text>
                    ))}
                    {g.rating != null && <Text style={styles.gymRating}>★ {g.rating}</Text>}
                  </View>
                  <Text style={styles.gymPrice}>₹{g.hourlyRate}/hr</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Filters bottom sheet */}
      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setFiltersOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={resetFilters}>
                <Text style={styles.sheetReset}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.sheetSectionLabel}>Sort by</Text>
              <View style={styles.pillRow}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.pill, draftFilters.sortBy === opt.key && styles.pillActive]}
                    onPress={() => setDraftFilters((f) => ({ ...f, sortBy: opt.key }))}
                  >
                    <Text style={[styles.pillText, draftFilters.sortBy === opt.key && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetSectionLabel}>Price per hour (₹)</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Min"
                  placeholderTextColor={COLORS.inkSoft}
                  keyboardType="number-pad"
                  value={String(draftFilters.minPrice || '')}
                  onChangeText={(t) => setDraftFilters((f) => ({ ...f, minPrice: t.replace(/[^0-9]/g, '') }))}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Max"
                  placeholderTextColor={COLORS.inkSoft}
                  keyboardType="number-pad"
                  value={String(draftFilters.maxPrice || '')}
                  onChangeText={(t) => setDraftFilters((f) => ({ ...f, maxPrice: t.replace(/[^0-9]/g, '') }))}
                />
              </View>

              <Text style={styles.sheetSectionLabel}>Minimum rating</Text>
              <View style={styles.pillRow}>
                {RATING_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.pill, draftFilters.minRating === r && styles.pillActive]}
                    onPress={() => setDraftFilters((f) => ({ ...f, minRating: f.minRating === r ? null : r }))}
                  >
                    <Text style={[styles.pillText, draftFilters.minRating === r && styles.pillTextActive]}>
                      ★ {r}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetSectionLabel}>Distance</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={[styles.rangeInput, { flex: 1 }]}
                  placeholder="Within how many km?"
                  placeholderTextColor={COLORS.inkSoft}
                  keyboardType="number-pad"
                  value={String(draftFilters.maxDistanceKm || '')}
                  onChangeText={(t) => setDraftFilters((f) => ({ ...f, maxDistanceKm: t.replace(/[^0-9]/g, '') }))}
                />
              </View>
              <Text style={styles.sheetHint}>Uses your device location to find gyms nearby.</Text>

              <Text style={styles.sheetSectionLabel}>Facilities</Text>
              <View style={styles.pillRow}>
                {FACILITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, draftFilters[opt.key] && styles.pillActive]}
                    onPress={() => toggleFacility(opt.key)}
                  >
                    <Text style={[styles.pillText, draftFilters[opt.key] && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.pill, draftFilters.openNow && styles.pillActive]}
                  onPress={() => setDraftFilters((f) => ({ ...f, openNow: !f.openNow }))}
                >
                  <Text style={[styles.pillText, draftFilters.openNow && styles.pillTextActive]}>
                    Open Now
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Show Results</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16,
  },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.line,
  },
  filterBtn: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line,
    position: 'relative',
  },
  filterBtnIcon: { fontSize: 18, color: COLORS.sageDark },
  filterBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.sageDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  quickChipRow: { flexGrow: 0, flexShrink: 0, height: 44, marginBottom: 12 },
  quickChipRowContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 36, paddingHorizontal: 14, borderRadius: 100,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line,
  },
  quickChipActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  quickChipText: { fontSize: 12.5, fontWeight: '700', color: COLORS.ink },
  quickChipTextActive: { color: '#fff' },
  quickChipCaret: { fontSize: 10, color: COLORS.inkSoft },
  activeFiltersRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 10,
  },
  activeFiltersText: { fontSize: 12.5, color: COLORS.inkSoft, fontWeight: '600' },
  clearFiltersText: { fontSize: 12.5, color: COLORS.sageDark, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.inkSoft, marginTop: 40, paddingHorizontal: 20 },
  gymCard: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16,
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
  gymTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  gymTag: {
    fontSize: 10.5, backgroundColor: COLORS.sageLight, color: COLORS.sageDark,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, fontWeight: '600',
  },
  gymRating: { fontSize: 11.5, color: COLORS.gold, fontWeight: '700' },
  gymPrice: { fontSize: 13.5, fontWeight: '700', color: COLORS.sageDark },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, maxHeight: '85%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  sheetReset: { fontSize: 13.5, color: COLORS.sageDark, fontWeight: '700' },
  sheetSectionLabel: {
    fontSize: 12.5, fontWeight: '700', color: COLORS.inkSoft, marginBottom: 8, marginTop: 16,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  sheetHint: { fontSize: 11.5, color: COLORS.inkSoft, marginTop: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.line,
  },
  pillActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  pillTextActive: { color: '#fff' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rangeInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.ink,
  },
  rangeDash: { color: COLORS.inkSoft },
  applyBtn: {
    backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});