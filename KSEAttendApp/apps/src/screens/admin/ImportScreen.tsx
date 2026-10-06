import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth, API_BASE } from '../context/AuthContext';

interface Props {
  navigation: DrawerNavigationProp<any>;
}

type ImportStep = 'idle' | 'preview' | 'importing' | 'done' | 'error';

interface ParsedUser {
  id: string;
  name: string;
  email: string;
  valid: boolean;
  error?: string;
}

const PreviewRow = ({ user }: { user: ParsedUser }) => (
  <View style={[styles.previewRow, !user.valid && styles.previewRowInvalid]}>
    <View style={styles.previewRowLeft}>
      <View
        style={[
          styles.previewRowStatus,
          { backgroundColor: user.valid ? colors.accentGreen : colors.accentRed },
        ]}
      />
      <View style={styles.previewRowInfo}>
        <Text
          style={[styles.previewRowName, !user.valid && styles.previewRowNameInvalid]}
          numberOfLines={1}
        >
          {user.name || '(без імені)'}
        </Text>
        <Text style={styles.previewRowEmail}>{user.email}</Text>
      </View>
    </View>
    {user.error && (
      <View style={styles.previewRowError}>
        <Text style={styles.previewRowErrorText}>{user.error}</Text>
      </View>
    )}
  </View>
);

const ResultModal = ({
  imported,
  skipped,
  onClose,
}: {
  imported: number;
  skipped: number;
  onClose: () => void;
}) => (
  <Modal transparent animationType="fade" onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.modalOverlay} />
    </TouchableWithoutFeedback>
    <View style={styles.resultModal}>
      <Text style={styles.resultModalIcon}>✅</Text>
      <Text style={styles.resultModalTitle}>Імпорт завершено!</Text>
      <View style={styles.resultStats}>
        <View style={styles.resultStatItem}>
          <Text style={[styles.resultStatValue, { color: colors.accentGreen }]}>{imported}</Text>
          <Text style={styles.resultStatLabel}>Додано користувачів</Text>
        </View>
        {skipped > 0 && (
          <View style={styles.resultStatItem}>
            <Text style={[styles.resultStatValue, { color: colors.accentRed }]}>{skipped}</Text>
            <Text style={styles.resultStatLabel}>Пропущено (помилки)</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.resultCloseBtn} onPress={onClose}>
        <Text style={styles.resultCloseBtnText}>Готово</Text>
      </TouchableOpacity>
    </View>
  </Modal>
);

