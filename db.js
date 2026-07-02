const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDb() {
  const d = await getDb();

  d.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    original_price REAL,
    category_id INTEGER,
    image TEXT,
    stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    extra_price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref TEXT UNIQUE,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    coupon_code TEXT,
    payment_method TEXT,
    payment_ref TEXT,
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage','fixed')),
    discount_value REAL NOT NULL,
    min_amount REAL DEFAULT 0,
    max_uses INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  d.run(`CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(customer_id, product_id)
  )`);

  saveDb();

  const catCount = d.exec("SELECT COUNT(*) as c FROM categories");
  if (!catCount.length || catCount[0].values[0][0] === 0) {
    seedData(d);
  }
}

function seedData(d) {
  const cats = [
    ['Baby Sets', 'Complete baby outfit sets', 'https://via.placeholder.com/300x300?text=Baby+Sets'],
    ['Kids Wear', 'Stylish clothing for kids', 'https://via.placeholder.com/300x300?text=Kids+Wear'],
    ['Maternity Wear', 'Comfortable maternity clothing', 'https://via.placeholder.com/300x300?text=Maternity+Wear'],
    ['Baby Shoes', 'Soft and durable baby shoes', 'https://via.placeholder.com/300x300?text=Baby+Shoes'],
    ['School Bags', 'Durable school backpacks', 'https://via.placeholder.com/300x300?text=School+Bags'],
    ['Feeding Accessories', 'Baby feeding essentials', 'https://via.placeholder.com/300x300?text=Feeding'],
    ['Toiletries', 'Baby care and toiletries', 'https://via.placeholder.com/300x300?text=Toiletries'],
  ];
  for (const c of cats) d.run("INSERT INTO categories (name, description, image) VALUES (?, ?, ?)", c);
  saveDb();

  const products = [
    ['Newborn Baby Set', 'Soft cotton baby set with hat and booties', 45.00, 59.99, 1, 'https://via.placeholder.com/400x400?text=Newborn+Set', 50, 1],
    ['Toddler Summer Dress', 'Light floral summer dress for girls', 35.00, 44.99, 2, 'https://via.placeholder.com/400x400?text=Summer+Dress', 40, 1],
    ['Maternity Gown', 'Comfortable pregnancy night gown', 55.00, 69.99, 3, 'https://via.placeholder.com/400x400?text=Maternity+Gown', 30, 1],
    ['Baby Sneakers', 'Non-slip soft sole baby sneakers', 28.00, 34.99, 4, 'https://via.placeholder.com/400x400?text=Baby+Sneakers', 60, 1],
    ['Kids Backpack', 'Colorful cartoon school backpack', 32.00, 39.99, 5, 'https://via.placeholder.com/400x400?text=Kids+Backpack', 45, 0],
    ['Baby Feeding Set', 'BPA-free plate, bowl, cup & spoon set', 25.00, 32.99, 6, 'https://via.placeholder.com/400x400?text=Feeding+Set', 70, 1],
    ['Baby Shampoo', 'Gentle tear-free baby shampoo 200ml', 12.00, 15.99, 7, 'https://via.placeholder.com/400x400?text=Baby+Shampoo', 100, 0],
    ['Baby Boy Set', 'Onesie, pants & bib cotton set', 42.00, 54.99, 1, 'https://via.placeholder.com/400x400?text=Boy+Set', 35, 0],
    ['Kids Polo Shirt', 'Cotton polo shirt for boys', 22.00, 27.99, 2, 'https://via.placeholder.com/400x400?text=Polo+Shirt', 55, 1],
    ['Nursing Cover', 'Multi-use breastfeeding cover', 30.00, 38.99, 3, 'https://via.placeholder.com/400x400?text=Nursing+Cover', 25, 0],
    ['Baby Sandals', 'Breathable leather baby sandals', 24.00, 29.99, 4, 'https://via.placeholder.com/400x400?text=Baby+Sandals', 40, 0],
    ['Lunch Bag', 'Insulated kids lunch bag', 18.00, 22.99, 5, 'https://via.placeholder.com/400x400?text=Lunch+Bag', 65, 1],
    ['Sippy Cup', 'Leak-proof trainer cup 250ml', 10.00, 13.99, 6, 'https://via.placeholder.com/400x400?text=Sippy+Cup', 90, 0],
    ['Baby Lotion', 'Moisturizing baby lotion 300ml', 15.00, 18.99, 7, 'https://via.placeholder.com/400x400?text=Baby+Lotion', 80, 0],
    ['Winter Baby Set', 'Warm fleece baby set with hood', 52.00, 64.99, 1, 'https://via.placeholder.com/400x400?text=Winter+Set', 30, 1],
    ['Girls Tutu Dress', 'Princess tutu dress with headband', 38.00, 47.99, 2, 'https://via.placeholder.com/400x400?text=Tutu+Dress', 35, 0],
  ];
  for (const p of products) d.run("INSERT INTO products (name, description, price, original_price, category_id, image, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", p);
  saveDb();

  const reviews = [
    [1, 'Akua M.', 5, 'My baby loves this set! Very soft and comfortable.'],
    [2, 'Esi A.', 4, 'Beautiful dress, true to size. My daughter looks adorable.'],
    [3, 'Naa S.', 5, 'Perfect for pregnancy, very comfortable fabric.'],
    [4, 'Kojo B.', 4, 'Good quality shoes, my toddler walks well in them.'],
    [6, 'Abena D.', 5, 'Complete set, everything my baby needs for mealtime.'],
  ];
  for (const r of reviews) d.run("INSERT INTO reviews (product_id, customer_name, rating, comment) VALUES (?, ?, ?, ?)", r);
  saveDb();

  const coupons = [
    ['WELCOME10', 'percentage', 10, 50, 100],
    ['SAVE20', 'percentage', 20, 100, 50],
    ['MOTHER5', 'fixed', 5, 30, 200],
  ];
  for (const c of coupons) d.run("INSERT INTO coupons (code, discount_type, discount_value, min_amount, max_uses) VALUES (?, ?, ?, ?, ?)", c);
  saveDb();
}

module.exports = { getDb, initDb, saveDb };
