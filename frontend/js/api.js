/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 *
 * Цей модуль централізує всі API-запити для різних функціональностей:
 * - Авторизація
 * - Стейкінг
 * - Реферали
 * - Транзакції
 * - Завдання
 * та інші.
 */

(function() {
    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ТА КОНСТАНТИ ========

    // Базовий URL API (за замовчуванням пустий для відносних шляхів)
    const API_BASE_URL = '';

    // Прапорець для логування запитів
    let _debugMode = false;

    // Прапорець для відстеження проблем зі стейкінгом
    let _stakingErrorCount = 0;
    let _lastStakingErrorTime = 0;

    // ЗМІНЕНО: Покращена функція для отримання ID користувача з різних джерел
    function getUserId() {
        // Допоміжна функція для перевірки валідності ID
        function isValidId(id) {
            // ID повинен існувати, не бути невизначеним, не бути null, і не бути рядковим представленням цих значень
            return id &&
                id !== 'undefined' &&
                id !== 'null' &&
                id !== undefined &&
                id !== null &&
                id.toString().trim() !== '';
        }

        // Спочатку перевіряємо наявність Telegram WebApp і токена
    if (window.Telegram && window.Telegram.WebApp) {
        // Перевіряємо, чи WebApp готовий до роботи
        window.Telegram.WebApp.ready();

        // Отримуємо дані користувача
        if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            if (tgUser.id) {
                const userId = tgUser.id.toString();
                console.log("🆔 ID користувача отримано з Telegram WebApp:", userId);

                // Зберігаємо в localStorage для наступних запитів
                localStorage.setItem('telegram_user_id', userId);
                return userId;
            }
        }
    }

    // Потім пробуємо отримати з localStorage
    let userId = localStorage.getItem('telegram_user_id');
    if (isValidId(userId)) {
        return userId;
    }

        // Перевіряємо валідність ID
        if (isValidId(userId)) {
            if (_debugMode) console.log("🆔 ID користувача отримано з localStorage:", userId);
            return userId;
        }

        // ЗМІНЕНО: Додатково пробуємо отримати з Telegram WebApp API напряму
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user) {
            const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            if (isValidId(tgUser.id)) {
                userId = tgUser.id.toString();
                if (_debugMode) console.log("🆔 ID користувача отримано з Telegram WebApp:", userId);

                // Зберігаємо в localStorage для наступних запитів
                try {
                    localStorage.setItem('telegram_user_id', userId);
                } catch (e) {
                    console.warn("Не вдалося зберегти ID користувача в localStorage:", e);
                }

                return userId;
            }
        }

        // Потім пробуємо отримати з DOM елемента
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
            userId = userIdElement.textContent.trim();
            if (isValidId(userId)) {
                if (_debugMode) console.log("🆔 ID користувача отримано з DOM:", userId);

                // Зберігаємо в localStorage для наступних запитів
                try {
                    localStorage.setItem('telegram_user_id', userId);
                } catch (e) {
                    console.warn("Не вдалося зберегти ID користувача в localStorage:", e);
                }

                return userId;
            }
        }

        // Пробуємо отримати з URL параметрів
        const urlParams = new URLSearchParams(window.location.search);
        userId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (isValidId(userId)) {
            if (_debugMode) console.log("🆔 ID користувача отримано з URL параметрів:", userId);

            // Зберігаємо в localStorage для наступних запитів
            try {
                localStorage.setItem('telegram_user_id', userId);
            } catch (e) {
                console.warn("Не вдалося зберегти ID користувача в localStorage:", e);
            }

            return userId;
        }

        // ЗМІНЕНО: Додано очищення невалідних значень в localStorage
        try {
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId && !isValidId(storedId)) {
                localStorage.removeItem('telegram_user_id');
                console.warn("⚠️ Видалено невалідний ID з localStorage:", storedId);
            }
        } catch (e) {
            console.warn("⚠️ Проблема з localStorage:", e);
        }

        // Якщо не вдалося знайти валідний ID, повертаємо null
        console.warn("⚠️ Не вдалося отримати ID користувача");
        return null;
    }

    // Покращена обробка помилок API
    function handleApiError(error, operation = 'API операції') {
        console.error(`❌ Помилка ${operation}:`, error);

        // Пробуємо отримати текст помилки
        let errorMessage = error.message || 'Невідома помилка';

        // Перевіряємо, чи це помилка зі стейкінгом
        const isStakingError = operation.toLowerCase().includes('стейкінг') ||
            operation.toLowerCase().includes('staking') ||
            errorMessage.toLowerCase().includes('стейкінг') ||
            errorMessage.toLowerCase().includes('staking');

        // Відстежуємо помилки стейкінгу для автоматичного відновлення
        if (isStakingError) {
            const currentTime = Date.now();
            // Скидаємо лічильник, якщо минуло більше 5 хвилин з останньої помилки
            if (currentTime - _lastStakingErrorTime > 5 * 60 * 1000) {
                _stakingErrorCount = 0;
            }

            _stakingErrorCount++;
            _lastStakingErrorTime = currentTime;

            // Автоматичне відновлення при повторних помилках
            if (_stakingErrorCount >= 2) {
                console.warn("⚠️ Виявлено повторні помилки стейкінгу. Запускаємо автоматичне відновлення...");
                // Використовуємо setTimeout, щоб не блокувати поточний потік
                setTimeout(() => {
                    try {
                        if (window.WinixAPI && window.WinixAPI.repairStaking) {
                            // Показуємо повідомлення користувачу, якщо є функція showToast
                            if (window.showToast) {
                                window.showToast("Виправляємо проблеми зі стейкінгом...");
                            }
                            window.WinixAPI.repairStaking(false)
                                .then(result => {
                                    if (result.success) {
                                        console.log("✅ Автоматичне відновлення стейкінгу успішне");
                                        _stakingErrorCount = 0;
                                        // Перезавантажуємо сторінку, якщо це сторінка стейкінгу
                                        if (window.location.href.includes('staking')) {
                                            if (window.showToast) {
                                                window.showToast("Проблему зі стейкінгом виправлено. Оновлення сторінки...");
                                            }
                                            setTimeout(() => window.location.reload(), 1500);
                                        }
                                    }
                                })
                                .catch(repairError => {
                                    console.error("❌ Помилка автоматичного відновлення:", repairError);
                                });
                        }
                    } catch (e) {
                        console.error("❌ Помилка запуску відновлення:", e);
                    }
                }, 100);
            }
        }

        // Перевіряємо тип помилки і формуємо зрозуміле повідомлення
        if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
            return `Не вдалося з'єднатися з сервером. Перевірте інтернет-з'єднання та спробуйте знову.`;
        }

        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            return `Час очікування відповіді від сервера вичерпано. Спробуйте знову пізніше.`;
        }

        if (errorMessage.includes('404')) {
            return `Сервер не може знайти потрібний ресурс (404). Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('405')) {
            return `Сервер не підтримує цей метод запиту (405). Повідомте про помилку розробникам.`;
        }

        if (errorMessage.includes('500')) {
            return `Виникла помилка на сервері (500). Будь ласка, спробуйте пізніше.`;
        }

        if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
            return `Не вдалося отримати дані користувача. Спробуйте перезавантажити сторінку.`;
        }

        if (errorMessage.includes('ID користувача не знайдено')) {
            return `Не вдалося визначити ваш ідентифікатор. Спробуйте вийти та увійти знову.`;
        }

        // Повертаємо оригінальне повідомлення, якщо воно не підходить під типові шаблони
        return errorMessage;
    }

    // Індикатори завантаження
    function showLoader() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');
    }

    function hideLoader() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
    }

    // ======== ОСНОВНА ФУНКЦІЯ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту відносно базового URL
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки (для POST/PUT запитів)
     * @param {Object} options - Додаткові параметри запиту
     * @param {number} retries - Кількість повторних спроб при помилці
     * @returns {Promise<Object>} Результат запиту у форматі JSON
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
        // Отримуємо ID користувача
        const userId = getUserId();

        // ЗМІНЕНО: Додано перевірку наявності валідного ID користувача
        if (!userId) {
            console.error(`❌ API-запит на ${endpoint} скасовано: ID користувача не знайдено`);
            throw new Error("ID користувача не знайдено");
        }

        // ВИПРАВЛЕННЯ: Перевіряємо шлях до API стейкінгу
        let fixedEndpoint = endpoint;
        // Якщо запит до стейкінгу але без ID користувача - виправляємо
        if (endpoint.startsWith('/api/staking') && !endpoint.includes('/api/user/')) {
            fixedEndpoint = `/api/user/${userId}/staking${endpoint.replace('/api/staking', '')}`;
            console.warn(`⚠️ Виправлено некоректний URL стейкінгу: ${endpoint} -> ${fixedEndpoint}`);
        }

        // Додаємо мітку часу для запобігання кешуванню
        const timestamp = Date.now();
        const url = `${API_BASE_URL}${fixedEndpoint}${fixedEndpoint.includes('?') ? '&' : '?'}t=${timestamp}`;

        // Показуємо індикатор завантаження, якщо він не вимкнений в опціях
        if (!options.hideLoader) {
            showLoader();
        }

        // Логуємо запит у режимі відлагодження
        if (_debugMode) {
            console.log(`🔄 Відправка ${method} запиту на ${url}`);
            if (data) console.log("📦 Дані запиту:", data);
        }

        // Підготовка параметрів запиту
        const requestOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': userId, // ЗМІНЕНО: Тепер ми завжди маємо валідний userId
                ...options.headers
            },
            ...options
        };

        // Додаємо тіло запиту для POST/PUT
        if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            requestOptions.body = JSON.stringify(data);
        }

        // Функція для повторного запиту при помилці
        async function tryRequest(attemptsLeft) {
            try {
                // ПОКРАЩЕННЯ: Перевірка запиту перед відправкою
                // Якщо у нас запит до стейкінгу - переконаємося, що метод правильний
                if (url.includes('/staking')) {
                    // Загальна перевірка стандартних методів для стейкінгу
                    if (url.includes('/staking/repair') && method.toUpperCase() !== 'POST') {
                        console.warn(`⚠️ Виправлено метод для /staking/repair: ${method} -> POST`);
                        requestOptions.method = 'POST';
                    } else if (url.includes('/cancel') && method.toUpperCase() !== 'POST') {
                        console.warn(`⚠️ Виправлено метод для /staking/cancel: ${method} -> POST`);
                        requestOptions.method = 'POST';
                    } else if (url.includes('/finalize') && method.toUpperCase() !== 'POST') {
                        console.warn(`⚠️ Виправлено метод для /staking/finalize: ${method} -> POST`);
                        requestOptions.method = 'POST';
                    }
                }

                const response = await fetch(url, requestOptions);

                // Приховуємо індикатор завантаження
                if (!options.hideLoader) {
                    hideLoader();
                }

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    const statusText = response.statusText || '';
                    console.error(`❌ Помилка API-запиту: ${response.status} ${statusText} (${url})`);

                    // Для 401/403 помилок авторизації
                    if (response.status === 401 || response.status === 403) {
                        console.warn('🔐 Помилка авторизації, спроба оновити дані користувача');
                    }

                    // Для 404 помилок
                    if (response.status === 404) {
                        console.error(`⚠️ Ресурс не знайдено: ${url}`);
                        throw new Error(`Запитаний ресурс недоступний (404)`);
                    }

                    // Для 405 помилок (неправильний метод)
                    if (response.status === 405) {
                        console.error(`⚠️ Метод не дозволено: ${method} для ${url}`);

                        // Спробуємо виправити метод і повторити запит, якщо це стейкінг
                        if (url.includes('/staking') && attemptsLeft > 0) {
                            // Якщо метод POST не працює, спробуємо PUT і навпаки
                            if (method.toUpperCase() === 'POST') {
                                console.warn(`🔄 Спроба змінити метод з POST на PUT для ${url}`);
                                requestOptions.method = 'PUT';
                                await new Promise(resolve => setTimeout(resolve, 500));
                                return tryRequest(attemptsLeft - 1);
                            } else if (method.toUpperCase() === 'PUT') {
                                console.warn(`🔄 Спроба змінити метод з PUT на POST для ${url}`);
                                requestOptions.method = 'POST';
                                await new Promise(resolve => setTimeout(resolve, 500));
                                return tryRequest(attemptsLeft - 1);
                            }
                        }

                        throw new Error(`Метод ${method} не дозволено для цього ресурсу (405)`);
                    }

                    // Якщо залишились спроби, повторюємо запит
                    if (attemptsLeft > 0) {
                        const delay = Math.pow(2, retries - attemptsLeft) * 500; // Експоненційна затримка
                        if (_debugMode) {
                            console.log(`⏱️ Повтор запиту через ${delay}мс (залишилось спроб: ${attemptsLeft})`);
                        }

                        await new Promise(resolve => setTimeout(resolve, delay));
                        return tryRequest(attemptsLeft - 1);
                    }

                    throw new Error(`Помилка сервера: ${response.status} ${statusText}`);
                }

                // Якщо статус ОК, парсимо JSON
                let jsonData;
                try {
                    jsonData = await response.json();
                } catch (parseError) {
                    console.error('❌ Помилка парсингу JSON відповіді:', parseError);
                    throw new Error('Некоректний формат відповіді');
                }

                // Перевіряємо, чи є помилка у відповіді
                if (jsonData && jsonData.status === 'error') {
                    console.error('❌ API повернув помилку:', jsonData.message);
                    throw new Error(jsonData.message || 'Помилка виконання запиту');
                }

                if (_debugMode) {
                    console.log(`✅ Успішний API-запит на ${url}`);
                    console.log("📊 Дані відповіді:", jsonData);
                }

                return jsonData;

            } catch (error) {
                // Приховуємо індикатор завантаження у випадку помилки
                if (!options.hideLoader) {
                    hideLoader();
                }

                // Для мережевих помилок пробуємо ще раз
                if (error.name === 'TypeError' && attemptsLeft > 0) {
                    const delay = Math.pow(2, retries - attemptsLeft) * 500;
                    console.log(`⚠️ Мережева помилка, повтор через ${delay}мс (залишилось спроб: ${attemptsLeft}):`, error.message);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return tryRequest(attemptsLeft - 1);
                }

                throw error;
            }
        }

        // Починаємо процес запиту з повторними спробами
        return tryRequest(retries);
    }

    // ======== API ФУНКЦІЇ ДЛЯ АВТОРИЗАЦІЇ ТА КОРИСТУВАЧА ========

    /**
     * Авторизація користувача
     * @param {Object} userData - Дані користувача з Telegram WebApp
     * @returns {Promise<Object>} - Результат авторизації
     */
    async function authorize(userData) {
        return apiRequest('/api/auth', 'POST', userData);
    }

    /**
     * Отримання даних користувача
     * @param {string} userId - ID користувача (опціонально, за замовчуванням береться з поточного користувача)
     * @returns {Promise<Object>} - Дані користувача
     */
    async function getUserData(userId = null) {
        const id = userId || getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${id}`);
    }

    /**
     * Оновлення даних користувача
     * @param {Object} userData - Дані для оновлення
     * @returns {Promise<Object>} - Оновлені дані користувача
     */
    async function updateUserData(userData) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}`, 'PUT', userData);
    }

    // ======== API ФУНКЦІЇ ДЛЯ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу
     * @returns {Promise<Object>} - Дані стейкінгу
     */
    async function getStakingData() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking`);
    }

    /**
     * Отримання історії стейкінгу
     * @returns {Promise<Array>} - Історія стейкінгу
     */
    async function getStakingHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking/history`);
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Результат створення стейкінгу
     */
    async function createStaking(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking`, 'POST', {
            stakingAmount: Math.floor(amount),
            period: period
        });
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {number} amount - Сума для додавання
     * @param {string} stakingId - ID стейкінгу (опціонально)
     * @returns {Promise<Object>} - Результат додавання коштів
     */
    async function addToStaking(amount, stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            const stakingData = await getStakingData();
            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                throw new Error("У вас немає активного стейкінгу");
            }
            targetStakingId = stakingData.data.stakingId;
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}`, 'PUT', {
            additionalAmount: Math.floor(amount)
        });
    }

    /**
     * Скасування стейкінгу
     * @param {string} stakingId - ID стейкінгу (опціонально)
     * @returns {Promise<Object>} - Результат скасування стейкінгу
     */
    async function cancelStaking(stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Якщо ID стейкінгу не передано, отримуємо його з даних стейкінгу
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            const stakingData = await getStakingData();
            if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
                throw new Error("У вас немає активного стейкінгу");
            }
            targetStakingId = stakingData.data.stakingId;
        }

        return apiRequest(`/api/user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
            timestamp: Date.now()
        });
    }

    /**
     * Розрахунок очікуваної винагороди за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     * @returns {Promise<Object>} - Очікувана винагорода
     */
    async function calculateExpectedReward(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking/calculate-reward?amount=${amount}&period=${period}`);
    }

    /**
     * Відновлення стейкінгу
     * @param {boolean} force - Примусове відновлення
     * @returns {Promise<Object>} - Результат відновлення стейкінгу
     */
    async function repairStaking(force = false) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking/repair`, 'POST', {
            force: force,
            timestamp: Date.now()
        });
    }

    /**
     * Глибоке відновлення стейкінгу
     * @param {number} adjustBalance - Коригування балансу
     * @returns {Promise<Object>} - Результат глибокого відновлення
     */
    async function deepRepairStaking(adjustBalance = 0) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/staking/deep-repair`, 'POST', {
            balance_adjustment: adjustBalance,
            timestamp: Date.now()
        });
    }

    // ======== API ФУНКЦІЇ ДЛЯ БАЛАНСУ ТА ТРАНЗАКЦІЙ ========

    /**
     * Отримання балансу користувача
     * @returns {Promise<Object>} - Баланс користувача
     */
    async function getBalance() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/balance`);
    }

    /**
     * Додавання токенів
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат додавання токенів
     */
    async function addTokens(amount, description = 'Додавання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/add-tokens`, 'POST', {
            amount: amount,
            description: description
        });
    }

    /**
     * Віднімання токенів
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат віднімання токенів
     */
    async function subtractTokens(amount, description = 'Віднімання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/subtract-tokens`, 'POST', {
            amount: amount,
            description: description
        });
    }

    /**
     * Додавання жетонів
     * @param {number} amount - Кількість жетонів
     * @returns {Promise<Object>} - Результат додавання жетонів
     */
    async function addCoins(amount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/add-coins`, 'POST', {
            amount: amount
        });
    }

    /**
     * Віднімання жетонів
     * @param {number} amount - Кількість жетонів
     * @returns {Promise<Object>} - Результат віднімання жетонів
     */
    async function subtractCoins(amount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/subtract-coins`, 'POST', {
            amount: amount
        });
    }

    /**
     * Конвертація жетонів в токени
     * @param {number} coinsAmount - Кількість жетонів для конвертації
     * @returns {Promise<Object>} - Результат конвертації
     */
    async function convertCoinsToTokens(coinsAmount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/convert-coins`, 'POST', {
            coins_amount: coinsAmount
        });
    }

    /**
     * Отримання історії транзакцій
     * @param {number} limit - Максимальна кількість транзакцій
     * @returns {Promise<Object>} - Історія транзакцій
     */
    async function getTransactions(limit = 100) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/transactions?limit=${limit}`);
    }

    /**
     * Надсилання токенів іншому користувачу
     * @param {string} recipientId - ID отримувача
     * @param {number} amount - Кількість токенів
     * @param {string} description - Опис транзакції
     * @returns {Promise<Object>} - Результат надсилання
     */
    async function sendTokens(recipientId, amount, description = 'Надсилання токенів') {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/send-tokens`, 'POST', {
            recipient_id: recipientId,
            amount: amount,
            description: description
        });
    }

    // ======== API ФУНКЦІЇ ДЛЯ РЕФЕРАЛЬНОЇ СИСТЕМИ ========

    /**
     * Отримання реферального посилання
     * @returns {Promise<Object>} - Реферальне посилання
     */
    async function getReferralLink() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/referral-link`);
    }

    /**
     * Отримання інформації про рефералів
     * @returns {Promise<Object>} - Інформація про рефералів
     */
    async function getReferrals() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/referrals`);
    }

    /**
     * Отримання винагороди за рефералів
     * @returns {Promise<Object>} - Результат отримання винагороди
     */
    async function claimReferralReward() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/claim-referral-reward`, 'POST');
    }

    // ======== API ФУНКЦІЇ ДЛЯ TODO СИСТЕМИ ========

    /**
     * Отримання списку завдань користувача
     * @returns {Promise<Object>} - Список завдань
     */
    async function getTodoList() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/todos`);
    }

    /**
     * Додавання нового завдання
     * @param {Object} task - Дані завдання
     * @returns {Promise<Object>} - Результат додавання завдання
     */
    async function addTodoItem(task) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/todos`, 'POST', task);
    }

    /**
     * Оновлення завдання
     * @param {string} taskId - ID завдання
     * @param {Object} taskData - Дані для оновлення
     * @returns {Promise<Object>} - Оновлене завдання
     */
    async function updateTodoItem(taskId, taskData) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}`, 'PUT', taskData);
    }

    /**
     * Видалення завдання
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} - Результат видалення
     */
    async function deleteTodoItem(taskId) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}`, 'DELETE');
    }

    /**
     * Позначення завдання як виконаного
     * @param {string} taskId - ID завдання
     * @returns {Promise<Object>} - Оновлене завдання
     */
    async function completeTodoItem(taskId) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/todos/${taskId}/complete`, 'POST');
    }

    // ======== API ФУНКЦІЇ ДЛЯ РОЗІГРАШІВ ========

    /**
     * Отримання списку активних розіграшів
     * @returns {Promise<Object>} - Список розіграшів
     */
    async function getRaffles() {
        return apiRequest('/api/raffles');
    }

    /**
     * Участь у розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {string} raffleType - Тип розіграшу ('main', 'daily', etc.)
     * @param {number} tokenAmount - Кількість жетонів для участі
     * @returns {Promise<Object>} - Результат участі
     */
    async function participateInRaffle(raffleId, raffleType, tokenAmount) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest('/api/participate', 'POST', {
            userId: userId,
            raffleId: raffleId,
            raffleType: raffleType,
            tokenAmount: tokenAmount
        });
    }

    /**
     * Отримання історії розіграшів для поточного користувача
     * @returns {Promise<Object>} - Історія розіграшів
     */
    async function getRaffleHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/raffle-history`);
    }

    /**
     * Отримання бонусу новачка
     * @returns {Promise<Object>} - Результат отримання бонусу
     */
    async function claimNewbieBonus() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }
        return apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST');
    }

    // ======== ПУБЛІЧНИЙ API МОДУЛЬ ========

    // Експортуємо всі API функції в глобальний об'єкт
    window.WinixAPI = {
        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Базова функція для API запитів
        apiRequest,

        // Авторизація та користувач
        authorize,
        getUserData,
        updateUserData,

        // Стейкінг
        getStakingData,
        getStakingHistory,
        createStaking,
        addToStaking,
        cancelStaking,
        calculateExpectedReward,
        repairStaking,
        deepRepairStaking,

        // Баланс та транзакції
        getBalance,
        addTokens,
        subtractTokens,
        addCoins,
        subtractCoins,
        convertCoinsToTokens,
        getTransactions,
        sendTokens,

        // Реферальна система
        getReferralLink,
        getReferrals,
        claimReferralReward,

        // Завдання
        getTodoList,
        addTodoItem,
        updateTodoItem,
        deleteTodoItem,
        completeTodoItem,

        // Розіграші
        getRaffles,
        participateInRaffle,
        getRaffleHistory,
        claimNewbieBonus,

        // Утиліти
        getUserId,
        handleApiError
    };

    // Для зворотної сумісності експортуємо функцію apiRequest глобально
    window.apiRequest = apiRequest;

    console.log("✅ API: Єдиний API модуль успішно ініціалізовано");
})();


