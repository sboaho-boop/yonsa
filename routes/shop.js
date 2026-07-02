const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

const mapResult = (r) => {
  if (!r || !r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
};

router.get('/', async (req, res) => {
  const db = await getDb();
  const category = req.query.category || '';
  const search = req.query.search || '';
  let query = "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'active'";
  let params = [];
  if (category) { query += " AND c.name = ?"; params.push(category); }
  if (search) { query += " AND (p.name LIKE ? OR p.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  query += " ORDER BY p.created_at DESC";
  const products = db.exec(query, params);
  const categories = db.exec("SELECT * FROM categories ORDER BY name");
  res.render('shop', { products: mapResult(products), categories: mapResult(categories), selectedCategory: category, search });
});

router.get('/product/:id', async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?", [req.params.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/shop');
  const cols = result[0].columns;
  const product = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  const images = db.exec("SELECT * FROM product_images WHERE product_id = ?", [req.params.id]);
  const variants = db.exec("SELECT * FROM product_variants WHERE product_id = ?", [req.params.id]);
  const reviews = db.exec("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", [req.params.id]);
  const related = db.exec("SELECT * FROM products WHERE category_id = ? AND id != ? AND status = 'active' LIMIT 4", [product.category_id, req.params.id]);
  const inWishlist = req.session.customer ? db.exec("SELECT id FROM wishlist WHERE customer_id = ? AND product_id = ?", [req.session.customer.id, req.params.id]).length > 0 : false;
  res.render('product', {
    product,
    images: mapResult(images),
    variants: mapResult(variants),
    reviews: mapResult(reviews),
    related: mapResult(related),
    inWishlist,
  });
});

router.post('/cart/add/:id', async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM products WHERE id = ? AND status = 'active'", [req.params.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/shop');
  const cols = result[0].columns;
  const product = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  if (!req.session.cart) req.session.cart = [];
  const variant = req.body.variant || '';
  const cartKey = product.id + '-' + variant;
  const existing = req.session.cart.findIndex(item => item.cartKey === cartKey);
  if (existing > -1) {
    req.session.cart[existing].quantity += 1;
  } else {
    req.session.cart.push({
      cartKey, id: product.id, name: product.name, price: product.price,
      image: product.image, variant, quantity: 1,
    });
  }
  res.redirect(req.headers.referer || '/shop');
});

router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('cart', { cart, subtotal, coupon: null, discount: 0 });
});

router.post('/cart/update/:cartKey', (req, res) => {
  const { quantity } = req.body;
  const cart = req.session.cart || [];
  const idx = cart.findIndex(item => item.cartKey === req.params.cartKey);
  if (idx > -1) {
    const qty = parseInt(quantity);
    if (qty > 0) cart[idx].quantity = qty;
    else cart.splice(idx, 1);
  }
  req.session.cart = cart;
  res.redirect('/shop/cart');
});

router.post('/cart/remove/:cartKey', (req, res) => {
  const cart = req.session.cart || [];
  req.session.cart = cart.filter(item => item.cartKey !== req.params.cartKey);
  res.redirect('/shop/cart');
});

router.post('/cart/apply-coupon', async (req, res) => {
  const { code } = req.body;
  const cart = req.session.cart || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const db = await getDb();
  const result = db.exec("SELECT * FROM coupons WHERE code = ?", [code.toUpperCase()]);
  if (!result.length || !result[0].values.length) {
    return res.render('cart', { cart, subtotal, coupon: null, discount: 0, couponError: 'Invalid coupon code' });
  }
  const cols = result[0].columns;
  const coupon = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return res.render('cart', { cart, subtotal, coupon: null, discount: 0, couponError: 'Coupon has expired' });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.render('cart', { cart, subtotal, coupon: null, discount: 0, couponError: 'Coupon has expired' });
  }
  if (subtotal < coupon.min_amount) {
    return res.render('cart', { cart, subtotal, coupon: null, discount: 0, couponError: `Minimum order of $${coupon.min_amount} required` });
  }
  let discount = 0;
  if (coupon.discount_type === 'percentage') discount = subtotal * (coupon.discount_value / 100);
  else discount = coupon.discount_value;
  discount = Math.min(discount, subtotal);
  req.session.coupon = coupon;
  res.render('cart', { cart, subtotal, coupon, discount, couponError: null });
});

