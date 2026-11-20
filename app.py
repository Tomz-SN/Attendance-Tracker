import os
import io
import csv
from dotenv import load_dotenv
load_dotenv()  # Load .env for local development (no-op in production)

from flask import Flask, render_template, request, jsonify, session, Response
from database import (
    init_master_db, register_user, authenticate_user,
    get_user_by_id, update_user_settings, get_student_subjects,
    add_student_subject, update_student_subject, delete_student_subject,
    get_student_attendance, add_student_attendance, delete_student_attendance,
    quick_log, get_overall_statistics
)

app = Flask(__name__, static_folder='public/static')
app.secret_key = os.environ.get('SECRET_KEY')

# Production Security Configurations
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
if os.environ.get('FLASK_ENV') == 'production' or os.environ.get('VERCEL'):
    app.config['SESSION_COOKIE_SECURE'] = True

_database_initialized = False


@app.before_request
def initialize_database():
    global _database_initialized
    if not request.endpoint or not request.endpoint.startswith('api_'):
        return

    missing_config = []
    if not app.secret_key:
        missing_config.append('SECRET_KEY')
    if not os.environ.get('DATABASE_URL'):
        missing_config.append('DATABASE_URL')
    if missing_config:
        return jsonify({
            "error": "Server configuration error",
            "message": (
                f"Missing required server configuration: {', '.join(missing_config)}. "
                "Set these environment variables and restart the app."
            )
        }), 503

    if _database_initialized:
        return
    init_master_db()
    _database_initialized = True

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized", "message": "Please log in to continue"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "app": "Attendance tracker",
        "credits": "Tom Sanson",
        "github": "Tomz-SN"
    }), 200

# ----------------- Authentication Routes -----------------

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    full_name = data.get('full_name', '').strip()
    target_pct = data.get('desired_percentage', 75.0)

    if not username or not password or not full_name:
        return jsonify({"error": "Validation Error", "message": "Please fill in all required fields"}), 400

    success, result = register_user(username, password, full_name, target_pct)
    if not success:
        return jsonify({"error": "Registration Failed", "message": result}), 400

    session['user_id'] = result['id']
    return jsonify({"success": True, "user": result})

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({"error": "Validation Error", "message": "Username and password required"}), 400

    user, err = authenticate_user(username, password)
    if err or not user:
        return jsonify({"error": "Authentication Failed", "message": err or "Invalid credentials"}), 401

    session['user_id'] = user['id']
    return jsonify({"success": True, "user": user})

@app.route('/api/auth/me', methods=['GET'])
def api_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"authenticated": False}), 200
    user = get_user_by_id(user_id)
    if not user:
        session.pop('user_id', None)
        return jsonify({"authenticated": False}), 200
    return jsonify({"authenticated": True, "user": user})

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.pop('user_id', None)
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route('/api/auth/update-settings', methods=['POST'])
@login_required
def api_update_settings():
    user_id = session['user_id']
    data = request.get_json() or {}
    full_name = data.get('full_name')
    target_pct = data.get('desired_percentage')
    new_password = data.get('new_password')

    updated_user = update_user_settings(user_id, full_name, target_pct, new_password)
    return jsonify({"success": True, "user": updated_user})

# ----------------- Subject Management (Student Isolated) -----------------

@app.route('/api/subjects', methods=['GET'])
@login_required
def api_get_subjects():
    user_id = session['user_id']
    subjects = get_student_subjects(user_id)
    return jsonify({"subjects": subjects})

@app.route('/api/subjects', methods=['POST'])
@login_required
def api_add_subject():
    user_id = session['user_id']
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    code = data.get('code', '').strip()
    color = data.get('color', '#8b5cf6')
    target_pct = data.get('target_percentage', 75.0)

    if not name:
        return jsonify({"error": "Validation Error", "message": "Subject name is required"}), 400

    new_id, err = add_student_subject(user_id, name, code, color, target_pct)
    if err:
        return jsonify({"error": "Failed to add subject", "message": err}), 400

    return jsonify({"success": True, "id": new_id, "message": f"Subject '{name}' added successfully!"})

