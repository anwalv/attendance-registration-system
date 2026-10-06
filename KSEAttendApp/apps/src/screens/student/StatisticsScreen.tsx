import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Dimensions, ActivityIndicator,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth, API_BASE } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const TILE_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP * 2) / 3;

interface Props {
  navigation: DrawerNavigationProp<any>;
}

export interface WeekPoint {
  label: string;
  pct: number;
  attended: number;
  total: number;
}

export interface BonusRule {
  needed: number;
  current: number;
  reward: string;
  courseName: string;
}

interface CourseStat {
  id: string;
  name: string;
  nameShort: string;
  attended: number;
  total: number;
  percentage: number;
  color: string;
  accentColor: string;
  weeklyTrend?: WeekPoint[];
  bonusRule?: BonusRule;
}

const COURSE_COLORS = [
  { color: '#2A1FA8', accent: '#7B88FF' },
  { color: '#0F2A1E', accent: '#23C97D' },
  { color: '#2A1A0A', accent: '#F4A72B' },
  { color: '#0E2A45', accent: '#4B9EFF' },
];

const getStatus = (pct: number) => {
  if (pct >= 80) return { label: 'Добре', color: '#23C97D' };
  if (pct >= 60) return { label: 'Задовільно', color: '#F4A72B' };
  return { label: 'Критично', color: '#F4485E' };
};


function OverviewTile({ value, unit, label, color }: { value: string | number; unit?: string; label: string; color: string; }) {
  return (
    <View style={[styles.overviewCard, { borderTopColor: color }]}>
      <Text style={[styles.overviewValue, { color }]}>
        {value}
        <Text style={styles.overviewUnit}>{unit}</Text>
      </Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function RankBadge({ course, type }: { course: CourseStat; type: 'best' | 'worst' }) {
  if (!course) return null;
  const isBest = type === 'best';

  return (
    <View style={[styles.rankCard, { backgroundColor: course.color, borderColor: course.accentColor }]}>
      <View style={styles.rankHeader}>
        <Text style={styles.rankEmoji}>{isBest ? '🏆' : '⚠️'}</Text>
        <Text style={styles.rankLabel}>{isBest ? 'Найкраща явка' : 'Потребує уваги'}</Text>
      </View>
      <View style={styles.rankBody}>
        <View style={[styles.rankInitialCircle, { borderColor: course.accentColor }]}>
          <Text style={[styles.rankInitialText, { color: course.accentColor }]}>
            {course.nameShort}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankCourseName} numberOfLines={1}>{course.name}</Text>
          <Text style={[styles.rankPct, { color: course.accentColor }]}>{Math.round(course.percentage)}%</Text>
        </View>
      </View>
    </View>
  );
}

function WeeklyTrendChart({ trendData, streakDays = 0 }: { trendData: WeekPoint[], streakDays?: number }) {
  const chartHeight = 110;
  const pointGap = (SCREEN_WIDTH - 40 - 36) / (trendData.length > 1 ? trendData.length - 1 : 1);
  const [selectedIdx, setSelectedIdx] = useState(trendData.length - 1);

  if (!trendData || trendData.length === 0) return null;

  const getY = (pct: number) => chartHeight - (pct / 100) * chartHeight;
  const points = trendData.map((w, i) => ({ x: 18 + i * pointGap, y: getY(w.pct), ...w }));
  const selected = trendData[selectedIdx] || trendData[0];
  const avgTrend = Math.round(trendData.reduce((s, w) => s + w.pct, 0) / trendData.length);
  
  const trendDelta = trendData.length > 1 
    ? trendData[trendData.length - 1].pct - trendData[trendData.length - 2].pct 
    : 0;

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <Text style={styles.sectionTitle}>Динаміка по тижнях</Text>
        {streakDays > 0 && (
          <View style={styles.streakPill}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streakDays} днів поспіль</Text>
          </View>
        )}
      </View>

      <View style={styles.trendCallout}>
        <Text style={styles.trendCalloutPct}>{selected.pct}%</Text>
        <Text style={styles.trendCalloutLabel}>{selected.label} · {selected.attended}/{selected.total} пар</Text>
      </View>

      <View style={{ height: chartHeight + 28 }}>
        {[0, 50, 100].map((g) => (
          <View key={g} style={[styles.trendGridline, { top: getY(g) }]} />
        ))}

        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={i}
              style={[ styles.trendSegment, { width: length, left: p.x, top: p.y, transform: [{ rotate: `${angle}deg` }] }]}
            />
          );
        })}

        {points.map((p, i) => (
          <TouchableOpacity key={i} onPress={() => setSelectedIdx(i)} style={[styles.trendPointTouchable, { left: p.x - 14, top: p.y - 14 }]}>
            <View style={[styles.trendPoint, i === selectedIdx && styles.trendPointActive, i === selectedIdx && { backgroundColor: '#7B88FF' }]} />
          </TouchableOpacity>
        ))}

        <View style={[styles.trendXLabels, { top: chartHeight + 10 }]}>
          {trendData.map((w, i) => (
            <Text key={i} style={[styles.trendXLabel, i === selectedIdx && styles.trendXLabelActive]}>
              {i === trendData.length - 1 ? 'зараз' : `Т${i + 1}`}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.trendFooter}>
        <Text style={styles.trendFooterText}>Середнє за період: {avgTrend}%</Text>
        <Text style={[styles.trendFooterDelta, { color: trendDelta >= 0 ? '#23C97D' : '#F4485E' }]}>
          {trendDelta >= 0 ? '▲' : '▼'} {Math.abs(trendDelta)}% за тиждень
        </Text>
      </View>
    </View>
  );
}

