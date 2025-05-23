/**
 * Константи для системи завдань WINIX
 * Централізоване сховище всіх констант
 */

window.TasksConstants = (function() {
    'use strict';

    console.log('📋 [TasksConstants] Завантаження констант системи завдань');

    // API endpoints
    const API_ENDPOINTS = {
        // Базовий URL
        BASE_URL: window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api'
            : 'https://api.winix.com/api',

        // Wallet endpoints
        WALLET_STATUS: '/wallet/status',
        WALLET_CONNECT: '/wallet/connect',
        WALLET_DISCONNECT: '/wallet/disconnect',

        // Flex endpoints
        FLEX_BALANCE: '/flex/balance',
        FLEX_CLAIM: '/flex/claim-reward',
        FLEX_HISTORY: '/flex/history',

        // Daily bonus endpoints
        DAILY_STATUS: '/daily/status',
        DAILY_CLAIM: '/daily/claim',
        DAILY_HISTORY: '/daily/history',

        // Tasks endpoints
        TASKS_LIST: '/tasks/list',
        TASKS_CLAIM: '/tasks/claim',
        TASKS_VERIFY: '/tasks/verify',

        // User endpoints
        USER_BALANCE: '/user/balance',
        USER_UPDATE_BALANCE: '/user/update-balance'
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

    // Daily Bonus конфігурація
    const DAILY_BONUS = {
        // Базова щоденна винагорода
        BASE_REWARD: {
            winix: 20
        },

        // Прогресивні винагороди
        PROGRESSIVE_REWARDS: {
            1: { winix: 20 },
            2: { winix: 25 },
            3: { winix: 30 },
            4: { winix: 35 },
            5: { winix: 40 },
            6: { winix: 45 },
            7: { winix: 50 },      // Тиждень
            14: { winix: 100 },    // 2 тижні
            21: { winix: 200 },    // 3 тижні
            30: { winix: 500 }     // Місяць
        },

        // Максимальна винагорода
        MAX_DAILY_WINIX: 2000,

        // Tickets конфігурація
        TICKET_CONFIG: {
            days_per_week: 3,      // 3 рандомні дні на тиждень
            min_tickets: 1,
            max_tickets: 5,
            progressive_multiplier: 0.5  // Збільшення з прогресом
        },

        // Загальна тривалість циклу
        TOTAL_DAYS: 30,

        // Час оновлення (00:00 UTC)
        RESET_HOUR: 0
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
            icon: 'telegram-icon'
        },
        YOUTUBE: {
            id: 'youtube',
            name: 'YouTube',
            verified: false,
            icon: 'youtube-icon'
        },
        TWITTER: {
            id: 'twitter',
            name: 'Twitter',
            verified: false,
            icon: 'twitter-icon'
        },
        DISCORD: {
            id: 'discord',
            name: 'Discord',
            verified: false,
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
        DEBOUNCE_DELAY: 300                      // 300 мс
    };

    // Повідомлення
    const MESSAGES = {
        // Успішні повідомлення
        SUCCESS: {
            WALLET_CONNECTED: 'Кошелек успішно підключено!',
            REWARD_CLAIMED: 'Винагороду отримано!',
            TASK_COMPLETED: 'Завдання виконано!',
            COPIED: 'Скопійовано в буфер обміну!'
        },

        // Помилки
        ERROR: {
            WALLET_NOT_CONNECTED: 'Кошелек не підключено',
            INSUFFICIENT_FLEX: 'Недостатньо FLEX токенів',
            ALREADY_CLAIMED: 'Винагороду вже отримано сьогодні',
            NETWORK_ERROR: 'Помилка мережі. Спробуйте пізніше',
            INVALID_DATA: 'Невірні дані',
            SESSION_EXPIRED: 'Сесія закінчилася. Оновіть сторінку'
        },

        // Інформаційні
        INFO: {
            LOADING: 'Завантаження...',
            CHECKING_WALLET: 'Перевірка кошелька...',
            CHECKING_BALANCE: 'Перевірка балансу...',
            PROCESSING: 'Обробка...'
        }
    };

    // Локальне сховище ключі
    const STORAGE_KEYS = {
        FLEX_EARN_STATE: 'flexEarnState',
        DAILY_BONUS_STATE: 'dailyBonusState',
        TASKS_STATE: 'tasksState',
        USER_PREFERENCES: 'userPreferences',
        LAST_SYNC_TIME: 'lastSyncTime'
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

    // Налагодження
    const DEBUG = {
        ENABLED: window.location.hostname === 'localhost',
        LOG_LEVEL: 'verbose', // 'error', 'warn', 'info', 'verbose'
        SHOW_TIMESTAMPS: true,
        MOCK_API: true // Використовувати мок дані замість реальних API
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
        DEBUG
    };

})();

console.log('✅ [TasksConstants] Модуль констант готовий до використання');