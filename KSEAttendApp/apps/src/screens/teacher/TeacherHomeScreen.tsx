import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext'; 

import ActiveEventCard, { ActiveEvent } from './ActiveEventCard';

interface Props {
  navigation: DrawerNavigationProp<any>;
}

interface ScheduleItem {
  id: string;
  courseId: string;
  time: string;
  title: string;
  type: string;
  room: string;
  group: string;
  color: string;
  accent: string;
  status: 'live' | 'upcoming' | 'done';
}

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

const COURSE_COLORS = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
];

function Header({ navigation, userName }: { navigation: DrawerNavigationProp<any>; userName: string }) {
  const userInitial = userName ? userName.charAt(0).toUpperCase() : 'В';
  const shortName = userName.split(' ')[0] || 'Викладач';

  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => navigation.openDrawer()} style={s.burgerBtn}>
        <View style={s.burgerLine} />
        <View style={s.burgerLine} />
        <View style={s.burgerLine} />
      </TouchableOpacity>

      <View style={s.headerRight}>
        <TouchableOpacity style={s.headerUserChip}>
          <View style={s.headerAvatarSmall}>
            <Text style={s.avatarInitialSmall}>{userInitial}</Text>
          </View>
          <Text style={s.headerUserName}>{shortName}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ScheduleCard({ item, navigation }: { item: ScheduleItem; navigation: DrawerNavigationProp<any> }) {
  const statusColor = item.status === 'live' ? '#23C97D' : '#F4A72B';
  const statusLabel = item.status === 'live' ? 'Зараз' : item.status === 'upcoming' ? 'Незабаром' : 'Завершено';

  return (
    <TouchableOpacity
      style={s.scheduleCard}
      onPress={() => navigation.navigate('CourseDetail', { courseId: Number(item.courseId), viewerRole: 'teacher' })}
      activeOpacity={0.8}
    >
      <View style={[s.scheduleAccent, { backgroundColor: item.accent }]} />
      <View style={[s.scheduleInitial, { backgroundColor: item.color, borderColor: item.accent }]}>
        <Text style={[s.scheduleInitialText, { color: item.accent }]}>
          {item.title.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.scheduleTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.scheduleMeta}>
          {item.time} · {item.type}
        </Text>
      </View>
      <View style={[s.scheduleStatus, { borderColor: statusColor }]}>
        <View style={[s.scheduleStatusDot, { backgroundColor: statusColor }]} />
        <Text style={[s.scheduleStatusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherHomeScreen({ navigation }: Props) {
  const { user, token } = useAuth(); 

  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [stats, setStats] = useState({ coursesCount: 0, eventsToday: 0, attendanceToday: 0 });

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const meResponse = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const meData = await meResponse.json();
      const myCourseIds = new Set(
        (meData.enrollments || [])
          .filter((e: any) => e.role === 'teacher')
          .map((e: any) => e.course_id)
      );
      const coursesResponse = await fetch(`${API_BASE_URL}/courses`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      let coursesMap: Record<string, number> = {};
      let myCourses: any[] = [];
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        myCourses = coursesData.filter((c: any) => myCourseIds.has(c.id));
        myCourses.forEach((c: any) => { coursesMap[String(c.id)] = c.students_count || 0; });
      }
      const statsResponse = await fetch(`${API_BASE_URL}/statistics?role=teacher`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      let avgAttendance = 0;
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.length > 0) {
          avgAttendance = Math.round(
            statsData.reduce((acc: number, s: any) => acc + s.average_attendance_pct, 0) / statsData.length
          );
        }
      }

      const todayResponse = await fetch(`${API_BASE_URL}/events/today?role=teacher`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      let currentActive: ActiveEvent | null = null;
      let nextUpcoming: any = null;
      let formatted: ScheduleItem[] = [];

      if (todayResponse.ok) {
        const todayEvents = await todayResponse.json();
        const now = new Date();

        formatted = todayEvents.map((ev: any, idx: number) => {
          const start = new Date(ev.start_datetime);
          const end = new Date(ev.end_datetime);
          const isLive = now >= start && now <= end;
          const isDone = now > end;

          let status: 'live' | 'upcoming' | 'done' = 'upcoming';
          if (isLive) status = 'live';
          else if (isDone) status = 'done';

          const timeString = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}–${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
          const theme = COURSE_COLORS[idx % COURSE_COLORS.length];
          const totalStudentsOnCourse = coursesMap[String(ev.course_id)] || 0;

          if (isLive) {
            currentActive = {
              courseId: String(ev.course_id),
              eventId: String(ev.id),
              courseTitle: ev.course_name,
              type: ev.event_title.split(':')[0] || 'Заняття',
              time: timeString,
              attended: 0,
              total: totalStudentsOnCourse,
              isLive: true,
            };
          }
          if (!isLive && !isDone && !nextUpcoming) {
            nextUpcoming = {
              courseId: String(ev.course_id), eventId: String(ev.id),
              courseTitle: ev.course_name, type: ev.event_title.split(':')[0] || 'Заняття',
              time: timeString, attended: 0, total: totalStudentsOnCourse, isLive: false,
            };
          }

          return {
            id: String(ev.id), courseId: String(ev.course_id), time: timeString,
            title: ev.course_name, type: ev.event_title.split(':')[0] || 'Заняття',
            color: theme.color, accent: theme.accent, status,
          };
        });
      }

      const active = currentActive || nextUpcoming;
      if (active) {
        const attRes = await fetch(`${API_BASE_URL}/events/${active.eventId}/attendance`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (attRes.ok) {
          const attData = await attRes.json();
          active.attended = attData.present;
          active.total = attData.total_students;
        }
      }

      setStats({ coursesCount: myCourses.length, eventsToday: formatted.length, attendanceToday: avgAttendance });
      setSchedule(formatted);
      setActiveEvent(active);
    } catch (err) {
      console.error("Помилка завантаження дашборду викладача:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />
      <Header navigation={navigation} userName={user?.name || 'Викладач'} />
      
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.userCard}>
          <View style={s.avatarWrapper}>
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitial}>{user?.name ? user.name.charAt(0).toUpperCase() : 'В'}</Text>
            </View>
          </View>
          <View style={s.userInfo}>
            <Text style={s.userName}>{user?.name || 'Викладач кафедри'}</Text>
            <View style={s.groupBadge}>
              <Text style={s.groupBadgeText}>KSE Teacher</Text>
            </View>
            <Text style={s.userEmail}>✉  {user?.email || 'teacher@kse.org.ua'}</Text>
          </View>
        </View>
        {activeEvent && <ActiveEventCard event={activeEvent} />}
        <View style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: '#7B88FF' }]}>{stats.coursesCount}</Text>
            <Text style={s.statLabel}>Курсів</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: '#F4A72B' }]}>{stats.eventsToday}</Text>
            <Text style={s.statLabel}>Занять сьогодні</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: '#23C97D' }]}>{stats.attendanceToday}%</Text>
            <Text style={s.statLabel}>Середня явка</Text>
          </View>
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Розклад на сьогодні</Text>
          {schedule.length > 0 ? (
            schedule.map((item) => (
              <ScheduleCard key={item.id + item.time} item={item} navigation={navigation} />
            ))
          ) : (
            <Text style={{ color: '#9896B0', textAlign: 'center', marginVertical: 10 }}>На сьогодні занять немає</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const C = {
  bg: '#12111A', surface: '#1C1B27', accent: '#5B4CFA',
  green: '#23C97D', amber: '#F4A72B',
  textPrimary: '#F0EEF8', textSecondary: '#9896B0',
  white: '#FFFFFF', divider: 'rgba(255,255,255,0.08)',
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.bg },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: C.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 20, color: C.textSecondary },
  headerUserChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 10, gap: 8 },
  headerAvatarSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInitialSmall: { color: C.white, fontWeight: '700', fontSize: 13 },
  headerUserName: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  body: { padding: 20, gap: 16, paddingBottom: 100 },
  statsStrip: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: C.textSecondary, fontSize: 10 },
  statDivider: { width: 1, backgroundColor: C.divider, marginVertical: 4 },
  section: { gap: 10 },
  sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  scheduleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 12, overflow: 'hidden' },
  scheduleAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  scheduleInitial: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scheduleInitialText: { fontSize: 11, fontWeight: '900' },
  scheduleTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  scheduleMeta: { color: C.textSecondary, fontSize: 10, marginTop: 2 },
  scheduleStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  scheduleStatusDot: { width: 5, height: 5, borderRadius: 3 },
  scheduleStatusText: { fontSize: 9, fontWeight: '700' },
  userCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderRadius: 20, padding: 20, gap: 16 },
  avatarWrapper: { shadowColor: C.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#7B88FF' },
  avatarInitial: { color: C.white, fontWeight: '800', fontSize: 28 },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: C.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  groupBadge: { alignSelf: 'flex-start', backgroundColor: '#2A2B6E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  groupBadgeText: { color: '#7B88FF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  userEmail: { color: C.textSecondary, fontSize: 12, marginTop: 6 },
});