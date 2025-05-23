/**
 * Утилітарні функції для системи завдань WINIX
 * Централізоване сховище допоміжних функцій
 */

window.TasksUtils = (function() {
    'use strict';

    console.log('🛠️ [TasksUtils] ===== ЗАВАНТАЖЕННЯ УТИЛІТАРНИХ ФУНКЦІЙ =====');

    /**
     * Форматування чисел з розділювачами тисяч
     */
    function formatNumber(num) {
        console.log('🔢 [TasksUtils] Форматування числа:', num);
        if (typeof num !== 'number' && typeof num !== 'string') {
            console.warn('⚠️ [TasksUtils] Невірний тип даних для форматування:', typeof num);
            return '0';
        }
        const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        console.log('✅ [TasksUtils] Форматований результат:', formatted);
        return formatted;
    }

    /**
     * Форматування дати і часу
     */
    function formatDate(date, format = 'full') {
        console.log('📅 [TasksUtils] Форматування дати:', date, 'формат:', format);

        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.error('❌ [TasksUtils] Невірна дата:', date);
            return 'Invalid Date';
        }

        let result;
        switch(format) {
            case 'short':
                result = d.toLocaleDateString('uk-UA');
                break;
            case 'time':
                result = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
                break;
            case 'full':
            default:
                result = d.toLocaleString('uk-UA');
        }

        console.log('✅ [TasksUtils] Форматована дата:', result);
        return result;
    }

    /**
     * Отримати час до півночі
     */
    function getTimeUntilMidnight() {
        console.log('⏰ [TasksUtils] Розрахунок часу до півночі...');

        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);

        const msUntilMidnight = midnight.getTime() - now.getTime();
        const hours = Math.floor(msUntilMidnight / (1000 * 60 * 60));
        const minutes = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((msUntilMidnight % (1000 * 60)) / 1000);

        const result = {
            total: msUntilMidnight,
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };

        console.log('✅ [TasksUtils] Час до півночі:', result);
        return result;
    }

    /**
     * Перевірка чи це новий день
     */
    function isNewDay(lastDate) {
        console.log('📅 [TasksUtils] Перевірка нового дня...');
        console.log('  📊 Остання дата:', lastDate);

        if (!lastDate) {
            console.log('  ✅ [TasksUtils] Остання дата відсутня - це новий день');
            return true;
        }

        const last = new Date(lastDate);
        const now = new Date();

        const lastDay = last.toDateString();
        const today = now.toDateString();

        const isNew = lastDay !== today;

        console.log('  📊 Останній день:', lastDay);
        console.log('  📊 Сьогодні:', today);
        console.log('  ✅ [TasksUtils] Новий день:', isNew);

        return isNew;
    }

    /**
     * Debounce функція
     */
    function debounce(func, wait) {
        console.log('⏱️ [TasksUtils] Створення debounce функції з затримкою:', wait);

        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                console.log('🔄 [TasksUtils] Виконання debounced функції');
                clearTimeout(timeout);
                func(...args);
            };

            console.log('⏸️ [TasksUtils] Відкладення виконання функції');
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle функція
     */
    function throttle(func, limit) {
        console.log('⏱️ [TasksUtils] Створення throttle функції з ліміпом:', limit);

        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                console.log('🔄 [TasksUtils] Виконання throttled функції');
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    console.log('✅ [TasksUtils] Throttle період завершено');
                    inThrottle = false;
                }, limit);
            } else {
                console.log('⏸️ [TasksUtils] Функція в throttle періоді, пропускаємо');
            }
        };
    }

    /**
     * Глибоке клонування об'єкта
     */
    function deepClone(obj) {
        console.log('📋 [TasksUtils] Глибоке клонування об\'єкта:', obj);

        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (obj instanceof Array) {
            console.log('  🔄 [TasksUtils] Клонування масиву довжиною:', obj.length);
            return obj.map(item => deepClone(item));
        }

        if (obj instanceof Object) {
            console.log('  🔄 [TasksUtils] Клонування об\'єкта з ключами:', Object.keys(obj));
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    /**
     * Генерація унікального ID
     */
    function generateId() {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        console.log('🆔 [TasksUtils] Згенеровано унікальний ID:', id);
        return id;
    }

    /**
     * Локальне сховище з перевіркою
     */
    const storage = {
        set: function(key, value) {
            console.log('💾 [TasksUtils] Збереження в localStorage:', key);
            try {
                const serialized = JSON.stringify(value);
                localStorage.setItem(key, serialized);
                console.log('✅ [TasksUtils] Збережено успішно, розмір:', serialized.length, 'байт');
                return true;
            } catch (error) {
                console.error('❌ [TasksUtils] Помилка збереження:', error);
                return false;
            }
        },

        get: function(key, defaultValue = null) {
            console.log('📂 [TasksUtils] Читання з localStorage:', key);
            try {
                const item = localStorage.getItem(key);
                if (item === null) {
                    console.log('📭 [TasksUtils] Ключ не знайдено, повернення значення за замовчуванням');
                    return defaultValue;
                }
                const parsed = JSON.parse(item);
                console.log('✅ [TasksUtils] Прочитано успішно');
                return parsed;
            } catch (error) {
                console.error('❌ [TasksUtils] Помилка читання:', error);
                return defaultValue;
            }
        },

        remove: function(key) {
            console.log('🗑️ [TasksUtils] Видалення з localStorage:', key);
            try {
                localStorage.removeItem(key);
                console.log('✅ [TasksUtils] Видалено успішно');
                return true;
            } catch (error) {
                console.error('❌ [TasksUtils] Помилка видалення:', error);
                return false;
            }
        },

        clear: function() {
            console.log('🧹 [TasksUtils] Очищення всього localStorage');
            try {
                localStorage.clear();
                console.log('✅ [TasksUtils] Очищено успішно');
                return true;
            } catch (error) {
                console.error('❌ [TasksUtils] Помилка очищення:', error);
                return false;
            }
        }
    };

    /**
     * Валідація даних
     */
    const validate = {
        isNumber: function(value) {
            const result = typeof value === 'number' && !isNaN(value) && isFinite(value);
            console.log('🔍 [TasksUtils] Валідація числа:', value, '→', result);
            return result;
        },

        isPositiveNumber: function(value) {
            const result = this.isNumber(value) && value > 0;
            console.log('🔍 [TasksUtils] Валідація позитивного числа:', value, '→', result);
            return result;
        },

        isString: function(value) {
            const result = typeof value === 'string';
            console.log('🔍 [TasksUtils] Валідація рядка:', value, '→', result);
            return result;
        },

        isArray: function(value) {
            const result = Array.isArray(value);
            console.log('🔍 [TasksUtils] Валідація масиву:', value, '→', result);
            return result;
        },

        isObject: function(value) {
            const result = value !== null && typeof value === 'object' && !Array.isArray(value);
            console.log('🔍 [TasksUtils] Валідація об\'єкта:', value, '→', result);
            return result;
        },

        isWalletAddress: function(address) {
            const result = /^0x[a-fA-F0-9]{40}$/.test(address);
            console.log('🔍 [TasksUtils] Валідація адреси гаманця:', address, '→', result);
            return result;
        }
    };

    /**
     * Показати toast повідомлення
     */
    function showToast(message, type = 'info', duration = 3000) {
        console.log(`💬 [TasksUtils] Показ toast повідомлення: ${type} - "${message}"`);

        const toast = document.getElementById('toast-message');
        if (!toast) {
            console.error('❌ [TasksUtils] Елемент toast не знайдено');
            return;
        }

        // Очищаємо попередні класи
        toast.className = 'toast-message';

        // Встановлюємо текст та стиль
        toast.textContent = message;
        toast.classList.add(type);

        // Показуємо toast
        setTimeout(() => {
            toast.classList.add('show');
            console.log('✅ [TasksUtils] Toast показано');
        }, 10);

        // Приховуємо після затримки
        setTimeout(() => {
            toast.classList.remove('show');
            console.log('✅ [TasksUtils] Toast приховано');
        }, duration);
    }

    /**
     * Перетворення мілісекунд в читабельний формат
     */
    function msToReadable(ms) {
        console.log('⏱️ [TasksUtils] Перетворення мілісекунд:', ms);

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let result;
        if (days > 0) {
            result = `${days} ${days === 1 ? 'день' : 'днів'}`;
        } else if (hours > 0) {
            result = `${hours} ${hours === 1 ? 'година' : 'годин'}`;
        } else if (minutes > 0) {
            result = `${minutes} ${minutes === 1 ? 'хвилина' : 'хвилин'}`;
        } else {
            result = `${seconds} ${seconds === 1 ? 'секунда' : 'секунд'}`;
        }

        console.log('✅ [TasksUtils] Читабельний формат:', result);
        return result;
    }

    /**
     * API виклик з обробкою помилок
     */
    async function apiCall(endpoint, options = {}) {
        console.log('🌐 [TasksUtils] API виклик:', endpoint);
        console.log('  📊 Опції:', options);

        const baseUrl = window.TasksConstants?.API_ENDPOINTS?.BASE_URL || '/api';
        const url = baseUrl + endpoint;

        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        // Додаємо тіло запиту якщо є
        if (finalOptions.body && typeof finalOptions.body === 'object') {
            finalOptions.body = JSON.stringify(finalOptions.body);
        }

        console.log('  🔗 Повний URL:', url);
        console.log('  📋 Фінальні опції:', finalOptions);

        try {
            const startTime = Date.now();
            const response = await fetch(url, finalOptions);
            const endTime = Date.now();

            console.log(`  ⏱️ Час виконання: ${endTime - startTime}мс`);
            console.log(`  📊 Статус відповіді: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('❌ [TasksUtils] API помилка:', error);
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ [TasksUtils] API відповідь:', data);
            return data;

        } catch (error) {
            console.error('❌ [TasksUtils] Помилка API виклику:', error);
            throw error;
        }
    }

    console.log('✅ [TasksUtils] Утилітарні функції завантажено успішно');

    // Публічний API
    return {
        formatNumber,
        formatDate,
        getTimeUntilMidnight,
        isNewDay,
        debounce,
        throttle,
        deepClone,
        generateId,
        storage,
        validate,
        showToast,
        msToReadable,
        apiCall
    };

})();

console.log('✅ [TasksUtils] Модуль утиліт готовий до використання');