@app.route('/api/subjects/<int:subject_id>', methods=['PUT'])
@login_required
def api_update_subject(subject_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    code = data.get('code', '').strip()
    color = data.get('color', '#8b5cf6')
    target_pct = data.get('target_percentage', 75.0)

    if not name:
        return jsonify({"error": "Validation Error", "message": "Subject name cannot be empty"}), 400

    updated, err = update_student_subject(user_id, subject_id, name, code, color, target_pct)
    if err or not updated:
        return jsonify({"error": "Update Failed", "message": err or "Subject not found"}), 404

    return jsonify({"success": True, "message": "Subject updated successfully"})

@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
@login_required
def api_delete_subject(subject_id):
    user_id = session['user_id']
    deleted = delete_student_subject(user_id, subject_id)
    if not deleted:
        return jsonify({"error": "Not Found", "message": "Subject not found"}), 404
    return jsonify({"success": True, "message": "Subject and its attendance records deleted"})

# ----------------- Manual Hours Logging & Removal -----------------

@app.route('/api/attendance', methods=['GET'])
@login_required
def api_get_attendance():
    user_id = session['user_id']
    subject_id = request.args.get('subject_id', type=int)
    limit = request.args.get('limit', default=200, type=int)
    records = get_student_attendance(user_id, subject_id=subject_id, limit=limit)
    return jsonify({"records": records})

@app.route('/api/attendance', methods=['POST'])
@login_required
def api_add_attendance():
    user_id = session['user_id']
    data = request.get_json() or {}
    subject_id = data.get('subject_id')
    date_str = data.get('date', '').strip()
    hours_conducted = data.get('hours_conducted', 1.0)
    hours_attended = data.get('hours_attended', 1.0)
    status = data.get('status', 'present')
    note = data.get('note', '').strip()

    if not subject_id:
        return jsonify({"error": "Validation Error", "message": "Please select a subject"}), 400

    try:
        subject_id = int(subject_id)
    except ValueError:
        return jsonify({"error": "Validation Error", "message": "Invalid subject ID"}), 400

    rec_id = add_student_attendance(
        user_id, subject_id, date_str,
        hours_conducted=hours_conducted,
        hours_attended=hours_attended,
        status=status,
        note=note
    )

    return jsonify({"success": True, "id": rec_id, "message": "Attendance record saved!"})

@app.route('/api/attendance/<int:record_id>', methods=['DELETE'])
@login_required
def api_delete_attendance(record_id):
    user_id = session['user_id']
    deleted = delete_student_attendance(user_id, record_id)
    if not deleted:
        return jsonify({"error": "Not Found", "message": "Attendance record not found"}), 404
    return jsonify({"success": True, "message": "Hours entry removed from your record"})

@app.route('/api/attendance/quick', methods=['POST'])
@login_required
def api_quick_log():
    user_id = session['user_id']
    data = request.get_json() or {}
    subject_id = data.get('subject_id')
    action = data.get('action') # 'present' or 'absent'

    if not subject_id or action not in ['present', 'absent']:
        return jsonify({"error": "Validation Error", "message": "Valid subject ID and action required"}), 400

    try:
        subject_id = int(subject_id)
    except ValueError:
        return jsonify({"error": "Validation Error", "message": "Invalid subject ID"}), 400

    rec_id = quick_log(user_id, subject_id, action)
    if not rec_id:
        return jsonify({"error": "Logging failed"}), 500

    msg = "+1 Hour Attended logged!" if action == 'present' else "+1 Hour Missed logged!"
    return jsonify({"success": True, "id": rec_id, "message": msg})

# ----------------- Statistics & Bunk Calculator -----------------

@app.route('/api/statistics', methods=['GET'])
@login_required
def api_get_statistics():
    user_id = session['user_id']
    custom_target = request.args.get('target', type=float)
    stats = get_overall_statistics(user_id, custom_target=custom_target)
    if not stats:
        return jsonify({"error": "Unable to calculate statistics"}), 500
    return jsonify(stats)

@app.route('/api/export-csv', methods=['GET'])
@login_required
def api_export_csv():
    user_id = session['user_id']
    records = get_student_attendance(user_id, limit=5000)
    user = get_user_by_id(user_id)

    si = io.StringIO()
    writer = csv.writer(si)
    writer.writerow(['Attendance Tracker - Student Report'])
    writer.writerow(['Student Name', user['full_name'] if user else 'Student'])
    writer.writerow(['Username', user['username'] if user else ''])
    writer.writerow(['Target Attendance %', user['desired_percentage'] if user else '75'])
    writer.writerow(['Credits', 'Tom Sanson (GitHub: Tomz-SN)'])
    writer.writerow([])
    writer.writerow(['Date', 'Subject Code', 'Subject Name', 'Hours Conducted', 'Hours Attended', 'Status', 'Notes'])

    for r in records:
        writer.writerow([
            r['date'],
            r['subject_code'],
            r['subject_name'],
            r['hours_conducted'],
            r['hours_attended'],
            r['status'].capitalize(),
            r['note']
        ])

    output = si.getvalue()
    filename = f"attendance_report_{user['username'] if user else 'student'}.csv"
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('PROD') == '1'

    print(f"============================================================")
    print(f"  Attendance Tracker - Ready!")
    print(f"  Local Access Link : http://localhost:{port}")
    print(f"  Network Link      : http://127.0.0.1:{port}")
    print(f"  Mode              : {'Production (Waitress WSGI)' if is_prod else 'Development'}")
    print(f"  Credits           : Tom Sanson | GitHub: Tomz-SN (Footer)")
    print(f"============================================================")

    if is_prod:
        try:
            from waitress import serve
            print(f"Serving with production Waitress WSGI server on http://{host}:{port}...")
            serve(app, host=host, port=port)
        except ImportError:
            app.run(host=host, port=port, debug=False)
    else:
        app.run(host=host, port=port, debug=True)
