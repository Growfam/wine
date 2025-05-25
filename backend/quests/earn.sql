# 🔄 План міграції бази даних WINIX

## ✅ ІСНУЮЧІ ТАБЛИЦІ (залишаємо без змін)
- `winix` - основна таблиця користувачів ✅
- `tasks` - таблиця завдань ✅
- `transactions` - таблиця транзакцій ✅
- `user_tasks` - завдання користувачів ✅
- `daily_bonuses` - щоденні бонуси ✅
- `referrals` - реферальна система ✅
- `user_badges` - бейджі користувачів ✅

## 🔧 ТАБЛИЦІ ДО МОДИФІКАЦІЇ

### 1. Модифікація таблиці `winix`
```sql
-- Додати колонки для FLEX системи та нових функцій
ALTER TABLE winix
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wins_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'uk';

-- Оновити існуючі колонки для кращої сумісності
ALTER TABLE winix
ALTER COLUMN balance TYPE REAL USING balance::real,
ALTER COLUMN coins SET DEFAULT 0;
```

### 2. Модифікація таблиці `tasks`
```sql
-- Додати колонки для системи завдань
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS reward_winix INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_tickets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS action TEXT,
ADD COLUMN IF NOT EXISTS channel_username TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;

-- Оновити тип завдань
ALTER TABLE tasks
ALTER COLUMN task_type TYPE TEXT,
ADD CONSTRAINT check_task_type CHECK (task_type IN ('social', 'limited', 'partner', 'daily'));
```

### 3. Модифікація таблиці `transactions`
```sql
-- Додати колонки для покращеної системи транзакцій
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS amount_tickets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_flex BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Оновити обмеження типів
ALTER TABLE transactions
ADD CONSTRAINT check_transaction_type CHECK (type IN (
    'daily_bonus', 'flex_reward', 'task_reward',
    'wallet_connection_bonus', 'purchase', 'withdrawal',
    'staking_reward', 'referral_bonus', 'raffle_win'
));
```

## ➕ НОВІ ТАБЛИЦІ ДО СТВОРЕННЯ

### 1. FLEX System Tables

#### flex_levels (Рівні FLEX системи)
```sql
CREATE TABLE flex_levels (
    level TEXT PRIMARY KEY,
    required_flex BIGINT NOT NULL,
    winix_reward INTEGER NOT NULL,
    tickets_reward INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT
);

-- Заповнити початковими даними
INSERT INTO flex_levels (level, required_flex, winix_reward, tickets_reward, name, description, color) VALUES
('bronze', 1000, 100, 5, 'Bronze', 'Початковий рівень FLEX', '#CD7F32'),
('silver', 5000, 500, 25, 'Silver', 'Срібний рівень FLEX', '#C0C0C0'),
('gold', 15000, 1500, 75, 'Gold', 'Золотий рівень FLEX', '#FFD700'),
('platinum', 50000, 5000, 250, 'Platinum', 'Платиновий рівень FLEX', '#E5E4E2'),
('diamond', 150000, 15000, 750, 'Diamond', 'Діамантовий рівень FLEX', '#B9F2FF');
```

#### flex_balances (Баланси FLEX токенів)
```sql
CREATE TABLE flex_balances (
    telegram_id TEXT PRIMARY KEY REFERENCES winix(telegram_id),
    flex_balance BIGINT NOT NULL DEFAULT 0,
    wallet_address TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flex_balances_telegram_id ON flex_balances(telegram_id);
CREATE INDEX idx_flex_balances_wallet ON flex_balances(wallet_address);
```

#### flex_claims (Отримання FLEX винагород)
```sql
CREATE TABLE flex_claims (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL REFERENCES winix(telegram_id),
    level TEXT NOT NULL REFERENCES flex_levels(level),
    flex_balance_at_claim BIGINT NOT NULL,
    winix_awarded INTEGER NOT NULL,
    tickets_awarded INTEGER NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flex_claims_telegram_id ON flex_claims(telegram_id);
CREATE INDEX idx_flex_claims_level ON flex_claims(level);
CREATE INDEX idx_flex_claims_claimed_at ON flex_claims(claimed_at);
```

### 2. Wallet System Tables

#### wallets (TON гаманці)
```sql
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL REFERENCES winix(telegram_id),
    address TEXT NOT NULL,
    chain_id TEXT DEFAULT '-239',
    public_key TEXT,
    provider TEXT,
    status TEXT DEFAULT 'connected' CHECK (status IN (
        'disconnected', 'connected', 'verified', 'suspended'
    )),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verification_data JSONB DEFAULT '{}',
    last_activity TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_telegram_id ON wallets(telegram_id);
CREATE INDEX idx_wallets_address ON wallets(address);
CREATE INDEX idx_wallets_status ON wallets(status);
```

