const defaultProducts = [
  { id: 1, name: 'Newborn Baby Set', desc: 'Soft cotton baby set with hat and booties', price: 45.00, origPrice: 59.99, cat: 'Baby Sets', stock: 50, featured: true },
  { id: 2, name: 'Toddler Summer Dress', desc: 'Light floral summer dress for girls', price: 35.00, origPrice: 44.99, cat: 'Kids Wear', stock: 40, featured: true },
  { id: 3, name: 'Maternity Gown', desc: 'Comfortable pregnancy night gown', price: 55.00, origPrice: 69.99, cat: 'Maternity Wear', stock: 30, featured: true },
  { id: 4, name: 'Baby Sneakers', desc: 'Non-slip soft sole baby sneakers', price: 28.00, origPrice: 34.99, cat: 'Baby Shoes', stock: 60, featured: true },
  { id: 5, name: 'Kids Backpack', desc: 'Colorful cartoon school backpack', price: 32.00, origPrice: 39.99, cat: 'School Bags', stock: 45, featured: false },
  { id: 6, name: 'Baby Feeding Set', desc: 'BPA-free plate, bowl, cup & spoon set', price: 25.00, origPrice: 32.99, cat: 'Feeding', stock: 70, featured: true },
  { id: 7, name: 'Baby Shampoo', desc: 'Gentle tear-free baby shampoo 200ml', price: 12.00, origPrice: 15.99, cat: 'Toiletries', stock: 100, featured: false },
  { id: 8, name: 'Baby Boy Set', desc: 'Onesie, pants & bib cotton set', price: 42.00, origPrice: 54.99, cat: 'Baby Sets', stock: 35, featured: false },
  { id: 9, name: 'Kids Polo Shirt', desc: 'Cotton polo shirt for boys', price: 22.00, origPrice: 27.99, cat: 'Kids Wear', stock: 55, featured: true },
  { id: 10, name: 'Nursing Cover', desc: 'Multi-use breastfeeding cover', price: 30.00, origPrice: 38.99, cat: 'Maternity Wear', stock: 25, featured: false },
  { id: 11, name: 'Baby Sandals', desc: 'Breathable leather baby sandals', price: 24.00, origPrice: 29.99, cat: 'Baby Shoes', stock: 40, featured: false },
  { id: 12, name: 'Lunch Bag', desc: 'Insulated kids lunch bag', price: 18.00, origPrice: 22.99, cat: 'School Bags', stock: 65, featured: true },
  { id: 13, name: 'Sippy Cup', desc: 'Leak-proof trainer cup 250ml', price: 10.00, origPrice: 13.99, cat: 'Feeding', stock: 90, featured: false },
  { id: 14, name: 'Baby Lotion', desc: 'Moisturizing baby lotion 300ml', price: 15.00, origPrice: 18.99, cat: 'Toiletries', stock: 80, featured: false },
  { id: 15, name: 'Winter Baby Set', desc: 'Warm fleece baby set with hood', price: 52.00, origPrice: 64.99, cat: 'Baby Sets', stock: 30, featured: true },
  { id: 16, name: 'Girls Tutu Dress', desc: 'Princess tutu dress with headband', price: 38.00, origPrice: 47.99, cat: 'Kids Wear', stock: 35, featured: false },
];

const defaultCategories = ['Baby Sets', 'Kids Wear', 'Maternity Wear', 'Baby Shoes', 'School Bags', 'Feeding', 'Toiletries'];

function getAllCategories() {
  const cats = new Set(defaultCategories);
  loadUserProducts().forEach(p => cats.add(p.cat));
  return Array.from(cats);
}

const reviews = [
  { name: 'Akua M.', rating: 5, comment: 'My baby loves this set! Very soft and comfortable.' },
  { name: 'Esi A.', rating: 4, comment: 'Beautiful dress, true to size. My daughter looks adorable.' },
  { name: 'Naa S.', rating: 5, comment: 'Perfect for pregnancy, very comfortable fabric.' },
  { name: 'Kojo B.', rating: 4, comment: 'Good quality shoes, my toddler walks well in them.' },
  { name: 'Abena D.', rating: 5, comment: 'Complete set, everything my baby needs for mealtime.' },
];

const coupons = [
  { code: 'WELCOME10', type: 'percentage', value: 10, min: 50 },
  { code: 'SAVE20', type: 'percentage', value: 20, min: 100 },
  { code: 'MOTHER5', type: 'fixed', value: 5, min: 30 },
];

const palette = {
  'Baby Sets': ['#e85d75','#d44a62'],
  'Kids Wear': ['#4a90d9','#357abd'],
  'Maternity Wear': ['#9b59b6','#8e44ad'],
  'Baby Shoes': ['#e67e22','#d35400'],
  'School Bags': ['#2ecc71','#27ae60'],
  'Feeding': ['#1abc9c','#16a085'],
  'Toiletries': ['#e74c3c','#c0392b'],
};

function svgImg(text, colors, size) {
  const w = size || 400, h = size || 400;
  const c = colors ? colors[0] : '#e85d75';
  const fs = Math.max(16, Math.round(w / 14));
  const s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<rect width="' + w + '" height="' + h + '" fill="' + c + '" rx="' + Math.round(w/50) + '"/>' +
    '<text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="#fff" font-family="sans-serif" font-size="' + fs + '" font-weight="700">' + text.replace(/&/g,'&amp;') + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;base64,' + btoa(s);
}

function prodImg(p) {
  if (p.img) return p.img;
  return svgImg(p.name, palette[p.cat], 400);
}

function catImg(c) {
  return svgImg(c, palette[c] || ['#e85d75','#d44a62'], 300);
}

function loadUserProducts() {
  try { return JSON.parse(localStorage.getItem('yonsa_user_products')) || []; } catch { return []; }
}

function saveUserProducts(list) {
  localStorage.setItem('yonsa_user_products', JSON.stringify(list));
}

function getAllProducts() {
  return [...defaultProducts, ...loadUserProducts()];
}

function getNextId() {
  const all = getAllProducts();
  return all.length ? Math.max(...all.map(p => p.id)) + 1 : 1;
}

function addUserProduct(p) {
  p.id = getNextId();
  p.featured = false;
  const list = loadUserProducts();
  list.push(p);
  saveUserProducts(list);
  return p;
}

function deleteUserProduct(id) {
  saveUserProducts(loadUserProducts().filter(p => p.id !== id));
}

function getCart() {
  try { return JSON.parse(localStorage.getItem('yonsa_cart')) || []; } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('yonsa_cart', JSON.stringify(cart));
}

function addToCart(id, variant) {
  const cart = getCart();
  const product = getAllProducts().find(p => p.id === id);
  if (!product) return;
  const key = id + '-' + (variant || '');
  const existing = cart.findIndex(i => i.key === key);
  if (existing > -1) {
    cart[existing].qty += 1;
  } else {
    cart.push({ key, id, name: product.name, price: product.price, img: prodImg(product), variant: variant || '', qty: 1 });
  }
  saveCart(cart);
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = total);
}

function getProductById(id) {
  return getAllProducts().find(p => p.id === parseInt(id));
}

function getDiscounted() {
  return getAllProducts().filter(p => p.origPrice && p.origPrice > p.price);
}

function getFeatured() {
  return getAllProducts().filter(p => p.featured);
}
