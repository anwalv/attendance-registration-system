import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Modal,
} from 'react-native';
import TeacherHeader from './TeacherHeader';
import { useAuth, API_BASE } from '../context/AuthContext';

interface CourseStat {
  course_id: number;
  course_name: string;
  term: string;
  total_events: number;
  total_students: number;
  average_attendance_pct: number;
  at_risk_students: number;
}

interface AtRiskStudent {
  id: number;
  name: string;
  email: string;
  attended_events: number;
  total_events: number;
  attendance_pct: number;
}

const COLOR_THEMES = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
  { color: '#0E2A45', accent: '#4B9EFF' },
];

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function AtRiskModal({
  visible, onClose, courseName, minPct, students, loading,
}: {
  visible: boolean;
  onClose: () => void;
  courseName: string;
  minPct: number | null;
  students: AtRiskStudent[];
  loading: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.title}>Під загрозою</Text>
              <Text style={m.subtitle}>{courseName}{minPct != null ? ` · поріг ${minPct}%` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={m.closeBtn}>
              <Text style={m.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#7B88FF" style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView contentContainerStyle={m.list} showsVerticalScrollIndicator={false}>
              {students.length > 0 ? (
                students.map((st) => (
                  <View key={st.id} style={m.studentRow}>
                    <View style={m.studentInitial}>
                      <Text style={m.studentInitialText}>{getInitials(st.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={m.studentName}>{st.name}</Text>
                      <Text style={m.studentEmail}>{st.email}</Text>
                    </View>
                    <View style={m.studentStat}>
                      <Text style={m.studentPct}>{Math.round(st.attendance_pct)}%</Text>
                      <Text style={m.studentMeta}>{st.attended_events}/{st.total_events}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={m.emptyText}>Немає студентів під загрозою 🎉</Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CourseStatCard({
  course, theme, onPressAtRisk,
}: {
  course: CourseStat;
  theme: { color: string; accent: string };
  onPressAtRisk: () => void;
}) {
  const pct = Math.round(course.average_attendance_pct);
  const statusColor = pct >= 80 ? '#23C97D' : pct >= 65 ? '#F4A72B' : '#F4485E';

  return (
    <View style={s.courseCard}>
      <View style={[s.courseBand, { backgroundColor: theme.color }]}>
        <View style={[s.courseInitial, { borderColor: theme.accent }]}>
          <Text style={[s.courseInitialText, { color: theme.accent }]}>{getInitials(course.course_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.courseTitle} numberOfLines={1}>{course.course_name}</Text>
          <Text style={s.courseGroup}>{course.term || 'Поточний семестр'} · {course.total_students} студентів</Text>
        </View>
        <Text style={[s.coursePct, { color: theme.accent }]}>{pct}%</Text>
      </View>

      <View style={s.courseBody}>
        <View style={s.courseStatsRow}>
          <View style={s.courseStat}>
            <Text style={s.courseStatValue}>{course.total_events}</Text>
            <Text style={s.courseStatLabel}>занять</Text>
          </View>
          <View style={s.courseStatDivider} />
          <View style={s.courseStat}>
            <Text style={[s.courseStatValue, { color: course.at_risk_students > 0 ? '#F4485E' : '#23C97D' }]}>
              {course.at_risk_students}
            </Text>
            <Text style={s.courseStatLabel}>під ризиком</Text>
          </View>
        </View>

        <View style={s.courseBarTrack}>
          <View style={[s.courseBarFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: statusColor }]} />
        </View>

        {course.at_risk_students > 0 && (
          <TouchableOpacity style={s.atRiskAlert} onPress={onPressAtRisk} activeOpacity={0.75}>
            <Text style={s.atRiskText}>
              ⚠️ {course.at_risk_students} студентів під загрозою недопуску до екзамену
            </Text>
            <Text style={s.atRiskLink}>Переглянути →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function TeacherStatisticsScreen() {
  const { authHeader } = useAuth();
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Модалка
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalCourseName, setModalCourseName] = useState('');
  const [modalMinPct, setModalMinPct] = useState<number | null>(null);
  const [modalStudents, setModalStudents] = useState<AtRiskStudent[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/statistics?role=teacher`, { headers: { ...authHeader() } });
        if (!res.ok) throw new Error('Не вдалося завантажити статистику');
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message ?? 'Невідома помилка');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const openAtRiskModal = async (course: CourseStat) => {
    setModalCourseName(course.course_name);
    setModalVisible(true);
    setModalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/courses/${course.course_id}/at-risk-students`, {
        headers: { ...authHeader() },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setModalMinPct(data.min_pct_required ?? null);
      setModalStudents(Array.isArray(data.students) ? data.students : []);
    } catch {
      setModalMinPct(null);
      setModalStudents([]);
    } finally {
      setModalLoading(false);
    }
  };

  const totalStudents = courses.reduce((sum, c) => sum + c.total_students, 0);
  const totalAtRisk = courses.reduce((sum, c) => sum + c.at_risk_students, 0);
  const avgOverall = courses.length > 0
    ? Math.round(courses.reduce((sum, c) => sum + c.average_attendance_pct, 0) / courses.length)
    : 0;

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7B88FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <TeacherHeader title="Статистика" subtitle="Поточний семестр" />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        <View style={s.summaryStrip}>
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: '#7B88FF' }]}>{courses.length}</Text>
            <Text style={s.summaryLabel}>Курсів</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: '#23C97D' }]}>{totalStudents}</Text>
            <Text style={s.summaryLabel}>Студентів</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: avgOverall >= 80 ? '#23C97D' : '#F4A72B' }]}>
              {avgOverall}%
            </Text>
            <Text style={s.summaryLabel}>Середня явка</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: totalAtRisk > 0 ? '#F4485E' : '#23C97D' }]}>
              {totalAtRisk}
            </Text>
            <Text style={s.summaryLabel}>Під ризиком</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>По курсах</Text>

        {courses.length > 0 ? (
          courses.map((c, i) => (
            <CourseStatCard
              key={c.course_id}
              course={c}
              theme={COLOR_THEMES[i % COLOR_THEMES.length]}
              onPressAtRisk={() => openAtRiskModal(c)}
            />
          ))
        ) : (
          <Text style={{ color: C.textSecondary, textAlign: 'center', marginTop: 20 }}>
            У вас ще немає курсів для відображення статистики.
          </Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <AtRiskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        courseName={modalCourseName}
        minPct={modalMinPct}
        students={modalStudents}
        loading={modalLoading}
      />
    </SafeAreaView>
  );
}

const C = { bg: '#12111A', surface: '#1C1B27', textPrimary: '#F0EEF8', textSecondary: '#9896B0', white: '#FFFFFF', divider: 'rgba(255,255,255,0.08)' };

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  body: { padding: 20, gap: 16, paddingBottom: 16 },

  errorBanner: { backgroundColor: 'rgba(244,72,94,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,72,94,0.3)', padding: 14 },
  errorText: { color: '#F4485E', fontSize: 12 },

  summaryStrip: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, paddingVertical: 14 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: C.textSecondary, fontSize: 10 },
  summaryDivider: { width: 1, backgroundColor: C.divider, marginVertical: 4 },

  sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },

  courseCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: C.surface },
  courseBand: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  courseInitial: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  courseInitialText: { fontSize: 11, fontWeight: '900' },
  courseTitle: { color: C.white, fontSize: 13, fontWeight: '700' },
  courseGroup: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  coursePct: { fontSize: 20, fontWeight: '800' },

  courseBody: { padding: 14, gap: 12 },

  courseStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseStat: { flex: 1, alignItems: 'center', gap: 2 },
  courseStatValue: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  courseStatLabel: { color: C.textSecondary, fontSize: 9 },
  courseStatDivider: { width: 1, height: 28, backgroundColor: C.divider },

  courseBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  courseBarFill: { height: '100%', borderRadius: 3 },

  atRiskAlert: { backgroundColor: 'rgba(244,72,94,0.12)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(244,72,94,0.25)', gap: 4 },
  atRiskText: { color: '#F4485E', fontSize: 11, fontWeight: '500' },
  atRiskLink: { color: '#F4485E', fontSize: 11, fontWeight: '700', textAlign: 'right' },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 12 },
  title: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: C.textSecondary, fontSize: 12, marginTop: 4 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12 },
  studentInitial: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(244,72,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  studentInitialText: { color: '#F4485E', fontSize: 12, fontWeight: '800' },
  studentName: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  studentEmail: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  studentStat: { alignItems: 'flex-end' },
  studentPct: { color: '#F4485E', fontSize: 14, fontWeight: '800' },
  studentMeta: { color: C.textSecondary, fontSize: 10, marginTop: 2 },
  emptyText: { color: C.textSecondary, textAlign: 'center', marginTop: 30 },
});