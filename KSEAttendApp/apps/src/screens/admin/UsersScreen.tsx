import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useAuth, API_BASE } from '../context/AuthContext';

type CourseRole = 'student' | 'teacher' | 'admin';
type RoleFilter = 'all' | 'admin' | 'student' | 'teacher';

interface CourseEnrollment {
  courseId: string;
  courseTitle: string;
  role: CourseRole;
}

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  enrollments: CourseEnrollment[];
}

interface Props {
  navigation: DrawerNavigationProp<any>;
}

const COURSE_ROLE_COLORS: Record<CourseRole, string> = {
  student: '#7B88FF',
  teacher: '#23C97D',
  admin: '#F4A72B', 
};

const COURSE_ROLE_BG: Record<CourseRole, string> = {
  student: 'rgba(123,136,255,0.15)',
  teacher: 'rgba(35,201,125,0.15)',
  admin: 'rgba(244,167,43,0.15)',
};

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map((n) => n[0] || '').join('').toUpperCase();

const getUserCourseRole = (user: User): 'none' | 'student' | 'teacher' | 'both' => {
  const hasStudent = user.enrollments.some((e) => e.role === 'student');
  const hasTeacher = user.enrollments.some((e) => e.role === 'teacher');

  if (hasStudent && hasTeacher) return 'both';
  if (hasStudent) return 'student';
  if (hasTeacher) return 'teacher';
  return 'none';
};

const getAvatarColor = (user: User): string => {
  if (user.isAdmin) return '#F4A72B';
  const role = getUserCourseRole(user);
  if (role === 'teacher') return '#23C97D';
  if (role === 'both') return '#B37BFF';
  return '#7B88FF';
};

