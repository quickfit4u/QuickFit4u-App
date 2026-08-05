import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = {
  cream: '#F5F1E6',
  ink: '#2B3328',
  inkSoft: '#6B7566',
  sageDark: '#5E7A4E',
  sageLight: '#E7EEDF',
  line: 'rgba(43,51,40,0.12)',
};


export default function StaticInfoScreen({ title, sections, onBack, footerNote }) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        {sections.map((s, i) => (
          <View key={i} style={styles.block}>
            {!!s.heading && <Text style={styles.heading}>{s.heading}</Text>}
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        {!!footerNote && <Text style={styles.footerNote}>{footerNote}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16 },
  back: { fontSize: 15, color: COLORS.sageDark, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  block: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.line },
  heading: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  body: { fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 20 },
  footerNote: { fontSize: 12, color: COLORS.inkSoft, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});
