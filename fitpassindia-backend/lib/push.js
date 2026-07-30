

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PER_REQUEST = 100; // Expo's documented batch limit

function isExpoPushToken(token) {
  return typeof token === 'string' && /^Expo(?:nent)?PushToken\[.+\]$/.test(token);
}

// tokens: string[] — already-deduped, already-filtered to valid Expo tokens.
// Fire-and-forget from the caller's point of view: failures are logged, not
// thrown, so a push outage never breaks the in-app notification it rides
// alongside.
async function sendExpoPush(tokens, { title, body, data } = {}) {
  const validTokens = [...new Set(tokens)].filter(isExpoPushToken);
  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
  }));

  for (let i = 0; i < messages.length; i += MAX_PER_REQUEST) {
    const chunk = messages.slice(i, i + MAX_PER_REQUEST);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('Expo push send failed:', res.status, data);
      }
    } catch (e) {
      console.error('Expo push send error:', e.message);
    }
  }
}

module.exports = { sendExpoPush, isExpoPushToken };
