const bcrypt = require('bcryptjs');

function bootstrapAdmin(db, environment = process.env) {
  const name = environment.INITIAL_ADMIN_NAME?.trim();
  const email = environment.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.INITIAL_ADMIN_PASSWORD;
  const configuredValues = [name, email, password].filter(Boolean).length;

  if (configuredValues === 0) return { created: false, skipped: true };
  if (!name || !email || !password) {
    throw new Error('Configure INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD em conjunto.');
  }
  if (!email.includes('@')) {
    throw new Error('INITIAL_ADMIN_EMAIL deve conter um endereço de email válido.');
  }
  if (password.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD deve conter pelo menos 12 caracteres.');
  }

  return db.transaction(() => {
    const existingUser = db.prepare('SELECT id, role FROM users WHERE LOWER(email) = ?').get(email);
    if (existingUser) {
      if (existingUser.role !== 'admin') {
        throw new Error('INITIAL_ADMIN_EMAIL já pertence a uma conta que não é administradora.');
      }
      return { created: false, skipped: true };
    }

    const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
    `).run(name, email, passwordHash);

    return { created: true, skipped: false };
  })();
}

module.exports = { bootstrapAdmin };
