/**
 * api.js - Централізований сервіс для роботи з API розіграшів
 * Доповнює основний API системи новими функціями, не перезаписуючи існуючі
 */

import WinixRaffles from '../globals.js';

// Визначення базового URL для API
const determineBaseUrl = () => {
    // Спочатку перевіряємо налаштування у локальному конфігу
    if (WinixRaffles && WinixRaffles.config && WinixRaffles.config.apiBaseUrl) {
        return WinixRaffles.config.apiBaseUrl;
    }

    // Перевіряємо глобальний конфіг
    if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
        return window.WinixConfig.apiBaseUrl;
    }

    // Визначаємо URL на основі поточного середовища
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Локальне середовище - використовуємо порт 8080
        return `http://${hostname}:8080/api`;
    } else {
        // Продакшн середовище
        return 'https://winixbot.com/api';
    }
};

// Базовий URL для API-запитів
const RAFFLES_API_BASE_URL = determineBaseUrl();

// Константи для відстеження запитів
const REQUEST_THROTTLE = {
    '/raffles-history': 15000,      // 15 секунд для історії розіграшів
    '/participate-raffle': 3000,    // 3 секунди для участі в розіграшах
    'default': 2000                 // 2 секунди для всіх інших
};

// Отримання основного API, якщо він існує
const mainAPI = window.WinixAPI || {};

/**
 * Перевірка наявності функції в основному API
 * @param {string} funcName - Назва функції
 * @returns {boolean} True, якщо функція існує
 */
function hasMainAPIFunction(funcName) {
    return mainAPI && typeof mainAPI[funcName] === 'function';
}

/**
 * Отримати ID користувача
 * @returns {string|null} ID користувача або null, якщо не знайдено
 */
export function getUserId() {
    // Використовуємо основний API, якщо доступний
    if (hasMainAPIFunction('getUserId')) {
        return mainAPI.getUserId();
    }

    // Резервна реалізація
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    const telegramId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
                    return telegramId;
                }
            } catch (e) {
                console.warn("🔌 Raffles API: Помилка отримання ID з Telegram WebApp:", e);
            }
        }

        // Перевіряємо localStorage
        try {
            const localId = localStorage.getItem('telegram_user_id');
            if (localId) return localId;
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання ID з localStorage:", e);
        }

        return null;
    } catch (error) {
        console.error("🔌 Raffles API: Критична помилка отримання ID користувача:", error);
        return null;
    }
}

/**
 * Отримання токену авторизації
 * @returns {string|null} Токен авторизації або null, якщо не знайдено
 */
export function getAuthToken() {
    // Використовуємо основний API, якщо доступний
    if (hasMainAPIFunction('getAuthToken')) {
        return mainAPI.getAuthToken();
    }

    // Резервна реалізація
    try {
        // Спробуємо отримати токен з localStorage
        try {
            const token = localStorage.getItem('auth_token');
            if (token && typeof token === 'string' && token.length > 5) {
                return token;
            }
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання токену з localStorage:", e);
        }

        return null;
    } catch (error) {
        console.error("🔌 Raffles API: Критична помилка отримання токену авторизації:", error);
        return null;
    }
}

/**
 * Універсальна функція для виконання API-запитів розіграшів
 * @param {string} endpoint - URL ендпоінту
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {Object} data - Дані для відправки
 * @param {Object} options - Додаткові параметри
 * @returns {Promise<Object>} Результат запиту
 */
