/**
 * WINIX Init Guard - Блокує всі запити до повної готовності системи
 * CRITICAL: Цей файл MUST бути завантажений ПЕРШИМ!
 */
(function() {
    'use strict';

    console.log('🛡️ WINIX Guard: Активація захисту від передчасних запитів');

    // Глобальні прапорці
    window._WINIX_SYSTEM_READY = false;
    window._WINIX_USER_ID = null;
    window._WINIX_INIT_PROMISE = null;

    // Зберігаємо оригінальний fetch
    const originalFetch = window.fetch;

    // Перехоплюємо всі fetch запити
    window.fetch = function(...args) {
        const [url, options] = args;

        // Дозволяємо тільки health check запити
        if (url && url.includes('/health')) {
            return originalFetch.apply(this, args);
        }

        // Блокуємо запити з undefined в URL
        if (url && url.includes('undefined')) {
            console.error('🛡️ BLOCKED: Запит з undefined в URL:', url);
            return Promise.reject(new Error('Invalid request with undefined'));
        }

        // Якщо система не готова, чекаємо
        if (!window._WINIX_SYSTEM_READY) {
            console.warn('🛡️ DELAYED: Запит затримано до готовності системи:', url);

            return new Promise((resolve, reject) => {
                const checkReady = setInterval(() => {
                    if (window._WINIX_SYSTEM_READY) {
                        clearInterval(checkReady);
                        console.log('🛡️ RELEASED: Виконуємо затриманий запит:', url);
                        originalFetch.apply(window, args).then(resolve).catch(reject);
                    }
                }, 100);

                // Таймаут 10 секунд
                setTimeout(() => {
                    clearInterval(checkReady);
                    reject(new Error('System initialization timeout'));
                }, 10000);
            });
        }

        // Система готова - виконуємо запит
        return originalFetch.apply(this, args);
    };

    // Функція для розблокування системи
    window._unlockWinixSystem = function(userId) {
        if (userId && userId !== 'undefined') {
            window._WINIX_USER_ID = userId;
            window._WINIX_SYSTEM_READY = true;
            console.log('🛡️ UNLOCKED: Система розблокована з User ID:', userId);
        }
    };
})();