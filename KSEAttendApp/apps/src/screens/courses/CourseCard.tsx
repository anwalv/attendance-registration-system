import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export interface Course {
  id: string;
  title: string;
  titleShort: string;
  group: string;
  semester: string;
  color: string;
  accent: string;
  totalLectures: number;
  totalPractices: number;
  students: number;
  avgAttendance: number;
  teacherName?: string;
}

interface CourseCardProps {
  course: Course;
  viewerRole: 'teacher' | 'admin';
  onDelete: (course: Course) => void;
}

export default function CourseCard({ course, viewerRole, onDelete }: CourseCardProps) {
  const navigation = useNavigation<any>();
  const displayAttendance = course.avgAttendance || 0;
  const statusColor = displayAttendance >= 80 ? '#23C97D' : displayAttendance >= 65 ? '#F4A72B' : '#F4485E';

  return (
    <TouchableOpacity
      style={cs.card}
      onPress={() => navigation.navigate('CourseDetail', { 
        courseId: course.id, 
        viewerRole,
        courseTitle: course.title,
        avgAttendance: displayAttendance
      })}
      activeOpacity={0.85}
    >
      <View style={[cs.cardBand, { backgroundColor: course.color }]}>
        <View style={[cs.cardInitial, { borderColor: course.accent }]}>
          <Text style={[cs.cardInitialText, { color: course.accent }]}>{course.titleShort}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cs.cardTitle} numberOfLines={2}>{course.title}</Text>
          <Text style={cs.cardGroup}>{course.group} · {course.semester}</Text>
          {viewerRole === 'admin' && course.teacherName && (
            <Text style={cs.cardTeacher}>👨‍🏫 {course.teacherName}</Text>
          )}
        </View>
        <View style={[cs.cardPctBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
          <Text style={[cs.cardPct, { color: statusColor }]}>{displayAttendance}%</Text>
        </View>
      </View>

      <View style={cs.cardStats}>
        <View style={cs.cardStatItem}>
          <Text style={cs.cardStatValue}>{course.students || 0}</Text>
          <Text style={cs.cardStatLabel}>студентів</Text>
        </View>
        <View style={cs.cardStatDivider} />

        <View style={cs.cardStatItem}>
          <Text style={cs.cardStatValue}>{course.totalLectures || 0}</Text>
          <Text style={cs.cardStatLabel}>лекцій</Text>
        </View>
        <View style={cs.cardStatDivider} />
        <View style={cs.cardStatItem}>
          <Text style={cs.cardStatValue}>{course.totalPractices || 0}</Text>
          <Text style={cs.cardStatLabel}>практик</Text>
        </View>
        <View style={cs.cardStatDivider} />
        <View style={cs.cardStatItem}>
          <View style={cs.cardBarTrack}>
            <View style={[cs.cardBarFill, { width: `${displayAttendance}%` as any, backgroundColor: statusColor }]} />
          </View>
          <Text style={[cs.cardStatLabel, { color: statusColor }]}>явка</Text>
        </View>
      </View>

      <View style={cs.cardFooter}>
        <Text style={cs.cardOpenText}>Відкрити →</Text>
        {viewerRole === 'admin' && (
          <TouchableOpacity style={cs.deleteActionBtn} onPress={(e) => { e.stopPropagation(); onDelete(course); }}>
            <Text style={cs.deleteActionBtnText}>🗑️ Видалити</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  card: { backgroundColor: '#1C1B27', borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  cardBand: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  cardInitial: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  cardInitialText: { fontSize: 12, fontWeight: '900' },
  cardTitle: { color: 'white', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardGroup: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3 },
  cardTeacher: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 },
  cardPctBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  cardPct: { fontSize: 13, fontWeight: '800' },
  cardStats: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  cardStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  cardStatValue: { color: '#F0EEF8', fontSize: 16, fontWeight: '700' },
  cardStatLabel: { color: '#9896B0', fontSize: 10 },
  cardStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  cardBarTrack: { width: 50, height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardOpenText: { color: '#7B88FF', fontSize: 12, fontWeight: '600' },
  deleteActionBtn: { backgroundColor: 'rgba(244,72,94,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteActionBtnText: { color: '#F4485E', fontSize: 11, fontWeight: '700' },
});