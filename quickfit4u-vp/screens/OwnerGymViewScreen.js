import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  gold: '#C9A227',
  line: 'rgba(43,51,40,0.15)',
};

export default function OwnerGymViewScreen({ gym, onBack, onEdit }) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20, paddingTop: 54, paddingBottom: 60 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit}>
          <Text style={styles.editLink}>Edit</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{gym.name}</Text>
      <Text style={styles.loc}>📍 {gym.area}, {gym.city}</Text>
      {!!gym.phone && <Text style={styles.loc}>📞 {gym.phone}</Text>}
      <Text style={styles.rate}>₹{gym.hourlyRate}/hr</Text>

      {gym.latitude != null && gym.longitude != null && (
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${gym.latitude},${gym.longitude}`)}
        >
          <Text style={styles.directionsBtnText}>🧭 Get Directions</Text>
        </TouchableOpacity>
      )}

      {gym.photos && gym.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 16 }}>
          {gym.photos.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.photo} />
          ))}
        </ScrollView>
      )}

      {!!gym.description && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardBody}>{gym.description}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Amenities</Text>
        {gym.tags && gym.tags.length > 0 ? (
          <View style={styles.chipsWrap}>
            {gym.tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.cardBody}>No amenities added yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hours &amp; Crowd</Text>
        <Text style={styles.cardBody}>
          Opening hours: {gym.openingHours || 'Not added yet'}
        </Text>
        <Text style={[styles.cardBody, { marginTop: 4 }]}>
          Peak hours: {gym.peakHours || 'Not added yet'}
        </Text>
        {gym.crowdLevel && (
          <Text style={[styles.cardBody, { marginTop: 4 }]}>
            Right now: <Text style={styles.crowdValue}>{gym.crowdLevel}</Text>
          </Text>
        )}
      </View>

      {gym.latitude != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          <Text style={styles.cardBody}>{gym.latitude.toFixed(5)}, {gym.longitude.toFixed(5)}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Partnership Agreement</Text>
        {gym.agreementSignedAt ? (
          <>
            <Text style={styles.cardBody}>
              Signed by {gym.agreementSignedName} on {new Date(gym.agreementSignedAt).toLocaleDateString()}
            </Text>
            {!!gym.qrDataUrl && (
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <Image source={{ uri: gym.qrDataUrl }} style={styles.qrImage} />
                <Text style={styles.qrCaption}>
                  Your gym's permanent check-in QR — also sent to your registered email. Print it and place it at your
                  entrance so members can scan it themselves and check in without waiting for staff.
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.cardBody}>Not signed yet — your gym won't show up in member search.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  editLink: { fontSize: 14, color: COLORS.gold, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.ink },
  loc: { fontSize: 13.5, color: COLORS.inkSoft, marginTop: 4 },
  rate: { fontSize: 15, fontWeight: '700', color: COLORS.sageDark, marginTop: 6 },
  directionsBtn: {
    marginTop: 12, alignSelf: 'flex-start', backgroundColor: COLORS.sageLight,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100,
  },
  directionsBtnText: { fontSize: 12.5, fontWeight: '700', color: COLORS.sageDark },
  crowdValue: { fontWeight: '700', color: COLORS.sageDark },
  photo: { width: 130, height: 130, borderRadius: 12, marginRight: 10, backgroundColor: '#eee' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.line },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  cardBody: { fontSize: 13, color: COLORS.inkSoft, lineHeight: 19 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: COLORS.sageLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  chipText: { fontSize: 12, color: COLORS.ink, fontWeight: '600' },
  qrImage: { width: 160, height: 160, borderRadius: 10 },
  qrCaption: { fontSize: 11.5, color: COLORS.inkSoft, textAlign: 'center', marginTop: 10 },
});
