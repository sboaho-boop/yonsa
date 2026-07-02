const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db');

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/login');
  next();
}

const mapResult = (r) => {
  if (!r || !r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
};

router.get('/', requireAdmin, async (req, res) => {
  const db = await getDb();
  const prodCount = db.exec("SELECT COUNT(*) as c FROM products");
  const orderCount = db.exec("SELECT COUNT(*) as c FROM orders");
  const custCount = db.exec("SELECT COUNT(*) as c FROM customers");
  const revenue = db.exec("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'cancelled'");
  const orders = db.exec("SELECT * FROM orders ORDER BY created_at DESC LIMIT 10");
  const lowStock = db.exec("SELECT * FROM products WHERE stock < 10 AND status = 'active' ORDER BY stock ASC LIMIT 5");

  const monthlySales = db.exec(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
    FROM orders WHERE status != 'cancelled' GROUP BY month ORDER BY month DESC LIMIT 6
  `);

  res.render('admin/dashboard', {
    stats: {
      products: prodCount[0]?.values[0][0] || 0,
      orders: orderCount[0]?.values[0][0] || 0,
      customers: custCount[0]?.values[0][0] || 0,
      revenue: revenue[0]?.values[0][0] || 0,
    },
    orders: mapResult(orders),
    lowStock: mapResult(lowStock),
    monthlySales: mapResult(monthlySales),
  });
});

router.get('/products', requireAdmin, async (req, res) => {
  const db = await getDb();
  const products = db.exec(
    "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC"
  );
  res.render('admin/products', { products: mapResult(products) });
});

router.get('/products/add', requireAdmin, async (req, res) => {
  const db = await getDb();
  const cats = db.exec("SELECT * FROM categories ORDER BY name");
  res.render('admin/add-product', { categories: mapResult(cats), error: null, product: {} });
});

router.post('/products/add', requireAdmin, async (req, res) => {
  const { name, description, price, original_price, category_id, stock, image, status, featured } = req.body;
  if (!name || !price) {
    const db = await getDb();
    const cats = db.exec("SELECT * FROM categories ORDER BY name");
    return res.render('admin/add-product', { categories: mapResult(cats), error: 'Name and price are required', product: req.body });
  }
  const db = await getDb();
  db.run(
    "INSERT INTO products (name, description, price, original_price, category_id, image, stock, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description || '', parseFloat(price), original_price ? parseFloat(original_price) : null, category_id || null, image || 'https://via.placeholder.com/400x400?text=Product', parseInt(stock) || 0, status || 'active', featured ? 1 : 0]
  );
  saveDb();
  res.redirect('/admin/products');
});

router.get('/products/edit/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/admin/products');
  const cols = result[0].columns;
  const product = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  const cats = db.exec("SELECT * FROM categories ORDER BY name");
  const images = db.exec("SELECT * FROM product_images WHERE product_id = ?", [req.params.id]);
  const variants = db.exec("SELECT * FROM product_variants WHERE product_id = ?", [req.params.id]);
  const reviews = db.exec("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", [req.params.id]);
  res.render('admin/edit-product', { product, categories: mapResult(cats), images: mapResult(images), variants: mapResult(variants), reviews: mapResult(reviews), error: null });
});

router.post('/products/edit/:id', requireAdmin, async (req, res) => {
  const { name, description, price, original_price, category_id, stock, image, status, featured } = req.body;
  if (!name || !price) return res.redirect('/admin/products/edit/' + req.params.id);
  const db = await getDb();
  db.run(
    "UPDATE products SET name=?, description=?, price=?, original_price=?, category_id=?, image=?, stock=?, status=?, featured=? WHERE id=?",
    [name, description || '', parseFloat(price), original_price ? parseFloat(original_price) : null, category_id || null, image || 'https://via.placeholder.com/400x400?text=Product', parseInt(stock) || 0, status || 'active', featured ? 1 : 0, req.params.id]
  );
  saveDb();
  res.redirect('/admin/products');
});

router.post('/products/delete/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM product_images WHERE product_id = ?", [req.params.id]);
  db.run("DELETE FROM product_variants WHERE product_id = ?", [req.params.id]);
  db.run("DELETE FROM reviews WHERE product_id = ?", [req.params.id]);
  db.run("DELETE FROM wishlist WHERE product_id = ?", [req.params.id]);
  db.run("DELETE FROM products WHERE id = ?", [req.params.id]);
  saveDb();
  res.redirect('/admin/products');
});

router.post('/products/discount/:id', requireAdmin, async (req, res) => {
  const { discount_type, discount_value, schedule_start, schedule_end } = req.body;
  const db = await getDb();
  const result = db.exec("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/admin/products');
  const cols = result[0].columns;
  const product = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  const val = parseFloat(discount_value) || 0;
  if (discount_type === 'percentage') {
    const newPrice = product.price * (1 - val / 100);
    db.run("UPDATE products SET original_price = COALESCE(original_price, price), price = ? WHERE id = ?", [Math.round(newPrice * 100) / 100, req.params.id]);
  } else {
    const newPrice = Math.max(0, product.price - val);
    db.run("UPDATE products SET original_price = COALESCE(original_price, price), price = ? WHERE id = ?", [Math.round(newPrice * 100) / 100, req.params.id]);
  }
  saveDb();
  res.redirect('/admin/products');
});

router.post('/products/images/add/:id', requireAdmin, async (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.redirect('/admin/products/edit/' + req.params.id);
  const db = await getDb();
  db.run("INSERT INTO product_images (product_id, image_url) VALUES (?, ?)", [req.params.id, image_url]);
  saveDb();
  res.redirect('/admin/products/edit/' + req.params.id);
});

router.post('/products/images/delete/:productId/:imageId', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM product_images WHERE id = ? AND product_id = ?", [req.params.imageId, req.params.productId]);
  saveDb();
  res.redirect('/admin/products/edit/' + req.params.productId);
});

router.post('/products/variants/add/:id', requireAdmin, async (req, res) => {
  const { name, extra_price, stock } = req.body;
  if (!name) return res.redirect('/admin/products/edit/' + req.params.id);
  const db = await getDb();
  db.run("INSERT INTO product_variants (product_id, name, extra_price, stock) VALUES (?, ?, ?, ?)",
    [req.params.id, name, parseFloat(extra_price) || 0, parseInt(stock) || 0]);
  saveDb();
  res.redirect('/admin/products/edit/' + req.params.id);
});

router.post('/products/variants/delete/:productId/:variantId', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM product_variants WHERE id = ? AND product_id = ?", [req.params.variantId, req.params.productId]);
  saveDb();
  res.redirect('/admin/products/edit/' + req.params.productId);
});

router.get('/categories', requireAdmin, async (req, res) => {
  const db = await getDb();
  const cats = db.exec("SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count FROM categories c ORDER BY c.name");
  res.render('admin/categories', { categories: mapResult(cats) });
});

router.post('/categories/add', requireAdmin, async (req, res) => {
  const { name, description, image } = req.body;
  if (!name) return res.redirect('/admin/categories');
  const db = await getDb();
  db.run("INSERT INTO categories (name, description, image) VALUES (?, ?, ?)", [name, description || '', image || '']);
  saveDb();
  res.redirect('/admin/categories');
});

router.post('/categories/edit/:id', requireAdmin, async (req, res) => {
  const { name, description, image } = req.body;
  if (!name) return res.redirect('/admin/categories');
  const db = await getDb();
  db.run("UPDATE categories SET name=?, description=?, image=? WHERE id=?", [name, description || '', image || '', req.params.id]);
  saveDb();
  res.redirect('/admin/categories');
});

router.post('/categories/delete/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("UPDATE products SET category_id = NULL WHERE category_id = ?", [req.params.id]);
  db.run("DELETE FROM categories WHERE id = ?", [req.params.id]);
  saveDb();
  res.redirect('/admin/categories');
});

router.get('/orders', requireAdmin, async (req, res) => {
  const db = await getDb();
  const status = req.query.status || '';
  let query = "SELECT * FROM orders";
  let params = [];
  if (status && ['pending','processing','completed','cancelled'].includes(status)) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";
  const orders = db.exec(query, params);
  res.render('admin/orders', { orders: mapResult(orders), currentStatus: status });
});

router.post('/orders/status/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const db = await getDb();
  db.run("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
  saveDb();
  res.redirect('/admin/orders');
});

router.get('/customers', requireAdmin, async (req, res) => {
  const db = await getDb();
  const customers = db.exec("SELECT c.*, (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as order_count, (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = c.id AND status != 'cancelled') as total_spent FROM customers c ORDER BY c.created_at DESC");
  res.render('admin/customers', { customers: mapResult(customers) });
});

router.get('/customers/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM customers WHERE id = ?", [req.params.id]);
  if (!result.length || !result[0].values.length) return res.redirect('/admin/customers');
  const cols = result[0].columns;
  const customer = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  const orders = db.exec("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC", [req.params.id]);
  res.render('admin/customer-detail', { customer, orders: mapResult(orders) });
});

router.get('/coupons', requireAdmin, async (req, res) => {
  const db = await getDb();
  const coupons = db.exec("SELECT * FROM coupons ORDER BY created_at DESC");
  res.render('admin/coupons', { coupons: mapResult(coupons), error: null });
});

router.post('/coupons/add', requireAdmin, async (req, res) => {
  const { code, discount_type, discount_value, min_amount, max_uses, expires_at } = req.body;
  if (!code || !discount_type || !discount_value) {
    const db = await getDb();
    const coupons = db.exec("SELECT * FROM coupons ORDER BY created_at DESC");
    return res.render('admin/coupons', { coupons: mapResult(coupons), error: 'Code, type and value are required' });
  }
  const db = await getDb();
  try {
    db.run("INSERT INTO coupons (code, discount_type, discount_value, min_amount, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      [code.toUpperCase(), discount_type, parseFloat(discount_value), parseFloat(min_amount) || 0, parseInt(max_uses) || 0, expires_at || null]);
    saveDb();
  } catch (e) {
    const coupons = db.exec("SELECT * FROM coupons ORDER BY created_at DESC");
    return res.render('admin/coupons', { coupons: mapResult(coupons), error: 'Coupon code already exists' });
  }
  res.redirect('/admin/coupons');
});

router.post('/coupons/delete/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM coupons WHERE id = ?", [req.params.id]);
  saveDb();
  res.redirect('/admin/coupons');
});

router.get('/reports', requireAdmin, async (req, res) => {
  const db = await getDb();
  const period = req.query.period || 'month';
  let groupBy, dateFormat;
  if (period === 'day') { groupBy = "strftime('%Y-%m-%d', created_at)"; dateFormat = '%Y-%m-%d'; }
  else if (period === 'year') { groupBy = "strftime('%Y', created_at)"; dateFormat = '%Y'; }
  else { groupBy = "strftime('%Y-%m', created_at)"; dateFormat = '%Y-%m'; }

  const sales = db.exec(`SELECT ${groupBy} as period, COUNT(*) as order_count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' GROUP BY period ORDER BY period DESC LIMIT 12`);
  const byCategory = db.exec(`
    SELECT c.name as category, COUNT(oi.id) as items_sold, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.status != 'cancelled'
    GROUP BY c.name ORDER BY revenue DESC
  `);
  const topProducts = db.exec(`
    SELECT oi.product_name, SUM(oi.quantity) as qty, COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
    GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10
  `);
  const lowStock = db.exec("SELECT * FROM products WHERE stock < 10 AND status = 'active' ORDER BY stock ASC");

  res.render('admin/reports', {
    sales: mapResult(sales),
    byCategory: mapResult(byCategory),
    topProducts: mapResult(topProducts),
    lowStock: mapResult(lowStock),
    period,
  });
});

module.exports = router;
