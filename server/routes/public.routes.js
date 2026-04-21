const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Blog: public read ─────────────────────────────────────────────────────────

// GET /api/public/blog — list published posts
router.get('/blog', (req, res) => {
  try {
    const { category, limit = 10, offset = 0 } = req.query;
    let sql = `
      SELECT b.id, b.title, b.slug, b.excerpt, b.cover_image, b.category, b.tags,
             u.first_name || ' ' || u.last_name AS author_name,
             b.published_at, b.views
      FROM blogs b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.status = 'published'
    `;
    const params = [];
    if (category) {
      sql += ` AND b.category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY b.published_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const posts = db.prepare(sql).all(...params);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/blog/:slug — single published post
router.get('/blog/:slug', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT b.*,
             u.first_name || ' ' || u.last_name AS author_name,
             u.bio AS author_bio,
             u.avatar_initials AS author_initials
      FROM blogs b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.slug = ? AND b.status = 'published'
    `).get(req.params.slug);

    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare(`UPDATE blogs SET views = views + 1 WHERE id = ?`).run(post.id);
    post.views = post.views + 1;

    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
