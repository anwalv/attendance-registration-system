import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, API_BASE } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getCourseWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return 'курсів';
  }
  if (mod10 === 1) {
    return 'курс';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'курси';
  }
  return 'курсів';
}

interface ActiveCourse {
  id: string;
  title: string;
  teacher: string;
  isLive: boolean;
}

interface ScheduleItem {
  id: string;
  title: string;
  titleShort: string;
  time: string;
  type: string;
  status: 'live' | 'upcoming' | 'done';
  color: string;
  accentColor: string;
}

interface MiniCourse {
  id: string;
  title: string;
  titleShort: string;
  attended: number;
  total: number;
  color: string;
  accentColor: string;
}

interface Props {
  navigation: DrawerNavigationProp<any>;
}

const isWeb = Platform.OS === 'web';

const COURSE_COLORS = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0E2A45', accent: '#4B9EFF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
];

const PulseDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.pulseDotWrapper}>
      <Animated.View style={[styles.pulseDotRing, { transform: [{ scale: pulse }] }]} />
      <View style={styles.pulseDot} />
    </View>
  );
};

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const statusLabel =
    item.status === 'live' ? 'Зараз' : item.status === 'upcoming' ? 'Незабаром' : 'Завершено';
  const statusColor =
    item.status === 'live' ? '#23C97D' : item.status === 'upcoming' ? '#F4A72B' : '#9896B0';

  return (
    <View style={styles.scheduleRow}>
      <View style={[styles.scheduleInitial, { backgroundColor: item.color, borderColor: item.accentColor }]}>
        <Text style={[styles.scheduleInitialText, { color: item.accentColor }]}>{item.titleShort}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.scheduleTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.scheduleMeta}>
          {item.time} · {item.type}
        </Text>
      </View>
      <View style={[styles.scheduleStatusPill, { borderColor: statusColor }]}>
        <View style={[styles.scheduleStatusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.scheduleStatusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { user, authHeader } = useAuth(); 

  const [courses, setCourses] = useState<MiniCourse[]>([]);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [missedClasses, setMissedClasses] = useState(0);
  const [loading, setLoading] = useState(true);

  const [activeCourse, setActiveCourse] = useState<ActiveCourse | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]); 

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        const statsRes = fetch(`${API_BASE}/statistics?role=student`, { headers: { ...authHeader() } });
        const eventsRes = fetch(`${API_BASE}/events/today?role=student`, { headers: { ...authHeader() } });

        const [statsResponse, eventsResponse] = await Promise.all([statsRes, eventsRes]);

        if (statsResponse.ok) {
          const data = await statsResponse.json();
          const studentStats = Array.isArray(data) ? data : [];
          
          let totalMissed = 0;

          const mappedCourses: MiniCourse[] = studentStats.map((c: any, index: number) => {
            const colorTheme = COURSE_COLORS[index % COURSE_COLORS.length];
            
            totalMissed += (c.total_events - c.attended_events);

            return {
              id: c.course_id.toString(),
              title: c.course_name,
              titleShort: c.course_name.substring(0, 3).toUpperCase(),
              attended: c.attended_events, 
              total: c.total_events,
              color: colorTheme.color,
              accentColor: colorTheme.accent,
            };
          });
          
          setCourses(mappedCourses);
          setMissedClasses(totalMissed);

          if (studentStats.length > 0) {
            const totalPct = studentStats.reduce((sum: number, c: any) => sum + c.attendance_pct, 0);
            setAvgAttendance(Math.round(totalPct / studentStats.length));
          }
        }

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const now = new Date(); 
          
          let currentActiveCourse: ActiveCourse | null = null;
          const formattedSchedule: ScheduleItem[] = [];

          eventsData.forEach((ev: any, index: number) => {
            const start = new Date(ev.start_datetime);
            const end = new Date(ev.end_datetime);
            
            const isLive = now >= start && now <= end;
            const isDone = now > end;
            
            let status: 'live' | 'upcoming' | 'done' = 'upcoming';
            if (isLive) status = 'live';
            else if (isDone) status = 'done';

            if (isLive) {
              currentActiveCourse = {
                id: ev.id.toString(),
                title: ev.course_name,
                teacher: ev.teacher_name,
                isLive: true,
              };
            }

            const timeString = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}–${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
            const colorTheme = COURSE_COLORS[index % COURSE_COLORS.length];

            formattedSchedule.push({
              id: ev.id.toString(),
              title: ev.course_name,
              titleShort: ev.course_name.substring(0, 3).toUpperCase(),
              time: timeString,
              type: ev.event_title, 
              status: status,
              color: colorTheme.color,
              accentColor: colorTheme.accent,
            });
          });

          setActiveCourse(currentActiveCourse);
          setTodaySchedule(formattedSchedule);
        }

      } catch (error) {
        console.error("Не вдалося завантажити дані дашборду:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleRegisterAttendance = () => {
    navigation.navigate('QRScanner');
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'А';

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerBtn}>
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerUserChip}>
            <View style={styles.headerAvatarSmall}>
              <Text style={styles.avatarInitialSmall}>{userInitial}</Text>
            </View>
            <Text style={styles.headerUserName}>{user?.name?.split(' ')[0] || 'Студент'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        
        <View style={styles.userCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Невідомий Користувач'}</Text>
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>KSE Student</Text>
            </View>
            <Text style={styles.userEmail}>✉  {user?.email || 'email@kse.org.ua'}</Text>
          </View>
        </View>

        {activeCourse && (
          <LinearGradient colors={['#3B2FCC', '#7B3FE4', '#4B9EFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.courseCard}>
            {activeCourse.isLive && (
              <View style={styles.liveBadge}>
                <PulseDot />
                <Text style={styles.liveBadgeText}>Зараз триває пара!</Text>
              </View>
            )}
            <Text style={styles.courseTitle}>{activeCourse.title}</Text>
            <Text style={styles.courseMeta}>Викладач: {activeCourse.teacher}</Text>
          </LinearGradient>
        )}

        <View style={styles.statsStrip}>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: avgAttendance >= 80 ? '#23C97D' : '#F4A72B' }]}>
              {avgAttendance}%
            </Text>
            <Text style={styles.statsLabel}>Середня явка</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: '#F4485E' }]}>{missedClasses}</Text>
            <Text style={styles.statsLabel}>Пропусків</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: '#F4A72B' }]}>{courses.length} </Text>
            <Text style={styles.statsLabel}>{getCourseWord(courses.length)}</Text>
          </View>
        </View>

        {todaySchedule.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Розклад на сьогодні</Text>
            {todaySchedule.map((item, i) => (
              <React.Fragment key={item.id}>
                <ScheduleRow item={item} />
                {i < todaySchedule.length - 1 && <View style={styles.scheduleDivider} />}
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Поточні курси</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {courses.length > 0 ? (
               courses.map((c) => {
                 const pct = c.total > 0 ? (c.attended / c.total) : 0;
                 return (
                  <View key={c.id} style={styles.miniTile}>
                    <View style={[styles.miniBand, { backgroundColor: c.color }]}>
                      <View style={[styles.miniInitial, { borderColor: c.accentColor }]}>
                        <Text style={[styles.miniInitialText, { color: c.accentColor }]}>{c.titleShort}</Text>
                      </View>
                    </View>
                    <View style={styles.miniBody}>
                      <Text style={styles.miniTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.miniBarTrack}>
                        <View style={[styles.miniBarFill, { width: `${pct * 100}%`, backgroundColor: c.accentColor }]} />
                      </View>
                      <Text style={[styles.miniPct, { color: c.accentColor }]}>{Math.round(pct * 100)}%</Text>
                    </View>
                  </View>
                 );
               })
            ) : (
               <Text style={{ color: colors.textSecondary, padding: 10 }}>Курсів ще немає</Text>
            )}
          </ScrollView>
        </View>
      </ScrollView>
      {!isWeb && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fabExtended} onPress={handleRegisterAttendance} activeOpacity={0.85}>
            <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
            <Text style={styles.fabText}>Сканувати QR</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const colors = {
  bg: '#12111A',
  surface: '#1C1B27',
  surfaceHigh: '#252436',
  accent: '#5B4CFA',
  accentGreen: '#23C97D',
  textPrimary: '#F0EEF8',
  textSecondary: '#9896B0',
  badgeBg: '#2A2B6E',
  badgeText: '#7B88FF',
  liveBg: 'rgba(255,255,255,0.15)',
  white: '#FFFFFF',
  divider: 'rgba(255,255,255,0.08)',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bg },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 20, color: colors.textSecondary },
  headerUserChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 10, gap: 8 },
  headerAvatarSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInitialSmall: { color: colors.white, fontWeight: '700', fontSize: 13 },
  headerUserName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  
  body: { padding: 20, gap: 16, paddingBottom: 100 },
  
  userCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 16 },
  avatarWrapper: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.badgeText },
  avatarInitial: { color: colors.white, fontWeight: '800', fontSize: 28 },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  userNameUa: { color: colors.textSecondary, fontSize: 13, marginTop: 1 },
  groupBadge: { alignSelf: 'flex-start', backgroundColor: colors.badgeBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  groupBadgeText: { color: colors.badgeText, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  userEmail: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  
  courseCard: { borderRadius: 24, padding: 24, gap: 10, alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  liveBadgeText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  pulseDotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentGreen, position: 'absolute' },
  pulseDotRing: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accentGreen, opacity: 0.35, position: 'absolute' },
  courseTitle: { color: colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 0.1 },
  courseMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' },
  
  statsStrip: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14 },
  statsItem: { flex: 1, alignItems: 'center', gap: 2 },
  statsValue: { fontSize: 18, fontWeight: '800' },
  statsLabel: { color: colors.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 2 },
  statsDivider: { width: 1, backgroundColor: colors.divider, marginVertical: 4 },
  
  sectionCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  seeAllLink: { color: colors.badgeText, fontSize: 12, fontWeight: '600' },
  
  miniTile: { width: 150, backgroundColor: colors.bg, borderRadius: 16, overflow: 'hidden' },
  miniBand: { paddingHorizontal: 10, paddingVertical: 10 },
  miniInitial: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  miniInitialText: { fontSize: 10, fontWeight: '900' },
  miniBody: { padding: 10, gap: 6 },
  miniTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  miniBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  miniPct: { fontSize: 11, fontWeight: '800' },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleInitial: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scheduleInitialText: { fontSize: 11, fontWeight: '900' },
  scheduleTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  scheduleMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  scheduleStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  scheduleStatusDot: { width: 6, height: 6, borderRadius: 3 },
  scheduleStatusText: { fontSize: 10, fontWeight: '700' },
  scheduleDivider: { height: 1, backgroundColor: colors.divider },
  
  fabContainer: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  fabExtended: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentGreen, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 30, gap: 10, shadowColor: colors.accentGreen, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10 },
  fabText: { color: colors.white, fontSize: 16, fontWeight: '700' }
});