const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { REWARD_POINT_COSTS, MINIMUM_REWARD_POINTS } = require('./config/loyalty');
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

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      onsite_open_time TEXT NOT NULL DEFAULT '08:00',
      onsite_close_time TEXT NOT NULL DEFAULT '17:00',
      onsite_slot_interval_minutes INTEGER NOT NULL DEFAULT 120,
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
      booking_type TEXT NOT NULL DEFAULT 'shop' CHECK(booking_type IN ('shop', 'onsite')),
      location_address TEXT,
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

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      alt_text TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0, 1)),
      authorized_for_publication INTEGER NOT NULL DEFAULT 0 CHECK(authorized_for_publication IN (0, 1)),
      uploaded_by_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
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
      benefit_type TEXT NOT NULL DEFAULT 'discount' CHECK(benefit_type IN ('discount', 'service')),
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
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservation_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER UNIQUE NOT NULL,
      original_amount_mzn REAL NOT NULL CHECK(original_amount_mzn >= 0),
      promotion_code TEXT,
      promotion_discount_mzn REAL NOT NULL DEFAULT 0 CHECK(promotion_discount_mzn >= 0),
      reward_code TEXT,
      reward_discount_mzn REAL NOT NULL DEFAULT 0 CHECK(reward_discount_mzn >= 0),
      mozabanco_discount_mzn REAL NOT NULL DEFAULT 0 CHECK(mozabanco_discount_mzn >= 0),
      reward_title TEXT,
      reward_description TEXT,
      reward_service_name TEXT,
      benefit_source TEXT NOT NULL DEFAULT 'passaporte' CHECK(benefit_source IN ('passaporte', 'moza')),
      total_discount_mzn REAL NOT NULL DEFAULT 0 CHECK(total_discount_mzn >= 0),
      amount_paid_mzn REAL NOT NULL DEFAULT 0 CHECK(amount_paid_mzn >= 0),
      method TEXT CHECK(method IN ('mpesa', 'emola', 'mkesh', 'mozabanco', 'balcao')),
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'falhado', 'cancelado')),
      simulated INTEGER NOT NULL DEFAULT 0 CHECK(simulated IN (0, 1)),
      transaction_reference TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS moza_benefit_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cycle_number INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('in_progress', 'unlocked', 'used', 'expired')),
      redemption_code TEXT UNIQUE,
      unlocked_at DATETIME,
      expires_at DATETIME,
      used_at DATETIME,
      used_reservation_id INTEGER,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, cycle_number),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (used_reservation_id) REFERENCES reservations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS moza_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cycle_id INTEGER NOT NULL,
      provider_transaction_id TEXT NOT NULL UNIQUE,
      amount_mzn REAL NOT NULL CHECK(amount_mzn > 0),
      currency TEXT NOT NULL CHECK(currency = 'MZN'),
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'cancelled', 'reversed')),
      occurred_at DATETIME NOT NULL,
      source TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (cycle_id) REFERENCES moza_benefit_cycles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_moza_transactions_cycle_status
      ON moza_transactions(cycle_id, status);

    CREATE TABLE IF NOT EXISTS moza_transaction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      provider_transaction_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL CHECK(new_status IN ('confirmed', 'cancelled', 'reversed')),
      payload_hash TEXT NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('users', 'auth_version', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('rewards', 'benefit_type', "TEXT NOT NULL DEFAULT 'discount' CHECK(benefit_type IN ('discount', 'service'))");
  ensureColumn('reward_redemptions', 'expires_at', 'DATETIME');
  ensureColumn('reservation_payments', 'mozabanco_discount_mzn', 'REAL NOT NULL DEFAULT 0 CHECK(mozabanco_discount_mzn >= 0)');
  ensureColumn('reservation_payments', 'benefit_source', "TEXT NOT NULL DEFAULT 'passaporte' CHECK(benefit_source IN ('passaporte', 'moza'))");
  ensureColumn('reservations', 'vehicle_received_at', 'DATETIME');
  ensureColumn('reservations', 'vehicle_received_by_user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  ensureColumn('reservations', 'booking_type', "TEXT NOT NULL DEFAULT 'shop' CHECK(booking_type IN ('shop', 'onsite'))");
  ensureColumn('reservations', 'location_address', 'TEXT');
  ensureColumn('business_settings', 'onsite_open_time', "TEXT NOT NULL DEFAULT '08:00'");
  ensureColumn('business_settings', 'onsite_close_time', "TEXT NOT NULL DEFAULT '17:00'");
  ensureColumn('business_settings', 'onsite_slot_interval_minutes', 'INTEGER NOT NULL DEFAULT 120');

  db.prepare(`
    UPDATE rewards
    SET benefit_type = 'service'
    WHERE title LIKE 'Perfumador de Painel%'
       OR title = 'Limpeza do Painel + Ambientador'
       OR title LIKE 'Aplicação Gratuita de Cera%'
       OR title LIKE 'Lavagem Exterior Grátis%'
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO reservation_payments (reservation_id, original_amount_mzn)
    SELECT r.id, s.price_mzn
    FROM reservations r
    JOIN services s ON s.id = r.service_id
  `).run();

  db.prepare(`
    UPDATE business_settings
    SET name = 'Lava Já Matola - Lavagem rápida e de confiança'
    WHERE name = 'Lava Já Matola - Car Wash Inteligente'
  `).run();
  db.prepare(`
    UPDATE services
    SET name = CASE name
      WHEN 'Lavagem Exterior Rápida' THEN 'Lavagem Exterior'
      WHEN 'Lavagem Completa (Exterior + Interior)' THEN 'Lavagem Completa'
      WHEN 'Lavagem Técnica de Motor a Vapor' THEN 'Lavagem do Motor'
      WHEN 'Lavagem VIP Premium com Cera' THEN 'Lavagem Completa Premium'
      WHEN 'Lavagem Completa com Cera' THEN 'Lavagem Completa Premium'
      WHEN 'Higienização de Estofos & Ar Condicionado' THEN 'Limpeza de Estofos e Interior'
    END,
    description = CASE name
      WHEN 'Lavagem Exterior Rápida' THEN 'Lavagem da parte exterior da viatura, limpeza das jantes e secagem.'
      WHEN 'Lavagem Completa (Exterior + Interior)' THEN 'Lavagem exterior, aspiração do interior, limpeza do painel e aplicação de ambientador.'
      WHEN 'Lavagem Técnica de Motor a Vapor' THEN 'Limpeza do motor para remover gordura e sujidade, com cuidado para proteger os componentes.'
      WHEN 'Lavagem VIP Premium com Cera' THEN 'Lavagem exterior e interior, com aplicação de cera para brilho e proteção da pintura.'
      WHEN 'Lavagem Completa com Cera' THEN 'Lavagem exterior e interior, com aplicação de cera para brilho e proteção da pintura.'
      WHEN 'Higienização de Estofos & Ar Condicionado' THEN 'Limpeza profunda dos bancos e do teto da viatura, incluindo as saídas do ar condicionado.'
    END
    WHERE name IN (
      'Lavagem Exterior Rápida',
      'Lavagem Completa (Exterior + Interior)',
      'Lavagem Técnica de Motor a Vapor',
      'Lavagem VIP Premium com Cera',
      'Lavagem Completa com Cera',
      'Higienização de Estofos & Ar Condicionado'
    )
  `).run();
  const loyaltyMigration = normalizeLegacyLoyaltyBonuses(db);
  if (loyaltyMigration.updatedTransactions > 0) {
    console.log(
      `Bónus antigos ajustados: ${loyaltyMigration.updatedTransactions} movimentos atualizados; ${loyaltyMigration.pointsRemoved} pontos removidos.`
    );
  }

  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Perfumador de Painel%'")
    .run(REWARD_POINT_COSTS.AIR_FRESHENER);
  db.prepare(`
    UPDATE rewards
    SET title = 'Limpeza do Painel & Ambientador',
        description = 'Limpeza do painel e aplicação de ambientador no interior da viatura.'
    WHERE title LIKE 'Perfumador de Painel%'
  `).run();
  db.prepare(`
    UPDATE promotions
    SET discount_percentage = 10,
        description = '10% de desconto em qualquer serviço todas as quartas-feiras'
    WHERE code = 'QUARTA20'
  `).run();
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Aplicação Gratuita de Cera%'")
    .run(REWARD_POINT_COSTS.WAX_APPLICATION);
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Desconto de 100 MT%'")
    .run(REWARD_POINT_COSTS.WASH_DISCOUNT);
  db.prepare("UPDATE rewards SET points_cost = ? WHERE title LIKE 'Lavagem Exterior Grátis%'")
    .run(REWARD_POINT_COSTS.FREE_EXTERIOR_WASH);
  db.prepare('UPDATE rewards SET points_cost = ? WHERE points_cost < ?')
    .run(MINIMUM_REWARD_POINTS, MINIMUM_REWARD_POINTS);
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(existing => existing.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

initSchema();

module.exports = db;
