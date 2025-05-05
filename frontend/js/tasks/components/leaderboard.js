/**
 * Leaderboard - оптимізований компонент для відображення таблиці лідерів
 * Відповідає за:
 * - Завантаження даних лідерської дошки
 * - Відображення ТОП користувачів
 * - Підсвічування поточного користувача
 * - Адаптивне відображення на різних пристроях
 * - Локалізацію текстів
 */

window.Leaderboard = (function() {
    // Приватні змінні модуля
    let leaderboardData = [];
    let currentUserId = null;
    let currentLanguage = 'uk';
    let isLoading = false;
    let lastError = null;

    // DOM-елементи
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const leaderboardTitle = document.getElementById('leaderboard-title');

    // Ключі локалізації
    const LOCALE_KEYS = {
        TITLE: 'earn.leaderboard.title',
        YOU: 'earn.leaderboard.you',
        REFERRALS_COUNT: 'earn.leaderboard.referrals_count',
        FALLBACK: 'earn.leaderboard.fallback',
        LOADING: 'earn.leaderboard.loading',
        POSITION: 'earn.leaderboard.position',
        USER: 'earn.leaderboard.user',
        REFERRALS: 'earn.leaderboard.referrals',
        REWARD: 'earn.leaderboard.reward',
        RETRY: 'earn.leaderboard.retry',
        ERROR: 'earn.leaderboard.error',
        NO_DATA: 'earn.leaderboard.no_data',
        CONNECTION_ERROR: 'earn.leaderboard.connection_error'
    };

    /**
     * Ініціалізація модуля лідерської дошки
     */
    function init() {
        console.log('Ініціалізація Leaderboard...');

        // Отримуємо поточну мову
        currentLanguage = getCurrentLanguage();

        // Отримуємо ID поточного користувача
        currentUserId = getUserId();

        // Додаємо клас до контейнера для стилізації
        if (leaderboardContainer) {
            leaderboardContainer.classList.add('leaderboard-container');
        }

        // Оновлюємо заголовок з локалізацією
        updateLeaderboardTitle();

        // Завантажуємо дані лідерської дошки
        loadLeaderboardData();

        // Підписуємося на події зміни мови для оновлення текстів
        document.addEventListener('language-changed', function(event) {
            if (event.detail && event.detail.language) {
                currentLanguage = event.detail.language;
                updateLeaderboardTitle();
                renderLeaderboard();
            }
        });

        // Підписуємося на події зміни розміру вікна для адаптивності
        window.addEventListener('resize', debounce(function() {
            adjustLeaderboardForDevice();
        }, 300));

        // Початкове налаштування для поточного пристрою
        adjustLeaderboardForDevice();
    }

    /**
     * Оновлення заголовка лідерської дошки
     */
    function updateLeaderboardTitle() {
        if (leaderboardTitle) {
            leaderboardTitle.textContent = getLocalizedText(
                LOCALE_KEYS.TITLE,
                'Лідери запрошень'
            );
        }
    }

    /**
     * Отримання поточної мови
     */
    function getCurrentLanguage() {
        if (window.WinixLanguage && window.WinixLanguage.getCurrentLanguage) {
            return window.WinixLanguage.getCurrentLanguage();
        }
        // Отримуємо зі сховища, якщо доступно
        if (window.StorageUtils) {
            const storedLang = window.StorageUtils.getItem('language');
            if (storedLang) return storedLang;
        }
        return 'uk';
    }

    /**
     * Отримання локалізованого тексту
     * @param {string} key - Ключ локалізації
     * @param {string} defaultText - Текст за замовчуванням
     * @param {Object} params - Параметри для підстановки
     * @returns {string} - Локалізований текст
     */
    function getLocalizedText(key, defaultText, params = {}) {
        try {
            if (window.WinixLanguage && typeof window.WinixLanguage.get === 'function') {
                const localizedText = window.WinixLanguage.get(key, params);
                return localizedText || defaultText;
            }
            return defaultText;
        } catch (e) {
            console.warn(`Локалізація недоступна для ключа ${key}:`, e);
            return defaultText;
        }
    }

    /**
     * Функція для затримки виконання (debounce)
     * @param {Function} func - Функція для виконання
     * @param {number} wait - Час затримки в мс
     * @returns {Function} - Функція з затримкою
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, wait);
        };
    }

    /**
     * Налаштування відображення для різних пристроїв
     */
    function adjustLeaderboardForDevice() {
        if (!leaderboardContainer) return;

        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            leaderboardContainer.classList.add('mobile-view');
            leaderboardContainer.classList.remove('desktop-view');
        } else {
            leaderboardContainer.classList.add('desktop-view');
            leaderboardContainer.classList.remove('mobile-view');
        }

        // Перемальовуємо таблицю лідерів з урахуванням нового класу
        renderLeaderboard();
    }

    /**
     * Отримання ID поточного користувача
     */
    function getUserId() {
        // Спочатку перевіряємо WinixAPI
        if (window.WinixAPI && window.WinixAPI.getUserId) {
            return window.WinixAPI.getUserId();
        }

        // Перевіряємо сховище
        if (window.StorageUtils) {
            const userId = window.StorageUtils.getItem('user_id') ||
                          window.StorageUtils.getItem('telegram_user_id');
            if (userId) return userId;
        }

        // Запасний варіант - отримання ID з DOM
        const userIdElement = document.getElementById('user-id');
        if (userIdElement) {
            return userIdElement.textContent;
        }

        // Запасний варіант - localStorage
        try {
            const userId = localStorage.getItem('winix_user_id') ||
                         localStorage.getItem('winix_telegram_user_id');
            if (userId) return userId;
        } catch (e) {
            console.warn('Помилка доступу до localStorage:', e);
        }

        return null;
    }

    /**
     * Завантаження даних лідерської дошки
     */
    async function loadLeaderboardData() {
        // Якщо завантаження вже відбувається, вийти
        if (isLoading) return;

        isLoading = true;
        lastError = null;

        // Показуємо індикатор завантаження
        showLoadingIndicator();

        try {
            // Спочатку перевіряємо кеш
            const cachedData = loadCachedLeaderboardData();
            if (cachedData) {
                leaderboardData = cachedData;
                renderLeaderboard();
            }

            // Перевіряємо наявність API
            if (window.API && typeof window.API.get === 'function') {
                try {
                    const response = await window.API.get('/leaderboard/referrals');

                    if (response && response.status === 'success' && response.data && response.data.leaderboard) {
                        leaderboardData = response.data.leaderboard;
                        // Кешуємо отримані дані
                        cacheLeaderboardData();
                        renderLeaderboard();
                        return leaderboardData;
                    } else {
                        console.warn('API повернув неочікувану відповідь:', response);
                        // Зберігаємо інформацію про помилку
                        lastError = {
                            code: 'INVALID_RESPONSE',
                            message: response?.message || 'Сервер повернув неочікувану відповідь',
                            response: response
                        };

                        // Якщо в кеші є дані, продовжуємо їх використовувати, але показуємо повідомлення
                        if (leaderboardData && leaderboardData.length > 0) {
                            renderLeaderboard();
                            showErrorMessage('Не вдалося оновити дані рейтингу. Показано збережені дані.');
                        } else {
                            // Якщо в кеші немає даних, показуємо помилку
                            showErrorView(lastError);
                        }
                    }
                } catch (apiError) {
                    console.error('Помилка запиту до API лідерської дошки:', apiError);
                    lastError = {
                        code: 'API_ERROR',
                        message: apiError.message || 'Не вдалося завантажити дані рейтингу',
                        originalError: apiError
                    };

                    // Якщо в кеші є дані, продовжуємо їх використовувати, але показуємо повідомлення
                    if (leaderboardData && leaderboardData.length > 0) {
                        renderLeaderboard();
                        showErrorMessage('Не вдалося оновити дані рейтингу. Показано збережені дані.');
                    } else {
                        // Якщо в кеші немає даних, показуємо помилку
                        showErrorView(lastError);
                    }
                }
            } else {
                // API недоступне
                lastError = {
                    code: 'API_UNAVAILABLE',
                    message: 'API недоступне',
                };

                // Якщо в кеші є дані, продовжуємо їх використовувати
                if (leaderboardData && leaderboardData.length > 0) {
                    renderLeaderboard();
                } else {
                    // Якщо в кеші немає даних, показуємо помилку
                    showErrorView(lastError);
                }
            }

            return leaderboardData;
        } catch (error) {
            console.error('Помилка завантаження лідерської дошки:', error);
            lastError = {
                code: 'UNEXPECTED_ERROR',
                message: error.message || 'Неочікувана помилка при завантаженні даних',
                originalError: error
            };

            // У випадку помилки відображаємо інтерфейс помилки
            showErrorView(lastError);

            return [];
        } finally {
            // Приховуємо індикатор завантаження
            hideLoadingIndicator();
            isLoading = false;
        }
    }

    /**
     * Відображення повідомлення про помилку
     * @param {string} message - Текст повідомлення
     */
    function showErrorMessage(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'warning');
        } else {
            // Запасний варіант, якщо функція showToast не доступна
            alert(message);
        }
    }

    /**
     * Збереження даних в кеш
     */
    function cacheLeaderboardData() {
        try {
            if (window.StorageUtils && leaderboardData && leaderboardData.length > 0) {
                window.StorageUtils.setItem('leaderboard_data', {
                    data: leaderboardData,
                    timestamp: Date.now(),
                    language: currentLanguage
                }, {
                    expires: 30 * 60 * 1000 // 30 хвилин
                });
            } else {
                // Запасний варіант - localStorage
                try {
                    localStorage.setItem('winix_leaderboard_data', JSON.stringify({
                        data: leaderboardData,
                        timestamp: Date.now(),
                        language: currentLanguage
                    }));
                } catch (e) {
                    console.warn('Помилка збереження в localStorage:', e);
                }
            }
        } catch (e) {
            console.warn('Не вдалося зберегти дані лідерської дошки в кеш:', e);
        }
    }

    /**
     * Завантаження даних з кешу
     */
    function loadCachedLeaderboardData() {
        try {
            // Спочатку перевіряємо StorageUtils
            if (window.StorageUtils) {
                const cachedData = window.StorageUtils.getItem('leaderboard_data');
                if (cachedData && cachedData.data && cachedData.timestamp) {
                    // Перевіряємо, чи не застаріли дані (не більше 30 хвилин)
                    const now = Date.now();
                    if (now - cachedData.timestamp < 30 * 60 * 1000) {
                        return cachedData.data;
                    }
                }
            }

            // Запасний варіант - localStorage
            try {
                const cachedDataStr = localStorage.getItem('winix_leaderboard_data');
                if (cachedDataStr) {
                    const cachedData = JSON.parse(cachedDataStr);
                    if (cachedData && cachedData.data && cachedData.timestamp) {
                        // Перевіряємо, чи не застаріли дані (не більше 30 хвилин)
                        const now = Date.now();
                        if (now - cachedData.timestamp < 30 * 60 * 1000) {
                            return cachedData.data;
                        }
                    }
                }
            } catch (e) {
                console.warn('Помилка читання з localStorage:', e);
            }
        } catch (e) {
            console.warn('Не вдалося завантажити кешовані дані лідерської дошки:', e);
        }
        return null;
    }

    /**
     * Показати індикатор завантаження
     */
    function showLoadingIndicator() {
        if (!leaderboardContainer) return;

        const existingIndicator = leaderboardContainer.querySelector('.loading-indicator');
        if (existingIndicator) return;

        // Очищаємо контейнер, якщо він порожній
        if (leaderboardContainer.children.length === 0) {
            // Створюємо індикатор завантаження
            const loadingElement = document.createElement('div');
            loadingElement.className = 'loading-indicator';
            loadingElement.innerHTML = `
                <div class="spinner"></div>
                <div class="loading-text">${getLocalizedText(LOCALE_KEYS.LOADING, 'Завантаження...')}</div>
            `;

            leaderboardContainer.appendChild(loadingElement);
        }
    }

    /**
     * Приховати індикатор завантаження
     */
    function hideLoadingIndicator() {
        if (!leaderboardContainer) return;

        const loadingIndicator = leaderboardContainer.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    /**
     * Форматування числа винагороди
     * @param {number} amount - Сума винагороди
     * @returns {string} - Відформатована сума
     */
    function formatReward(amount) {
        // Використовуємо Formatters, якщо доступний
        if (window.Formatters && window.Formatters.formatNumber) {
            return window.Formatters.formatNumber(amount, {
                decimals: 0,
                thousandsSeparator: ' '
            });
        }

        // Запасний варіант - просте форматування
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    /**
     * Форматування кількості рефералів
     * @param {number} count - Кількість рефералів
     * @returns {string} - Відформатована кількість
     */
    function formatReferralsCount(count) {
        // Використовуємо Formatters, якщо доступний
        if (window.Formatters && window.Formatters.formatNumber) {
            return window.Formatters.formatNumber(count, {
                decimals: 0,
                thousandsSeparator: ' '
            });
        }

        // Запасний варіант - просте форматування
        return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    /**
     * Відображення лідерської дошки
     */
    function renderLeaderboard() {
        if (!leaderboardContainer) return;

        // Очищаємо контейнер
        leaderboardContainer.innerHTML = '';

        // Якщо немає даних, показуємо повідомлення про відсутність даних
        if (!leaderboardData || leaderboardData.length === 0) {
            showNoDataView();
            return;
        }

        // Сортуємо за кількістю рефералів
        const sortedData = [...leaderboardData].sort((a, b) => b.referrals_count - a.referrals_count);

        // Визначаємо кількість користувачів для відображення (до 10)
        const displayCount = Math.min(sortedData.length, 10);
        const topUsers = sortedData.slice(0, displayCount);

        // Визначаємо, чи є поточний користувач у ТОП
        const currentUserInTop = topUsers.findIndex(user => user.id === currentUserId);

        // Додаємо роль aria-live для доступності
        leaderboardContainer.setAttribute('aria-live', 'polite');
        leaderboardContainer.setAttribute('role', 'region');
        leaderboardContainer.setAttribute('aria-label', getLocalizedText(LOCALE_KEYS.TITLE, 'Лідери запрошень'));

        // Створюємо заголовок таблиці (для десктопу)
        if (leaderboardContainer.classList.contains('desktop-view')) {
            const headerRow = document.createElement('div');
            headerRow.className = 'leaderboard-header';
            headerRow.setAttribute('role', 'row');

            // Додаємо колонки заголовка
            headerRow.innerHTML = `
                <div class="position-header" role="columnheader">${getLocalizedText(LOCALE_KEYS.POSITION, 'Місце')}</div>
                <div class="user-info-header" role="columnheader">${getLocalizedText(LOCALE_KEYS.USER, 'Користувач')}</div>
                <div class="referrals-header" role="columnheader">${getLocalizedText(LOCALE_KEYS.REFERRALS, 'Запрошення')}</div>
                <div class="reward-header" role="columnheader">${getLocalizedText(LOCALE_KEYS.REWARD, 'Винагорода')}</div>
            `;

            leaderboardContainer.appendChild(headerRow);
        }

        // Відображаємо кожного користувача зі списку
        topUsers.forEach((user, index) => {
            const position = index + 1;
            const isCurrentUser = user.id === currentUserId;

            // Створюємо елемент для користувача
            const userElement = createLeaderboardItem(user, position, isCurrentUser);

            // Додаємо до контейнера
            leaderboardContainer.appendChild(userElement);
        });

        // Якщо поточний користувач не входить у ТОП, але є в даних,
        // додаємо його окремим рядком в кінці таблиці
        if (currentUserInTop === -1 && currentUserId) {
            const currentUser = sortedData.find(user => user.id === currentUserId);

            if (currentUser) {
                // Визначаємо позицію поточного користувача
                const currentUserPosition = sortedData.findIndex(user => user.id === currentUserId) + 1;

                // Додаємо розділювач
                const divider = document.createElement('div');
                divider.className = 'leaderboard-divider';
                divider.textContent = '...';
                divider.setAttribute('aria-hidden', 'true');
                leaderboardContainer.appendChild(divider);

                // Створюємо елемент для поточного користувача
                const userElement = createLeaderboardItem(currentUser, currentUserPosition, true);

                // Додаємо до контейнера
                leaderboardContainer.appendChild(userElement);
            }
        }
    }

    /**
     * Створення елементу лідерської дошки для користувача
     */
    function createLeaderboardItem(user, position, isCurrentUser) {
        // Перевіряємо валідність користувача
        if (!user || !user.id) {
            console.warn('Отримано некоректні дані користувача');
            return document.createElement('div');
        }

        // Створюємо основний елемент
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.setAttribute('role', 'row');
        item.setAttribute('aria-label', `${isCurrentUser ? "Ви" : user.username}, місце ${position}`);

        // Перевіряємо, чи відображається мобільна версія
        const isMobile = leaderboardContainer.classList.contains('mobile-view');

        // Додаємо клас для поточного користувача
        if (isCurrentUser) {
            item.classList.add('current-user');
        }

        // Створюємо елемент позиції
        const positionElement = document.createElement('div');
        positionElement.className = 'position';
        positionElement.setAttribute('role', 'cell');

        // Додаємо клас для ТОП-3
        if (position <= 3) {
            positionElement.classList.add('top-' + position);

            // Додаємо відповідну іконку для топ-3
            const trophyIcon = document.createElement('span');
            trophyIcon.className = 'trophy-icon';

            if (position === 1) {
                trophyIcon.innerHTML = '🥇';
                trophyIcon.setAttribute('aria-label', 'перше місце');
            } else if (position === 2) {
                trophyIcon.innerHTML = '🥈';
                trophyIcon.setAttribute('aria-label', 'друге місце');
            } else if (position === 3) {
                trophyIcon.innerHTML = '🥉';
                trophyIcon.setAttribute('aria-label', 'третє місце');
            }

            positionElement.appendChild(trophyIcon);
        } else {
            positionElement.textContent = position;
        }

        // Створюємо елемент з інформацією про користувача
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.setAttribute('role', 'cell');

        // Додаємо ім'я користувача
        const username = document.createElement('div');
        username.className = 'username';
        username.textContent = isCurrentUser ? getLocalizedText(LOCALE_KEYS.YOU, 'Ви') : user.username;

        // Додаємо кількість рефералів
        const referralCount = document.createElement('div');
        referralCount.className = 'referral-count';

        // Форматуємо кількість рефералів
        const formattedCount = formatReferralsCount(user.referrals_count);

        // Отримуємо локалізований текст
        const referralsText = getLocalizedText(
            LOCALE_KEYS.REFERRALS_COUNT,
            `${formattedCount} запрошених`,
            { count: formattedCount }
        );

        referralCount.textContent = referralsText;

        // Додаємо інформацію про користувача
        userInfo.appendChild(username);

        // На мобільних пристроях показуємо менше інформації
        if (!isMobile || isCurrentUser) {
            userInfo.appendChild(referralCount);
        }

        // Створюємо елемент з винагородою
        const userReward = document.createElement('div');
        userReward.className = 'user-reward';
        userReward.setAttribute('role', 'cell');

        // Форматуємо винагороду
        const formattedReward = formatReward(user.reward);
        userReward.innerHTML = `<span class="reward-amount">${formattedReward}</span> <span class="reward-currency">$WINIX</span>`;

        // Збираємо все до купи
        item.appendChild(positionElement);
        item.appendChild(userInfo);
        item.appendChild(userReward);

        return item;
    }

    /**
     * Відображення екрану помилки
     * @param {Object} error - Об'єкт помилки
     */
    function showErrorView(error) {
        if (!leaderboardContainer) return;

        // Очищаємо контейнер
        leaderboardContainer.innerHTML = '';

        // Створюємо елемент помилки
        const errorContainer = document.createElement('div');
        errorContainer.className = 'leaderboard-error';

        // Додаємо іконку помилки
        const errorIcon = document.createElement('div');
        errorIcon.className = 'error-icon';
        errorIcon.innerHTML = '❌';
        errorContainer.appendChild(errorIcon);

        // Додаємо заголовок
        const errorTitle = document.createElement('h3');
        errorTitle.className = 'error-title';
        errorTitle.textContent = getLocalizedText(LOCALE_KEYS.ERROR, 'Помилка завантаження');
        errorContainer.appendChild(errorTitle);

        // Додаємо повідомлення про помилку
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error-message';
        errorMessage.textContent = getLocalizedText(
            LOCALE_KEYS.CONNECTION_ERROR,
            'Не вдалося завантажити дані лідерської дошки. Перевірте підключення до мережі та спробуйте ще раз.'
        );
        errorContainer.appendChild(errorMessage);

        // Додаємо технічну інформацію (для відлагодження)
        if (error && error.code) {
            const errorDetails = document.createElement('div');
            errorDetails.className = 'error-details';
            errorDetails.setAttribute('aria-hidden', 'true');
            errorDetails.textContent = `Код помилки: ${error.code}`;
            errorContainer.appendChild(errorDetails);
        }

        // Додаємо кнопку повторної спроби
        const retryButton = document.createElement('button');
        retryButton.className = 'retry-button';
        retryButton.textContent = getLocalizedText(LOCALE_KEYS.RETRY, 'Спробувати знову');
        retryButton.addEventListener('click', function() {
            loadLeaderboardData();
        });
        errorContainer.appendChild(retryButton);

        // Додаємо до контейнера
        leaderboardContainer.appendChild(errorContainer);
    }

    /**
     * Відображення екрану відсутності даних
     */
    function showNoDataView() {
    if (!leaderboardContainer) return;

    // Очищаємо контейнер
    leaderboardContainer.innerHTML = '';

    // Створюємо елемент відсутності даних
    const noDataContainer = document.createElement('div');
    noDataContainer.className = 'leaderboard-no-data';

    // Додаємо SVG-графік замість емодзі
    const noDataIcon = document.createElement('div');
    noDataIcon.className = 'no-data-icon';

    // Створюємо SVG графіка
    noDataIcon.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="30" width="6" height="10" rx="1" fill="#4CAF50" />
            <rect x="18" y="24" width="6" height="16" rx="1" fill="#2196F3" />
            <rect x="28" y="20" width="6" height="20" rx="1" fill="#9C27B0" />
            <path d="M8 8H40V40H8" stroke="#BBBBBB" stroke-width="2" stroke-linecap="round" />
        </svg>
    `;
    noDataContainer.appendChild(noDataIcon);

    // Додаємо повідомлення
    const noDataMessage = document.createElement('p');
    noDataMessage.className = 'no-data-message';
    noDataMessage.textContent = getLocalizedText(
        LOCALE_KEYS.NO_DATA,
        'Наразі немає даних для відображення. Станьте першим у рейтингу, запрошуючи друзів!'
    );
    noDataContainer.appendChild(noDataMessage);

    // Додаємо до контейнера
    leaderboardContainer.appendChild(noDataContainer);
}

    /**
     * Оновлення даних лідерської дошки
     */
    function refreshLeaderboard() {
        loadLeaderboardData();
    }

    // Публічний API модуля
    return {
        init,
        loadLeaderboardData,
        renderLeaderboard,
        refreshLeaderboard
    };
})();