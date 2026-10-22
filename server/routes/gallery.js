const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const galleryDirectory = process.env.GALLERY_UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'gallery');
const imageTypes = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  webp: { mime: 'image/webp', extension: 'webp' }
};

fs.mkdirSync(galleryDirectory, { recursive: true });

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return imageTypes.jpeg;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return imageTypes.png;
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return imageTypes.webp;
  return null;
}

function photoPath(filename) {
  return path.join(galleryDirectory, filename);
}

router.get('/', (req, res) => {
  try {
    const photos = db.prepare(`
      SELECT id, title, alt_text, created_at, published_at
      FROM site_photos
      WHERE is_published = 1
      ORDER BY published_at DESC, id DESC
    `).all();
    return res.json(photos);
  } catch (error) {
    console.error('Erro ao carregar galeria pública:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as fotografias.' });
  }
});

router.get('/manage', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const photos = db.prepare(`
      SELECT id, title, alt_text, is_published, authorized_for_publication, created_at, published_at
      FROM site_photos
      ORDER BY is_published ASC, created_at DESC, id DESC
    `).all();
    return res.json(photos);
  } catch (error) {
    console.error('Erro ao carregar gestão da galeria:', error);
    return res.status(500).json({ error: 'Não foi possível carregar a gestão de fotografias.' });
  }
});

router.post(
  '/manage',
  authenticateToken,
  requireRole(['admin']),
  express.raw({ type: 'application/octet-stream', limit: '5mb' }),
  (req, res) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const altText = typeof req.query.alt_text === 'string' ? req.query.alt_text.trim() : '';
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Selecione uma fotografia para carregar.' });
    }
    if (!title || title.length > 100 || !altText || altText.length > 200) {
      return res.status(400).json({ error: 'O título (até 100 caracteres) e o texto alternativo (até 200) são obrigatórios.' });
    }
    if (req.query.authorized !== 'true') {
      return res.status(400).json({ error: 'Confirme que possui autorização para publicar esta fotografia.' });
    }

    const imageType = detectImageType(req.body);
    if (!imageType) {
      return res.status(415).json({ error: 'Formato não suportado. Use uma fotografia JPEG, PNG ou WebP válida.' });
    }

    const filename = `${crypto.randomUUID()}.${imageType.extension}`;
    const destination = photoPath(filename);
    try {
      fs.writeFileSync(destination, req.body, { flag: 'wx' });
      const result = db.prepare(`
        INSERT INTO site_photos (filename, title, alt_text, authorized_for_publication, uploaded_by_user_id)
        VALUES (?, ?, ?, 1, ?)
      `).run(filename, title, altText, req.user.id);
      return res.status(201).json({
        message: 'Fotografia carregada. Aguarda aprovação do gestor para aparecer no site.',
        photo: db.prepare(`
          SELECT id, title, alt_text, is_published, authorized_for_publication, created_at, published_at
          FROM site_photos WHERE id = ?
        `).get(result.lastInsertRowid)
      });
    } catch (error) {
      try {
        fs.unlinkSync(destination);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') console.error('Erro ao remover fotografia após falha:', cleanupError);
      }
      console.error('Erro ao guardar fotografia da galeria:', error);
      return res.status(500).json({ error: 'Não foi possível guardar a fotografia.' });
    }
  }
);

router.get('/manage/:id/image', authenticateToken, requireRole(['admin']), (req, res) => {
  const photo = db.prepare('SELECT filename FROM site_photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Fotografia não encontrada.' });
  return sendPhoto(photo.filename, res);
});

router.patch('/manage/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const isPublished = req.body.is_published;
  if (typeof isPublished !== 'boolean') {
    return res.status(400).json({ error: 'Indique se a fotografia deve ser publicada ou retirada do site.' });
  }
  try {
    const result = db.prepare(`
      UPDATE site_photos
      SET is_published = ?, published_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ? AND authorized_for_publication = 1
    `).run(isPublished ? 1 : 0, isPublished ? 1 : 0, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Fotografia não encontrada ou sem autorização registada.' });
    return res.json({ message: isPublished ? 'Fotografia publicada no site.' : 'Fotografia retirada do site.' });
  } catch (error) {
    console.error('Erro ao atualizar publicação da fotografia:', error);
    return res.status(500).json({ error: 'Não foi possível atualizar a publicação.' });
  }
});

router.delete('/manage/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const photo = db.prepare('SELECT filename FROM site_photos WHERE id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Fotografia não encontrada.' });
    db.prepare('DELETE FROM site_photos WHERE id = ?').run(req.params.id);
    try {
      fs.unlinkSync(photoPath(photo.filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return res.json({ message: 'Fotografia removida da galeria.' });
  } catch (error) {
    console.error('Erro ao remover fotografia:', error);
    return res.status(500).json({ error: 'Não foi possível remover a fotografia.' });
  }
});

router.get('/:id/image', (req, res) => {
  const photo = db.prepare('SELECT filename FROM site_photos WHERE id = ? AND is_published = 1').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Fotografia não encontrada.' });
  return sendPhoto(photo.filename, res);
});

function sendPhoto(filename, res) {
  const extension = path.extname(filename).slice(1);
  const imageType = Object.values(imageTypes).find(type => type.extension === extension);
  if (!imageType || path.basename(filename) !== filename) {
    return res.status(404).json({ error: 'Fotografia não encontrada.' });
  }
  res.set({
    'Content-Type': imageType.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=0, must-revalidate'
  });
  const filePath = photoPath(filename);
  const stream = fs.createReadStream(filePath);
  stream.on('error', error => {
    console.error('Erro ao servir fotografia da galeria:', error);
    if (!res.headersSent) {
      res.status(error.code === 'ENOENT' ? 404 : 500).json({
        error: error.code === 'ENOENT' ? 'Fotografia não encontrada.' : 'Não foi possível carregar a fotografia.'
      });
    } else {
      res.destroy(error);
    }
  });
  return stream.pipe(res);
}

module.exports = router;
