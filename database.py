"""
Attendance Tracker — PostgreSQL Database Layer
Designed for Vercel + Neon (or any PostgreSQL provider).
Credits: Tom Sanson | GitHub: Tomz-SN
"""

import os
import hashlib
import math
import re
from datetime import datetime

import psycopg2
import psycopg2.extras

# DATABASE_URL is set in Vercel's Environment Variables panel
# Format: postgresql://user:password@host/dbname?sslmode=require
def get_db():
    """Open a fresh PostgreSQL connection. Called per request."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set it in your local .env file or Vercel Environment Variables."
        )
    conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def _hash_password(password: str) -> str:
    salt = os.environ.get('PASSWORD_SALT', 'cosmo_attendance_salt_2026_enterprise')
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()


# ─────────────────────────────────────────────────────────────────
#  Schema Bootstrap  (called once on first deploy / startup)
# ─────────────────────────────────────────────────────────────────

def init_master_db():
    """Create the users table if it does not exist yet."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            desired_percentage DOUBLE PRECISION DEFAULT 75.0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)")
    conn.commit()
    cur.close()
    conn.close()


def create_student_tables(user_id: int):
    """
    Provision the student's private isolated tables the first time they log in.
    student_subjects_<id>   — subjects registered by this student only
    student_attendance_<id> — attendance logs for this student only
    """
    if not isinstance(user_id, int) or user_id <= 0:
        raise ValueError("Invalid user ID")

    conn = get_db()
    cur = conn.cursor()

    # Subjects table
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS student_subjects_{user_id} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            color TEXT DEFAULT '#8b5cf6',
            target_percentage DOUBLE PRECISION DEFAULT 75.0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Attendance records table
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS student_attendance_{user_id} (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            hours_conducted DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            hours_attended DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            status TEXT NOT NULL DEFAULT 'present',
            note TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Indexes
    cur.execute(f"CREATE INDEX IF NOT EXISTS idx_att_{user_id}_sub  ON student_attendance_{user_id} (subject_id)")
    cur.execute(f"CREATE INDEX IF NOT EXISTS idx_att_{user_id}_date ON student_attendance_{user_id} (date)")

    conn.commit()
    cur.close()
    conn.close()


# ─────────────────────────────────────────────────────────────────
#  Auth — Register & Login
# ─────────────────────────────────────────────────────────────────

def register_user(username, password, full_name, desired_percentage=75.0):
    username = username.strip().lower()
    full_name = full_name.strip()

    if not username or len(username) < 3:
        return False, "Username must be at least 3 characters long."
    if not re.match(r'^[a-zA-Z0-9_.\-]+$', username):
        return False, "Username can only contain letters, numbers, dots, hyphens, and underscores."
    if not password or len(password) < 6:
        return False, "Password must be at least 6 characters long."
    if not full_name or len(full_name) < 2:
        return False, "Please enter your full name."

    try:
        desired_percentage = float(desired_percentage)
        if desired_percentage <= 0 or desired_percentage > 100:
            desired_percentage = 75.0
    except (ValueError, TypeError):
        desired_percentage = 75.0

    pw_hash = _hash_password(password)
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name, desired_percentage) VALUES (%s, %s, %s, %s) RETURNING id",
            (username, pw_hash, full_name, desired_percentage)
        )
        user_id = cur.fetchone()['id']
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return False, "This username is already taken. Please choose another or log in."
    finally:
        cur.close()
        conn.close()

    create_student_tables(user_id)
    return True, {"id": user_id, "username": username, "full_name": full_name, "desired_percentage": desired_percentage}


def authenticate_user(username, password):
    username = username.strip().lower()
    if not username or not password:
        return None, "Username and password are required"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return None, "Account not found. Please check your username or register."

    if row['password_hash'] != _hash_password(password):
        return None, "Incorrect password. Please try again."

    create_student_tables(row['id'])

    return {
        "id": row['id'],
        "username": row['username'],
        "full_name": row['full_name'],
        "desired_percentage": float(row['desired_percentage'])
    }, None


