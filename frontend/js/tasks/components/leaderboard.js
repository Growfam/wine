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
        ERROR: 'earn.leaderboard.error'
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

                    if (response && response.success && response.data) {
                        leaderboardData = response.data;
                        // Кешуємо отримані дані
                        cacheLeaderboardData();
                        renderLeaderboard();
                        return leaderboardData;
                    } else {
                        console.warn('API повернув неочікувану відповідь:', response);
                    }
                } catch (apiError) {
                    console.error('Помилка запиту до API лідерської дошки:', apiError);
                }
            }

            // Якщо дані вже були завантажені з кешу, не показуємо заглушку
            if (leaderboardData.length > 0) {
                renderLeaderboard();
                return leaderboardData;
            }

            // Якщо не вдалося отримати дані з API або кешу, використовуємо моковані дані
            const mockData = getMockLeaderboardData();
            leaderboardData = mockData;
            renderLeaderboard();

            return leaderboardData;
        } catch (error) {
            console.error('Помилка завантаження лідерської дошки:', error);

            // У випадку помилки відображаємо заглушку
            showFallbackLeaderboard();

            return [];
        } finally {
            // Приховуємо індикатор завантаження
            hideLoadingIndicator();
            isLoading = false;
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
     * Функція для отримання мокованих даних
     */
    function getMockLeaderboardData() {
        // Генеруємо ID поточного користувача, якщо його немає
        if (!currentUserId) {
            currentUserId = "7066583465";
        }

        // Базовий набір даних
        const mockUsers = [
            { id: "9876543210", username: "CryptoWhale", referrals_count: 153, reward: 7650 },
            { id: "8765432109", username: "TokenMaster", referrals_count: 129, reward: 6450 },
            { id: "7654321098", username: "BlockchainGuru", referrals_count: 112, reward: 5600 },
            { id: "6543210987", username: "CoinHunter", referrals_count: 98, reward: 4900 },
            { id: "5432109876", username: "SatoshiFan", referrals_count: 87, reward: 4350 },
            { id: "4321098765", username: "CryptoKing", referrals_count: 76, reward: 3800 },
            { id: "3210987654", username: "TokenExplorer", referrals_count: 65, reward: 3250 },
            { id: "2109876543", username: "WinixLover", referrals_count: 54, reward: 2700 },
            { id: "1098765432", username: "CryptoNinja", referrals_count: 43, reward: 2150 },
            { id: "1234567890", username: "BlockGenius", referrals_count: 32, reward: 1600 }
        ];

        // Перевіряємо, чи є поточний користувач у списку
        const hasCurrentUser = mockUsers.some(user => user.id === currentUserId);

        // Якщо поточного користувача немає у ТОП-10, додаємо його з випадковою позицією нижче 10
        if (!hasCurrentUser && currentUserId) {
            // Створюємо запис для поточного користувача
            const currentUserEntry = {
                id: currentUserId,
                username: "Ви",
                referrals_count: Math.floor(Math.random() * 30) + 1, // 1-30 рефералів
                reward: Math.floor(Math.random() * 30) * 50, // винагорода
                position: Math.floor(Math.random() * 40) + 11 // позиція 11-50
            };

            // Додаємо до набору даних
            mockUsers.push(currentUserEntry);
        }

        return mockUsers;
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

        // Якщо немає даних, показуємо заглушку
        if (!leaderboardData || leaderboardData.length === 0) {
            showFallbackLeaderboard();
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
     * Відображення заглушки для лідерської дошки
     */
    function showFallbackLeaderboard() {
        if (!leaderboardContainer) return;

        // Очищаємо контейнер
        leaderboardContainer.innerHTML = '';

        // Створюємо заглушку
        const fallbackElement = document.createElement('div');
        fallbackElement.className = 'leaderboard-fallback';

        // Отримуємо локалізований текст
        const fallbackText = getLocalizedText(
            LOCALE_KEYS.FALLBACK,
            'Дані лідерської дошки тимчасово недоступні. Спробуйте пізніше.'
        );

        fallbackElement.textContent = fallbackText;

        // Додаємо кнопку повторної спроби
        const retryButton = document.createElement('button');
        retryButton.className = 'retry-button';
        retryButton.textContent = getLocalizedText(LOCALE_KEYS.RETRY, 'Спробувати знову');
        retryButton.addEventListener('click', function() {
            loadLeaderboardData();
        });

        fallbackElement.appendChild(retryButton);

        // Додаємо до контейнера
        leaderboardContainer.appendChild(fallbackElement);
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