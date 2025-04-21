/**
 * WINIX - Система розіграшів (interface-updater.js)
 * Модуль для оновлення інтерфейсу після дій користувача
 * Виправлено проблеми з асинхронним оновленням учасників і переможців
 * @version 1.1.0
 */

(function() {
    'use strict';

    // Перевірка наявності головного модуля розіграшів
    if (typeof window.WinixRaffles === 'undefined') {
        console.error('❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше interface-updater.js');
        return;
    }

    // Модуль для оновлення інтерфейсу
    const interfaceUpdater = {
        // Лічильник оновлень для відстеження
        updateCounter: 0,

        // Час останнього оновлення
        lastUpdateTime: 0,

        // Мінімальний інтервал між оновленнями (мс)
        minUpdateInterval: 300,

        // Запланована затримка оновлення
        updateDebounceTimeout: null,

        // Стан блокування інтерфейсу
        isUILocked: false,

        // Кеш останніх відомих значень для уникнення гонок
        lastKnownValues: {
            // Учасники за розіграшем
            participants: {},
            // Переможці за розіграшем
            winners: {},
            // Останній відомий баланс
            balance: null,
            // Час останнього оновлення балансу
            balanceUpdateTime: 0,
            // Останні відомі білети за розіграшем
            tickets: {}
        },

        /**
         * Ініціалізація модуля
         */
        init: function() {
            console.log('🔄 Ініціалізація модуля оновлення інтерфейсу...');

            // Додаємо обробники подій
            this.setupEventHandlers();

            // Створюємо стилі для анімацій оновлення
            this.createUpdateAnimationStyles();

            // Запускаємо відкладене оновлення для виявлення розбіжностей
            setTimeout(() => {
                this.verifyAndCorrectDisplayData();
            }, 2000);
        },

        /**
         * Налаштування обробників подій
         */
        setupEventHandlers: function() {
            // Обробник події успішної участі в розіграші
            document.addEventListener('raffle-participation', (event) => {
                if (event.detail && event.detail.successful) {
                    this.handleSuccessfulParticipation(event.detail);
                }
            });

            // Обробник події оновлення балансу користувача
            document.addEventListener('balance-updated', (event) => {
                if (event.detail && typeof event.detail.newBalance === 'number') {
                    this.updateUserBalanceDisplay(event.detail.newBalance, event.detail.oldBalance);

                    // Запам'ятовуємо останній відомий баланс
                    this.lastKnownValues.balance = event.detail.newBalance;
                    this.lastKnownValues.balanceUpdateTime = Date.now();
                }
            });

            // Обробник події оновлення даних користувача
            document.addEventListener('user-data-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    // Оновлюємо баланс, якщо він включений в дані
                    if (typeof event.detail.userData.coins === 'number') {
                        this.updateUserBalanceDisplay(event.detail.userData.coins);

                        // Запам'ятовуємо останній відомий баланс
                        this.lastKnownValues.balance = event.detail.userData.coins;
                        this.lastKnownValues.balanceUpdateTime = Date.now();
                    }

                    // Оновлюємо відображення кнопок участі, якщо дані змінилися
                    if (window.WinixRaffles.participation) {
                        window.WinixRaffles.participation.updateParticipationButtons();
                    }
                }
            });

            // Обробник видимості сторінки (для оновлення при поверненні)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Оновлюємо дані при поверненні на вкладку
                    this.scheduleUIUpdate();

                    // Перевіряємо правильність відображення даних
                    setTimeout(() => {
                        this.verifyAndCorrectDisplayData();
                    }, 1000);
                }
            });

            // Обробник після завершення завантаження розіграшів
            document.addEventListener('raffles-loaded', () => {
                // Додаємо кнопки деталей до розіграшів
                this.addDetailsButtons();

                // Перевіряємо та виправляємо дані відображення
                setTimeout(() => {
                    this.verifyAndCorrectDisplayData();
                }, 500);
            });

            // Обробник для оновлення учасників і переможців
            document.addEventListener('raffle-participants-updated', (event) => {
                if (event.detail && event.detail.raffleId && typeof event.detail.participantsCount === 'number') {
                    // Оновлюємо кількість учасників для розіграшу
                    this.updateRaffleParticipantsCount(
                        event.detail.raffleId,
                        event.detail.participantsCount
                    );

                    // Запам'ятовуємо останнє значення
                    this.lastKnownValues.participants[event.detail.raffleId] = event.detail.participantsCount;
                }

                // Якщо передано кількість переможців, оновлюємо і її
                if (event.detail && event.detail.raffleId && typeof event.detail.winnersCount === 'number') {
                    this.updateRaffleWinnersCount(
                        event.detail.raffleId,
                        event.detail.winnersCount
                    );

                    // Запам'ятовуємо останнє значення
                    this.lastKnownValues.winners[event.detail.raffleId] = event.detail.winnersCount;
                }
            });
        },

        /**
         * Перевірка та виправлення даних відображення
         * Викликається періодично для виявлення та виправлення розбіжностей
         */
        verifyAndCorrectDisplayData: function() {
            // Перевіряємо, чи є оновлення у процесі
            if (this.isUILocked) {
                return;
            }

            // Встановлюємо блокування на час перевірки
            this.isUILocked = true;

            try {
                // 1. Перевіряємо правильність відображення балансу
                this.verifyBalanceDisplay();

                // 2. Перевіряємо правильність відображення учасників
                this.verifyParticipantsDisplay();

                // 3. Перевіряємо правильність відображення кнопок участі
                if (window.WinixRaffles.participation) {
                    window.WinixRaffles.participation.updateParticipationButtons();
                }

                // 4. Додаємо кнопки деталей, якщо вони відсутні
                this.addDetailsButtons();
            } catch (error) {
                console.error('❌ Помилка перевірки даних відображення:', error);
            } finally {
                // Знімаємо блокування
                this.isUILocked = false;
            }
        },

        /**
         * Перевірка правильності відображення балансу
         */
        verifyBalanceDisplay: function() {
            // Отримуємо поточне відображення балансу
            const userCoinsElement = document.getElementById('user-coins');
            if (!userCoinsElement) return;

            const displayedBalance = parseInt(userCoinsElement.textContent) || 0;

            // Спроба отримати актуальний баланс
            let actualBalance = null;

            // 1. Спробуємо отримати з кешу
            if (this.lastKnownValues.balance !== null &&
                Date.now() - this.lastKnownValues.balanceUpdateTime < 30000) { // 30 секунд
                actualBalance = this.lastKnownValues.balance;
            }

            // 2. Спробуємо отримати з localStorage
            if (actualBalance === null) {
                actualBalance = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins')) || 0;
            }

            // 3. Якщо є розбіжність, оновлюємо відображення
            if (displayedBalance !== actualBalance && actualBalance > 0) {
                console.log(`⚠️ Виявлено розбіжність балансу: відображається ${displayedBalance}, має бути ${actualBalance}`);
                this.updateUserBalanceDisplay(actualBalance, displayedBalance);
            }
        },

        /**
         * Перевірка правильності відображення кількості учасників
         */
        verifyParticipantsDisplay: function() {
            // Отримуємо всі активні розіграші
            const activeRaffles = window.WinixRaffles.state.activeRaffles || [];

            activeRaffles.forEach(raffle => {
                if (!raffle.id) return;

                // Перевіряємо відображення кількості учасників
                const participantsElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffle.id}"] .participants-count .count, ` +
                    `.main-raffle[data-raffle-id="${raffle.id}"] .participants-info .participants-count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                if (participantsElements.length === 0) return;

                // Перевіряємо значення першого елемента
                const displayedCount = parseInt(participantsElements[0].textContent.replace(/\s+/g, '')) || 0;
                const serverCount = raffle.participants_count || 0;

                // Якщо є розбіжність, оновлюємо відображення
                if (displayedCount !== serverCount) {
                    console.log(`⚠️ Виявлено розбіжність кількості учасників для розіграшу ${raffle.id}: відображається ${displayedCount}, має бути ${serverCount}`);

                    // Оновлюємо всі елементи з правильним значенням
                    this.updateRaffleParticipantsCount(raffle.id, serverCount);
                }

                // Перевіряємо відображення кількості переможців
                const winnersElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffle.id}"] .winners-count, ` +
                    `.main-raffle[data-raffle-id="${raffle.id}"] .winners-count, ` +
                    `.main-raffle .winners-count`
                );

                if (winnersElements.length === 0) return;

                // Перевіряємо значення першого елемента
                const displayedWinners = parseInt(winnersElements[0].textContent) || 0;
                const serverWinners = raffle.winners_count || 0;

                // Якщо є розбіжність, оновлюємо відображення
                if (displayedWinners !== serverWinners) {
                    console.log(`⚠️ Виявлено розбіжність кількості переможців для розіграшу ${raffle.id}: відображається ${displayedWinners}, має бути ${serverWinners}`);

                    // Оновлюємо всі елементи з правильним значенням
                    this.updateRaffleWinnersCount(raffle.id, serverWinners);
                }
            });
        },

        /**
         * Створення стилів для анімацій оновлення
         */
        createUpdateAnimationStyles: function() {
            if (document.getElementById('interface-updater-styles')) return;

            const styleElement = document.createElement('style');
            styleElement.id = 'interface-updater-styles';
            styleElement.textContent = `
                /* Анімація пульсації при оновленні */
                @keyframes update-pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                /* Анімація світіння при оновленні */
                @keyframes update-glow {
                    0% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                    50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.7); }
                    100% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                }
                
                /* Клас для елементів, які оновилися */
                .element-updated {
                    animation: update-pulse 0.5s ease-in-out, update-glow 1s ease-in-out;
                }
                
                /* Преміальні стилі для кнопки деталей */
                .premium-details-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: linear-gradient(135deg, rgba(78, 181, 247, 0.8), rgba(0, 201, 167, 0.8));
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 500;
                    font-size: 14px;
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-top: 10px;
                    width: auto;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    position: relative;
                    overflow: hidden;
                }
                
                .premium-details-button::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
                    transform: scale(0);
                    transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    border-radius: 50%;
                }
                
                .premium-details-button::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent 70%, rgba(0, 0, 0, 0.2));
                    z-index: -1;
                }
                
                .premium-details-button:hover::before {
                    transform: scale(1);
                }
                
                .premium-details-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
                }
                
                .premium-details-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                }
                
                .premium-button-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                /* Анімація пульсації для привернення уваги */
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 5px rgba(78, 181, 247, 0.5); }
                    50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.8); }
                    100% { box-shadow: 0 0 5px rgba(78, 181, 247, 0.5); }
                }
                
                .pulse-animation {
                    animation: pulse-glow 2s infinite;
                }
                
                /* Стиль для кнопки участі, якщо вже беремо участь */
                .participating {
                    background: linear-gradient(to right, #4CAF50, #45a049);
                }
                
                /* Анімація для успішного додавання білета */
                @keyframes ticket-added {
                    0% { opacity: 0; transform: scale(0.8) translateY(10px); }
                    80% { opacity: 1; transform: scale(1.1) translateY(0); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                
                .ticket-added {
                    animation: ticket-added 0.5s ease-in-out forwards;
                }
                
                /* Оновлені стилі для елементів, що змінюються */
                .count.updated, .winners-count.updated, .participants-count.updated {
                    animation: update-pulse 0.8s ease-in-out;
                    color: #4eb5f7 !important;
                    transition: color 1s ease;
                }
                
                /* Анімація для витрачених токенів */
                @keyframes tokens-spent-animation {
                    0% { opacity: 0; transform: translate(-50%, 0); }
                    20% { opacity: 1; transform: translate(-50%, -10px); }
                    80% { opacity: 1; transform: translate(-50%, -25px); }
                    100% { opacity: 0; transform: translate(-50%, -35px); }
                }
                
                .tokens-spent-animation {
                    position: absolute;
                    top: -20px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: #FF5722;
                    font-weight: bold;
                    font-size: 14px;
                    pointer-events: none;
                    z-index: 100;
                    animation: tokens-spent-animation 1.5s ease-out forwards;
                }
            `;

            document.head.appendChild(styleElement);
        },

        /**
         * Обробка успішної участі в розіграші
         * @param {Object} data - Дані про участь
         */
        handleSuccessfulParticipation: function(data) {
            if (!data || !data.raffleId) return;

            // ВИПРАВЛЕНО: Запам'ятовуємо останню кількість білетів
            if (data.ticketCount) {
                this.lastKnownValues.tickets[data.raffleId] = data.ticketCount;
            }

            // Оновлюємо вигляд кнопки
            this.updateParticipationButton(data.raffleId, data.ticketCount || 1);

            // Анімуємо успішну участь
            this.animateSuccessfulParticipation(data.raffleId);

            // Додаємо кнопку "Деталі" якщо її ще немає
            this.addDetailsButtonToRaffle(data.raffleId);
        },

        /**
         * Оновлення кнопки участі в розіграші
         * @param {string} raffleId - ID розіграшу
         * @param {number} ticketCount - Кількість білетів
         */
        updateParticipationButton: function(raffleId, ticketCount) {
            const buttons = document.querySelectorAll(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);

            buttons.forEach(button => {
                // Видаляємо стан обробки
                button.classList.remove('processing');
                button.removeAttribute('data-processing');

                // Додаємо клас для учасників
                button.classList.add('participating');

                // Оновлюємо текст
                const isMini = button.classList.contains('mini-raffle-button');
                button.textContent = isMini ?
                    `Додати ще білет (${ticketCount})` :
                    `Додати ще білет (у вас: ${ticketCount})`;

                // Розблоковуємо кнопку
                button.disabled = false;
            });
        },

        /**
         * Оновлення кількості учасників розіграшу
         * @param {string} raffleId - ID розіграшу
         * @param {number} participantsCount - Кількість учасників
         */
        updateRaffleParticipantsCount: function(raffleId, participantsCount) {
            if (!raffleId || typeof participantsCount !== 'number') return;

            try {
                // Знаходимо елемент для оновлення кількості учасників
                const participantsElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffleId}"] .participants-count .count, ` +
                    `.main-raffle[data-raffle-id="${raffleId}"] .participants-info .participants-count, ` +
                    `.main-raffle .participants-info .participants-count`
                );

                // Безпечно оновлюємо елементи
                participantsElements.forEach(element => {
                    // Отримуємо поточне значення
                    const currentText = element.textContent;
                    const currentCount = parseInt(currentText.replace(/\s+/g, '')) || 0;

                    // Оновлюємо тільки якщо значення змінилося
                    if (currentCount !== participantsCount) {
                        // Зберігаємо інформацію про форматування з пробілами
                        const hasSpaces = currentText.includes(' ');

                        // Форматуємо число з урахуванням попереднього формату
                        let newText = participantsCount.toString();
                        if (hasSpaces) {
                            newText = newText.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                        }

                        // Оновлюємо текст
                        element.textContent = newText;

                        // Додаємо клас для анімації оновлення
                        element.classList.add('updated');

                        // Видаляємо клас через 1 секунду
                        setTimeout(() => {
                            element.classList.remove('updated');
                        }, 1000);
                    }
                });

                // Запам'ятовуємо останнє відоме значення
                this.lastKnownValues.participants[raffleId] = participantsCount;
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити кількість учасників:", e);
            }
        },

        /**
         * Оновлення кількості переможців розіграшу
         * @param {string} raffleId - ID розіграшу
         * @param {number} winnersCount - Кількість переможців
         */
        updateRaffleWinnersCount: function(raffleId, winnersCount) {
            if (!raffleId || typeof winnersCount !== 'number') return;

            try {
                // Знаходимо елемент для оновлення кількості переможців
                const winnersElements = document.querySelectorAll(
                    `.raffle-card[data-raffle-id="${raffleId}"] .winners-count, ` +
                    `.main-raffle[data-raffle-id="${raffleId}"] .winners-count, ` +
                    `.main-raffle .winners-count`
                );

                // Безпечно оновлюємо елементи
                winnersElements.forEach(element => {
                    // Отримуємо поточне значення
                    const currentCount = parseInt(element.textContent) || 0;

                    // Оновлюємо тільки якщо значення змінилося
                    if (currentCount !== winnersCount) {
                        // Оновлюємо текст
                        element.textContent = winnersCount;

                        // Додаємо клас для анімації оновлення
                        element.classList.add('updated');

                        // Видаляємо клас через 1 секунду
                        setTimeout(() => {
                            element.classList.remove('updated');
                        }, 1000);
                    }
                });

                // Запам'ятовуємо останнє відоме значення
                this.lastKnownValues.winners[raffleId] = winnersCount;
            } catch (e) {
                console.warn("⚠️ Не вдалося оновити кількість переможців:", e);
            }
        },

        /**
         * Анімація успішної участі в розіграші
         * @param {string} raffleId - ID розіграшу
         */
        animateSuccessfulParticipation: function(raffleId) {
            // Анімуємо картку розіграшу
            const raffleCard = document.querySelector(`.raffle-card[data-raffle-id="${raffleId}"], .main-raffle-content`);
            if (raffleCard) {
                raffleCard.classList.add('element-updated');

                // Видаляємо клас через 1 секунду
                setTimeout(() => {
                    raffleCard.classList.remove('element-updated');
                }, 1000);
            }

            // Показуємо ефект додавання білета
            this.showTicketAddedEffect(raffleId);
        },

        /**
         * Ефект додавання білета
         * @param {string} raffleId - ID розіграшу
         */
        showTicketAddedEffect: function(raffleId) {
            const button = document.querySelector(`.join-button[data-raffle-id="${raffleId}"], .mini-raffle-button[data-raffle-id="${raffleId}"]`);
            if (!button) return;

            // Створюємо елемент для анімації
            const ticketEffect = document.createElement('div');
            ticketEffect.className = 'ticket-added-effect';
            ticketEffect.style.cssText = `
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                color: #4CAF50;
                font-weight: bold;
                font-size: 14px;
                pointer-events: none;
                z-index: 100;
            `;
            ticketEffect.textContent = '+1 білет';

            // Додаємо елемент до кнопки
            button.style.position = 'relative';
            button.appendChild(ticketEffect);

            // Анімація
            ticketEffect.classList.add('ticket-added');

            // Видаляємо через 1.5 секунди
            setTimeout(() => {
                if (ticketEffect.parentNode) {
                    ticketEffect.parentNode.removeChild(ticketEffect);
                }
            }, 1500);
        },

        /**
         * Додавання кнопок деталей до всіх розіграшів
         */
        addDetailsButtons: function() {
            // Отримуємо всі карточки розіграшів
            const mainRaffle = document.querySelector('.main-raffle');
            const miniRaffles = document.querySelectorAll('.mini-raffle');

            // Додаємо до головного розіграшу, якщо він існує
            if (mainRaffle) {
                const raffleId = mainRaffle.getAttribute('data-raffle-id');
                if (raffleId) {
                    this.addDetailsButtonToRaffle(raffleId, 'main');
                }
            }

            // Додаємо до міні-розіграшів
            miniRaffles.forEach(raffle => {
                const raffleId = raffle.getAttribute('data-raffle-id');
                if (raffleId) {
                    this.addDetailsButtonToRaffle(raffleId, 'mini');
                }
            });
        },

        /**
         * Додавання кнопки деталей до конкретного розіграшу
         * Оновлена версія з преміальним стилем
         * @param {string} raffleId - ID розіграшу
         * @param {string} type - Тип розіграшу (main/mini)
         */
        addDetailsButtonToRaffle: function(raffleId, type = 'main') {
            // Перевіряємо, чи існує вже кнопка
            const existingButton = document.querySelector(`.details-button[data-raffle-id="${raffleId}"]`);
            if (existingButton) return;

            // Знаходимо контейнер для кнопки
            let buttonContainer;

            if (type === 'main') {
                // Для головного розіграшу
                buttonContainer = document.querySelector(`.main-raffle[data-raffle-id="${raffleId}"] .main-raffle-content, .main-raffle .main-raffle-content`);
            } else {
                // Для міні-розіграшу
                buttonContainer = document.querySelector(`.mini-raffle[data-raffle-id="${raffleId}"] .mini-raffle-info`);
            }

            if (!buttonContainer) return;

            // Створюємо кнопку деталей у преміальному стилі
            const detailsButton = document.createElement('button');
            detailsButton.className = 'details-button premium-details-button';
            detailsButton.setAttribute('data-raffle-id', raffleId);

            // Оновлений HTML для кнопки з іконкою та текстом
            detailsButton.innerHTML = `
                <span class="premium-button-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.5">
                        <circle cx="8" cy="8" r="7" />
                        <line x1="8" y1="4" x2="8" y2="8" />
                        <line x1="8" y1="11" x2="8" y2="12" />
                    </svg>
                </span>
                <span class="premium-button-text">Деталі розіграшу</span>
            `;

            // Додаємо обробник події
            detailsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Додаємо ефект пульсації при натисканні
                detailsButton.classList.add('pulse-animation');
                setTimeout(() => {
                    detailsButton.classList.remove('pulse-animation');
                }, 2000);

                // Відкриваємо модальне вікно з деталями розіграшу
                if (window.WinixRaffles.active && typeof window.WinixRaffles.active.showRaffleDetails === 'function') {
                    window.WinixRaffles.active.showRaffleDetails(raffleId);
                } else if (window.showRaffleDetailsModal) {
                    // Знаходимо дані розіграшу
                    const raffle = window.WinixRaffles.state.activeRaffles?.find(r => r.id === raffleId);
                    if (raffle) {
                        // Перевіряємо, чи користувач бере участь
                        const isParticipating = window.WinixRaffles.participation &&
                                             window.WinixRaffles.participation.participatingRaffles &&
                                             window.WinixRaffles.participation.participatingRaffles.has(raffleId);

                        const ticketCount = window.WinixRaffles.participation &&
                                           window.WinixRaffles.participation.userRaffleTickets &&
                                           window.WinixRaffles.participation.userRaffleTickets[raffleId] || 0;

                        window.showRaffleDetailsModal(raffle, isParticipating, ticketCount);
                    } else {
                        window.showToast('Не вдалося знайти дані про розіграш', 'error');
                    }
                }
            });

            // Додаємо кнопку до контейнера
            buttonContainer.appendChild(detailsButton);
        },

        /**
         * Форматування дати і часу
         * @param {string|Date} dateTime - Дата і час
         * @returns {string} Відформатована дата і час
         */
        formatDateTime: function(dateTime) {
            if (!dateTime) return 'Невідомо';

            try {
                const date = new Date(dateTime);
                return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            } catch (e) {
                return 'Невідомо';
            }
        },

        /**
         * Анімація витрачених токенів
         * @param {HTMLElement} element - Елемент балансу для анімації
         * @param {number} amount - Кількість витрачених токенів
         */
        showTokensSpentAnimation: function(element, amount) {
            if (!element || typeof amount !== 'number') return;

            try {
                // Створюємо елемент анімації витрачених токенів
                const animationElement = document.createElement('div');
                animationElement.className = 'tokens-spent-animation';
                animationElement.textContent = `-${amount}`;

                // Робимо позицію елемента відносною, якщо вона ще не така
                const currentPosition = window.getComputedStyle(element).position;
                if (currentPosition === 'static') {
                    element.style.position = 'relative';
                }

                // Додаємо елемент анімації
                element.appendChild(animationElement);

                // Видаляємо елемент після завершення анімації
                setTimeout(() => {
                    if (animationElement.parentNode) {
                        animationElement.parentNode.removeChild(animationElement);
                    }
                }, 1500);
            } catch (error) {
                console.warn('⚠️ Помилка анімації витрачених токенів:', error);
            }
        },

        /**
         * Оновлення відображення балансу користувача
         * @param {number} newBalance - Новий баланс
         * @param {number} oldBalance - Старий баланс (необов'язково)
         */
        updateUserBalanceDisplay: function(newBalance, oldBalance) {
            if (typeof newBalance !== 'number') return;

            // Знаходимо елемент балансу жетонів
            const userCoinsElement = document.getElementById('user-coins');
            if (!userCoinsElement) return;

            // Отримуємо поточне значення, якщо oldBalance не вказано
            if (oldBalance === undefined) {
                oldBalance = parseInt(userCoinsElement.textContent) || 0;
            }

            // Оновлюємо відображення тільки якщо значення змінилося
            if (newBalance !== oldBalance) {
                // Додаємо клас для анімації в залежності від зміни
                if (newBalance < oldBalance) {
                    userCoinsElement.classList.add('decreasing');
                    // Показуємо анімацію з кількістю списаних жетонів
                    const difference = oldBalance - newBalance;
                    if (difference > 0) {
                        this.showTokensSpentAnimation(userCoinsElement, difference);
                    }
                    setTimeout(() => {
                        userCoinsElement.classList.remove('decreasing');
                    }, 1000);
                } else if (newBalance > oldBalance) {
                    userCoinsElement.classList.add('increasing');
                    setTimeout(() => {
                        userCoinsElement.classList.remove('increasing');
                    }, 1000);
                }

                // Оновлюємо текст
                userCoinsElement.textContent = newBalance;

                // Запам'ятовуємо останній відомий баланс
                this.lastKnownValues.balance = newBalance;
                this.lastKnownValues.balanceUpdateTime = Date.now();

                // Оновлюємо локальне сховище
                localStorage.setItem('userCoins', newBalance.toString());
                localStorage.setItem('winix_coins', newBalance.toString());
            }
        },

        /**
         * Форматування числа з пробілами
         * @param {number} number - Число для форматування
         * @returns {string} Відформатоване число
         */
        formatNumberWithSpaces: function(number) {
            return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        /**
         * Планування оновлення інтерфейсу з затримкою
         */
        scheduleUIUpdate: function() {
            // Перевіряємо, чи минуло достатньо часу з останнього оновлення
            const now = Date.now();
            if (now - this.lastUpdateTime < this.minUpdateInterval) {
                // Якщо таймаут вже існує, не створюємо новий
                if (this.updateDebounceTimeout) return;

                // Планування з затримкою
                this.updateDebounceTimeout = setTimeout(() => {
                    this.performUIUpdate();
                    this.updateDebounceTimeout = null;
                }, this.minUpdateInterval);

                return;
            }

            // Виконуємо оновлення негайно
            this.performUIUpdate();
        },

        /**
         * Виконання оновлення інтерфейсу
         */
        performUIUpdate: function() {
            // Оновлюємо час останнього оновлення
            this.lastUpdateTime = Date.now();
            this.updateCounter++;

            // Перевіряємо, чи інтерфейс не заблоковано
            if (this.isUILocked) return;

            // Оновлюємо кнопки участі
            if (window.WinixRaffles.participation &&
                typeof window.WinixRaffles.participation.updateParticipationButtons === 'function') {
                window.WinixRaffles.participation.updateParticipationButtons();
            }

            // Додаємо кнопки деталей
            this.addDetailsButtons();

            // Перевіряємо та виправляємо дані відображення
            this.verifyAndCorrectDisplayData();
        },

        /**
         * Блокування оновлення інтерфейсу
         */
        lockUI: function() {
            this.isUILocked = true;
        },

        /**
         * Розблокування оновлення інтерфейсу
         */
        unlockUI: function() {
            this.isUILocked = false;

            // Відразу оновлюємо після розблокування
            this.scheduleUIUpdate();
        }
    };

    // Додаємо модуль до головного модуля розіграшів
    window.WinixRaffles.interfaceUpdater = interfaceUpdater;

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', function() {
        if (window.WinixRaffles.state.isInitialized) {
            interfaceUpdater.init();
        } else {
            // Додаємо обробник події ініціалізації
            document.addEventListener('winix-raffles-initialized', function() {
                interfaceUpdater.init();
            });
        }
    });

    console.log('✅ Модуль оновлення інтерфейсу успішно завантажено');
})();