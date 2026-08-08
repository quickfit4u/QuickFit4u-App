import React, { useState, useRef, useEffect } from 'react';
import { View, ActivityIndicator, Alert, BackHandler } from 'react-native';
import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import GymListScreen from './screens/GymListScreen';
import GymDetailScreen from './screens/GymDetailScreen';
import OwnerHomeScreen from './screens/OwnerHomeScreen';
import OwnerGymProfileScreen from './screens/OwnerGymProfileScreen';
import OwnerAmenitiesScreen from './screens/OwnerAmenitiesScreen';
import OwnerBankDetailsScreen from './screens/OwnerBankDetailsScreen';
import OwnerGymViewScreen from './screens/OwnerGymViewScreen';
import OwnerSlotsScreen from './screens/OwnerSlotsScreen';
import OwnerCustomersScreen from './screens/OwnerCustomersScreen';
import OwnerAgreementScreen from './screens/OwnerAgreementScreen';
import MyBookingsScreen from './screens/MyBookingsScreen';
import BookingDetailScreen from './screens/BookingDetailScreen';
import QrScannerScreen from './screens/QrScannerScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import OwnerRequestsScreen from './screens/OwnerRequestsScreen';
import ProfileScreen from './screens/ProfileScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import StaticInfoScreen from './screens/StaticInfoScreen';
import AdminHomeScreen from './screens/AdminHomeScreen';
import AdminGymsScreen from './screens/AdminGymsScreen';
import { getStoredUser, fetchMyGym, logout as apiLogout, checkInByGym, checkInByCode, checkInByOwner, checkInByOwnerCode } from './lib/api';
import { PRIVACY_SECTIONS, PRIVACY_FOOTER, TERMS_SECTIONS, TERMS_FOOTER } from './data/legalContent';

const HOW_IT_WORKS_SECTIONS = [
  { heading: '1. Find a gym', body: 'Search by city or browse gyms near your current location — filter by amenities, price, or ladies-only hours.' },
  { heading: '2. Pick a slot and book', body: 'Choose an open hour and confirm your booking — you\u2019ll get an instant booking code.' },
  { heading: '3. Walk in and check in', body: 'Show your booking code at the front desk. That\u2019s it — no separate membership needed.' },
  { heading: 'For gym owners', body: 'List your gym, open the hours you have spare capacity, and get walk-ins without adding a new membership tier.' },
];


const SETTINGS_SECTIONS = [
  { heading: 'Notifications', body: 'Booking reminders and gym updates. (Toggle coming in a future step.)' },
  { heading: 'App version', body: '1.0.0 (development build)' },
];

