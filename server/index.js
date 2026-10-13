require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedDatabase } = require('./seed');

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

const app = express();
const PORT = process.env.PORT || 5000;

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

// Health check and demo reset
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Lava Já Matola API',
    timezone: 'Africa/Maputo (UTC+2)',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/reset-demo', (req, res) => {
  try {
    seedDatabase();
    res.json({ success: true, message: 'Base de dados reposta com sucesso para o cenário de demonstração!' });
  } catch (error) {
    console.error('Erro ao reiniciar cenário:', error);
    res.status(500).json({ error: 'Erro ao reiniciar base de dados.' });
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Lava Já Matola ativo na porta ${PORT}`);
  console.log(`📡 API pronta em http://localhost:${PORT}/api`);
});

module.exports = app;
