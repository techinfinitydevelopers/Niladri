const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'archive.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    instrument TEXT,
    avatar_initials TEXT,
    bio TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    otp_code TEXT,
    otp_expires_at TEXT,
    reset_token TEXT,
    reset_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    instructor_id INTEGER REFERENCES users(id),
    instrument TEXT,
    level TEXT,
    category TEXT,
    cover_color TEXT,
    cover_accent TEXT,
    duration_weeks INTEGER,
    lesson_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER,
    type TEXT DEFAULT 'video',
    content_url TEXT,
    duration_minutes INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    enrolled_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    progress_pct INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    UNIQUE(student_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES users(id),
    lesson_id INTEGER REFERENCES lessons(id),
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    UNIQUE(student_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS sheet_music (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    composer TEXT,
    period TEXT,
    instrument TEXT,
    difficulty TEXT,
    file_path TEXT,
    preview_path TEXT,
    page_count INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    lesson_id INTEGER REFERENCES lessons(id),
    title TEXT,
    file_path TEXT,
    duration_seconds INTEGER,
    waveform_data TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS masterclasses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    instructor_id INTEGER REFERENCES users(id),
    scheduled_at TEXT,
    duration_minutes INTEGER,
    location TEXT,
    meeting_url TEXT,
    max_participants INTEGER,
    description TEXT,
    status TEXT DEFAULT 'upcoming'
  );

  CREATE TABLE IF NOT EXISTS masterclass_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    masterclass_id INTEGER REFERENCES masterclasses(id),
    student_id INTEGER REFERENCES users(id),
    registered_at TEXT DEFAULT (datetime('now')),
    UNIQUE(masterclass_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES users(id),
    lesson_id INTEGER REFERENCES lessons(id),
    course_id INTEGER REFERENCES courses(id),
    recording_id INTEGER REFERENCES recordings(id),
    file_path TEXT,
    notes TEXT,
    grade TEXT,
    feedback TEXT,
    graded_by INTEGER REFERENCES users(id),
    submitted_at TEXT DEFAULT (datetime('now')),
    graded_at TEXT,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    attribution TEXT
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY,
    s3_config TEXT DEFAULT '{}',
    smtp_config TEXT DEFAULT '{}',
    general_config TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    submission_type TEXT DEFAULT 'file',
    allowed_file_types TEXT DEFAULT '[]',
    max_file_size_mb INTEGER DEFAULT 10,
    max_score INTEGER DEFAULT 100,
    due_type TEXT DEFAULT 'relative',
    due_days INTEGER,
    due_date TEXT,
    is_required INTEGER DEFAULT 1,
    visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Sprint 1+2: Learning core & communication
  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER,
    passing_score INTEGER DEFAULT 70,
    attempts_allowed INTEGER DEFAULT 3,
    randomize_questions INTEGER DEFAULT 0,
    show_answers_after INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'mcq',
    options TEXT DEFAULT '[]',
    correct_answer TEXT,
    points INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    audio_url TEXT,
    explanation TEXT
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    answers TEXT DEFAULT '{}',
    score INTEGER,
    passed INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    time_taken_seconds INTEGER
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    created_by INTEGER NOT NULL,
    subject TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thread_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(thread_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    attachment_path TEXT,
    read_by TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    practice_goal_minutes INTEGER DEFAULT 60,
    phone TEXT,
    location TEXT,
    social_links TEXT DEFAULT '{}',
    notification_prefs TEXT DEFAULT '{"email":true,"inapp":true,"graded":true,"messages":true,"masterclass":true}',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Sprint 3: Analytics & engagement
  CREATE TABLE IF NOT EXISTS practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    piece TEXT,
    composer TEXT,
    course_id INTEGER,
    focus_area TEXT,
    quality_rating INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'personal',
    start_datetime TEXT NOT NULL,
    end_datetime TEXT,
    all_day INTEGER DEFAULT 0,
    color TEXT DEFAULT '#8B2E26',
    related_id INTEGER,
    related_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Sprint 4+5+6: Monetisation, growth, scale
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount_paise INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    issued_at TEXT DEFAULT (datetime('now')),
    certificate_number TEXT UNIQUE,
    pdf_path TEXT,
    UNIQUE(student_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    masterclass_id INTEGER,
    course_id INTEGER,
    instructor_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    meeting_url TEXT,
    meeting_id TEXT,
    status TEXT DEFAULT 'scheduled',
    recording_url TEXT,
    max_participants INTEGER DEFAULT 50,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS live_session_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT,
    left_at TEXT,
    UNIQUE(session_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    instructor_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    send_email INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    lesson_id INTEGER,
    uploaded_by INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size_bytes INTEGER,
    category TEXT DEFAULT 'general',
    is_public INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    variables TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_name TEXT,
    status TEXT DEFAULT 'sent',
    error TEXT,
    sent_at TEXT DEFAULT (datetime('now'))
  );
`);

// Add price columns to courses if not already present (migration)
try {
  db.exec(`ALTER TABLE courses ADD COLUMN price_paise INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE courses ADD COLUMN is_paid INTEGER DEFAULT 0`);
} catch(e) { /* columns already exist */ }

// Seed data only if tables are empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const instructorHash = bcrypt.hashSync('password123', 10);
  const studentHash = bcrypt.hashSync('password123', 10);

  // Insert instructor
  const instructorInsert = db.prepare(`
    INSERT INTO users (email, password_hash, first_name, last_name, role, instrument, avatar_initials, bio, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const instructorResult = instructorInsert.run(
    'instructor@archive.edu', instructorHash, 'Elias', 'Vance',
    'instructor', 'Cello', 'EV',
    'Professor Elias Vance has performed with the Berlin Philharmonic and taught at Juilliard for over two decades. His approach blends historical performance practice with modern technique.',
    1
  );
  const instructorId = instructorResult.lastInsertRowid;

  // Insert student
  const studentResult = instructorInsert.run(
    'student@archive.edu', studentHash, 'Julian', 'Weber',
    'student', 'Cello', 'JW',
    'Aspiring cellist with a passion for Romantic-era repertoire.',
    1
  );
  const studentId = studentResult.lastInsertRowid;

  // Insert courses
  const courseInsert = db.prepare(`
    INSERT INTO courses (title, subtitle, description, instructor_id, instrument, level, category, cover_color, cover_accent, duration_weeks, lesson_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const course1 = courseInsert.run(
    'Foundations of Classical Cello',
    'Technique, Posture & Tone',
    'A comprehensive introduction to classical cello technique covering proper posture, bow hold, left-hand position, and the production of a beautiful, resonant tone. Students will explore foundational exercises drawn from the great pedagogical traditions of the instrument.',
    instructorId, 'Cello', 'Beginner', 'Classical', '#2D4F1E', '#D1A14E', 12, 24, 'active'
  );

  const course2 = courseInsert.run(
    'Bach Cello Suites: A Complete Study',
    'Six Suites for Solo Cello',
    'An in-depth exploration of J.S. Bach\'s monumental six suites for solo cello. We examine historical context, performance practice, ornamentation, and the unique challenges each suite presents. This course is suitable for intermediate to advanced players.',
    instructorId, 'Cello', 'Advanced', 'Baroque', '#8B2E26', '#F4EBD0', 24, 48, 'active'
  );

  const course3 = courseInsert.run(
    'Romantic Concerto Masterclass',
    'Dvořák, Elgar & Schumann',
    'Dive deep into the three cornerstone concertos of the Romantic cello repertoire. Learn the technical demands, interpretive choices, and historical context behind these beloved works.',
    instructorId, 'Cello', 'Intermediate', 'Romantic', '#4A3728', '#D1A14E', 16, 32, 'active'
  );

  const course4 = courseInsert.run(
    'Music Theory for String Players',
    'Harmony, Counterpoint & Analysis',
    'A practical theory course designed specifically for string players. Learn to analyze the scores you play, understand harmonic progressions, and develop your musical intuition through written exercises and ear training.',
    instructorId, 'All Instruments', 'Beginner', 'Theory', '#1A3050', '#D1A14E', 8, 16, 'active'
  );

  const courseIds = [course1.lastInsertRowid, course2.lastInsertRowid, course3.lastInsertRowid, course4.lastInsertRowid];

  // Insert chapters and lessons for course 1
  const chapterInsert = db.prepare(`INSERT INTO chapters (course_id, title, order_index, description) VALUES (?, ?, ?, ?)`);
  const lessonInsert = db.prepare(`INSERT INTO lessons (chapter_id, course_id, title, order_index, type, content_url, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const ch1 = chapterInsert.run(courseIds[0], 'Getting Started', 1, 'Introduction and setup');
  lessonInsert.run(ch1.lastInsertRowid, courseIds[0], 'Welcome & Course Overview', 1, 'video', null, 8);
  lessonInsert.run(ch1.lastInsertRowid, courseIds[0], 'The Anatomy of a Cello', 2, 'reading', null, 12);
  lessonInsert.run(ch1.lastInsertRowid, courseIds[0], 'Setting Up Your Practice Space', 3, 'video', null, 10);

  const ch2 = chapterInsert.run(courseIds[0], 'Posture & Position', 2, 'Body mechanics and ergonomics');
  lessonInsert.run(ch2.lastInsertRowid, courseIds[0], 'Seated Posture Fundamentals', 1, 'video', null, 15);
  lessonInsert.run(ch2.lastInsertRowid, courseIds[0], 'Cello Placement & End Pin Height', 2, 'video', null, 12);
  lessonInsert.run(ch2.lastInsertRowid, courseIds[0], 'Posture Check Exercise', 3, 'exercise', null, 20);

  const ch3 = chapterInsert.run(courseIds[0], 'The Bow Arm', 3, 'Bow hold and technique');
  lessonInsert.run(ch3.lastInsertRowid, courseIds[0], 'The Franco-Belgian Bow Hold', 1, 'video', null, 18);
  lessonInsert.run(ch3.lastInsertRowid, courseIds[0], 'Open String Exercises', 2, 'exercise', null, 25);

  // Insert chapters for course 2
  const ch4 = chapterInsert.run(courseIds[1], 'Suite No. 1 in G Major', 1, 'Prelude through Gigue');
  lessonInsert.run(ch4.lastInsertRowid, courseIds[1], 'Historical Context & Manuscripts', 1, 'reading', null, 20);
  lessonInsert.run(ch4.lastInsertRowid, courseIds[1], 'Prelude: Structure & Performance', 2, 'video', null, 35);
  lessonInsert.run(ch4.lastInsertRowid, courseIds[1], 'Allemande & Courante', 3, 'video', null, 40);

  const ch5 = chapterInsert.run(courseIds[1], 'Suite No. 2 in D Minor', 2, 'The melancholic second suite');
  lessonInsert.run(ch5.lastInsertRowid, courseIds[1], 'Prelude: D Minor Tonality', 1, 'video', null, 30);
  lessonInsert.run(ch5.lastInsertRowid, courseIds[1], 'Sarabande: Ornamentation', 2, 'video', null, 35);

  // Enrollments
  const enrollInsert = db.prepare(`INSERT OR IGNORE INTO enrollments (student_id, course_id, progress_pct, last_accessed_at) VALUES (?, ?, ?, datetime('now'))`);
  enrollInsert.run(studentId, courseIds[0], 70);
  enrollInsert.run(studentId, courseIds[1], 32);

  // Sheet music
  const sheetInsert = db.prepare(`INSERT INTO sheet_music (title, composer, period, instrument, difficulty, page_count, uploaded_by, course_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  sheetInsert.run('Suite No. 1 in G Major, BWV 1007', 'Johann Sebastian Bach', 'Baroque', 'Cello', 'Intermediate', 12, instructorId, courseIds[1]);
  sheetInsert.run('Cello Concerto in E minor, Op. 85', 'Edward Elgar', 'Romantic', 'Cello', 'Advanced', 48, instructorId, courseIds[2]);
  sheetInsert.run('Cello Concerto in B minor, Op. 104', 'Antonín Dvořák', 'Romantic', 'Cello', 'Advanced', 52, instructorId, courseIds[2]);
  sheetInsert.run('The Well-Tempered Clavier, Book I', 'Johann Sebastian Bach', 'Baroque', 'All Instruments', 'Intermediate', 96, instructorId, null);

  // Masterclasses
  const mcInsert = db.prepare(`INSERT INTO masterclasses (title, instructor_id, scheduled_at, duration_minutes, location, meeting_url, max_participants, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  mcInsert.run('Bach Suite Interpretation: Finding Your Voice', instructorId, '2026-05-03 14:00:00', 90, 'Online via Zoom', 'https://zoom.us/j/archive001', 20, 'An open masterclass on interpreting the Bach Cello Suites. Participants are welcome to submit short recordings for feedback.', 'upcoming');
  mcInsert.run('The Art of the Bow: Tone Production Masterclass', instructorId, '2026-05-17 15:00:00', 120, 'The Archive Studio, Room 4', null, 15, 'Hands-on masterclass focusing on bow technique, tone colour, and expressive playing across all levels.', 'upcoming');
  mcInsert.run('Romantic Concerto Session: Dvořák', instructorId, '2026-06-07 13:00:00', 90, 'Online via Zoom', 'https://zoom.us/j/archive002', 25, 'Deep dive into the Dvořák Cello Concerto. We will cover technical challenges and interpretive decisions in the first movement.', 'upcoming');

  // Quotes
  const quoteInsert = db.prepare(`INSERT INTO quotes (text, attribution) VALUES (?, ?)`);
  quoteInsert.run('Music is the shorthand of emotion.', 'Leo Tolstoy');
  quoteInsert.run('Without music, life would be a mistake.', 'Friedrich Nietzsche');
  quoteInsert.run('Music gives a soul to the universe, wings to the mind, flight to the imagination, and life to everything.', 'Plato');
  quoteInsert.run('One good thing about music: when it hits you, you feel no pain.', 'Bob Marley');
  quoteInsert.run('Music is the divine way to tell beautiful, poetic things to the heart.', 'Pablo Casals');
  quoteInsert.run('The cello is like a beautiful woman who has not grown older, but younger with time, more slender, more supple, more graceful.', 'Pablo Casals');
  quoteInsert.run('To play a wrong note is insignificant; to play without passion is inexcusable.', 'Ludwig van Beethoven');
  quoteInsert.run('Music is the mediator between the spiritual and the sensual life.', 'Ludwig van Beethoven');
  quoteInsert.run('Bach is an astronomer, discovering the most marvellous stars. Beethoven challenges the universe. I only try to express the soul and the heart of man.', 'Frédéric Chopin');
  quoteInsert.run('The aim and final end of all music should be none other than the glory of God and the refreshment of the soul.', 'Johann Sebastian Bach');

  console.log('Database seeded successfully.');
}

module.exports = db;
