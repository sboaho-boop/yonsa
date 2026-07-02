require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: true,
}));

app.use((req, res, next) => {
  res.locals.isAdmin = req.session.isAdmin || false;
  res.locals.currentCustomer = req.session.customer || null;
  res.locals.cart = req.session.cart || [];
  next();
});

const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const customerRoutes = require('./routes/customer');

app.use('/', indexRoutes);
app.use('/admin', adminRoutes);
app.use('/shop', shopRoutes);
app.use('/account', customerRoutes);

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`YONSA Mothercare running at http://localhost:${PORT}`);
    console.log(`Admin login: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
