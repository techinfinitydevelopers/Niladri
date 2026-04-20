const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/public/courses  — all active courses (no auth)
router.get('/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name AS instructor_name,
             u.avatar_initials AS instructor_initials, u.instrument AS instructor_instrument
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.status = 'active'
      ORDER BY c.id ASC
    `).all();
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/courses/:id  — single course detail with chapters/lessons (no auth)
router.get('/courses/:id', (req, res) => {
  try {
    const course = db.prepare(`
      SELECT c.*,
             u.first_name || ' ' || u.last_name AS instructor_name,
             u.bio AS instructor_bio,
             u.avatar_initials AS instructor_initials,
             u.instrument AS instructor_instrument
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.id = ? AND c.status = 'active'
    `).get(req.params.id);

    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Chapters + lesson titles (no content_url for unauthenticated users)
    const chapters = db.prepare(
      'SELECT * FROM chapters WHERE course_id = ? ORDER BY order_index'
    ).all(req.params.id);

    const lessons = db.prepare(
      'SELECT id, chapter_id, title, order_index, type, duration_minutes FROM lessons WHERE course_id = ? ORDER BY order_index'
    ).all(req.params.id);

    const chaptersWithLessons = chapters.map(ch => ({
      ...ch,
      lessons: lessons.filter(l => l.chapter_id === ch.id)
    }));

    res.json({ course, chapters: chaptersWithLessons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
