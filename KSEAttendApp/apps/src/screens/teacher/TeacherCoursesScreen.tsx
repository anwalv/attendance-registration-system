import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Modal, TouchableWithoutFeedback, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';


export type ViewerRole = 'teacher' | 'admin';

interface Course {
  id: string;
  title: string;
  titleShort: string;
  group: string;
  semester: string;
  color: string;
  accent: string;
  totalLectures: number;
  totalPractices: number;
  students: number;
  avgAttendance: number;
  teacherName?: string;
}

interface Props {
  viewerRole: ViewerRole;
  HeaderComponent: React.ComponentType<{
    title: string;
    subtitle?: string;
    rightAction?: { icon: string; label?: string; onPress: () => void };
  }>;
}

const COURSES: Course[] = [
  {
    id: '1', title: 'Криптографічні Системи Безпеки', titleShort: 'КСБ',
    group: 'SEBA27', semester: 'Осінь 2025',
    color: '#2A1FA8', accent: '#7B88FF',
    totalLectures: 14, totalPractices: 6, students: 24, avgAttendance: 84,
    teacherName: 'Volodymyr Skochko',
  },
  {
    id: '2', title: 'Основи кібербезпеки', titleShort: 'ОКБ',
    group: 'MEBA25', semester: 'Осінь 2025',
    color: '#0F2A1E', accent: '#23C97D',
    totalLectures: 10, totalPractices: 4, students: 20, avgAttendance: 91,
    teacherName: 'Oksana Petrenko',
  },
  {
    id: '3', title: 'Мережева безпека', titleShort: 'МБ',
    group: 'BEDA26', semester: 'Осінь 2025',
    color: '#2A1A0A', accent: '#F4A72B',
    totalLectures: 8, totalPractices: 4, students: 18, avgAttendance: 67,
    teacherName: 'Volodymyr Skochko',
  },
];

