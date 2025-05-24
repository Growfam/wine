-- ===================================================================
-- СХЕМА ТАБЛИЦЬ SUPABASE ДЛЯ СИСТЕМИ ЗАВДАНЬ WINIX
-- ===================================================================

-- 👤 КОРИСТУВАЧІ (основна таблиця існує як 'winix')
-- Розширена версія з полями для системи завдань
ALTER TABLE winix ADD COLUMN IF NOT EXISTS
    language_code VARCHAR(10) DEFAULT 'uk',
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    notifications_enabled BOOLEAN DEFAULT true,
    newbie_bonus_claimed BOOLEAN DEFAULT false;

-- 🎯 ЗАВДАННЯ
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,

    -- Тип і платформа
    type VARCHAR(50) NOT NULL, -- 'telegram', 'social', 'daily', 'referral'
    platform VARCHAR(50), -- 'telegram', 'youtube', 'twitter', 'discord'
    action VARCHAR(50), -- 'subscribe', 'follow', 'join', 'like'

    -- Винагорода
    winix_reward DECIMAL(15,2) DEFAULT 0,
    tickets_reward INTEGER DEFAULT 0,

    -- Конфігурація
    url TEXT,
    channel_username VARCHAR(100),
    requirements JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Статус і пріоритет
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    max_completions INTEGER, -- NULL = необмежено
    current_completions INTEGER DEFAULT 0,

    -- Часові обмеження
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100),

    -- Індекси
    CONSTRAINT valid_task_type CHECK (type IN ('telegram', 'social', 'daily', 'referral', 'wallet')),
    CONSTRAINT valid_platform CHECK (platform IN ('telegram', 'youtube', 'twitter', 'discord', 'ton')),
    CONSTRAINT positive_rewards CHECK (winix_reward >= 0 AND tickets_reward >= 0)
);

-- Індекси для tasks
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);

-- 📋 СТАН ВИКОНАННЯ ЗАВДАНЬ КОРИСТУВАЧАМИ
CREATE TABLE IF NOT EXISTS user_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Статус
    status VARCHAR(20) DEFAULT 'available', -- 'available', 'started', 'pending', 'completed', 'claimed', 'expired'
    progress INTEGER DEFAULT 0, -- 0-100%

    -- Часові мітки
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Дані верифікації
    verification_data JSONB DEFAULT '{}',
    verification_attempts INTEGER DEFAULT 0,
    last_verification_at TIMESTAMPTZ,

    -- Винагорода
    reward_winix DECIMAL(15,2),
    reward_tickets INTEGER,
    reward_transaction_id VARCHAR(100),

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Унікальність
    UNIQUE(telegram_id, task_id),

    -- Перевірки
    CONSTRAINT valid_status CHECK (status IN ('available', 'started', 'pending', 'completed', 'claimed', 'expired')),
    CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100)
);

-- Індекси для user_tasks
CREATE INDEX IF NOT EXISTS idx_user_tasks_telegram_id ON user_tasks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task_id ON user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_completed ON user_tasks(completed_at DESC);

-- 💰 ТРАНЗАКЦІЇ (централізована таблиця)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,

    -- Тип і сума
    type VARCHAR(50) NOT NULL, -- 'task_reward', 'daily_bonus', 'flex_reward', 'wallet_connection_bonus', 'referral_bonus'
    amount_winix DECIMAL(15,2) DEFAULT 0,
    amount_tickets INTEGER DEFAULT 0,
    amount_flex INTEGER DEFAULT 0,

    -- Статус
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'

    -- Посилання
    reference_type VARCHAR(50), -- 'task', 'daily', 'flex_level', 'wallet'
    reference_id VARCHAR(100),

    -- Опис
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Баланси до/після
    balance_before JSONB,
    balance_after JSONB,

    -- Помилки
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Перевірки
    CONSTRAINT valid_transaction_type CHECK (type IN ('task_reward', 'daily_bonus', 'flex_reward', 'wallet_connection_bonus', 'referral_bonus', 'admin_adjustment', 'purchase', 'withdrawal')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

-- Індекси для transactions
CREATE INDEX IF NOT EXISTS idx_transactions_telegram_id ON transactions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id);

