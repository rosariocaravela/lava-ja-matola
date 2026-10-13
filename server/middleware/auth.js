const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET deve estar definido e conter pelo menos 32 caracteres.');
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authVersion: user.auth_version || 0
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou token inválido' });
    }

    const user = db.prepare('SELECT must_change_password, is_active, auth_version FROM users WHERE id = ?').get(decodedUser.id);
    if (!user) {
      return res.status(401).json({ error: 'Utilizador não encontrado.' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'Esta conta está desativada.' });
    }
    if ((decodedUser.authVersion || 0) !== user.auth_version) {
      return res.status(401).json({ error: 'Sessão revogada. Inicie sessão novamente.' });
    }

    const allowedDuringPasswordChange = req.baseUrl === '/api/auth' &&
      (req.path === '/me' || req.path === '/change-password');
    if (user.must_change_password && !allowedDuringPasswordChange) {
      return res.status(403).json({
        error: 'Altere a palavra-passe inicial antes de continuar.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    req.user = decodedUser;
    next();
  });
}

function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      req.user = null;
    } else {
      const user = db.prepare('SELECT is_active, auth_version FROM users WHERE id = ?').get(decodedUser.id);
      req.user = user && user.is_active && (decodedUser.authVersion || 0) === user.auth_version
        ? decodedUser
        : null;
    }
    next();
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso não autorizado. Perfil necessário: [${allowedRoles.join(', ')}]. O seu perfil: ${req.user.role}`
      });
    }
    next();
  };
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalToken,
  requireRole,
  JWT_SECRET
};