router.get('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/shop');
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const coupon = req.session.coupon || null;
  let discount = 0;
  if (coupon) {
    if (coupon.discount_type === 'percentage') discount = subtotal * (coupon.discount_value / 100);
    else discount = coupon.discount_value;
    discount = Math.min(discount, subtotal);
  }
  res.render('checkout', { cart, subtotal, discount, total: subtotal - discount, coupon, error: null });
});

router.post('/checkout', async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/shop');
  const { name, email, phone, address, payment_method } = req.body;
  if (!name || !email) {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const coupon = req.session.coupon || null;
    let discount = 0;
    if (coupon) {
      if (coupon.discount_type === 'percentage') discount = subtotal * (coupon.discount_value / 100);
      else discount = coupon.discount_value;
      discount = Math.min(discount, subtotal);
    }
    return res.render('checkout', { cart, subtotal, discount, total: subtotal - discount, coupon, error: 'Name and email are required' });
  }
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const coupon = req.session.coupon || null;
  let discount = 0;
  if (coupon) {
    if (coupon.discount_type === 'percentage') discount = subtotal * (coupon.discount_value / 100);
    else discount = coupon.discount_value;
    discount = Math.min(discount, subtotal);
  }
  const total = Math.round((subtotal - discount) * 100) / 100;
  const orderRef = 'YON-' + uuidv4().slice(0, 8).toUpperCase();
  const db = await getDb();

  db.run(
    "INSERT INTO orders (order_ref, customer_id, customer_name, customer_email, customer_phone, customer_address, items, subtotal, discount, total, coupon_code, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
    [orderRef, req.session.customer?.id || null, name, email, phone || '', address || '', JSON.stringify(cart), subtotal, discount, total, coupon?.code || null, payment_method || 'bank_transfer']
  );

  if (coupon && coupon.id) {
    db.run("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id]);
  }

  const orderId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  for (const item of cart) {
    db.run("INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
      [orderId, item.id, item.name, item.quantity, item.price]);
  }
  saveDb();

  req.session.cart = [];
  delete req.session.coupon;
  res.redirect('/shop/order/' + orderRef);
});

router.get('/order/:ref', async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM orders WHERE order_ref = ?", [req.params.ref]);
  if (!result.length || !result[0].values.length) return res.redirect('/shop');
  const cols = result[0].columns;
  const order = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  if (!req.session.isAdmin && req.session.customer?.email !== order.customer_email) {
    return res.redirect('/shop');
  }
  res.render('order-success', { order });
});

router.get('/track', (req, res) => {
  res.render('track-order', { order: null, error: null });
});

router.post('/track', async (req, res) => {
  const { email, order_ref } = req.body;
  const db = await getDb();
  const result = db.exec("SELECT * FROM orders WHERE order_ref = ? AND customer_email = ?", [order_ref, email]);
  if (!result.length || !result[0].values.length) {
    return res.render('track-order', { order: null, error: 'Order not found. Check your email and order reference.' });
  }
  const cols = result[0].columns;
  const order = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  res.render('track-order', { order, error: null });
});

router.post('/review/:productId', async (req, res) => {
  const { rating, comment, customer_name } = req.body;
  if (!rating || !comment) return res.redirect('/shop/product/' + req.params.productId);
  const db = await getDb();
  db.run("INSERT INTO reviews (product_id, customer_id, customer_name, rating, comment) VALUES (?, ?, ?, ?, ?)",
    [req.params.productId, req.session.customer?.id || null, customer_name || 'Anonymous', parseInt(rating), comment]);
  saveDb();
  res.redirect('/shop/product/' + req.params.productId);
});

router.post('/wishlist/toggle/:productId', async (req, res) => {
  if (!req.session.customer) return res.redirect('/account/login');
  const db = await getDb();
  const existing = db.exec("SELECT id FROM wishlist WHERE customer_id = ? AND product_id = ?", [req.session.customer.id, req.params.productId]);
  if (existing.length && existing[0].values.length) {
    db.run("DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?", [req.session.customer.id, req.params.productId]);
  } else {
    db.run("INSERT INTO wishlist (customer_id, product_id) VALUES (?, ?)", [req.session.customer.id, req.params.productId]);
  }
  saveDb();
  res.redirect(req.headers.referer || '/shop/product/' + req.params.productId);
});

module.exports = router;