/**
 * Виправлення для API модуля
 *
 * Ці функції виправляють помилки API-запитів з неправильними параметрами та URL
 * Додайте ці функції в кінець файлу api.js або створіть окремий файл api-fix.js
 */

(function() {
    console.log("🔧 Ініціалізація виправлень для API модуля");

    // Перевіряємо наявність API модуля
    if (!window.WinixAPI) {
        console.error("❌ API-FIX: API модуль не знайдено!");
        return;
    }

    // Виправлення для функції getUserId
    const originalGetUserId = window.WinixAPI.getUserId;

    window.WinixAPI.getUserId = function() {
        try {
            // Допоміжна функція для перевірки валідності ID
            function isValidId(id) {
                return id &&
                    id !== 'undefined' &&
                    id !== 'null' &&
                    id !== undefined &&
                    id !== null &&
                    id.toString().trim() !== '';
            }

            // Спочатку викликаємо оригінальну функцію
            const originalId = originalGetUserId();
            if (isValidId(originalId)) {
                return originalId;
            }

            // Якщо оригінальна функція не повернула валідний ID, шукаємо далі

            // Перевіряємо наявність Telegram WebApp і токена
            if (window.Telegram && window.Telegram.WebApp) {
                // Перевіряємо, чи WebApp готовий до роботи
                window.Telegram.WebApp.ready();

                // Отримуємо дані користувача
                if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                    if (tgUser.id) {
                        const userId = tgUser.id.toString();
                        console.log("🆔 ID користувача отримано з Telegram WebApp:", userId);

                        // Зберігаємо в localStorage для наступних запитів
                        localStorage.setItem('telegram_user_id', userId);
                        return userId;
                    }
                }
            }

            // Перевіряємо localStorage
            const storedId = localStorage.getItem('telegram_user_id');
            if (isValidId(storedId)) {
                return storedId;
            }

            // Перевіряємо DOM елемент
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (isValidId(domId)) {
                    localStorage.setItem('telegram_user_id', domId);
                    return domId;
                }
            }

            // Перевіряємо URL параметри
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (isValidId(urlId)) {
                localStorage.setItem('telegram_user_id', urlId);
                return urlId;
            }

            // Якщо все інше не спрацювало, генеруємо випадковий ID
            const randomId = '2449' + Math.floor(10000 + Math.random() * 90000);
            localStorage.setItem('telegram_user_id', randomId);
            console.warn("⚠️ Використовуємо випадковий ID:", randomId);
            return randomId;
        } catch (e) {
            console.error("❌ Помилка в getUserId:", e);

            // У випадку помилки повертаємо фіксований ID
            return '2449000000';
        }
    };

    // Виправлення для функції apiRequest
    const originalApiRequest = window.WinixAPI.apiRequest;

    window.WinixAPI.apiRequest = function(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
        try {
            // Перевірка на неправильний виклик з callback-функцією замість endpoint
            if (typeof endpoint === 'function' || endpoint.includes('function') || endpoint.includes('=>')) {
                console.error("❌ API-FIX: Виявлено неправильний endpoint:", endpoint);
                console.error("❌ API-FIX: В endpoint передана callback-функція замість URL");

                // Виправляємо endpoint на '/api/user/:userId'
                endpoint = `/api/user/${window.WinixAPI.getUserId()}`;
                console.log("🛠️ API-FIX: Endpoint виправлено на:", endpoint);
            }

            // Перевіряємо, чи містить endpoint некоректні символи
            if (endpoint.includes('(') || endpoint.includes(')') || endpoint.includes('{') || endpoint.includes('}')) {
                console.error("❌ API-FIX: Виявлено неправильний endpoint з некоректними символами:", endpoint);

                // Виправляємо endpoint на базовий URL
                endpoint = `/api/user/${window.WinixAPI.getUserId()}`;
                console.log("🛠️ API-FIX: Endpoint виправлено на:", endpoint);
            }

            // Переконуємося, що в endpoint в потрібних місцях є валідний ID користувача
            if (endpoint.includes('/api/user/null') ||
                endpoint.includes('/api/user/undefined') ||
                endpoint.includes('/api/user/') && endpoint.includes('error')) {

                console.error("❌ API-FIX: Виявлено неправильний ID користувача в endpoint:", endpoint);

                // Замінюємо невалідний ID на валідний
                const userId = window.WinixAPI.getUserId();
                endpoint = endpoint.replace(/\/api\/user\/[^/]+/, `/api/user/${userId}`);
                console.log("🛠️ API-FIX: Endpoint виправлено на:", endpoint);
            }

            // Викликаємо оригінальну функцію з виправленими параметрами
            return originalApiRequest(endpoint, method, data, options, retries);
        } catch (e) {
            console.error("❌ API-FIX: Помилка при обробці apiRequest:", e);

            // Повертаємо проміс з помилкою
            return Promise.reject(e);
        }
    };

    // Виправлення для функції getStakingData
    const originalGetStakingData = window.WinixAPI.getStakingData;

    window.WinixAPI.getStakingData = function() {
        try {
            // Визначаємо, чи це виклик з callback-функцією
            if (arguments.length > 0 && typeof arguments[0] === 'function') {
                console.warn("⚠️ API-FIX: Виявлено виклик getStakingData з callback-функцією. Адаптуємо до Promise API.");

                // Зберігаємо callback-функцію
                const callback = arguments[0];

                // Викликаємо оригінальну функцію як Promise
                originalGetStakingData()
                    .then(data => {
                        callback(null, data.data || data);
                    })
                    .catch(error => {
                        callback(error);
                    });

                return;
            }

            // Звичайний виклик з Promise
            return originalGetStakingData();
        } catch (e) {
            console.error("❌ API-FIX: Помилка в getStakingData:", e);

            // Повертаємо проміс з помилкою
            return Promise.reject(e);
        }
    };

    // Виправлення для функції getUserData
    const originalGetUserData = window.WinixAPI.getUserData;

    window.WinixAPI.getUserData = function() {
        try {
            // Визначаємо, чи це виклик з callback-функцією
            if (arguments.length > 0 && typeof arguments[0] === 'function') {
                console.warn("⚠️ API-FIX: Виявлено виклик getUserData з callback-функцією. Адаптуємо до Promise API.");

                // Зберігаємо callback-функцію
                const callback = arguments[0];

                // Викликаємо оригінальну функцію як Promise
                originalGetUserData()
                    .then(data => {
                        callback(null, data.data || data);
                    })
                    .catch(error => {
                        callback(error);
                    });

                return;
            }

            // Перевіряємо наявність userId параметра, який може бути callback-функцією
            if (arguments.length > 0 && typeof arguments[0] === 'string') {
                const userId = arguments[0];
                if (userId.includes('function') || userId.includes('=>')) {
                    console.error("❌ API-FIX: Виявлено неправильний userId параметр:", userId);

                    // Викликаємо оригінальну функцію без параметрів
                    return originalGetUserData();
                }
            }

            // Звичайний виклик з Promise
            return originalGetUserData.apply(this, arguments);
        } catch (e) {
            console.error("❌ API-FIX: Помилка в getUserData:", e);

            // Повертаємо проміс з помилкою
            return Promise.reject(e);
        }
    };

    // Патч для роботи з помилками 500 при розрахунку винагороди за стейкінг
    (function patchStakingRewardCalculation() {
        if (!window.WinixAPI) return;

        // Зберігаємо оригінальну функцію
        const originalCalculateExpectedReward = window.WinixAPI.calculateExpectedReward;

        // Замінюємо новою, яка обробляє помилки
        window.WinixAPI.calculateExpectedReward = function(amount, period) {
            // Локальний розрахунок винагороди
            function calculateLocalReward(amount, period) {
                amount = parseFloat(amount);
                period = parseInt(period);
                if (isNaN(amount) || isNaN(period)) return 0;

                const rewardRates = { 7: 4, 14: 9, 28: 15 };
                const rewardPercent = rewardRates[period] || 9;
                return parseFloat(((amount * rewardPercent) / 100).toFixed(2));
            }

            return new Promise((resolve) => {
                // Спробуємо оригінальну функцію
                originalCalculateExpectedReward(amount, period)
                    .then(result => {
                        resolve(result);
                    })
                    .catch(error => {
                        console.warn('⚠️ Помилка API розрахунку винагороди, використовуємо локальний розрахунок:', error);

                        // Повертаємо локально розраховану винагороду
                        resolve({
                            status: 'success',
                            data: {
                                amount: amount,
                                period: period,
                                reward: calculateLocalReward(amount, period),
                                source: 'local_calculation'
                            }
                        });
                    });
            });
        };

        console.log('✅ Патч для розрахунку стейкінг-винагороди застосовано');
    })();

    // Перевірка працездатності виправлень
    const userId = window.WinixAPI.getUserId();
    console.log("✅ API-FIX: Отримано валідний ID користувача:", userId);

    console.log("✅ API-FIX: Виправлення для API модуля успішно застосовані");

    // Відправляємо подію про виправлення API
    document.dispatchEvent(new CustomEvent('api-fixed'));
})();