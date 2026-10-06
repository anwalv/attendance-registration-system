import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

interface EnrolledStudent {
  id: string;
  name: string;
  attended: number;
  total: number;
}

interface AttendanceTabProps {
  courseId: number;
}

export default function AttendanceTab({ courseId }: AttendanceTabProps) {
  const { token } = useAuth();
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/courses/${courseId}/students-attendance`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setStudents(data);
      } catch (e) {
        console.error('Помилка завантаження відвідуваності:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [courseId, token]);

  if (loading) {
    return <ActivityIndicator size="large" color="#5B4CFA" style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ gap: 10 }}>
      {students.length === 0 ? (
        <Text style={{ color: '#9896B0', textAlign: 'center', marginVertical: 20 }}>
          Немає зареєстрованих студентів на цьому курсі
        </Text>
      ) : (
        students.map((student) => {
          const attendancePercent = student.total > 0
            ? Math.round((student.attended / student.total) * 100)
            : 0;
          return (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentRoleSub}>Студент</Text>
              </View>
              <View style={styles.studentStats}>
                <Text style={styles.studentPercentText}>{attendancePercent}%</Text>
                <Text style={styles.studentCountText}>{student.attended} з {student.total} пар</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  studentCard: { backgroundColor: '#1C1B27', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo: { flex: 1, gap: 2 },
  studentName: { color: '#F0EEF8', fontSize: 14, fontWeight: '700' },
  studentRoleSub: { color: '#9896B0', fontSize: 11 },
  studentStats: { alignItems: 'flex-end', gap: 2 },
  studentPercentText: { color: '#23C97D', fontSize: 15, fontWeight: '800' },
  studentCountText: { color: '#9896B0', fontSize: 11 },
});
