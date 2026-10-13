const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { getPointsForCategory, REWARD_POINT_COSTS, MINIMUM_REWARD_POINTS } = require('./config/loyalty');
const { normalizeLegacyLoyaltyBonuses } = require('./utils/loyalty-migration');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'lavaja.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('customer', 'employee', 'admin')) NOT NULL DEFAULT 'customer',
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Lava Já Matola - Lavagem rápida e de confiança',
      address TEXT NOT NULL DEFAULT 'Av. da Matola, Paragem Padaria, Matola, Moçambique',
      phone TEXT NOT NULL DEFAULT '+258 84 123 4567',
      email TEXT NOT NULL DEFAULT 'contacto@lavajamatola.co.mz',
      google_maps_url TEXT NOT NULL DEFAULT 'https://maps.google.com/?q=Matola,+Mocambique',
      coordinates TEXT NOT NULL DEFAULT '-25.9622,32.4589',
      open_time TEXT NOT NULL DEFAULT '07:30',
      close_time TEXT NOT NULL DEFAULT '18:00',
      slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
      simultaneous_capacity INTEGER NOT NULL DEFAULT 3,
      points_per_mzn REAL NOT NULL DEFAULT 0.1,
      is_demo_mode INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Geral',
      price_mzn REAL NOT NULL,
      duration_minutes INTEGER NOT NULL,
      points_reward INTEGER NOT NULL DEFAULT 10,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      vehicle_plate TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      service_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
      scheduled_time TEXT NOT NULL, -- HH:MM
      duration_minutes INTEGER NOT NULL,
      end_time TEXT NOT NULL,       -- HH:MM
      bay_number INTEGER DEFAULT 1,
      status TEXT CHECK(status IN ('reservado', 'aguardando', 'em_atendimento', 'concluido', 'cancelado')) NOT NULL DEFAULT 'reservado',
      notes TEXT,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS reservation_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_user_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      balance_points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reservation_id INTEGER,
      type TEXT CHECK(type IN ('earn', 'redeem')) NOT NULL,
      points INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      points_cost INTEGER NOT NULL,
      discount_mzn REAL DEFAULT 0,
      service_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reward_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      redemption_code TEXT UNIQUE NOT NULL,
      status TEXT CHECK(status IN ('disponivel', 'utilizado', 'expirado')) NOT NULL DEFAULT 'disponivel',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      code TEXT UNIQUE NOT NULL,
      discount_percentage INTEGER NOT NULL,
      service_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      target_role TEXT, -- 'customer', 'employee', 'admin', 'all'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT CHECK(type IN ('info', 'success', 'warning', 'alert')) NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      reservation_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `;

  db.exec(schema);
  db.prepare(`
    UPDATE business_settings
    SET name = 'Lava Já Matola - Lavagem rápida e de confiança'
    WHERE name = 'Lava Já Matola - Car Wash Inteligente'
  `).run();
  const loyaltyMigration = normalizeLegacyLoyaltyBonuses(db);
  if (loyaltyMigration.updatedTransactions > 0) {
    console.log(
      `Bónus antigos ajustados: ${loyaltyMigration.updatedTransactions} movimentos atualizados; ${loyaltyMigration.pointsRemoved} pontos removidos.`
    );
  }

  const updateServicePoints = db.prepare('UPDATE services SET points_reward = ? WHERE id = ?');
  for (const service of db.prepare('SELECT id, category FROM services').all()) {
    updateServicePoints.run(getPointsForCategory(service.category), service.id);
  }
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Perfumador de Painel%'")
    .run(REWARD_POINT_COSTS.AIR_FRESHENER);
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Aplicação Gratuita de Cera%'")
    .run(REWARD_POINT_COSTS.WAX_APPLICATION);
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Desconto de 100 MT%'")
    .run(REWARD_POINT_COSTS.WASH_DISCOUNT);
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Lavagem Exterior Grátis%'")
    .run(REWARD_POINT_COSTS.FREE_EXTERIOR_WASH);
  db.prepare('UPDATE rewards SET points_cost = ? WHERE points_cost < ?')
    .run(MINIMUM_REWARD_POINTS, MINIMUM_REWARD_POINTS);
}

initSchema();

module.exports = db;
