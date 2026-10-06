import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

interface AttendanceRecord {
  event_id: number;
  event_title: string;
  start_datetime: string;
  status: 'present' | 'absent' | 'excused';
  checked_at?: string;
}

interface StudentAttendanceTabProps {
  courseId: number;
  viewerRole: 'student';
}

const STATUS_CONFIG = {
  present: { label: 'Присутній', icon: '✅', color: '#23C97D', bg: 'rgba(35, 201, 125, 0.1)' },
  absent: { label: 'Відсутній', icon: '❌', color: '#F4485E', bg: 'rgba(244, 72, 94, 0.1)' },
  excused: { label: 'Поважна', icon: 'ℹ️', color: '#F4A72B', bg: 'rgba(244, 167, 43, 0.1)' },
};

function formatDate(isoString: string) {
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('uk-UA', options);
  } catch (e) {
    return 'Невідома дата';
  }
}

export default function StudentAttendanceTab({ courseId, viewerRole }: StudentAttendanceTabProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, excused: 0, total: 0, pct: 0 });

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/courses/${courseId}/my-attendance`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
          const data: AttendanceRecord[] = await res.json();
          setRecords(data);

          let present = 0;
          let absent = 0;
          let excused = 0;

          data.forEach((r) => {
            if (r.status === 'present') present++;
            else if (r.status === 'absent') absent++;
            else if (r.status === 'excused') excused++;
          });

          const total = data.length;
          const pct = total > 0 ? Math.round(((present + excused) / total) * 100) : 0;

          setStats({ present, absent, excused, total, pct });
        }
      } catch (err) {
        console.error('Помилка отримання відвідуваності студента:', err);
      } finally {
        setLoading(false);
      }
    };

    if (viewerRole === 'student') {
      fetchAttendance();
    }
  }, [courseId, token, viewerRole]);

  if (loading) {
    return <ActivityIndicator size="large" color="#7B88FF" style={{ marginTop: 40 }} />;
  }


  return (
    <View style={s.container}>
      
      <View style={s.statsContainer}>
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#7B88FF' }]}>{stats.pct}%</Text>
            <Text style={s.statLbl}>Явка</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#23C97D' }]}>{stats.present}</Text>
            <Text style={s.statLbl}>Був</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#F4485E' }]}>{stats.absent}</Text>
            <Text style={s.statLbl}>Пропустив</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: '#F4A72B' }]}>{stats.excused}</Text>
            <Text style={s.statLbl}>Поважна</Text>
          </View>
        </View>
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Історія занять ({records.length})</Text>
      </View>

      <View style={s.list}>
        {records.length > 0 ? (
          records.map((record) => {
            const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.absent;
            return (
              <View key={record.event_id} style={s.lessonRow}>
                <View style={s.lessonInfo}>
                  <Text style={s.lessonTitle} numberOfLines={1}>
                    {record.event_title || 'Заняття'}
                  </Text>
                  <Text style={s.lessonDate}>{formatDate(record.start_datetime)}</Text>
                </View>
                
                <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}44` }]}>
                  <Text style={s.statusIcon}>{cfg.icon}</Text>
                  <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>У цьому семестрі занять ще не проводилось.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const C = { 
  bg: '#12111A', 
  surface: '#1C1B27', 
  textPrimary: '#F0EEF8', 
  textSecondary: '#9896B0', 
  divider: 'rgba(255,255,255,0.08)' 
};

const s = StyleSheet.create({
  container: { gap: 20 },
  center: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  fallbackText: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },
  
  statsContainer: { backgroundColor: C.surface, borderRadius: 20, padding: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, paddingVertical: 12 },
  statVal: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLbl: { color: C.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  list: { gap: 10 },

  lessonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderRadius: 16, padding: 14, gap: 12 },
  lessonInfo: { flex: 1, gap: 4 },
  lessonTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  lessonDate: { color: C.textSecondary, fontSize: 11 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  statusIcon: { fontSize: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { color: C.textSecondary, fontSize: 12, fontStyle: 'italic' },
});