-- 📅 ЩОДЕННІ БОНУСИ
CREATE TABLE IF NOT EXISTS daily_bonus_status (
    telegram_id VARCHAR(50) PRIMARY KEY,

    -- Streak інформація
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_claim_date DATE,
    next_available_date TIMESTAMPTZ,

    -- Статистика
    total_days_claimed INTEGER DEFAULT 0,
    total_winix_earned DECIMAL(15,2) DEFAULT 0,
    total_tickets_earned INTEGER DEFAULT 0,

    -- Поточний цикл (1-30 днів)
    current_day_number INTEGER DEFAULT 1,
    cycle_start_date DATE,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Перевірки
    CONSTRAINT valid_streak CHECK (current_streak >= 0 AND longest_streak >= 0),
    CONSTRAINT valid_day_number CHECK (current_day_number >= 1 AND current_day_number <= 30)
);

-- 📅 ІСТОРІЯ ЩОДЕННИХ БОНУСІВ
CREATE TABLE IF NOT EXISTS daily_bonus_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,

    -- Інформація про отримання
    claim_date DATE NOT NULL,
    day_number INTEGER NOT NULL,
    streak_at_claim INTEGER NOT NULL,

    -- Винагорода
    winix_amount DECIMAL(15,2) NOT NULL,
    tickets_amount INTEGER NOT NULL,

    -- Мітки
    is_special_day BOOLEAN DEFAULT false,
    multiplier_applied DECIMAL(3,2) DEFAULT 1.0,

    -- Транзакція
    transaction_id UUID REFERENCES transactions(id),

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Індекси
    FOREIGN KEY (telegram_id) REFERENCES daily_bonus_status(telegram_id) ON DELETE CASCADE
);

-- Індекси для daily_bonus_entries
CREATE INDEX IF NOT EXISTS idx_daily_entries_telegram_id ON daily_bonus_entries(telegram_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_bonus_entries(claim_date DESC);

-- 💎 FLEX CLAIMS (історія отримання FLEX винагород)
CREATE TABLE IF NOT EXISTS flex_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,

    -- Рівень і баланс
    flex_level VARCHAR(20) NOT NULL, -- 'bronze', 'silver', 'gold', 'diamond'
    flex_balance INTEGER NOT NULL,

    -- Винагорода
    winix_amount DECIMAL(15,2) NOT NULL,
    tickets_amount INTEGER NOT NULL,

    -- Транзакція
    transaction_id UUID REFERENCES transactions(id),

    -- Часові обмеження
    claim_date DATE NOT NULL,
    can_claim_again_at TIMESTAMPTZ NOT NULL,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Перевірки
    CONSTRAINT valid_flex_level CHECK (flex_level IN ('bronze', 'silver', 'gold', 'diamond')),
    CONSTRAINT positive_flex_balance CHECK (flex_balance >= 0)
);

-- Індекси для flex_claims
CREATE INDEX IF NOT EXISTS idx_flex_claims_telegram_id ON flex_claims(telegram_id);
CREATE INDEX IF NOT EXISTS idx_flex_claims_date ON flex_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_flex_claims_level ON flex_claims(flex_level);

-- 🔗 TON ГАМАНЦІ
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,

    -- Адреса і ключі
    address VARCHAR(100) NOT NULL UNIQUE,
    public_key VARCHAR(200),

    -- Мережа
    chain VARCHAR(20) DEFAULT '-239', -- TON mainnet
    provider VARCHAR(50), -- 'tonkeeper', 'tonhub', etc.

    -- Статус
    status VARCHAR(20) DEFAULT 'connected', -- 'connected', 'disconnected', 'verified'
    is_verified BOOLEAN DEFAULT false,

    -- Верифікація
    verification_signature TEXT,
    verification_message TEXT,
    verification_type VARCHAR(50),
    verified_at TIMESTAMPTZ,

    -- Бонуси
    connection_bonus_claimed BOOLEAN DEFAULT false,
    connection_bonus_amount DECIMAL(15,2),
    connection_bonus_transaction_id UUID REFERENCES transactions(id),

    -- Метадані
    metadata JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,

    -- Аудит
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Унікальність
    UNIQUE(telegram_id, address),

    -- Перевірки
    CONSTRAINT valid_wallet_status CHECK (status IN ('connected', 'disconnected', 'verified'))
);

-- Індекси для wallets
CREATE INDEX IF NOT EXISTS idx_wallets_telegram_id ON wallets(telegram_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

-- 📊 АНАЛІТИЧНІ ПОДІЇ
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Користувач
    telegram_id VARCHAR(50),
    session_id VARCHAR(100),

    -- Подія
    event_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    label VARCHAR(100),
    value INTEGER,

    -- Деталі
    properties JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'

    -- Контекст
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,

    -- Аудит
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Перевірки
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'normal', 'high', 'critical'))
);

