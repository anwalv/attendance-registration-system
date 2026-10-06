import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableWithoutFeedback, TouchableOpacity, TextInput, Alert, ScrollView,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../screens/context/AuthContext';

interface CreateCourseModalProps {
  visible: boolean;
  onClose: () => void;
  viewerRole: 'teacher' | 'admin';
  onCourseCreated: () => void;
}

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

interface PickedFile {
  name: string;
  content: string;
}

const readFileContent = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return await response.text();
  }
  return await FileSystem.readAsStringAsync(uri, {
    encoding: 'utf8',
  });
};

export default function CreateCourseModal({ visible, onClose, viewerRole, onCourseCreated }: CreateCourseModalProps) {
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('Осінь 2026');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const [icalFile, setIcalFile] = useState<PickedFile | null>(null);
  const [csvFile, setCsvFile] = useState<PickedFile | null>(null);
  const [pickingIcal, setPickingIcal] = useState(false);
  const [pickingCsv, setPickingCsv] = useState(false);

  const resetForm = () => {
    setTitle('');
    setTerm('Осінь 2026');
    setIcalFile(null);
    setCsvFile(null);
  };

  const pickFile = async (
    mimeTypes: string[],
    setter: (f: PickedFile | null) => void,
    setPicking: (b: boolean) => void,
    expectedExt: string,
  ) => {
    try {
      setPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      if (expectedExt && !asset.name.toLowerCase().endsWith(expectedExt)) {
        Alert.alert('Невірний формат', `Очікується файл з розширенням ${expectedExt}`);
        return;
      }

      const content = await readFileContent(asset.uri);

      setter({ name: asset.name, content });
    } catch (e: any) {
      Alert.alert('Помилка вибору файлу', e.message ?? 'Невідома помилка');
    } finally {
      setPicking(false);
    }
  };

  const pickIcal = () => pickFile(
    ['text/calendar', 'application/octet-stream', '*/*'],
    setIcalFile,
    setPickingIcal,
    '.ics',
  );

  const pickCsv = () => pickFile(
    ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
    setCsvFile,
    setPickingCsv,
    '.csv',
  );

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Помилка', 'Будь ласка, вкажіть назву курсу');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/courses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: title,
          term: term,
          teacher_ids: [],
          student_ids: [],
          ical_content: icalFile?.content ?? undefined,
          members_csv: csvFile?.content ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('Помилка від бекенду (400):', JSON.stringify(data));
        throw new Error(data.error || 'Не вдалося створити курс');
      }

      const importedEvents = data.events_imported ?? 0;
      const importedMembers = data.members_imported
        ? (data.members_imported.student ?? 0) + (data.members_imported.teacher ?? 0)
        : 0;

      let successMessage = 'Новий курс успішно внесено до бази даних';
      if (importedEvents > 0 || importedMembers > 0) {
        successMessage += `\n\nІмпортовано: ${importedEvents} занять, ${importedMembers} учасників`;
      }

      Alert.alert('Успіх', successMessage);
      onCourseCreated();
      resetForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Помилка сервера', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={ms.overlay} />
      </TouchableWithoutFeedback>
      <View style={ms.sheet}>
        <View style={ms.handle} />
        <Text style={ms.sheetTitle}>Новий курс</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View style={ms.formGroup}>
            <Text style={ms.label}>Назва курсу *</Text>
            <TextInput
              style={ms.input} value={title} onChangeText={setTitle}
              placeholder="Наприклад: Криптографічні Системи Безпеки"
              placeholderTextColor="#9896B0"
            />
          </View>

          <View style={ms.formGroup}>
            <Text style={ms.label}>Семестр / Термін</Text>
            <TextInput
              style={ms.input} value={term} onChangeText={setTerm}
              placeholder="Осінь 2026" placeholderTextColor="#9896B0"
            />
          </View>

          <View style={ms.formGroup}>
            <Text style={ms.label}>Розклад занять (iCal)</Text>
            <TouchableOpacity style={ms.filePickerBtn} onPress={pickIcal} disabled={pickingIcal || loading}>
              <Text style={ms.filePickerIcon}>📅</Text>
              <Text style={ms.filePickerText} numberOfLines={1}>
                {icalFile ? icalFile.name : pickingIcal ? 'Завантаження...' : 'Обрати .ics файл'}
              </Text>
              {icalFile && (
                <TouchableOpacity onPress={() => setIcalFile(null)} style={ms.fileClearBtn}>
                  <Text style={ms.fileClearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={ms.formGroup}>
            <Text style={ms.label}>Учасники курсу (CSV)</Text>
            <TouchableOpacity style={ms.filePickerBtn} onPress={pickCsv} disabled={pickingCsv || loading}>
              <Text style={ms.filePickerIcon}>👥</Text>
              <Text style={ms.filePickerText} numberOfLines={1}>
                {csvFile ? csvFile.name : pickingCsv ? 'Завантаження...' : 'Обрати .csv файл'}
              </Text>
              {csvFile && (
                <TouchableOpacity onPress={() => setCsvFile(null)} style={ms.fileClearBtn}>
                  <Text style={ms.fileClearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <Text style={ms.hint}>Формат: name,email,role (role = student або teacher)</Text>
          </View>
        </ScrollView>

        <View style={ms.btnRow}>
          <TouchableOpacity style={ms.cancelBtn} onPress={handleClose} disabled={loading}>
            <Text style={ms.cancelBtnText}>Скасувати</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ms.createBtn} onPress={handleCreate} disabled={loading}>
            <Text style={ms.createBtnText}>{loading ? 'Збереження...' : 'Створити курс'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1B27', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#F0EEF8', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  formGroup: { gap: 6, marginBottom: 14 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#F0EEF8', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  hint: { color: 'rgba(152,150,176,0.7)', fontSize: 11, marginTop: 2 },

  filePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
  },
  filePickerIcon: { fontSize: 16 },
  filePickerText: { flex: 1, color: '#F0EEF8', fontSize: 13, fontWeight: '500' },
  fileClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(244,72,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  fileClearBtnText: { color: '#F4485E', fontSize: 11, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  createBtn: { flex: 1, backgroundColor: '#5B4CFA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
});