export default function ImportScreen({ navigation }: Props) {
  const { authHeader } = useAuth();
  
  const [step, setStep] = useState<ImportStep>('idle');
  const [showResult, setShowResult] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedUser[]>([]);
  
  const [stats, setStats] = useState({ imported: 0, skipped: 0 });

  const validCount = parsedData.filter((u) => u.valid).length;
  const invalidCount = parsedData.filter((u) => !u.valid).length;

  const parseCSV = (csvText: string): ParsedUser[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length < 2) throw new Error('Файл порожній або не містить даних.');
    const separator = lines[0].includes(';') ? ';' : ',';

    const headers = lines[0].toLowerCase().split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');

    if (nameIdx === -1 || emailIdx === -1) {
      throw new Error('CSV файл обов\'язково повинен містити заголовки "name" та "email" у першому рядку.');
    }

    const users: ParsedUser[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[nameIdx] || '';
      const email = cols[emailIdx] || '';

      let valid = true;
      let error = undefined;

      if (!name) { 
        valid = false; 
        error = "Відсутнє ім'я"; 
      } else if (!email || !email.includes('@')) { 
        valid = false; 
        error = "Невалідний email"; 
      }

      users.push({ id: String(i), name, email, valid, error });
    }
    return users;
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      const response = await fetch(file.uri);
      const text = await response.text();
      
      const parsedUsers = parseCSV(text);
      setParsedData(parsedUsers);
      setStep('preview');
      
    } catch (err: any) {
      Alert.alert('Помилка імпорту', err.message || 'Не вдалося прочитати файл. Переконайтеся, що це валідний CSV.');
      setStep('idle');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    
    let successCount = 0;
    let failCount = invalidCount; 
    
    const validUsers = parsedData.filter(u => u.valid);
    for (const user of validUsers) {
      try {
        const res = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader(),
          },
          body: JSON.stringify({ name: user.name, email: user.email }),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setStats({ imported: successCount, skipped: failCount });
    setStep('done');
    setShowResult(true);
  };

  const handleReset = () => {
    setStep('idle');
    setParsedData([]);
    setShowResult(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerBtn}>
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Імпорт користувачів</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 'idle' && (
          <>
            <View style={styles.formatCard}>
              <Text style={styles.formatCardTitle}>📄 Формат файлу (CSV)</Text>
              <View style={styles.formatTable}>
                <View style={styles.formatRow}>
                  <Text style={styles.formatHeader}>name</Text>
                  <Text style={styles.formatHeader}>email</Text>
                </View>
                <View style={styles.formatDivider} />
                <View style={styles.formatRow}>
                  <Text style={styles.formatCell}>Іванов Іван</Text>
                  <Text style={styles.formatCell}>ivan@kse.org.ua</Text>
                </View>
              </View>
              <Text style={styles.formatNote}>
                * Перший рядок обов'язково має містити заголовки "name" та "email". Робота підтримується як з комами, так і з крапками з комою.
              </Text>
            </View>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFile} activeOpacity={0.85}>
              <Text style={styles.uploadBtnIcon}>📂</Text>
              <Text style={styles.uploadBtnText}>Обрати файл</Text>
            </TouchableOpacity>
          </>
        )}
        
        {step === 'preview' && (
          <>
            <View style={styles.previewSummary}>
              <View style={styles.previewSummaryItem}>
                <Text style={[styles.previewSummaryValue, { color: colors.accentGreen }]}>
                  {validCount}
                </Text>
                <Text style={styles.previewSummaryLabel}>Готово до імпорту</Text>
              </View>
              {invalidCount > 0 && (
                <>
                  <View style={styles.previewSummaryDivider} />
                  <View style={styles.previewSummaryItem}>
                    <Text style={[styles.previewSummaryValue, { color: colors.accentRed }]}>
                      {invalidCount}
                    </Text>
                    <Text style={styles.previewSummaryLabel}>Помилки формату</Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Перегляд даних</Text>
              <View style={styles.previewList}>
                {parsedData.map((user, i) => (
                  <React.Fragment key={user.id}>
                    <PreviewRow user={user} />
                    {i < parsedData.length - 1 && <View style={styles.previewDivider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewCancelBtn}
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <Text style={styles.previewCancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewImportBtn, validCount === 0 && styles.previewImportBtnDisabled]}
                onPress={validCount > 0 ? handleImport : undefined}
                activeOpacity={0.85}
              >
                <Text style={styles.previewImportBtnText}>
                  Імпортувати {validCount} записів
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        
        {step === 'importing' && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Завантаження в базу...</Text>
            <Text style={styles.loadingSubtext}>
              Створюємо {validCount} користувачів у системі
            </Text>
          </View>
        )}
        
        {step === 'done' && !showResult && (
          <TouchableOpacity style={styles.uploadBtn} onPress={handleReset} activeOpacity={0.85}>
            <Text style={styles.uploadBtnText}>Новий імпорт</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      
      {showResult && (
        <ResultModal
          imported={stats.imported}
          skipped={stats.skipped}
          onClose={() => { setShowResult(false); handleReset(); }}
        />
      )}
    </SafeAreaView>
  );
}

const colors = {
  bg: '#12111A',
  surface: '#1C1B27',
  surfaceHigh: '#252436',
  textPrimary: '#F0EEF8',
  textSecondary: '#9896B0',
  accent: '#E0962B',
  accentGreen: '#23C97D',
  accentRed: '#F4485E',
  divider: 'rgba(255,255,255,0.08)',
  white: '#FFFFFF',
  badgeText: '#F4A72B',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  body: { padding: 20, gap: 20, paddingBottom: 40 },
  section: { gap: 12 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  formatCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  formatCardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  formatTable: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden' },
  formatRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 16 },
  formatHeader: { color: colors.badgeText, fontSize: 12, fontWeight: '700', flex: 1 },
  formatDivider: { height: 1, backgroundColor: colors.divider },
  formatCell: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  formatNote: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  uploadBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  uploadBtnIcon: { fontSize: 20 },
  uploadBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  previewSummary: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 14 },
  previewSummaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  previewSummaryValue: { fontSize: 24, fontWeight: '800' },
  previewSummaryLabel: { color: colors.textSecondary, fontSize: 11 },
  previewSummaryDivider: { width: 1, backgroundColor: colors.divider, marginVertical: 4 },
  previewList: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  previewRow: { paddingHorizontal: 16, paddingVertical: 12 },
  previewRowInvalid: { backgroundColor: 'rgba(244,72,94,0.05)' },
  previewRowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewRowStatus: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  previewRowInfo: { flex: 1, gap: 2 },
  previewRowName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  previewRowNameInvalid: { color: colors.textSecondary },
  previewRowEmail: { color: colors.textSecondary, fontSize: 11 },
  previewRowError: { backgroundColor: 'rgba(244,72,94,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start' },
  previewRowErrorText: { color: colors.accentRed, fontSize: 11, fontWeight: '600' },
  previewDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 32 },
  previewActions: { flexDirection: 'row', gap: 12 },
  previewCancelBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  previewCancelBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  previewImportBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  previewImportBtnDisabled: { opacity: 0.4 },
  previewImportBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  loadingState: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  loadingText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  loadingSubtext: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  resultModal: { position: 'absolute', top: '25%', left: 24, right: 24, backgroundColor: colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', gap: 16 },
  resultModalIcon: { fontSize: 44 },
  resultModalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  resultStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, width: '100%', paddingVertical: 16 },
  resultStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  resultStatValue: { fontSize: 28, fontWeight: '800' },
  resultStatLabel: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  resultCloseBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center' },
  resultCloseBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});