/**
 * WINIX UNIFIED FIXES - Об'єднаний файл виправлень усіх систем WINIX
 *
 * Цей файл поєднує всі виправлення для розіграшів, бейджів та модальних вікон WINIX
 * в єдину, цілісну систему без конфліктів і дублювання функціоналу.
 *
 * Підключіть цей скрипт ОСТАННІМ у кінці HTML-файлу, після всіх інших скриптів.
 */

(function() {
    console.log("🚀 WINIX UNIFIED FIXES: Запуск об'єднаної системи виправлень...");

    // ====== БАЗОВІ УТИЛІТИ ======

    // Прапорець для запобігання повторним натисканням
    let isProcessingRaffle = false;

    /**
     * Безпечне отримання даних з localStorage
     */
    function safeGetItem(key, defaultValue) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.error(`Помилка отримання ${key} з localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Безпечне збереження даних в localStorage
     */
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error(`Помилка збереження ${key} в localStorage:`, e);
            return false;
        }
    }

    /**
     * Визначення поточної мови інтерфейсу
     */
    function getCurrentLanguage() {
        // Спроба 1: Перевірити налаштування мови в localStorage
        let lang = safeGetItem('userLanguage', null) || safeGetItem('winix_language', null);

        // Спроба 2: Перевірити HTML/BODY елементи
        if (!lang) {
            const htmlEl = document.documentElement;
            const bodyEl = document.body;

            if (htmlEl.lang) {
                lang = htmlEl.lang;
            } else if (bodyEl.className.includes('lang-')) {
                const langMatch = bodyEl.className.match(/lang-([a-z]{2})/);
                if (langMatch) lang = langMatch[1];
            }
        }

        // Спроба 3: Перевірка URL
        if (!lang && window.location.href.includes('/ru/')) {
            lang = 'ru';
        } else if (!lang && window.location.href.includes('/en/')) {
            lang = 'en';
        }

        // Спроба 4: Аналіз тексту на сторінці
        if (!lang) {
            const pageText = document.body.textContent.toLowerCase();
            let ruCount = 0;
            let enCount = 0;

            const ruWords = ['получить', 'бонус', 'новичкам', 'розыгрыш', 'участие'];
            const enWords = ['receive', 'bonus', 'newbie', 'raffle', 'participate'];

            ruWords.forEach(word => {
                if (pageText.includes(word)) ruCount++;
            });

            enWords.forEach(word => {
                if (pageText.includes(word)) enCount++;
            });

            if (ruCount > enCount) {
                lang = 'ru';
            } else if (enCount > ruCount) {
                lang = 'en';
            }
        }

        // За замовчуванням - українська
        return lang || 'uk';
    }

    /**
     * Отримання локалізованого тексту залежно від поточної мови
     */
    function getLocalizedText(uk, ru, en) {
        const lang = getCurrentLanguage();

        if (lang === 'ru') return ru;
        if (lang === 'en') return en;
        return uk; // За замовчуванням - українська
    }

    /**
     * Безпечне отримання балансу жетонів
     */
    function getCoinsBalance() {
        // Спочатку спробуємо через WinixCore API
        if (window.WinixCore && window.WinixCore.Balance) {
            return window.WinixCore.Balance.getCoins();
        }

        // Потім через інші можливі системи
        if (window.balanceSystem && window.balanceSystem.getCoins) {
            return window.balanceSystem.getCoins();
        }

        // Нарешті, напряму з localStorage
        return parseInt(safeGetItem('userCoins', '0')) || parseInt(safeGetItem('winix_coins', '0')) || 0;
    }

    /**
     * Безпечне оновлення балансу жетонів
     */
    function updateCoinsBalance(newBalance) {
        console.log(`Оновлення балансу жетонів: ${newBalance}`);

        // Зберігаємо в різних ключах для максимальної сумісності
        safeSetItem('userCoins', newBalance.toString());
        safeSetItem('winix_coins', newBalance.toString());

        // Оновлюємо через API, якщо доступно
        if (window.WinixCore && window.WinixCore.Balance) {
            window.WinixCore.Balance.setCoins(newBalance);
        }

        // Оновлюємо всі елементи інтерфейсу
        const coinsElements = document.querySelectorAll('#user-coins, .coins-amount, .coins-value');
        coinsElements.forEach(element => {
            if (element) element.textContent = newBalance.toString();
        });

        return true;
    }

    /**
     * Безпечне отримання балансу токенів WINIX
     */
    function getTokensBalance() {
        // Спочатку спробуємо через WinixCore API
        if (window.WinixCore && window.WinixCore.Balance) {
            return window.WinixCore.Balance.getTokens();
        }

        // Потім через інші можливі системи
        if (window.balanceSystem && window.balanceSystem.getTokens) {
            return window.balanceSystem.getTokens();
        }

        // Нарешті, напряму з localStorage
        return parseFloat(safeGetItem('userTokens', '0')) || parseFloat(safeGetItem('winix_balance', '0')) || 0;
    }

    /**
     * Безпечне оновлення балансу токенів WINIX
     */
    function updateTokensBalance(newBalance) {
        console.log(`Оновлення балансу WINIX: ${newBalance}`);

        // Зберігаємо в різних ключах для максимальної сумісності
        safeSetItem('userTokens', newBalance.toString());
        safeSetItem('winix_balance', newBalance.toString());

        // Оновлюємо через API, якщо доступно
        if (window.WinixCore && window.WinixCore.Balance) {
            window.WinixCore.Balance.setTokens(newBalance);
        }

        // Оновлюємо всі елементи інтерфейсу
        const tokenElements = document.querySelectorAll('#user-tokens, #main-balance, .balance-amount, #current-balance, .balance-value');
        tokenElements.forEach(element => {
            if (element) {
                if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                    element.innerHTML = `${newBalance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                } else {
                    element.textContent = newBalance.toFixed(2);
                }
            }
        });

        return true;
    }

    /**
     * Безпечне додавання токенів WINIX з транзакцією
     */
    function addTokens(amount, description) {
        console.log(`Спроба додати ${amount} WINIX за ${description}`);

        try {
            const currentBalance = getTokensBalance();
            const newBalance = currentBalance + amount;

            // Оновлюємо баланс
            updateTokensBalance(newBalance);

            // Додаємо транзакцію
            try {
                const transactions = JSON.parse(safeGetItem('transactions', '[]'));
                transactions.unshift({
                    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
                    type: 'receive',
                    amount: amount,
                    description: description,
                    timestamp: Date.now(),
                    status: 'completed'
                });
                safeSetItem('transactions', JSON.stringify(transactions));
                safeSetItem('winix_transactions', JSON.stringify(transactions));
            } catch (e) {
                console.error("Помилка додавання транзакції:", e);
            }

            return true;
        } catch (e) {
            console.error("Помилка додавання токенів:", e);
            return false;
        }
    }

    /**
     * Безпечний показ повідомлень
     */
    function showToast(message, duration = 3000) {
        console.log(`TOAST: ${message}`);

        // Спроба 1: Через WinixCore
        if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
            window.WinixCore.UI.showNotification(message);
            return;
        }

        // Спроба 2: Через глобальну функцію
        if (window.showToast) {
            window.showToast(message, duration);
            return;
        }

        // Спроба 3: Через глобальну функцію showNotification
        if (window.showNotification) {
            window.showNotification(message, 'info', duration);
            return;
        }

        // Запасний варіант: створюємо елемент toast вручну
        let toast = document.getElementById('toast-message');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-message';
            toast.className = 'toast-message';

            // Базові стилі для toast-повідомлення, якщо відсутні
            if (!document.querySelector('style#dynamic-toast-styles')) {
                const style = document.createElement('style');
                style.id = 'dynamic-toast-styles';
                style.textContent = `
                    .toast-message {
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: linear-gradient(135deg, #1A1A2E, #0F3460);
                        color: #ffffff;
                        padding: 0.75rem 1.5rem;
                        border-radius: 12px;
                        z-index: 1000;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                        border: 1px solid rgba(78, 181, 247, 0.2);
                        opacity: 0;
                        transition: all 0.3s ease;
                        font-size: 0.9375rem;
                        display: flex;
                        align-items: center;
                        max-width: 350px;
                        width: 90%;
                    }
                    
                    .toast-message.show {
                        opacity: 1;
                        transform: translate(-50%, 10px);
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    /**
     * Отримання даних про розіграші з локального сховища
     */
    function getRaffleData() {
        // Спочатку спробуємо отримати через WinixCore API
        if (window.WinixCore && window.WinixCore.Storage) {
            const data = window.WinixCore.Storage.getItem('winix_raffles_data');
            if (data) return data;
        }

        // Якщо не вдалося, використовуємо localStorage
        const storageData = safeGetItem('winix_raffles_data', null);
        return storageData ? JSON.parse(storageData) : {
            mainRaffleParticipants: parseInt(safeGetItem('mainRaffleParticipants', '0')),
            dailyRaffleParticipants: parseInt(safeGetItem('dailyRaffleParticipants', '0')),
            participations: JSON.parse(safeGetItem('currentParticipations', '[]'))
        };
    }

    /**
     * Збереження даних про розіграші в локальне сховище
     */
    function saveRaffleData(data) {
        // Спочатку спробуємо зберегти через WinixCore API
        if (window.WinixCore && window.WinixCore.Storage) {
            window.WinixCore.Storage.setItem('winix_raffles_data', data);
        }

        // Також зберігаємо в localStorage
        safeSetItem('winix_raffles_data', JSON.stringify(data));

        // Оновлюємо також окремі ключі для сумісності
        if (data.mainRaffleParticipants !== undefined) {
            safeSetItem('mainRaffleParticipants', data.mainRaffleParticipants.toString());
        }
        if (data.dailyRaffleParticipants !== undefined) {
            safeSetItem('dailyRaffleParticipants', data.dailyRaffleParticipants.toString());
        }
        if (data.participations !== undefined) {
            safeSetItem('currentParticipations', JSON.stringify(data.participations));
        }
    }

    // ====== ПРЕМІАЛЬНІ СТИЛІ І МОДАЛЬНІ ВІКНА ======


    /**
     * Виправлення кнопок закриття для всіх модальних вікон
     */
    function fixCloseButtons() {
    console.log("Виправлення кнопок закриття для всіх модальних вікон");

    // Обробляємо всі модальні вікна
    const modals = document.querySelectorAll('.raffle-modal, .daily-raffle-modal');

    modals.forEach(modal => {
        console.log("Обробка модального вікна:", modal.id || modal.className);

        // Виправляємо кнопку закриття (×)
        const closeButton = modal.querySelector('.modal-close');
        if (closeButton) {
            console.log("Виправляємо кнопку закриття ×");

            // Повністю видаляємо старі обробники
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode.replaceChild(newCloseButton, closeButton);

            // Додаємо новий обробник
            newCloseButton.addEventListener('click', function() {
                console.log("Клік на кнопці закриття, закриваємо модальне вікно");
                modal.classList.remove('open');
            });
        }

        // ВИПРАВЛЕНО: Виправляємо кнопки "Закрити" без обмежень по ID
        const closeActionButtons = modal.querySelectorAll('.join-button');
        closeActionButtons.forEach(button => {
            if (button.id && button.id.includes('close') ||
                button.textContent.includes('Закрити') ||
                button.textContent.includes('закрити') ||
                button.textContent.includes('ЗАКРИТИ') ||
                button.textContent.includes('Close')) {

                console.log("Виправляємо кнопку 'Закрити':", button.textContent);

                // Повністю видаляємо старі обробники
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);

                // Додаємо новий обробник
                newButton.addEventListener('click', function() {
                    console.log("Клік на кнопці 'Закрити', закриваємо модальне вікно");
                    modal.classList.remove('open');
                });
            }
        });
    });

    console.log("Кнопки закриття для модальних вікон виправлено");
}

    // ====== СИСТЕМА РОЗІГРАШІВ ======

    /**
     * Оновлення дати закінчення розіграшів
     */
    function updateRaffleEndDates() {
        // Встановлюємо дату закінчення головного розіграшу (3 дні від поточної дати)
        const mainEndDate = new Date();
        mainEndDate.setDate(mainEndDate.getDate() + 3);
        mainEndDate.setHours(15, 0, 0, 0);

        // Встановлюємо дату закінчення щоденного розіграшу (завтра о 12:00)
        const dailyEndDate = new Date();
        dailyEndDate.setDate(dailyEndDate.getDate() + 1);
        dailyEndDate.setHours(12, 0, 0, 0);

        // Форматуємо дати для відображення
        const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                       'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

        const mainFormattedDate = `${mainEndDate.getDate()} ${months[mainEndDate.getMonth()]} ${mainEndDate.getFullYear()}, ${mainEndDate.getHours()}:00`;
        const dailyFormattedDate = `${dailyEndDate.getDate()} ${months[dailyEndDate.getMonth()]} ${dailyEndDate.getFullYear()}, ${dailyEndDate.getHours()}:00`;

        // Оновлюємо елементи DOM
        const mainEndElement = document.getElementById('main-end-time');
        if (mainEndElement) mainEndElement.textContent = mainFormattedDate;

        const dailyEndElement = document.getElementById('daily-end-time');
        if (dailyEndElement) dailyEndElement.textContent = dailyFormattedDate;

        return { mainEndDate, dailyEndDate, mainFormattedDate, dailyFormattedDate };
    }

    /**
     * Оновлення кількості учасників в розіграшах
     */
    function updateRaffleParticipantsCount() {
    // Отримуємо актуальні дані
    const raffleData = getRaffleData();

    // Встановлюємо початкові значення, якщо вони відсутні
    let mainCount = raffleData.mainRaffleParticipants || 0;
    let dailyCount = raffleData.dailyRaffleParticipants || 0;

    if (mainCount === 0) {
        mainCount = 1;
        raffleData.mainRaffleParticipants = 1;
        saveRaffleData(raffleData);
    }

    if (dailyCount === 0) {
        dailyCount = 1;
        raffleData.dailyRaffleParticipants = 1;
        saveRaffleData(raffleData);
    }

    console.log(`Оновлення кількості учасників: головний=${mainCount}, щоденний=${dailyCount}`);

    // Оновлюємо відображення на головній сторінці та у головному модальному вікні
    const mainCountElements = document.querySelectorAll('.participants-count');
    mainCountElements.forEach(el => {
        if (el) el.textContent = mainCount.toString();
    });

    const mainModalParticipants = document.getElementById('main-participants');
    if (mainModalParticipants) mainModalParticipants.textContent = mainCount.toString();

    // Оновлюємо дані для щоденного розіграшу
    const dailyModalParticipants = document.getElementById('daily-participants');
    if (dailyModalParticipants) {
        dailyModalParticipants.textContent = dailyCount.toString();
        console.log(`Встановлено ${dailyCount} учасників для щоденного розіграшу`);
    }

    // ВИПРАВЛЕНО: Оновлюємо прогрес-бар на основі часу, а не кількості учасників
    // Отримуємо дату закінчення розіграшу з функції updateRaffleEndDates
    const endDates = updateRaffleEndDates();
    if (endDates && endDates.mainEndDate) {
        updateProgressBar(endDates.mainEndDate);
    } else {
        // Якщо не вдалося отримати дату, використовуємо поточний прогрес
        const currentProgress = parseInt(safeGetItem('mainRaffleProgress', '29'));
        const progressBar = document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.width = `${currentProgress}%`;
        }
    }
}

    /**
     * Оновлення прогрес-бару для головного розіграшу
     */
    function updateProgressBar(endDate) {
    const progressBar = document.querySelector('.progress');
    if (!progressBar) return;

    // Для розрахунку прогресу нам потрібні дати початку і кінця
    const now = new Date();

    // Дата початку = поточна дата мінус 5 днів (загальна тривалість розіграшу)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 5);

    // Перевіряємо, чи endDate є датою, якщо ні - перетворюємо
    let endDateTime = endDate;
    if (!(endDate instanceof Date)) {
        // Якщо передано не дату, спробуємо створити її з визначеного формату
        try {
            const endDateStr = document.getElementById('main-end-time')?.textContent;
            if (endDateStr) {
                // Парсимо дату з формату "27 березня 2025, 15:00"
                const parts = endDateStr.split(', ');
                const dateParts = parts[0].split(' ');
                const timeParts = parts[1].split(':');

                const months = {
                    'січня': 0, 'лютого': 1, 'березня': 2, 'квітня': 3,
                    'травня': 4, 'червня': 5, 'липня': 6, 'серпня': 7,
                    'вересня': 8, 'жовтня': 9, 'листопада': 10, 'грудня': 11
                };

                const day = parseInt(dateParts[0]);
                const month = months[dateParts[1]];
                const year = parseInt(dateParts[2]);
                const hour = parseInt(timeParts[0]);
                const minute = parseInt(timeParts[1]);

                endDateTime = new Date(year, month, day, hour, minute);
            } else {
                // Якщо немає дати в DOM, встановлюємо +3 дні від поточної
                endDateTime = new Date();
                endDateTime.setDate(endDateTime.getDate() + 3);
            }
        } catch (e) {
            console.error('Помилка при парсингу дати закінчення розіграшу:', e);
            endDateTime = new Date();
            endDateTime.setDate(endDateTime.getDate() + 3);
        }
    }

    // Розраховуємо загальну тривалість розіграшу і скільки вже пройшло
    const totalDuration = endDateTime - startDate;
    const elapsed = now - startDate;

    // Розраховуємо прогрес у відсотках
    let progressPercent = Math.round((elapsed / totalDuration) * 100);

    // Обмежуємо прогрес між 0% і 100%
    progressPercent = Math.max(0, Math.min(100, progressPercent));

    // Оновлюємо прогрес-бар
    progressBar.style.width = `${progressPercent}%`;

    // Зберігаємо значення в localStorage для відновлення
    safeSetItem('mainRaffleProgress', progressPercent.toString());

    console.log(`Прогрес розіграшу оновлено до ${progressPercent}% (залишилось ${Math.round((totalDuration - elapsed) / (1000 * 60 * 60 * 24))} днів)`);

    return progressPercent;
}

    /**
     * Функція для участі в розіграші
     */
    function participateInRaffle(raffleId, raffleType, inputId) {
        if (isProcessingRaffle) {
            console.log("🚫 Запобігання повторному відправленню");
            showToast(getLocalizedText(
                'Зачекайте, ваш запит обробляється...',
                'Подождите, ваш запрос обрабатывается...',
                'Please wait, your request is being processed...'
            ));
            return;
        }

        isProcessingRaffle = true;
        console.log(`🎮 Участь у розіграші ${raffleId} типу ${raffleType}`);

        try {
            // 1. Отримуємо поточний баланс жетонів і кількість для використання
            const coinsBalance = getCoinsBalance();
            const tokenAmount = parseInt(document.getElementById(inputId)?.value || '1') || 1;

            console.log(`Поточний баланс: ${coinsBalance} жетонів, потрібно: ${tokenAmount}`);

            // 2. Перевіряємо, чи достатньо жетонів
            if (coinsBalance < tokenAmount) {
                showToast(getLocalizedText(
                    'Недостатньо жетонів для участі в розіграші',
                    'Недостаточно жетонов для участия в розыгрыше',
                    'Not enough coins to participate in the raffle'
                ), 3000);
                isProcessingRaffle = false;
                return;
            }

            // 3. Показуємо індикатор завантаження
            const spinner = document.getElementById('loading-spinner');
            if (spinner) spinner.classList.add('show');

            // 4. Забороняємо всі кнопки розіграшів для запобігання повторним натисканням
            const allButtons = document.querySelectorAll('.join-button, .mini-raffle-button');
            allButtons.forEach(btn => btn.disabled = true);

            // 5. Оновлюємо дані розіграшу в localStorage
            setTimeout(() => {
                try {
                    // Зменшуємо баланс жетонів
                    const newCoinsBalance = coinsBalance - tokenAmount;
                    updateCoinsBalance(newCoinsBalance);

                    // Отримуємо поточні дані розіграшів
                    let raffleData = getRaffleData();

                    // Додаємо нову участь
                    const participation = {
                        userId: safeGetItem('userId', 'anonymous'),
                        raffleId: raffleId,
                        raffleType: raffleType,
                        tokenAmount: tokenAmount,
                        timestamp: new Date().toISOString()
                    };

                    if (!raffleData.participations) {
                        raffleData.participations = [];
                    }
                    raffleData.participations.push(participation);

                    // Оновлюємо лічильник для відповідного типу розіграшу
                    if (raffleType === 'main') {
                        raffleData.mainRaffleParticipants = (raffleData.mainRaffleParticipants || 0) + 1;
                    } else if (raffleType === 'daily') {
                        raffleData.dailyRaffleParticipants = (raffleData.dailyRaffleParticipants || 0) + 1;
                    }

                    // Зберігаємо оновлені дані
                    saveRaffleData(raffleData);
                    updateRaffleParticipantsCount();

                    // Перевіряємо, чи це перша участь
                    const isFirstRaffle = safeGetItem('first_raffle_participated', 'false') !== 'true';
                    if (isFirstRaffle) {
                        // Додаємо бонус за першу участь
                        addTokens(150, getLocalizedText(
                            'Бонус за першу участь у розіграші',
                            'Бонус за первое участие в розыгрыше',
                            'Bonus for first raffle participation'
                        ));
                        safeSetItem('first_raffle_participated', 'true');

                        // Покажемо повідомлення з затримкою
                        setTimeout(() => {
                            showToast(getLocalizedText(
                                'Вітаємо! Ви отримали 150 WINIX за першу участь!',
                                'Поздравляем! Вы получили 150 WINIX за первое участие!',
                                'Congratulations! You received 150 WINIX for your first participation!'
                            ), 3000);
                        }, 3000);
                    }

                    // Оновлюємо статистику участі
                    updateParticipationStatistics(tokenAmount);

                    // Закриваємо модальне вікно
                    const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
                    const modal = document.getElementById(modalId);
                    if (modal) modal.classList.remove('open');

                    // Показуємо повідомлення про успіх
                    showToast(getLocalizedText(
                        'Ви успішно взяли участь у розіграші',
                        'Вы успешно приняли участие в розыгрыше',
                        'You have successfully participated in the raffle'
                    ), 3000);

                    console.log("✅ Участь у розіграші успішно зареєстрована");

                } catch (error) {
                    console.error('Помилка при обробці участі:', error);
                    showToast(getLocalizedText(
                        'Сталася помилка, спробуйте ще раз',
                        'Произошла ошибка, попробуйте еще раз',
                        'An error occurred, please try again'
                    ), 3000);
                } finally {
                    // Приховуємо індикатор завантаження і розблоковуємо кнопки
                    if (spinner) spinner.classList.remove('show');

                    allButtons.forEach(btn => btn.disabled = false);
                    isProcessingRaffle = false;
                }
            }, 1000); // Затримка для кращого UX

        } catch (error) {
            console.error('Критична помилка при участі в розіграші:', error);
            showToast(getLocalizedText(
                'Сталася критична помилка',
                'Произошла критическая ошибка',
                'A critical error has occurred'
            ), 3000);
            isProcessingRaffle = false;
        }
    }

    /**
     * Оновлення статистики участі в розіграшах
     */
    function updateParticipationStatistics(tokenAmount) {
        console.log("Оновлення статистики участі");

        try {
            // Отримуємо поточну статистику
            let statistics = JSON.parse(safeGetItem('userStatistics', '{}'));

            // Встановлюємо значення за замовчуванням
            if (!statistics.participationsCount) statistics.participationsCount = 0;
            if (!statistics.winsCount) statistics.winsCount = 0;
            if (!statistics.totalWinnings) statistics.totalWinnings = 0;
            if (!statistics.referralsCount) statistics.referralsCount = 0;

            // Збільшуємо лічильник участі
            statistics.participationsCount++;

            // Оновлюємо відображення статистики
            const participationsElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
            if (participationsElement) {
                participationsElement.textContent = statistics.participationsCount.toString();
            }

            // Зберігаємо оновлену статистику
            safeSetItem('userStatistics', JSON.stringify(statistics));
            console.log(`Статистику участі оновлено: ${statistics.participationsCount} участей`);

            // Перевіряємо досягнення бейджа "Початківець"
            if (statistics.participationsCount >= 5 && safeGetItem('badge_beginner_claimed', 'false') !== 'true') {
                console.log("Умова для бейджа 'Початківець' виконана");

                // Викликаємо функцію для нагороди за бейдж із затримкою для стабільної роботи
                setTimeout(() => {
                    giveRewardForBadge('beginner', 1000);
                }, 1500);
            }

            return true;
        } catch (error) {
            console.error('Помилка оновлення статистики участі:', error);
            return false;
        }
    }

    /**
     * Генерація реалістичних даних переможців розіграшу
     */
    function generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status) {
        const winners = [];
        const isWinner = status === 'won' || status === 'виграно';

        // Реальні Telegram нікнейми для переможців
        const usernames = [
            'workerscrypto', 'crypto_king', 'winix_whale', 'blockchain_bro',
            'token_trader', 'web3_wizard', 'defi_master', 'satoshi_fanboy',
            'crypto_queen', 'btc_billionaire', 'eth_enthusiast', 'nft_collector',
            'dao_developer', 'crypto_guru', 'meta_explorer', 'staking_pro',
            'yield_farmer', 'altcoin_analyst', 'cryptopunks_fan', 'hodl_hero',
            'moon_hunter', 'doge_believer', 'ledger_lover', 'hash_hunter',
            'wallet_warrior', 'crypto_chad', 'coin_crusader', 'block_builder'
        ];

        // Генеруємо унікальні нікнейми для всіх переможців
        const shuffledUsernames = [...usernames].sort(() => 0.5 - Math.random()).slice(0, winnersCount);

        // Генеруємо переможців
        for (let i = 0; i < winnersCount; i++) {
            // Визначаємо приз в залежності від типу розіграшу і місця
            let prize = '';

            if (isUsdtRaffle) {
                // Розподіл призів для USDT розіграшу
                if (winnersCount === 10) {
                    // 250 USDT на 10 переможців
                    if (i === 0) prize = '125 USDT + 10000 WINIX';
                    else if (i === 1) prize = '75 USDT + 8000 WINIX';
                    else if (i === 2) prize = '50 USDT + 5000 WINIX';
                    else prize = '15000 WINIX';
                } else if (winnersCount === 5) {
                    // 100 USDT на 5 переможців
                    if (i === 0) prize = '40 USDT + 10000 WINIX';
                    else if (i === 1) prize = '20 USDT + 8000 WINIX';
                    else if (i === 2) prize = '15 USDT + 5000 WINIX';
                    else prize = '12.5 USDT + 4000 WINIX';
                } else {
                    // За замовчуванням
                    if (i === 0) prize = '20 USDT + 5000 WINIX';
                    else if (i === 1) prize = '10 USDT + 3000 WINIX';
                    else prize = '5 USDT + 2000 WINIX';
                }
            } else if (isWinixRaffle) {
                // Розподіл призів для WINIX розіграшу
                if (winnersCount === 15) {
                    // 30,000 WINIX на 15 переможців
                    prize = '2,000 WINIX';
                } else if (winnersCount === 5) {
                    // 20,000 WINIX на 5 переможців
                    if (i === 0) prize = '6,000 WINIX';
                    else if (i === 1) prize = '5,000 WINIX';
                    else if (i === 2) prize = '4,000 WINIX';
                    else prize = '2,500 WINIX';
                } else {
                    // За замовчуванням
                    if (i === 0) prize = '10,000 WINIX';
                    else if (i === 1) prize = '8,000 WINIX';
                    else if (i === 2) prize = '5,000 WINIX';
                    else prize = '2,000 WINIX';
                }
            } else {
                // За замовчуванням
                if (i === 0) prize = '1-е місце';
                else if (i === 1) prize = '2-е місце';
                else if (i === 2) prize = '3-є місце';
                else prize = 'Приз';
            }

            // Визначаємо, чи поточний користувач є переможцем
            // Для демонстрації вважаємо користувача 3-м переможцем, якщо він виграв
            const isCurrentUser = isWinner && i === 2;

            // Додаємо переможця
            winners.push({
                place: i + 1,
                username: isCurrentUser ? 'Ви' : shuffledUsernames[i],
                telegramUsername: isCurrentUser ? 'Ви' : '@' + shuffledUsernames[i],
                userId: isCurrentUser ? safeGetItem('userId', '12345678') : '1000' + Math.floor(Math.random() * 10000000),
                prize: prize,
                isCurrentUser: isCurrentUser
            });
        }

        return winners;
    }

    /**
     * Генерування HTML для списку переможців
     */
    function generateWinnersListHTML(winners) {
        // Перевіряємо, чи є переможці
        if (!winners || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        // Генеруємо HTML для кожного переможця
        return winners.map(winner => {
            // Визначаємо клас для місця (top-1, top-2, top-3)
            const placeClass = winner.place <= 3 ? `top-${winner.place}` : '';

            // Формуємо HTML для одного переможця
            return `
                <div class="winner-item ${winner.isCurrentUser ? 'current-user' : ''}">
                    <div class="winner-place ${placeClass}">
                        <span class="place-number">${winner.place}</span>
                    </div>
                    <div class="winner-info">
                        <div class="winner-name">${winner.username}</div>
                        ${winner.isCurrentUser ? '' : `<div class="winner-telegram">${winner.telegramUsername}</div>`}
                    </div>
                    <div class="winner-prize">${winner.prize}</div>
                </div>
            `;
        }).join('');
    }

    /**
 * Функція для створення модального вікна з деталями розіграшу
 */
/**
 * Функція для створення преміум-версії модального вікна для деталей розіграшу
 */
function createRaffleDetailsModal(raffleData) {
    console.log("Створення преміум-версії модального вікна для деталей розіграшу", raffleData);

    // Видаляємо існуюче модальне вікно, якщо воно є
    let existingModal = document.getElementById('raffle-history-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Перевіряємо і обробляємо вхідні дані
    raffleData = raffleData || {};

    const date = raffleData.date || '20.03.2025';
    const prize = raffleData.prize || '50 USDT • 10 переможців';
    const result = raffleData.result || 'Ви були серед переможців!';
    const status = raffleData.status || 'won';

    // Визначаємо тип розіграшу та кількість переможців
    const isUsdtRaffle = prize.includes('USDT');
    const isWinixRaffle = prize.includes('WINIX');

    // Правильно отримуємо кількість переможців з тексту
    let winnersCount = 10; // За замовчуванням
    if (prize.includes('10 переможців')) {
        winnersCount = 10;
    } else if (prize.includes('15 переможців')) {
        winnersCount = 15;
    } else if (prize.includes('5 переможців')) {
        winnersCount = 5;
    } else {
        // Намагаємося знайти цифру перед словом "переможців"
        const match = prize.match(/(\d+)\s+переможців/);
        if (match && match[1]) {
            winnersCount = parseInt(match[1]);
        }
    }

    // Створюємо модальне вікно
    const modal = document.createElement('div');
    modal.id = 'raffle-history-modal';
    modal.className = 'raffle-modal';

    // Правильно розподіляємо призи
    let prizes = [];
    let totalPrize = 0;

    // Визначаємо загальну суму призів
    if (isUsdtRaffle) {
        // Отримуємо суму USDT
        const usdtMatch = prize.match(/(\d+)\s*USDT/);
        if (usdtMatch && usdtMatch[1]) {
            totalPrize = parseInt(usdtMatch[1]);
        } else {
            totalPrize = 50; // За замовчуванням
        }

        // Розподіляємо USDT за місцями
        if (winnersCount === 10) {
            prizes = [
                "10 USDT", "8 USDT", "7 USDT", "5 USDT", "5 USDT",
                "4 USDT", "3 USDT", "3 USDT", "3 USDT", "2 USDT"
            ];
        } else if (winnersCount === 5) {
            prizes = ["20 USDT", "12 USDT", "8 USDT", "6 USDT", "4 USDT"];
        } else {
            // Створюємо власний розподіл
            prizes.push(`${Math.round(totalPrize * 0.25)} USDT`); // 1 місце: 25%
            prizes.push(`${Math.round(totalPrize * 0.20)} USDT`); // 2 місце: 20%
            prizes.push(`${Math.round(totalPrize * 0.15)} USDT`); // 3 місце: 15%

            // Розподіляємо решту 40% на інших переможців
            const remainingPrize = totalPrize - Math.round(totalPrize * 0.6);
            const prizePerPerson = Math.round(remainingPrize / (winnersCount - 3));

            for (let i = 3; i < winnersCount; i++) {
                prizes.push(`${prizePerPerson} USDT`);
            }
        }
    } else if (isWinixRaffle) {
        // Отримуємо суму WINIX
        const winixMatch = prize.match(/(\d+(?:,\d+)*)\s*(?:k\s*)?WINIX/);
        if (winixMatch && winixMatch[1]) {
            let winixAmount = winixMatch[1].replace(/,/g, '');
            if (prize.includes('k WINIX')) {
                totalPrize = parseInt(winixAmount) * 1000;
            } else {
                totalPrize = parseInt(winixAmount);
            }
        } else {
            totalPrize = 20000; // За замовчуванням
        }

        // Розподіляємо WINIX за місцями
        if (winnersCount === 15) {
            // Для 30,000 WINIX рівномірно
            const prizePerPerson = Math.round(totalPrize / winnersCount);
            for (let i = 0; i < winnersCount; i++) {
                prizes.push(`${prizePerPerson.toLocaleString()} WINIX`);
            }
        } else if (winnersCount === 5) {
            // Для 20,000 WINIX
            prizes = [
                "6,000 WINIX", "5,000 WINIX", "4,000 WINIX",
                "3,000 WINIX", "2,000 WINIX"
            ];
        } else {
            // Створюємо власний розподіл
            prizes.push(`${Math.round(totalPrize * 0.25).toLocaleString()} WINIX`); // 1 місце: 25%
            prizes.push(`${Math.round(totalPrize * 0.20).toLocaleString()} WINIX`); // 2 місце: 20%
            prizes.push(`${Math.round(totalPrize * 0.15).toLocaleString()} WINIX`); // 3 місце: 15%

            // Розподіляємо решту 40% на інших переможців
            const remainingPrize = totalPrize - Math.round(totalPrize * 0.6);
            const prizePerPerson = Math.round(remainingPrize / (winnersCount - 3));

            for (let i = 3; i < winnersCount; i++) {
                prizes.push(`${prizePerPerson.toLocaleString()} WINIX`);
            }
        }
    }

    // Формуємо список переможців у преміум-стилі
    let winnersHTML = '';

    // Визначаємо позицію користувача (за статусом)
    let userPosition = status === 'won' ? Math.floor(Math.random() * 3) : -1; // Якщо переміг, ставимо в топ-3

    // Створюємо повний список переможців
    for (let i = 0; i < winnersCount; i++) {
        const isCurrentUser = i === userPosition;
        const userId = isCurrentUser ? '12345678' : `${Math.floor(10000000 + Math.random() * 90000000)}`;
        const userName = isCurrentUser ? 'Ви' : `Учасник #${userId.substring(0, 5)}`;
        const prize = prizes[i] || (isUsdtRaffle ? "1 USDT" : "1,000 WINIX"); // Запасний варіант

        winnersHTML += `
            <div style="display: flex; align-items: center; background: ${isCurrentUser ? 'linear-gradient(145deg, rgba(30, 113, 161, 0.5), rgba(0, 201, 167, 0.3))' : 'rgba(30, 39, 70, 0.5)'};
                       border-radius: 8px; padding: 10px; margin-bottom: 8px; ${isCurrentUser ? 'border: 1px solid rgba(0, 201, 167, 0.5);' : ''}">
                <div style="width: 36px; height: 36px; min-width: 36px; background: ${i < 3 ? 
                          (i === 0 ? 'linear-gradient(145deg, #FFD700, #FFA500)' : 
                           i === 1 ? 'linear-gradient(145deg, #C0C0C0, #A9A9A9)' : 
                           'linear-gradient(145deg, #CD7F32, #A0522D)') : 
                          'rgba(0, 0, 0, 0.3)'};
                         border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-right: 12px;
                         ${i < 3 ? `box-shadow: 0 0 8px ${i === 0 ? 'rgba(255, 215, 0, 0.5)' : i === 1 ? 'rgba(192, 192, 192, 0.5)' : 'rgba(205, 127, 50, 0.5)'};` : ''}">
                    <span style="font-weight: bold; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${i + 1}</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: ${isCurrentUser ? '#FFD700' : 'white'};
                               ${isCurrentUser ? 'text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);' : ''}">
                        ${userName}
                    </div>
                    <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.7);">
                        ID: ${userId}
                    </div>
                </div>
                <div style="background: linear-gradient(90deg, #FFD700, #00C9A7); padding: 5px 10px; border-radius: 20px; 
                           font-weight: bold; color: #1A1A2E; font-size: 0.875rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">
                    ${prize}
                </div>
            </div>
        `;
    }

    // Додаємо прокрутку, якщо багато переможців
    const scrollStyle = winnersCount > 6 ? 'max-height: 280px; overflow-y: auto; padding-right: 8px;' : '';

    // Формуємо HTML для модального вікна
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Деталі розіграшу</h2>
                <span class="modal-close">×</span>
            </div>
            
            <div class="prize-details">
                <div class="detail-item">
                    <div class="detail-label">Дата:</div>
                    <div class="detail-value">${date}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Приз:</div>
                    <div class="detail-value">${prize}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Статус:</div>
                    <div class="detail-value ${status}">${result}</div>
                </div>
            </div>
            
            <div class="participation-info">
                <h3>Переможці</h3>
                <div style="margin-top: 16px; ${scrollStyle}">
                    ${winnersHTML}
                </div>
            </div>
            
            <button class="join-button" id="close-history-btn">ЗАКРИТИ</button>
        </div>
    `;

    // Додаємо модальне вікно на сторінку
    document.body.appendChild(modal);

    // Додаємо обробники подій
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
        });
    }

    const closeActionButton = modal.querySelector('#close-history-btn');
    if (closeActionButton) {
        closeActionButton.addEventListener('click', function() {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
        });
    }

    // Показуємо модальне вікно
    requestAnimationFrame(() => {
        modal.classList.add('open');
    });

    return modal;
}

    /**
     * Покращене відображення історії розіграшів
     */
    function enhanceRaffleHistory() {
        console.log("Покращення відображення історії розіграшів");

        // Перевіряємо, чи є історія в localStorage
        let history = JSON.parse(safeGetItem('raffleHistory', '[]'));

        // Якщо історія порожня, створюємо демонстраційні дані
        if (history.length === 0) {
            history = [
                {
                    date: '20.03.2025',
                    prize: '250 USDT + 130k WINIX • 10 переможців',
                    result: 'Ви були серед переможців!',
                    status: 'won',
                    winners: generateRealWinners(true, true, 10, 'won')
                },
                {
                    date: '15.03.2025',
                    prize: '30,000 WINIX • 15 переможців',
                    result: 'Ви були учасником',
                    status: 'participated',
                    winners: generateRealWinners(false, true, 15, 'participated')
                },
                {
                    date: '01.03.2025',
                    prize: '100 USDT + 50k WINIX • 5 переможців',
                    result: 'Ви були учасником',
                    status: 'participated',
                    winners: generateRealWinners(true, true, 5, 'participated')
                }
            ];

            // Зберігаємо демонстраційні дані
            safeSetItem('raffleHistory', JSON.stringify(history));
        }

        // Знаходимо контейнер для історії
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;

        // Очищаємо контейнер
        historyContainer.innerHTML = '';

        // Додаємо кожен запис історії
        history.forEach((item, index) => {
            const historyCard = document.createElement('div');
            historyCard.className = 'history-card';
            historyCard.innerHTML = `
                <div class="history-date">${item.date}</div>
                <div class="history-prize">${item.prize}</div>
                <div class="history-winners">${item.result}</div>
                <div class="history-status ${item.status}">${item.status === 'won' ? 'Виграно' : 'Участь'}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            `;

            // Додаємо стилі та обробник кліку
            historyCard.style.cursor = 'pointer';
            historyCard.addEventListener('click', () => {
                console.log(`Клік на карточці історії #${index + 1}`, history[index]);
                createRaffleDetailsModal(history[index]);
            });

            // Додаємо картку до контейнера
            historyContainer.appendChild(historyCard);
        });

        console.log("Історію розіграшів успішно покращено");
    }

    /**
     * Перевизначення функції відкриття деталей розіграшу
     */
    function overrideOpenRaffleDetails() {
        console.log("Перевизначення функції відкриття деталей розіграшу");

        window.openRaffleDetails = function(raffleId, raffleType) {
            console.log(`Відкриття деталей розіграшу: ${raffleId}, тип: ${raffleType}`);

            const coinsBalance = getCoinsBalance();

            if (coinsBalance < 1) {
                showToast(getLocalizedText(
                    'Для участі в розіграші потрібен щонайменше 1 жетон',
                    'Для участия в розыгрыше нужен минимум 1 жетон',
                    'You need at least 1 coin to participate in the raffle'
                ), 3000);
                return;
            }

            const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
            const modal = document.getElementById(modalId);
            if (!modal) {
                console.error(`Модальне вікно з id ${modalId} не знайдено`);
                return;
            }

            const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
            const input = document.getElementById(inputId);
            if (input) input.value = '1';

            const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
            const joinBtn = document.getElementById(btnId);
            if (joinBtn) {
                joinBtn.setAttribute('data-raffle-id', raffleId);
                joinBtn.setAttribute('data-raffle-type', raffleType);
            }

            // Отримуємо актуальні дані про розіграші
            const raffleData = getRaffleData();
            const mainCount = raffleData.mainRaffleParticipants || 0;
            const dailyCount = raffleData.dailyRaffleParticipants || 0;

            // Оновлюємо дані в модальному вікні
            if (raffleType === 'daily') {
                const titleElement = document.getElementById('daily-modal-title');
                if (titleElement) titleElement.textContent = getLocalizedText('Щоденний розіграш', 'Ежедневный розыгрыш', 'Daily Giveaway');

                const prizeElement = document.getElementById('daily-prize-value');
                if (prizeElement) prizeElement.textContent = '30,000 WINIX (15 переможців)';

                const participantsElement = document.getElementById('daily-participants');
                if (participantsElement) participantsElement.textContent = dailyCount.toString();
            } else {
                const titleElement = document.getElementById('main-modal-title');
                if (titleElement) titleElement.textContent = getLocalizedText('Гранд Розіграш', 'Гранд Розыгрыш', 'Grand Giveaway');

                const prizeElement = document.getElementById('main-prize-value');
                if (prizeElement) prizeElement.textContent = '250 USDT + 130,000 WINIX (10 переможців)';

                const participantsElement = document.getElementById('main-participants');
                if (participantsElement) participantsElement.textContent = mainCount.toString();
            }

            // Оновлюємо дати закінчення розіграшів
            updateRaffleEndDates();

            // Відкриваємо модальне вікно
            modal.classList.add('open');
        };
    }

    // ====== СИСТЕМА БЕЙДЖІВ ======

    /**
     * Функція для видачі нагороди за бейдж
     */
    function giveRewardForBadge(badgeType, rewardAmount) {
        console.log(`Запуск видачі нагороди за бейдж ${badgeType}: ${rewardAmount} WINIX`);

        // Перевіряємо, чи бейдж вже отримано
        const storageKey = `badge_${badgeType}_claimed`;
        if (safeGetItem(storageKey, 'false') === 'true') {
            console.log(`Бейдж ${badgeType} вже отримано раніше`);
            return false;
        }

        // Додаємо токени WINIX
        const success = addTokens(rewardAmount, getLocalizedText(
            `Нагорода за бейдж "${getBadgeName(badgeType)}"`,
            `Награда за бейдж "${getBadgeName(badgeType)}"`,
            `Reward for "${getBadgeName(badgeType)}" badge`
        ));

        // Якщо нагороду видано успішно
        if (success) {
            // Позначаємо бейдж як отриманий
            safeSetItem(storageKey, 'true');

            // Візуально оновлюємо бейдж
            const badgeElement = document.querySelector(`.badge-item:nth-child(${getBadgeIndex(badgeType)})`);
            if (badgeElement) {
                badgeElement.classList.add('badge-completed');
                addWatermarkToBadge(badgeElement);
            }

            // Показуємо повідомлення про отримання нагороди
            showToast(getLocalizedText(
                `Вітаємо! Ви отримали ${rewardAmount} WINIX за бейдж "${getBadgeName(badgeType)}"!`,
                `Поздравляем! Вы получили ${rewardAmount} WINIX за бейдж "${getBadgeName(badgeType)}"!`,
                `Congratulations! You received ${rewardAmount} WINIX for the "${getBadgeName(badgeType)}" badge!`
            ));

            console.log(`✅ Бейдж "${badgeType}" успішно отримано з нагородою ${rewardAmount} WINIX`);
            return true;
        }

        console.warn(`⚠️ Не вдалося нарахувати нагороду за бейдж ${badgeType}`);
        return false;
    }

    /**
     * Отримання індексу елемента бейджа
     */
    function getBadgeIndex(badgeType) {
        switch (badgeType) {
            case 'winner': return 1;
            case 'beginner': return 2;
            case 'rich': return 3;
            default: return 1;
        }
    }

    /**
     * Отримання назви бейджа для відображення
     */
    function getBadgeName(badgeType) {
        const lang = getCurrentLanguage();

        switch (badgeType) {
            case 'winner':
                return lang === 'ru' ? 'Победитель' : (lang === 'en' ? 'Winner' : 'Переможець');
            case 'beginner':
                return lang === 'ru' ? 'Новичок' : (lang === 'en' ? 'Beginner' : 'Початківець');
            case 'rich':
                return lang === 'ru' ? 'Богач' : (lang === 'en' ? 'Rich' : 'Багатій');
            default:
                return badgeType;
        }
    }

    /**
     * Додавання водяного знака до бейджа
     */
    function addWatermarkToBadge(badgeElement) {
        // Перевіряємо, чи вже є водяний знак
        if (badgeElement.querySelector('.badge-watermark')) {
            return;
        }

        // Створюємо водяний знак
        const watermark = document.createElement('div');
        watermark.className = 'badge-watermark';

        // Визначаємо текст для водяного знаку
        const watermarkText = getLocalizedText('ОТРИМАНО', 'ПОЛУЧЕНО', 'RECEIVED');

        // Створюємо елемент тексту
        const textElement = document.createElement('div');
        textElement.className = 'badge-watermark-text';
        textElement.textContent = watermarkText;

        // Додаємо елементи
        watermark.appendChild(textElement);
        badgeElement.style.position = 'relative';
        badgeElement.appendChild(watermark);
    }

    /**
     * Позначення отриманих бейджів
     */
    function markCompletedBadges() {
        console.log("Позначення отриманих бейджів");

        const badges = [
            {selector: '.badge-item:nth-child(1)', storageKey: 'badge_winner_claimed'},
            {selector: '.badge-item:nth-child(2)', storageKey: 'badge_beginner_claimed'},
            {selector: '.badge-item:nth-child(3)', storageKey: 'badge_rich_claimed'}
        ];

        badges.forEach(badge => {
            if (safeGetItem(badge.storageKey, 'false') === 'true') {
                const badgeElement = document.querySelector(badge.selector);
                if (!badgeElement) return;

                // Додаємо клас для стилізації
                badgeElement.classList.add('badge-completed');

                // Додаємо водяний знак, якщо його ще немає
                if (!badgeElement.querySelector('.badge-watermark')) {
                    addWatermarkToBadge(badgeElement);
                }
            }
        });
    }

    /**
     * Заміна емоджі бейджів на зображення
     */
    function replaceBadgeEmojisWithImages() {
        console.log("Заміна емоджі на зображення бейджів");

        const badgeImages = [
            {
                selector: '.badge-item:nth-child(1) .badge-icon', // Переможець
                imagePath: 'assets/badge-winner.png',
                altText: getBadgeName('winner')
            },
            {
                selector: '.badge-item:nth-child(2) .badge-icon', // Початківець
                imagePath: 'assets/badge-beginner.png',
                altText: getBadgeName('beginner')
            },
            {
                selector: '.badge-item:nth-child(3) .badge-icon', // Багатій
                imagePath: 'assets/badge-rich.png',
                altText: getBadgeName('rich')
            }
        ];

        badgeImages.forEach(badge => {
            const badgeIcon = document.querySelector(badge.selector);
            if (!badgeIcon) return;

            // Перевіряємо, чи є вже зображення
            if (badgeIcon.querySelector('img')) return;

            // Зберігаємо клас locked, якщо він є
            const isLocked = badgeIcon.classList.contains('locked');

            // Очищаємо контейнер від емоджі
            const originalContent = badgeIcon.innerHTML;
            badgeIcon.innerHTML = '';

            // Створюємо елемент зображення
            const img = document.createElement('img');
            img.src = badge.imagePath;
            img.alt = badge.altText;
            img.className = 'badge-image';

            // Додаємо обробник помилки для відновлення оригінального контенту
            img.onerror = function() {
                console.error(`Помилка завантаження зображення: ${badge.imagePath}`);
                badgeIcon.innerHTML = originalContent;
            };

            // Додаємо зображення
            badgeIcon.appendChild(img);

            // Якщо бейдж був заблокований, додаємо значок замка
            if (isLocked) {
                const lockIcon = document.createElement('div');
                lockIcon.className = 'lock-icon';
                lockIcon.textContent = '🔒';
                badgeIcon.appendChild(lockIcon);
            }
        });
    }

    /**
     * Перевірка усіх бейджів і видача нагород за них, якщо умови виконані
     */
    function checkAllBadges() {
        console.log("🏆 Перевірка умов для всіх бейджів...");

        try {
            // Отримуємо статистику користувача
            const statistics = JSON.parse(safeGetItem('userStatistics', '{}'));
            const participationsCount = statistics.participationsCount || 0;
            const winsCount = statistics.winsCount || 0;
            const currentBalance = getTokensBalance();

            console.log("Поточна статистика:", {
                participationsCount,
                winsCount,
                currentBalance
            });

            // Перевіряємо бейдж "Початківець" (умова: 5 участей)
            if (participationsCount >= 5 && safeGetItem('badge_beginner_claimed', 'false') !== 'true') {
                console.log("Умова для бейджа 'Початківець' виконана");
                giveRewardForBadge('beginner', 1000);
            }

            // Перевіряємо бейдж "Переможець" (умова: хоча б 1 перемога)
            if (winsCount > 0 && safeGetItem('badge_winner_claimed', 'false') !== 'true') {
                console.log("Умова для бейджа 'Переможець' виконана");
                giveRewardForBadge('winner', 2500);
            }

            // Перевіряємо бейдж "Багатій" (умова: баланс 50,000 WINIX)
            if (currentBalance >= 50000 && safeGetItem('badge_rich_claimed', 'false') !== 'true') {
                console.log("Умова для бейджа 'Багатій' виконана");
                giveRewardForBadge('rich', 5000);
            }

            // Оновлюємо відображення всіх бейджів
            markCompletedBadges();
            replaceBadgeEmojisWithImages();
        } catch (error) {
            console.error("Помилка при перевірці бейджів:", error);
        }
    }

    // ====== ФУНКЦІЯ БОНУСУ НОВАЧКА ======

    /**
     * Функція отримання бонусу новачка
     */
    function claimNewbieBonus() {
        // Перевіряємо, чи вже отримано бонус
        if (safeGetItem('newbie_bonus_claimed', 'false') === 'true') {
            showToast(getLocalizedText(
                'Ви вже отримали бонус новачка!',
                'Вы уже получили бонус новичка!',
                'You have already received the newbie bonus!'
            ), 3000);
            return;
        }

        // Показуємо індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        // Додаємо затримку для кращого UX
        setTimeout(() => {
            try {
                // Повторна перевірка
                if (safeGetItem('newbie_bonus_claimed', 'false') === 'true') {
                    showToast(getLocalizedText(
                        'Ви вже отримали бонус новачка!',
                        'Вы уже получили бонус новичка!',
                        'You have already received the newbie bonus!'
                    ), 3000);
                    if (spinner) spinner.classList.remove('show');
                    return;
                }

                // Сума бонусу
                const bonusAmount = 150;

                // Додаємо бонус
                addTokens(bonusAmount, getLocalizedText(
                    'Бонус новачка',
                    'Бонус новичка',
                    'Newbie bonus'
                ));

                // Позначаємо як отриманий
                safeSetItem('newbie_bonus_claimed', 'true');

                // Показуємо повідомлення
                showToast(getLocalizedText(
                    `Вітаємо! Ви отримали ${bonusAmount} WINIX як бонус новачка!`,
                    `Поздравляем! Вы получили ${bonusAmount} WINIX как бонус новичка!`,
                    `Congratulations! You received ${bonusAmount} WINIX as a newbie bonus!`
                ), 3000);

                // Оновлюємо кнопку
                const newbieButtons = document.querySelectorAll('.mini-raffle-button[data-raffle-id="newbie"]');
                newbieButtons.forEach(button => {
                    button.textContent = getLocalizedText('Отримано', 'Получено', 'Received');
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'default';
                });

                // Додаємо водяний знак до контейнера, якщо можливо
                setTimeout(() => {
                    markNewbieBonus();
                }, 300);

            } catch (error) {
                console.error('Помилка при отриманні бонусу новачка:', error);
                showToast(getLocalizedText(
                    'Сталася помилка при отриманні бонусу',
                    'Произошла ошибка при получении бонуса',
                    'An error occurred while receiving the bonus'
                ), 3000);
            } finally {
                // Ховаємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');
            }
        }, 1000);
    }

    /**
     * Функція для пошуку і маркування блоку бонусу новачка
     */
    function markNewbieBonus() {
        // Перевіряємо, чи бонус вже отримано
        if (safeGetItem('newbie_bonus_claimed', 'false') !== 'true') {
            return;
        }

        console.log("Пошук блоку бонусу новачка для додавання водяного знаку");

        // Визначаємо текст для водяного знаку
        const watermarkText = getLocalizedText('ОТРИМАНО', 'ПОЛУЧЕНО', 'RECEIVED');

        // Шукаємо контейнер з бонусом новачка
        let foundContainer = false;

        // 1. Шукаємо за атрибутом data-raffle-id
        const newbieButtons = document.querySelectorAll('.mini-raffle-button[data-raffle-id="newbie"]');
        newbieButtons.forEach(button => {
            const container = button.closest('.mini-raffle');
            if (container) {
                addWatermarkToContainer(container, watermarkText);
                foundContainer = true;
            }
        });

        // 2. Якщо не знайшли, шукаємо за текстом
        if (!foundContainer) {
            const allContainers = document.querySelectorAll('.mini-raffle');
            allContainers.forEach(container => {
                const text = container.textContent.toLowerCase();

                if (text.includes('бонус новачкам') ||
                    text.includes('бонус новичкам') ||
                    text.includes('newbie bonus') ||
                    (text.includes('бонус') && text.includes('150 winix')) ||
                    (text.includes('bonus') && text.includes('150 winix'))) {

                    addWatermarkToContainer(container, watermarkText);
                    foundContainer = true;
                }
            });
        }

        console.log(foundContainer ? "Знайдено і позначено блок бонусу новачка" : "Блок бонусу новачка не знайдено");
    }

    /**
     * Додавання водяного знаку до контейнера
     */
    function addWatermarkToContainer(container, text) {
        // Перевіряємо, чи вже є водяний знак
        if (container.querySelector('.danger-watermark')) {
            return;
        }

        // Додаємо клас до контейнера
        container.classList.add('has-watermark');

        // Створюємо основний контейнер водяного знаку
        const watermark = document.createElement('div');
        watermark.className = 'danger-watermark';
        watermark.style.position = 'absolute';
        watermark.style.top = '0';
        watermark.style.left = '0';
        watermark.style.right = '0';
        watermark.style.bottom = '0';
        watermark.style.display = 'flex';
        watermark.style.justifyContent = 'center';
        watermark.style.alignItems = 'center';
        watermark.style.pointerEvents = 'none';
        watermark.style.overflow = 'hidden';

        // Створюємо темний напівпрозорий фон
        const overlay = document.createElement('div');
        overlay.className = 'danger-watermark-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';

        // Створюємо текстову стрічку
        const textElement = document.createElement('div');
        textElement.className = 'danger-watermark-text';
        textElement.textContent = text;
        textElement.style.position = 'absolute';
        textElement.style.width = '250%';
        textElement.style.textAlign = 'center';
        textElement.style.transform = 'rotate(-35deg)';
        textElement.style.fontSize = '24px';
        textElement.style.fontWeight = '900';
        textElement.style.letterSpacing = '2px';
        textElement.style.color = 'black';
        textElement.style.background = 'repeating-linear-gradient(45deg, rgba(255, 205, 0, 0.8), rgba(255, 205, 0, 0.8) 10px, rgba(0, 0, 0, 0.8) 10px, rgba(0, 0, 0, 0.8) 20px)';
        textElement.style.padding = '10px 0';
        textElement.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
        textElement.style.textShadow = '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white';
        textElement.style.whiteSpace = 'nowrap';

        // Збираємо все разом
        watermark.appendChild(overlay);
        watermark.appendChild(textElement);

        // Додаємо стиль position до контейнера, якщо його немає
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(watermark);

        // Знаходимо кнопку і деактивуємо її
        const button = container.querySelector('.mini-raffle-button');
        if (button) {
            // Змінюємо текст
            button.textContent = getLocalizedText('Отримано', 'Получено', 'Received');

            // Деактивуємо кнопку
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'default';
            button.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
            button.style.backgroundImage = 'none';

            // Прибираємо обробники подій
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // Додаємо обробник, який показує повідомлення
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                showToast(getLocalizedText(
                    'Ви вже отримали бонус новачка!',
                    'Вы уже получили бонус новичка!',
                    'You have already received the newbie bonus!'
                ), 2000);

                return false;
            });
        }
    }

    // ====== НАЛАШТУВАННЯ КНОПОК РОЗІГРАШІВ ======

    /**
     * Функція для налаштування кнопок розіграшів
     */
    function setupRaffleButtons() {
        console.log("Налаштування кнопок розіграшів");

        // Кнопки основних розіграшів
        const joinButtons = document.querySelectorAll('.join-button[data-raffle-id]');
        joinButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type') || 'main';
                openRaffleDetails(raffleId, raffleType);
            });
        });

        // Кнопки міні-розіграшів
        const miniButtons = document.querySelectorAll('.mini-raffle-button[data-raffle-id]');
        miniButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type') || 'daily';

                if (raffleId === 'newbie') {
                    claimNewbieBonus();
                } else {
                    openRaffleDetails(raffleId, raffleType);
                }
            });
        });

        // Кнопки в модальних вікнах
        const modalMainJoinBtn = document.getElementById('main-join-btn');
        if (modalMainJoinBtn) {
            const newMainJoinBtn = modalMainJoinBtn.cloneNode(true);
            modalMainJoinBtn.parentNode.replaceChild(newMainJoinBtn, modalMainJoinBtn);

            newMainJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                participateInRaffle(raffleId, raffleType, 'main-token-amount');
            });
        }

        const modalDailyJoinBtn = document.getElementById('daily-join-btn');
        if (modalDailyJoinBtn) {
            const newDailyJoinBtn = modalDailyJoinBtn.cloneNode(true);
            modalDailyJoinBtn.parentNode.replaceChild(newDailyJoinBtn, modalDailyJoinBtn);

            newDailyJoinBtn.addEventListener('click', function() {
                const raffleId = this.getAttribute('data-raffle-id');
                const raffleType = this.getAttribute('data-raffle-type');
                participateInRaffle(raffleId, raffleType, 'daily-token-amount');
            });
        }

        console.log("Всі кнопки розіграшів успішно налаштовано");
    }

    // ====== ІНІЦІАЛІЗАЦІЯ СИСТЕМИ ВИПРАВЛЕНЬ ======

    /**
     * Синхронізація ключів у локальному сховищі
     */
    function syncLocalStorageKeys() {
        console.log("Синхронізація ключів у локальному сховищі");

        // Мапа ключів, які потрібно синхронізувати
        const keyMap = {
            // Баланс жетонів
            'userCoins': 'winix_coins',

            // Баланс WINIX
            'userTokens': 'winix_balance',

            // Транзакції
            'transactions': 'winix_transactions',

            // Участь в розіграшах
            'currentParticipations': 'winix_participations',

            // Інші налаштування
            'userLanguage': 'winix_language'
        };

        // Проходимо по всіх парах ключів
        for (const [key1, key2] of Object.entries(keyMap)) {
            try {
                const value1 = safeGetItem(key1, null);
                const value2 = safeGetItem(key2, null);

                // Якщо обидва ключі мають значення, але значення не збігаються
                if (value1 !== null && value2 !== null && value1 !== value2) {
                    // Для чисел вибираємо більше значення
                    if (!isNaN(parseFloat(value1)) && !isNaN(parseFloat(value2))) {
                        const num1 = parseFloat(value1);
                        const num2 = parseFloat(value2);
                        const maxValue = Math.max(num1, num2).toString();

                        safeSetItem(key1, maxValue);
                        safeSetItem(key2, maxValue);
                        console.log(`Синхронізовано числові значення для ${key1}/${key2}: ${maxValue}`);
                    }
                    // Для JSON-даних потрібен спеціальний підхід
                    else if ((key1 === 'transactions' || key2 === 'transactions') &&
                            (value1.startsWith('[') || value2.startsWith('['))) {
                        try {
                            // Парсимо обидва значення
                            const data1 = JSON.parse(value1);
                            const data2 = JSON.parse(value2);

                            // Вибираємо той масив, який має більше елементів
                            if (Array.isArray(data1) && Array.isArray(data2)) {
                                const result = data1.length >= data2.length ? data1 : data2;
                                const jsonResult = JSON.stringify(result);

                                safeSetItem(key1, jsonResult);
                                safeSetItem(key2, jsonResult);
                                console.log(`Синхронізовано JSON-дані для ${key1}/${key2}`);
                            }
                        } catch (e) {
                            console.error(`Помилка при синхронізації JSON-даних для ${key1}/${key2}:`, e);
                        }
                    }
                    // Для інших типів даних просто копіюємо з першого ключа
                    else {
                        safeSetItem(key2, value1);
                        console.log(`Скопійовано значення з ${key1} в ${key2}: ${value1}`);
                    }
                }
                // Якщо один з ключів має значення, а інший - ні
                else if (value1 !== null && value2 === null) {
                    safeSetItem(key2, value1);
                    console.log(`Скопійовано значення з ${key1} в ${key2}: ${value1}`);
                }
                else if (value1 === null && value2 !== null) {
                    safeSetItem(key1, value2);
                    console.log(`Скопійовано значення з ${key2} в ${key1}: ${value2}`);
                }
            } catch (e) {
                console.error(`Помилка при синхронізації ключів ${key1}/${key2}:`, e);
            }
        }

        console.log("Синхронізацію ключів у локальному сховищі завершено");
    }

    /**
     * Головна функція ініціалізації системи виправлень
     */
    function initSystem() {
        console.log("🚀 Запуск ініціалізації системи виправлень WINIX");

        try {
            // 1. Синхронізуємо ключі в localStorage
            syncLocalStorageKeys();


            // 3. Виправляємо кнопки закриття модальних вікон
            fixCloseButtons();


            // 5. Оновлюємо кількість учасників в розіграшах
            updateRaffleParticipantsCount();

            // 6. Оновлюємо дати закінчення розіграшів
            updateRaffleEndDates();

            // 7. Перевизначаємо функцію відкриття деталей розіграшу
            overrideOpenRaffleDetails();

            // 8. Налаштовуємо всі кнопки розіграшів
            setupRaffleButtons();

            // 9. Позначаємо отримані бейджі
            markCompletedBadges();

            // 10. Замінюємо емоджі бейджів на зображення
            replaceBadgeEmojisWithImages();

            // 11. Перевіряємо і видаємо нагороди за бейджі
            checkAllBadges();

            // 12. Позначаємо блоки бонусу новачка, якщо вони є
            markNewbieBonus();

            // 13. Покращуємо історію розіграшів, якщо вона є на сторінці
            const tabButton = document.querySelector('.tab-button[data-tab="past"]');
            if (tabButton || document.getElementById('history-container')) {
                enhanceRaffleHistory();

                // Додаємо обробник для вкладки "Минулі"
                if (tabButton) {
                    tabButton.addEventListener('click', function() {
                        setTimeout(enhanceRaffleHistory, 300);
                    });
                }
            }
            // Додаткова фіксація щоденних модальних вікон для гарантії
const dailyModal = document.getElementById('daily-raffle-modal');
if (dailyModal) {
    const dailyCloseBtn = dailyModal.querySelector('.modal-close');
    if (dailyCloseBtn) {
        dailyCloseBtn.addEventListener('click', function() {
            dailyModal.classList.remove('open');
        });
    }

    const dailyCloseActionBtn = dailyModal.querySelector('#daily-close-btn, button:contains ("Закрити")');
    if (dailyCloseActionBtn) {
        dailyCloseActionBtn.addEventListener('click', function() {
            dailyModal.classList.remove('open');
        });
    }
}

            // 14. Якщо користувач знаходиться на вкладці "Минулі", оновимо її відображення
            if (document.querySelector('.tab-button[data-tab="past"].active') ||
                document.getElementById('past-raffles')?.classList.contains('active')) {
                setTimeout(enhanceRaffleHistory, 500);
            }

            console.log("✅ Систему виправлень WINIX успішно ініціалізовано");

            // Показуємо повідомлення про успішне застосування виправлень
            setTimeout(() => {
                showToast(getLocalizedText(
                    'Систему розіграшів WINIX успішно покращено',
                    'Система розыгрышей WINIX успешно улучшена',
                    'WINIX raffle system has been successfully enhanced'
                ), 3000);
            }, 2000);

            return true;
        } catch (error) {
            console.error("❌ Помилка ініціалізації системи виправлень:", error);
            return false;
        }
    }
    // Встановлюємо інтервал для оновлення прогрес-бару кожну хвилину
setInterval(() => {
    // Отримуємо актуальну дату закінчення розіграшу
    const endDates = updateRaffleEndDates();
    if (endDates && endDates.mainEndDate) {
        updateProgressBar(endDates.mainEndDate);
    }
}, 60000); // 60000 мс = 1 хвилина

    // Експортуємо основні функції для доступу ззовні
    window.winixUnifiedFixes = {
        participateInRaffle,
        createRaffleDetailsModal,
        claimNewbieBonus,
        checkAllBadges,
        markCompletedBadges,
        giveRewardForBadge,
        enhanceRaffleHistory
    };

    // Запускаємо ініціалізацію при завантаженні DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSystem);
    } else {
        // Якщо DOM вже завантажено, запускаємо з невеликою затримкою
        setTimeout(initSystem, 100);
    }

    // Повторно запускаємо ініціалізацію через 1.5 секунди для гарантії
    setTimeout(initSystem, 1500);
})();
