const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

router.get('/', async (req, res) => {
  const db = await getDb();
  const featured = db.exec(
    "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.featured = 1 AND p.status = 'active' ORDER BY p.created_at DESC LIMIT 8"
  );
  const discounted = db.exec(
    "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.original_price > p.price AND p.status = 'active' ORDER BY p.created_at DESC LIMIT 4"
  );
  const categories = db.exec("SELECT * FROM categories ORDER BY name");
  const reviews = db.exec("SELECT * FROM reviews ORDER BY created_at DESC LIMIT 6");

  function mapResult(result) {
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  }

  res.render('index', {
    featured: mapResult(featured),
    discounted: mapResult(discounted),
    categories: mapResult(categories),
    reviews: mapResult(reviews),
  });
});

router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/contact', (req, res) => {
  res.render('contact');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid email or password' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
