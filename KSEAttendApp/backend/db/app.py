import email
import os
import secrets
from calendar import Calendar
import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import Flask, jsonify, request, url_for, redirect, send_from_directory
from flasgger import Swagger
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask_cors import CORS
import math
from flask import session as flask_session
import csv
import io
from icalendar import Calendar
import urllib.parse

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'default-flask-key-for-dev')
DATABASE_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:gkfnGkld7@localhost:5433/eduattend_db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"client_encoding": "utf8"}
)
Session = sessionmaker(bind=engine)
FRONTEND_URL = os.environ.get('FRONTEND_URL')

JWT_SECRET = os.environ.get('JWT_SECRET', 'super-secret-key-that-is-very-long-and-secure-32-bytes')
JWT_ALGORITHM = 'HS256'

app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://oauth2.googleapis.com/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'openid email profile'},
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration'
)


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

swagger_config = {
    "headers": [],
    "specs": [{"endpoint": "apispec", "route": "/apispec.json",
                "rule_filter": lambda rule: True, "model_filter": lambda tag: True}],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger_template = {
    "info": {
        "title": "Attendance Tracking API",
        "description": "API для системи обліку відвідуваності",
        "version": "1.0.0",
    },
    "securityDefinitions": {
        "Bearer": {"type": "apiKey", "name": "Authorization",
                   "in": "header", "description": "JWT токен. Формат: Bearer <token>"}
    },
    "security": [{"Bearer": []}],
    "tags": [
        {"name": "Google Authentication", "description": "Вхід через сервіси Google OAuth"},
        {"name": "Users", "description": "Управління користувачами та ролями"},
        {"name": "Courses", "description": "Управління навчальними курсами"},
        {"name": "Events", "description": "Заняття, пари та події розкладу"},
        {"name": "QR Attendance", "description": "Генерація та ротація динамічних QR-кодів"},
        {"name": "Attendance", "description": "Фіксація присутніх та статистика"}
    ],
}

Swagger(app, config=swagger_config, template=swagger_template)


def generate_qr_token(event_id, session_secret):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    payload = {
        "event_id": event_id,
        "session_secret": session_secret
    }
    return serializer.dumps(payload, salt="qr-attendance-salt")


def verify_qr_token(token, ttl_seconds):
    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    try:
        return serializer.loads(token, salt="qr-attendance-salt", max_age=ttl_seconds)
    except (SignatureExpired, BadSignature):
        return None

def evaluate_achievements(session, course_id, student_id):
    rules = session.execute(text("""
        SELECT id, type, value FROM rules 
        WHERE course_id = :course_id AND type IN ('streak_bonus', 'perfect_attendance')
    """), {"course_id": course_id}).fetchall()

    if not rules:
        return

    total_events = session.execute(text("""
        SELECT COUNT(*) FROM events WHERE course_id = :course_id AND start_datetime <= NOW()
    """), {"course_id": course_id}).scalar() or 0

    attended = session.execute(text("""
        SELECT COUNT(*) FROM attendance a JOIN events e ON a.event_id = e.id
        WHERE e.course_id = :course_id AND a.student_id = :student_id 
          AND a.status = 'present' AND e.start_datetime <= NOW()
    """), {"course_id": course_id, "student_id": student_id}).scalar() or 0

    streak = session.execute(text("""
        WITH ordered_attendance AS (
            SELECT a.status, e.start_datetime,
                ROW_NUMBER() OVER (ORDER BY e.start_datetime DESC) -
                ROW_NUMBER() OVER (PARTITION BY a.status ORDER BY e.start_datetime DESC) as grp
            FROM events e
            JOIN attendance a ON a.event_id = e.id
            WHERE e.course_id = :course_id AND a.student_id = :student_id AND e.start_datetime <= NOW()
        )
        SELECT COUNT(*) FROM ordered_attendance WHERE status = 'present' AND grp = 0
    """), {"course_id": course_id, "student_id": student_id}).scalar() or 0

    for rule in rules:
        already_earned = session.execute(text("""
            SELECT 1 FROM achievements WHERE rule_id = :rule_id AND student_id = :student_id
        """), {"rule_id": rule.id, "student_id": student_id}).fetchone()

        if already_earned:
            continue

        earned = False
        if rule.type == 'perfect_attendance' and total_events > 0 and attended == total_events:
            earned = True
        elif rule.type == 'streak_bonus' and rule.value and streak >= rule.value:
            earned = True

        if earned:
            session.execute(text("""
                INSERT INTO achievements (rule_id, student_id, earned_at) VALUES (:rule_id, :student_id, NOW())
            """), {"rule_id": rule.id, "student_id": student_id})

@app.route('/events/<int:id>/qr', methods=['POST'])
@token_required
@roles_allowed('teacher', 'admin')
def create_qr(id):
    """
    Активація сесії збору відвідуваності заняття (Генерація QR)
    ---
    tags:
      - QR Attendance
    description: Доступ — Викладач. Ініціалізує сесію збору відвідуваності для конкретної пари, створює базовий секретний ключ у БД та повертає перший токен.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        type: integer
        required: true
        description: ID заняття (event), для якого відкривається реєстрація
    responses:
      201:
        description: Сесію успішно активовано, згенеровано перший токен
        schema:
          type: object
          properties:
            qr_token:
              type: string
              example: "InZlbnRfaWQiOjEwMSwic2Vzc2lvbl9zZWNyZXQiOiI1ZjNk..."
            expires_in:
              type: integer
              example: 10
            session_active:
              type: boolean
              example: true
      404:
        description: Заняття не знайдено
      401:
        description: Не авторизовано або невалідний токен
      500:
        description: Внутрішня помилка сервера
    """
    session_secret = secrets.token_hex(16)
    ttl_seconds = 10
    session = Session()
    try:
        event = session.execute(text("SELECT id FROM events WHERE id = :id"), {"id": id}).fetchone()
        if not event:
            return jsonify({"error": "Заняття не знайдено"}), 404

        session.execute(text("""
            INSERT INTO qr_sessions (event_id, session_secret, ttl_seconds, active, created_at)
            VALUES (:event_id, :secret, :ttl, TRUE, NOW())
            ON CONFLICT (event_id)
            DO UPDATE SET
                session_secret = EXCLUDED.session_secret,
                ttl_seconds    = EXCLUDED.ttl_seconds,
                active         = TRUE,
                created_at     = NOW()
        """), {"event_id": id, "secret": session_secret, "ttl": ttl_seconds})
        session.commit()

        token = generate_qr_token(id, session_secret)
        return jsonify({
            "qr_token": token,
            "expires_in": ttl_seconds,
            "session_active": True
        }), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/events/<int:id>/qr', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_qr(id):
    """
    Оновлення / ротація QR-токена "на льоту"
    ---
    tags:
      - QR Attendance
    description: Доступ — Викладач. Викликається фронтендом (екраном проектора) кожні 10 секунд. Безпечно створює новий підписаний токен без зайвих записів записів у БД.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        type: integer
        required: true
        description: ID заняття
    responses:
      200:
        description: Згенеровано новий актуальний токен для відображення
        schema:
          type: object
          properties:
            qr_token:
              type: string
              example: "ZXZlbnRfaWQiOjEwMSwic2V..."
            expires_in:
              type: integer
              example: 10
      404:
        description: Активної QR-сесії для цієї пари не знайдено
    """
    session = Session()
    try:
        qr_session = session.execute(text("""
            SELECT session_secret, ttl_seconds FROM qr_sessions
            WHERE event_id = :id AND active = TRUE
        """), {"id": id}).fetchone()

        if not qr_session:
            return jsonify({"error": "Активної QR-сесії для пари не знайдено."}), 404

        token = generate_qr_token(id, qr_session.session_secret)
        return jsonify({
            "qr_token": token,
            "expires_in": qr_session.ttl_seconds
        }), 200
    finally:
        session.close()


@app.route('/events/<int:id>/qr', methods=['DELETE'])
@token_required
@roles_allowed('teacher', 'admin')
def stop_qr(id):
    """
    Зупинка прийому відвідуваності заняття
    ---
    tags:
      - QR Attendance
    description: Доступ — Викладач. Закриває сесію відвідуваності. Після деактивації жодні токени від студентів більше не приймаються сервером.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        type: integer
        required: true
        description: ID заняття
    responses:
      200:
        description: Сесію успішно деактивовано
        schema:
          type: object
          properties:
            status:
              type: string
              example: "stopped"
      404:
        description: Активної сесії для зупинки немає
    """
    session = Session()
    try:
        result = session.execute(text("""
            UPDATE qr_sessions SET active = FALSE
            WHERE event_id = :id AND active = TRUE
        """), {"id": id})
        session.commit()

        if result.rowcount == 0:
            return jsonify({"error": "Активної сесії для деактивації немає"}), 404

        return jsonify({"status": "stopped"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/attendance/checkin', methods=['POST'])
@token_required
def checkin():
    """
    Сканування QR-коду студентом та фіксація присутності
    ---
    tags:
      - Attendance
    description: Доступ — Студент. Приймає зчитаний через камеру смартфона `qr_token` та `event_id`, перевіряє криптографічний підпис і час "життя" токена (TTL), записує присутність.
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - event_id
            - qr_token
          properties:
            event_id:
              type: integer
              example: 101
            qr_token:
              type: string
              example: "InZlbnRfaWQiOjEwMSwic2Vzc2lvbl9zZWNyZXQiOiI1ZjNk..."
    responses:
      200:
        description: Присутність успішно зараховано
        schema:
          type: object
          properties:
            status:
              type: string
              example: "present"
            message:
              type: string
              example: "Присутність успішно зараховано"
      400:
        description: Помилка валідації або протермінований/підроблений QR-код
    """
    body = request.get_json() or {}
    qr_token = body.get("qr_token")
    student_id = getattr(request, 'user', {}).get('user_id')

    if not qr_token:
        return jsonify({"error": "Параметр qr_token є обов'язковим"}), 400

    session = Session()
    try:
        serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
        try:
            raw_payload = serializer.loads(qr_token, salt="qr-attendance-salt", max_age=3600)
        except SignatureExpired as e:
            raw_payload = e.payload
        except BadSignature:
            return jsonify({"error": "Неправильний QR"}), 400

        event_id = raw_payload.get("event_id") if raw_payload else None
        if not event_id:
            return jsonify({"error": "Неправильний QR"}), 400

        qr_session = session.execute(text("""
            SELECT session_secret, ttl_seconds FROM qr_sessions
            WHERE event_id = :event_id AND active = TRUE
        """), {"event_id": event_id}).fetchone()

        if not qr_session:
            return jsonify({"error": "Неправильний QR"}), 400
        
        payload = verify_qr_token(qr_token, qr_session.ttl_seconds)
        if not payload or payload["event_id"] != event_id or payload["session_secret"] != qr_session.session_secret:
            return jsonify({"error": "Неправильний QR"}), 400

        session.execute(text("""
            INSERT INTO attendance (event_id, student_id, status, checked_at)
            VALUES (:event_id, :student_id, 'present', NOW())
            ON CONFLICT (event_id, student_id)
            DO UPDATE SET status = 'present', checked_at = NOW()
        """), {"event_id": event_id, "student_id": student_id})

        event_row = session.execute(text("SELECT course_id FROM events WHERE id = :id"), {"id": event_id}).fetchone()
        if event_row:
            evaluate_achievements(session, event_row.course_id, student_id)
        session.commit()

        return jsonify({"status": "present", "message": "Присутність успішно зараховано"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/auth/google/login', methods=['GET'])
def google_login():
    """
    Ініціалізація авторизації через сервіси Google
    ---
    tags:
      - Google Authentication
    description: Ендпоінт для фронтенду. Генерує посилання авторизації та редиректить користувача на офіційне вікно Google OAuth 2.0.
    responses:
      302:
        description: Перенаправлення на сторінку вибору Google акаунту
    """
    target_redirect = request.args.get('redirect_uri') or FRONTEND_URL
    flask_session['auth_redirect_uri'] = target_redirect
    google_callback_uri = url_for('google_callback', _external=True)
    return google.authorize_redirect(google_callback_uri, prompt='select_account')


@app.route('/index.html')
def serve_index():
    return send_from_directory(os.path.dirname(__file__), 'index.html')


@app.route('/auth/google/callback', methods=['GET'])
def google_callback():
    """
    Обробка відповіді авторизації від Google (Callback)
    ---
    tags:
      - Google Authentication
    description: URL-обробник, куди Google повертає користувача. Бекенд забирає email, звіряє з базою, перевіряє активність та генерує внутрішній JWT токен системи.
    responses:
      200:
        description: Успішний вхід. Повертає згенерований токен додатка
        schema:
          type: object
          properties:
            token:
              type: string
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            user:
              type: object
              properties:
                id:
                  type: integer
                name:
                  type: string
                email:
                  type: string
                role:
                  type: string
      401:
        description: Користувач деактивований адміністратором
      403:
        description: Користувача немає в білому списку бази даних системи
    """
    db_session = Session() 
    try:
        token = google.authorize_access_token()
        user_info = google.get('userinfo').json()

        email = user_info.get('email')
        if not email:
            return jsonify({"error": "Не вдалося отримати email від Google"}), 400
        row = db_session.execute(
            text("SELECT id, name, email, active, global_role::text FROM users WHERE LOWER(email) = LOWER(:email)"),
            {"email": email.strip()}
        ).fetchone()

        if not row:
            target_redirect = flask_session.pop('auth_redirect_uri', FRONTEND_URL)
            encoded_email = urllib.parse.quote(email.strip())
            separator = '&' if '?' in target_redirect else '?'
            return redirect(f"{target_redirect}{separator}error=not_registered&email={encoded_email}")

        if not row.active:
            return jsonify({"error": "Ваш акаунт деактивовано. Доступ заборонено"}), 401

        expiration_time = datetime.now(timezone.utc) + timedelta(hours=2)
        payload = {
            "user_id": row.id,
            "email": row.email,
            "name": row.name,
            "global_role": str(row.global_role),
            "exp": int(expiration_time.timestamp())
        }
        jwt_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        if isinstance(jwt_token, bytes):
            jwt_token = jwt_token.decode('utf-8')
        target_redirect = flask_session.pop('auth_redirect_uri', FRONTEND_URL)
        separator = '&' if '?' in target_redirect else '?'    
        return redirect(f"{target_redirect}{separator}token={jwt_token}")

    except Exception as e:
        import traceback
        import sys
        
        print("====== [СПРАВЖНІЙ КРАШ БЕКЕНДУ] ======", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print("======================================", file=sys.stderr)
        
        return jsonify({
            "error": "Google callback internal error",
            "message": "Подивіться в чорний термінал Flask, там надруковано справжню причину помилки."
        }), 500
    finally:
        db_session.close()


@app.route('/users', methods=['GET'])
@token_required
@roles_allowed('admin')
def get_users():
    """
    Отримати перелік користувачів (з пагінацією, пошуком та фільтром за роллю)
    ---
    tags:
      - Users
    description: Доступ — Адміністратор. Повертає список користувачів з пагінацією, пошуком за ім'ям/email та фільтром за роллю.
    security:
      - Bearer: []
    parameters:
      - in: query
        name: page
        schema:
          type: integer
        description: Номер сторінки (за замовчуванням 1)
      - in: query
        name: limit
        schema:
          type: integer
        description: Кількість елементів на сторінці (за замовчуванням 20, максимум 100)
      - in: query
        name: search
        schema:
          type: string
        description: Пошук за фрагментом імені або email
      - in: query
        name: role
        schema:
          type: string
          enum: [all, admin, student, teacher]
        description: Фільтр за роллю
    responses:
      200:
        description: Об'єкт з масивом користувачів, даними пагінації та лічильниками
      403:
        description: Недостатньо прав
    """
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    search = request.args.get('search', '', type=str).strip()
    role = request.args.get('role', 'all', type=str)

    if page < 1:
        page = 1
    if limit < 1:
        limit = 20
    limit = min(limit, 100)

    if role not in ('all', 'admin', 'student', 'teacher'):
        role = 'all'

    offset = (page - 1) * limit
    search_pattern = f"%{search}%"

    session = Session()
    try:
        role_filter_sql = ""
        if role == 'admin':
            role_filter_sql = "AND u.global_role = 'admin'"
        elif role == 'student':
            role_filter_sql = """AND EXISTS (
                SELECT 1 FROM course_members cm WHERE cm.user_id = u.id AND cm.course_role = 'student'
            )"""
        elif role == 'teacher':
            role_filter_sql = """AND EXISTS (
                SELECT 1 FROM course_members cm WHERE cm.user_id = u.id AND cm.course_role = 'teacher'
            )"""

        counts_sql = text("""
            SELECT 
                COUNT(*) AS all_count,
                COUNT(*) FILTER (WHERE u.global_role = 'admin') AS admin_count,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM course_members cm WHERE cm.user_id = u.id AND cm.course_role = 'student'
                )) AS student_count,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM course_members cm WHERE cm.user_id = u.id AND cm.course_role = 'teacher'
                )) AS teacher_count
            FROM users u
            WHERE (:search = '' OR u.name ILIKE :search_pattern OR u.email ILIKE :search_pattern)
        """)
        counts_result = session.execute(counts_sql, {
            "search": search,
            "search_pattern": search_pattern
        }).fetchone()

        total_records = {
            'admin': counts_result.admin_count,
            'student': counts_result.student_count,
            'teacher': counts_result.teacher_count,
        }.get(role, counts_result.all_count)

        total_pages = max(1, math.ceil(total_records / limit))

        users_sql = text(f"""
            WITH matched_users AS (
                SELECT u.id
                FROM users u
                WHERE (:search = '' OR u.name ILIKE :search_pattern OR u.email ILIKE :search_pattern)
                {role_filter_sql}
                ORDER BY u.id
                LIMIT :limit OFFSET :offset
            )
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.active,
                u.global_role,
                COALESCE(
                    json_agg(
                        json_build_object('course_id', c.id, 'course_name', c.name, 'role', cm.course_role)
                    ) FILTER (WHERE c.id IS NOT NULL), 
                    '[]'
                ) AS courses_bindings
            FROM matched_users mu
            JOIN users u ON u.id = mu.id
            LEFT JOIN course_members cm ON cm.user_id = u.id
            LEFT JOIN courses c ON cm.course_id = c.id
            GROUP BY u.id, u.name, u.email, u.active, u.global_role
            ORDER BY u.id
        """)

        rows = session.execute(users_sql, {
            "search": search,
            "search_pattern": search_pattern,
            "limit": limit,
            "offset": offset
        }).fetchall()

        users_list = [{
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "role": r.global_role,
            "active": r.active,
            "courses": r.courses_bindings
        } for r in rows]

        return jsonify({
            "users": users_list,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "totalRecords": total_records,
            "counts": {
                "all": counts_result.all_count,
                "student": counts_result.student_count,
                "teacher": counts_result.teacher_count,
                "admin": counts_result.admin_count
            }
        }), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

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

@app.route('/users/me', methods=['PUT'])
@token_required
def update_me():
    user_data = getattr(request, 'user', {})
    user_id = user_data.get('user_id')
    body = request.get_json()
    new_name = body.get('name')

    session = Session()
    try:
        session.execute(
            text("UPDATE users SET name = :name WHERE id = :id"),
            {"name": new_name, "id": user_id}
        )
        session.commit()
        return jsonify({"message": "Профіль оновлено"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/courses/<int:course_id>/my-attendance', methods=['GET'])
@token_required
def get_my_attendance(course_id):
    """
    Отримати особисту історію відвідуваності студента по конкретному курсу.
    Доступ — будь-який студент, зареєстрований на цей курс.
    """
    user_data = getattr(request, 'user', {})
    student_id = user_data.get('user_id')

    session = Session()
    try:
        is_member = session.execute(text("""
            SELECT 1 FROM course_members 
            WHERE course_id = :course_id AND user_id = :user_id
        """), {"course_id": course_id, "user_id": student_id}).fetchone()

        if not is_member:
            return jsonify({"error": "Ви не є учасником цього курсу або не маєте доступу"}), 403

        rows = session.execute(text("""
            SELECT 
                e.id AS event_id,
                e.title AS event_title,
                e.start_datetime,
                COALESCE(a.status::text, 'absent') AS status,
                a.checked_at
            FROM events e
            LEFT JOIN attendance a 
              ON e.id = a.event_id AND a.student_id = :student_id
            WHERE e.course_id = :course_id
            ORDER BY e.start_datetime DESC
        """), {"course_id": course_id, "student_id": student_id}).fetchall()

        result = []
        for r in rows:
            result.append({
                "event_id": r.event_id,
                "event_title": r.event_title,
                "start_datetime": r.start_datetime.isoformat() if r.start_datetime else None,
                "status": r.status,
                "checked_at": r.checked_at.isoformat() if r.checked_at else None
            })

        return jsonify(result), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Помилка отримання відвідуваності: {str(e)}"}), 500
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

@app.route('/users/<int:target_user_id>', methods=['DELETE'])
@token_required
@roles_allowed('admin')
def delete_user(target_user_id):
    """
    Видалення користувача.
    Завдяки ON DELETE CASCADE в БД, всі пов'язані дані (attendance, 
    course_members, achievements) будуть видалені автоматично.
    """
    
    session = Session()
    try:
        result = session.execute(
            text("DELETE FROM users WHERE id = :u_id"), 
            {"u_id": target_user_id}
        )
        
        if result.rowcount == 0:
            return jsonify({"error": "Користувача не знайдено"}), 404
            
        session.commit()
        return jsonify({"message": "Користувача та всі його дані успішно видалено"}), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Помилка бази даних: {str(e)}"}), 500
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
@app.route('/courses', methods=['POST'])
@token_required
@roles_allowed('admin')
def create_course():
    """
    Створення нового курсу, призначення учасників та імпорт розкладу з iCal/CSV
    ---
    tags:
      - Courses
    description: |
      Доступ — Адміністратор. Створює запис курсу, приймає:
      - teacher_ids / student_ids (масиви ID існуючих користувачів) — опціонально
      - members_csv (сирий текст CSV з колонками name,email,role) — опціонально, 
        автоматично створює нових користувачів та прив'язує їх до курсу
      - ical_content (сирий текст .ics файлу) — опціонально, імпортує розклад
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
          properties:
            name:
              type: string
              example: "Data Structures & Algorithms"
            term:
              type: string
              example: "Осінь 2026"
            teacher_ids:
              type: array
              items:
                type: integer
            student_ids:
              type: array
              items:
                type: integer
            members_csv:
              type: string
              description: "Сирий текст CSV з колонками: name,email,role (role = student|teacher)"
              example: "name,email,role\nІван Іваненко,ivan@kse.ua,student\nОлена Коваль,olena@kse.ua,teacher"
            ical_content:
              type: string
              example: "BEGIN:VCALENDAR\nVERSION:2.0\n..."
    responses:
      201:
        description: Курс успішно створено
    """
    body = request.get_json() or {}
    if "name" not in body:
        return jsonify({"error": "Поле name обов'язкове"}), 400

    term = body.get("term")
    ical_content = body.get("ical_content")
    members_csv = body.get("members_csv")

    session = Session()
    try:
        row = session.execute(
            text("INSERT INTO courses (name, term, created_at) VALUES (:name, :term, NOW()) RETURNING id, name, term"),
            {"name": body["name"], "term": term}
        ).fetchone()
        course_id = row.id

        for uid in body.get("teacher_ids", []):
            session.execute(text(
                "INSERT INTO course_members (course_id, user_id, course_role) VALUES (:c, :u, 'teacher') ON CONFLICT DO NOTHING"),
                {"c": course_id, "u": uid})
        for uid in body.get("student_ids", []):
            session.execute(text(
                "INSERT INTO course_members (course_id, user_id, course_role) VALUES (:c, :u, 'student') ON CONFLICT DO NOTHING"),
                {"c": course_id, "u": uid})

        members_added = {"student": 0, "teacher": 0}
        if members_csv:
            try:
                reader = csv.DictReader(io.StringIO(members_csv))
                required_cols = {"name", "email", "role"}
                if not required_cols.issubset(set(reader.fieldnames or [])):
                    return jsonify({"error": f"CSV має містити колонки: {', '.join(required_cols)}"}), 400

                for csv_row in reader:
                    csv_name = (csv_row.get("name") or "").strip()
                    csv_email = (csv_row.get("email") or "").strip().lower()
                    csv_role = (csv_row.get("role") or "").strip().lower()

                    if not csv_email or "@" not in csv_email or csv_role not in ("student", "teacher"):
                        continue

                    user_row = session.execute(
                        text("SELECT id FROM users WHERE LOWER(email) = :email"),
                        {"email": csv_email}
                    ).fetchone()

                    if not user_row:
                        user_row = session.execute(text("""
                            INSERT INTO users (name, email, active) 
                            VALUES (:name, :email, TRUE) 
                            RETURNING id
                        """), {"name": csv_name or csv_email, "email": csv_email}).fetchone()

                    user_id = getattr(user_row, 'id', user_row[0])

                    session.execute(text("""
                        INSERT INTO course_members (course_id, user_id, course_role) 
                        VALUES (:course_id, :user_id, :role) 
                        ON CONFLICT (course_id, user_id) DO NOTHING
                    """), {"course_id": course_id, "user_id": user_id, "role": csv_role})

                    members_added[csv_role] += 1

            except Exception as csv_err:
                session.rollback()
                return jsonify({"error": f"Помилка парсингу CSV: {str(csv_err)}"}), 400

        events_imported = 0
        if ical_content:
            try:
                gcal = Calendar.from_ical(ical_content)
                for component in gcal.walk():
                    if component.name == "VEVENT":
                        title = str(component.get('summary', body["name"]))
                        start_dt = component.get('dtstart').dt
                        end_dt = component.get('dtend').dt

                        if not isinstance(start_dt, datetime):
                            start_dt = datetime.combine(start_dt, datetime.min.time())
                        if not isinstance(end_dt, datetime):
                            end_dt = datetime.combine(end_dt, datetime.min.time())

                        session.execute(text("INSERT INTO events (course_id, title, start_datetime, end_datetime, created_at) VALUES (:course_id, :title, :start, :end, NOW())"), {
                            "course_id": course_id,
                            "title": title,
                            "start": start_dt,
                            "end": end_dt
                        })
                        events_imported += 1
            except Exception as ical_err:
                session.rollback()
                return jsonify({"error": f"Помилка валідації або парсингу iCal: {str(ical_err)}"}), 400

        session.commit()
        return jsonify({
            "id": row.id,
            "name": row.name,
            "term": row.term,
            "events_imported": events_imported,
            "members_imported": members_added
        }), 201
    except Exception as e:
        session.rollback()
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


@app.route('/courses/<int:id>', methods=['DELETE'])
@token_required
@roles_allowed('admin')
def delete_course(id):
    """
    Видалення курсу
    ---
    tags:
      - Courses
    description: Доступ — Адміністратор. Видаляє курс з усіма пов'язаними даними.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        required: true
        type: integer
    responses:
      200:
        description: Курс успішно видалено
      404:
        description: Курс не знайдено
      500:
        description: Внутрішня помилка сервера
    """
    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404
            
        session.execute(text("DELETE FROM courses WHERE id = :id"), {"id": id})
        session.commit()
        return jsonify({"message": "Курс видалено"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
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

@app.route('/courses/<int:id>/events', methods=['GET'])
@token_required
def get_course_events(id):
    """
    Отримати розклад (заняття) конкретного курсу
    ---
    tags:
      - Events
    description: Повертає список занять (лекцій, практик) для певного навчального курсу.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: id
        type: integer
        required: true
    responses:
      200:
        description: Список занять курсу
    """
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT id, title, event_type, start_datetime, end_datetime, series_id
            FROM events WHERE course_id = :id ORDER BY start_datetime
        """), {"id": id}).fetchall()
        return jsonify([{
            "id": r.id, 
            "title": r.title,
            "event_type": r.event_type,
            "start_datetime": r.start_datetime.isoformat(),
            "end_datetime": r.end_datetime.isoformat(),
            "series_id": r.series_id
        } for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/users', methods=['POST'])
@token_required
@roles_allowed('admin')
def add_user_by_admin():
    """
    Додавання користувача за ім'ям та поштою
    ---
    tags:
      - Users
    description: Доступ — Адмін. Реєструє користувача за email та name. Якщо вказано course_id, одразу додає його до цього курсу як студента.
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - name
          properties:
            email:
              type: string
              example: "student.stud@knu.ua"
            name:
              type: string
              example: "Іван Іваненко"
            course_id:
              type: integer
              example: 1
              description: (Опціонально) ID курсу, до якого одразу прив'язати студента
    responses:
      201:
        description: Користувача успішно додано/прив'язано
      400:
        description: Помилка валідації (відсутні поля або некоректний формат)
      401:
        description: Не авторизовано (відсутній або протермінований токен)
      403:
        description: Недостатньо прав (доступно лише для admin)
      404:
        description: Вказаний курс не знайдено
    """
    body = request.get_json() or {}
    email = body.get("email")
    name = body.get("name")
    course_id = body.get("course_id")

    if not email or not isinstance(email, str) or "@" not in email:
        return jsonify({"error": "Поле 'email' обов'язкове та повинно бути валідною адресою"}), 400
    if not name or not isinstance(name, str) or len(name.strip()) == 0:
        return jsonify({"error": "Поле 'name' обов'язкове і не може бути порожнім"}), 400

    email = email.strip().lower()
    name = name.strip()

    session = Session()
    try:
        if course_id is not None:
            course = session.execute(
                text("SELECT id FROM courses WHERE id = :course_id"),
                {"course_id": course_id}
            ).fetchone()
            if not course:
                return jsonify({"error": f"Курс з ID {course_id} не знайдено"}), 404

        user_row = session.execute(
            text("SELECT id FROM users WHERE LOWER(email) = :email"),
            {"email": email}
        ).fetchone()

        if not user_row:
            user_row = session.execute(text("""
                INSERT INTO users (name, email, active) 
                VALUES (:name, :email, TRUE) 
                RETURNING id
            """), {"name": name, "email": email}).fetchone()
            message = "Користувача успішно додано до системи"
        else:
            message = "Користувач вже існує в системі"

        user_id = getattr(user_row, 'id', user_row[0])

        if course_id is not None:
            session.execute(text("""
                INSERT INTO course_members (course_id, user_id, course_role) 
                VALUES (:course_id, :user_id, 'student') 
                ON CONFLICT (course_id, user_id) DO NOTHING
            """), {"course_id": course_id, "user_id": user_id})
            message += f" та прив'язано до курсу {course_id}"

        session.commit()
        return jsonify({
            "message": message,
            "user": {
                "id": user_id,
                "name": name,
                "email": email
            }
        }), 201

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


@app.route('/statistics', methods=['GET'])
@token_required
def get_statistics():
    """
    Отримання статистики відвідуваності
    ---
    tags:
      - Attendance
    description: |
      Доступ — Студент або Викладач.
      Якщо запит робить Студент, повертає його особисту статистику по кожному курсу.
      Якщо запит робить Викладач, повертає розгорнуту статистику по всіх його курсах у розрізі студентів.
    security:
      - Bearer: []
    responses:
      200:
        description: Успішно отримано статистику
        schema:
          type: array
          items:
            type: object
      500:
        description: Внутрішня помилка сервера
    """
    user_id = getattr(request, 'user', {}).get('user_id')
    requested_role = request.args.get('role', 'student')

    session = Session()
    try:
        if requested_role == 'teacher':
            global_role = session.execute(
                text("SELECT global_role::text FROM users WHERE id = :user_id"), 
                {"user_id": user_id}
            ).scalar()
            if global_role == 'admin':
                query = text("""
                    SELECT c.id, c.name, c.term,
                           (SELECT COUNT(*) FROM events e WHERE e.course_id = c.id AND e.start_datetime <= NOW()) AS total_events,
                           (SELECT COUNT(*) FROM course_members cm WHERE cm.course_id = c.id AND LOWER(TRIM(cm.course_role::text)) = 'student') AS total_students
                    FROM courses c
                """)
                rows = session.execute(query).fetchall()
            else:
                query = text("""
                    SELECT c.id, c.name, c.term,
                           (SELECT COUNT(*) FROM events e WHERE e.course_id = c.id AND e.start_datetime <= NOW()) AS total_events,
                           (SELECT COUNT(*) FROM course_members cm WHERE cm.course_id = c.id AND LOWER(TRIM(cm.course_role::text)) = 'student') AS total_students
                    FROM courses c
                    JOIN course_members cm ON cm.course_id = c.id
                    WHERE cm.user_id = :user_id AND LOWER(TRIM(cm.course_role::text)) = 'teacher'
                """)
                rows = session.execute(query, {"user_id": user_id}).fetchall()

            stats = []
            for r in rows:
                course_id, name, term, total_events, total_students = r

                att_query = text("""
                    SELECT COUNT(*) FROM attendance a
                    JOIN events e ON a.event_id = e.id
                    WHERE e.course_id = :course_id AND a.status = 'present' AND e.start_datetime <= NOW()
                """)
                present_count = session.execute(att_query, {"course_id": course_id}).scalar() or 0

                possible_attendance = total_events * total_students
                avg_attendance = (present_count / possible_attendance * 100) if possible_attendance > 0 else 0

                at_risk = 0
                rule_query = text("""
                    SELECT value FROM rules 
                    WHERE course_id = :course_id AND type = 'minimum_percentage'
                    LIMIT 1
                """)
                min_pct_required = session.execute(rule_query, {"course_id": course_id}).scalar()

                if min_pct_required and total_events > 0:
                    per_student_query = text("""
                        SELECT cm.user_id,
                               COUNT(a.id) FILTER (WHERE a.status = 'present') AS attended
                        FROM course_members cm
                        LEFT JOIN events e ON e.course_id = cm.course_id AND e.start_datetime <= NOW()
                        LEFT JOIN attendance a ON a.event_id = e.id AND a.student_id = cm.user_id
                        WHERE cm.course_id = :course_id AND cm.course_role::text = 'student'
                        GROUP BY cm.user_id
                    """)
                    student_rows = session.execute(per_student_query, {"course_id": course_id}).fetchall()
                    for sr in student_rows:
                        student_pct = (sr.attended / total_events * 100) if total_events > 0 else 0
                        if student_pct < float(min_pct_required):
                            at_risk += 1

                stats.append({
                    "course_id": course_id,
                    "course_name": name,
                    "term": term,
                    "total_events": total_events,
                    "total_students": total_students,
                    "average_attendance_pct": round(avg_attendance, 2),
                    "at_risk_students": at_risk
                })
            return jsonify(stats), 200

        else:
            global_streak_query = text("""
                WITH global_ordered AS (
                    SELECT a.status, e.start_datetime,
                        ROW_NUMBER() OVER (ORDER BY e.start_datetime DESC) - 
                        ROW_NUMBER() OVER (PARTITION BY a.status ORDER BY e.start_datetime DESC) as grp
                    FROM events e
                    JOIN attendance a ON a.event_id = e.id
                    WHERE a.student_id = :user_id AND e.start_datetime <= NOW()
                )
                SELECT COUNT(*) FROM global_ordered WHERE status = 'present' AND grp = 0
            """)
            global_streak_value = session.execute(global_streak_query, {"user_id": user_id}).scalar() or 0

            student_query = text("""
                WITH ordered_attendance AS (
                    SELECT 
                        e.course_id,
                        a.status,
                        e.start_datetime,
                        ROW_NUMBER() OVER (PARTITION BY e.course_id ORDER BY e.start_datetime DESC) - 
                        ROW_NUMBER() OVER (PARTITION BY e.course_id, a.status ORDER BY e.start_datetime DESC) as grp
                    FROM events e
                    JOIN attendance a ON a.event_id = e.id
                    WHERE a.student_id = :user_id AND e.start_datetime <= NOW()
                ),
                current_streaks AS (
                    SELECT 
                        course_id,
                        COUNT(*) as current_streak
                    FROM ordered_attendance
                    WHERE status = 'present' AND grp = 0
                    GROUP BY course_id
                )
                SELECT c.id, c.name, c.term,
                       (SELECT COUNT(*) FROM events e WHERE e.course_id = c.id AND e.start_datetime <= NOW()) AS total,
                       (SELECT COUNT(*) FROM attendance a JOIN events e ON a.event_id = e.id WHERE e.course_id = c.id AND a.student_id = :user_id AND a.status = 'present') AS attended,
                       COALESCE(cs.current_streak, 0) as streak
                FROM courses c
                JOIN course_members cm ON cm.course_id = c.id
                LEFT JOIN current_streaks cs ON cs.course_id = c.id
                WHERE cm.user_id = :user_id AND LOWER(TRIM(cm.course_role::text)) = 'student'
            """)

            rows = session.execute(student_query, {"user_id": user_id}).fetchall()

            stats = []
            for r in rows:
                course_id, name, term, total, attended, streak = r
                pct = (attended / total * 100) if total > 0 else 0

                rule_query = text("""
                    SELECT value FROM rules 
                    WHERE course_id = :course_id AND type = 'minimum_percentage'
                    LIMIT 1
                """)
                min_pct_required = session.execute(rule_query, {"course_id": course_id}).scalar()

                warning_message = None
                if min_pct_required and pct < float(min_pct_required):
                    warning_message = f"Твій відсоток відвідуваності ({round(pct, 1)}%) нижчий за мінімальний ліміт курсу ({float(min_pct_required)}%). Загроза штрафних балів!"

                stats.append({
                    "course_id": course_id,
                    "course_name": name,
                    "term": term,
                    "total_events": total,
                    "attended_events": attended,
                    "attendance_pct": round(pct, 2),
                    "current_streak": streak,
                    "global_streak": global_streak_value,
                    "warning": warning_message
                })

            return jsonify(stats), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/events', methods=['POST'])
@token_required
@roles_allowed('teacher', 'admin')
def create_event():
    """
    Додавання нового заняття (події) до курсу
    ---
    tags:
      - Events
    description: Доступ — Викладач або Адміністратор. Додає одне конкретне заняття до існуючого курсу.
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - course_id
            - title
            - start_datetime
            - end_datetime
            - event_type
          properties:
            course_id:
              type: integer
              example: 1
            title:
              type: string
              example: "Лекція 3. Стек та черга"
            start_datetime:
              type: string
              description: "ISO 8601 формат дати та часу"
              example: "2026-10-15T10:00:00Z"
            end_datetime:
              type: string
              description: "ISO 8601 format date details"
              example: "2026-10-15T11:20:00Z"
            event_type:
              type: string
              example: "Лекція"
    responses:
      201:
        description: Заняття успішно створено
      400:
        description: Помилка валідації вхідних даних
      404:
        description: Курс не знайдено
    """
    body = request.get_json() or {}
    required_fields = ["course_id", "title", "start_datetime", "end_datetime", "event_type"]

    for field in required_fields:
        if field not in body:
            return jsonify({"error": f"Поле {field} обов'язкове"}), 400
    event_type = body.get('event_type', 'Лекція')
    session = Session()
    try:
        course_exists = session.execute(
            text("SELECT id FROM courses WHERE id = :c_id"),
            {"c_id": body["course_id"]}
        ).fetchone()

        if not course_exists:
            return jsonify({"error": f"Курс з ID {body['course_id']} не знайдено"}), 404

        row = session.execute(text("""
              INSERT INTO events (course_id, title, event_type, start_datetime, end_datetime, created_at)
              VALUES (:course_id, :title, :event_type, :start_datetime, :end_datetime, NOW())
              RETURNING id, course_id, title, event_type, start_datetime, end_datetime
          """), {
              "course_id": body["course_id"],
              "title": body["title"],
              "event_type": event_type,
              "start_datetime": body["start_datetime"],
              "end_datetime": body["end_datetime"]
          }).fetchone()

        session.commit()

        return jsonify({
            "id": row.id,
            "course_id": row.course_id,
            "title": row.title,
            "event_type": row.event_type,
            "start_datetime": row.start_datetime.isoformat(),
            "end_datetime": row.end_datetime.isoformat()
        }), 201

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/events/<int:event_id>', methods=['PUT'])
@token_required
@roles_allowed('teacher', 'admin')
def update_event(event_id):
    """
    Редагування існуючого заняття (події)
    ---
    tags:
      - Events
    description: Доступ — Викладач або Адміністратор. Оновлює інформацію про заняття (назву, час початку чи завершення).
    security:
      - Bearer: []
    parameters:
      - in: path
        name: event_id
        required: true
        type: integer
        example: 5
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            title:
              type: string
              example: "Оновлена назва лекції"
            start_datetime:
              type: string
              example: "2026-10-15T10:30:00Z"
            end_datetime:
              type: string
              example: "2026-10-15T11:50:00Z"
    responses:
      200:
        description: Заняття успішно відредаговано
      404:
        description: Заняття не знайдено
    """
    body = request.get_json() or {}

    session = Session()
    try:
        event = session.execute(
            text("SELECT id, title, start_datetime, end_datetime FROM events WHERE id = :id"),
            {"id": event_id}
        ).fetchone()

        if not event:
            return jsonify({"error": f"Заняття з ID {event_id} не знайдено"}), 404

        new_title = body.get("title", event.title)
        new_start = body.get("start_datetime", event.start_datetime)
        new_end = body.get("end_datetime", event.end_datetime)

        updated_row = session.execute(text("""
            UPDATE events 
            SET title = :title, start_datetime = :start, end_datetime = :end
            WHERE id = :id
            RETURNING id, course_id, title, start_datetime, end_datetime
        """), {
            "title": new_title,
            "start": new_start,
            "end": new_end,
            "id": event_id
        }).fetchone()

        session.commit()

        return jsonify({
            "message": "Заняття успішно оновлено",
            "event": {
                "id": updated_row.id,
                "course_id": updated_row.course_id,
                "title": updated_row.title,
                "start_datetime": updated_row.start_datetime.isoformat(),
                "end_datetime": updated_row.end_datetime.isoformat()
            }
        }), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/events/<int:event_id>', methods=['DELETE'])
@token_required
@roles_allowed('teacher', 'admin')
def delete_event(event_id):
    """
    Видалення заняття (події)
    ---
    tags:
      - Events
    description: Доступ — Викладач або Адміністратор. Повністю видаляє заняття з розкладу та пов'язану з ним історію відвідуваності.
    security:
      - Bearer: []
    parameters:
      - in: path
        name: event_id
        required: true
        type: integer
        example: 5
    responses:
      200:
        description: Заняття успішно видалено
      404:
        description: Заняття не знайдено
      500:
        description: Внутрішня помилка сервера
    """
    session = Session()
    try:
        event = session.execute(
            text("SELECT id, title FROM events WHERE id = :id"),
            {"id": event_id}
        ).fetchone()

        if not event:
            return jsonify({"error": f"Заняття з ID {event_id} не знайдено"}), 404

        session.execute(
            text("DELETE FROM events WHERE id = :id"),
            {"id": event_id}
        )

        session.commit()

        return jsonify({
            "message": f"Заняття '{event.title}' (ID: {event_id}) успішно видалено"
        }), 200

    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/events/today', methods=['GET'])
@token_required
def get_today_events():
    """
    Отримати розклад занять на сьогодні
    ---
    tags:
      - Events
    description: |
      Доступ — Будь-яка авторизована роль. Повертає список занять на сьогодні
      для курсів, де користувач має вказану роль (student або teacher).
    security:
      - Bearer: []
    parameters:
      - in: query
        name: role
        schema:
          type: string
          enum: [student, teacher]
        required: false
        description: Роль, у контексті якої показувати розклад (за замовчуванням student)
    responses:
      200:
        description: Список занять користувача на сьогодні
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              event_title:
                type: string
                example: "Лекція: Booleans, conditions, loops"
              course_name:
                type: string
                example: "Economics and Big Data"
              teacher_name:
                type: string
                example: "Volodymyr Skochko"
              start_datetime:
                type: string
                format: date-time
              end_datetime:
                type: string
                format: date-time
      401:
        description: Не авторизовано або протермінований токен
      500:
        description: Внутрішня помилка сервера
    """
    user_id = getattr(request, 'user', {}).get('user_id')
    requested_role = request.args.get('role', 'student')

    if requested_role not in ('student', 'teacher'):
        requested_role = 'student'

    session = Session()
    try:
        query = text("""
            SELECT 
                e.id, 
                e.title as event_title, 
                e.start_datetime, 
                e.end_datetime, 
                c.name as course_name, 
                c.id as course_id,
                (SELECT u.name FROM users u 
                 JOIN course_members tcm ON tcm.user_id = u.id 
                 WHERE tcm.course_id = c.id AND tcm.course_role::text = 'teacher' LIMIT 1) as teacher_name
            FROM events e
            JOIN courses c ON e.course_id = c.id
            JOIN course_members cm ON cm.course_id = c.id
            WHERE cm.user_id = :user_id
              AND cm.course_role::text = :role
              AND DATE(e.start_datetime) = CURRENT_DATE
            ORDER BY e.start_datetime
        """)
        rows = session.execute(query, {"user_id": user_id, "role": requested_role}).fetchall()

        events = []
        for r in rows:
            events.append({
                "id": r.id,
                "course_id": r.course_id,
                "event_title": r.event_title,
                "course_name": r.course_name,
                "teacher_name": r.teacher_name or "Не призначено",
                "start_datetime": r.start_datetime.isoformat(),
                "end_datetime": r.end_datetime.isoformat()
            })

        return jsonify(events), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/achievements', methods=['GET'])
@token_required
def get_achievements():
    user_id = getattr(request, 'user', {}).get('user_id')

    session = Session()
    try:
        query = text("""
            SELECT DISTINCT
                r.id AS rule_id,
                r.name AS achievement_title, 
                r.type AS rule_type, 
                r.value AS bonus_value, 
                a.earned_at, 
                c.name AS course_name
            FROM rules r
            LEFT JOIN courses c ON r.course_id = c.id
            LEFT JOIN achievements a ON a.rule_id = r.id AND a.student_id = :user_id
            WHERE r.course_id IS NULL 
               OR r.course_id IN (
                   SELECT course_id FROM course_members WHERE user_id = :user_id AND course_role = 'student'
               )
            ORDER BY a.earned_at DESC NULLS LAST, r.name
        """)

        rows = session.execute(query, {"user_id": user_id}).fetchall()

        achievements_list = []
        unlocked_count = 0
        
        for r in rows:
            is_unlocked = r.earned_at is not None
            if is_unlocked:
                unlocked_count += 1
                
            achievements_list.append({
                "id": str(r.rule_id),
                "title": r.achievement_title,
                "type": r.rule_type,
                "bonus": float(r.bonus_value) if r.bonus_value else 0,
                "earned_at": r.earned_at.strftime("%Y-%m-%d") if r.earned_at else None,
                "course": r.course_name,
                "unlocked": is_unlocked
            })

        return jsonify({
            "total_unlocked": unlocked_count,
            "achievements": achievements_list
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/events/<int:event_id>/attendance', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_event_attendance(event_id):
    session = Session()
    try:
        event = session.execute(text("SELECT id, course_id FROM events WHERE id = :id"), {"id": event_id}).fetchone()
        if not event:
            return jsonify({"error": "Заняття не знайдено"}), 404

        total_students = session.execute(text("""
            SELECT COUNT(*) FROM course_members WHERE course_id = :course_id AND course_role = 'student'
        """), {"course_id": event.course_id}).scalar() or 0

        present = session.execute(text("""
            SELECT COUNT(*) FROM attendance WHERE event_id = :event_id AND status = 'present'
        """), {"event_id": event_id}).scalar() or 0

        return jsonify({"present": present, "total_students": total_students}), 200
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
@app.route('/courses/<int:course_id>/rules', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_course_rules(course_id):
    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        rows = session.execute(text("""
            SELECT id, name, type, value FROM rules WHERE course_id = :course_id ORDER BY id
        """), {"course_id": course_id}).fetchall()

        return jsonify([{
            "id": r.id, "name": r.name, "type": r.type, "value": float(r.value) if r.value is not None else None
        } for r in rows]), 200
    finally:
        session.close()


@app.route('/courses/<int:course_id>/rules', methods=['POST'])
@token_required
@roles_allowed('teacher', 'admin')
def create_course_rule(course_id):
    body = request.get_json() or {}
    name = (body.get('name') or '').strip()
    rule_type = (body.get('type') or '').strip()
    value = body.get('value')

    if not name:
        return jsonify({"error": "Поле name обов'язкове"}), 400
    if not rule_type:
        return jsonify({"error": "Поле type обов'язкове"}), 400
    if value is None:
        return jsonify({"error": "Поле value обов'язкове"}), 400

    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        row = session.execute(text("""
            INSERT INTO rules (course_id, name, type, value) VALUES (:course_id, :name, :type, :value)
            RETURNING id, name, type, value
        """), {"course_id": course_id, "name": name, "type": rule_type, "value": value}).fetchone()
        session.commit()

        return jsonify({"id": row.id, "name": row.name, "type": row.type, "value": float(row.value)}), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/rules/<int:rule_id>', methods=['PUT'])
@token_required
@roles_allowed('teacher', 'admin')
def update_course_rule(rule_id):
    body = request.get_json() or {}
    session = Session()
    try:
        rule = session.execute(text("SELECT id, name, type, value FROM rules WHERE id = :id"), {"id": rule_id}).fetchone()
        if not rule:
            return jsonify({"error": "Правило не знайдено"}), 404

        new_name = body.get("name", rule.name)
        new_type = body.get("type", rule.type)
        new_value = body.get("value", rule.value)

        updated = session.execute(text("""
            UPDATE rules SET name = :name, type = :type, value = :value WHERE id = :id
            RETURNING id, name, type, value
        """), {"name": new_name, "type": new_type, "value": new_value, "id": rule_id}).fetchone()
        session.commit()

        return jsonify({"id": updated.id, "name": updated.name, "type": updated.type, "value": float(updated.value)}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/rules/<int:rule_id>', methods=['DELETE'])
@token_required
@roles_allowed('teacher', 'admin')
def delete_course_rule(rule_id):
    session = Session()
    try:
        result = session.execute(text("DELETE FROM rules WHERE id = :id"), {"id": rule_id})
        session.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Правило не знайдено"}), 404
        return jsonify({"message": "Правило видалено"}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
@app.route('/courses/<int:course_id>/achievements', methods=['GET'])
@token_required
@roles_allowed('teacher', 'admin')
def get_course_achievements(course_id):
    session = Session()
    try:
        course = session.execute(text("SELECT id FROM courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not course:
            return jsonify({"error": "Курс не знайдено"}), 404

        total_students = session.execute(text("""
            SELECT COUNT(*) FROM course_members WHERE course_id = :course_id AND course_role = 'student'
        """), {"course_id": course_id}).scalar() or 0

        rows = session.execute(text("""
            SELECT r.id, r.name, r.type, r.value,
                   COUNT(a.id) AS unlocked_count
            FROM rules r
            LEFT JOIN achievements a ON a.rule_id = r.id
            WHERE r.course_id = :course_id AND r.type != 'minimum_percentage'
            GROUP BY r.id, r.name, r.type, r.value
            ORDER BY r.id
        """), {"course_id": course_id}).fetchall()

        return jsonify([{
            "id": r.id, "name": r.name, "type": r.type, "value": float(r.value) if r.value is not None else None,
            "unlocked_count": r.unlocked_count, "total_students": total_students
        } for r in rows]), 200
    finally:
        session.close()
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