export async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
    // Якщо endpoint починається з "/", видаляємо цей символ
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

    // Якщо основний API доступний і опція useMainAPI не false, використовуємо його
    if (hasMainAPIFunction('apiRequest') && options.useMainAPI !== false) {
        try {
            return await mainAPI.apiRequest(cleanEndpoint, method, data, options);
        } catch (mainApiError) {
            console.warn("🔌 Raffles API: Помилка в основному API, використовуємо резервний:", mainApiError);
            // Якщо основний API видав помилку, продовжуємо з нашою реалізацією
        }
    }

    // Резервна реалізація API запиту
    try {
        // Використовуємо централізоване відображення лоадера
        if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
            WinixRaffles.loader.show(options.loaderMessage || 'Завантаження...', `raffles-api-${cleanEndpoint}`);
        }

        // Формуємо URL
        const timestamp = Date.now();
        const hasQuery = cleanEndpoint.includes('?');
        const url = `${RAFFLES_API_BASE_URL}/${cleanEndpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

        // Отримуємо ID користувача
        const userId = getUserId();

        // Отримуємо токен авторизації
        const authToken = getAuthToken();

        // Готуємо заголовки
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Додаємо ID користувача і токен авторизації, якщо вони є
        if (userId) {
            headers['X-Telegram-User-Id'] = userId;
        }

        if (authToken) {
            headers['Authorization'] = authToken.startsWith('Bearer ') ?
                authToken : `Bearer ${authToken}`;
        }

        // Готуємо параметри запиту
        const requestOptions = {
            method: method,
            headers: headers,
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        };

        // Додаємо тіло запиту для POST, PUT, PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            requestOptions.body = JSON.stringify(data);
        }

        // Створюємо контролер для таймауту
        const controller = new AbortController();
        requestOptions.signal = controller.signal;

        // Встановлюємо таймаут
        const timeout = options.timeout || 10000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Виконуємо запит
            const response = await fetch(url, requestOptions);

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Обробляємо відповідь
            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status} ${response.statusText}`);
            }

            // Парсимо відповідь
            const jsonData = await response.json();

            return jsonData;
        } catch (error) {
            // Перевіряємо, чи запит був скасований через таймаут
            if (error.name === 'AbortError') {
                throw new Error('Час очікування запиту вичерпано');
            }

            throw error;
        } finally {
            // Приховуємо індикатор завантаження
            if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
                WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
            }
        }
    } catch (error) {
        console.error(`🔌 Raffles API: Помилка запиту ${endpoint}:`, error);

        // Приховуємо індикатор завантаження
        if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
            WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
        }

        // Генеруємо подію про помилку API
        if (WinixRaffles && WinixRaffles.events) {
            WinixRaffles.events.emit('api-error', {
                error: error,
                endpoint: endpoint,
                method: method
            });
        }

        // Повертаємо об'єкт з помилкою
        return {
            status: 'error',
            message: error.message || 'Сталася помилка при виконанні запиту',
            source: error.source || 'raffles_api'
        };
    }
}

/**
 * Отримання даних користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Дані користувача
 */
export async function getUserData(forceRefresh = false) {
    // Використовуємо основний API, якщо доступний
    if (hasMainAPIFunction('getUserData')) {
        return mainAPI.getUserData(forceRefresh);
    }

    try {
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        return await apiRequest(`user/${userId}`, 'GET', null, {
            useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
            bypassCache: forceRefresh,
            cacheTTL: 5 * 60 * 1000 // 5 хвилин
        });
    } catch (error) {
        console.error("🔌 Raffles API: Помилка отримання даних користувача:", error);
        return {
            status: 'error',
            message: 'Помилка отримання даних користувача: ' + error.message
        };
    }
}

/**
 * Отримання балансу користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Баланс користувача
 */
export async function getBalance(forceRefresh = false) {
    // Використовуємо основний API, якщо доступний
    if (hasMainAPIFunction('getBalance')) {
        return mainAPI.getBalance(forceRefresh);
    }

    try {
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        return await apiRequest(`user/${userId}/balance`, 'GET', null, {
            useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
            bypassCache: forceRefresh
        });
    } catch (error) {
        console.error("🔌 Raffles API: Помилка отримання балансу користувача:", error);
        return {
            status: 'error',
            message: 'Помилка отримання балансу: ' + error.message
        };
    }
}

// Спеціальні функції для розіграшів, які відсутні в основному API

/**
 * Отримання активних розіграшів
 * @param {boolean} forceRefresh - Примусове оновлення
 * @returns {Promise<Array>} Список активних розіграшів
 */
export async function getActiveRaffles(forceRefresh = false) {
    try {
        const response = await apiRequest('raffles', 'GET', null, {
            timeout: 15000,
            loaderMessage: 'Завантаження розіграшів...'
        });

        if (response && response.status === 'success') {
            return Array.isArray(response.data) ? response.data : [];
        }

        throw new Error(response.message || 'Помилка отримання розіграшів');
    } catch (error) {
        console.error('Помилка отримання активних розіграшів:', error);
        return [];
    }
}

/**
 * Отримання історії розіграшів
 * @param {Object} filters - Фільтри для запиту
 * @returns {Promise<Array>} Список історії розіграшів
 */
