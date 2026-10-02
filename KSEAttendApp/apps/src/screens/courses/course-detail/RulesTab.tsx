import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

interface Rule {
  id: number;
  name: string;
  type: string;
  value: number;
}

interface RulesTabProps {
  courseId: number;
  viewerRole: 'teacher' | 'admin' | 'student'; 
}

const RULE_TYPES = [
  { key: 'minimum_percentage', label: 'Мінімальна явка (%)', hint: 'Поріг попередження про недопуск' },
  { key: 'streak_bonus', label: 'Серія відвідувань поспіль', hint: 'Ачівмент за N занять підряд' },
  { key: 'perfect_attendance', label: '100% відвідуваність', hint: 'Ачівмент за жодного пропуску' },
];

export default function RulesTab({ courseId, viewerRole }: RulesTabProps) {
  const { token } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('minimum_percentage');
  const [value, setValue] = useState('');
  
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  const canEdit = viewerRole === 'teacher' || viewerRole === 'admin';

  const fetchRules = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/courses/${courseId}/rules`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRules(data);
    } catch (e) {
      console.error('Помилка завантаження правил:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, [courseId, token]);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Помилка', 'Введіть назву');
      return;
    }

    let numValue = 1;
    if (type !== 'perfect_attendance') {
      if (!value.trim()) {
        Alert.alert('Помилка', 'Введіть значення');
        return;
      }
      numValue = parseFloat(value);
      if (isNaN(numValue)) {
        Alert.alert('Помилка', 'Значення має бути числом');
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/courses/${courseId}/rules`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, value: numValue }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не вдалося створити правило');
      }
      setShowAdd(false);
      setName('');
      setValue('');
      setType('minimum_percentage');
      fetchRules();
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    }
  };

  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    try {
      const res = await fetch(`${API_BASE_URL}/rules/${ruleToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Не вдалося видалити правило');
      fetchRules();
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setRuleToDelete(null);
    }
  };

  const typeLabel = (t: string) => {
    const found = RULE_TYPES.find(rt => rt.key === t);
    return found ? found.label : t;
  };

  const valueDisplay = (rule: Rule) => {
    if (rule.type === 'perfect_attendance') return '🏆';
    if (rule.type === 'minimum_percentage') return `${rule.value}%`;
    return `${rule.value} занять`;
  };

  if (loading) return <ActivityIndicator size="large" color="#5B4CFA" style={{ marginTop: 20 }} />;

  return (
    <View style={{ gap: 10 }}>
      {rules.length === 0 ? (
        <Text style={{ color: '#9896B0', textAlign: 'center', marginVertical: 20 }}>Правил ще не додано</Text>
      ) : (
        rules.map((rule) => (
          <View key={rule.id} style={s.ruleCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.ruleName}>{rule.name}</Text>
              <Text style={s.ruleType}>{typeLabel(rule.type)}</Text>
            </View>
            <Text style={s.ruleValue}>{valueDisplay(rule)}</Text>

            {canEdit && (
              <TouchableOpacity onPress={() => setRuleToDelete(rule)} style={s.deleteBtn}>
                <Text style={s.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {canEdit && (
        <>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addBtnText}>＋ Додати правило</Text>
          </TouchableOpacity>

          <Modal transparent animationType="slide" visible={showAdd} onRequestClose={() => setShowAdd(false)}>
            <TouchableWithoutFeedback onPress={() => setShowAdd(false)}>
              <View style={ms.overlay} />
            </TouchableWithoutFeedback>
            <View style={ms.sheet}>
              <View style={ms.handle} />
              <Text style={ms.title}>Нове правило</Text>

              <View style={ms.formGroup}>
                <Text style={ms.label}>Назва</Text>
                <TextInput
                  style={ms.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Мінімальна явка"
                  placeholderTextColor="#9896B0"
                />
              </View>

              <View style={ms.formGroup}>
                <Text style={ms.label}>Тип правила</Text>
                <View style={{ gap: 8 }}>
                  {RULE_TYPES.map((rt) => (
                    <TouchableOpacity
                      key={rt.key}
                      style={[
                        ms.typeOption,
                        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                        type === rt.key && { borderColor: '#5B4CFA', backgroundColor: 'rgba(91,76,250,0.1)' },
                      ]}
                      onPress={() => setType(rt.key)}
                    >
                      <View>
                        <Text style={{ color: type === rt.key ? '#7B88FF' : '#F0EEF8', fontWeight: '700' }}>{rt.label}</Text>
                        <Text style={{ color: '#9896B0', fontSize: 11, marginTop: 2 }}>{rt.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {type !== 'perfect_attendance' && (
                <View style={ms.formGroup}>
                  <Text style={ms.label}>
                    {type === 'minimum_percentage' ? 'Мінімальний відсоток' : 'Кількість занять підряд'}
                  </Text>
                  <TextInput
                    style={ms.input}
                    value={value}
                    onChangeText={setValue}
                    keyboardType="numeric"
                    placeholder={type === 'minimum_percentage' ? '75' : '5'}
                    placeholderTextColor="#9896B0"
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity style={ms.cancelBtn} onPress={() => setShowAdd(false)}>
                  <Text style={{ color: '#9896B0', fontWeight: '600' }}>Скасувати</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.createBtn} onPress={handleCreate}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Створити</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {ruleToDelete && (
            <Modal transparent animationType="fade" onRequestClose={() => setRuleToDelete(null)}>
              <TouchableWithoutFeedback onPress={() => setRuleToDelete(null)}>
                <View style={ds.overlay} />
              </TouchableWithoutFeedback>
              <View style={ds.deleteCard}>
                <Text style={ds.deleteIcon}>🗑️</Text>
                <Text style={ds.deleteTitle}>Видалити правило?</Text>
                <Text style={ds.deleteSub}>
                  Правило «{ruleToDelete.name}» буде видалено. Це може вплинути на автоматичне нарахування ачівментів.
                </Text>
                <View style={ds.btnRow}>
                  <TouchableOpacity style={ds.cancelBtn} onPress={() => setRuleToDelete(null)} activeOpacity={0.8}>
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
  ruleCard: { backgroundColor: '#1C1B27', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleName: { color: '#F0EEF8', fontSize: 14, fontWeight: '700' },
  ruleType: { color: '#9896B0', fontSize: 11, marginTop: 2 },
  ruleValue: { color: '#23C97D', fontSize: 15, fontWeight: '800' },
  
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(244,72,94,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  deleteBtnText: { color: '#F4485E', fontSize: 12, fontWeight: '700' },

  addBtn: { borderWidth: 1.5, borderColor: 'rgba(91,76,250,0.4)', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(91,76,250,0.06)' },
  addBtnText: { color: '#7B88FF', fontSize: 13, fontWeight: '600' },
});

const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1C1B27', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },
  title: { color: '#F0EEF8', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  formGroup: { gap: 6, marginBottom: 14 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#F0EEF8', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  typeOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtn: { flex: 2, backgroundColor: '#5B4CFA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
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