import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, StatusBar, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

import CourseHeader from '../courses/course-detail/CourseHeader';
import { LessonsTab } from '../courses/course-detail/LessonsTab';
import AttendanceTab from '../courses/course-detail/AttendanceTab';
import StudentsAttendanceTab from '../courses/course-detail/StudentAttendanceTab';
import ParticipantsTab, { CourseMember } from '../courses/course-detail/ParticipantsTab';
import RulesTab from '../courses/course-detail/RulesTab';
import CourseAchievementsTab from '../courses/course-detail/CourseAchievementsTab';


export type ViewerRole = 'teacher' | 'admin' | 'student';
type Tab = 'events' | 'attendance' | 'achievements' | 'rules' | 'participants';

interface Event {
  id: number;
  title: string;
  event_type: string;
  start_datetime: string;
  end_datetime: string;
  series_id: number | null;
}

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

const TABS_CONFIG: Record<ViewerRole, { key: Tab; label: string; icon: string }[]> = {
  teacher: [
    { key: 'events',       label: 'Заняття',    icon: '📅' },
    { key: 'attendance',   label: 'Відвідуваність', icon: '👥' },
    { key: 'achievements', label: 'Ачівменти',  icon: '🏆' },
    { key: 'rules',        label: 'Правила',    icon: '📋' },
  ],
  admin: [
    { key: 'events',       label: 'Заняття',        icon: '📅' },
    { key: 'participants', label: 'Учасники',       icon: '👥' },
    { key: 'rules',        label: 'Правила',        icon: '📋' },
  ],
  student: [
    { key: 'events',       label: 'Розклад',        icon: '📅' },
    { key: 'attendance',   label: 'Моя явка',       icon: '✅' },
    { key: 'participants', label: 'Учасники',      icon: '👨‍🏫' },
    { key: 'rules',        label: 'Правила',        icon: '📋' },
  ],
};

export default function CourseDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token } = useAuth();

  const courseId = Number(route.params?.courseId ?? 1);
  const viewerRole: ViewerRole = route.params?.viewerRole ?? 'teacher';
  const tabs = TABS_CONFIG[viewerRole];

  const initialTab = route.params?.initialTab as Tab;
  const defaultTab = initialTab && tabs.some(t => t.key === initialTab) ? initialTab : tabs[0].key;
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const [events, setEvents] = useState<Event[]>([]);
  const [teachers, setTeachers] = useState<CourseMember[]>([]);
  const [students, setStudents] = useState<CourseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState<string>('Завантаження...');
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);

  useEffect(() => {
    const currentInitialTab = route.params?.initialTab as Tab;
    if (currentInitialTab) {
      setActiveTab(currentInitialTab);
      navigation.setParams({ initialTab: undefined });
    }
  }, [route.params?.initialTab]);

  const fetchCourseData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const courseResponse = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (courseResponse.ok) {
        const courseData = await courseResponse.json();
        if (courseData.name) setCourseTitle(courseData.name);

        setTeachers(courseData.teachers ?? []);
        setStudents(courseData.students ?? []);

        if (courseData.students) {
          setTotalStudents(courseData.students.length);
        }
      }

      const eventsResponse = await fetch(`${API_BASE_URL}/courses/${courseId}/events`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
      }

      if (viewerRole === 'teacher' || viewerRole === 'admin') {
        const statsResponse = await fetch(`${API_BASE_URL}/statistics?role=teacher`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          const courseStat = statsData.find((s: any) => s.course_id === courseId);
          if (courseStat) {
             setAvgAttendance(Math.round(courseStat.average_attendance_pct || 0));
          }
        }
      }
    } catch (err) {
      console.error("Помилка завантаження даних курсу:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId, token]);

  const tabAccent = viewerRole === 'admin' ? '#F4A72B' : (viewerRole === 'student' ? '#7B88FF' : '#5B4CFA');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />

      <CourseHeader
        courseCode={courseTitle}
        courseTitle={courseTitle}
        avgAttendance={avgAttendance}
        eventsCount={events.length}
        viewerRole={viewerRole}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: tabAccent }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#5B4CFA" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {activeTab === 'events' && (
            <LessonsTab
              viewerRole={viewerRole}
              events={events}
              refreshEvents={fetchCourseData}
              courseId={courseId}
              navigation={navigation}
              courseTitle={courseTitle}
              totalStudents={totalStudents}
            />
          )}

          {activeTab === 'attendance' && (
            viewerRole === 'student'
              ? <StudentsAttendanceTab courseId={courseId} viewerRole={viewerRole} />
              : <AttendanceTab courseId={courseId} />
          )}

          {activeTab === 'participants' && (
            <ParticipantsTab
              courseId={courseId}
              teachers={teachers}
              students={students}
              loading={false}
              onRefresh={fetchCourseData}
              viewerRole={viewerRole}
            />
          )}
          {activeTab === 'achievements' && (
            <CourseAchievementsTab courseId={courseId} />
          )}
          {activeTab === 'rules' && (
            <RulesTab courseId={courseId} viewerRole={viewerRole} />
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#12111A' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1C1B27', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabIcon: { fontSize: 16 },
  tabLabel: { color: '#9896B0', fontSize: 10, fontWeight: '500' },
  tabLabelActive: { color: '#F0EEF8', fontWeight: '700' },
  body: { padding: 16 },
});