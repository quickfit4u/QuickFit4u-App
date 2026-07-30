// Registers this device for push notifications: asks permission, gets an
// Expo push token, and saves it on the backend so notify() can reach this
// user even when the app isn't open (slot reminders, owner accept/reject,
// etc). Call registerForPushNotifications() once after login.
//
// IMPORTANT — one-time setup this repo can't do for you:
//   1. `npx expo install expo-notifications expo-device` (added to
//      package.json already, but still needs an actual `npm install`/
//      `expo install` run).
//   2. This project needs an EAS project ID for getExpoPushTokenAsync() to
//      work (Expo SDK 49+ requires it, even in Expo Go). Run `eas init`
//      (or `eas project:init`) once, which writes `extra.eas.projectId`
//      into app.json — this file reads it from there.
//   3. Physical device required — push tokens don't work in the simulator.
//
// Until that setup is done, registerForPushNotifications() fails silently
// (catches its own errors) so the rest of the app keeps working normally —
// people just fall back to in-app-only notifications, same as before.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from './api';

// Show a banner + play a sound for notifications that arrive while the app
// is in the foreground (by default Expo suppresses these on some platforms).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      // Simulators/emulators can't get a real push token — nothing to do.
      return null;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return null; // person declined — in-app notifications still work fine
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        'No EAS projectId found — run `eas init` to enable push notifications. Falling back to in-app-only notifications for now.'
      );
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data;
    if (!token) return null;

    await registerPushToken(token);
    return token;
  } catch (e) {
    // Any failure here (permission denied, no project id, network, etc.)
    // should never block login or crash the app — just skip push for now.
    console.warn('Push registration skipped:', e.message);
    return null;
  }
}

// Called on logout so the next person to use this device doesn't receive
// the previous person's notifications.
export async function clearPushToken() {
  try {
    await registerPushToken(null);
  } catch (e) {
    // Non-fatal — worst case the token gets overwritten on next login anyway.
  }
}
