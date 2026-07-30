import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchGymDetail, createBookingOrder, verifyBookingPayment, cancelPendingPayment, leaveReview, watchSlot } from '../lib/api';
import RazorpayCheckoutModal from '../components/RazorpayCheckoutModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_WIDTH = SCREEN_WIDTH - 32; // matches gallery's 16px side padding
const GALLERY_INTERVAL_MS = 3500;

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sage: '#7A9166',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.12)',
  errorBg: '#F7E3E1',
  errorText: '#B4463B',
};

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function nextSevenDays() {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({ label: i === 0 ? 'Today' : labels[d.getDay()], date: d.getDate(), full: toDateStr(d) });
  }
  return days;
}

export default function GymDetailScreen({ gym: gymStub, user, onBack }) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [watchingSlotIds, setWatchingSlotIds] = useState([]);

  const [gym, setGym] = useState(gymStub);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [booking, setBooking] = useState(false); // true while creating the order (pre-checkout)
  const [bookError, setBookError] = useState('');
  const [preferenceNote, setPreferenceNote] = useState('');

  const [pendingOrder, setPendingOrder] = useState(null); // order details for the checkout WebView
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [verifying, setVerifying] = useState(false); // true while confirming payment after checkout closes

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  const [photoIndex, setPhotoIndex] = useState(0);
  const galleryRef = useRef(null);

  const [myRating, setMyRating] = useState(0);
  const [myReviewText, setMyReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const days = nextSevenDays();
  const photos = gym.photos && gym.photos.length > 0 ? gym.photos : [];

  // Auto-advance the photo carousel on a timer; resets whenever the photo set changes.
  useEffect(() => {
    setPhotoIndex(0);
    galleryRef.current?.scrollTo({ x: 0, animated: false });
    if (photos.length <= 1) return;

    const timer = setInterval(() => {
      setPhotoIndex((prev) => {
        const next = (prev + 1) % photos.length;
        galleryRef.current?.scrollTo({ x: next * GALLERY_WIDTH, animated: true });
        return next;
      });
    }, GALLERY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [gym.id, photos.length]);

  function handleGalleryScrollEnd(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / GALLERY_WIDTH);
    setPhotoIndex(idx);
  }

  async function handleSubmitReview() {
    setReviewError('');
    if (!myRating) {
      setReviewError('Tap a star to give a rating.');
      return;
    }
    setSubmittingReview(true);
    try {
      await leaveReview(gym.id, { rating: myRating, text: myReviewText.trim() });
      setMyRating(0);
      setMyReviewText('');
      // Refresh reviews + rating average for this gym/date.
      const data = await fetchGymDetail(gymStub.id, days[selectedDay].full);
      setGym(data.gym);
      setReviews(data.reviews);
      Alert.alert('Thanks!', 'Your review has been posted.');
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  useEffect(() => {
    if (!gymStub?.id) return;
    setLoading(true);
    setLoadError('');
    setSelectedSlot(null);
    fetchGymDetail(gymStub.id, days[selectedDay].full)
      .then((data) => {
        setGym(data.gym);
        setSlots(data.slots);
        setReviews(data.reviews);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [selectedDay, gymStub?.id]);

  if (!gymStub) return null;

  async function handleNotifyMe(slot) {
    if (watchingSlotIds.includes(slot.id)) return; // already watching, avoid duplicate calls
    try {
      await watchSlot(slot.id);
      setWatchingSlotIds((prev) => [...prev, slot.id]);
      Alert.alert('Got it', "We'll notify you if a spot opens up for this time.");
    } catch (e) {
      Alert.alert("Couldn't set that up", e.message);
    }
  }

  // Step 1: reserve the slot + create the Razorpay order, then open checkout.
  async function handleBook() {
    if (!selectedSlot) return;
    setBookError('');
    setBooking(true);
    try {
      const order = await createBookingOrder(selectedSlot.id, preferenceNote.trim());
      setPendingOrder(order);
      setCheckoutVisible(true);
    } catch (e) {
      setBookError(e.message);
    } finally {
      setBooking(false);
    }
  }

  // Step 2: Razorpay checkout succeeded — verify the payment, which is what
  // actually confirms the booking and hands back the QR.
  async function handlePaymentSuccess(msg) {
    setCheckoutVisible(false);
    setVerifying(true);
    try {
      const result = await verifyBookingPayment({
        bookingId: pendingOrder.bookingId,
        razorpay_order_id: msg.razorpay_order_id,
        razorpay_payment_id: msg.razorpay_payment_id,
        razorpay_signature: msg.razorpay_signature,
      });
      setBookingResult(result);
      setConfirmVisible(true);
      setSelectedSlot(null);
      setPreferenceNote('');
      const data = await fetchGymDetail(gymStub.id, days[selectedDay].full);
      setSlots(data.slots);
    } catch (e) {
      setBookError(e.message);
    } finally {
      setVerifying(false);
      setPendingOrder(null);
    }
  }

  // User closed the checkout without paying — release the held slot.
  async function handlePaymentDismiss() {
    setCheckoutVisible(false);
    if (pendingOrder?.bookingId) {
      try {
        await cancelPendingPayment(pendingOrder.bookingId);
      } catch {
        // best-effort — the stale-hold cleanup on the server will catch it either way
      }
      const data = await fetchGymDetail(gymStub.id, days[selectedDay].full);
      setSlots(data.slots);
    }
    setPendingOrder(null);
  }

  async function handlePaymentFailed(error) {
    setCheckoutVisible(false);
    setBookError(error || 'Payment failed. Please try again.');
    if (pendingOrder?.bookingId) {
      try {
        await cancelPendingPayment(pendingOrder.bookingId);
      } catch {}
      const data = await fetchGymDetail(gymStub.id, days[selectedDay].full);
      setSlots(data.slots);
    }
    setPendingOrder(null);
  }

  const mapUrl =
    gym.latitude && gym.longitude
      ? `https://www.google.com/maps?q=${gym.latitude},${gym.longitude}&output=embed`
      : null;
  const mapHtml = mapUrl
    ? `<!DOCTYPE html><html style="height:100%;"><head>
         <style>html,body{height:100%;margin:0;padding:0;}</style>
       </head><body>
         <iframe width="100%" height="100%" style="border:0;display:block;" src="${mapUrl}" allowfullscreen></iframe>
       </body></html>`
    : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={styles.gallery}>
          {photos.length > 0 ? (
            <>
              <ScrollView
                ref={galleryRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleGalleryScrollEnd}
                style={{ borderRadius: 16, overflow: 'hidden' }}
              >
                {photos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={[styles.photoMain, { width: GALLERY_WIDTH, marginBottom: 0 }]} />
                ))}
              </ScrollView>
              {photos.length > 1 && (
                <View style={styles.dotsRow}>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
              {photos.length > 1 && (
                <View style={styles.photoCounter}>
                  <Text style={styles.photoCounterText}>{photoIndex + 1}/{photos.length}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.photoMain} />
          )}
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.rowBetween}>
            <Text style={styles.gymName}>{gym.name}</Text>
            <Text style={styles.price}>₹{gym.hourlyRate}<Text style={styles.priceUnit}>/hr</Text></Text>
          </View>
          <Text style={styles.loc}>📍 {gym.area}{gym.city ? `, ${gym.city}` : ''}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>★ {gym.rating ?? '—'}</Text>
            <Text style={styles.reviewCount}>({gym.reviewCount || 0} reviews)</Text>
            {!!gym.crowdLevel && (
              <Text style={[styles.crowdBadge, gym.crowdLevel === 'High' && styles.crowdBadgeHigh]}>
                {gym.crowdLevel === 'High' ? '🔴' : gym.crowdLevel === 'Moderate' ? '🟡' : '🟢'} {gym.crowdLevel} right now
              </Text>
            )}
          </View>

          {(!!gym.openingHours || !!gym.peakHours) && (
            <View style={styles.hoursRow}>
              {!!gym.openingHours && <Text style={styles.hoursText}>🕐 Open {gym.openingHours}</Text>}
              {!!gym.peakHours && <Text style={styles.hoursText}>👥 Peak: {gym.peakHours}</Text>}
            </View>
          )}

          <View style={styles.tagRow}>
            {(gym.tags || []).map((t) => (
              <Text key={t} style={styles.tag}>{t}</Text>
            ))}
          </View>

          {!!gym.description && (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.desc}>{gym.description}</Text>
            </>
          )}

          <Text style={styles.sectionTitle}>Location</Text>
          {mapUrl ? (
            <View style={styles.mapBox}>
              <WebView source={{ html: mapHtml }} style={{ flex: 1 }} />
            </View>
          ) : (
            <View style={[styles.mapBox, styles.mapPlaceholder]}>
              <Text style={styles.emptyInline}>This gym hasn't shared its exact location yet.</Text>
            </View>
          )}
          {gym.latitude != null && gym.longitude != null && (
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${gym.latitude},${gym.longitude}`)}
            >
              <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Pick a slot</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayPill, selectedDay === i && styles.dayPillActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{d.label}</Text>
                <Text style={[styles.dayNum, selectedDay === i && styles.dayLabelActive]}>{d.date}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading && <ActivityIndicator color={COLORS.sageDark} style={{ marginBottom: 20 }} />}
          {!loading && loadError !== '' && <Text style={styles.errorInline}>{loadError}</Text>}

          {!loading && loadError === '' && slots.length === 0 && (
            <Text style={styles.emptyInline}>This gym hasn't opened any slots for this date yet.</Text>
          )}

          {!loading && loadError === '' && slots.length > 0 && (
            <View style={styles.hourGrid}>
              {slots.map((s) => {
                const full = s.spotsLeft <= 0;
                const active = selectedSlot?.id === s.id;
                const watching = watchingSlotIds.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.hourChip, active && styles.hourChipActive, full && styles.hourChipFull]}
                    onPress={() => (full ? handleNotifyMe(s) : setSelectedSlot(s))}
                  >
                    <Text style={[styles.hourText, active && styles.hourTextActive, full && styles.hourTextFull]}>
                      {s.hour}
                      {full ? (watching ? ' · Notify ✓' : ' · Full — Notify me') : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!!selectedSlot && (
            <View style={styles.noteBox}>
              <Text style={styles.reviewFormLabel}>Preferred time or note for the gym (optional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder={`e.g. "Can I come 15 min later, around ${selectedSlot.hour}:30?"`}
                placeholderTextColor={COLORS.inkSoft}
                value={preferenceNote}
                onChangeText={setPreferenceNote}
                multiline
              />
              <Text style={styles.noteHint}>
                Your request goes to the gym owner to confirm — you'll get a notification once they respond.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Reviews</Text>

          {user?.role === 'member' ? (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewFormLabel}>Rate your visit</Text>
              <View style={styles.starPicker}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setMyRating(n)}>
                    <Text style={[styles.starPick, n <= myRating && styles.starPickActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share how your session went (optional)"
                placeholderTextColor={COLORS.inkSoft}
                value={myReviewText}
                onChangeText={setMyReviewText}
                multiline
              />
              {!!reviewError && <Text style={styles.errorInline}>{reviewError}</Text>}
              <TouchableOpacity
                style={[styles.reviewSubmitBtn, submittingReview && styles.bookBtnDisabled]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.reviewSubmitText}>Post Review</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyInline}>Log in as a member to leave a review.</Text>
          )}

          {reviews.length === 0 && <Text style={styles.emptyInline}>No reviews yet.</Text>}
          {reviews.map((r, i) => (
            <View key={i} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewName}>{r.reviewerName}</Text>
                <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
              </View>
              {!!r.text && <Text style={styles.reviewText}>{r.text}</Text>}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky book bar */}
      <View style={styles.stickyBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyLabel} numberOfLines={1}>
            {selectedSlot ? `${days[selectedDay].label}, ${selectedSlot.hour}` : 'Select a time slot'}
          </Text>
          <Text style={styles.stickyPrice}>₹{gym.hourlyRate} for 1 hour</Text>
          {!!bookError && <Text style={styles.errorInline}>{bookError}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, (!selectedSlot || booking || verifying) && styles.bookBtnDisabled]}
          disabled={!selectedSlot || booking || verifying}
          onPress={handleBook}
        >
          {booking || verifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>Pay & Book</Text>
          )}
        </TouchableOpacity>
      </View>

      <RazorpayCheckoutModal
        visible={checkoutVisible}
        order={pendingOrder}
        userName={user?.name}
        userEmail={user?.email}
        userPhone={user?.phone}
        onSuccess={handlePaymentSuccess}
        onDismiss={handlePaymentDismiss}
        onFailed={handlePaymentFailed}
      />

      {/* Confirmation modal */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><Text style={{ fontSize: 22 }}>✅</Text></View>
            <Text style={styles.modalTitle}>Booking confirmed!</Text>
            <Text style={styles.modalSub}>
              Payment received for {bookingResult?.gymName} — {bookingResult?.date} at {bookingResult?.hour}. Your booking QR has also been emailed to you.
            </Text>
            {!!bookingResult?.qrDataUrl && (
              <Image source={{ uri: bookingResult.qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
            )}
            <Text style={styles.bookingCode}>{bookingResult?.bookingCode}</Text>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { setConfirmVisible(false); onBack(); }}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  gallery: { padding: 16, position: 'relative' },
  photoMain: { width: '100%', height: 200, borderRadius: 16, backgroundColor: COLORS.sageLight, marginBottom: 8 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoSmall: { flex: 1, height: 80, borderRadius: 12, backgroundColor: COLORS.sageLight },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    position: 'absolute', bottom: 10, left: 0, right: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: '#fff', width: 16 },
  photoCounter: {
    position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100,
  },
  photoCounterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  backBtn: {
    position: 'absolute', top: 30, left: 30, width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 20, color: COLORS.ink, marginTop: -2 },
  body: { paddingHorizontal: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  gymName: { fontSize: 21, fontWeight: '700', color: COLORS.ink, flex: 1, marginRight: 10 },
  price: { fontSize: 20, fontWeight: '700', color: COLORS.sageDark },
  priceUnit: { fontSize: 12, fontWeight: '500', color: COLORS.inkSoft },
  loc: { fontSize: 13.5, color: COLORS.inkSoft, marginTop: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 8, flexWrap: 'wrap', gap: 8 },
  rating: { fontSize: 14, fontWeight: '700', color: COLORS.gold, marginRight: 6 },
  reviewCount: { fontSize: 12.5, color: COLORS.inkSoft },
  crowdBadge: {
    fontSize: 11.5, fontWeight: '700', color: COLORS.sageDark, backgroundColor: COLORS.sageLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  crowdBadgeHigh: { color: '#B4463B', backgroundColor: '#F7E3E1' },
  hoursRow: { marginBottom: 10, gap: 4 },
  hoursText: { fontSize: 12.5, color: COLORS.inkSoft },
  directionsBtn: {
    alignSelf: 'flex-start', backgroundColor: COLORS.sageLight, marginTop: 10, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100,
  },
  directionsBtnText: { fontSize: 12.5, fontWeight: '700', color: COLORS.sageDark },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: {
    fontSize: 11.5, backgroundColor: COLORS.sageLight, color: COLORS.sageDark,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, fontWeight: '600',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 10, marginTop: 6 },
  desc: { fontSize: 14, color: COLORS.inkSoft, lineHeight: 21, marginBottom: 22 },
  mapBox: { height: 190, borderRadius: 16, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: COLORS.line },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  dayPill: {
    width: 58, paddingVertical: 10, borderRadius: 16, backgroundColor: '#fff',
    alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.line,
  },
  dayPillActive: { backgroundColor: COLORS.sageDark, borderColor: COLORS.sageDark },
  dayLabel: { fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 3 },
  dayNum: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  dayLabelActive: { color: '#fff' },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  hourChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.line,
  },
  hourChipActive: { backgroundColor: COLORS.sage, borderColor: COLORS.sage },
  hourChipFull: { backgroundColor: '#EFEEE6', borderColor: COLORS.line },
  hourText: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  hourTextActive: { color: '#fff' },
  hourTextFull: { color: COLORS.inkSoft },
  emptyInline: { fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 20 },
  errorInline: { fontSize: 12.5, color: COLORS.errorText, marginTop: 4 },
  noteBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.line,
  },
  noteHint: { fontSize: 11.5, color: COLORS.inkSoft, lineHeight: 16, marginTop: -4 },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.line,
  },
  reviewForm: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.line,
  },
  reviewFormLabel: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
  starPicker: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  starPick: { fontSize: 30, color: COLORS.line },
  starPickActive: { color: COLORS.gold },
  reviewInput: {
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12,
    fontSize: 13.5, color: COLORS.ink, minHeight: 70, textAlignVertical: 'top', marginBottom: 12,
  },
  reviewSubmitBtn: {
    backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 12, alignItems: 'center',
  },
  reviewSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewName: { fontSize: 13.5, fontWeight: '700', color: COLORS.ink },
  reviewStars: { fontSize: 12, color: COLORS.gold },
  reviewText: { fontSize: 13, color: COLORS.inkSoft, lineHeight: 19 },

  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: COLORS.line,
  },
  stickyLabel: { fontSize: 13, color: COLORS.inkSoft },
  stickyPrice: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginTop: 2 },
  bookBtn: { backgroundColor: COLORS.sageDark, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 100, marginLeft: 12 },
  bookBtnDisabled: { backgroundColor: '#C7CDBF' },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 340, backgroundColor: COLORS.cream, borderRadius: 24, padding: 28, alignItems: 'center' },
  modalIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.sageLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  modalSub: { fontSize: 13, color: COLORS.inkSoft, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  qrBox: { width: 110, height: 110, borderRadius: 12, backgroundColor: COLORS.ink, marginBottom: 14 },
  qrImage: { width: 150, height: 150, borderRadius: 12, marginBottom: 14, backgroundColor: '#fff' },
  bookingCode: { fontSize: 18, fontWeight: '700', color: COLORS.sageDark, letterSpacing: 1.5, marginBottom: 22 },
  modalDoneBtn: { width: '100%', backgroundColor: COLORS.sageDark, borderRadius: 100, paddingVertical: 15, alignItems: 'center' },
  modalDoneText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});