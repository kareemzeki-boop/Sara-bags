const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM products WHERE active = 1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY id ASC';
    const products = db.prepare(query).all(...params);

    // Parse JSON fields
    const parsed = products.map(p => ({
      ...p,
      colours: JSON.parse(p.colours),
      unavail: JSON.parse(p.unavail)
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    res.json({
      success: true,
      data: {
        ...product,
        colours: JSON.parse(product.colours),
        unavail: JSON.parse(product.unavail)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// GET /api/products/categories/list
router.get('/categories/list', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
    res.json({ success: true, data: ['All', ...cats.map(c => c.category)] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

module.exports = router;

// POST /api/products — create product (admin)
router.post('/', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const { name, subtitle, description, price, category, colours, unavail, bg_text, active, image_b64 } = req.body;
    if (!name || !category || !price) return res.status(400).json({ success: false, error: 'name, category, price required' });
    const result = db.prepare(`
      INSERT INTO products (name, subtitle, description, price, category, colours, unavail, bg_text, active, image_b64)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, subtitle||null, description||null, price, category,
        JSON.stringify(colours||[]), JSON.stringify(unavail||[]),
        bg_text||null, active!=null?active:1, image_b64||null);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/products/:id — update product (admin)
router.put('/:id', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const { name, subtitle, description, price, category, colours, unavail, bg_text, active, image_b64 } = req.body;
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name=?'); vals.push(name); }
    if (subtitle !== undefined) { fields.push('subtitle=?'); vals.push(subtitle); }
    if (description !== undefined) { fields.push('description=?'); vals.push(description); }
    if (price !== undefined) { fields.push('price=?'); vals.push(price); }
    if (category !== undefined) { fields.push('category=?'); vals.push(category); }
    if (colours !== undefined) { fields.push('colours=?'); vals.push(JSON.stringify(colours)); }
    if (unavail !== undefined) { fields.push('unavail=?'); vals.push(JSON.stringify(unavail)); }
    if (bg_text !== undefined) { fields.push('bg_text=?'); vals.push(bg_text); }
    if (active !== undefined) { fields.push('active=?'); vals.push(active); }
    if (image_b64 !== undefined) { fields.push('image_b64=?'); vals.push(image_b64); }
    vals.push(req.params.id);
    db.prepare(`UPDATE products SET ${fields.join(',')} WHERE id=?`).run(...vals);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/products/:id (admin)
router.delete('/:id', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});
