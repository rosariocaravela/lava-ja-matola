require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { bootstrapAdmin } = require('./utils/bootstrap-admin');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const settingsRoutes = require('./routes/settings');
const availabilityRoutes = require('./routes/availability');
const reservationsRoutes = require('./routes/reservations');
const queueRoutes = require('./routes/queue');
const loyaltyRoutes = require('./routes/loyalty');
const promotionsRoutes = require('./routes/promotions');
const notificationsRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const usersRoutes = require('./routes/users');
const paymentsRoutes = require('./routes/payments');
const reviewsRoutes = require('./routes/reviews');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.PORT || 5000;

try {
  const adminBootstrap = bootstrapAdmin(db);
  if (adminBootstrap.created) {
    console.log('Conta administradora inicial criada a partir das variáveis de ambiente.');
  }
} catch (error) {
  console.error('Não foi possível configurar a conta administradora inicial:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai-assistant', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/gallery', galleryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Lava Já Matola API',
    timezone: 'Africa/Maputo (UTC+2)',
    timestamp: new Date().toISOString()
  });
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status === 413
      ? 'A fotografia excede o limite de 5 MB.'
      : status === 400
        ? 'O pedido enviado é inválido.'
        : 'Ocorreu um erro interno no servidor.'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Lava Já Matola ativo na porta ${PORT}`);
  console.log(`📡 API pronta em http://localhost:${PORT}/api`);
});

module.exports = app;
