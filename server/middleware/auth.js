const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lava-ja-ai-hackathon-mozaxlab-supersecret-jwt-key-2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
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
      req.user = decodedUser;
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
