import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator,
  Platform, TouchableWithoutFeedback
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

export interface CourseMember {
  id: string;
  name: string;
  email: string;
}
export type ViewerRole = 'teacher' | 'admin' | 'student';

interface Props {
  courseId: number;
  teachers: CourseMember[];
  students: CourseMember[];
  loading: boolean;
  onRefresh: () => void;
  viewerRole: ViewerRole;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function MemberRow({ member, roleColor, onDelete, canEdit }: { member: CourseMember; roleColor: string; onDelete: () => void; canEdit: boolean; }) {
  return (
    <View style={s.memberRow}>
      <View style={[s.memberInitial, { backgroundColor: `${roleColor}22` }]}>
        <Text style={[s.memberInitialText, { color: roleColor }]}>{getInitials(member.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.memberName} numberOfLines={1}>{member.name}</Text>
        <Text style={s.memberEmail} numberOfLines={1}>{member.email}</Text>
      </View>
      
      {canEdit && (
        <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Text style={s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AddMemberModal({
  visible, onClose, onSubmit, submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, name: string, role: 'student' | 'teacher') => void;
  submitting: boolean;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');

  const handleSubmit = () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Помилка', 'Вкажіть коректний email');
      return;
    }
    onSubmit(email.trim(), name.trim(), role);
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setRole('student');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Додати учасника</Text>

          <View style={m.formGroup}>
            <Text style={m.label}>Email *</Text>
            <TextInput
              style={m.input} value={email} onChangeText={setEmail}
              placeholder="student@kse.org.ua" placeholderTextColor="#9896B0"
              autoCapitalize="none" keyboardType="email-address"
            />
          </View>

          <View style={m.formGroup}>
            <Text style={m.label}>Ім'я (опціонально)</Text>
            <TextInput
              style={m.input} value={name} onChangeText={setName}
              placeholder="Іван Іваненко" placeholderTextColor="#9896B0"
            />
          </View>

          <View style={m.formGroup}>
            <Text style={m.label}>Роль у курсі</Text>
            <View style={m.roleRow}>
              <TouchableOpacity
                style={[m.rolePill, role === 'student' && m.rolePillActiveStudent]}
                onPress={() => setRole('student')}
                activeOpacity={0.8}
              >
                <Text style={[m.rolePillText, role === 'student' && m.rolePillTextActive]}>Студент</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.rolePill, role === 'teacher' && m.rolePillActiveTeacher]}
                onPress={() => setRole('teacher')}
                activeOpacity={0.8}
              >
                <Text style={[m.rolePillText, role === 'teacher' && m.rolePillTextActive]}>Викладач</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={handleClose} disabled={submitting}>
              <Text style={m.cancelBtnText}>Скасувати</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.submitBtn} onPress={handleSubmit} disabled={submitting}>
              <Text style={m.submitBtnText}>{submitting ? 'Додавання...' : 'Додати'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ParticipantsTab({ courseId, teachers, students, loading, onRefresh, viewerRole }: Props) {
  const { token } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<CourseMember | null>(null);

  const canEdit = viewerRole === 'teacher' || viewerRole === 'admin';

  const handleAddMember = async (email: string, name: string, role: 'student' | 'teacher') => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/courses/${courseId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося додати учасника');

      setModalVisible(false);
      onRefresh();
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Помилка: ${e.message}`);
      } else {
        Alert.alert('Помилка', e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/courses/${courseId}/members/${memberToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося видалити учасника');
      
      onRefresh();
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Помилка: ${e.message}`);
      } else {
        Alert.alert('Помилка', e.message);
      }
    } finally {
      setMemberToDelete(null);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#5B4CFA" style={{ marginTop: 30 }} />;
  }

  return (
    <View style={{ gap: 16 }}>
      
      {canEdit && (
        <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Text style={s.addBtnText}>＋ Додати учасника</Text>
        </TouchableOpacity>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Викладачі ({teachers.length})</Text>
        {teachers.length > 0 ? (
          teachers.map((t) => (
            <MemberRow 
              key={t.id} 
              member={t} 
              roleColor="#23C97D" 
              onDelete={() => setMemberToDelete(t)} 
              canEdit={canEdit}
            />
          ))
        ) : (
          <Text style={s.emptyText}>Викладачів ще немає</Text>
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Студенти ({students.length})</Text>
        {students.length > 0 ? (
          students.map((st) => (
            <MemberRow 
              key={st.id} 
              member={st} 
              roleColor="#7B88FF" 
              onDelete={() => setMemberToDelete(st)} 
              canEdit={canEdit}
            />
          ))
        ) : (
          <Text style={s.emptyText}>Студентів ще немає</Text>
        )}
      </View>

      {canEdit && (
        <AddMemberModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSubmit={handleAddMember}
          submitting={submitting}
        />
      )}

      {canEdit && memberToDelete && (
        <Modal transparent animationType="fade" onRequestClose={() => setMemberToDelete(null)}>
          <TouchableWithoutFeedback onPress={() => setMemberToDelete(null)}>
            <View style={ds.overlay} />
          </TouchableWithoutFeedback>
          <View style={ds.deleteCard}>
            <Text style={ds.deleteIcon}>🗑️</Text>
            <Text style={ds.deleteTitle}>Видалити учасника?</Text>
            <Text style={ds.deleteSub}>
              «{memberToDelete.name}» буде видалено з цього курсу. Вся статистика відвідуваності може бути втрачена.
            </Text>
            <View style={ds.btnRow}>
              <TouchableOpacity style={ds.cancelBtn} onPress={() => setMemberToDelete(null)} activeOpacity={0.8}>
                <Text style={ds.cancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ds.deleteBtn} onPress={confirmDelete} activeOpacity={0.8}>
                <Text style={ds.deleteBtnText}>Видалити</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const C = { bg: '#12111A', surface: '#1C1B27', textPrimary: '#F0EEF8', textSecondary: '#9896B0', divider: 'rgba(255,255,255,0.08)' };

const s = StyleSheet.create({
  addBtn: { backgroundColor: '#5B4CFA', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  section: { gap: 10 },
  sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  emptyText: { color: C.textSecondary, fontSize: 12, fontStyle: 'italic' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12 },
  memberInitial: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  memberInitialText: { fontSize: 12, fontWeight: '800' },
  memberName: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  memberEmail: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(244,72,94,0.12)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#F4485E', fontSize: 12, fontWeight: '700' },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1B27', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  title: { color: '#F0EEF8', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  formGroup: { gap: 6, marginBottom: 14 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#F0EEF8', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  roleRow: { flexDirection: 'row', gap: 10 },
  rolePill: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent' },
  rolePillActiveStudent: { backgroundColor: 'rgba(123,136,255,0.15)', borderColor: '#7B88FF' },
  rolePillActiveTeacher: { backgroundColor: 'rgba(35,201,125,0.15)', borderColor: '#23C97D' },
  rolePillText: { color: '#9896B0', fontSize: 13, fontWeight: '600' },
  rolePillTextActive: { color: '#F0EEF8' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#5B4CFA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

const ds = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  deleteCard: { position: 'absolute', top: '35%', left: 24, right: 24, backgroundColor: '#1C1B27', borderRadius: 24, padding: 24, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  deleteIcon: { fontSize: 40, marginBottom: 4 },
  deleteTitle: { color: '#F0EEF8', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  deleteSub: { color: '#9896B0', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  deleteBtn: { flex: 1, backgroundColor: 'rgba(244,72,94,0.15)', borderWidth: 1, borderColor: '#F4485E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { color: '#F4485E', fontSize: 14, fontWeight: '700' },
});