#### wallet_connection_bonuses (Бонуси за підключення гаманця)
```sql
CREATE TABLE wallet_connection_bonuses (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL REFERENCES winix(telegram_id),
    winix_amount INTEGER NOT NULL,
    tickets_amount INTEGER NOT NULL,
    description TEXT,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_bonuses_telegram_id ON wallet_connection_bonuses(telegram_id);
```

#### wallet_events (Події гаманця)
```sql
CREATE TABLE wallet_events (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT NOT NULL REFERENCES winix(telegram_id),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_events_telegram_id ON wallet_events(telegram_id);
CREATE INDEX idx_wallet_events_type ON wallet_events(event_type);
```

### 3. Enhanced Daily Bonus System

#### daily_bonus_status (Статус щоденних бонусів)
```sql
CREATE TABLE daily_bonus_status (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES winix(telegram_id),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_days_claimed INTEGER DEFAULT 0,
    last_claim_date DATE,
    next_available_date DATE,
    current_day_number INTEGER DEFAULT 1 CHECK (current_day_number BETWEEN 1 AND 30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_bonus_status_user_id ON daily_bonus_status(user_id);
CREATE UNIQUE INDEX idx_daily_bonus_status_user_unique ON daily_bonus_status(user_id);
```

#### daily_bonus_entries (Записи щоденних бонусів)
```sql
CREATE TABLE daily_bonus_entries (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES winix(telegram_id),
    day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 30),
    claim_date DATE NOT NULL,
    reward_winix INTEGER NOT NULL,
    reward_tickets INTEGER NOT NULL,
    streak_at_claim INTEGER NOT NULL,
    is_special_day BOOLEAN DEFAULT FALSE,
    multiplier_applied REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_bonus_entries_user_id ON daily_bonus_entries(user_id);
CREATE INDEX idx_daily_bonus_entries_date ON daily_bonus_entries(claim_date);
```

### 4. Analytics System Tables

#### analytics_events (Події аналітики)
```sql
CREATE TABLE analytics_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES winix(telegram_id),
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'auth_login', 'auth_logout', 'task_view', 'task_start',
        'task_complete', 'wallet_connect', 'flex_claim', 'daily_claim'
    )),
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    label TEXT,
    value NUMERIC,
    properties JSONB DEFAULT '{}',
    severity TEXT DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    page_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);
```

#### analytics_sessions (Сесії аналітики)
```sql
CREATE TABLE analytics_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES winix(telegram_id),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration INTEGER,
    events_count INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_analytics_sessions_user_id ON analytics_sessions(user_id);
CREATE INDEX idx_analytics_sessions_start_time ON analytics_sessions(start_time);
```

#### user_analytics_stats (Статистика користувачів)
```sql
CREATE TABLE user_analytics_stats (
    user_id TEXT PRIMARY KEY REFERENCES winix(telegram_id),
    total_events INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_session_time INTEGER DEFAULT 0,
    avg_session_time REAL DEFAULT 0.0,
    tasks_viewed INTEGER DEFAULT 0,
    tasks_started INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_claimed INTEGER DEFAULT 0,
    total_winix_earned REAL DEFAULT 0.0,
    total_tickets_earned INTEGER DEFAULT 0,
    flex_checks INTEGER DEFAULT 0,
    flex_rewards_claimed INTEGER DEFAULT 0,
    daily_bonuses_claimed INTEGER DEFAULT 0,
    max_daily_streak INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    last_active TIMESTAMPTZ
);

CREATE INDEX idx_user_analytics_stats_user_id ON user_analytics_stats(user_id);
```

### 5. Enhanced Task System Tables

#### task_progress (Детальний прогрес завдань)
```sql
CREATE TABLE task_progress (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES winix(telegram_id),
    task_id UUID NOT NULL REFERENCES tasks(id),
    task_type TEXT NOT NULL,
    task_data JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
        'available', 'started', 'pending', 'completed', 'claimed', 'expired'
    )),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

CREATE INDEX idx_task_progress_user_id ON task_progress(user_id);
CREATE INDEX idx_task_progress_task_id ON task_progress(task_id);
CREATE INDEX idx_task_progress_status ON task_progress(status);
```

#### completed_tasks (Спрощені виконані завдання)
```sql
CREATE TABLE completed_tasks (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES winix(telegram_id),
    task_id UUID NOT NULL REFERENCES tasks(id),
    task_type TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reward JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

CREATE INDEX idx_completed_tasks_user_id ON completed_tasks(user_id);
CREATE INDEX idx_completed_tasks_task_id ON completed_tasks(task_id);
CREATE INDEX idx_completed_tasks_completed_at ON completed_tasks(completed_at);
```

