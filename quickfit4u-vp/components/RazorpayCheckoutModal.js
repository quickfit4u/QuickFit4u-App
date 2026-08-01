import React, { useMemo } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

// Loads Razorpay's own hosted checkout.js inside a WebView. This is the
// standard way to take payments from an Expo *managed* app without a custom
// dev client / native module (react-native-razorpay needs native linking,
// which Expo Go can't do). The web checkout posts a message back to RN with
// the payment result — we never see card/UPI details ourselves.
//
// Props:
//   visible        — show/hide the modal
//   order          — { orderId, amount (rupees), currency, keyId, gymName, bookingCode }
//   userName / userEmail / userPhone — prefill fields (optional but nicer UX)
//   onSuccess(msg) — { razorpay_payment_id, razorpay_order_id, razorpay_signature }
//   onDismiss()    — user closed the checkout without paying
//   onFailed(err)  — payment attempt failed
export default function RazorpayCheckoutModal({
  visible,
  order,
  userName,
  userEmail,
  userPhone,
  onSuccess,
  onDismiss,
  onFailed,
}) {
  const html = useMemo(() => {
    if (!order) return '';
    const options = {
      key: order.keyId,
      amount: String(Math.round(order.amount * 100)), // paise
      currency: order.currency || 'INR',
      name: 'QuickFit4u',
      description: `${order.gymName} — ${order.bookingCode}`,
      order_id: order.orderId,
      prefill: { name: userName || '', email: userEmail || '', contact: userPhone || '' },
      theme: { color: '#5E7A4E' },
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>html,body{margin:0;padding:0;height:100%;background:#F5F1E6;font-family:sans-serif;}</style>
</head>
<body>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    var options = ${JSON.stringify(options)};
    options.handler = function (response) {
      post({
        type: 'success',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    };
    options.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
    try {
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response) {
        post({ type: 'failed', error: (response.error && response.error.description) || 'Payment failed.' });
      });
      rzp.open();
    } catch (e) {
      post({ type: 'failed', error: 'Could not open the payment window.' });
    }
  </script>
</body>
</html>`;
  }, [order, userName, userEmail, userPhone]);

  function handleMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'success') onSuccess(msg);
    else if (msg.type === 'dismiss') onDismiss();
    else if (msg.type === 'failed') (onFailed ? onFailed(msg.error) : onDismiss());
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Complete Payment</Text>
          <View style={{ width: 38 }} />
        </View>
        {order ? (
          <WebView
            source={{ html }}
            onMessage={handleMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#5E7A4E" />
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#5E7A4E" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F1E6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: '#2B3328' },
  title: { fontSize: 16, fontWeight: '700', color: '#2B3328' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
