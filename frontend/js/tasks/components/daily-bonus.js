/**
 * DailyBonus - оптимізований компонент для керування щоденним бонусом
 * Відповідає за:
 * - Відображення прогресу щоденних бонусів
 * - Обробку отримання бонусу
 * - Анімацію винагороди
 * - Локалізацію текстів
 * - Зберігання прогресу
 */

window.DailyBonus = (function() {
    // Приватні змінні модуля
    let bonusData = null;
    let currentDay = 0;
    let bonusAmount = 0;
    let currentLanguage = 'uk';

    // DOM-елементи
    const progressContainer = document.getElementById('daily-progress-container');
    const claimButton = document.getElementById('claim-daily');

    // Ключі локалізації
    const LOCALE_KEYS = {
        CLAIM_BUTTON: 'earn.bonus.claim',
        CLAIMED_BUTTON: 'earn.bonus.claimed',
        CLAIMING_BUTTON: 'earn.bonus.claiming',
        ERROR_MSG: 'earn.bonus.error',
        SUCCESS_MSG: 'earn.bonus.success',
        ALREADY_CLAIMED: 'earn.bonus.already_claimed',
        BONUS_TITLE: 'earn.bonus.title',
        DAYS_PROGRESS: 'earn.bonus.days_progress',
        DAY_LABEL: 'earn.bonus.day'
    };

    /**
     * Ініціалізація модуля щоденного бонусу
     */
    async function init() {
        console.log('Ініціалізація DailyBonus...');

        try {
            // Отримуємо поточну мову
            currentLanguage = getCurrentLanguage();

            // Підписуємося на зміну мови
            document.addEventListener('language-changed', function(event) {
                if (event.detail && event.detail.language) {
                    currentLanguage = event.detail.language;
                    updateBonusDisplay();
                }
            });

            await loadBonusData();
            renderBonusProgress();
            updateClaimButton();
            setupAutoRefresh();
        } catch (error) {
            console.error('Помилка ініціалізації щоденного бонусу:', error);
            showFallbackDisplay();
        }
    }

    /**
     * Оновлення відображення після зміни мови
     */
    function updateBonusDisplay() {
        renderBonusProgress();
        updateClaimButton();
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
     * Настройка автоматичного оновлення
     */
    function setupAutoRefresh() {
        // Перевіряємо стан бонусу раз на годину
        setInterval(async function() {
            try {
                await loadBonusData(true); // true - примусове оновлення
                renderBonusProgress();
                updateClaimButton();
            } catch (error) {
                console.warn('Помилка автоматичного оновлення бонусу:', error);
            }
        }, 60 * 60 * 1000);

        // Також перевіряємо при зміні дати (перехід через опівніч)
        const checkDateChange = () => {
            const now = new Date();
            const currentDate = now.toDateString();

            // Отримуємо останню перевірену дату зі сховища
            let lastCheckedDate;
            try {
                lastCheckedDate = localStorage.getItem('winix_last_bonus_check_date');
            } catch (e) {
                lastCheckedDate = null;
            }

            // Якщо дата змінилася, оновлюємо дані бонусу
            if (lastCheckedDate !== currentDate) {
                loadBonusData(true).then(() => {
                    renderBonusProgress();
                    updateClaimButton();

                    // Зберігаємо нову дату перевірки
                    try {
                        localStorage.setItem('winix_last_bonus_check_date', currentDate);
                    } catch (e) {
                        console.warn('Не вдалося зберегти дату перевірки:', e);
                    }
                });
            }
        };

        // Перевіряємо раз на хвилину, чи змінилася дата
        setInterval(checkDateChange, 60 * 1000);

        // І також перевіряємо одразу
        checkDateChange();
    }

    /**
     * Завантаження даних щоденного бонусу
     * @param {boolean} forceRefresh - Примусове оновлення з серверу
     */
    async function loadBonusData(forceRefresh = false) {
        try {
            // Якщо дані вже завантажені і не потрібне примусове оновлення
            if (bonusData && !forceRefresh) {
                return bonusData;
            }

            // Спроба завантажити кешовані дані
            const cachedData = loadCachedBonusData();
            if (cachedData && !forceRefresh) {
                bonusData = cachedData;
                currentDay = bonusData.current_day || 1;
                bonusAmount = getBonusAmount(currentDay);
                return bonusData;
            }

            // Тестові дані, які використовуються як запасний варіант або для демонстрації
            const defaultBonusData = {
                current_day: 1,
                claimed_today: false,
                last_claim_date: null,
                rewards: {
                    1: 10,
                    2: 20,
                    3: 30,
                    4: 40,
                    5: 50,
                    6: 60,
                    7: 100
                }
            };

            // Перевіряємо наявність API та методу get
            if (!window.API || typeof window.API.get !== 'function') {
                console.warn('API не доступний. Використання тестових даних для щоденного бонусу.');

                // Зберігаємо тестові дані
                bonusData = defaultBonusData;
                currentDay = bonusData.current_day || 1;
                bonusAmount = getBonusAmount(currentDay);

                // Зберігаємо в кеш
                saveBonusData();

                return bonusData;
            }

            // Якщо API доступний, робимо запит
            try {
                const response = await window.API.get('/quests/daily-bonus/status');

                if (response && response.success) {
                    bonusData = response.data || defaultBonusData;
                    currentDay = bonusData.current_day || 1;
                    bonusAmount = getBonusAmount(currentDay);

                    // Зберігаємо в кеш
                    saveBonusData();

                    return bonusData;
                } else {
                    console.error('Не вдалося завантажити дані щоденного бонусу:', response?.message);
                    // Використовуємо кешовані дані або тестові дані як запасний варіант
                    bonusData = cachedData || defaultBonusData;
                    currentDay = bonusData.current_day || 1;
                    bonusAmount = getBonusAmount(currentDay);
                    return bonusData;
                }
            } catch (apiError) {
                console.error('Помилка запиту до API щоденного бонусу:', apiError);
                // Використовуємо кешовані дані або тестові дані при помилці API
                bonusData = cachedData || defaultBonusData;
                currentDay = bonusData.current_day || 1;
                bonusAmount = getBonusAmount(currentDay);
                return bonusData;
            }
        } catch (error) {
            console.error('Помилка завантаження даних щоденного бонусу:', error);
            // Базові дані як останній запасний варіант
            bonusData = {
                current_day: 1,
                claimed_today: false,
                rewards: {
                    1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 100
                }
            };
            currentDay = 1;
            bonusAmount = 10;
            return bonusData;
        }
    }

    /**
     * Завантаження кешованих даних
     */
    function loadCachedBonusData() {
        try {
            // Спробуємо спочатку використати StorageUtils, якщо доступно
            if (window.StorageUtils) {
                const cachedData = window.StorageUtils.getItem('daily_bonus_data');
                if (cachedData) {
                    return cachedData;
                }
            }

            // Запасний варіант - localStorage
            try {
                const cachedDataStr = localStorage.getItem('winix_daily_bonus');
                if (cachedDataStr) {
                    return JSON.parse(cachedDataStr);
                }
            } catch (e) {
                console.warn('Помилка читання з localStorage:', e);
            }
        } catch (error) {
            console.warn('Помилка завантаження кешованих даних бонусу:', error);
        }
        return null;
    }

    /**
     * Збереження даних бонусу в кеш
     */
    function saveBonusData() {
        try {
            // Спробуємо спочатку використати StorageUtils, якщо доступно
            if (window.StorageUtils) {
                window.StorageUtils.setItem('daily_bonus_data', bonusData, {
                    expires: 24 * 60 * 60 * 1000, // 24 години
                    sensitive: false
                });
            } else {
                // Запасний варіант - localStorage
                try {
                    localStorage.setItem('winix_daily_bonus', JSON.stringify(bonusData));
                } catch (e) {
                    console.warn('Помилка збереження в localStorage:', e);
                }
            }
        } catch (error) {
            console.warn('Помилка збереження даних бонусу:', error);
        }
    }

    /**
     * Форматування суми бонусу
     * @param {number} amount - Сума бонусу
     * @returns {string} - Відформатована сума
     */
    function formatBonusAmount(amount) {
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
     * Відображення прогресу щоденного бонусу
     */
    function renderBonusProgress() {
        if (!progressContainer) return;

        // Очищаємо контейнер
        progressContainer.innerHTML = '';

        // Додаємо клас для респонсивності
        progressContainer.classList.add('responsive-progress');

        // Визначаємо, чи мобільний пристрій
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            progressContainer.classList.add('mobile-view');
        } else {
            progressContainer.classList.remove('mobile-view');
        }

        // Створюємо маркери для кожного дня (від 1 до 7)
        for (let day = 1; day <= 7; day++) {
            const dayMarker = document.createElement('div');
            dayMarker.className = 'day-marker';
            dayMarker.dataset.day = day;

            // Створюємо кружечок дня
            const dayCircle = document.createElement('div');
            dayCircle.className = 'day-circle';

            // Додаємо відповідний клас статусу
            if (day < currentDay) {
                dayCircle.classList.add('completed');
                // Додаємо іконку виконання для вже отриманих днів
                dayCircle.innerHTML = '<span class="check-icon">✓</span>';
            } else if (day === currentDay) {
                dayCircle.classList.add('active');
                dayCircle.innerText = day;
            } else {
                dayCircle.innerText = day;
            }

            // Додаємо підказку при наведенні
            dayCircle.title = getLocalizedText(
                LOCALE_KEYS.DAY_LABEL,
                `День ${day}`,
                { day: day }
            );

            // Створюємо текст винагороди
            const dayReward = document.createElement('div');
            dayReward.className = 'day-reward';
            const formattedAmount = formatBonusAmount(getBonusAmount(day));
            dayReward.innerHTML = `<span class="reward-amount">${formattedAmount}</span> <span class="reward-currency">$WINIX</span>`;

            // Додаємо елементи до маркера
            dayMarker.appendChild(dayCircle);
            dayMarker.appendChild(dayReward);

            // Додаємо маркер до контейнера
            progressContainer.appendChild(dayMarker);
        }

        // Додаємо доступну підказку для скрінрідерів
        const ariaDescription = document.createElement('div');
        ariaDescription.className = 'visually-hidden';
        ariaDescription.setAttribute('aria-live', 'polite');
        ariaDescription.textContent = getLocalizedText(
            LOCALE_KEYS.DAYS_PROGRESS,
            `День ${currentDay} з 7. Поточний бонус: ${formatBonusAmount(bonusAmount)} WINIX`,
            { day: currentDay, total: 7, bonus: formatBonusAmount(bonusAmount) }
        );
        progressContainer.appendChild(ariaDescription);
    }

    /**
     * Показати запасне відображення при помилці
     */
    function showFallbackDisplay() {
        if (!progressContainer) return;

        // Очищаємо контейнер
        progressContainer.innerHTML = '<div class="bonus-error">Не вдалося завантажити дані бонусу. Спробуйте пізніше.</div>';

        // Якщо є кнопка отримання бонусу, оновлюємо її стан
        if (claimButton) {
            claimButton.disabled = true;
            claimButton.innerText = getLocalizedText(LOCALE_KEYS.ERROR_MSG, 'Помилка завантаження');
        }
    }

    /**
     * Отримати суму бонусу для конкретного дня
     */
    function getBonusAmount(day) {
        // Перевіряємо валідність дня
        if (day < 1 || day > 7) {
            console.warn(`Невалідний день бонусу: ${day}`);
            return 10; // Значення за замовчуванням для безпеки
        }

        // Якщо є дані з сервера, використовуємо їх
        if (bonusData && bonusData.rewards && bonusData.rewards[day]) {
            return bonusData.rewards[day];
        }

        // За замовчуванням використовуємо прогресивну шкалу
        const defaultAmounts = {
            1: 10,
            2: 20,
            3: 30,
            4: 40,
            5: 50,
            6: 60,
            7: 100
        };

        return defaultAmounts[day] || 10;
    }

    /**
     * Оновлення стану кнопки отримання бонусу
     */
    function updateClaimButton() {
        if (!claimButton) return;

        // Оновлюємо атрибут даних для доступу до нових локалізацій
        claimButton.setAttribute('data-locale-key', LOCALE_KEYS.CLAIM_BUTTON);

        // Якщо бонус вже отримано сьогодні, деактивуємо кнопку
        if (bonusData && bonusData.claimed_today) {
            claimButton.disabled = true;
            claimButton.innerText = getLocalizedText(LOCALE_KEYS.CLAIMED_BUTTON, 'Бонус отримано');
            claimButton.classList.add('claimed');
        } else {
            claimButton.disabled = false;
            claimButton.classList.remove('claimed');

            // Форматуємо суму бонусу
            const formattedAmount = formatBonusAmount(bonusAmount);

            // Оновлюємо текст кнопки з сумою бонусу та локалізацією
            claimButton.innerText = getLocalizedText(
                LOCALE_KEYS.CLAIM_BUTTON,
                `Отримати ${formattedAmount} $WINIX`,
                { amount: formattedAmount }
            );
        }
    }

    /**
     * Отримання щоденного бонусу
     */
    async function claimBonus() {
        if (!claimButton || claimButton.disabled) return;

        // Додаткова перевірка статусу бонусу перед відправкою запиту
        if (bonusData && bonusData.claimed_today) {
            showMessage(
                getLocalizedText(LOCALE_KEYS.ALREADY_CLAIMED, 'Бонус вже отримано сьогодні'),
                'info'
            );
            updateClaimButton();
            return;
        }

        // Деактивуємо кнопку на час запиту
        claimButton.disabled = true;
        const originalText = claimButton.innerText;
        claimButton.innerText = getLocalizedText(LOCALE_KEYS.CLAIMING_BUTTON, 'Отримання...');

        // Додаємо індікатор завантаження
        claimButton.classList.add('loading');

        try {
            // Перевіряємо наявність API
            if (!window.API || typeof window.API.post !== 'function') {
                console.warn('API не доступний. Симуляція отримання бонусу.');

                // Симулюємо успішне отримання бонусу
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Показуємо анімацію винагороди
                const reward = {
                    type: 'tokens',
                    amount: bonusAmount
                };
                showBonusAnimation(reward);

                // Оновлюємо стан бонусу
                bonusData.claimed_today = true;
                bonusData.last_claim_date = new Date().toISOString().split('T')[0];

                // Зберігаємо оновлений стан
                saveBonusData();

                // Інкрементуємо день, якщо це 7-й день, повертаємося до 1-го
                if (currentDay >= 7) {
                    currentDay = 1;
                } else {
                    currentDay += 1;
                }
                bonusData.current_day = currentDay;

                renderBonusProgress();
                updateClaimButton();

                // Оновлюємо баланс користувача
                updateUserBalance(reward);

                return;
            }

            const response = await window.API.post('/quests/daily-bonus/claim');

            if (response.success) {
                // Показуємо анімацію винагороди
                showBonusAnimation(response.data.reward);

                // Додаємо поточну дату отримання
                bonusData.claimed_today = true;
                bonusData.last_claim_date = new Date().toISOString().split('T')[0];

                // Зберігаємо оновлений стан
                saveBonusData();

                // Оновлюємо стан бонусу
                await loadBonusData(true); // Примусово оновлюємо з сервера
                renderBonusProgress();
                updateClaimButton();

                // Оновлюємо баланс користувача
                updateUserBalance(response.data.reward);
            } else {
                // Відображаємо помилку
                showErrorMessage(response.message || 'Не вдалося отримати щоденний бонус');

                // Оновлюємо дані з сервера
                await loadBonusData(true);
                renderBonusProgress();
                updateClaimButton();
            }
        } catch (error) {
            console.error('Помилка при отриманні щоденного бонусу:', error);

            // Відображаємо помилку
            showErrorMessage('Сталася помилка при отриманні щоденного бонусу');
        } finally {
            // Прибираємо індікатор завантаження
            claimButton.classList.remove('loading');
        }
    }

    /**
     * Показати анімацію отримання бонусу
     */
    function showBonusAnimation(reward) {
        // Перевіряємо валідність нагороди
        if (!reward || !reward.amount) {
            console.warn('Невалідні дані нагороди для анімації');
            return;
        }

        // Форматуємо суму нагороди
        const formattedAmount = formatBonusAmount(reward.amount);

        // Перевіряємо чи доступний модуль анімацій
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward({
                ...reward,
                formattedAmount: formattedAmount
            });
        } else {
            // Запасний варіант - просте сповіщення
            showSuccessMessage(
                getLocalizedText(
                    LOCALE_KEYS.SUCCESS_MSG,
                    `Ви отримали щоденний бонус: ${formattedAmount} ${reward.type === 'tokens' ? '$WINIX' : 'жетонів'}!`,
                    { amount: formattedAmount, type: reward.type === 'tokens' ? '$WINIX' : 'жетонів' }
                )
            );

            // Створюємо просту анімацію
            const animationElement = document.createElement('div');
            animationElement.className = 'bonus-animation';
            animationElement.innerHTML = `
                <div class="bonus-animation-content">
                    <div class="bonus-animation-icon">🎁</div>
                    <div class="bonus-animation-amount">+${formattedAmount} ${reward.type === 'tokens' ? '$WINIX' : 'жетонів'}</div>
                </div>
            `;

            document.body.appendChild(animationElement);

            // Показуємо анімацію
            setTimeout(() => {
                animationElement.classList.add('show');
                setTimeout(() => {
                    animationElement.classList.remove('show');
                    setTimeout(() => {
                        animationElement.remove();
                    }, 300);
                }, 2000);
            }, 100);
        }
    }

    /**
     * Оновити баланс користувача
     */
    function updateUserBalance(reward) {
        // Перевіряємо валідність нагороди
        if (!reward || !reward.amount) {
            console.warn('Невалідні дані нагороди для оновлення балансу');
            return;
        }

        // Якщо є TaskRewards або TaskManager, використовуємо їх
        if (window.TaskRewards && window.TaskRewards.updateBalance) {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        if (window.TaskManager && window.TaskManager.updateBalance) {
            window.TaskManager.updateBalance(reward);
            return;
        }

        // Запасний варіант - оновлюємо елементи DOM напряму
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent.replace(/\s+/g, '')) || 0;
                const newBalance = currentBalance + reward.amount;
                userTokensElement.textContent = formatBonusAmount(newBalance);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в сховищі, якщо доступно
                if (window.StorageUtils) {
                    window.StorageUtils.setItem('userTokens', newBalance, {
                        sensitive: true // Позначаємо як чутливі дані
                    });
                    window.StorageUtils.setItem('winix_balance', newBalance, {
                        sensitive: true
                    });
                }
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent.replace(/\s+/g, '')) || 0;
                const newBalance = currentBalance + reward.amount;
                userCoinsElement.textContent = formatBonusAmount(newBalance);
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в сховищі, якщо доступно
                if (window.StorageUtils) {
                    window.StorageUtils.setItem('userCoins', newBalance, {
                        sensitive: true
                    });
                    window.StorageUtils.setItem('winix_coins', newBalance, {
                        sensitive: true
                    });
                }
            }
        }

        // Генеруємо подію про оновлення балансу
        document.dispatchEvent(new CustomEvent('balance-updated', {
            detail: {
                type: reward.type,
                amount: reward.amount,
                source: 'daily-bonus'
            }
        }));
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        // Делегуємо TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.showSuccessMessage) {
            window.TaskManager.showSuccessMessage(message);
            return;
        }

        // Делегуємо UI.Notifications, якщо він доступний
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
            window.UI.Notifications.showSuccess(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        showMessage(message, 'success');
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        // Делегуємо TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.showErrorMessage) {
            window.TaskManager.showErrorMessage(message);
            return;
        }

        // Делегуємо UI.Notifications, якщо він доступний
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
            window.UI.Notifications.showError(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        showMessage(message, 'error');
    }

    /**
     * Показати повідомлення
     */
    function showMessage(message, type = 'info') {
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            // Встановлюємо текст
            toastElement.textContent = message;

            // Встановлюємо клас в залежності від типу
            toastElement.className = 'toast-message';
            if (type === 'error') {
                toastElement.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
            } else if (type === 'success') {
                toastElement.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
            } else {
                toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
            }

            // Показуємо сповіщення
            toastElement.classList.add('show');

            // Автоматично приховуємо через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
                }, 300);
            }, 3000);
        } else {
            alert(message);
        }
    }

    // Публічний API модуля
    return {
        init,
        claimBonus,
        loadBonusData,
        renderBonusProgress,
        updateClaimButton
    };
})();