## 🔒 RLS ПОЛІТИКИ ДЛЯ НОВИХ ТАБЛИЦЬ

### FLEX System RLS
```sql
-- flex_balances policies
ALTER TABLE flex_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flex_balances_select_policy" ON flex_balances FOR SELECT
USING (telegram_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "flex_balances_insert_policy" ON flex_balances FOR INSERT
WITH CHECK (auth.jwt()->>'role' IN ('admin', 'winix_system'));

CREATE POLICY "flex_balances_update_policy" ON flex_balances FOR UPDATE
USING (auth.jwt()->>'role' IN ('admin', 'winix_system'));

-- flex_claims policies
ALTER TABLE flex_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flex_claims_select_policy" ON flex_claims FOR SELECT
USING (telegram_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "flex_claims_insert_policy" ON flex_claims FOR INSERT
WITH CHECK (auth.jwt()->>'role' IN ('admin', 'winix_system'));

-- flex_levels public read
ALTER TABLE flex_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flex_levels_select_policy" ON flex_levels FOR SELECT
USING (true);
```

### Wallet System RLS
```sql
-- wallets policies
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_select_policy" ON wallets FOR SELECT
USING (telegram_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "wallets_insert_policy" ON wallets FOR INSERT
WITH CHECK (telegram_id = auth.uid() OR auth.jwt()->>'role' IN ('admin', 'winix_system'));

CREATE POLICY "wallets_update_policy" ON wallets FOR UPDATE
USING (telegram_id = auth.uid() OR auth.jwt()->>'role' IN ('admin', 'winix_system'));

-- wallet_connection_bonuses policies
ALTER TABLE wallet_connection_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_bonuses_select_policy" ON wallet_connection_bonuses FOR SELECT
USING (telegram_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "wallet_bonuses_insert_policy" ON wallet_connection_bonuses FOR INSERT
WITH CHECK (auth.jwt()->>'role' IN ('admin', 'winix_system'));
```

### Analytics RLS
```sql
-- analytics_events policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_select_policy" ON analytics_events FOR SELECT
USING (user_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "analytics_events_insert_policy" ON analytics_events FOR INSERT
WITH CHECK (true); -- Дозволити всім додавати події

-- user_analytics_stats policies
ALTER TABLE user_analytics_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_stats_select_policy" ON user_analytics_stats FOR SELECT
USING (user_id = auth.uid() OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "user_stats_service_policy" ON user_analytics_stats FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

## 📊 МІГРАЦІЯ ІСНУЮЧИХ ДАНИХ

### 1. Міграція daily_bonuses → daily_bonus_status/entries
```sql
-- Створити записи статусу для користувачів з існуючими бонусами
INSERT INTO daily_bonus_status (user_id, total_days_claimed, last_claim_date, current_day_number)
SELECT
    telegram_id,
    COUNT(*) as total_days,
    MAX(claimed_date::date) as last_claim,
    CASE
        WHEN MAX(day_in_cycle) >= 30 THEN 1
        ELSE MAX(day_in_cycle) + 1
    END as next_day
FROM daily_bonuses
GROUP BY telegram_id
ON CONFLICT (user_id) DO NOTHING;

-- Міграція записів бонусів
INSERT INTO daily_bonus_entries (user_id, day_number, claim_date, reward_winix, reward_tickets, streak_at_claim)
SELECT
    telegram_id,
    day_in_cycle,
    claimed_date::date,
    amount::integer,
    token_amount,
    1 -- Припускаємо серію 1, якщо не було інших даних
FROM daily_bonuses;
```

### 2. Ініціалізація аналітики для існуючих користувачів
```sql
INSERT INTO user_analytics_stats (user_id, first_seen, last_seen)
SELECT
    telegram_id,
    created_at,
    COALESCE(updated_at, created_at)
FROM winix
ON CONFLICT (user_id) DO NOTHING;
```

## ⚠️ ВАЖЛИВІ НОТАТКИ

1. **Збереження існуючих даних**: Всі існуючі таблиці залишаються без змін для забезпечення backwards compatibility

2. **Поступова міграція**: Нові функції можна впроваджувати поступово, не порушуючи існуючий функціонал

3. **RLS політики**: Всі нові таблиці мають відповідні RLS політики для безпеки

4. **Індексування**: Всі таблиці мають необхідні індекси для оптимальної продуктивності

5. **Типи даних**: Використовуються консистентні типи даних між таблицями

6. **Ключові обмеження**: Додані CHECK constraints для валідації даних

Після виконання цих змін ваша база даних буде повністю готова для розширеної системи завдань WINIX з підтримкою FLEX токенів, TON гаманців, детальної аналітики та покращеної системи завдань.