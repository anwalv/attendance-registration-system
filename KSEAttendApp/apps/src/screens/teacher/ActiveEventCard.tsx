import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export interface ActiveEvent {
  courseId: string;
  eventId: string;
  courseTitle: string;
  type: string;
  time: string;
  attended: number;
  total: number;
  isLive: boolean;
}

interface ActiveEventCardProps {
  event: ActiveEvent;
}

export default function ActiveEventCard({ event }: ActiveEventCardProps) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const pct = event.total > 0 ? event.attended / event.total : 0;

  return (
    <LinearGradient
      colors={['#1A0F5E', '#3B2FCC', '#5B4CFA']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.activeCard}
    >
      <View style={s.activeLiveBadge}>
        <View style={[s.liveDot, { backgroundColor: event.isLive ? '#23C97D' : '#F4A72B' }]} />
        <Text style={s.liveBadgeText}>
          {event.isLive ? 'Зараз триває пара!' : 'Наступна пара дисципліни'}
        </Text>
      </View>
      <Text style={s.activeTitle}>{event.courseTitle}</Text>
      <Text style={s.activeMeta}>
        {event.type} · {event.time}
      </Text>

      <View style={s.attendanceMeter}>
        <View style={s.attendanceMeterRow}>
          <Text style={s.attendanceLabel}>Присутні</Text>
          <Text style={s.attendanceCount}>
            {event.attended}/{event.total}
          </Text>
        </View>
        <View style={s.meterTrack}>
          <View style={[s.meterFill, { width: `${pct * 100}%` as any }]} />
        </View>
      </View>
      <View style={s.activeActions}>
        <TouchableOpacity 
          style={s.actionBtnPrimary} 
          activeOpacity={0.85}
          onPress={() => navigation.navigate('QRGenerator', {
            courseId: event.courseId,
            eventId: event.eventId, 
            courseTitle: event.courseTitle,
            eventType: event.type,
            totalStudents: event.total,
            attended: event.attended
          })}
        >
          <Text style={s.actionBtnPrimaryText}>📱 QR-код</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
            style={s.actionBtnSecondary}
            activeOpacity={0.85}
            onPress={() => {
              
                navigation.navigate('TeacherCourses', {
                screen: 'CourseDetail',
                params: {
                    courseId: Number(event.courseId),
                    viewerRole: 'teacher',
                    initialTab: 'attendance'
                }
                });
            }}
            >
            <Text style={s.actionBtnSecondaryText}>📋 Список студентів</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  activeCard: { borderRadius: 24, padding: 22, gap: 14, marginTop: 4, alignItems: 'center' },
  activeLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  activeTitle: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 0.1, textAlign: 'center' },
  activeMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  attendanceMeter: { gap: 8, width: '100%' },
  attendanceMeterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  attendanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  attendanceCount: { color: 'white', fontSize: 12, fontWeight: '700' },
  meterTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#23C97D', borderRadius: 4 },
  activeActions: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  actionBtnPrimary: { flex: 1, backgroundColor: 'white', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnPrimaryText: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
  actionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  actionBtnSecondaryText: { color: 'white', fontSize: 13, fontWeight: '700' },
});