-- Індекси для analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_telegram_id ON analytics_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_category_action ON analytics_events(category, action);

-- 🔍 ВЕРИФІКАЦІЇ
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

    -- Тип верифікації
    verification_type VARCHAR(50) NOT NULL,
    platform VARCHAR(50),

    -- Статус
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'expired'

    -- Дані
    verification_data JSONB DEFAULT '{}',
    external_id VARCHAR(200), -- ID в зовнішній системі

    -- Спроби
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Результат
    verified_at TIMESTAMPTZ,
    failure_reason TEXT,

    -- Терміни
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Перевірки
    CONSTRAINT valid_verification_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
    CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- Індекси для verifications
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_task_id ON verifications(task_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON verifications(verification_type);

-- 🎖️ ДОСЯГНЕННЯ/БЕЙДЖІ (розширення існуючої логіки)
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(50) NOT NULL,

    -- Тип досягнення
    achievement_type VARCHAR(50) NOT NULL, -- 'badge_winner', 'badge_beginner', 'badge_rich', 'first_task', etc.

    -- Статус
    is_unlocked BOOLEAN DEFAULT false,
    is_claimed BOOLEAN DEFAULT false,

    -- Винагорода
    reward_winix DECIMAL(15,2) DEFAULT 0,
    reward_tickets INTEGER DEFAULT 0,
    reward_transaction_id UUID REFERENCES transactions(id),

    -- Прогрес
    current_progress INTEGER DEFAULT 0,
    required_progress INTEGER NOT NULL,

    -- Часові мітки
    unlocked_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,

    -- Аудит
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Унікальність
    UNIQUE(telegram_id, achievement_type),

    -- Перевірки
    CONSTRAINT valid_progress CHECK (current_progress >= 0 AND current_progress <= required_progress)
);

-- Індекси для achievements
CREATE INDEX IF NOT EXISTS idx_achievements_telegram_id ON achievements(telegram_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_unlocked ON achievements(is_unlocked);

-- ===================================================================
-- ФУНКЦІЇ ТА ТРИГЕРИ
-- ===================================================================

-- Функція оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Тригери для оновлення updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tasks_updated_at ON user_tasks;
CREATE TRIGGER update_user_tasks_updated_at BEFORE UPDATE ON user_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_bonus_status_updated_at ON daily_bonus_status;
CREATE TRIGGER update_daily_bonus_status_updated_at BEFORE UPDATE ON daily_bonus_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verifications_updated_at ON verifications;
CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;
CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- ПОЧАТКОВІ ДАНІ
-- ===================================================================

-- Приклади завдань
INSERT INTO tasks (title, description, type, platform, action, winix_reward, tickets_reward, url, is_active, priority) VALUES
('Підписка на Telegram канал', 'Підпишіться на офіційний канал WINIX', 'telegram', 'telegram', 'subscribe', 100.0, 1, 'https://t.me/winix_official', true, 10),
('Лайк YouTube відео', 'Поставте лайк нашому відео на YouTube', 'social', 'youtube', 'like', 50.0, 1, 'https://youtube.com/watch?v=example', true, 8),
('Підписка на Twitter', 'Підпишіться на наш Twitter акаунт', 'social', 'twitter', 'follow', 75.0, 1, 'https://twitter.com/winix_official', true, 7),
('Підключити TON гаманець', 'Підключіть ваш TON гаманець для отримання бонусу', 'wallet', 'ton', 'connect', 200.0, 2, null, true, 9)
ON CONFLICT DO NOTHING;

-- Конфігурація FLEX рівнів (можна зберегти в окремій таблиці)
CREATE TABLE IF NOT EXISTS flex_levels_config (
    level VARCHAR(20) PRIMARY KEY,
    required_flex INTEGER NOT NULL,
    winix_reward DECIMAL(15,2) NOT NULL,
    tickets_reward INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20)
);

INSERT INTO flex_levels_config (level, required_flex, winix_reward, tickets_reward, name, description, icon, color) VALUES
('bronze', 1000, 50.0, 1, 'Бронзовий', 'Початковий рівень FLEX', '🥉', '#CD7F32'),
('silver', 5000, 150.0, 2, 'Срібний', 'Середній рівень FLEX', '🥈', '#C0C0C0'),
('gold', 15000, 400.0, 5, 'Золотий', 'Високий рівень FLEX', '🥇', '#FFD700'),
('diamond', 50000, 1000.0, 10, 'Діамантовий', 'Преміум рівень FLEX', '💎', '#B9F2FF')
ON CONFLICT DO NOTHING;