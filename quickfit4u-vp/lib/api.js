import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.quickfit4u.com';

const TOKEN_KEY = 'quickfit4u_token';
const USER_KEY = 'quickfit4u_user';

async function request(path, { method = 'GET', body, auth = false } = {}) {

  console.log('🔵 API_BASE_URL is:', API_BASE_URL, '| calling:', path);

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    console.log('🔴 fetch() threw:', e.message);
    throw new Error(
      "Could not reach the server. Check that your backend is running and that API_BASE_URL in lib/api.js matches your laptop's IP."
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}


export async function requestSignupOtp({ name, email, role = 'member', referredBy }) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: { name, email, role, referredBy },
  });
}

export async function verifySignup({ email, code, password, confirmPassword }) {
  const data = await request('/api/auth/verify-signup', {
    method: 'POST',
    body: { email, code, password, confirmPassword },
  });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}


export async function login({ email, password }) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}


export async function requestPasswordReset({ email }) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}


export async function resetPassword({ email, code, password, confirmPassword }) {
  const data = await request('/api/auth/reset-password', {
    method: 'POST',
    body: { email, code, password, confirmPassword },
  });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getMe() {
  const data = await request('/api/auth/me', { auth: true });
  return data.user;
}

export async function updateProfile(fields) {
  const data = await request('/api/auth/me', { method: 'PUT', auth: true, body: fields });
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function deleteAccount() {
  const data = await request('/api/auth/me', { method: 'DELETE', auth: true });
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  return data;
}

// ---------- Member: browse + book ----------

export async function fetchGyms(options) {
  const opts = typeof options === 'string' ? { city: options } : (options || {});
  const params = new URLSearchParams();
  if (opts.city) params.set('city', opts.city);
  if (opts.search) params.set('search', opts.search);
  if (opts.minPrice !== undefined && opts.minPrice !== '') params.set('minPrice', opts.minPrice);
  if (opts.maxPrice !== undefined && opts.maxPrice !== '') params.set('maxPrice', opts.maxPrice);
  if (opts.minRating !== undefined && opts.minRating !== '') params.set('minRating', opts.minRating);
  if (opts.facilities && opts.facilities.length) params.set('facilities', opts.facilities.join(','));
  if (opts.ac) params.set('ac', 'true');
  if (opts.personalTrainer) params.set('personalTrainer', 'true');
  if (opts.parking) params.set('parking', 'true');
  if (opts.shower) params.set('shower', 'true');
  if (opts.femaleFriendly) params.set('femaleFriendly', 'true');
  if (opts.openNow) params.set('openNow', 'true');
  if (opts.lat !== undefined && opts.lat !== null) params.set('lat', opts.lat);
  if (opts.lng !== undefined && opts.lng !== null) params.set('lng', opts.lng);
  if (opts.maxDistanceKm !== undefined && opts.maxDistanceKm !== '') params.set('maxDistanceKm', opts.maxDistanceKm);
  if (opts.sortBy) params.set('sortBy', opts.sortBy);
  const query = params.toString() ? `?${params.toString()}` : '';
  const data = await request(`/api/gyms${query}`);
  return data.gyms; 
}

export async function fetchGymDetail(gymId, date) {
  const query = date ? `?date=${date}` : '';
  return request(`/api/gyms/${gymId}${query}`);
  
}

export async function leaveReview(gymId, { rating, text }) {
  return request(`/api/gyms/${gymId}/reviews`, {
    method: 'POST',
    auth: true,
    body: { rating, text },
  });
}


export async function createBookingOrder(slotId, note) {
  return request('/api/bookings/create-order', {
    method: 'POST',
    auth: true,
    body: { slotId, note: note || undefined },
  });
 
}


export async function verifyBookingPayment({ bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const data = await request('/api/bookings/verify-payment', {
    method: 'POST',
    auth: true,
    body: { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature },
  });
  return data.booking; 
}


export async function cancelPendingPayment(bookingId) {
  return request(`/api/bookings/${bookingId}/cancel-pending-payment`, { method: 'POST', auth: true });
}

export async function fetchMyBookings() {
  const data = await request('/api/bookings/me', { auth: true });
  return data.bookings; 
}



export async function fetchBookingRequests() {
  const data = await request('/api/bookings/requests', { auth: true });
  return data.requests; 
}

export async function acceptBooking(bookingId) {
  return request(`/api/bookings/${bookingId}/accept-reschedule`, { method: 'POST', auth: true });
}

export async function rejectBooking(bookingId) {
  return request(`/api/bookings/${bookingId}/reject-reschedule`, { method: 'POST', auth: true });
}


export async function requestReschedule(bookingId, newSlotId, note) {
  return request(`/api/bookings/${bookingId}/reschedule`, {
    method: 'PUT',
    auth: true,
    body: { newSlotId, note: note || undefined },
  });
}

export async function fetchNotifications() {
  return request('/api/notifications/me', { auth: true });
 
}

export async function markAllNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'POST', auth: true });
}

