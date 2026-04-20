require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads dir exists
const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// Mount routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/courses', require('./middleware/auth'), require('./routes/courses.routes'));
app.use('/api/enrollments', require('./middleware/auth'), require('./routes/enrollments.routes'));
app.use('/api/lessons', require('./middleware/auth'), require('./routes/lessons.routes'));
app.use('/api/sheet-music', require('./middleware/auth'), require('./routes/sheetmusic.routes'));
app.use('/api/recordings', require('./middleware/auth'), require('./routes/recordings.routes'));
app.use('/api/masterclasses', require('./middleware/auth'), require('./routes/masterclasses.routes'));
app.use('/api/submissions', require('./middleware/auth'), require('./routes/submissions.routes'));
app.use('/api/quotes', require('./middleware/auth'), require('./routes/quotes.routes'));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`The Archive LMS running on http://localhost:${PORT}`));
