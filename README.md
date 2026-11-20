# 🌌 Attendance Tracker

An interactive web application designed for students to track attendance, manage class hours, simulate safe bunks, and explore visual analytics, wrapped in a colorful notebook-inspired theme.

Built to scale reliably for thousands of students with strict database table isolation, concurrent WAL-mode storage, and a responsive, sketchbook-style interface.

---


## 🌟 Production Architecture & Features

1. **Student Registration & Strict Database Isolation**:
   - Secure student registration and authentication with SHA-256 salted hashing and input validation.
   - **Private Dedicated Tables**: Every student has dynamically provisioned tables in SQLite:
     - `student_subjects_<user_id>`: Private subjects registered by the student.
     - `student_attendance_<user_id>`: Private attendance records and hours logs.
   - High-concurrency database optimizations: Write-Ahead Logging (`WAL`), `PRAGMA synchronous = NORMAL`, indexed foreign keys and dates to support thousands of active students.

2. **Subject Management**:
   - Enter subject names and optional course codes (e.g. `CS-301`, `MATH-202`).
   - Edit, rename, change target percentages (e.g. 75%, 80%, 85%), assign celestial color accents, or delete subjects with cascading record cleanup.

3. **Manual Hours Logging & Removal**:
   - Manually record class hours with date picker, duration in hours, status (*Present*, *Absent*, *Duty Leave / Medical*, *Cancelled*), and lecture notes.
   - **1-Tap Quick Action Buttons** (`+1 Attended`, `+1 Missed`) directly on each subject card.
   - Remove hours / delete logs anytime with instantaneous recalculation.

4. **Interactive Bunk Calculator (Safe Miss Estimator)**:
   - **Real-Time Slider (50% – 95%)**: Drag the target percentage slider to simulate different attendance goals and instantly calculate safe misses.
   - **Formulas**:
     - **Safe to Bunk**: $\lfloor \frac{\text{Attended} \times 100}{\text{Target\%}} - \text{Conducted} \rfloor$ classes safely without dropping below goal.
     - **Shortage Recovery**: $\lceil \frac{\text{Target\%} \times \text{Conducted} - 100 \times \text{Attended}}{100 - \text{Target\%}} \rceil$ consecutive classes to attend to recover.
   - **What-If Simulator**: Project upcoming attendance by entering prospective attended and missed classes.

5. **Visual Statistics & Analytics**:
   - Attended vs. Conducted bar chart by subject.
   - Attendance doughnut chart showing overall ratio.
   - Day-of-the-week pattern distribution (Monday – Saturday).
   - Cumulative timeline trajectory tracking attendance over dates.
   - CSV export and print-ready report.

6. **Colorful Notebook Theme**:
   - Warm lined-paper background with marker-like outlines and playful handwritten headings.
   - Pastel sticky-note cards, bright accents, and responsive design for desktop, tablet, and mobile.

---

## 💻 Running Locally

### 1. Requirements
Ensure Python 3.9+ is installed:
```bash
python --version
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure the database and session key

The app uses PostgreSQL. Create a database with a PostgreSQL provider such as
[Neon](https://neon.tech), then create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
SECRET_KEY=replace-with-a-long-random-secret
```

Keep `.env` private; it is ignored by Git. Generate a session secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Login and registration require both `SECRET_KEY` and `DATABASE_URL`. If either is missing, the API returns a server configuration error; set the variables in `.env` locally or in the deployment's environment settings, then restart or redeploy.

### 4. Start the Web Server
```bash
python app.py
```

Visit: **[http://localhost:5000](http://localhost:5000)**

---

## 🧑‍🚀 Credits

- **Developer**: Tom Sanson
- **GitHub**: [Tomz-SN](https://github.com/Tomz-SN)
