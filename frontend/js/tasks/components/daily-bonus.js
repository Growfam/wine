/**
 * DailyBonus - компонент для керування щоденним бонусом
 * Відповідає за:
 * - Відображення прогресу щоденних бонусів
 * - Обробку отримання бонусу
 * - Анімацію винагороди
 */

window.DailyBonus = (function() {
    // Приватні змінні модуля
    let bonusData = null;
    let currentDay = 0;
    let bonusAmount = 0;

    // DOM-елементи
    const progressContainer = document.getElementById('daily-progress-container');
    const claimButton = document.getElementById('claim-daily');

    /**
     * Ініціалізація модуля щоденного бонусу
     */
    async function init() {
        console.log('Ініціалізація DailyBonus...');

        try {
            await loadBonusData();
            renderBonusProgress();
            updateClaimButton();
        } catch (error) {
            console.error('Помилка ініціалізації щоденного бонусу:', error);
        }
    }

    /**
     * Завантаження даних щоденного бонусу
     */
    async function loadBonusData() {
        try {
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

                // Оновлюємо текст кнопки
                if (claimButton) {
                    const buttonText = claimButton.getAttribute('data-lang-key') || 'earn.get';
                    claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
                }

                return bonusData;
            }

            // Якщо API доступний, робимо запит
            try {
                const response = await window.API.get('/quests/daily-bonus/status');

                if (response && response.success) {
                    bonusData = response.data || defaultBonusData;
                    currentDay = bonusData.current_day || 1;
                    bonusAmount = getBonusAmount(currentDay);

                    // Оновлюємо текст кнопки
                    if (claimButton) {
                        const buttonText = claimButton.getAttribute('data-lang-key');
                        claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
                    }

                    return bonusData;
                } else {
                    console.error('Не вдалося завантажити дані щоденного бонусу:', response?.message);
                    // Використовуємо тестові дані як запасний варіант
                    bonusData = defaultBonusData;
                    currentDay = bonusData.current_day || 1;
                    bonusAmount = getBonusAmount(currentDay);

                    if (claimButton) {
                        const buttonText = claimButton.getAttribute('data-lang-key');
                        claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
                    }

                    return bonusData;
                }
            } catch (apiError) {
                console.error('Помилка запиту до API щоденного бонусу:', apiError);
                // Використовуємо тестові дані при помилці API
                bonusData = defaultBonusData;
                currentDay = bonusData.current_day || 1;
                bonusAmount = getBonusAmount(currentDay);

                if (claimButton) {
                    const buttonText = claimButton.getAttribute('data-lang-key');
                    claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
                }

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
     * Відображення прогресу щоденного бонусу
     */
    function renderBonusProgress() {
        if (!progressContainer) return;

        // Очищаємо контейнер
        progressContainer.innerHTML = '';

        // Створюємо маркери для кожного дня (від 1 до 7)
        for (let day = 1; day <= 7; day++) {
            const dayMarker = document.createElement('div');
            dayMarker.className = 'day-marker';

            // Створюємо кружечок дня
            const dayCircle = document.createElement('div');
            dayCircle.className = 'day-circle';

            // Додаємо відповідний клас статусу
            if (day < currentDay) {
                dayCircle.classList.add('completed');
            } else if (day === currentDay) {
                dayCircle.classList.add('active');
            }

            dayCircle.innerText = day;

            // Створюємо текст винагороди
            const dayReward = document.createElement('div');
            dayReward.className = 'day-reward';
            dayReward.innerText = getBonusAmount(day);

            // Додаємо елементи до маркера
            dayMarker.appendChild(dayCircle);
            dayMarker.appendChild(dayReward);

            // Додаємо маркер до контейнера
            progressContainer.appendChild(dayMarker);
        }
    }

    /**
     * Отримати суму бонусу для конкретного дня
     */
    function getBonusAmount(day) {
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
            7: 70
        };

        return defaultAmounts[day] || 10;
    }

    /**
     * Оновлення стану кнопки отримання бонусу
     */
    function updateClaimButton() {
        if (!claimButton) return;

        // Якщо бонус вже отримано сьогодні, деактивуємо кнопку
        if (bonusData && bonusData.claimed_today) {
            claimButton.disabled = true;
            claimButton.innerText = 'Бонус отримано';
        } else {
            claimButton.disabled = false;

            // Оновлюємо текст кнопки з сумою бонусу
            const buttonText = claimButton.getAttribute('data-lang-key');
            claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
        }
    }

    /**
     * Отримання щоденного бонусу
     */
    async function claimBonus() {
        if (!claimButton || claimButton.disabled) return;

        // Деактивуємо кнопку на час запиту
        claimButton.disabled = true;
        claimButton.innerText = 'Отримання...';

        try {
            // Перевіряємо наявність API
            if (!window.API || typeof window.API.post !== 'function') {
                console.warn('API не доступний. Симуляція отримання бонусу.');

                // Симулюємо успішне отримання бонусу
                setTimeout(() => {
                    // Показуємо анімацію винагороди
                    const reward = {
                        type: 'tokens',
                        amount: bonusAmount
                    };
                    showBonusAnimation(reward);

                    // Оновлюємо стан бонусу
                    bonusData.claimed_today = true;
                    if (currentDay >= 7) {
                        currentDay = 1;
                    } else {
                        currentDay += 1;
                    }
                    bonusData.current_day = currentDay;
                    bonusData.last_claim_date = new Date().toISOString().split('T')[0];

                    renderBonusProgress();
                    updateClaimButton();

                    // Оновлюємо баланс користувача
                    updateUserBalance(reward);
                }, 1000);

                return;
            }

            const response = await window.API.post('/quests/daily-bonus/claim');

            if (response.success) {
                // Показуємо анімацію винагороди
                showBonusAnimation(response.data.reward);

                // Оновлюємо стан бонусу
                await loadBonusData();
                renderBonusProgress();
                updateClaimButton();

                // Оновлюємо баланс користувача
                updateUserBalance(response.data.reward);
            } else {
                // Відображаємо помилку
                showErrorMessage(response.message || 'Не вдалося отримати щоденний бонус');

                // Повертаємо активний стан кнопки
                claimButton.disabled = false;
                const buttonText = claimButton.getAttribute('data-lang-key');
                claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
            }
        } catch (error) {
            console.error('Помилка при отриманні щоденного бонусу:', error);

            // Відображаємо помилку
            showErrorMessage('Сталася помилка при отриманні щоденного бонусу');

            // Повертаємо активний стан кнопки
            claimButton.disabled = false;
            const buttonText = claimButton.getAttribute('data-lang-key');
            claimButton.innerText = `${buttonText.replace('earn.get', 'Отримати')} ${bonusAmount} $WINIX`;
        }
    }

    /**
     * Показати анімацію отримання бонусу
     */
    function showBonusAnimation(reward) {
        // Перевіряємо чи доступний модуль анімацій
        if (window.UI && window.UI.Animations) {
            window.UI.Animations.showReward(reward);
        } else {
            // Запасний варіант - просте сповіщення
            showSuccessMessage(`Ви отримали щоденний бонус: ${reward.amount} ${reward.type === 'tokens' ? '$WINIX' : 'жетонів'}!`);
        }
    }

    /**
     * Оновити баланс користувача
     */
    function updateUserBalance(reward) {
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                userTokensElement.textContent = currentBalance + reward.amount;
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
            }
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        // Делегуємо TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.showSuccessMessage) {
            window.TaskManager.showSuccessMessage(message);
        } else {
            // Запасний варіант - використовуємо toast-повідомлення
            const toastElement = document.getElementById('toast-message');
            if (toastElement) {
                toastElement.textContent = message;
                toastElement.classList.add('show');

                // Автоматично приховуємо повідомлення через 3 секунди
                setTimeout(() => {
                    toastElement.classList.remove('show');
                }, 3000);
            } else {
                alert(message);
            }
        }
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        // Делегуємо TaskManager, якщо він доступний
        if (window.TaskManager && window.TaskManager.showErrorMessage) {
            window.TaskManager.showErrorMessage(message);
        } else {
            // Запасний варіант - використовуємо toast-повідомлення
            const toastElement = document.getElementById('toast-message');
            if (toastElement) {
                toastElement.textContent = message;
                toastElement.style.background = 'linear-gradient(135deg, #F44336, #D32F2F)';
                toastElement.classList.add('show');

                // Автоматично приховуємо повідомлення через 3 секунди
                setTimeout(() => {
                    toastElement.classList.remove('show');
                    // Повертаємо оригінальний стиль
                    toastElement.style.background = 'linear-gradient(135deg, #1A1A2E, #0F3460)';
                }, 3000);
            } else {
                alert(message);
            }
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