def get_user_by_id(user_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, full_name, desired_percentage, created_at FROM users WHERE id = %s",
        (user_id,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return {
            "id": row['id'],
            "username": row['username'],
            "full_name": row['full_name'],
            "desired_percentage": float(row['desired_percentage']),
            "created_at": str(row['created_at'])
        }
    return None


def update_user_settings(user_id: int, full_name=None, desired_percentage=None, new_password=None):
    updates = []
    params = []

    if full_name and len(full_name.strip()) >= 2:
        updates.append("full_name = %s")
        params.append(full_name.strip())
    if desired_percentage is not None:
        try:
            target = max(1.0, min(100.0, float(desired_percentage)))
            updates.append("desired_percentage = %s")
            params.append(target)
        except ValueError:
            pass
    if new_password and len(new_password) >= 6:
        updates.append("password_hash = %s")
        params.append(_hash_password(new_password))

    if updates:
        params.append(user_id)
        conn = get_db()
        cur = conn.cursor()
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", params)
        conn.commit()
        cur.close()
        conn.close()

    return get_user_by_id(user_id)


# ─────────────────────────────────────────────────────────────────
#  Subjects CRUD  (student-isolated)
# ─────────────────────────────────────────────────────────────────

def get_student_subjects(user_id: int):
    create_student_tables(user_id)
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT
            s.*,
            COALESCE(SUM(a.hours_conducted), 0) AS total_conducted,
            COALESCE(SUM(a.hours_attended),  0) AS total_attended,
            COUNT(a.id)                           AS sessions_count
        FROM student_subjects_{user_id} s
        LEFT JOIN student_attendance_{user_id} a ON s.id = a.subject_id
        GROUP BY s.id
        ORDER BY s.name ASC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    subjects = []
    for r in rows:
        conducted = float(r['total_conducted'])
        attended  = float(r['total_attended'])
        percentage = round(attended / conducted * 100, 1) if conducted > 0 else 100.0
        target     = float(r['target_percentage'])

        if conducted == 0:
            bunk_status = {"can_bunk": 0, "need_attend": 0, "status": "neutral", "message": "No classes recorded yet"}
        elif percentage >= target:
            safe = max(0, math.floor((attended * 100.0 / target) - conducted))
            bunk_status = {"can_bunk": safe, "need_attend": 0, "status": "safe",
                           "message": f"You can safely miss {safe} class{'es' if safe != 1 else ''}"}
        else:
            needed = 999 if target >= 100 else max(1, math.ceil(
                (target * conducted - 100.0 * attended) / (100.0 - target)
            ))
            bunk_status = {"can_bunk": 0, "need_attend": needed, "status": "warning",
                           "message": f"Attend next {needed} class{'es' if needed != 1 else ''} to reach {target}%"}

        subjects.append({
            "id":                r['id'],
            "name":              r['name'],
            "code":              r['code'] or '',
            "color":             r['color'] or '#8b5cf6',
            "target_percentage": target,
            "total_conducted":   conducted,
            "total_attended":    attended,
            "total_missed":      max(0.0, round(conducted - attended, 1)),
            "percentage":        percentage,
            "sessions_count":    r['sessions_count'],
            "bunk_status":       bunk_status,
            "created_at":        str(r['created_at'])
        })
    return subjects


def add_student_subject(user_id: int, name: str, code='', color='#8b5cf6', target_percentage=75.0):
    create_student_tables(user_id)
    name = name.strip()
    if not name:
        return None, "Subject name cannot be empty"

    code  = (code or '').strip().upper()
    color = (color or '#8b5cf6').strip()
    try:
        target = float(target_percentage)
    except (ValueError, TypeError):
        target = 75.0

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO student_subjects_{user_id} (name, code, color, target_percentage) VALUES (%s, %s, %s, %s) RETURNING id",
        (name, code, color, target)
    )
    new_id = cur.fetchone()['id']
    conn.commit()
    cur.close()
    conn.close()
    return new_id, None


def update_student_subject(user_id: int, subject_id: int, name: str, code='', color='#8b5cf6', target_percentage=75.0):
    create_student_tables(user_id)
    name = name.strip()
    if not name:
        return False, "Subject name cannot be empty"

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE student_subjects_{user_id} SET name=%s, code=%s, color=%s, target_percentage=%s WHERE id=%s",
        (name, (code or '').strip().upper(), (color or '#8b5cf6').strip(), float(target_percentage), subject_id)
    )
    updated = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return updated, None if updated else "Subject not found"