function BonusRuleCard({ rule }: { rule: BonusRule }) {
  if (!rule) return null;
  const remaining = rule.needed - rule.current;
  const pct = Math.min(rule.current / rule.needed, 1);

  return (
    <View style={styles.bonusCard}>
      <Text style={styles.bonusEmoji}>🎁</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.bonusTitle}>
          {remaining <= 0
            ? `Бонус розблоковано: ${rule.reward}!`
            : `Ще ${remaining} ${remaining === 1 ? 'пара' : 'пари'} до бонусу`}
        </Text>
        <Text style={styles.bonusSub}>
          {rule.courseName} · {rule.current}/{rule.needed} пар → {rule.reward}
        </Text>
        <View style={styles.bonusBarTrack}>
          <View style={[styles.bonusBarFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

function CourseStatTile({ course }: { course: CourseStat }) {
  const status = getStatus(Math.round(course.percentage));

  return (
    <View style={[styles.tile, { width: TILE_WIDTH }]}>
      <View style={[styles.tileBand, { backgroundColor: course.color }]}>
        <View style={[styles.tileInitialCircle, { borderColor: course.accentColor }]}>
          <Text style={[styles.tileInitialText, { color: course.accentColor }]}>{course.nameShort}</Text>
        </View>
        <View style={[styles.tileStatusDot, { backgroundColor: status.color }]} />
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileName} numberOfLines={2}>{course.name}</Text>
        <View style={styles.tileBarTrack}>
          <View style={[styles.tileBarFill, { width: `${course.percentage}%`, backgroundColor: course.accentColor }]} />
        </View>
        <View style={styles.tileFooter}>
          <Text style={[styles.tilePct, { color: course.accentColor }]}>{Math.round(course.percentage)}%</Text>
          <Text style={styles.tileCount}>{course.attended}/{course.total}</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatisticsScreen({ navigation }: Props) {
  const { authHeader } = useAuth();
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [globalWeeklyTrend, setGlobalWeeklyTrend] = useState<WeekPoint[]>([]);
  const [activeBonus, setActiveBonus] = useState<BonusRule | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const statsRes = await fetch(`${API_BASE}/statistics?role=student`, { headers: { ...authHeader() } });

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const allStats = Array.isArray(statsData) ? statsData : [];
          
          const mappedCourses: CourseStat[] = allStats.map((c: any, index: number) => {
            const theme = COURSE_COLORS[index % COURSE_COLORS.length];
            return {
              id: String(c.course_id),
              name: c.course_name,
              nameShort: c.course_name.substring(0, 2).toUpperCase(),
              attended: c.attended_events || 0,
              total: c.total_events || 0,
              percentage: c.attendance_pct || 0,
              color: theme.color,
              accentColor: theme.accent,
              weeklyTrend: c.weekly_trend,
              bonusRule: c.active_bonus,
            };
          });

          setCourses(mappedCourses);
        }
      } catch (error) {
        console.error("Помилка завантаження статистики:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalAttended = courses.reduce((sum, c) => sum + c.attended, 0);
  const totalLessons = courses.reduce((sum, c) => sum + c.total, 0);
  const avgAttendance = totalLessons > 0 ? Math.round((totalAttended / totalLessons) * 100) : 0;
  const missed = totalLessons - totalAttended;

  const ranked = [...courses].sort((a, b) => b.percentage - a.percentage);
  const bestCourse = ranked.length > 0 ? ranked[0] : null;
  const worstCourse = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  const rows: CourseStat[][] = [];
  for (let i = 0; i < courses.length; i += 3) {
    rows.push(courses.slice(i, i + 3));
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color="#5B4CFA" />
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
        <Text style={styles.headerTitle}>Статистика</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{courses.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryStrip}>
          <OverviewTile value={courses.length} label="Курсів" color="#7B88FF" />
          <View style={styles.summaryDivider} />
          <OverviewTile value={avgAttendance} unit="%" label="Середня явка" color={avgAttendance >= 80 ? '#23C97D' : '#F4A72B'} />
          <View style={styles.summaryDivider} />
          <OverviewTile value={missed} label="Пропусків" color="#F4485E" />
        </View>

        {bestCourse && worstCourse && (
          <View style={styles.rankRow}>
            <RankBadge course={bestCourse} type="best" />
            {courses.length > 1 && <RankBadge course={worstCourse} type="worst" />}
          </View>
        )}

        {courses.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>По предметах</Text>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map((course) => (
                  <CourseStatTile key={course.id} course={course} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>У вас поки немає статистики відвідуваності.</Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = { bg: '#12111A', surface: '#1C1B27', textPrimary: '#F0EEF8', textSecondary: '#9896B0', badgeBg: '#2A2B6E', badgeText: '#7B88FF', divider: 'rgba(255,255,255,0.08)', white: '#FFFFFF' };

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  headerBadge: { backgroundColor: colors.badgeBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: colors.badgeText, fontSize: 13, fontWeight: '700' },
  body: { paddingHorizontal: 20, gap: 16, paddingBottom: 16 },
  summaryStrip: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14 },
  summaryDivider: { width: 1, backgroundColor: colors.divider, marginVertical: 4 },
  overviewCard: { flex: 1, alignItems: 'center', gap: 2 },
  overviewValue: { fontSize: 22, fontWeight: '800' },
  overviewUnit: { fontSize: 13, fontWeight: '600' },
  overviewLabel: { color: colors.textSecondary, fontSize: 11 },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(244,167,43,0.15)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  streakEmoji: { fontSize: 12 },
  streakText: { color: '#F4A72B', fontSize: 11, fontWeight: '700' },
  rankRow: { flexDirection: 'row', gap: GRID_GAP },
  rankCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, gap: 10 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankEmoji: { fontSize: 14 },
  rankLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600' },
  rankBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankInitialCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  rankInitialText: { fontSize: 11, fontWeight: '900' },
  rankCourseName: { color: colors.white, fontSize: 12, fontWeight: '700' },
  rankPct: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  trendCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 14 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendCallout: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  trendCalloutPct: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  trendCalloutLabel: { color: colors.textSecondary, fontSize: 12 },
  trendGridline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  trendSegment: { position: 'absolute', height: 2, backgroundColor: '#7B88FF', borderRadius: 1, transformOrigin: 'left' },
  trendPointTouchable: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  trendPoint: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(123,136,255,0.4)', borderWidth: 2, borderColor: colors.surface },
  trendPointActive: { width: 12, height: 12, borderRadius: 6 },
  trendXLabels: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  trendXLabel: { color: colors.textSecondary, fontSize: 9, width: 36, textAlign: 'center' },
  trendXLabelActive: { color: colors.badgeText, fontWeight: '700' },
  trendFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  trendFooterText: { color: colors.textSecondary, fontSize: 11 },
  trendFooterDelta: { fontSize: 11, fontWeight: '700' },
  bonusCard: { flexDirection: 'row', backgroundColor: 'rgba(91,76,250,0.12)', borderRadius: 18, padding: 16, gap: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(91,76,250,0.3)' },
  bonusEmoji: { fontSize: 26 },
  bonusTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  bonusSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  bonusBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  bonusBarFill: { height: '100%', backgroundColor: '#7B88FF', borderRadius: 3 },
  section: { gap: 12, marginTop: 10 },
  gridRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  tile: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  tileBand: { paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileInitialCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  tileInitialText: { fontSize: 10, fontWeight: '900' },
  tileStatusDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.surface },
  tileBody: { padding: 9, gap: 6 },
  tileName: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  tileBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  tileBarFill: { height: '100%', borderRadius: 2 },
  tileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tilePct: { fontSize: 11, fontWeight: '800' },
  tileCount: { fontSize: 10, color: colors.textSecondary },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 14 }
});