function CreateCourseModal({
  visible,
  onClose,
  viewerRole,
}: {
  visible: boolean;
  onClose: () => void;
  viewerRole: ViewerRole;
}) {
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [lectures, setLectures] = useState('');
  const [practices, setPractices] = useState('');
  const [teacher, setTeacher] = useState('');

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ms.overlay} />
      </TouchableWithoutFeedback>
      <View style={ms.sheet}>
        <View style={ms.handle} />
        <Text style={ms.sheetTitle}>Новий курс</Text>

        <View style={ms.formGroup}>
          <Text style={ms.label}>Назва курсу</Text>
          <TextInput
            style={ms.input} value={title} onChangeText={setTitle}
            placeholder="Наприклад: Алгоритми та структури даних"
            placeholderTextColor="#9896B0"
          />
        </View>

        <View style={ms.formGroup}>
          <Text style={ms.label}>Група</Text>
          <TextInput
            style={ms.input} value={group} onChangeText={setGroup}
            placeholder="SEBA27" placeholderTextColor="#9896B0"
          />
        </View>

        {viewerRole === 'admin' && (
          <View style={ms.formGroup}>
            <Text style={ms.label}>Викладач</Text>
            <TextInput
              style={ms.input} value={teacher} onChangeText={setTeacher}
              placeholder="Volodymyr Skochko" placeholderTextColor="#9896B0"
            />
            <Text style={ms.fieldHint}>Можна змінити пізніше в деталях курсу</Text>
          </View>
        )}

        <View style={ms.formRow}>
          <View style={[ms.formGroup, { flex: 1 }]}>
            <Text style={ms.label}>Лекцій</Text>
            <TextInput
              style={ms.input} value={lectures} onChangeText={setLectures}
              keyboardType="numeric" placeholder="14" placeholderTextColor="#9896B0"
            />
          </View>
          <View style={[ms.formGroup, { flex: 1 }]}>
            <Text style={ms.label}>Практик</Text>
            <TextInput
              style={ms.input} value={practices} onChangeText={setPractices}
              keyboardType="numeric" placeholder="6" placeholderTextColor="#9896B0"
            />
          </View>
        </View>

        <Text style={ms.hint}>
          Система автоматично згенерує {lectures || '0'} лекцій та {practices || '0'} практик
        </Text>

        <View style={ms.btnRow}>
          <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
            <Text style={ms.cancelBtnText}>Скасувати</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.createBtn} onPress={onClose}>
            <Text style={ms.createBtnText}>Створити курс</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DeleteConfirmModal({
  course,
  onConfirm,
  onCancel,
}: {
  course: Course;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={ms.overlay} />
      </TouchableWithoutFeedback>
      <View style={ms.deleteCard}>
        <Text style={ms.deleteIcon}>🗑️</Text>
        <Text style={ms.deleteTitle}>Видалити курс?</Text>
        <Text style={ms.deleteSub}>
          «{course.title}» буде видалено разом з усіма заняттями та даними відвідуваності.
          Цю дію неможливо скасувати.
        </Text>
        <View style={ms.btnRow}>
          <TouchableOpacity style={ms.cancelBtn} onPress={onCancel}>
            <Text style={ms.cancelBtnText}>Скасувати</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.deleteBtn} onPress={onConfirm}>
            <Text style={ms.deleteBtnText}>Видалити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CourseCard({
  course,
  viewerRole,
  onDelete,
}: {
  course: Course;
  viewerRole: ViewerRole;
  onDelete: (course: Course) => void;
}) {
  const navigation = useNavigation<any>();
  const statusColor = course.avgAttendance >= 80 ? '#23C97D'
    : course.avgAttendance >= 65 ? '#F4A72B' : '#F4485E';

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, viewerRole })}
      activeOpacity={0.85}
    >
      <View style={[s.cardBand, { backgroundColor: course.color }]}>
        <View style={[s.cardInitial, { borderColor: course.accent }]}>
          <Text style={[s.cardInitialText, { color: course.accent }]}>{course.titleShort}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{course.title}</Text>
          <Text style={s.cardGroup}>{course.group} · {course.semester}</Text>
          {viewerRole === 'admin' && course.teacherName && (
            <Text style={s.cardTeacher}>👨‍🏫 {course.teacherName}</Text>
          )}
        </View>
        <View style={[s.cardPctBadge, { backgroundColor: `${statusColor}22`, borderColor: statusColor }]}>
          <Text style={[s.cardPct, { color: statusColor }]}>{course.avgAttendance}%</Text>
        </View>
      </View>
      <View style={s.cardStats}>
        <View style={s.cardStatItem}>
          <Text style={s.cardStatValue}>{course.students}</Text>
          <Text style={s.cardStatLabel}>студентів</Text>
        </View>
        <View style={s.cardStatDivider} />
        <View style={s.cardStatItem}>
          <Text style={s.cardStatValue}>{course.totalLectures}</Text>
          <Text style={s.cardStatLabel}>лекцій</Text>
        </View>
        <View style={s.cardStatDivider} />
        <View style={s.cardStatItem}>
          <Text style={s.cardStatValue}>{course.totalPractices}</Text>
          <Text style={s.cardStatLabel}>практик</Text>
        </View>
        <View style={s.cardStatDivider} />
        <View style={s.cardStatItem}>
          <View style={s.cardBarTrack}>
            <View style={[s.cardBarFill, {
              width: `${course.avgAttendance}%` as any,
              backgroundColor: statusColor,
            }]} />
          </View>
          <Text style={[s.cardStatLabel, { color: statusColor }]}>явка</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        <Text style={s.cardOpenText}>Відкрити →</Text>
        {viewerRole === 'admin' && (
          <TouchableOpacity
            style={s.deleteActionBtn}
            onPress={(e) => { e.stopPropagation(); onDelete(course); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.deleteActionBtnText}>🗑️ Видалити</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CoursesManagementScreen({ viewerRole, HeaderComponent }: Props) {
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const [showCreate, setShowCreate] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const handleDelete = (course: Course) => setCourseToDelete(course);
  const confirmDelete = () => {
    if (courseToDelete) {
      setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
      setCourseToDelete(null);
    }
  };

  const subtitle = viewerRole === 'admin'
    ? `${courses.length} курсів у системі`
    : `${courses.length} активних курси`;
  const isAdmin = viewerRole === 'admin';

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <HeaderComponent
        title="Курси"
        subtitle={subtitle}
        rightAction={
          isAdmin 
            ? { icon: '＋', label: 'Новий курс', onPress: () => setShowCreate(true) } 
            : undefined
        }
      />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            viewerRole={viewerRole}
            onDelete={handleDelete}
          />
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>

      <CreateCourseModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        viewerRole={viewerRole}
      />

      {courseToDelete && (
        <DeleteConfirmModal
          course={courseToDelete}
          onConfirm={confirmDelete}
          onCancel={() => setCourseToDelete(null)}
        />
      )}
    </SafeAreaView>
  );
}
const C = {
  bg: '#12111A', surface: '#1C1B27',
  textPrimary: '#F0EEF8', textSecondary: '#9896B0',
  white: '#FFFFFF', divider: 'rgba(255,255,255,0.08)',
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  body: { padding: 20, gap: 16 },

  card: { backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' },
  cardBand: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  cardInitial: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', flexShrink: 0,
  },
  cardInitialText: { fontSize: 12, fontWeight: '900' },
  cardTitle: { color: C.white, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardGroup: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3 },
  cardTeacher: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 },
  cardPctBadge: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', flexShrink: 0,
  },
  cardPct: { fontSize: 13, fontWeight: '800' },

  cardStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  cardStatValue: { color: C.textPrimary, fontSize: 16, fontWeight: '700' },
  cardStatLabel: { color: C.textSecondary, fontSize: 10 },
  cardStatDivider: { width: 1, height: 28, backgroundColor: C.divider },
  cardBarTrack: {
    width: 50, height: 5, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden',
  },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardFooter: {
    borderTopWidth: 1, borderTopColor: C.divider,
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardOpenText: { color: '#7B88FF', fontSize: 12, fontWeight: '600' },
  deleteActionBtn: {
    backgroundColor: 'rgba(244,72,94,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  deleteActionBtnText: { color: '#F4485E', fontSize: 11, fontWeight: '700' },
});

const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1C1B27', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#F0EEF8', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  formGroup: { gap: 6, marginBottom: 14 },
  formRow: { flexDirection: 'row', gap: 12 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  fieldHint: { color: '#9896B0', fontSize: 10, marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#F0EEF8', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  hint: { color: '#9896B0', fontSize: 11, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  createBtn: {
    flex: 2, backgroundColor: '#5B4CFA', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  createBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  deleteCard: {
    position: 'absolute', top: '30%', left: 24, right: 24,
    backgroundColor: '#1C1B27', borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 10,
  },
  deleteIcon: { fontSize: 40, marginBottom: 4 },
  deleteTitle: { color: '#F0EEF8', fontSize: 18, fontWeight: '800' },
  deleteSub: { color: '#9896B0', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  deleteBtn: {
    flex: 2, backgroundColor: 'rgba(244,72,94,0.15)',
    borderWidth: 1, borderColor: '#F4485E',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { color: '#F4485E', fontSize: 14, fontWeight: '700' },
});