import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

const COLORS = {
  cream: '#F7E7CE',
  ink: '#0A1A26',
  sage: '#6B9E1E',
  sageDark: '#4C7A16',
  gold: '#6B9E1E',
};

export default function SplashScreen({ onFinish }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fade }]}>
        {/* Logo mark — the new QuickFit4u artwork (QR mark + lifter + wordmark) */}
        <Image
          source={require('../assets/logo-quickfit4u.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <View style={styles.divider} />

        <Text style={styles.taglineDark}>Your gym.</Text>
        <Text style={styles.taglineSage}>Wherever you are.</Text>

        <View style={styles.featureRow}>
          <Feature icon="pin" label={'Find gyms\nanywhere'} />
          <Feature icon="clock" label={'Book by\nthe hour'} />
          <Feature icon="qr" label={'Walk in\nand workout'} />
        </View>
      </Animated.View>

      {/* Bottom curved banner */}
      <View style={styles.goldEdge} />
      <View style={styles.banner}>
        <Text style={styles.bannerLine}>FLEXIBLE. SIMPLE. SMART.</Text>
        <Text style={styles.bannerLineBold}>ONE APP. EVERY GYM.</Text>
      </View>
    </View>
  );
}

function Feature({ icon, label }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIconCircle}>
        <FeatureIcon type={icon} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function FeatureIcon({ type }) {
  const stroke = COLORS.sageDark;
  if (type === 'pin') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z"
          stroke={stroke}
          strokeWidth="1.6"
          fill="none"
        />
        <Circle cx="12" cy="10" r="2.4" stroke={stroke} strokeWidth="1.6" fill="none" />
      </Svg>
    );
  }
  if (type === 'clock') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.6" fill="none" />
        <Path d="M12 7v5l3 3" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </Svg>
    );
  }
  // qr-ish icon
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x="4" y="4" width="6" height="6" rx="1" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Rect x="14" y="4" width="6" height="6" rx="1" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Rect x="4" y="14" width="6" height="6" rx="1" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Rect x="15" y="15" width="4" height="4" rx="1" fill={stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoImage: {
    width: 280,
    height: 197,
    marginBottom: 0,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.gold,
    marginVertical: 8,
  },
  taglineDark: {
    fontSize: 17,
    color: COLORS.ink,
    fontWeight: '600',
  },
  taglineSage: {
    fontSize: 17,
    color: COLORS.sageDark,
    fontWeight: '600',
    marginBottom: 34,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.4,
    borderColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureLabel: {
    fontSize: 11.5,
    color: COLORS.ink,
    textAlign: 'center',
    lineHeight: 15,
  },
  goldEdge: {
    position: 'absolute',
    bottom: 128,
    width: width * 1.5,
    height: 4,
    backgroundColor: COLORS.gold,
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    left: -width * 0.25,
  },
  banner: {
    position: 'absolute',
    bottom: 0,
    width: width * 1.5,
    left: -width * 0.25,
    backgroundColor: COLORS.sageDark,
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    paddingTop: 46,
    paddingBottom: 34,
    alignItems: 'center',
  },
  bannerLine: {
    color: COLORS.cream,
    fontSize: 12.5,
    letterSpacing: 1.2,
    marginBottom: 6,
    opacity: 0.9,
  },
  bannerLineBold: {
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});