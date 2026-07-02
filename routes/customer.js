const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db');
const bcrypt = require('bcryptjs');

const mapResult = (r) => {
  if (!r || !r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
};

function requireCustomer(req, res, next) {
  if (!req.session.customer) return res.redirect('/account/login');
  next();
}

router.get('/login', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('customer/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('customer/login', { error: 'Email and password are required' });
  const db = await getDb();
  const result = db.exec("SELECT * FROM customers WHERE email = ?", [email]);
  if (!result.length || !result[0].values.length) {
    return res.render('customer/login', { error: 'Invalid email or password' });
  }
  const cols = result[0].columns;
  const customer = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  const valid = bcrypt.compareSync(password, customer.password);
  if (!valid) return res.render('customer/login', { error: 'Invalid email or password' });
  req.session.customer = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
  res.redirect('/account');
});

router.get('/register', (req, res) => {
  if (req.session.customer) return res.redirect('/account');
  res.render('customer/register', { error: null });
});

router.post('/register', async (req, res) => {
  const { name, email, phone, password, confirm_password } = req.body;
  if (!name || !email || !password) {
    return res.render('customer/register', { error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.render('customer/register', { error: 'Password must be at least 6 characters' });
  }
  if (password !== confirm_password) {
    return res.render('customer/register', { error: 'Passwords do not match' });
  }
  const db = await getDb();
  const existing = db.exec("SELECT id FROM customers WHERE email = ?", [email]);
  if (existing.length && existing[0].values.length) {
    return res.render('customer/register', { error: 'Email already registered' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO customers (name, email, phone, password) VALUES (?, ?, ?, ?)", [name, email, phone || '', hashed]);
  saveDb();
  const result = db.exec("SELECT * FROM customers WHERE email = ?", [email]);
  if (result.length && result[0].values.length) {
    const cols = result[0].columns;
    const customer = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
    req.session.customer = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
  }
  res.redirect('/account');
});

router.get('/logout', (req, res) => {
  req.session.customer = null;
  res.redirect('/');
});

router.get('/', requireCustomer, async (req, res) => {
  const db = await getDb();
  const orders = db.exec("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10", [req.session.customer.id]);
  const wishlist = db.exec(
    "SELECT w.id as wid, p.* FROM wishlist w JOIN products p ON w.product_id = p.id WHERE w.customer_id = ? ORDER BY w.created_at DESC",
    [req.session.customer.id]
  );
  res.render('customer/dashboard', { orders: mapResult(orders), wishlist: mapResult(wishlist) });
});

router.get('/orders', requireCustomer, async (req, res) => {
  const db = await getDb();
  const orders = db.exec("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC", [req.session.customer.id]);
  res.render('customer/orders', { orders: mapResult(orders) });
});

router.get('/wishlist', requireCustomer, async (req, res) => {
  const db = await getDb();
  const items = db.exec(
    "SELECT w.id as wid, p.* FROM wishlist w JOIN products p ON w.product_id = p.id WHERE w.customer_id = ? ORDER BY w.created_at DESC",
    [req.session.customer.id]
  );
  res.render('customer/wishlist', { items: mapResult(items) });
});

router.post('/wishlist/remove/:productId', requireCustomer, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?", [req.session.customer.id, req.params.productId]);
  saveDb();
  res.redirect('/account/wishlist');
});

router.get('/profile', requireCustomer, async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM customers WHERE id = ?", [req.session.customer.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/account/logout');
  const cols = result[0].columns;
  const customer = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  res.render('customer/profile', { customer, error: null, success: null });
});

router.post('/profile', requireCustomer, async (req, res) => {
  const { name, phone, address } = req.body;
  const db = await getDb();
  db.run("UPDATE customers SET name=?, phone=?, address=? WHERE id=?", [name, phone || '', address || '', req.session.customer.id]);
  saveDb();
  req.session.customer.name = name;
  req.session.customer.phone = phone || '';
  const result = db.exec("SELECT * FROM customers WHERE id = ?", [req.session.customer.id]);
  const cols = result[0].columns;
  const customer = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  res.render('customer/profile', { customer, error: null, success: 'Profile updated' });
});

module.exports = router;
