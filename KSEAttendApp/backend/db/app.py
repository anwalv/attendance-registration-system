import os
import jwt
from functools import wraps
from flask import Flask, jsonify, request
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'default-flask-key-for-dev')
DATABASE_URL = os.environ.get('DATABASE_URL')

engine = create_engine(
    DATABASE_URL,
    connect_args={"client_encoding": "utf8"}
)
Session = sessionmaker(bind=engine)

JWT_SECRET = os.environ.get('JWT_SECRET', 'super-secret-key-that-is-very-long-and-secure-32-bytes')
JWT_ALGORITHM = 'HS256'


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Невалідний формат токена. Використовуйте 'Bearer <token>'"}), 401

        if not token:
            return jsonify({"error": "Токен відсутній"}), 401

        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Термін дії токена закінчився"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Невалідний або пошкоджений токен"}), 401

        return f(*args, **kwargs)
    return decorated


def roles_allowed(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_data = getattr(request, 'user', {})
            global_role = user_data.get('global_role', 'user')
            user_id = user_data.get('user_id')

            if global_role in roles:
                return f(*args, **kwargs)

            session = Session()
            try:
                course_roles_query = session.execute(
                    text("SELECT course_role FROM course_members WHERE user_id = :uid"),
                    {"uid": user_id}
                ).fetchall()
                
                user_course_roles = [r[0] for r in course_roles_query]
                
                has_permission = any(role in user_course_roles for role in roles)
                if not has_permission:
                    return jsonify({"error": "У вас немає прав для виконання цієї дії (Forbidden)"}), 403
            finally:
                session.close()

            return f(*args, **kwargs)
        return decorated
    return decorator


@app.route('/users/me', methods=['GET'])
@token_required
def get_me():
    """
    Отримати профіль поточного авторизованого користувача
    ---
    tags:
      - Users
    description: Доступ — будь-яка роль. Повертає дані юзера з JWT + його enrollments по курсах.
    security:
      - Bearer: []
    responses:
      200:
        description: Профіль користувача
    """
    user_data = getattr(request, 'user', {})
    user_id = user_data.get('user_id')

    session = Session()
    try:
        row = session.execute(
            text("SELECT id, name, email, active, global_role::text FROM users WHERE id = :id"),
            {"id": user_id}
        ).fetchone()

        if not row:
            return jsonify({"error": "Користувача не знайдено"}), 404

        enrollments = session.execute(text("""
            SELECT cm.course_role::text AS role, c.id AS course_id, c.name AS course_name
            FROM course_members cm
            JOIN courses c ON cm.course_id = c.id
            WHERE cm.user_id = :id
        """), {"id": user_id}).fetchall()

        return jsonify({
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "active": row.active,
            "enrollments": [
                {"role": e.role, "course_id": e.course_id, "course_name": e.course_name}
                for e in enrollments
            ]
        }), 200
    except Exception as e:
        import traceback
        import sys
        print("====== [CRITICAL] ПОМИЛКА В GET_ME ======", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Internal server error in get_me", "details": "Check console traceback"}), 500
    finally:
        session.close()


@app.route('/users/<int:user_id>/make-admin', methods=['PATCH'])
@token_required
@roles_allowed('admin')
def make_user_admin(user_id):
    """
    Надати користувачеві глобальні права адміністратора.
    """
    session = Session()
    try:
        user_row = session.execute(
            text("SELECT id, name FROM users WHERE id = :uid"),
            {"uid": user_id}
        ).fetchone()
        
        if not user_row:
            return jsonify({"error": "Користувача не знайдено"}), 404
        
        session.execute(
            text("UPDATE users SET global_role = 'admin' WHERE id = :uid"),
            {"uid": user_id}
        )
        
        session.commit()
        return jsonify({
            "message": f"Користувач {user_row.name} тепер має права адміністратора",
            "user_id": user_id,
            "new_role": "admin"
        }), 200
        
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/users/<int:user_id>/remove-admin', methods=['PATCH'])
@token_required
@roles_allowed('admin')
def remove_user_admin(user_id):
    """
    Забрати у користувача глобальні права адміністратора.
    """
    session = Session()
    try:
        current_user_id = getattr(request, 'user', {}).get('user_id')
        
        if current_user_id == user_id:
            return jsonify({"error": "Ви не можете забрати права адміністратора у самого себе"}), 400

        user_row = session.execute(
            text("SELECT id, name FROM users WHERE id = :uid"),
            {"uid": user_id}
        ).fetchone()
        
        if not user_row:
            return jsonify({"error": "Користувача не знайдено"}), 404
        
        session.execute(
            text("UPDATE users SET global_role = 'user' WHERE id = :uid"),
            {"uid": user_id}
        )
        
        session.commit()
        return jsonify({
            "message": f"Користувач {user_row.name} більше не є адміністратором",
            "user_id": user_id,
            "new_role": "user"
        }), 200
        
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/courses/<int:course_id>/members', methods=['POST'])
@token_required
@roles_allowed('admin')
def add_course_member(course_id):
    """
    Додати учасника до курсу за email
    ---
    tags:
      - Courses
    description: |
      Доступ — Викладач цього курсу або Адміністратор.
      Якщо користувача з таким email ще немає в системі — створює нового.
      Якщо вже прив'язаний до курсу — оновлює його роль.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: course_id
        type: integer
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - role
          properties:
            email:
              type: string
              example: "student@kse.org.ua"
            name:
              type: string
              example: "Іван Іваненко"
            role:
              type: string
              enum: [student, teacher]
    responses:
      201:
        description: Учасника успішно додано
      400:
        description: Помилка валідації
      403:
        description: Немає прав додавати учасників до цього курсу
      404:
        description: Курс не знайдено
    """
    body = request.get_json() or {}
    email = (body.get('email') or '').strip().lower()
    name = (body.get('name') or '').strip()
    role = (body.get('role') or '').strip().lower()

    if not email or '@' not in email:
        return jsonify({"error": "Поле email обов'язкове та повинно бути валідним"}), 400
    if role not in ('student', 'teacher'):
        return jsonify({"error": "Поле role повинно бути 'student' або 'teacher'"}), 400

    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        user_data = getattr(request, 'user', {})
        if user_data.get('global_role') != 'admin':
            is_course_teacher = session.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM course_members
                    WHERE course_id = :course_id AND user_id = :uid AND course_role::text = 'teacher'
                )
            """), {"course_id": course_id, "uid": user_data.get('user_id')}).scalar()
            if not is_course_teacher:
                return jsonify({"error": "Ви не викладач цього курсу"}), 403

        user_row = session.execute(
            text("SELECT id, name FROM users WHERE LOWER(email) = :email"),
            {"email": email}
        ).fetchone()

        if not user_row:
            user_row = session.execute(text("""
                INSERT INTO users (name, email, active) VALUES (:name, :email, TRUE) RETURNING id, name
            """), {"name": name or email, "email": email}).fetchone()

        user_id = user_row.id

        session.execute(text("""
            INSERT INTO course_members (course_id, user_id, course_role)
            VALUES (:course_id, :user_id, :role)
            ON CONFLICT (course_id, user_id) DO UPDATE SET course_role = :role
        """), {"course_id": course_id, "user_id": user_id, "role": role})

        session.commit()
        return jsonify({
            "message": "Учасника успішно додано",
            "member": {"id": user_id, "name": user_row.name, "email": email, "role": role}
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/courses/<int:course_id>/members/<int:user_id>', methods=['DELETE'])
@token_required
@roles_allowed('teacher', 'admin')
def remove_course_member(course_id, user_id):
    """
    Видалити учасника з курсу
    ---
    tags:
      - Courses
    description: Доступ — Викладач цього курсу або Адміністратор. Прибирає прив'язку користувача до курсу (не видаляє самого користувача з системи).
    security:
      - Bearer: []
    parameters:
      - in: path
        name: course_id
        type: integer
        required: true
      - in: path
        name: user_id
        type: integer
        required: true
    responses:
      200:
        description: Учасника видалено з курсу
      403:
        description: Немає прав
      404:
        description: Учасника не знайдено в цьому курсі
    """
    session = Session()
    try:
        user_data = getattr(request, 'user', {})
        if user_data.get('global_role') != 'admin':
            is_course_teacher = session.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM course_members
                    WHERE course_id = :course_id AND user_id = :uid AND course_role::text = 'teacher'
                )
            """), {"course_id": course_id, "uid": user_data.get('user_id')}).scalar()
            if not is_course_teacher:
                return jsonify({"error": "Ви не викладач цього курсу"}), 403

        result = session.execute(text("""
            DELETE FROM course_members WHERE course_id = :course_id AND user_id = :user_id
        """), {"course_id": course_id, "user_id": user_id})
        session.commit()

        if result.rowcount == 0:
            return jsonify({"error": "Учасника не знайдено в цьому курсі"}), 404

        return jsonify({"message": "Учасника видалено з курсу"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/courses', methods=['GET'])
@token_required
def get_courses():
    session = Session()
    try:
        query = text("""
            SELECT 
                c.id, 
                c.name, 
                c.term,
                COALESCE(COUNT(DISTINCT CASE WHEN cm.course_role::text = 'student' THEN cm.user_id END), 0) as students_count,
                COALESCE(COUNT(DISTINCT CASE WHEN e.event_type = 'Лекція' THEN e.id END), 0) as total_lectures,
                COALESCE(COUNT(DISTINCT CASE WHEN e.event_type = 'Практика' THEN e.id END), 0) as total_practices,
                (SELECT COUNT(*) FROM events e2 WHERE e2.course_id = c.id AND e2.start_datetime <= NOW()) as past_events_count,
                (SELECT COUNT(*) FROM attendance a 
                 JOIN events e3 ON a.event_id = e3.id 
                 WHERE e3.course_id = c.id AND a.status = 'present' AND e3.start_datetime <= NOW()) as present_count
            FROM courses c
            LEFT JOIN course_members cm ON cm.course_id = c.id
            LEFT JOIN events e ON e.course_id = c.id
            GROUP BY c.id, c.name, c.term
            ORDER BY c.id
        """)

        rows = session.execute(query).fetchall()

        result = []
        for r in rows:
            possible_attendance = r.past_events_count * r.students_count
            avg_attendance = (r.present_count / possible_attendance * 100) if possible_attendance > 0 else 0.0

            result.append({
                "id": r.id,
                "name": r.name,
                "term": r.term,
                "students_count": r.students_count,
                "total_lectures": r.total_lectures,
                "total_practices": r.total_practices,
                "avg_attendance": round(avg_attendance, 2)
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/courses/<int:id>', methods=['GET'])
@token_required
def get_course(id):
    """
    Отримати детальну інформацію про конкретний курс
    ---
    tags:
      - Courses
    description: Доступ — Будь-яка авторизована роль. Повертає назву курсу та списки закріплених за ним студентів і викладачів дисципліни.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        type: integer
        required: true
    responses:
      200:
        description: Інформація про курс та його склад
      404:
        description: Курс із вказаним ID не знайдено
    """
    session = Session()
    try:
        course = session.execute(
            text("SELECT id, name, term FROM courses WHERE id = :id"), {"id": id}
        ).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        teachers = session.execute(text("""
            SELECT u.id, u.name, u.email FROM users u
            JOIN course_members cm ON cm.user_id = u.id
            WHERE cm.course_id = :id AND cm.course_role::text = 'teacher'
        """), {"id": id}).fetchall()

        students = session.execute(text("""
            SELECT u.id, u.name, u.email FROM users u
            JOIN course_members cm ON cm.user_id = u.id
            WHERE cm.course_id = :id AND cm.course_role::text = 'student'
        """), {"id": id}).fetchall()

        return jsonify({
            "id": course.id, "name": course.name, "term": course.term,
            "teachers": [{"id": r.id, "name": r.name, "email": r.email} for r in teachers],
            "students": [{"id": r.id, "name": r.name, "email": r.email} for r in students],
        }), 200
    finally:
        session.close()


@app.route('/courses/<int:course_id>/at-risk-students', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_at_risk_students(course_id):
    """
    Отримати список студентів під загрозою недопуску по курсу
    ---
    tags:
      - Attendance
    description: Доступ — Викладач або Адмін. Повертає список студентів курсу, чия явка нижча за мінімальний поріг, заданий у rules.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: course_id
        type: integer
        required: true
    responses:
      200:
        description: Список студентів під ризиком
      404:
        description: Курс не знайдено або немає правила мінімальної явки
    """
    session = Session()
    try:
        course = session.execute(
            text("SELECT id, name FROM courses WHERE id = :id"), {"id": course_id}
        ).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        min_pct_required = session.execute(text("""
            SELECT value FROM rules WHERE course_id = :course_id AND type = 'minimum_percentage' LIMIT 1
        """), {"course_id": course_id}).scalar()

        if not min_pct_required:
            return jsonify({"course_name": course.name, "min_pct_required": None, "students": []}), 200

        total_events = session.execute(text("""
            SELECT COUNT(*) FROM events WHERE course_id = :course_id AND start_datetime <= NOW()
        """), {"course_id": course_id}).scalar() or 0

        rows = session.execute(text("""
            SELECT u.id, u.name, u.email,
                   COUNT(a.id) FILTER (WHERE a.status = 'present') AS attended
            FROM course_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN events e ON e.course_id = cm.course_id AND e.start_datetime <= NOW()
            LEFT JOIN attendance a ON a.event_id = e.id AND a.student_id = cm.user_id
            WHERE cm.course_id = :course_id AND cm.course_role::text = 'student'
            GROUP BY u.id, u.name, u.email
        """), {"course_id": course_id}).fetchall()

        at_risk = []
        for r in rows:
            pct = (r.attended / total_events * 100) if total_events > 0 else 0
            if pct < float(min_pct_required):
                at_risk.append({
                    "id": r.id,
                    "name": r.name,
                    "email": r.email,
                    "attended_events": r.attended,
                    "total_events": total_events,
                    "attendance_pct": round(pct, 2)
                })

        at_risk.sort(key=lambda s: s["attendance_pct"])

        return jsonify({
            "course_name": course.name,
            "min_pct_required": float(min_pct_required),
            "students": at_risk
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/courses/<int:course_id>/students-attendance', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_course_students_attendance(course_id):
    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        total_events = session.execute(text("""
            SELECT COUNT(*) FROM events WHERE course_id = :course_id AND start_datetime <= NOW()
        """), {"course_id": course_id}).scalar() or 0

        rows = session.execute(text("""
            SELECT u.id, u.name,
                   COUNT(a.id) FILTER (WHERE a.status = 'present') AS attended
            FROM course_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN events e ON e.course_id = cm.course_id AND e.start_datetime <= NOW()
            LEFT JOIN attendance a ON a.event_id = e.id AND a.student_id = cm.user_id
            WHERE cm.course_id = :course_id AND cm.course_role::text = 'student'
            GROUP BY u.id, u.name
            ORDER BY u.name
        """), {"course_id": course_id}).fetchall()

        students = [{
            "id": str(r.id), "name": r.name,
            "attended": r.attended, "total": total_events,
            "courseRole": "student"
        } for r in rows]

        return jsonify(students), 200
    finally:
        session.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)