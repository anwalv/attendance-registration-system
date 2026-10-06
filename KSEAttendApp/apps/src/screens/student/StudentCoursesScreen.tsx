import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, Dimensions
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth, API_BASE } from '../context/AuthContext';

interface Props {
  navigation: DrawerNavigationProp<any>;
}

const COURSE_COLORS = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
  { color: '#0E2A45', accent: '#4B9EFF' },
];

export default function CoursesScreen({ navigation }: Props) {
  const { user, authHeader, activeRole } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const statsRes = await fetch(`${API_BASE}/statistics?role=student`, { headers: { ...authHeader() } });

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const studentCourses = Array.isArray(statsData) ? statsData : [];
          setCourses(studentCourses);
        }
      } catch (e) {
        console.error("Помилка завантаження курсів:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const goToDetails = (courseId: string, courseName: string) => {
    navigation.navigate('CourseDetails', { 
      courseId: courseId, 
      courseTitle: courseName,
      viewerRole: activeRole
    });
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'А';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12111A' }}>
        <ActivityIndicator size="large" color="#5B4CFA" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerBtn}>
          <View style={styles.burgerLine} /><View style={styles.burgerLine} /><View style={styles.burgerLine} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Курси</Text>
          <Text style={styles.headerSubtitle}>{courses.length} активних курсів</Text>
        </View>

        <TouchableOpacity style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{userInitial}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {courses.length > 0 ? (
          courses.map((course, index) => {
            const theme = COURSE_COLORS[index % COURSE_COLORS.length];
            const initials = course.course_name.substring(0, 3).toUpperCase();
            const pct = Math.round(course.attendance_pct || 0);

            return (
              <TouchableOpacity 
                key={course.course_id} 
                style={styles.card} 
                activeOpacity={0.85}
                onPress={() => goToDetails(String(course.course_id), course.course_name)}
              >
                <View style={[styles.cardTop, { backgroundColor: theme.color }]}>
                  <View style={styles.cardTopLeft}>
                    <View style={[styles.cardInitial, { borderColor: theme.accent }]}>
                      <Text style={[styles.cardInitialText, { color: theme.accent }]}>{initials}</Text>
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{course.course_name}</Text>
                      <Text style={styles.cardSubtitle}>{course.term || 'Поточний семестр'}</Text> 
                    </View>
                  </View>
                  <View style={[styles.pctBadge, { borderColor: theme.accent }]}>
                    <Text style={[styles.pctBadgeText, { color: theme.accent }]}>{pct}%</Text>
                  </View>
                </View>

                {course.warning && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>⚠️ {course.warning}</Text>
                  </View>
                )}

                <View style={styles.cardMiddle}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{course.total_events || 0}</Text>
                    <Text style={styles.statLabel}>всього пар</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{course.attended_events || 0}</Text>
                    <Text style={styles.statLabel}>відвідано</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <Text style={styles.statValue}>{course.current_streak || 0}</Text>
                    <Text style={styles.statLabel}>серія</Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.openLink}>Відкрити →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Ви ще не записані на жоден курс.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = { bg: '#12111A', surface: '#181722', textPrimary: '#F0EEF8', textSecondary: '#9896B0', divider: 'rgba(255,255,255,0.05)' };

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  burgerBtn: { width: 40, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#5B4CFA', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  listContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardInitial: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  cardInitialText: { fontSize: 12, fontWeight: '800' },
  cardTitleWrap: { flex: 1, paddingRight: 10 },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  pctBadgeText: { fontSize: 12, fontWeight: '800' },

  warningBanner: { backgroundColor: 'rgba(244,72,94,0.15)', paddingHorizontal: 16, paddingVertical: 8 },
  warningText: { color: '#F4485E', fontSize: 11, fontWeight: '600' },
  cardMiddle: { flexDirection: 'row', backgroundColor: '#12111A', paddingVertical: 16, paddingHorizontal: 10 },
  statBlock: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 10, textTransform: 'lowercase' },
  statDivider: { width: 1, height: '80%', backgroundColor: colors.divider },
  cardBottom: { paddingHorizontal: 16, paddingVertical: 12 },
  openLink: { color: '#7B88FF', fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyStateText: { color: colors.textSecondary, fontSize: 14 },
});