const FilterTab = ({ label, active, count, onPress }: { label: string; active: boolean; count: number; onPress: () => void; }) => (
  <TouchableOpacity
    style={[styles.filterTab, active && styles.filterTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
      {label}
    </Text>
    <View style={[styles.filterTabCount, active && styles.filterTabCountActive]}>
      <Text style={[styles.filterTabCountText, active && styles.filterTabCountTextActive]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

const UserDetailModal = ({ 
  user, 
  onClose, 
  onMakeAdmin, 
  onRemoveAdmin,
  onDelete 
}: { 
  user: User; 
  onClose: () => void; 
  onMakeAdmin: (userId: string) => void; 
  onRemoveAdmin: (userId: string) => void; 
  onDelete: (user: User) => void; 
}) => {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <View style={styles.modalSheetWrapper}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalUserHeader}>
            <View style={[styles.modalAvatar, { backgroundColor: getAvatarColor(user) }]}>
              <Text style={styles.modalAvatarText}>{getInitials(user.name)}</Text>
            </View>
            <View style={styles.modalUserInfo}>
              <Text style={styles.modalUserName}>{user.name}</Text>
              <Text style={styles.modalUserEmail}>{user.email}</Text>
              {user.isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>АДМІНІСТРАТОР</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.modalDivider} />
          
          {user.enrollments.length > 0 ? (
            <>
              <Text style={styles.modalSectionLabel}>УЧАСТЬ У КУРСАХ</Text>
              <ScrollView style={styles.enrollmentsList} showsVerticalScrollIndicator={false}>
                {user.enrollments.map((e) => (
                  <View key={e.courseId} style={styles.enrollmentRow}>
                    <Text style={styles.enrollmentTitle} numberOfLines={1}>
                      {e.courseTitle}
                    </Text>
                    <View style={[styles.enrollmentRoleBadge, { backgroundColor: COURSE_ROLE_BG[e.role], borderColor: `${COURSE_ROLE_COLORS[e.role]}55` }]}>
                      <Text style={[styles.enrollmentRoleText, { color: COURSE_ROLE_COLORS[e.role] }]}>
                        {e.role === 'student' ? 'Студент' : e.role === 'teacher' ? 'Викладач' : 'Адмін'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.modalDivider} />
            </>
          ) : (
            <>
              <Text style={styles.noEnrollmentsText}>Не записаний на жоден курс</Text>
              <View style={styles.modalDivider} />
            </>
          )}

          <TouchableOpacity
            style={[styles.modalActionBtn, user.isAdmin ? styles.modalActionRemoveAdmin : styles.modalActionMakeAdmin]}
            onPress={() => {
              user.isAdmin ? onRemoveAdmin(user.id) : onMakeAdmin(user.id);
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.modalActionBtnText, { color: user.isAdmin ? '#F4485E' : '#F4A72B' }]}>
              {user.isAdmin ? 'Забрати права адміна' : 'Надати права адміна'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.modalActionDeleteBtn} 
            onPress={() => onDelete(user)}
            activeOpacity={0.85}
          >
            <Text style={styles.modalActionDeleteBtnText}>Видалити користувача</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseBtnText}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const UserRow = ({ user, onPress }: { user: User; onPress: () => void }) => {
  const courseRole = getUserCourseRole(user);

  return (
    <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(user) }]}>
        <Text style={styles.userAvatarText}>{getInitials(user.name)}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        {user.enrollments.length > 0 && (
          <Text style={styles.userCourseCount}>
            {user.enrollments.length} {user.enrollments.length === 1 ? 'курс' : 'курси'}
          </Text>
        )}
      </View>
      <View style={styles.badgesCol}>
        {user.isAdmin && (
          <View style={styles.adminRoleBadge}>
            <Text style={styles.adminRoleBadgeText}>Адмін</Text>
          </View>
        )}
        {(courseRole === 'student' || courseRole === 'both') && (
          <View style={[styles.roleBadge, { backgroundColor: COURSE_ROLE_BG['student'], borderColor: `${COURSE_ROLE_COLORS['student']}44` }]}>
            <Text style={[styles.roleBadgeText, { color: COURSE_ROLE_COLORS['student'] }]}>Студент</Text>
          </View>
        )}
        {(courseRole === 'teacher' || courseRole === 'both') && (
          <View style={[styles.roleBadge, { backgroundColor: COURSE_ROLE_BG['teacher'], borderColor: `${COURSE_ROLE_COLORS['teacher']}44` }]}>
            <Text style={[styles.roleBadgeText, { color: COURSE_ROLE_COLORS['teacher'] }]}>Викладач</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function UsersScreen({ navigation }: Props) {
  const { token, authHeader } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState({ all: 0, student: 0, teacher: 0, admin: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [filter, setFilter] = useState<RoleFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fetchUsers = useCallback(async (loadPage: number, append: boolean) => {
    if (!token) return;
    
    if (append) setIsLoadingMore(true); 
    else setIsLoading(true);
    
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(loadPage),
        limit: '20',
        role: filter,
      });
      if (search) params.set('search', search);

      const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Помилка сервера: ${response.status}`);
      }

      const mappedUsers: User[] = (data.users || []).map((backendUser: any) => ({
        id: String(backendUser.id),
        name: backendUser.name,
        email: backendUser.email,
        isAdmin: backendUser.role === 'admin',
        enrollments: (backendUser.courses || []).map((course: any) => ({
          courseId: String(course.course_id),
          courseTitle: course.course_name,
          role: course.role as CourseRole,
        })),
      }));

      setUsers((prev) => append ? [...prev, ...mappedUsers] : mappedUsers);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalRecords(data.totalRecords);
      setCounts(data.counts);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Не вдалося завантажити користувачів');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [token, authHeader, filter, search]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (token) {
      fetchUsers(1, false);
    }
  }, [token, filter, search, fetchUsers]);

  const handleMakeAdmin = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/make-admin`, {
        method: 'PATCH',
        headers: { ...authHeader() },
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin: true } : u)));
    } catch (err) {
      Alert.alert('Помилка', 'Не вдалося надати права адміністратора');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/remove-admin`, {
        method: 'PATCH',
        headers: { ...authHeader() },
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin: false } : u)));
    } catch (err) {
      Alert.alert('Помилка', 'Не вдалося забрати права адміністратора');
    }
  };

  const handleCreateUser = async () => {
    const name = addName.trim();
    const email = addEmail.trim();
    if (!name || !email || !token || isCreating) return;

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ name, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не вдалося створити користувача');
      
      await fetchUsers(1, false);
      closeAddModal();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Помилка', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setAddName('');
    setAddEmail('');
    setIsCreating(false);
  };

  const initiateDeleteUser = (user: User) => {
    setSelectedUser(null);
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { ...authHeader() },
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не вдалося видалити користувача');
      }
      
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setTotalRecords((prev) => prev - 1);
      
    } catch (err: any) {
      Alert.alert('Помилка', err.message);
    } finally {
      setUserToDelete(null);
    }
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
        <Text style={styles.headerTitle}>Користувачі</Text>
        
        <View style={styles.headerActions}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalRecords}</Text>
          </View>
          <TouchableOpacity style={styles.addUserBtn} onPress={() => setIsAddModalOpen(true)}>
            <Text style={styles.addUserBtnText}>➕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Пошук за ім'ям або email..."
          placeholderTextColor={colors.textSecondary}
          value={searchInput}
          onChangeText={setSearchInput}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => setSearchInput('')}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexGrow: 0, paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
          <FilterTab label="Всі" active={filter === 'all'} count={counts.all} onPress={() => setFilter('all')} />
          <FilterTab label="Студенти" active={filter === 'student'} count={counts.student} onPress={() => setFilter('student')} />
          <FilterTab label="Викладачі" active={filter === 'teacher'} count={counts.teacher} onPress={() => setFilter('teacher')} />
          <FilterTab label="Адміністратори" active={filter === 'admin'} count={counts.admin} onPress={() => setFilter('admin')} />
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {isLoading && page === 1 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.emptyStateText, { marginTop: 12 }]}>Завантаження користувачів...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>⚠️</Text>
            <Text style={[styles.emptyStateText, { color: '#F4485E', textAlign: 'center' }]}>{error}</Text>
            <TouchableOpacity onPress={() => fetchUsers(1, false)} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Спробувати ще раз</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🔍</Text>
            <Text style={[styles.emptyStateText, { textAlign: 'center' }]}>Нікого не знайдено</Text>
          </View>
        ) : (
          <>
            <View style={styles.listCard}>
              {users.map((user, i) => (
                <React.Fragment key={user.id}>
                  <UserRow user={user} onPress={() => setSelectedUser(user)} />
                  {i < users.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}
            </View>
            
            <Text style={styles.paginationInfo}>
              Показано {users.length} з {totalRecords} · сторінка {page} з {totalPages}
            </Text>

            {page < totalPages && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => fetchUsers(page + 1, true)}
                disabled={isLoadingMore}
                activeOpacity={0.8}
              >
                {isLoadingMore ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.loadMoreBtnText}>Завантажити ще</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onMakeAdmin={handleMakeAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onDelete={initiateDeleteUser}
        />
      )}

      {userToDelete && (
        <Modal transparent animationType="fade" onRequestClose={() => setUserToDelete(null)}>
          <TouchableWithoutFeedback onPress={() => setUserToDelete(null)}>
            <View style={ds.overlay} />
          </TouchableWithoutFeedback>
          <View style={ds.deleteCard}>
            <Text style={ds.deleteIcon}>🗑️</Text>
            <Text style={ds.deleteTitle}>Видалити користувача?</Text>
            <Text style={ds.deleteSub}>
              «{userToDelete.name}» буде видалено з системи назавжди. Всі дані та участь у курсах будуть втрачені.
            </Text>
            <View style={ds.btnRow}>
              <TouchableOpacity style={ds.cancelBtn} onPress={() => setUserToDelete(null)} activeOpacity={0.8}>
                <Text style={ds.cancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ds.deleteBtn} onPress={confirmDeleteUser} activeOpacity={0.8}>
                <Text style={ds.deleteBtnText}>Видалити</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={isAddModalOpen} transparent animationType="slide" onRequestClose={closeAddModal}>
        <TouchableWithoutFeedback onPress={closeAddModal}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalSheetWrapper}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.addModalTitle}>Додати користувача</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ім'я та Прізвище</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Введіть ім'я..."
                placeholderTextColor={colors.textSecondary}
                value={addName}
                onChangeText={setAddName}
                editable={!isCreating}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Електронна пошта</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Введіть email..."
                placeholderTextColor={colors.textSecondary}
                value={addEmail}
                onChangeText={setAddEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isCreating}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.modalActionBtn,
                styles.createActionBtn,
                (!addName.trim() || !addEmail.trim() || isCreating) && styles.createActionBtnDisabled,
              ]}
              onPress={handleCreateUser}
              disabled={!addName.trim() || !addEmail.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.modalActionBtnText, { color: colors.white }]}>Створити користувача</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeAddModal} disabled={isCreating}>
              <Text style={styles.modalCloseBtnText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  badgeBg: '#3D2A0F',
  badgeText: '#F4A72B',
  divider: 'rgba(255,255,255,0.08)',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: { width: 22, height: 2, backgroundColor: colors.textPrimary, borderRadius: 2, marginVertical: 2 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBadge: { backgroundColor: colors.badgeBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: colors.badgeText, fontSize: 13, fontWeight: '700' },
  addUserBtn: { backgroundColor: 'rgba(255,255,255,0.1)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addUserBtnText: { fontSize: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 20, marginBottom: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  searchClear: { color: colors.textSecondary, fontSize: 14, padding: 4 },
  filterTabs: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterTab: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterTabActive: { backgroundColor: colors.badgeBg },
  filterTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: colors.badgeText },
  filterTabCount: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  filterTabCountActive: { backgroundColor: 'rgba(244,167,43,0.2)' },
  filterTabCountText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  filterTabCountTextActive: { color: colors.badgeText },
  list: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  listCard: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 68 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  userInfo: { flex: 1, gap: 1 },
  userName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  userEmail: { color: colors.textSecondary, fontSize: 11 },
  userCourseCount: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },
  badgesCol: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  adminRoleBadge: { backgroundColor: 'rgba(244,167,43,0.12)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244,167,43,0.4)', paddingHorizontal: 8, paddingVertical: 3 },
  adminRoleBadgeText: { color: '#F4A72B', fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 16, gap: 10 },
  emptyStateIcon: { fontSize: 36 },
  emptyStateText: { color: colors.textSecondary, fontSize: 14 },
  paginationInfo: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 14 },
  loadMoreBtn: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  loadMoreBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  addModalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20, marginTop: 10 },
  inputGroup: { marginHorizontal: 20, marginBottom: 16 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  textInput: { backgroundColor: colors.surfaceHigh, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15 },
  modalUserHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  modalAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalUserInfo: { flex: 1, gap: 3 },
  modalUserName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  modalUserEmail: { color: colors.textSecondary, fontSize: 12 },
  adminBadge: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(244,167,43,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  adminBadgeText: { color: '#F4A72B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  modalDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 20, marginVertical: 6 },
  modalSectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 10, marginBottom: 8 },
  enrollmentsList: { maxHeight: 200, marginHorizontal: 20 },
  enrollmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 10 },
  enrollmentTitle: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  enrollmentRoleBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  enrollmentRoleText: { fontSize: 11, fontWeight: '700' },
  noEnrollmentsText: { color: colors.textSecondary, fontSize: 13, marginHorizontal: 20, marginVertical: 12 },
  modalActionBtn: { marginHorizontal: 20, marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalActionDeleteBtn: { marginHorizontal: 20, marginTop: 8, backgroundColor: 'rgba(244,72,94,0.1)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(244,72,94,0.3)' },
  modalActionDeleteBtnText: { color: '#F4485E', fontSize: 15, fontWeight: '700' },
  createActionBtn: { backgroundColor: '#7B88FF' },
  createActionBtnDisabled: { backgroundColor: 'rgba(123,136,255,0.4)' },
  modalActionMakeAdmin: { backgroundColor: 'rgba(244,167,43,0.1)' },
  modalActionRemoveAdmin: { backgroundColor: 'rgba(244,72,94,0.1)' },
  modalActionBtnText: { fontSize: 15, fontWeight: '700' },
  modalCloseBtn: { marginHorizontal: 20, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  modalCloseBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
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