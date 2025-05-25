/**
 * Константи для системи завдань WINIX - Production Version
 * Централізоване сховище всіх констант без Mock налаштувань
 */

window.TasksConstants = (function() {
    'use strict';

    console.log('📋 [TasksConstants] Завантаження констант системи завдань (Production)');

    // API endpoints - використовувати тільки продакшн URL
    const API_ENDPOINTS = {
        // Використовувати тільки продакшн URL
        BASE_URL: '/api',

        // Auth endpoints
        AUTH_VALIDATE: '/auth/validate-telegram',
        AUTH_REFRESH: '/auth/refresh-token',

        // User endpoints
        USER_PROFILE: '/user/profile',
        USER_BALANCE: '/user/balance',
        USER_UPDATE_BALANCE: '/user/update-balance',
        USER_STATS: '/user/stats',

        // Wallet endpoints
        WALLET_STATUS: '/wallet/status',
        WALLET_CONNECT: '/wallet/connect',
        WALLET_DISCONNECT: '/wallet/disconnect',
        WALLET_VERIFY: '/wallet/verify',

        // Flex endpoints
        FLEX_BALANCE: '/flex/balance',
        FLEX_CLAIM: '/flex/claim',
        FLEX_HISTORY: '/flex/history',
        FLEX_LEVELS: '/flex/levels',

        // Daily bonus endpoints
        DAILY_STATUS: '/daily/status',
        DAILY_CLAIM: '/daily/claim',
        DAILY_HISTORY: '/daily/history',
        DAILY_CALCULATE: '/daily/calculate-reward',

        // Tasks endpoints
        TASKS_LIST: '/tasks/list',
        TASKS_CLAIM: '/tasks/claim',
        TASKS_VERIFY: '/tasks/verify',
        TASKS_START: '/tasks/start',
        TASKS_COMPLETE: '/tasks/complete',

        // Verification endpoints
        VERIFY_TELEGRAM: '/verify/telegram',
        VERIFY_SOCIAL: '/verify/social',
        VERIFY_CHECK_BOT: '/verify/check-bot'
    };

    // Flex Levels конфігурація
    const FLEX_LEVELS = {
        BRONZE: {
            id: 'bronze',
            name: 'Bronze',
            required: 10000,
            rewards: {
                winix: 25,
                tickets: 1
            },
            color: '#CD7F32',
            gradient: 'linear-gradient(135deg, #CD7F32, #A0522D)',
            description: 'Базовий рівень для початківців',
            icon: '🥉'
        },
        SILVER: {
            id: 'silver',
            name: 'Silver',
            required: 50000,
            rewards: {
                winix: 75,
                tickets: 2
            },
            color: '#C0C0C0',
            gradient: 'linear-gradient(135deg, #C0C0C0, #A8A8A8)',
            description: 'Рівень для досвідчених користувачів',
            icon: '🥈'
        },
        GOLD: {
            id: 'gold',
            name: 'Gold',
            required: 150000,
            rewards: {
                winix: 150,
                tickets: 4
            },
            color: '#FFD700',
            gradient: 'linear-gradient(135deg, #FFD700, #FFA500)',
            description: 'Високий рівень з відмінними винагородами',
            icon: '🥇'
        },
        PLATINUM: {
            id: 'platinum',
            name: 'Platinum',
            required: 500000,
            rewards: {
                winix: 300,
                tickets: 10
            },
            color: '#E5E4E2',
            gradient: 'linear-gradient(135deg, #E5E4E2, #B8B8B8)',
            description: 'Преміум рівень для великих інвесторів',
            icon: '💎'
        },
        DIAMOND: {
            id: 'diamond',
            name: 'Diamond',
            required: 1000000,
            rewards: {
                winix: 500,
                tickets: 15
            },
            color: '#B9F2FF',
            gradient: 'linear-gradient(135deg, #B9F2FF, #4FC3F7)',
            description: 'Найвищий рівень з максимальними винагородами',
            icon: '💠'
        }
    };

    // Daily Bonus конфігурація - тільки для UI, розрахунки на бекенді
    const DAILY_BONUS = {
        // UI конфігурація
        TOTAL_DAYS: 30,
        RESET_HOUR: 0, // 00:00 UTC

        // Візуальні індикатори (реальні винагороди з бекенду)
        UI_REWARDS: {
            1: { display: '20+' },
            7: { display: '50+' },
            14: { display: '100+' },
            21: { display: '200+' },
            30: { display: '500+' }
        }
    };

    // Типи завдань
    const TASK_TYPES = {
        SOCIAL: 'social',
        LIMITED: 'limited',
        PARTNER: 'partner',
        SPECIAL: 'special'
    };

    // Статуси завдань
    const TASK_STATUS = {
        AVAILABLE: 'available',
        IN_PROGRESS: 'in_progress',
        VERIFYING: 'verifying',
        COMPLETED: 'completed',
        CLAIMED: 'claimed',
        EXPIRED: 'expired',
        LOCKED: 'locked'
    };

    // Платформи для соціальних завдань
    const SOCIAL_PLATFORMS = {
        TELEGRAM: {
            id: 'telegram',
            name: 'Telegram',
            verified: true,
            verificationTime: 0, // Миттєва через бота
            icon: 'telegram-icon'
        },
        YOUTUBE: {
            id: 'youtube',
            name: 'YouTube',
            verified: false,
            verificationTime: 15000, // 15 секунд
            icon: 'youtube-icon'
        },
        TWITTER: {
            id: 'twitter',
            name: 'Twitter',
            verified: false,
            verificationTime: 15000, // 15 секунд
            icon: 'twitter-icon'
        },
        DISCORD: {
            id: 'discord',
            name: 'Discord',
            verified: false,
            verificationTime: 15000, // 15 секунд
            icon: 'discord-icon'
        }
    };

    // Таймери та інтервали
    const TIMERS = {
        AUTO_CHECK_INTERVAL: 5 * 60 * 1000,      // 5 хвилин
        DAILY_RESET_CHECK: 60 * 1000,            // 1 хвилина
        ANIMATION_DURATION: 2000,                 // 2 секунди
        TOAST_DURATION: 3000,                     // 3 секунди
        LOADING_TIMEOUT: 10000,                   // 10 секунд
        DEBOUNCE_DELAY: 300,                      // 300 мс
        VERIFICATION_DELAY: 15000,                // 15 секунд для соціальних мереж
        SESSION_REFRESH: 30 * 60 * 1000          // 30 хвилин
    };

    // Повідомлення
    const MESSAGES = {
        // Успішні повідомлення
        SUCCESS: {
            WALLET_CONNECTED: 'Кошелек успішно підключено!',
            REWARD_CLAIMED: 'Винагороду отримано!',
            TASK_COMPLETED: 'Завдання виконано!',
            COPIED: 'Скопійовано в буфер обміну!',
            VERIFICATION_STARTED: 'Верифікація розпочата...'
        },

        // Помилки
        ERROR: {
            WALLET_NOT_CONNECTED: 'Кошелек не підключено',
            INSUFFICIENT_FLEX: 'Недостатньо FLEX токенів',
            ALREADY_CLAIMED: 'Винагороду вже отримано сьогодні',
            NETWORK_ERROR: 'Помилка мережі. Спробуйте пізніше',
            INVALID_DATA: 'Невірні дані',
            SESSION_EXPIRED: 'Сесія закінчилася. Оновіть сторінку',
            TELEGRAM_AUTH_FAILED: 'Помилка авторизації Telegram',
            VERIFICATION_FAILED: 'Верифікація не пройдена',
            TOO_MANY_REQUESTS: 'Забагато запитів. Зачекайте хвилину',
            TELEGRAM_REQUIRED: 'Додаток повинен бути відкритий через Telegram'
        },

        // Інформаційні
        INFO: {
            LOADING: 'Завантаження...',
            CHECKING_WALLET: 'Перевірка кошелька...',
            CHECKING_BALANCE: 'Перевірка балансу...',
            PROCESSING: 'Обробка...',
            VERIFYING: 'Перевірка виконання...',
            WAIT_VERIFICATION: 'Перейдіть за посиланням та зачекайте 15 секунд'
        }
    };

    // Ключі для session storage
    const STORAGE_KEYS = {
        AUTH_TOKEN: 'winix_auth_token',
        USER_DATA: 'winix_user_data',
        FLEX_EARN_STATE: 'flexEarnState',
        DAILY_BONUS_STATE: 'dailyBonusState',
        TASKS_STATE: 'tasksState',
        USER_PREFERENCES: 'userPreferences',
        LAST_SYNC_TIME: 'lastSyncTime',
        TASK_TIMESTAMPS: 'taskTimestamps'
    };

    // Валюти
    const CURRENCIES = {
        WINIX: {
            id: 'winix',
            name: 'WINIX',
            symbol: 'W',
            decimals: 0,
            color: '#b366ff'
        },
        TICKETS: {
            id: 'tickets',
            name: 'Tickets',
            symbol: 'T',
            decimals: 0,
            color: '#FFD700',
            isRare: true
        },
        FLEX: {
            id: 'flex',
            name: 'FLEX',
            symbol: 'FLEX',
            decimals: 0,
            color: '#FFA500'
        }
    };

    // Налаштування анімацій
    const ANIMATIONS = {
        EASING: {
            SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            SMOOTH: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            EASE_OUT: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        },
        DURATION: {
            FAST: 200,
            NORMAL: 300,
            SLOW: 500,
            VERY_SLOW: 800
        }
    };

    // Безпека
    const SECURITY = {
        TELEGRAM_BOT_USERNAME: '@WINIX_Official_bot',
        RATE_LIMIT: {
            WINDOW: 60 * 1000, // 1 хвилина
            MAX_REQUESTS: 50    // Збільшено для продакшену
        },
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 години
        MAX_RETRY_ATTEMPTS: 3,
        TIMEOUT_SECONDS: 30
    };

    // TON Connect
    const TON_CONNECT = {
        MANIFEST_URL: 'https://winixbot.com/tonconnect-manifest.json',
        NETWORK: 'mainnet',
        SUPPORTED_WALLETS: ['tonkeeper', 'tonhub', 'mytonwallet', 'openmask']
    };

    // Налагодження - вимкнути для продакшену
    const DEBUG = {
        ENABLED: false, // Завжди false для продакшену
        LOG_LEVEL: 'error', // Тільки помилки
        SHOW_TIMESTAMPS: false,
        SHOW_NETWORK_LOGS: false,
        ENABLE_CONSOLE: false
    };

    // Production конфігурація
    const PRODUCTION_CONFIG = {
        API_BASE_URL: '/api',
        TELEGRAM_BOT_USERNAME: '@WINIX_Official_bot',
        TON_CONNECT_MANIFEST: 'https://winixbot.com/tonconnect-manifest.json',
        DEBUG_MODE: false,
        LOG_LEVEL: 'error',
        CACHE_ENABLED: true,
        PERFORMANCE_MONITORING: true,
        ERROR_REPORTING: true
    };

    // Додаткові валідації для продакшену
    const VALIDATION_RULES = {
        TELEGRAM_ID: {
            MIN: 1,
            MAX: 999999999999999
        },
        WALLET_ADDRESS: {
            LENGTH: 48,
            PATTERN: /^[a-zA-Z0-9_-]{48}$/
        },
        FLEX_BALANCE: {
            MIN: 0,
            MAX: 999999999999
        },
        WINIX_AMOUNT: {
            MIN: 0,
            MAX: 999999999
        }
    };

    console.log('✅ [TasksConstants] Константи завантажено (Production):', {
        flexLevels: Object.keys(FLEX_LEVELS).length,
        endpoints: Object.keys(API_ENDPOINTS).length,
        taskTypes: Object.keys(TASK_TYPES).length,
        debug: DEBUG.ENABLED,
        production: !DEBUG.ENABLED
    });

    // Публічний інтерфейс
    return {
        API_ENDPOINTS,
        FLEX_LEVELS,
        DAILY_BONUS,
        TASK_TYPES,
        TASK_STATUS,
        SOCIAL_PLATFORMS,
        TIMERS,
        MESSAGES,
        STORAGE_KEYS,
        CURRENCIES,
        ANIMATIONS,
        SECURITY,
        TON_CONNECT,
        DEBUG,
        PRODUCTION_CONFIG,
        VALIDATION_RULES
    };

})();

console.log('✅ [TasksConstants] Модуль констант готовий до використання (Production)');