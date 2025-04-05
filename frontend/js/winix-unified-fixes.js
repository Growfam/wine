/**
 * WINIX UNIFIED FIXES - Серверна версія системи розіграшів
 *
 * Ця версія скрипту повністю інтегрована з сервером Flask і не використовує
 * локальне сховище для збереження даних. Усі операції виконуються через API.
 */

(function() {
    console.log("🚀 WINIX UNIFIED FIXES (Серверна версія): Запуск об'єднаної системи...");

    // ====== БАЗОВІ ЗМІННІ ======

    // Прапорець для запобігання повторним натисканням
    let isProcessingRaffle = false;

    // ====== БАЗОВІ УТИЛІТИ ======

    /**
     * Визначення поточної мови інтерфейсу
     */
    function getCurrentLanguage() {
        // Спроба 1: Перевірити HTML/BODY елементи
        const htmlEl = document.documentElement;
        const bodyEl = document.body;

        if (htmlEl.lang) {
            return htmlEl.lang;
        } else if (bodyEl.className.includes('lang-')) {
            const langMatch = bodyEl.className.match(/lang-([a-z]{2})/);
            if (langMatch) return langMatch[1];
        }

        // Спроба 2: Перевірка URL
        if (window.location.href.includes('/ru/')) {
            return 'ru';
        } else if (window.location.href.includes('/en/')) {
            return 'en';
        }

        // Спроба 3: Аналіз тексту на сторінці
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
            return 'ru';
        } else if (enCount > ruCount) {
            return 'en';
        }

        // За замовчуванням - українська
        return 'uk';
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
     * Безпечний показ повідомлень
     */
    function showToast(message, duration = 3000) {
        console.log(`TOAST: ${message}`);

        // Спроба 1: Через глобальну функцію
        if (window.showToast) {
            window.showToast(message, duration);
            return;
        }

        // Спроба 2: Через глобальну функцію showNotification
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
     * Функція для виконання API-запитів
     * @param {string} url URL ендпоінта
     * @param {string} method HTTP-метод (GET, POST, etc.)
     * @param {Object} body Тіло запиту (для POST/PUT)
     * @param {Function} callback Функція зворотного виклику з результатом
     */
    function apiRequest(url, method = 'GET', body = null, callback = null) {
        // Показуємо індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        // Створюємо заголовки
        const headers = {
            'Content-Type': 'application/json'
        };

        // Налаштування запиту
        const options = {
            method: method,
            headers: headers,
            credentials: 'same-origin'
        };

        // Додаємо тіло запиту для POST/PUT/PATCH
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        // Виконуємо запит
        fetch(url, options)
            .then(response => {
                // Приховуємо індикатор завантаження
                if (spinner) spinner.classList.remove('show');

                // Перевіряємо статус відповіді
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Викликаємо callback з результатом, якщо він є
                if (callback && typeof callback === 'function') {
                    callback(null, data);
                }
            })
            .catch(error => {
                // Приховуємо індикатор завантаження у випадку помилки
                if (spinner) spinner.classList.remove('show');

                console.error('API request error:', error);

                // Викликаємо callback з помилкою
                if (callback && typeof callback === 'function') {
                    callback(error, null);
                }
            });
    }

    /**
     * Отримання даних користувача з сервера
     * @param {Function} callback Функція зворотного виклику з результатом
     */
    function getUserData(callback) {
        // Отримуємо ID користувача
        const userId = document.getElementById('user-id')?.textContent || '12345678';

        // Запит до API
        apiRequest(`/api/user/${userId}`, 'GET', null, (error, data) => {
            if (error) {
                console.error('Помилка отримання даних користувача:', error);
                if (callback) callback(error, null);
                return;
            }

            if (data && data.status === 'success' && data.data) {
                if (callback) callback(null, data.data);
            } else {
                if (callback) callback(new Error('Некоректні дані відповіді'), null);
            }
        });
    }

    /**
     * Отримання списку всіх розіграшів з сервера
     * @param {Function} callback Функція зворотного виклику з результатом
     */
    function getRaffles(callback) {
        apiRequest('/api/raffles', 'GET', null, (error, data) => {
            if (error) {
                console.error('Помилка отримання списку розіграшів:', error);
                if (callback) callback(error, null);
                return;
            }

            if (data && data.status === 'success' && data.data) {
                if (callback) callback(null, data.data);
            } else {
                if (callback) callback(new Error('Некоректні дані відповіді'), null);
            }
        });
    }

    /**
     * Отримання історії розіграшів для поточного користувача
     * @param {Function} callback Функція зворотного виклику з результатом
     */
    function getRaffleHistory(callback) {
        const userId = document.getElementById('user-id')?.textContent || '12345678';

        apiRequest(`/api/user/${userId}/raffle-history`, 'GET', null, (error, data) => {
            if (error) {
                console.error('Помилка отримання історії розіграшів:', error);
                if (callback) callback(error, null);
                return;
            }

            if (data && data.status === 'success' && data.data) {
                if (callback) callback(null, data.data);
            } else {
                // Якщо немає даних, повертаємо порожній масив
                if (callback) callback(null, []);
            }
        });
    }

    /**
     * Участь у розіграші через API
     * @param {string} raffleId ID розіграшу
     * @param {string} raffleType Тип розіграшу ('main', 'daily', etc.)
     * @param {number} tokenAmount Кількість жетонів для участі
     * @param {Function} callback Функція зворотного виклику з результатом
     */
    function participateInRaffleAPI(raffleId, raffleType, tokenAmount, callback) {
        const userId = document.getElementById('user-id')?.textContent || '12345678';

        const requestBody = {
            userId: userId,
            raffleId: raffleId,
            raffleType: raffleType,
            tokenAmount: tokenAmount
        };

        apiRequest('/api/participate', 'POST', requestBody, (error, data) => {
            if (error) {
                console.error('Помилка участі в розіграші:', error);
                if (callback) callback(error, null);
                return;
            }

            if (data && data.status === 'success') {
                if (callback) callback(null, data);
            } else {
                if (callback) callback(new Error(data?.message || 'Помилка участі в розіграші'), null);
            }
        });
    }

    /**
     * Оновлення дати закінчення розіграшів
     */
    function updateRaffleEndDates() {
        // Отримаємо дані розіграшів з сервера
        getRaffles((error, raffles) => {
            if (error) {
                console.error('Помилка оновлення дат закінчення розіграшів:', error);
                return;
            }

            // Знаходимо елементи на сторінці для оновлення
            const mainEndElement = document.getElementById('main-end-time');
            const dailyEndElement = document.getElementById('daily-end-time');

            // Якщо є дані про головний розіграш
            if (raffles.mainRaffle && mainEndElement) {
                mainEndElement.textContent = raffles.mainRaffle.endDate;
            }

            // Якщо є дані про щоденний розіграш
            if (raffles.dailyRaffle && dailyEndElement) {
                dailyEndElement.textContent = raffles.dailyRaffle.endDate;
            }

            // Оновлюємо прогрес-бар
            if (raffles.mainRaffle) {
                updateProgressBar(raffles.mainRaffle);
            }
        });
    }

    /**
     * Оновлення прогрес-бару для головного розіграшу
     */
    function updateProgressBar(raffleData) {
        const progressBar = document.querySelector('.progress');
        if (!progressBar) return;

        // Отримуємо прогрес з даних розіграшу
        const progressPercent = raffleData.progressPercent || 29;

        // Оновлюємо прогрес-бар
        progressBar.style.width = `${progressPercent}%`;

        console.log(`Прогрес розіграшу оновлено до ${progressPercent}%`);
        return progressPercent;
    }

    /**
     * Оновлення кількості учасників в розіграшах
     */
    function updateRaffleParticipantsCount() {
        getRaffles((error, raffles) => {
            if (error) {
                console.error('Помилка оновлення кількості учасників:', error);
                return;
            }

            // Оновлюємо кількість учасників головного розіграшу
            const mainCount = raffles.mainRaffle?.participants || 1;
            const mainCountElements = document.querySelectorAll('.participants-count');
            mainCountElements.forEach(el => {
                if (el) el.textContent = mainCount.toString();
            });

            const mainModalParticipants = document.getElementById('main-participants');
            if (mainModalParticipants) mainModalParticipants.textContent = mainCount.toString();

            // Оновлюємо кількість учасників щоденного розіграшу
            const dailyCount = raffles.dailyRaffle?.participants || 1;
            const dailyModalParticipants = document.getElementById('daily-participants');
            if (dailyModalParticipants) {
                dailyModalParticipants.textContent = dailyCount.toString();
            }

            // Оновлюємо прогрес-бар
            if (raffles.mainRaffle) {
                updateProgressBar(raffles.mainRaffle);
            }
        });
    }

    /**
     * Функція участі в розіграші через UI
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
            // Отримуємо кількість жетонів для участі
            const tokenAmount = parseInt(document.getElementById(inputId)?.value || '1') || 1;

            // Забороняємо всі кнопки розіграшів для запобігання повторним натисканням
            const allButtons = document.querySelectorAll('.join-button, .mini-raffle-button');
            allButtons.forEach(btn => btn.disabled = true);

            // Викликаємо API для участі в розіграші
            participateInRaffleAPI(raffleId, raffleType, tokenAmount, (error, result) => {
                if (error) {
                    console.error('Помилка участі в розіграші:', error);
                    showToast(getLocalizedText(
                        'Сталася помилка при участі в розіграші. Спробуйте ще раз.',
                        'Произошла ошибка при участии в розыгрыше. Попробуйте еще раз.',
                        'An error occurred while participating in the raffle. Please try again.'
                    ), 3000);
                } else {
                    // Закриваємо модальне вікно
                    const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
                    const modal = document.getElementById(modalId);
                    if (modal) modal.classList.remove('open');

                    // Оновлюємо відображення балансу та учасників
                    updateUIAfterParticipation(result.data);

                    // Показуємо повідомлення про успіх
                    showToast(getLocalizedText(
                        'Ви успішно взяли участь у розіграші',
                        'Вы успешно приняли участие в розыгрыше',
                        'You have successfully participated in the raffle'
                    ), 3000);
                }

                // Розблоковуємо кнопки
                allButtons.forEach(btn => btn.disabled = false);
                isProcessingRaffle = false;
            });
        } catch (error) {
            console.error('Критична помилка при участі в розіграші:', error);
            showToast(getLocalizedText(
                'Сталася критична помилка. Спробуйте перезавантажити сторінку.',
                'Произошла критическая ошибка. Попробуйте перезагрузить страницу.',
                'A critical error has occurred. Try reloading the page.'
            ), 3000);
            isProcessingRaffle = false;
        }
    }

    /**
     * Оновлення інтерфейсу після успішної участі в розіграші
     */
    function updateUIAfterParticipation(data) {
        // Оновлюємо баланс жетонів
        if (data.newCoinsBalance !== undefined) {
            const coinsElements = document.querySelectorAll('#user-coins, .coins-amount, .coins-value');
            coinsElements.forEach(element => {
                if (element) element.textContent = data.newCoinsBalance;
            });
        }

        // Оновлюємо кількість учасників
        if (data.raffleType === 'main' && data.participantsCount) {
            const mainCountElements = document.querySelectorAll('.participants-count');
            mainCountElements.forEach(el => {
                if (el) el.textContent = data.participantsCount.toString();
            });

            const mainModalParticipants = document.getElementById('main-participants');
            if (mainModalParticipants) {
                mainModalParticipants.textContent = data.participantsCount.toString();
            }
        } else if (data.raffleType === 'daily' && data.participantsCount) {
            const dailyModalParticipants = document.getElementById('daily-participants');
            if (dailyModalParticipants) {
                dailyModalParticipants.textContent = data.participantsCount.toString();
            }
        }

        // Оновлюємо статистику участі, якщо вона є
        if (data.participationsCount !== undefined) {
            const participationsElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
            if (participationsElement) {
                participationsElement.textContent = data.participationsCount.toString();
            }
        }

        // Показуємо повідомлення про отримання бонусу, якщо потрібно
        if (data.bonusAmount && data.bonusAmount > 0) {
            setTimeout(() => {
                showToast(getLocalizedText(
                    `Вітаємо! Ви отримали ${data.bonusAmount} WINIX!`,
                    `Поздравляем! Вы получили ${data.bonusAmount} WINIX!`,
                    `Congratulations! You received ${data.bonusAmount} WINIX!`
                ), 3000);
            }, 3000);
        }
    }

    /**
     * Перевизначення функції відкриття деталей розіграшу
     */
    function overrideOpenRaffleDetails() {
        console.log("Перевизначення функції відкриття деталей розіграшу");

        window.openRaffleDetails = function(raffleId, raffleType) {
            console.log(`Відкриття деталей розіграшу: ${raffleId}, тип: ${raffleType}`);

            // Спочатку отримуємо актуальні дані користувача для перевірки балансу
            getUserData((error, userData) => {
                if (error) {
                    console.error('Помилка отримання даних користувача:', error);
                    showToast(getLocalizedText(
                        'Помилка отримання даних. Спробуйте ще раз.',
                        'Ошибка получения данных. Попробуйте еще раз.',
                        'Error getting data. Please try again.'
                    ), 3000);
                    return;
                }

                const coinsBalance = userData.coins || 0;

                if (coinsBalance < 1) {
                    showToast(getLocalizedText(
                        'Для участі в розіграші потрібен щонайменше 1 жетон',
                        'Для участия в розыгрыше нужен минимум 1 жетон',
                        'You need at least 1 coin to participate in the raffle'
                    ), 3000);
                    return;
                }

                // Отримуємо дані про розіграші
                getRaffles((err, raffles) => {
                    if (err) {
                        console.error('Помилка отримання даних розіграшів:', err);
                        showToast(getLocalizedText(
                            'Помилка отримання даних розіграшів. Спробуйте ще раз.',
                            'Ошибка получения данных розыгрышей. Попробуйте еще раз.',
                            'Error getting raffle data. Please try again.'
                        ), 3000);
                        return;
                    }

                    // Вибираємо потрібний розіграш
                    const raffleData = raffleType === 'daily' ? raffles.dailyRaffle : raffles.mainRaffle;

                    if (!raffleData) {
                        console.error(`Розіграш типу ${raffleType} не знайдено`);
                        return;
                    }

                    // Відкриваємо відповідне модальне вікно
                    const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
                    const modal = document.getElementById(modalId);
                    if (!modal) {
                        console.error(`Модальне вікно з id ${modalId} не знайдено`);
                        return;
                    }

                    // Встановлюємо значення полів у модальному вікні
                    const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
                    const input = document.getElementById(inputId);
                    if (input) input.value = '1';

                    const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
                    const joinBtn = document.getElementById(btnId);
                    if (joinBtn) {
                        joinBtn.setAttribute('data-raffle-id', raffleId);
                        joinBtn.setAttribute('data-raffle-type', raffleType);
                    }

                    // Оновлюємо дані в модальному вікні
                    if (raffleType === 'daily') {
                        const titleElement = document.getElementById('daily-modal-title');
                        if (titleElement) titleElement.textContent = raffleData.title || getLocalizedText('Щоденний розіграш', 'Ежедневный розыгрыш', 'Daily Giveaway');

                        const prizeElement = document.getElementById('daily-prize-value');
                        if (prizeElement) prizeElement.textContent = raffleData.prize || '30,000 WINIX (15 переможців)';

                        const participantsElement = document.getElementById('daily-participants');
                        if (participantsElement) participantsElement.textContent = raffleData.participants?.toString() || '1';

                        const endDateElement = document.getElementById('daily-end-time');
                        if (endDateElement) endDateElement.textContent = raffleData.endDate || '';
                    } else {
                        const titleElement = document.getElementById('main-modal-title');
                        if (titleElement) titleElement.textContent = raffleData.title || getLocalizedText('Гранд Розіграш', 'Гранд Розыгрыш', 'Grand Giveaway');

                        const prizeElement = document.getElementById('main-prize-value');
                        if (prizeElement) prizeElement.textContent = raffleData.prize || '250 USDT + 130,000 WINIX (10 переможців)';

                        const participantsElement = document.getElementById('main-participants');
                        if (participantsElement) participantsElement.textContent = raffleData.participants?.toString() || '1';

                        const endDateElement = document.getElementById('main-end-time');
                        if (endDateElement) endDateElement.textContent = raffleData.endDate || '';
                    }

                    // Відкриваємо модальне вікно
                    modal.classList.add('open');
                });
            });
        };
    }

    /**
     * Функція для отримання бонусу новачка
     */
    function claimNewbieBonus() {
        const userId = document.getElementById('user-id')?.textContent || '12345678';

        // Показуємо індикатор завантаження
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        // Викликаємо API для отримання бонусу
        apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', {}, (error, result) => {
            // Приховуємо індикатор завантаження
            if (spinner) spinner.classList.remove('show');

            if (error) {
                console.error('Помилка отримання бонусу новачка:', error);
                showToast(getLocalizedText(
                    'Помилка отримання бонусу. Спробуйте ще раз.',
                    'Ошибка получения бонуса. Попробуйте еще раз.',
                    'Error receiving bonus. Please try again.'
                ), 3000);
                return;
            }

            if (result.status === 'already_claimed') {
                // Бонус вже отримано
                showToast(getLocalizedText(
                    'Ви вже отримали бонус новачка!',
                    'Вы уже получили бонус новичка!',
                    'You have already received the newbie bonus!'
                ), 3000);

                // Оновлюємо кнопки бонусу
                const newbieButtons = document.querySelectorAll('.mini-raffle-button[data-raffle-id="newbie"]');
                newbieButtons.forEach(button => {
                    button.textContent = getLocalizedText('Отримано', 'Получено', 'Received');
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'default';
                });

                markNewbieBonus();
            } else if (result.status === 'success') {
                // Бонус успішно отримано
                showToast(getLocalizedText(
                    `Вітаємо! Ви отримали ${result.data.amount} WINIX як бонус новачка!`,
                    `Поздравляем! Вы получили ${result.data.amount} WINIX как бонус новичка!`,
                    `Congratulations! You received ${result.data.amount} WINIX as a newbie bonus!`
                ), 3000);

                // Оновлюємо баланс WINIX
                const tokenElements = document.querySelectorAll('#user-tokens, #main-balance, .balance-amount, #current-balance, .balance-value');
                tokenElements.forEach(element => {
                    if (element) {
                        if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                            element.innerHTML = `${result.data.newBalance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                        } else {
                            element.textContent = result.data.newBalance.toFixed(2);
                        }
                    }
                });

                // Оновлюємо кнопки бонусу
                const newbieButtons = document.querySelectorAll('.mini-raffle-button[data-raffle-id="newbie"]');
                newbieButtons.forEach(button => {
                    button.textContent = getLocalizedText('Отримано', 'Получено', 'Received');
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'default';
                });

                // Додаємо водяний знак до контейнера бонусу
                setTimeout(() => {
                    markNewbieBonus();
                }, 300);
            } else {
                // Інша помилка
                showToast(getLocalizedText(
                    'Не вдалося отримати бонус. Спробуйте ще раз.',
                    'Не удалось получить бонус. Попробуйте еще раз.',
                    'Failed to receive bonus. Please try again.'
                ), 3000);
            }
        });
    }

    /**
     * Функція для пошуку і маркування блоку бонусу новачка
     */
    function markNewbieBonus() {
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

            // Виправляємо кнопки "Закрити" без обмежень по ID
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

    /**
     * Покращене відображення історії розіграшів
     */
    function enhanceRaffleHistory() {
        console.log("Покращення відображення історії розіграшів");

        // Знаходимо контейнер для історії
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;

        // Отримуємо історію розіграшів з сервера
        getRaffleHistory((error, history) => {
            if (error) {
                console.error("Помилка отримання історії розіграшів:", error);
                return;
            }

            // Очищаємо контейнер
            historyContainer.innerHTML = '';

            // Якщо історія порожня, показуємо відповідне повідомлення
            if (!history || history.length === 0) {
                historyContainer.innerHTML = '<div class="empty-history">У вас ще немає участі в розіграшах</div>';
                return;
            }

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
        });
    }

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

        // Створюємо модальне вікно
        const modal = document.createElement('div');
        modal.id = 'raffle-history-modal';
        modal.className = 'raffle-modal';

        // Формуємо HTML для модального вікна, використовуючи дані з сервера
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Деталі розіграшу</h2>
                    <span class="modal-close">×</span>
                </div>
                
                <div class="prize-details">
                    <div class="detail-item">
                        <div class="detail-label">Дата:</div>
                        <div class="detail-value">${raffleData.date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Приз:</div>
                        <div class="detail-value">${raffleData.prize}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Статус:</div>
                        <div class="detail-value ${raffleData.status}">${raffleData.result}</div>
                    </div>
                </div>
                
                <div class="participation-info">
                    <h3>Переможці</h3>
                    <div style="margin-top: 16px; max-height: 280px; overflow-y: auto; padding-right: 8px;">
                        ${generateWinnersListHTML(raffleData.winners)}
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
            const bgColor = winner.place === 1 ? 'linear-gradient(145deg, #FFD700, #FFA500)' :
                            winner.place === 2 ? 'linear-gradient(145deg, #C0C0C0, #A9A9A9)' :
                            winner.place === 3 ? 'linear-gradient(145deg, #CD7F32, #A0522D)' :
                            'rgba(0, 0, 0, 0.3)';
            const boxShadow = winner.place <= 3 ?
                            `box-shadow: 0 0 8px ${winner.place === 1 ? 'rgba(255, 215, 0, 0.5)' : 
                                          winner.place === 2 ? 'rgba(192, 192, 192, 0.5)' : 
                                          'rgba(205, 127, 50, 0.5)'};` : '';

            // Формуємо HTML для одного переможця
            return `
                <div style="display: flex; align-items: center; background: ${winner.isCurrentUser ? 'linear-gradient(145deg, rgba(30, 113, 161, 0.5), rgba(0, 201, 167, 0.3))' : 'rgba(30, 39, 70, 0.5)'};
                           border-radius: 8px; padding: 10px; margin-bottom: 8px; ${winner.isCurrentUser ? 'border: 1px solid rgba(0, 201, 167, 0.5);' : ''}">
                    <div style="width: 36px; height: 36px; min-width: 36px; background: ${bgColor};
                             border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-right: 12px;
                             ${boxShadow}">
                        <span style="font-weight: bold; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${winner.place}</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; color: ${winner.isCurrentUser ? '#FFD700' : 'white'};
                                   ${winner.isCurrentUser ? 'text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);' : ''}">
                            ${winner.username}
                        </div>
                        <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.7);">
                            ID: ${winner.userId}
                        </div>
                    </div>
                    <div style="background: linear-gradient(90deg, #FFD700, #00C9A7); padding: 5px 10px; border-radius: 20px; 
                               font-weight: bold; color: #1A1A2E; font-size: 0.875rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">
                        ${winner.prize}
                    </div>
                </div>
            `;
        }).join('');
    }

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

    /**
     * Головна функція ініціалізації системи виправлень
     */
    function initSystem() {
        console.log("🚀 Запуск ініціалізації серверної системи розіграшів WINIX");

        try {
            // 1. Виправляємо кнопки закриття модальних вікон
            fixCloseButtons();

            // 2. Оновлюємо кількість учасників в розіграшах
            updateRaffleParticipantsCount();

            // 3. Оновлюємо дати закінчення розіграшів
            updateRaffleEndDates();

            // 4. Перевизначаємо функцію відкриття деталей розіграшу
            overrideOpenRaffleDetails();

            // 5. Налаштовуємо всі кнопки розіграшів
            setupRaffleButtons();

            // Позначаємо отримані бейджі
            markCompletedBadges();

            // Замінюємо емоджі бейджів на зображення
            replaceBadgeEmojisWithImages();

            // 6. Позначаємо блоки бонусу новачка, якщо вони є
            // Перевіряємо статус бонусу новачка
            getUserData((error, userData) => {
                if (!error && userData && userData.newbie_bonus_claimed) {
                    markNewbieBonus();
                }
            });

            // 7. Покращуємо історію розіграшів, якщо вона є на сторінці
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

            // 8. Додаткова фіксація щоденних модальних вікон для гарантії
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

            // 9. Якщо користувач знаходиться на вкладці "Минулі", оновимо її відображення
            if (document.querySelector('.tab-button[data-tab="past"].active') ||
                document.getElementById('past-raffles')?.classList.contains('active')) {
                setTimeout(enhanceRaffleHistory, 500);
            }

            // 10. Встановлюємо інтервал для оновлення прогрес-бару кожну хвилину
            setInterval(() => {
                updateRaffleEndDates(); // Це також оновить прогрес-бар
            }, 60000); // 60000 мс = 1 хвилина

            console.log("✅ Серверну систему розіграшів WINIX успішно ініціалізовано");

            // Показуємо повідомлення про успішне застосування виправлень
            setTimeout(() => {
                showToast(getLocalizedText(
                    'Система розіграшів WINIX успішно покращена',
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

    // Експортуємо основні функції для доступу ззовні
    window.winixUnifiedFixes = {
        participateInRaffle,
        createRaffleDetailsModal,
        claimNewbieBonus,
        enhanceRaffleHistory,
        getUserData,
        getRaffles,
        getRaffleHistory
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

    /**
 * Заміна емоджі бейджів на зображення
 */
function replaceBadgeEmojisWithImages() {
    console.log("Заміна емоджі на зображення бейджів");

    const badgeImages = [
        {
            selector: '.badge-item:nth-child(1) .badge-icon', // Переможець
            imagePath: 'assets/badge-winner.png',
            altText: 'Переможець'
        },
        {
            selector: '.badge-item:nth-child(2) .badge-icon', // Початківець
            imagePath: 'assets/badge-beginner.png',
            altText: 'Початківець'
        },
        {
            selector: '.badge-item:nth-child(3) .badge-icon', // Багатій
            imagePath: 'assets/badge-rich.png',
            altText: 'Багатій'
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
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';

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
            lockIcon.style.position = 'absolute';
            lockIcon.style.bottom = '-0.25rem';
            lockIcon.style.right = '-0.25rem';
            lockIcon.style.fontSize = '1rem';
            lockIcon.style.zIndex = '3';
            badgeIcon.appendChild(lockIcon);
        }
    });
}

/**
 * Позначення отриманих бейджів
 */
function markCompletedBadges() {
    console.log("Позначення отриманих бейджів");

    // Отримуємо дані користувача з сервера для перевірки отриманих бейджів
    getUserData((error, userData) => {
        if (error) {
            console.error('Помилка отримання даних користувача для бейджів:', error);
            return;
        }

        // Перевіряємо, які бейджі користувач отримав
        const badges = [
            {
                selector: '.badge-item:nth-child(1)',
                id: 'winner',
                isCompleted: userData.badges?.winner_completed || false
            },
            {
                selector: '.badge-item:nth-child(2)',
                id: 'beginner',
                isCompleted: userData.badges?.beginner_completed || userData.participationsCount >= 5 || false
            },
            {
                selector: '.badge-item:nth-child(3)',
                id: 'rich',
                isCompleted: userData.badges?.rich_completed || userData.balance >= 50000 || false
            }
        ];

        badges.forEach(badge => {
            const badgeElement = document.querySelector(badge.selector);
            if (!badgeElement) return;

            if (badge.isCompleted) {
                // Додаємо клас для стилізації
                badgeElement.classList.add('badge-completed');

                // Додаємо водяний знак, якщо його ще немає
                if (!badgeElement.querySelector('.badge-watermark')) {
                    addWatermarkToBadge(badgeElement);
                }
            }
        });

        // Після позначення, замінюємо емоджі на зображення
        replaceBadgeEmojisWithImages();
    });
}

/**
 * Додавання водяного знаку до бейджа
 */
function addWatermarkToBadge(badgeElement) {
    // Перевіряємо, чи вже є водяний знак
    if (badgeElement.querySelector('.badge-watermark')) {
        return;
    }

    // Створюємо водяний знак
    const watermark = document.createElement('div');
    watermark.className = 'badge-watermark';
    watermark.style.position = 'absolute';
    watermark.style.top = '0';
    watermark.style.left = '0';
    watermark.style.right = '0';
    watermark.style.bottom = '0';
    watermark.style.zIndex = '5';
    watermark.style.pointerEvents = 'none';
    watermark.style.display = 'flex';
    watermark.style.justifyContent = 'center';
    watermark.style.alignItems = 'center';
    watermark.style.overflow = 'hidden';

    // Визначаємо текст для водяного знаку
    const watermarkText = getLocalizedText('ОТРИМАНО', 'ПОЛУЧЕНО', 'RECEIVED');

    // Створюємо елемент тексту
    const textElement = document.createElement('div');
    textElement.className = 'badge-watermark-text';
    textElement.textContent = watermarkText;
    textElement.style.position = 'absolute';
    textElement.style.width = '200%';
    textElement.style.textAlign = 'center';
    textElement.style.transform = 'rotate(-35deg)';
    textElement.style.fontFamily = 'Impact, sans-serif';
    textElement.style.fontSize = '14px';
    textElement.style.fontWeight = '900';
    textElement.style.letterSpacing = '1px';
    textElement.style.color = 'black';
    textElement.style.background = 'repeating-linear-gradient(45deg, rgba(255, 205, 0, 0.8), rgba(255, 205, 0, 0.8) 10px, rgba(0, 0, 0, 0.8) 10px, rgba(0, 0, 0, 0.8) 20px)';
    textElement.style.padding = '2px 20px';
    textElement.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    textElement.style.textShadow = '0px 0px 2px white';
    textElement.style.whiteSpace = 'nowrap';

    // Додаємо елементи
    watermark.appendChild(textElement);

    // Якщо badge-element не має position: relative, додаємо його
    if (getComputedStyle(badgeElement).position === 'static') {
        badgeElement.style.position = 'relative';
    }

    badgeElement.appendChild(watermark);
}
})();
