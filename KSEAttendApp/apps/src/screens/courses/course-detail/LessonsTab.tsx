import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, TextInput, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export type ViewerRole = 'teacher' | 'admin' | 'student';

interface Event {
  id: number;
  title: string;
  event_type: string;
  start_datetime: string;
  end_datetime: string;
  series_id: number | null;
}

interface LessonsTabProps {
  viewerRole: ViewerRole;
  events: Event[];
  refreshEvents: () => void;
  courseId: number;
  navigation: any;
  courseTitle: string;
  totalStudents: number;
}

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

const TYPE_COLOR: Record<string, string> = {
  'Лекція': '#7B88FF', 'Практика': '#23C97D', 'Лабораторна': '#F4A72B',
};

const formatEventDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];

    const dayName = days[d.getDay()];
    const dayNum = d.getDate();
    const monthName = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${dayName}, ${dayNum} ${monthName} · ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
};

export function LessonsTab({
  viewerRole,
  events,
  refreshEvents,
  courseId,
  navigation,
  courseTitle,
  totalStudents,
}: LessonsTabProps) {
  const { token } = useAuth();
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedType, setSelectedType] = useState('Лекція');
  const [eventTopic, setEventTopic] = useState('');

  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const now = new Date();
  const currentFormatDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentFormatTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [eventDate, setEventDate] = useState(currentFormatDate);
  const [eventTime, setEventTime] = useState(currentFormatTime);
  const [eventDuration, setEventDuration] = useState('80');

  const canEdit = viewerRole === 'teacher' || viewerRole === 'admin';
  const isTeacher = viewerRole === 'teacher';

  const handleAddEvent = async () => {
    if (!eventTopic.trim()) {
      Alert.alert('Помилка', 'Введіть назву заняття');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;

    if (!dateRegex.test(eventDate.trim()) || !timeRegex.test(eventTime.trim())) {
      Alert.alert('Помилка', 'Неправильний формат дати (РРРР-ММ-ДД) або часу (ЧЧ:ММ)');
      return;
    }

    const durationMin = parseInt(eventDuration, 10);
    if (isNaN(durationMin) || durationMin <= 0) {
      Alert.alert('Помилка', 'Введіть коректну тривалість пари');
      return;
    }

    try {
      const localStartString = `${eventDate.trim()}T${eventTime.trim()}:00`;
      const startDateTimeObj = new Date(localStartString);
      if (isNaN(startDateTimeObj.getTime())) {
        Alert.alert('Помилка', 'Неправильно введена дата або час');
        return;
      }
      const endDateTimeObj = new Date(startDateTimeObj.getTime() + durationMin * 60 * 1000);

      const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          course_id: courseId,
          title: eventTopic.trim(),
          event_type: selectedType,
          start_datetime: startDateTimeObj.toISOString(),
          end_datetime: endDateTimeObj.toISOString(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Не вдалося створити заняття');
      }

      setShowAddEvent(false);
      setEventTopic('');
      refreshEvents();
      Alert.alert('Успішно', 'Заняття додано в розклад');
    } catch (error: any) {
      Alert.alert('Помилка створення', error.message);
    }
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Не вдалося видалити заняття');
      }
      refreshEvents();
    } catch (error: any) {
      Alert.alert('Помилка видалення', error.message);
    } finally {
      setEventToDelete(null);
    }
  };

  const handleOpenQR = (event: Event) => {
    navigation.navigate('QRGenerator', {
      courseId: String(courseId),
      eventId: String(event.id),
      courseTitle,
      eventType: event.event_type,
      totalStudents,
    });
  };

  return (
    <View style={{ gap: 10 }}>
      {events.length === 0 ? (
        <Text style={{ color: '#9896B0', textAlign: 'center', marginVertical: 20 }}>Немає запланованих занять</Text>
      ) : (
        events.map((event) => {
          const color = TYPE_COLOR[event.event_type] || '#7B88FF';

          return (
            <View key={event.id} style={s.eventCard}>
              <View style={s.eventCardLeft}>
                <View style={[s.typeDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.eventType}>{event.event_type} - {event.title}</Text>
                  <Text style={s.eventDate}>{formatEventDate(event.start_datetime)}</Text>
                </View>
              </View>
              <View style={s.eventCardRight}>
                <View style={s.eventBtns}>
                  {isTeacher && (
                    <TouchableOpacity style={s.qrBtn} onPress={() => handleOpenQR(event)}>
                      <Text style={s.qrBtnText}>📱 QR</Text>
                    </TouchableOpacity>
                  )}
                  {canEdit && (
                    <TouchableOpacity style={s.deleteBtn} onPress={() => setEventToDelete(event)}>
                      <Text style={s.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}

      {canEdit && (
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddEvent(true)}>
          <Text style={s.addBtnText}>＋ Додати заняття</Text>
        </TouchableOpacity>
      )}

      {canEdit && (
        <>
          <Modal transparent animationType="slide" visible={showAddEvent} onRequestClose={() => setShowAddEvent(false)}>
            <TouchableWithoutFeedback onPress={() => setShowAddEvent(false)}>
              <View style={ms.overlay} />
            </TouchableWithoutFeedback>
            <View style={ms.sheet}>
              <View style={ms.handle} />
              <Text style={ms.title}>Нове заняття</Text>
              <Text style={ms.sub}>Створення та планування пари в розкладі курсу</Text>

              <View style={ms.formGroup}>
                <Text style={ms.label}>Тип заняття</Text>
                <View style={ms.typeRow}>
                  {['Лекція', 'Практика'].map((type) => {
                    const isSelected = selectedType === type;
                    const typeColor = TYPE_COLOR[type] || '#7B88FF';
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          ms.typeOption,
                          isSelected && { backgroundColor: `${typeColor}15`, borderColor: typeColor },
                        ]}
                        onPress={() => setSelectedType(type)}
                      >
                        <Text style={[ms.typeOptionText, isSelected && { color: typeColor, fontWeight: '700' }]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={ms.formGroup}>
                <Text style={ms.label}>Тема заняття</Text>
                <TextInput
                  style={ms.input}
                  value={eventTopic}
                  onChangeText={setEventTopic}
                  placeholder="Наприклад: Симетричне шифрування. Алгоритм AES"
                  placeholderTextColor="#9896B0"
                />
              </View>

              <View style={ms.formRow}>
                <View style={[ms.formGroup, { flex: 2 }]}>
                  <Text style={ms.label}>Дата (РРРР-ММ-ДД)</Text>
                  <TextInput
                    style={ms.input}
                    value={eventDate}
                    onChangeText={setEventDate}
                    placeholder="2026-07-11"
                    placeholderTextColor="#9896B0"
                  />
                </View>
                <View style={[ms.formGroup, { flex: 1 }]}>
                  <Text style={ms.label}>Час (ЧЧ:ММ)</Text>
                  <TextInput
                    style={ms.input}
                    value={eventTime}
                    onChangeText={setEventTime}
                    placeholder="10:30"
                    placeholderTextColor="#9896B0"
                  />
                </View>
              </View>

              <View style={ms.formGroup}>
                <Text style={ms.label}>Тривалість (у хвилинах)</Text>
                <TextInput
                  style={ms.input}
                  value={eventDuration}
                  onChangeText={setEventDuration}
                  keyboardType="numeric"
                  placeholder="80"
                  placeholderTextColor="#9896B0"
                />
              </View>

              <View style={ms.btnRow}>
                <TouchableOpacity style={ms.cancelBtn} onPress={() => setShowAddEvent(false)}>
                  <Text style={ms.cancelBtnText}>Скасувати</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.createBtn} onPress={handleAddEvent}>
                  <Text style={ms.createBtnText}>Зберегти в БД</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {eventToDelete && (
            <Modal transparent animationType="fade" onRequestClose={() => setEventToDelete(null)}>
              <TouchableWithoutFeedback onPress={() => setEventToDelete(null)}>
                <View style={ds.overlay} />
              </TouchableWithoutFeedback>
              <View style={ds.deleteCard}>
                <Text style={ds.deleteIcon}>🗑️</Text>
                <Text style={ds.deleteTitle}>Видалити заняття?</Text>
                <Text style={ds.deleteSub}>
                  «{eventToDelete.event_type} - {eventToDelete.title}» та всю пов'язану історію відвідуваності буде видалено безповоротно.
                </Text>
                <View style={ds.btnRow}>
                  <TouchableOpacity style={ds.cancelBtn} onPress={() => setEventToDelete(null)} activeOpacity={0.8}>
                    <Text style={ds.cancelBtnText}>Скасувати</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={ds.deleteBtn} onPress={confirmDelete} activeOpacity={0.8}>
                    <Text style={ds.deleteBtnText}>Видалити</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  eventCard: { backgroundColor: '#1C1B27', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  eventType: { color: '#F0EEF8', fontSize: 12, fontWeight: '700' },
  eventDate: { color: '#9896B0', fontSize: 10, marginTop: 1 },
  eventCardRight: { alignItems: 'flex-end' },
  eventBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  qrBtn: { backgroundColor: 'rgba(91,76,250,0.25)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  qrBtnText: { color: '#7B88FF', fontSize: 12, fontWeight: '700' },
  addBtn: { borderWidth: 1.5, borderColor: 'rgba(91,76,250,0.4)', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(91,76,250,0.06)', marginTop: 10 },
  addBtnText: { color: '#7B88FF', fontSize: 13, fontWeight: '600' },
  
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(244,72,94,0.12)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#F4485E', fontSize: 12, fontWeight: '700' },
});

const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1B27', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  title: { color: '#F0EEF8', fontSize: 18, fontWeight: '800' },
  sub: { color: '#9896B0', fontSize: 12, marginBottom: 16 },
  formGroup: { gap: 6, marginBottom: 14 },
  formRow: { flexDirection: 'row', gap: 12 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#F0EEF8', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  createBtn: { flex: 2, backgroundColor: '#5B4CFA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  typeOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  typeOptionText: { color: '#9896B0', fontSize: 13, fontWeight: '500' },
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