export async function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'POST', auth: true });
}

// ---------- Gym owner: profile ----------

export async function fetchMyGym() {
  const data = await request('/api/gyms/mine', { auth: true });
  return data.gym; // null if not created yet
}

export async function createMyGym(gym) {
  const data = await request('/api/gyms/mine', { method: 'POST', auth: true, body: gym });
  return data.gym;
}

export async function updateMyGym(gym) {
  const data = await request('/api/gyms/mine', { method: 'PUT', auth: true, body: gym });
  return data.gym;
}

export async function addMySlot({ date, hourLabel, capacity }) {
  return request('/api/gyms/mine/slots', {
    method: 'POST',
    auth: true,
    body: { date, hourLabel, capacity },
  });
}

export async function fetchMySlots(date) {
  const query = date ? `?date=${date}` : '';
  const data = await request(`/api/gyms/mine/slots${query}`, { auth: true });
  return data; 
}

export async function fetchTodayBookings(date) {
  const query = date ? `?date=${date}` : '';
  const data = await request(`/api/gyms/mine/bookings/today${query}`, { auth: true });
  return data; 
}

export async function fetchMyCustomers() {
  const data = await request('/api/gyms/mine/customers', { auth: true });
  return data.customers; 
}

export async function fetchMyDashboard() {
  return request('/api/gyms/mine/dashboard', { auth: true });
  
}

export async function fetchMyBankDetails() {
  const data = await request('/api/gyms/mine/bank-details', { auth: true });
  return data.bankDetails; 
}

export async function updateMyBankDetails({ accountHolder, accountNumber, ifsc, upiId }) {
  const data = await request('/api/gyms/mine/bank-details', {
    method: 'PUT',
    auth: true,
    body: { accountHolder, accountNumber, ifsc, upiId },
  });
  return data.gym;
}

export async function signAgreement({ signedName, signatureUrl, accepted }) {
  const data = await request('/api/gyms/mine/agreement', {
    method: 'POST',
    auth: true,
    body: { signedName, signatureUrl, accepted },
  });
  return data.gym; 
}

// ---------- Admin ----------

export async function fetchAdminStats() {
  return request('/api/admin/stats', { auth: true });
}

export async function fetchAdminGyms() {
  const data = await request('/api/admin/gyms', { auth: true });
  return data.gyms; 
}

export async function fetchAdminTodayBookings(date) {
  const query = date ? `?date=${date}` : '';
  return request(`/api/admin/bookings/today${query}`, { auth: true });
  
}

// ---------- Check-in (QR scanning, both directions) ----------

export async function checkInByGym(gymId) {
  return request('/api/bookings/checkin', {
    method: 'POST',
    auth: true,
    body: { gymId },
  });

}


export async function checkInByCode(bookingCode) {
  return request('/api/bookings/checkin-by-code', {
    method: 'POST',
    auth: true,
    body: { bookingCode },
  });

}


export async function checkInByOwner(scanned) {
  const { bookingId, gymId, expiresAt, token } = scanned || {};
  return request('/api/bookings/owner-checkin', {
    method: 'POST',
    auth: true,
    body: { bookingId, gymId, expiresAt, token },
  });

}


export async function checkInByOwnerCode(bookingCode) {
  return request('/api/bookings/owner-checkin-by-code', {
    method: 'POST',
    auth: true,
    body: { bookingCode },
  });

}