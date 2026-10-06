import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  StatusBar, TouchableOpacity, Dimensions, ActivityIndicator
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth, API_BASE } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP) / 2;

interface Props {
  navigation: DrawerNavigationProp<any>;
}

interface Achievement {
  id: string;
  title: string;
  type: string;
  bonus: number;
  earned_at: string | null;
  course: string | null;
  unlocked: boolean;
}

interface CourseCategory {
  id: string;
  name: string;
  nameShort: string;
  color: string;
  accentColor: string;
  achievements: Achievement[];
  streak: number;
}

const COURSE_COLORS = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
  { color: '#2A0A2A', accent: '#D97BFF' },
];

function AchievementCard({ item }: { item: Achievement }) {
  const isPositive = item.bonus >= 0;
  const valueColor = isPositive ? '#23C97D' : '#F4485E';
  const icon = item.unlocked ? (isPositive ? '🏅' : '⚠️') : '🔒';
  const sign = isPositive ? '+' : '';
  const displayColor = item.unlocked ? valueColor : colors.textSecondary;

  return (
    <View style={[styles.card, { width: CARD_WIDTH }, !item.unlocked && styles.cardLocked]}>
      <View style={[styles.cardIconBg, { backgroundColor: item.unlocked ? `${valueColor}22` : 'rgba(255,255,255,0.06)' }]}>
        <Text style={styles.cardIcon}>{icon}</Text>
      </View>
      <Text style={[styles.cardTitle, !item.unlocked && styles.cardTitleLocked]} numberOfLines={2}>
        {item.title}
      </Text>
      
      <Text style={styles.cardDesc} numberOfLines={1}>
        {item.unlocked && item.earned_at ? item.earned_at : 'Заблоковано'}
      </Text>

      <View style={styles.cardXpRow}>
        <Text style={[styles.cardXp, { color: displayColor }]}>
          {sign}{item.bonus} балів
        </Text>
      </View>
    </View>
  );
}

function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  const rows: Achievement[][] = [];
  for (let i = 0; i < achievements.length; i += 2) {
    rows.push(achievements.slice(i, i + 2));
  }
  return (
    <View style={{ gap: GRID_GAP }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((a) => (
            <AchievementCard key={a.id} item={a} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CourseSection({ category }: { category: CourseCategory }) {
  const unlockedCount = category.achievements.filter(a => a.unlocked).length;
  
  return (
    <View style={styles.courseSection}>
      <View style={styles.courseSectionHeader}>
        <View style={[styles.courseInitialCircle, { backgroundColor: category.color, borderColor: category.accentColor }]}>
          <Text style={[styles.courseInitialText, { color: category.accentColor }]}>
            {category.nameShort}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.courseSectionTitle} numberOfLines={1}>
            {category.name}
          </Text>
          <Text style={styles.courseSectionSub}>
            Отримано: {unlockedCount} / {category.achievements.length}
          </Text>
        </View>
        {category.streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{category.streak} підряд</Text>
          </View>
        )}
      </View>
      <AchievementGrid achievements={category.achievements} />
    </View>
  );
}

type FilterId = 'all' | string;

function CategoryChips({ categories, selected, onSelect }: { categories: CourseCategory[]; selected: FilterId; onSelect: (id: FilterId) => void; }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      <Chip label="Усі" active={selected === 'all'} onPress={() => onSelect('all')} />
      {categories.map((c) => (
        <Chip
          key={c.id}
          label={c.nameShort}
          color={c.accentColor}
          active={selected === c.id}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color ? `${color}33` : 'rgba(244,167,43,0.2)', borderColor: color || '#F4A72B' }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && { color: color || '#F4A72B' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AchievementsScreen({ navigation }: Props) {
  const { authHeader } = useAuth();
  const [filter, setFilter] = useState<FilterId>('all');
  
  const [loading, setLoading] = useState(true);
  const [courseCategories, setCourseCategories] = useState<CourseCategory[]>([]);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalUnlocked, setTotalUnlocked] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const [achRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/achievements`, { headers: { ...authHeader() } }),
          fetch(`${API_BASE}/statistics?role=student`, { headers: { ...authHeader() } })
        ]);

        if (achRes.ok) {
          const achData = await achRes.json();
          const list: Achievement[] = achData.achievements || [];
          
          let highestStreak = 0;
          const streaksMap = new Map<string, number>();
          
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            const statsArr = Array.isArray(statsData) ? statsData : [];
            statsArr.forEach(s => {
              const streak = s.current_streak || 0;
              streaksMap.set(s.course_name, streak);
              if (streak > highestStreak) highestStreak = streak;
            });
          }
          
          const courseMap = new Map<string, Achievement[]>();

          list.forEach((item) => {
            if (item.course) {
              if (!courseMap.has(item.course)) courseMap.set(item.course, []);
              courseMap.get(item.course)!.push(item);
            }
          });

          const categories: CourseCategory[] = Array.from(courseMap.entries()).map(([courseName, achievements], idx) => {
            const theme = COURSE_COLORS[idx % COURSE_COLORS.length];
            return {
              id: `course_${idx}`,
              name: courseName,
              nameShort: courseName.substring(0, 2).toUpperCase(),
              color: theme.color,
              accentColor: theme.accent,
              achievements,
              streak: streaksMap.get(courseName) || 0
            };
          });

          setCourseCategories(categories);
          setMaxStreak(highestStreak);
          setTotalUnlocked(achData.total_unlocked || 0);
          setTotalAvailable(list.length);
        }
      } catch (error) {
        console.error('Помилка завантаження досягнень:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#F4A72B" />
      </View>
    );
  }

  const visibleCourses = filter === 'all' 
    ? courseCategories 
    : courseCategories.filter((c) => c.id === filter);

  const hasAnyAchievements = courseCategories.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerBtn}>
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Досягнення</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.xpBanner}>
          <Text style={styles.xpBannerEmoji}>🔥</Text>
          <Text style={styles.xpBannerValue}>{maxStreak} пар</Text>
          <Text style={styles.xpBannerSub}>
            Найкраща серія відвідувань • Відкрито {totalUnlocked} з {totalAvailable}
          </Text>
        </View>

        {hasAnyAchievements ? (
          <>
            <CategoryChips categories={courseCategories} selected={filter} onSelect={setFilter} />

            {visibleCourses.map((category) => (
              <CourseSection key={category.id} category={category} />
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>У вас ще немає доступних досягнень.</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = { bg: '#12111A', surface: '#1C1B27', textPrimary: '#F0EEF8', textSecondary: '#9896B0', white: '#FFFFFF' };

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: 20, gap: 20, paddingBottom: 16 },
  
  xpBanner: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,167,43,0.1)', borderRadius: 20, padding: 20, gap: 6, borderWidth: 1, borderColor: 'rgba(244,167,43,0.3)' },
  xpBannerEmoji: { fontSize: 40 },
  xpBannerValue: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: '#F4A72B' },
  xpBannerSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center' },
  
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  
  courseSection: { gap: 12 },
  courseSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseInitialCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  courseInitialText: { fontSize: 11, fontWeight: '900' },
  courseSectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  courseSectionSub: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(244,167,43,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,167,43,0.3)' },
  streakEmoji: { fontSize: 10 },
  streakText: { color: '#F4A72B', fontSize: 10, fontWeight: '800' },
  
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardLocked: { opacity: 0.5, borderColor: 'rgba(255,255,255,0.02)' },
  cardIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  cardIcon: { fontSize: 22 },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  cardTitleLocked: { color: colors.textSecondary },
  cardDesc: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
  cardXpRow: { marginTop: 2 },
  cardXp: { fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' }
});