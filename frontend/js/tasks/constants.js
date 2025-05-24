/**
 * Константи для системи завдань WINIX
 * Централізоване сховище всіх констант
 */

window.TasksConstants = (function() {
    'use strict';

    console.log('📋 [TasksConstants] Завантаження констант системи завдань');

    // API endpoints
    const API_ENDPOINTS = {
        // Базовий URL - змініть на свій реальний URL
        BASE_URL: window.location.hostname === 'localhost'
            ? 'http://localhost:8080/api'
            : 'https://winixbot.com/api',

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
        FLEX_CLAIM: '/flex/claim-reward',
        FLEX_HISTORY: '/flex/history',
        FLEX_CHECK_LEVELS: '/flex/check-levels',

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
            id: 'BRONZE',
            name: 'Bronze',
            required: 100000,
            rewards: {
                winix: 50,
                tickets: 2
            },
            color: '#CD7F32',
            gradient: 'linear-gradient(135deg, #CD7F32, #A0522D)'
        },
        SILVER: {
            id: 'SILVER',
            name: 'Silver',
            required: 500000,
            rewards: {
                winix: 150,
                tickets: 5
            },
            color: '#C0C0C0',
            gradient: 'linear-gradient(135deg, #C0C0C0, #A8A8A8)'
        },
        GOLD: {
            id: 'GOLD',
            name: 'Gold',
            required: 1000000,
            rewards: {
                winix: 300,
                tickets: 8
            },
            color: '#FFD700',
            gradient: 'linear-gradient(135deg, #FFD700, #FFA500)'
        },
        PLATINUM: {
            id: 'PLATINUM',
            name: 'Platinum',
            required: 5000000,
            rewards: {
                winix: 1000,
                tickets: 10
            },
            color: '#E5E4E2',
            gradient: 'linear-gradient(135deg, #E5E4E2, #B8B8B8)'
        },
        DIAMOND: {
            id: 'DIAMOND',
            name: 'Diamond',
            required: 10000000,
            rewards: {
                winix: 2500,
                tickets: 15
            },
            color: '#B9F2FF',
            gradient: 'linear-gradient(135deg, #B9F2FF, #4FC3F7)'
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
            TOO_MANY_REQUESTS: 'Забагато запитів. Зачекайте хвилину'
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
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '', // Буде встановлено з env
        TELEGRAM_BOT_USERNAME: '@WinixVerifyBot',
        RATE_LIMIT: {
            WINDOW: 60 * 1000, // 1 хвилина
            MAX_REQUESTS: 20
        },
        SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 години
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '' // Для шифрування чутливих даних
    };

    // TON Connect
    const TON_CONNECT = {
        MANIFEST_URL: 'https://your-domain.com/tonconnect-manifest.json', // TODO: Замініть
        NETWORK: 'mainnet', // або 'testnet' для тестування
        SUPPORTED_WALLETS: ['tonkeeper', 'tonhub', 'openmask']
    };

    // Налагодження
    const DEBUG = {
        ENABLED: window.location.hostname === 'localhost',
        LOG_LEVEL: 'info', // 'error', 'warn', 'info', 'verbose'
        SHOW_TIMESTAMPS: true,
        MOCK_API: false, // Вимкнено для продакшену
        SHOW_NETWORK_LOGS: false
    };

    console.log('✅ [TasksConstants] Константи завантажено:', {
        flexLevels: Object.keys(FLEX_LEVELS).length,
        endpoints: Object.keys(API_ENDPOINTS).length,
        taskTypes: Object.keys(TASK_TYPES).length,
        debug: DEBUG.ENABLED
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
        DEBUG
    };

})();

console.log('✅ [TasksConstants] Модуль констант готовий до використання');