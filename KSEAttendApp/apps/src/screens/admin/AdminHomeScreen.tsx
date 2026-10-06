import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth, API_BASE } from '../context/AuthContext';

interface Props {
  navigation: DrawerNavigationProp<any>;
}

interface ApiCourse {
  id: number;
  name: string;
  term: string;
}

interface UsersResponse {
  users: any[];
  page: number;
  totalPages: number;
  totalRecords: number;
  counts: {
    all: number;
    student: number;
    teacher: number;
    admin: number;
  };
}

interface Stats {
  totalCourses: number;
  students: number;
  teachers: number;
  totalUsers: number;
}

const StatCard = ({ value, label, accentColor, loading }: {
  value: number; label: string; accentColor: string; loading: boolean;
}) => (
  <View style={s.statCard}>
    {loading
      ? <ActivityIndicator color={accentColor} style={{ height: 34 }} />
      : <Text style={[s.statValue, { color: accentColor }]}>{value}</Text>
    }
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const QuickActionTile = ({ icon, label, accentColor, onPress }: {
  icon: string; label: string; accentColor: string; onPress: () => void;
}) => (
  <TouchableOpacity style={s.actionTile} onPress={onPress} activeOpacity={0.8}>
    <View style={[s.actionIconWrap, { backgroundColor: `${accentColor}22` }]}>
      <Text style={s.actionIcon}>{icon}</Text>
    </View>
    <Text style={s.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function AdminHomeScreen({ navigation }: Props) {
  const { token, user, logout } = useAuth();

  const [stats, setStats] = useState<Stats>({ totalCourses: 0, students: 0, teachers: 0, totalUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;

    setError(null);
    try {
      const [coursesRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/courses`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch(`${API_BASE}/users?limit=1`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }),
      ]);

      if (coursesRes.status === 401 || usersRes.status === 401) {
        logout();
        return;
      }

      if (!coursesRes.ok || !usersRes.ok) {
        throw new Error('Помилка отримання даних з сервера');
      }

      const courses: ApiCourse[] = await coursesRes.json();
      const usersData: UsersResponse = await usersRes.json();

      setStats({
        totalCourses: courses.length,
        students: usersData.counts.student,
        teachers: usersData.counts.teacher,
        totalUsers: usersData.counts.all,
      });
    } catch (e: any) {
      setError(e.message ?? 'Невідома помилка');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const adminInitial = user?.email?.slice(0, 2).toUpperCase() ?? 'АА';

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={s.burgerBtn}>
          <View style={s.burgerLine} /><View style={s.burgerLine} /><View style={s.burgerLine} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Панель адміністратора</Text>
        <TouchableOpacity style={s.headerAvatar} onPress={logout}>
          <Text style={s.headerAvatarText}>{adminInitial}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.accent} />
        }
      >
        {error && (
          <TouchableOpacity style={s.errorBanner} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={s.errorText}>⚠️  {error}</Text>
          </TouchableOpacity>
        )}

        <View style={s.statsGrid}>
          <View style={s.statsRow}>
            <StatCard value={stats.totalCourses} label="Всього курсів" accentColor="#7B88FF" loading={loading} />
            <StatCard value={stats.students} label="Студентів" accentColor="#4B9EFF" loading={loading} />
          </View>
          <View style={s.statsRow}>
            <StatCard value={stats.teachers} label="Викладачів" accentColor="#23C97D" loading={loading} />
            <StatCard value={stats.totalUsers} label="Всього в системі" accentColor="#9896B0" loading={loading} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Швидкі дії</Text>
          <View style={s.actionsGrid}>
            <QuickActionTile icon="➕" label="Створити курс" accentColor="#7B88FF" onPress={() => navigation.navigate('CoursesManagement')} />
            <QuickActionTile icon="📥" label="Імпорт" accentColor="#4B9EFF" onPress={() => navigation.navigate('Import')} />
            <QuickActionTile icon="👥" label="Користувачі" accentColor="#23C97D" onPress={() => navigation.navigate('Users')} />
            <QuickActionTile icon="🚪" label="Вийти" accentColor="#F4485E" onPress={logout} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const C = {
  bg: '#12111A', surface: '#1C1B27',
  textPrimary: '#F0EEF8', textSecondary: '#9896B0',
  accent: '#E0962B', divider: 'rgba(255,255,255,0.08)', white: '#FFFFFF',
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: C.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerTitle: { flex: 1, color: C.textPrimary, fontSize: 18, fontWeight: '800' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: C.white, fontWeight: '800', fontSize: 13 },
  body: { padding: 20, gap: 24, paddingBottom: 40 },
  errorBanner: { backgroundColor: 'rgba(244,72,94,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,72,94,0.3)', padding: 14 },
  errorText: { color: '#F4485E', fontSize: 12 },
  statsGrid: { gap: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 18, gap: 6, minHeight: 80, justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '500' },
  section: { gap: 12 },
  sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: { width: '47%', backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 10 },
  actionIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontSize: 18 },
  actionLabel: { color: C.textPrimary, fontSize: 13, fontWeight: '600', lineHeight: 17 },
});