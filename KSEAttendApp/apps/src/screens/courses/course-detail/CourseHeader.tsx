import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface CourseHeaderProps {
  courseCode: string;
  courseTitle: string;
  avgAttendance: number;
  eventsCount: number;
  viewerRole: 'teacher' | 'admin' | 'student';
  onBack: () => void;
}

export default function CourseHeader({
  courseCode,
  courseTitle,
  avgAttendance,
  eventsCount,
  viewerRole,
  onBack
}: CourseHeaderProps) {
  return (
    <View>
      {/* Верхня навігація */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{courseCode}</Text>
        </View>
        {viewerRole === 'admin' && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>АДМІН</Text>
          </View>
        )}
      </View>
      <View style={[styles.hero, { backgroundColor: '#2A1FA8' }]}>
        <Text style={styles.heroTitle}>{courseTitle}</Text>
        
        {viewerRole !== 'student' && (
          <View style={styles.heroStats}>
            <Text style={[styles.heroStat, { color: '#7B88FF' }]}>{avgAttendance}%</Text>
            <Text style={styles.heroStatLabel}> середня явка · </Text>
            <Text style={[styles.heroStat, { color: '#7B88FF' }]}>{eventsCount}</Text>
            <Text style={styles.heroStatLabel}> занять в БД </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  backBtn: { paddingVertical: 4, paddingRight: 10 },
  backBtnText: { color: '#7B88FF', fontSize: 24, fontWeight: 'bold' },
  headerTitle: { color: '#F0EEF8', fontSize: 18, fontWeight: '800' },
  adminBadge: { backgroundColor: 'rgba(244,167,43,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(244,167,43,0.3)' },
  adminBadgeText: { color: '#F4A72B', fontSize: 10, fontWeight: '800' },
  hero: { padding: 18, gap: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  heroStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  heroStat: { fontSize: 13, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});