/**
 * WINIX - Система розіграшів (error-handler.js)
 * Модуль для коректної обробки помилок та покращення UX
 * @version 1.2.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше error-handler.js');
        return;
    }

    // Модуль обробки помилок
    const errorHandler = {
        // Конфігурація обробки помилок
        config: {
            // Ігнорувати некритичні помилки
            ignoreNonCritical: true,

            // Автоматично перезавантажувати при критичних помилках
            autoReloadOnCritical: false,

            // Максимальна кількість помилок перед перезавантаженням
            maxErrorsBeforeReload: 5,

            // Типи помилок
            errorTypes: {
                NETWORK: 'network_error',       // Помилки мережі
                API: 'api_error',               // Помилки API
                VALIDATION: 'validation_error', // Помилки валідації
                AUTH: 'auth_error',             // Помилки авторизації
                UI: 'ui_error',                 // Помилки інтерфейсу
                UNKNOWN: 'unknown_error'        // Невідомі помилки
            },

            // Повідомлення для типів помилок
            errorMessages: {
                network_error: 'Проблеми з підключенням. Перевірте з\'єднання з інтернетом.',
                api_error: 'Сервіс тимчасово недоступний. Спробуйте пізніше.',
                validation_error: 'Перевірте правильність введених даних.',
                auth_error: 'Помилка авторизації. Спробуйте оновити сторінку.',
                ui_error: 'Помилка інтерфейсу. Спробуйте оновити сторінку.',
                unknown_error: 'Виникла помилка. Спробуйте оновити сторінку.'
            }
        },

        // Статистика помилок
        stats: {
            totalErrors: 0,
            errorsByType: {},
            lastError: null,
            lastErrorTime: 0,
            errorsInSession: 0
        },

        // Ініціалізація модуля
        init: function() {
            console.log('🛡️ Ініціалізація модуля обробки помилок...');

            // Реєструємо глобальні обробники помилок
            this.registerGlobalErrorHandlers();

            // Реєструємо обробники для запитів API
            this.registerApiErrorHandlers();

            // Реєструємо спеціальні обробники для розіграшів
            this.registerRaffleErrorHandlers();

            // Оновлюємо стандартну функцію показу сповіщень
            this.upgradeToastFunction();
        },

        /**
         * Реєстрація глобальних обробників помилок
         */
        registerGlobalErrorHandlers: function() {
            // Обробник помилок JavaScript
            window.addEventListener('error', (event) => {
                this.handleJavaScriptError(event);
            });

            // Обробник необроблених Promise помилок
            window.addEventListener('unhandledrejection', (event) => {
                this.handlePromiseError(event);
            });

            // Обробник мережевих помилок
            window.addEventListener('offline', () => {
                this.showUserFriendlyError('Відсутнє підключення до інтернету. Перевірте мережу.', 'warning');
            });
        },

        /**
         * Реєстрація обробників помилок API
         */
        registerApiErrorHandlers: function() {
            // Перевизначаємо стандартний fetch для відстеження помилок
            const originalFetch = window.fetch;

            window.fetch = async (...args) => {
                try {
                    const response = await originalFetch(...args);

                    // Перевіряємо статус відповіді
                    if (!response.ok) {
                        // Обробляємо помилку HTTP
                        this.handleHttpError(response, args[0]);
                    }

                    return response;
                } catch (error) {
                    // Обробляємо помилку мережі
                    this.handleFetchError(error, args[0]);
                    throw error;
                }
            };

            // Обробник помилок WinixAPI
            if (window.WinixAPI) {
                document.addEventListener('api-error', (event) => {
                    if (event.detail && event.detail.error) {
                        this.handleApiError(event.detail.error, event.detail.endpoint);
                    }
                });
            }
        },

        /**
         * Реєстрація обробників помилок розіграшів
         */
        registerRaffleErrorHandlers: function() {
            // Обробник помилок участі в розіграші
            document.addEventListener('raffle-participation-error', (event) => {
                if (event.detail && event.detail.error) {
                    this.handleRaffleParticipationError(event.detail.error, event.detail.raffleId);
                }
            });

            // Обробник кнопок участі для запобігання помилкам
            document.addEventListener('click', (event) => {
                const participateButton = event.target.closest('.join-button, .mini-raffle-button');

                if (participateButton && participateButton.disabled) {
                    event.preventDefault();
                    event.stopPropagation();

                    // Перевіряємо чому кнопка недоступна
                    if (participateButton.classList.contains('processing')) {
                        this.showUserFriendlyError('Зачекайте, ваш запит обробляється', 'info');
                    } else if (participateButton.classList.contains('participating')) {
                        // Нічого не робимо, кнопка "Додати ще білет" повинна бути доступна
                    } else if (participateButton.classList.contains('disabled')) {
                        this.showUserFriendlyError('Цей розіграш недоступний', 'info');
                    }
                }
            }, true);
        },

        /**
         * Покращення стандартної функції сповіщень
         */
        upgradeToastFunction: function() {
            // Зберігаємо оригінальну функцію
            const originalShowToast = window.showToast;

            // Якщо функція не існує, створюємо її
            if (typeof originalShowToast !== 'function') {
                window.showToast = (message, type = 'info') => {
                    this.createToast(message, type);
                };
                return;
            }

            // Перевизначаємо функцію
            window.showToast = (message, type = 'info') => {
                // Спеціальна обробка для помилок
                if (type === 'error') {
                    // Конвертуємо червоні помилки в більш дружні повідомлення
                    const userFriendlyMessage = this.getHumanReadableMessage(message);

                    // Змінюємо тип сповіщення для некритичних помилок
                    const alertType = this.isCriticalError(message) ? 'error' : 'warning';

                    // Викликаємо оригінальну функцію з новими параметрами
                    originalShowToast(userFriendlyMessage, alertType);

                    // Логуємо оригінальну помилку для діагностики
                    console.warn('🔶 Оброблена помилка:', message);
                } else {
                    // Для інших типів використовуємо оригінальну функцію
                    originalShowToast(message, type);
                }
            };
        },

        /**
         * Створення сповіщення, якщо стандартна функція недоступна
         * @param {string} message - Повідомлення
         * @param {string} type - Тип сповіщення
         */
        createToast: function(message, type = 'info') {
            // Перевіряємо наявність контейнера
            let container = document.getElementById('toast-container');

            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                `;
                document.body.appendChild(container);
            }

            // Створюємо сповіщення
            const toast = document.createElement('div');
            toast.className = `toast-message ${type}`;
            toast.style.cssText = `
                background-color: ${this.getColorForType(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                margin-bottom: 10px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-width: 250px;
                max-width: 350px;
                opacity: 0;
                transform: translateX(50px);
                transition: opacity 0.3s, transform 0.3s;
            `;

            // Створюємо контент і кнопку закриття
            toast.innerHTML = `
                <div class="toast-content">${message}</div>
                <button class="toast-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; margin-left: 10px;">&times;</button>
            `;

            // Додаємо до контейнера
            container.appendChild(toast);

            // Затримка для анімації
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);

            // Автоматичне приховування
            const hideTimeout = setTimeout(() => {
                this.hideToast(toast);
            }, 5000);

            // Обробник закриття
            toast.querySelector('.toast-close').addEventListener('click', () => {
                clearTimeout(hideTimeout);
                this.hideToast(toast);
            });
        },

        /**
         * Приховування сповіщення
         * @param {HTMLElement} toast - Елемент сповіщення
         */
        hideToast: function(toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        },

        /**
         * Отримання кольору для типу сповіщення
         * @param {string} type - Тип сповіщення
         * @returns {string} Колір
         */
        getColorForType: function(type) {
            switch (type) {
                case 'success': return '#4CAF50';
                case 'error': return '#F44336';
                case 'warning': return '#FF9800';
                case 'info': return '#2196F3';
                default: return '#2196F3';
            }
        },

        /**
         * Обробка помилок JavaScript
         * @param {ErrorEvent} event - Подія помилки
         */
        handleJavaScriptError: function(event) {
            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.UNKNOWN,
                message: event.message,
                source: event.filename,
                stack: event.error ? event.error.stack : null
            });

            // Обробляємо помилку, якщо вона пов'язана з розіграшами
            if (this.isRaffleRelatedError(event)) {
                this.handleRaffleError(event.error);

                // Запобігаємо стандартній обробці
                event.preventDefault();
                return;
            }

            // Для критичних помилок показуємо користувачу повідомлення
            if (this.isCriticalError(event.message)) {
                this.showUserFriendlyError(event.message, 'error');

                // Перезавантаження при критичних помилках
                if (this.config.autoReloadOnCritical && this.stats.errorsInSession >= this.config.maxErrorsBeforeReload) {
                    this.reloadApplication();
                }
            } else if (!this.config.ignoreNonCritical) {
                // Для некритичних помилок показуємо попередження
                this.showUserFriendlyError(event.message, 'warning');
            }

            // Скидаємо стан індикаторів завантаження
            this.resetLoadingIndicators();
        },

        /**
         * Обробка необроблених помилок Promise
         * @param {PromiseRejectionEvent} event - Подія помилки
         */
        handlePromiseError: function(event) {
            // Отримуємо дані про помилку
            const error = event.reason;
            const message = error && typeof error === 'object' ? error.message : String(error);

            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.UNKNOWN,
                message: message,
                stack: error && error.stack ? error.stack : null
            });

            // Перевірка на стандартні повідомлення про зачекайте
            if (message && message.toLowerCase().includes('зачекайте')) {
                // Це типове повідомлення про обмеження швидкості, показуємо дружнє попередження
                this.showUserFriendlyError('Будь ласка, зачекайте перед наступною спробою', 'info');
                event.preventDefault();
                return;
            }

            // Перевірка на повідомлення про завершений розіграш
            if (message && (message.toLowerCase().includes('завершено') ||
                          message.toLowerCase().includes('розіграш') &&
                          (message.toLowerCase().includes('не знайдено') ||
                           message.toLowerCase().includes('not found')))) {
                // Це повідомлення про завершений розіграш
                this.showUserFriendlyError('Цей розіграш вже завершено або недоступний', 'info');

                // Намагаємось знайти ID розіграшу в помилці або в активних запитах
                const raffleId = this.extractRaffleIdFromError(error);
                if (raffleId) {
                    this.markRaffleAsInvalid(raffleId);
                }

                event.preventDefault();
                return;
            }

            // Перевірка на недостатність жетонів
            if (message && (message.toLowerCase().includes('недостатньо') ||
                          message.toLowerCase().includes('жетон'))) {
                this.showUserFriendlyError('Недостатньо жетонів для участі. Отримайте більше жетонів.', 'warning');
                event.preventDefault();
                return;
            }

            // Обробляємо помилку, якщо вона пов'язана з розіграшами
            if (this.isRaffleRelatedError(event)) {
                this.handleRaffleError(error);

                // Запобігаємо стандартній обробці
                event.preventDefault();
                return;
            }

            // Показуємо користувацьке повідомлення
            this.showUserFriendlyError(message, 'warning');

            // Скидаємо стан індикаторів завантаження
            this.resetLoadingIndicators();

            // Скидаємо стан кнопок участі
            this.resetParticipationState();

            // Запобігаємо стандартній обробці, щоб не показувати червоне повідомлення у консолі
            event.preventDefault();
        },

        /**
         * Спроба знайти ID розіграшу в помилці
         * @param {Error} error - Об'єкт помилки
         * @returns {string|null} - ID розіграшу або null
         */
        extractRaffleIdFromError: function(error) {
            // Спроба отримати ID з об'єкта помилки
            if (error && error.raffleId) {
                return error.raffleId;
            }

            // Спроба отримати ID з деталей помилки
            if (error && error.details && error.details.raffle_id) {
                return error.details.raffle_id;
            }

            // Спроба отримати ID з повідомлення помилки
            if (error && error.message) {
                const uuidMatch = error.message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
                if (uuidMatch) {
                    return uuidMatch[0];
                }
            }

            // Якщо є активний модуль розіграшів, спробуємо перевірити поточний запит
            if (window.WinixRaffles && window.WinixRaffles.participation && window.WinixRaffles.participation.pendingRequests) {
                // Шукаємо перший активний запит
                const pendingRaffleId = Object.keys(window.WinixRaffles.participation.pendingRequests)[0];
                if (pendingRaffleId && this.isValidUUID(pendingRaffleId)) {
                    return pendingRaffleId;
                }
            }

            return null;
        },

        /**
         * Перевірка, чи є UUID валідним
         * @param {string} id - UUID для перевірки
         * @returns {boolean} - Результат перевірки
         */
        isValidUUID: function(id) {
            if (!id || typeof id !== 'string') return false;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(id);
        },

        /**
         * Обробка помилок HTTP
         * @param {Response} response - Відповідь
         * @param {string} url - URL запиту
         */
        handleHttpError: function(response, url) {
            // Формуємо повідомлення про помилку
            const message = `HTTP помилка ${response.status}: ${response.statusText}`;

            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.API,
                message: message,
                code: response.status,
                url: url
            });

            // Спеціальна обробка для різних HTTP-статусів
            if (response.status === 404) {
                // Особлива обробка для розіграшів
                if (url && url.toString().includes('raffles')) {
                    this.handleRaffleNotFoundError(url);
                    return;
                }

                // Загальна обробка 404
                this.showUserFriendlyError('Запитані дані не знайдено', 'warning');
            } else if (response.status === 429) {
                this.showUserFriendlyError('Забагато запитів. Зачекайте кілька секунд і спробуйте знову.', 'warning');
            } else if (response.status >= 500) {
                this.showUserFriendlyError('Сервер тимчасово недоступний. Спробуйте пізніше.', 'error');
            } else {
                this.showUserFriendlyError(this.getHumanReadableMessage(message), 'warning');
            }
        },

        /**
         * Обробка помилок мережі
         * @param {Error} error - Помилка
         * @param {string} url - URL запиту
         */
        handleFetchError: function(error, url) {
            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.NETWORK,
                message: error.message,
                url: url
            });

            // Показуємо користувацьке повідомлення
            this.showUserFriendlyError('Проблеми з підключенням. Перевірте інтернет-з\'єднання.', 'warning');

            // Скидаємо стан індикаторів завантаження
            this.resetLoadingIndicators();
        },

        /**
         * Обробка помилок API
         * @param {Error} error - Помилка
         * @param {string} endpoint - Ендпойнт API
         */
        handleApiError: function(error, endpoint) {
            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.API,
                message: error.message,
                endpoint: endpoint
            });

            // Обробка помилок для розіграшів
            if (endpoint && endpoint.includes('raffles')) {
                this.handleRaffleApiError(error, endpoint);
                return;
            }

            // Стандартна обробка
            const message = this.getHumanReadableMessage(error.message);

            // Показуємо повідомлення користувачу
            this.showUserFriendlyError(message, 'warning');
        },

        /**
         * Обробка помилок участі в розіграші
         * @param {Error} error - Помилка
         * @param {string} raffleId - ID розіграшу
         */
        handleRaffleParticipationError: function(error, raffleId) {
            // Оновлюємо статистику
            this.updateErrorStats({
                type: this.config.errorTypes.API,
                message: error.message,
                raffleId: raffleId
            });

            // Перевіряємо тип помилки
            if (error.message && error.message.toLowerCase().includes('жетон')) {
                // Помилка недостатності жетонів
                this.showUserFriendlyError('Недостатньо жетонів для участі. Отримайте більше жетонів і спробуйте знову.', 'warning');
            } else if (error.message && (
                error.message.toLowerCase().includes('розіграш') ||
                error.message.toLowerCase().includes('завершено') ||
                error.message.toLowerCase().includes('не знайдено') ||
                error.message.toLowerCase().includes('not found')
            )) {
                // Помилка з розіграшем
                this.showUserFriendlyError('Цей розіграш вже недоступний або завершився.', 'info');

                // Позначаємо розіграш як недійсний
                this.markRaffleAsInvalid(raffleId);
            } else if (error.message && error.message.toLowerCase().includes('зачекайте')) {
                // Помилка обмеження швидкості
                this.showUserFriendlyError('Будь ласка, зачекайте кілька секунд перед наступною спробою.', 'info');
            } else {
                // Інші помилки
                this.showUserFriendlyError('Не вдалося взяти участь у розіграші. Спробуйте пізніше.', 'warning');
            }

            // Оновлюємо стан кнопок участі
            this.resetParticipationState();
        },

        /**
         * Обробка помилок, пов'язаних з розіграшами
         * @param {Error} error - Помилка
         */
        handleRaffleError: function(error) {
            // Якщо помилка стосується невалідного UUID
            if (error.message && error.message.toLowerCase().includes('uuid')) {
                this.showUserFriendlyError('Дані розіграшу недійсні. Спробуйте оновити сторінку.', 'warning');
                return;
            }

            // Якщо помилка стосується незнайденого розіграшу
            if (error.message && (
                error.message.toLowerCase().includes('не знайдено') ||
                error.message.toLowerCase().includes('not found')
            )) {
                this.showUserFriendlyError('Розіграш вже завершено або видалено.', 'info');
                return;
            }

            // Стандартна обробка
            this.showUserFriendlyError('Помилка при роботі з розіграшем. Спробуйте оновити сторінку.', 'warning');
        },

        /**
         * Обробка помилки незнайденого розіграшу
         * @param {string} url - URL запиту
         */
        handleRaffleNotFoundError: function(url) {
            // Витягуємо ID розіграшу з URL
            let raffleId = null;

            if (typeof url === 'string') {
                const matches = url.match(/raffles\/([^/?]+)/i);
                if (matches && matches[1]) {
                    raffleId = matches[1];
                }
            }

            // Позначаємо розіграш як недійсний
            if (raffleId) {
                this.markRaffleAsInvalid(raffleId);
            }

            // Показуємо повідомлення користувачу
            this.showUserFriendlyError('Розіграш вже завершено або видалено.', 'info');

            // Спроба оновити список розіграшів
            if (window.WinixRaffles &&
                window.WinixRaffles.active &&
                typeof window.WinixRaffles.active.loadActiveRaffles === 'function') {

                setTimeout(() => {
                    window.WinixRaffles.active.loadActiveRaffles(true);
                }, 1000);
            }
        },

        /**
         * Обробка помилок API, пов'язаних з розіграшами
         * @param {Error} error - Помилка
         * @param {string} endpoint - Ендпойнт API
         */
        handleRaffleApiError: function(error, endpoint) {
            // Обробка помилок участі в розіграші
            if (endpoint.includes('participate-raffle')) {
                // Витягуємо ID розіграшу з помилки або запиту
                let raffleId = null;

                if (error.raffleId) {
                    raffleId = error.raffleId;
                } else if (error.details && error.details.raffle_id) {
                    raffleId = error.details.raffle_id;
                } else {
                    // Спроба витягти з URL
                    const match = endpoint.match(/participate-raffle\/([^/?]+)/i);
                    if (match && match[1]) {
                        raffleId = match[1];
                    }
                }

                this.handleRaffleParticipationError(error, raffleId);
                return;
            }

            // Обробка помилок завантаження розіграшів
            if (endpoint.includes('raffles') && !endpoint.includes('participate')) {
                this.showUserFriendlyError('Не вдалося завантажити розіграші. Спробуйте оновити сторінку.', 'warning');
                return;
            }

            // Стандартна обробка
            this.showUserFriendlyError(this.getHumanReadableMessage(error.message), 'warning');
        },

        /**
         * Оновлення статистики помилок
         * @param {Object} errorData - Дані про помилку
         */
        updateErrorStats: function(errorData) {
            // Збільшуємо лічильники
            this.stats.totalErrors++;
            this.stats.errorsInSession++;

            // Оновлюємо статистику по типу
            const errorType = errorData.type || this.config.errorTypes.UNKNOWN;
            this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

            // Запам'ятовуємо останню помилку
            this.stats.lastError = errorData;
            this.stats.lastErrorTime = Date.now();

            // Логуємо дані про помилку
            console.error('🔴 Помилка зареєстрована:', errorData);
        },

        /**
         * Показ користувацького повідомлення про помилку
         * @param {string} message - Повідомлення
         * @param {string} type - Тип сповіщення (error/warning/info)
         */
        showUserFriendlyError: function(message, type = 'warning') {
            // Якщо функція showToast доступна, використовуємо її
            if (typeof window.showToast === 'function') {
                window.showToast(message, type);
            } else {
                // Альтернативний варіант
                console.error(`${type.toUpperCase()}: ${message}`);
            }
        },

        /**
         * Перевірка чи помилка пов'язана з розіграшами
         * @param {Error|Event} error - Помилка або подія помилки
         * @returns {boolean} Результат перевірки
         */
        isRaffleRelatedError: function(error) {
            // Витягуємо повідомлення з різних типів помилок
            let message = '';

            if (error instanceof Error) {
                message = error.message;
            } else if (error.error && error.error.message) {
                message = error.error.message;
            } else if (error.reason && error.reason.message) {
                message = error.reason.message;
            } else if (error.message) {
                message = error.message;
            } else if (typeof error === 'string') {
                message = error;
            }

            // Перевіряємо ключові слова, пов'язані з розіграшами
            const raffleKeywords = ['raffle', 'розіграш', 'uuid', 'білет', 'ticket', 'participate'];

            return raffleKeywords.some(keyword => message.toLowerCase().includes(keyword));
        },

        /**
         * Перевірка чи помилка є критичною
         * @param {string} message - Повідомлення про помилку
         * @returns {boolean} Результат перевірки
         */
        isCriticalError: function(message) {
            // Перевіряємо ключові слова критичних помилок
            const criticalKeywords = [
                'undefined is not a function',
                'null is not an object',
                'cannot read property',
                'is not defined',
                'out of memory',
                'script error',
                'failed to fetch',
                'aborted',
                'quota exceeded'
            ];

            // Якщо повідомлення містить хоча б одне критичне ключове слово
            if (typeof message === 'string') {
                return criticalKeywords.some(keyword => message.toLowerCase().includes(keyword));
            }

            return false;
        },

        /**
         * Отримання зрозумілого для користувача повідомлення
         * @param {string} errorMessage - Технічне повідомлення про помилку
         * @returns {string} Зрозуміле для користувача повідомлення
         */
        getHumanReadableMessage: function(errorMessage) {
            if (!errorMessage) {
                return this.config.errorMessages.unknown_error;
            }

            // Перевірка на помилки мережі
            if (errorMessage.includes('network') ||
                errorMessage.includes('мереж') ||
                errorMessage.includes('fetch') ||
                errorMessage.includes('connect')) {
                return this.config.errorMessages.network_error;
            }

            // Перевірка на помилки API
            if (errorMessage.includes('API') ||
                errorMessage.includes('endpoint') ||
                errorMessage.includes('REST') ||
                errorMessage.includes('HTTP')) {
                return this.config.errorMessages.api_error;
            }

            // Перевірка на помилки авторизації
            if (errorMessage.includes('auth') ||
                errorMessage.includes('token') ||
                errorMessage.includes('авториз') ||
                errorMessage.includes('permission') ||
                errorMessage.includes('доступ')) {
                return this.config.errorMessages.auth_error;
            }

            // Перевірка на помилки валідації
            if (errorMessage.includes('valid') ||
                errorMessage.includes('валід') ||
                errorMessage.includes('format') ||
                errorMessage.includes('формат') ||
                errorMessage.includes('required') ||
                errorMessage.includes('необхідн')) {
                return this.config.errorMessages.validation_error;
            }

            // Специфічні помилки для розіграшів
            if (errorMessage.toLowerCase().includes('жетон') &&
                (errorMessage.toLowerCase().includes('недостатньо') ||
                 errorMessage.toLowerCase().includes('insufficient'))) {
                return 'Недостатньо жетонів для участі. Отримайте більше жетонів.';
            }

            if (errorMessage.toLowerCase().includes('розіграш') &&
                (errorMessage.toLowerCase().includes('не знайдено') ||
                 errorMessage.toLowerCase().includes('not found'))) {
                return 'Розіграш вже завершено або видалено.';
            }

            if (errorMessage.toLowerCase().includes('uuid') ||
                errorMessage.toLowerCase().includes('id') &&
                errorMessage.toLowerCase().includes('invalid')) {
                return 'Дані розіграшу недійсні. Спробуйте оновити сторінку.';
            }

            // Обробка повідомлень зачекайте
            if (errorMessage.toLowerCase().includes('зачекайте')) {
                return 'Будь ласка, зачекайте перед наступною спробою.';
            }

            // Видаляємо технічні деталі з помилки
            let cleanMessage = errorMessage;

            // Видаляємо технічні префікси
            cleanMessage = cleanMessage.replace(/Error: /g, '');
            cleanMessage = cleanMessage.replace(/TypeError: /g, '');
            cleanMessage = cleanMessage.replace(/ReferenceError: /g, '');

            // Якщо повідомлення занадто технічне, повертаємо загальне
            if (cleanMessage.includes('undefined') ||
                cleanMessage.includes('null') ||
                cleanMessage.includes('NaN') ||
                cleanMessage.includes('prop')) {
                return this.config.errorMessages.unknown_error;
            }

            // Якщо повідомлення коротке та зрозуміле, повертаємо його
            if (cleanMessage.length < 50 && !cleanMessage.includes('Cannot ')) {
                return cleanMessage;
            }

            // За замовчуванням повертаємо загальне повідомлення
            return this.config.errorMessages.unknown_error;
        },

        /**
         * Скидання стану індикаторів завантаження
         */
        resetLoadingIndicators: function() {
            // Скидаємо стан спінера
            if (typeof window.resetLoadingState === 'function') {
                window.resetLoadingState();
            } else if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Скидаємо стан глобальних лічильників
            if (window.loadingCounter !== undefined) {
                window.loadingCounter = 0;
            }

            // Знаходимо спінер і ховаємо його
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.style.display = 'none';
                spinner.classList.remove('active');
            }
        },

        /**
         * Скидання стану кнопок участі
         */
        resetParticipationState: function() {
            // Скидаємо стан системи участі
            if (window.WinixRaffles &&
                window.WinixRaffles.participation) {

                // Скидаємо глобальні стани
                if (window.WinixRaffles.participation.requestInProgress) {
                    window.WinixRaffles.participation.requestInProgress = false;
                }

                // Скидаємо карту активних запитів
                if (window.WinixRaffles.participation.activeTransactions &&
                    typeof window.WinixRaffles.participation.activeTransactions.clear === 'function') {
                    window.WinixRaffles.participation.activeTransactions.clear();
                }

                // Якщо є спеціальна функція скидання, використовуємо її
                if (typeof window.WinixRaffles.participation.resetState === 'function') {
                    window.WinixRaffles.participation.resetState();
                    return;
                }
            }

            // Знаходимо кнопки в стані обробки і видаляємо атрибути
            const processingButtons = document.querySelectorAll('.join-button.processing, .mini-raffle-button.processing');
            processingButtons.forEach(button => {
                button.classList.remove('processing');
                button.removeAttribute('data-processing');
                button.disabled = false;

                // Відновлюємо оригінальний текст
                const originalText = button.getAttribute('data-original-text');
                if (originalText) {
                    button.textContent = originalText;
                } else {
                    // Встановлюємо стандартний текст, якщо оригінального немає
                    if (button.classList.contains('mini-raffle-button')) {
                        button.textContent = 'Взяти участь';
                    } else {
                        const entryFee = button.getAttribute('data-entry-fee') || '1';
                        button.textContent = `Взяти участь за ${entryFee} жетон${parseInt(entryFee) > 1 ? 'и' : ''}`;
                    }
                }
            });
        },

        /**
         * Позначення розіграшу як недійсного
         * @param {string} raffleId - ID розіграшу
         */
        markRaffleAsInvalid: function(raffleId) {
            if (!raffleId || !this.isValidUUID(raffleId)) {
                console.warn('⚠️ Спроба позначити невалідний ID як недійсний розіграш:', raffleId);
                return;
            }

            // Додаємо ID до колекції невалідних розіграшів
            if (window.WinixRaffles) {
                // В глобальному стані
                if (window.WinixRaffles.state && window.WinixRaffles.state.invalidRaffleIds) {
                    window.WinixRaffles.state.invalidRaffleIds.add(raffleId);
                }

                // В модулі participation
                if (window.WinixRaffles.participation && window.WinixRaffles.participation.invalidRaffleIds) {
                    window.WinixRaffles.participation.invalidRaffleIds.add(raffleId);

                    // Викликаємо метод додавання невалідного ID
                    if (typeof window.WinixRaffles.participation.addInvalidRaffleId === 'function') {
                        window.WinixRaffles.participation.addInvalidRaffleId(raffleId);
                    }
                }
            }

            // Оновлюємо відображення кнопок участі
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            buttons.forEach(button => {
                button.classList.add('disabled');
                button.disabled = true;
                button.textContent = 'Розіграш завершено';
            });

            // Зберігаємо в localStorage
            try {
                const invalidRaffles = JSON.parse(localStorage.getItem('winix_invalid_raffles') || '[]');
                if (!invalidRaffles.includes(raffleId)) {
                    invalidRaffles.push(raffleId);
                    localStorage.setItem('winix_invalid_raffles', JSON.stringify(invalidRaffles));
                }
            } catch (e) {
                console.warn('⚠️ Не вдалося зберегти невалідні розіграші:', e);
            }
        },

        /**
         * Перезавантаження додатку
         */
        reloadApplication: function() {
            // Оповіщаємо користувача
            this.showUserFriendlyError('Виникли проблеми. Сторінка буде перезавантажена.', 'info');

            // Затримка перед перезавантаженням
            setTimeout(() => {
                if (typeof window.resetAndReloadApplication === 'function') {
                    window.resetAndReloadApplication();
                } else {
                    window.location.reload();
                }
            }, 2000);
        },

        /**
         * Отримання діагностичної інформації
         * @returns {Object} Діагностична інформація
         */
        getDiagnosticInfo: function() {
            return {
                stats: this.stats,
                config: this.config,
                browser: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    cookiesEnabled: navigator.cookieEnabled,
                    online: navigator.onLine
                },
                page: {
                    url: window.location.href,
                    referrer: document.referrer,
                    title: document.title
                }
            };
        }
    };

    // Додаємо модуль до головного модуля розіграшів
    window.WinixRaffles.errorHandler = errorHandler;

    // Ініціалізація модуля
    document.addEventListener('DOMContentLoaded', function() {
        if (window.WinixRaffles.state.isInitialized) {
            errorHandler.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                errorHandler.init();
            });
        }
    });

    console.log('✅ Модуль обробки помилок успішно завантажено');
})();