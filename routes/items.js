const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadToAzure = require('../azureBlob');
const { poolPromise } = require('../db');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = await uploadToAzure(req.file);
    res.status(200).json({ url: imageUrl });
  } catch (err) {
    console.error('❌ Upload image error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

router.post('/upload', async (req, res) => {
  const {
    user_id,
    title,
    description,
    price,
    whatsapp,
    category,
    image_urls
  } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const insertItem = await pool
      .request()
      .input('user_id', user_id)
      .input('title', title)
      .input('description', description)
      .input('price', price)
      .input('whatsapp', whatsapp)
      .input('category', category)
      .query(`
        INSERT INTO Items (user_id, title, description, price, whatsapp, category)
        OUTPUT INSERTED.id
        VALUES (@user_id, @title, @description, @price, @whatsapp, @category)
      `);

    const itemId = insertItem.recordset[0].id;

    for (const url of image_urls) {
      await pool
        .request()
        .input('item_id', itemId)
        .input('image_url', url)
        .query(`
          INSERT INTO ItemImages (item_id, image_url)
          VALUES (@item_id, @image_url)
        `);
    }

    res.status(201).json({ message: 'Item uploaded successfully', item_id: itemId });
  } catch (err) {
    console.error('❌ Upload item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const itemsResult = await pool
      .request()
      .query(`
        SELECT i.*, u.name, u.contact
        FROM Items i
        JOIN Users u ON i.user_id = u.id
        WHERE i.is_sold = 0
        ORDER BY i.created_at DESC
      `);

    const items = itemsResult.recordset;

    for (const item of items) {
      const images = await pool
        .request()
        .input('item_id', item.id)
        .query('SELECT image_url FROM ItemImages WHERE item_id = @item_id');
      item.images = images.recordset.map(img => img.image_url);
    }

    res.status(200).json(items);
  } catch (err) {
    console.error('❌ Fetch all items error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const itemsResult = await pool
      .request()
      .input('user_id', user_id)
      .query(`
        SELECT * FROM Items
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);

    const items = itemsResult.recordset;

    for (const item of items) {
      const images = await pool
        .request()
        .input('item_id', item.id)
        .query('SELECT image_url FROM ItemImages WHERE item_id = @item_id');
      item.images = images.recordset.map(img => img.image_url);
    }

    res.status(200).json(items);
  } catch (err) {
    console.error('❌ Fetch user items error:', err);
    res.status(500).json({ error: 'Failed to fetch user items' });
  }
});

router.get('/detail/:item_id', async (req, res) => {
  const { item_id } = req.params;
  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const itemResult = await pool
      .request()
      .input('item_id', item_id)
      .query(`
        SELECT i.*, u.name, u.contact
        FROM Items i
        JOIN Users u ON i.user_id = u.id
        WHERE i.id = @item_id
      `);

    if (itemResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const item = itemResult.recordset[0];

    const images = await pool
      .request()
      .input('item_id', item_id)
      .query('SELECT image_url FROM ItemImages WHERE item_id = @item_id');

    item.images = images.recordset.map(img => img.image_url);

    res.status(200).json(item);
  } catch (err) {
    console.error('❌ Fetch item detail error:', err);
    res.status(500).json({ error: 'Failed to fetch item detail' });
  }
});

router.put('/edit/:item_id', async (req, res) => {
  const { item_id } = req.params;
  const { title, description, price, whatsapp, category } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    await pool
      .request()
      .input('item_id', item_id)
      .input('title', title)
      .input('description', description)
      .input('price', price)
      .input('whatsapp', whatsapp)
      .input('category', category)
      .query(`
        UPDATE Items
        SET title = @title,
            description = @description,
            price = @price,
            whatsapp = @whatsapp,
            category = @category
        WHERE id = @item_id
      `);

    res.status(200).json({ message: 'Item updated successfully' });
  } catch (err) {
    console.error('❌ Edit item error:', err);
    res.status(500).json({ error: 'Failed to edit item' });
  }
});

router.patch('/sold/:item_id', async (req, res) => {
  const { item_id } = req.params;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    await pool
      .request()
      .input('item_id', item_id)
      .query(`
        UPDATE Items
        SET is_sold = 1
        WHERE id = @item_id
      `);

    res.status(200).json({ message: 'Item marked as sold' });
  } catch (err) {
    console.error('❌ Mark as sold error:', err);
    res.status(500).json({ error: 'Failed to mark item as sold' });
  }
});

router.get('/search', async (req, res) => {
  const { query = '', category = '' } = req.query;

  try {
    const pool = await poolPromise;
    if (!pool) {
      console.error('❌ Database connection is undefined');
      return res.status(500).json({ error: 'Database not connected' });
    }

    let sqlQuery = `
      SELECT i.*, u.name, u.contact
      FROM Items i
      JOIN Users u ON i.user_id = u.id
      WHERE i.is_sold = 0
    `;

    let request = pool.request();

    if (query) {
      sqlQuery += ` AND (i.title LIKE @query OR i.description LIKE @query)`;
      request = request.input('query', `%${query}%`);
    }

    if (category) {
      sqlQuery += ` AND i.category = @category`;
      request = request.input('category', category);
    }

    sqlQuery += ` ORDER BY i.created_at DESC`;

    const itemsResult = await request.query(sqlQuery);
    const items = itemsResult.recordset;

    for (const item of items) {
      const images = await pool
        .request()
        .input('item_id', item.id)
        .query('SELECT image_url FROM ItemImages WHERE item_id = @item_id');
      item.images = images.recordset.map(img => img.image_url);
    }

    res.status(200).json(items);
  } catch (err) {
    console.error('❌ Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