export async function getRafflesHistory(filters = {}) {
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Формуємо параметри запиту
        let queryParams = '';
        if (filters.type && filters.type !== 'all') {
            queryParams += `&type=${filters.type}`;
        }
        if (filters.status && filters.status !== 'all') {
            queryParams += `&status=${filters.status}`;
        }
        if (filters.period && filters.period !== 'all') {
            queryParams += `&period=${filters.period}`;
        }

        // Додаємо параметри до URL, якщо вони є
        const url = queryParams
            ? `user/${userId}/raffles-history?${queryParams.substring(1)}`
            : `user/${userId}/raffles-history`;

        const response = await apiRequest(url, 'GET', null, {
            timeout: 15000,
            loaderMessage: 'Завантаження історії розіграшів...'
        });

        if (response && response.status === 'success') {
            return Array.isArray(response.data) ? response.data : [];
        }

        return [];
    } catch (error) {
        console.error('Помилка отримання історії розіграшів:', error);
        return [];
    }
}

/**
 * Участь у розіграші
 * @param {string} raffleId - ID розіграшу
 * @param {number} entryCount - Кількість жетонів для участі
 * @returns {Promise<Object>} Результат участі
 */
export async function participateInRaffle(raffleId, entryCount = 1) {
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Перевіряємо коректність entryCount
        if (isNaN(entryCount) || entryCount <= 0) {
            throw new Error('Кількість жетонів повинна бути більшою за нуль');
        }

        const response = await apiRequest(`user/${userId}/participate-raffle`, 'POST', {
            raffle_id: raffleId,
            entry_count: entryCount
        }, {
            timeout: 15000,
            loaderMessage: 'Беремо участь у розіграші...'
        });

        if (response && response.status === 'success') {
            // Оновлюємо баланс користувача
            if (hasMainAPIFunction('getBalance')) {
                await mainAPI.getBalance(true);
            }

            return {
                status: 'success',
                message: response.data?.message || 'Ви успішно взяли участь у розіграші',
                data: response.data
            };
        }

        throw new Error(response.message || 'Помилка участі в розіграші');
    } catch (error) {
        console.error(`Помилка участі в розіграші ${raffleId}:`, error);
        return {
            status: 'error',
            message: error.message || 'Помилка участі в розіграші'
        };
    }
}

/**
 * Отримання бонусу новачка
 * @returns {Promise<Object>} Результат отримання бонусу
 */
export async function claimNewbieBonus() {
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        const response = await apiRequest(`user/${userId}/claim-newbie-bonus`, 'POST', null, {
            timeout: 10000,
            loaderMessage: 'Отримуємо бонус новачка...'
        });

        if (response && (response.status === 'success' || response.status === 'already_claimed')) {
            // Оновлюємо баланс користувача
            if (hasMainAPIFunction('getBalance')) {
                await mainAPI.getBalance(true);
            }

            return {
                status: response.status,
                message: response.message || 'Бонус новачка успішно отримано',
                data: response.data
            };
        }

        throw new Error(response.message || 'Помилка отримання бонусу новачка');
    } catch (error) {
        console.error('Помилка отримання бонусу новачка:', error);
        return {
            status: 'error',
            message: error.message || 'Помилка отримання бонусу новачка'
        };
    }
}

// Створюємо об'єкт з API функціями для модуля розіграшів
const rafflesAPI = {
    // Основні функції для сумісності
    apiRequest,
    getUserId,
    getAuthToken,
    getUserData,
    getBalance,

    // Специфічні функції для розіграшів
    getActiveRaffles,
    getRafflesHistory,
    participateInRaffle,
    claimNewbieBonus,

    // Конфігурація
    config: {
        baseUrl: RAFFLES_API_BASE_URL,
        throttle: REQUEST_THROTTLE
    },

    // Метадані
    _version: '1.0.0',
    _type: 'raffles'
};

// Розширюємо основний API новими функціями, якщо він існує
if (window.WinixAPI) {
    // Додаємо до основного API всі нові функції, яких там немає
    Object.keys(rafflesAPI).forEach(key => {
        if (!window.WinixAPI[key] && key !== 'apiRequest' && key !== 'getUserId' && key !== 'getAuthToken') {
            window.WinixAPI[key] = rafflesAPI[key];
        }
    });

    // Додаємо об'єкт raffles в основний API
    window.WinixAPI.raffles = rafflesAPI;

    console.log("🔌 Raffles API: Успішно розширено основний API системи");
} else {
    // Якщо основний API не існує, створюємо глобальний об'єкт для API розіграшів
    window.WinixRafflesAPI = rafflesAPI;
    console.log("🔌 Raffles API: Створено окремий API для розіграшів (основний API не знайдено)");
}

// Додаємо API в глобальний об'єкт розіграшів для використання в інших модулях
if (WinixRaffles) {
    WinixRaffles.api = rafflesAPI;
}

console.log("🔌 Raffles API: Ініціалізацію завершено");

// Експортуємо API як основний експорт
export default rafflesAPI;