export default function App() {
  const [screen, setScreen] = useState('splash');

  const screenHistoryRef = useRef([]);
  const prevScreenRef = useRef('splash');

  useEffect(() => {
    if (prevScreenRef.current !== screen) {
      screenHistoryRef.current.push(prevScreenRef.current);
      prevScreenRef.current = screen;
    }
  }, [screen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenHistoryRef.current.length > 0) {
        const previous = screenHistoryRef.current.pop();
        prevScreenRef.current = previous;
        setScreen(previous);
        return true; // handled — don't let the OS exit the app
      }
      return false; // no history (e.g. already on the true home screen) — let the OS handle it (exits app), which is correct here
    });
    return () => sub.remove();
  }, []);
  const [user, setUser] = useState(null);
  const [selectedGym, setSelectedGym] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [myGym, setMyGym] = useState(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  
  const [memberScanReturnScreen, setMemberScanReturnScreen] = useState('home');

  const homeScreenFor = () => (user?.role === 'owner' ? 'ownerHome' : user?.role === 'admin' ? 'adminHome' : 'home');

  async function enterAppAs(loggedInUser) {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin') {
      setScreen('adminHome');
      return;
    }
    if (loggedInUser.role === 'owner') {
      let gym = null;
      try {
        gym = await fetchMyGym();
        setMyGym(gym);
      } catch (e) {
        setMyGym(null);
      }
     
      if (!gym) setScreen('ownerGymProfile');
      else if (!gym.tags || gym.tags.length === 0) setScreen('ownerAmenities');
      else if (!gym.agreementSignedAt) setScreen('ownerBankDetails');
      else setScreen('ownerHome');
    } else {
      setScreen('home');
    }
  }

  async function handleSplashFinish() {
    setCheckingSession(true);
    const stored = await getStoredUser();
    setCheckingSession(false);
    if (stored) {
      enterAppAs(stored);
    } else {
      setScreen('auth');
    }
  }

  async function handleLogout() {
    await apiLogout();
    setUser(null);
    setMyGym(null);
    setScreen('auth');
  }

  if (screen === 'splash') {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (checkingSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1E6' }}>
        <ActivityIndicator color="#5E7A4E" />
      </View>
    );
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        onSkip={() => setScreen('home')}
        onAuthSuccess={(u) => enterAppAs(u)}
        onForgotPassword={(email) => {
          setForgotEmail(email || '');
          setScreen('forgotPassword');
        }}
      />
    );
  }

  if (screen === 'forgotPassword') {
    return (
      <ForgotPasswordScreen
        initialEmail={forgotEmail}
        onBack={() => setScreen('auth')}
        onResetSuccess={(u) => enterAppAs(u)}
      />
    );
  }

  // ---------- Member screens ----------
  if (screen === 'home') {
    return (
      <HomeScreen
        user={user}
        onOpenGym={(gym, seeAll) => {
          if (seeAll) setScreen('gymList');
          else {
            setSelectedGym(gym);
            setScreen('gymDetail');
          }
        }}
        onNavigate={(s) => {
          if (s === 'memberScanQr') setMemberScanReturnScreen('home');
          setScreen(s);
        }}
        onLogout={user ? handleLogout : () => setScreen('auth')}
        onAccountDeleted={handleLogout}
      />
    );
  }

  if (screen === 'gymList') {
    return (
      <GymListScreen
        onBack={() => setScreen('home')}
        onOpenGym={(gym) => {
          setSelectedGym(gym);
          setScreen('gymDetail');
        }}
      />
    );
  }

  if (screen === 'gymDetail') {
    return <GymDetailScreen gym={selectedGym} user={user} onBack={() => setScreen('home')} />;
  }

  if (screen === 'myBookings') {
    return (
      <MyBookingsScreen
        onBack={() => setScreen(homeScreenFor())}
        onOpenGym={() => setScreen('gymList')}
        onOpenBooking={(b) => { setSelectedBooking(b); setScreen('bookingDetail'); }}
      />
    );
  }

  if (screen === 'bookingDetail') {
    return (
      <BookingDetailScreen
        booking={selectedBooking}
        onBack={() => setScreen('myBookings')}
        onScanToCheckIn={() => {
          setMemberScanReturnScreen('bookingDetail');
          setScreen('memberScanQr');
        }}
      />
    );
  }

  if (screen === 'memberScanQr') {
    return (
      <QrScannerScreen
        title="Scan the Gym's QR"
        instructions="Point your camera at the QR code posted at the gym's front desk or entrance."
        onBack={() => setScreen(memberScanReturnScreen)}
        manualLabel="Ask the front desk for the gym's name, or use your own booking code shown on your booking screen."
        onManualCode={async (code) => {
          try {
            const result = await checkInByCode(code);
            Alert.alert('Checked in! ✅', result.message);
          } catch (e) {
            Alert.alert('Could not check in', e.message);
          } finally {
            setScreen(memberScanReturnScreen === 'bookingDetail' ? 'myBookings' : memberScanReturnScreen);
          }
        }}
        onScanned={async (parsed) => {
          if (parsed.type !== 'gym') {
            Alert.alert('Wrong QR code', 'That looks like a booking QR, not a gym QR. Ask the front desk for the gym\u2019s check-in QR.');
            setScreen(memberScanReturnScreen);
            return;
          }
          try {
            const result = await checkInByGym(parsed.gymId);
            Alert.alert('Checked in! ✅', result.message);
          } catch (e) {
            Alert.alert('Could not check in', e.message);
          } finally {
            setScreen(memberScanReturnScreen === 'bookingDetail' ? 'myBookings' : memberScanReturnScreen);
          }
        }}
      />
    );
  }

  if (screen === 'ownerScanQr') {
    return (
      <QrScannerScreen
        title="Scan Member's QR"
        instructions="Point your camera at the member's booking QR shown on their phone."
        onBack={() => setScreen('ownerHome')}
        manualLabel="Ask the member for their booking code (shown on their booking confirmation, e.g. FI-123456)."
        onManualCode={async (code) => {
          try {
            const result = await checkInByOwnerCode(code);
            Alert.alert('Checked in! ✅', `${result.member.name} — ${result.member.hour}, ${result.member.date}`);
          } catch (e) {
            Alert.alert('Could not check in', e.message);
          } finally {
            setScreen('ownerHome');
          }
        }}
        onScanned={async (parsed) => {
          if (parsed.type !== 'booking') {
            Alert.alert('Wrong QR code', 'That looks like a gym QR, not a member\u2019s booking QR.');
            setScreen('ownerHome');
            return;
          }
          try {
            const result = await checkInByOwner(parsed);
            Alert.alert('Checked in! ✅', `${result.member.name} — ${result.member.hour}, ${result.member.date}`);
          } catch (e) {
            Alert.alert('Could not check in', e.message);
          } finally {
            setScreen('ownerHome');
          }
        }}
      />
    );
  }

  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        role={user?.role}
        onBack={() => setScreen(homeScreenFor())}
        onNavigate={(s) => setScreen(s)}
      />
    );
  }

  if (screen === 'ownerRequests') {
    return <OwnerRequestsScreen onBack={() => setScreen('ownerHome')} />;
  }

  if (screen === 'profile') {
    return (
      <ProfileScreen
        user={user}
        onBack={() => setScreen(homeScreenFor())}
        onLogout={handleLogout}
        onUserUpdated={(updatedUser) => setUser(updatedUser)}
      />
    );
  }

  if (screen === 'feedback') {
    return <FeedbackScreen user={user} onBack={() => setScreen(homeScreenFor())} />;
  }

  // ---------- Gym owner screens ----------
  if (screen === 'ownerHome') {
    return (
      <OwnerHomeScreen
        user={user}
        gym={myGym}
        onNavigate={(s) => setScreen(s)}
        onLogout={handleLogout}
        onAccountDeleted={handleLogout}
      />
    );
  }

  if (screen === 'ownerGymProfile') {
    return (
      <OwnerGymProfileScreen
        gym={myGym}
        mode={myGym?.agreementSignedAt ? 'edit' : 'create'}
        onBack={() => setScreen('ownerHome')}
        onSaved={(gym) => {
          setMyGym(gym);
          // First-time setup chains straight into amenities; editing later returns to the dashboard.
          setScreen(gym.agreementSignedAt ? 'ownerGymView' : 'ownerAmenities');
        }}
      />
    );
  }

  if (screen === 'ownerAmenities') {
    return (
      <OwnerAmenitiesScreen
        gym={myGym}
        onBack={() => setScreen('ownerGymProfile')}
        onSaved={(gym) => {
          setMyGym(gym);
          setScreen('ownerBankDetails');
        }}
      />
    );
  }

  if (screen === 'ownerBankDetails') {
    return (
      <OwnerBankDetailsScreen
        gym={myGym}
        onBack={() => setScreen(myGym?.agreementSignedAt ? 'ownerHome' : 'ownerAmenities')}
        onSaved={(gym) => {
          setMyGym(gym);
          // Onboarding chains into the agreement; editing later from the
          // dashboard menu just returns you there instead.
          setScreen(gym.agreementSignedAt ? 'ownerHome' : 'ownerAgreement');
        }}
      />
    );
  }

  if (screen === 'ownerGymView') {
    return (
      <OwnerGymViewScreen
        gym={myGym}
        onBack={() => setScreen('ownerHome')}
        onEdit={() => setScreen('ownerGymProfile')}
      />
    );
  }

  if (screen === 'ownerSlots') {
    return <OwnerSlotsScreen onBack={() => setScreen('ownerHome')} />;
  }

  if (screen === 'ownerCustomers') {
    return <OwnerCustomersScreen onBack={() => setScreen('ownerHome')} />;
  }

  if (screen === 'ownerAgreement') {
    return (
      <OwnerAgreementScreen
        gym={myGym}
        onBack={() => setScreen('ownerHome')}
        onSigned={(gym) => {
          setMyGym(gym);
          setScreen('ownerHome');
        }}
      />
    );
  }

  // ---------- Admin screens ----------
  if (screen === 'adminHome') {
    return <AdminHomeScreen user={user} onNavigate={(s) => setScreen(s)} onLogout={handleLogout} />;
  }

  if (screen === 'adminGyms') {
    return <AdminGymsScreen onBack={() => setScreen('adminHome')} />;
  }

  // ---------- Shared static screens ----------
  if (screen === 'howItWorks') {
    return (
      <StaticInfoScreen
        title="How it Works"
        sections={HOW_IT_WORKS_SECTIONS}
        onBack={() => setScreen(homeScreenFor())}
      />
    );
  }

  if (screen === 'privacyPolicy') {
    return (
      <StaticInfoScreen
        title="Privacy Policy"
        sections={PRIVACY_SECTIONS}
        footerNote={PRIVACY_FOOTER}
        onBack={() => setScreen(homeScreenFor())}
      />
    );
  }

  if (screen === 'termsConditions') {
    return (
      <StaticInfoScreen
        title="Terms & Conditions"
        sections={TERMS_SECTIONS}
        footerNote={TERMS_FOOTER}
        onBack={() => setScreen(homeScreenFor())}
      />
    );
  }

  if (screen === 'settings') {
    return (
      <StaticInfoScreen
        title="Settings"
        sections={SETTINGS_SECTIONS}
        onBack={() => setScreen(homeScreenFor())}
      />
    );
  }

  return null;
}