def delete_student_subject(user_id: int, subject_id: int):
    create_student_tables(user_id)
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM student_attendance_{user_id} WHERE subject_id = %s", (subject_id,))
    cur.execute(f"DELETE FROM student_subjects_{user_id} WHERE id = %s",           (subject_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return deleted


# ─────────────────────────────────────────────────────────────────
#  Attendance Logs  (student-isolated)
# ─────────────────────────────────────────────────────────────────

def get_student_attendance(user_id: int, subject_id: int = None, limit: int = 200):
    create_student_tables(user_id)
    conn = get_db()
    cur = conn.cursor()

    sql = f"""
        SELECT a.*, s.name AS subject_name, s.code AS subject_code, s.color AS subject_color
        FROM student_attendance_{user_id} a
        JOIN student_subjects_{user_id} s ON a.subject_id = s.id
    """
    params = []
    if subject_id:
        sql += " WHERE a.subject_id = %s"
        params.append(subject_id)
    sql += " ORDER BY a.date DESC, a.id DESC LIMIT %s"
    params.append(limit)

    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [{
        "id":             r['id'],
        "subject_id":     r['subject_id'],
        "subject_name":   r['subject_name'],
        "subject_code":   r['subject_code'],
        "subject_color":  r['subject_color'],
        "date":           r['date'],
        "hours_conducted": float(r['hours_conducted']),
        "hours_attended":  float(r['hours_attended']),
        "status":          r['status'],
        "note":            r['note'] or '',
        "created_at":      str(r['created_at'])
    } for r in rows]


def add_student_attendance(user_id: int, subject_id: int, date_str: str,
                           hours_conducted=1.0, hours_attended=1.0,
                           status='present', note=''):
    create_student_tables(user_id)
    if not date_str:
        date_str = datetime.now().strftime('%Y-%m-%d')

    try:
        conducted = max(0.5, float(hours_conducted))
    except (ValueError, TypeError):
        conducted = 1.0
    try:
        attended = max(0.0, min(conducted, float(hours_attended)))
    except (ValueError, TypeError):
        attended = conducted if status == 'present' else 0.0

    if status not in ('present', 'absent', 'cancelled', 'duty'):
        status = 'present' if attended > 0 else 'absent'

    if status == 'absent':
        attended = 0.0
    elif status == 'present' and attended == 0.0:
        attended = conducted
    elif status == 'cancelled':
        conducted = 0.0
        attended  = 0.0

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO student_attendance_{user_id}
               (subject_id, date, hours_conducted, hours_attended, status, note)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
        (subject_id, date_str, conducted, attended, status, (note or '').strip())
    )
    record_id = cur.fetchone()['id']
    conn.commit()
    cur.close()
    conn.close()
    return record_id


def delete_student_attendance(user_id: int, record_id: int):
    create_student_tables(user_id)
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM student_attendance_{user_id} WHERE id = %s", (record_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return deleted


def quick_log(user_id: int, subject_id: int, action: str):
    today = datetime.now().strftime('%Y-%m-%d')
    if action == 'present':
        return add_student_attendance(user_id, subject_id, today,
                                      hours_conducted=1.0, hours_attended=1.0,
                                      status='present', note='Quick Log: Present')
    elif action == 'absent':
        return add_student_attendance(user_id, subject_id, today,
                                      hours_conducted=1.0, hours_attended=0.0,
                                      status='absent', note='Quick Log: Absent')
    return None


# ─────────────────────────────────────────────────────────────────
#  Overall Statistics
# ─────────────────────────────────────────────────────────────────

def get_overall_statistics(user_id: int, custom_target: float = None):
    create_student_tables(user_id)
    user = get_user_by_id(user_id)
    if not user:
        return None

    target   = custom_target if custom_target is not None else user['desired_percentage']
    subjects = get_student_subjects(user_id)
    records  = get_student_attendance(user_id, limit=500)

    total_conducted = sum(s['total_conducted'] for s in subjects)
    total_attended  = sum(s['total_attended']  for s in subjects)
    total_missed    = max(0.0, round(total_conducted - total_attended, 1))
    overall_pct     = round(total_attended / total_conducted * 100, 1) if total_conducted > 0 else 100.0

    # Overall bunk status
    if total_conducted == 0:
        overall_bunk = {
            "can_bunk": 0, "need_attend": 0, "status": "neutral",
            "message": "Begin tracking attendance by adding your subjects and logging hours."
        }
    elif overall_pct >= target:
        safe = max(0, math.floor(total_attended * 100.0 / target - total_conducted))
        overall_bunk = {
            "can_bunk": safe, "need_attend": 0, "status": "safe",
            "message": f"Safe! You can miss {safe} overall hour{'s' if safe != 1 else ''} and stay above {target}%."
        }
    else:
        needed = 999 if target >= 100 else max(1, math.ceil(
            (target * total_conducted - 100.0 * total_attended) / (100.0 - target)
        ))
        overall_bunk = {
            "can_bunk": 0, "need_attend": needed, "status": "warning",
            "message": f"Shortage! Attend the next {needed} consecutive hour{'s' if needed != 1 else ''} to reach {target}%."
        }

    # Day-of-week breakdown
    days_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
    dow_stats = {d: {"conducted": 0.0, "attended": 0.0} for d in days_map.values()}
    for r in records:
        if r['hours_conducted'] > 0:
            try:
                dt = datetime.strptime(r['date'], '%Y-%m-%d')
                day = days_map.get(dt.weekday(), 'Mon')
                dow_stats[day]['conducted'] += r['hours_conducted']
                dow_stats[day]['attended']  += r['hours_attended']
            except ValueError:
                pass

    dow_chart_data = []
    for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']:
        c = dow_stats[day]['conducted']
        a = dow_stats[day]['attended']
        dow_chart_data.append({
            "day": day, "conducted": c, "attended": a,
            "percentage": round(a / c * 100, 1) if c > 0 else 0
        })

    # Cumulative timeline
    date_group = {}
    for r in reversed(records):
        d = r['date']
        if d not in date_group:
            date_group[d] = {"conducted": 0.0, "attended": 0.0}
        date_group[d]['conducted'] += r['hours_conducted']
        date_group[d]['attended']  += r['hours_attended']

    timeline = []
    cum_c = cum_a = 0.0
    for d, v in sorted(date_group.items()):
        cum_c += v['conducted']
        cum_a += v['attended']
        timeline.append({
            "date": d,
            "daily_conducted": v['conducted'],
            "daily_attended":  v['attended'],
            "cumulative_percentage": round(cum_a / cum_c * 100, 1) if cum_c > 0 else 100.0
        })

    if overall_pct >= 90:
        badge, badge_color = "Excellent Attendance", "#10b981"
    elif overall_pct >= target:
        badge, badge_color = "Good Standing", "#06b6d4"
    elif overall_pct >= target - 10:
        badge, badge_color = "At Risk", "#f59e0b"
    else:
        badge, badge_color = "Shortage Crisis", "#ef4444"

    return {
        "user":               user,
        "desired_percentage": target,
        "overall_percentage": overall_pct,
        "total_conducted":    total_conducted,
        "total_attended":     total_attended,
        "total_missed":       total_missed,
        "overall_bunk":       overall_bunk,
        "cosmic_badge":       badge,
        "badge_color":        badge_color,
        "subjects":           subjects,
        "dow_chart_data":     dow_chart_data,
        "timeline":           timeline[-20:]
    }
