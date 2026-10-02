import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

interface CourseAchievement {
  id: number;
  name: string;
  type: string;
  value: number;
  unlocked_count: number;
  total_students: number;
}

interface CourseAchievementsTabProps {
  courseId: number;
}

export default function CourseAchievementsTab({ courseId }: CourseAchievementsTabProps) {
  const { token } = useAuth();
  const [achievements, setAchievements] = useState<CourseAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const fetchAchievements = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/courses/${courseId}/achievements`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setAchievements(data);
      } catch (e) {
        console.error('Помилка завантаження ачівментів:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, [courseId, token]);

  if (loading) return <ActivityIndicator size="large" color="#5B4CFA" style={{ marginTop: 20 }} />;

  return (
    <View style={{ gap: 10 }}>
      {achievements.length === 0 ? (
        <Text style={{ color: '#9896B0', textAlign: 'center', marginVertical: 20 }}>
          Для цього курсу ще не налаштовано жодного ачівменту
        </Text>
      ) : (
        achievements.map((ach) => {
          const pct = ach.total_students > 0 ? Math.round((ach.unlocked_count / ach.total_students) * 100) : 0;
          return (
            <View key={ach.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>🏆 {ach.name}</Text>
                <Text style={s.sub}>Розблокували {ach.unlocked_count} з {ach.total_students} студентів</Text>
              </View>
              <Text style={s.pct}>{pct}%</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#1C1B27', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: '#F0EEF8', fontSize: 14, fontWeight: '700' },
  sub: { color: '#9896B0', fontSize: 11, marginTop: 2 },
  pct: { color: '#F4A72B', fontSize: 15, fontWeight: '800' },
});