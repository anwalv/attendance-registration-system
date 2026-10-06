import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, SafeAreaView, StatusBar, View, ActivityIndicator, Alert } from 'react-native';
import CourseCard, { Course } from './courses/CourseCard';
import CreateCourseModal from './courses/CreateCourseModal';
import DeleteConfirmModal from './courses/DeleteConfirmModal';
import { useAuth } from './context/AuthContext';

export type ViewerRole = 'teacher' | 'admin';

interface Props {
  viewerRole: ViewerRole;
  HeaderComponent: React.ComponentType<{
    title: string;
    subtitle?: string;
    rightAction?: { icon: string; label?: string; onPress: () => void };
  }>;
}

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

export default function CoursesManagementScreen({ viewerRole, HeaderComponent }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const { token } = useAuth();
  const isAdmin = viewerRole === 'admin';
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const coursesRes = await fetch(`${API_BASE_URL}/courses`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const coursesData = await coursesRes.json();
      if (!coursesRes.ok) {
        throw new Error(coursesData.error || 'Не вдалося завантажити курси');
      }
  
      let filteredCourses = coursesData;
  
      if (!isAdmin) {
        const meRes = await fetch(`${API_BASE_URL}/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const meData = await meRes.json();
        if (!meRes.ok) {
          throw new Error(meData.error || 'Не вдалося завантажити профіль');
        }
  
        const myCourseIds = new Set(
          meData.enrollments
            .filter((e: any) => e.role === viewerRole)
            .map((e: any) => e.course_id)
        );
  
        filteredCourses = coursesData.filter((c: any) => myCourseIds.has(c.id));
      }
  
      const adaptedCourses: Course[] = filteredCourses.map((c: any) => ({
        id: String(c.id),
        title: c.name,
        titleShort: c.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3),
        group: 'Всі групи',
        semester: c.term || 'Поточний',
        color: c.id % 3 === 1 ? '#2A1FA8' : c.id % 3 === 2 ? '#0F2A1E' : '#2A1A0A',
        accent: c.id % 3 === 1 ? '#7B88FF' : c.id % 3 === 2 ? '#23C97D' : '#F4A72B',
        totalLectures: c.total_lectures || 0,
        totalPractices: c.total_practices || 0,
        students: c.students_count || 0,
        avgAttendance: Math.round(c.avg_attendance) || 0,
      }));
  
      setCourses(adaptedCourses);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Проблема з підключенням до сервера');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchCourses();
      }
    }, [token, viewerRole])
  );
  const confirmDelete = async () => {
    if (!courseToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося видалити курс');
      }

      setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
      setCourseToDelete(null);
      Alert.alert('Успішно', 'Курс повністю видалено з системи');
    } catch (error: any) {
      Alert.alert('Помилка видалення', error.message);
    }
  };

  const subtitle = loading ? 'Оновлення...' : isAdmin ? `${courses.length} курсів у системі` : `${courses.length} активних курси`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#12111A' }}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />

      <HeaderComponent
        title="Курси"
        subtitle={subtitle}
        rightAction={isAdmin ? { icon: '＋', label: 'Новий курс', onPress: () => setShowCreate(true) } : undefined}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#5B4CFA" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} viewerRole={viewerRole} onDelete={setCourseToDelete} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <CreateCourseModal visible={showCreate} onClose={() => setShowCreate(false)} viewerRole={viewerRole} onCourseCreated={fetchCourses} />
      {courseToDelete && <DeleteConfirmModal courseTitle={courseToDelete.title} onConfirm={confirmDelete} onCancel={() => setCourseToDelete(null)} />}
    </SafeAreaView>
  );
}