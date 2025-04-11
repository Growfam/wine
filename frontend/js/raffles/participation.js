/**
 * Модуль для участі в розіграшах WINIX
 */

(function() {
    'use strict';

    console.log("🎮 WINIX Raffles: Ініціалізація модуля участі в розіграшах");

    // Приватні змінні
    let _isParticipating = false;
    let _participationTimeoutId = null;
    let _raffleDetailsCache = {};

    // Модуль участі в розіграшах
    const participationModule = {
        // Отримання детальної інформації про розіграш
        getRaffleDetails: async function(raffleId) {
            try {
                if (!raffleId) {
                    throw new Error('ID розіграшу не вказано');
                }

                // Перевіряємо кеш
                if (_raffleDetailsCache[raffleId]) {
                    console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                    return _raffleDetailsCache[raffleId];
                }

                window.WinixRaffles.utils.showLoading('Завантаження деталей розіграшу...');

                // Покращені параметри запиту
                const response = await window.WinixAPI.apiRequest(`/api/raffles/${raffleId}`, 'GET', null, {
                    timeout: 10000,
                    suppressErrors: true,
                    forceCleanup: true
                });

                window.WinixRaffles.utils.hideLoading();

                if (response && response.status === 'success') {
                    // Кешуємо отримані дані
                    if (response.data) {
                        _raffleDetailsCache[raffleId] = response.data;
                    }
                    return response.data;
                } else {
                    throw new Error((response && response.message) || 'Помилка отримання деталей розіграшу');
                }
            } catch (error) {
                console.error(`❌ Помилка отримання деталей розіграшу ${raffleId}:`, error);
                window.WinixRaffles.utils.hideLoading();
                window.WinixRaffles.utils.showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
                return null;
            }
        },

        // Участь у розіграші
        participateInRaffle: async function(raffleId, entryCount = 1) {
            try {
                // Автоматичне скидання зависаючих запитів
                const now = Date.now();
                if (_isParticipating && !_participationTimeoutId) {
                    console.warn("⚠️ Raffles: Виявлено потенційно зависаючий запит участі, скидаємо");
                    _isParticipating = false;
                }

                if (_isParticipating) {
                    console.log("⏳ Raffles: Участь у розіграші вже виконується");
                    return { status: 'error', message: 'Участь у розіграші вже виконується' };
                }

                _isParticipating = true;

                // Встановлюємо таймаут для автоматичного скидання
                if (_participationTimeoutId) {
                    clearTimeout(_participationTimeoutId);
                }
                _participationTimeoutId = setTimeout(() => {
                    if (_isParticipating) {
                        console.warn("⚠️ Raffles: Участь у розіграші триває занадто довго, скидаємо стан");
                        _isParticipating = false;
                    }
                }, 30000); // 30 секунд

                window.WinixRaffles.utils.showLoading('Беремо участь у розіграші...');

                const userId = window.WinixAPI.getUserId();
                if (!userId) {
                    throw new Error('ID користувача не знайдено');
                }

                // Покращені параметри запиту
                const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/participate-raffle`, 'POST', {
                    raffle_id: raffleId,
                    entry_count: entryCount
                }, {
                    timeout: 15000,
                    suppressErrors: true,
                    forceCleanup: true
                });

                // ЗАВЖДИ приховуємо лоадер і скидаємо прапорці
                window.WinixRaffles.utils.hideLoading();
                _isParticipating = false;

                // Очищаємо таймаут
                if (_participationTimeoutId) {
                    clearTimeout(_participationTimeoutId);
                    _participationTimeoutId = null;
                }

                if (response && response.status === 'success') {
                    // Оновлюємо кеш активних розіграшів
                    await window.WinixRaffles.active.getActiveRaffles(true);

                    // Оновлюємо баланс монет у користувача
                    await this.updateUserBalance();

                    // Оповіщаємо про успішну участь
                    document.dispatchEvent(new CustomEvent('winix:raffle-participated', {
                        detail: {
                            raffleId: raffleId,
                            entryCount: entryCount
                        }
                    }));

                    return {
                        status: 'success',
                        message: response.data?.message || 'Ви успішно взяли участь у розіграші',
                        data: response.data
                    };
                } else {
                    throw new Error((response && response.message) || 'Помилка участі в розіграші');
                }
            } catch (error) {
                console.error(`❌ Помилка участі в розіграші ${raffleId}:`, error);

                // ЗАВЖДИ скидаємо прапорці та приховуємо лоадер
                window.WinixRaffles.utils.hideLoading();
                _isParticipating = false;

                if (_participationTimeoutId) {
                    clearTimeout(_participationTimeoutId);
                    _participationTimeoutId = null;
                }

                return { status: 'error', message: error.message || 'Помилка участі в розіграші' };
            }
        },

        // Відкриття модального вікна з деталями розіграшу
        openRaffleDetails: function(raffleId, raffleType) {
            if (!raffleId) {
                window.WinixRaffles.utils.showToast('ID розіграшу не вказано');
                return;
            }

            // Перевіряємо наявність жетонів
            if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                window.WinixAPI.getUserData().then(userData => {
                    const coinsBalance = userData.data?.coins || 0;

                    if (coinsBalance < 1) {
                        window.WinixRaffles.utils.showToast('Для участі в розіграші потрібен щонайменше 1 жетон');
                        return;
                    }

                    // Перевіряємо кеш
                    if (_raffleDetailsCache[raffleId]) {
                        console.log(`📋 Raffles: Використання кешованих даних для розіграшу ${raffleId}`);
                        this.processRaffleDetails(_raffleDetailsCache[raffleId], raffleType);
                        return;
                    }

                    // Отримуємо дані розіграшу
                    this.getRaffleDetails(raffleId).then(raffleData => {
                        if (!raffleData) {
                            window.WinixRaffles.utils.showToast('Помилка отримання даних розіграшу');
                            return;
                        }

                        // Обробляємо деталі розіграшу
                        this.processRaffleDetails(raffleData, raffleType);
                    }).catch(error => {
                        console.error('Помилка отримання деталей розіграшу:', error);
                        window.WinixRaffles.utils.showToast('Не вдалося завантажити деталі розіграшу. Спробуйте пізніше.');
                    });
                }).catch(error => {
                    console.error('Помилка отримання даних користувача:', error);
                    window.WinixRaffles.utils.showToast('Не вдалося отримати дані користувача. Спробуйте пізніше.');
                });
            } else {
                window.WinixRaffles.utils.showToast('API не ініціалізовано коректно. Оновіть сторінку.');
            }
        },

        // Обробка деталей розіграшу
        processRaffleDetails: function(raffleData, raffleType) {
            if (!raffleData) {
                window.WinixRaffles.utils.showToast('Помилка отримання даних розіграшу');
                return;
            }

            // Відкриваємо відповідне модальне вікно
            const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
            const modal = document.getElementById(modalId);

            if (!modal) {
                console.error(`Модальне вікно з id ${modalId} не знайдено`);
                window.WinixRaffles.utils.showToast('Помилка відображення деталей розіграшу');
                return;
            }

            // Встановлюємо значення полів у модальному вікні
            const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '1';

                // Отримуємо баланс жетонів
                window.WinixAPI.getUserData().then(userData => {
                    const coinsBalance = userData.data?.coins || 0;

                    // Встановлюємо максимальне значення рівне балансу жетонів
                    const tokenCost = raffleType === 'daily' ? 1 : 3;
                    const maxTickets = Math.floor(coinsBalance / tokenCost);
                    input.max = maxTickets;

                    // Показуємо кнопку "ВСІ", якщо баланс більше 1
                    const allButtonId = raffleType === 'daily' ? 'daily-all-tokens-btn' : 'main-all-tokens-btn';
                    const allButton = document.getElementById(allButtonId);

                    if (allButton) {
                        if (coinsBalance > tokenCost) {
                            allButton.style.display = 'block';

                            // Додаємо обробник для кнопки "ВСІ"
                            allButton.onclick = function() {
                                input.value = maxTickets;
                            };
                        } else {
                            allButton.style.display = 'none';
                        }
                    }
                }).catch(error => {
                    console.error("Помилка отримання балансу:", error);
                    // За замовчуванням, встановлюємо максимум 10
                    input.max = 10;
                });
            }

            const btnId = raffleType === 'daily' ? 'daily-join-btn' : 'main-join-btn';
            const joinBtn = document.getElementById(btnId);

            if (joinBtn) {
                joinBtn.setAttribute('data-raffle-id', raffleData.id);
                joinBtn.setAttribute('data-raffle-type', raffleType);

                // Додаємо обробник натискання
                const self = this;
                joinBtn.onclick = function() {
                    const raffleId = this.getAttribute('data-raffle-id');
                    const raffleType = this.getAttribute('data-raffle-type');
                    const inputId = raffleType === 'daily' ? 'daily-token-amount' : 'main-token-amount';

                    self.participateInRaffleUI(raffleId, raffleType, inputId);
                };
            }

            // Оновлюємо дані в модальному вікні
            if (raffleType === 'daily') {
                const titleElement = document.getElementById('daily-modal-title');
                if (titleElement) titleElement.textContent = raffleData.title || 'Щоденний розіграш';

                const prizeElement = document.getElementById('daily-prize-value');
                if (prizeElement) prizeElement.textContent = `${raffleData.prize_amount} ${raffleData.prize_currency} (${raffleData.winners_count} переможців)`;

                const participantsElement = document.getElementById('daily-participants');
                if (participantsElement) participantsElement.textContent = raffleData.participants_count || '0';

                const endDateElement = document.getElementById('daily-end-time');
                if (endDateElement) endDateElement.textContent = window.WinixRaffles.utils.formatDate(raffleData.end_time);

                const descriptionElement = document.getElementById('daily-description');
                if (descriptionElement) descriptionElement.textContent = raffleData.description || 'Щоденний розіграш з призами для переможців! Використайте жетони для участі.';

                // Оновлюємо зображення, якщо воно є
                const imageElement = document.getElementById('daily-prize-image');
                if (imageElement && raffleData.image_url) {
                    imageElement.src = raffleData.image_url;
                }
            } else {
                const titleElement = document.getElementById('main-modal-title');
                if (titleElement) titleElement.textContent = raffleData.title || 'Гранд Розіграш';

                const prizeElement = document.getElementById('main-prize-value');
                if (prizeElement) prizeElement.textContent = `${raffleData.prize_amount} ${raffleData.prize_currency} (${raffleData.winners_count} переможців)`;

                const participantsElement = document.getElementById('main-participants');
                if (participantsElement) participantsElement.textContent = raffleData.participants_count || '0';

                const endDateElement = document.getElementById('main-end-time');
                if (endDateElement) endDateElement.textContent = window.WinixRaffles.utils.formatDate(raffleData.end_time);

                const descriptionElement = document.getElementById('main-description');
                if (descriptionElement) descriptionElement.textContent = raffleData.description || 'Грандіозний розіграш з чудовими призами! Використайте жетони для участі та збільшіть свої шанси на перемогу.';

                // Оновлюємо зображення, якщо воно є
                const imageElement = document.getElementById('main-prize-image');
                if (imageElement && raffleData.image_url) {
                    imageElement.src = raffleData.image_url;
                }
            }

            // Відкриваємо модальне вікно
            modal.classList.add('open');

            // Додаємо обробник для закриття модального вікна
            const closeButtons = modal.querySelectorAll('.modal-close, .cancel-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    modal.classList.remove('open');
                });
            });
        },

        // Функція обробки натискання на кнопку участі в розіграші
        participateInRaffleUI: async function(raffleId, raffleType, inputId) {
            if (!raffleId) {
                window.WinixRaffles.utils.showToast('ID розіграшу не вказано');
                return;
            }

            // Отримуємо кількість жетонів
            const input = document.getElementById(inputId);
            const entryCount = parseInt(input?.value || '1') || 1;

            // Отримуємо модальне вікно
            const modalId = raffleType === 'daily' ? 'daily-raffle-modal' : 'main-raffle-modal';
            const modal = document.getElementById(modalId);

            // Перевіряємо коректність введення
            if (entryCount <= 0) {
                window.WinixRaffles.utils.showToast('Кількість жетонів має бути більше нуля');
                return;
            }

            try {
                // Перевіряємо, чи достатньо жетонів
                const userData = await window.WinixAPI.getUserData();
                const coinsBalance = userData.data?.coins || 0;
                const tokenCost = raffleType === 'daily' ? 1 : 3;
                const totalCost = entryCount * tokenCost;

                if (coinsBalance < totalCost) {
                    window.WinixRaffles.utils.showToast(`Недостатньо жетонів. Потрібно ${totalCost}, у вас ${coinsBalance}`);
                    return;
                }

                // Беремо участь у розіграші
                const result = await this.participateInRaffle(raffleId, entryCount);

                if (result.status === 'success') {
                    // Закриваємо модальне вікно
                    if (modal) modal.classList.remove('open');

                    // Оновлюємо відображення розіграшів
                    await window.WinixRaffles.active.displayRaffles();

                    // Оновлюємо баланс
                    await this.updateUserBalance();

                    // Показуємо повідомлення про успіх
                    window.WinixRaffles.utils.showToast(result.message);

                    // Якщо є бонус, показуємо повідомлення про нього
                    if (result.data && result.data.bonus_amount) {
                        setTimeout(() => {
                            window.WinixRaffles.utils.showToast(`Вітаємо! Ви отримали ${result.data.bonus_amount} WINIX як бонус!`);
                        }, 3000);
                    }
                } else {
                    // Показуємо повідомлення про помилку
                    window.WinixRaffles.utils.showToast(result.message);
                }
            } catch (error) {
                console.error('Помилка при участі в розіграші:', error);
                window.WinixRaffles.utils.showToast('Сталася помилка при участі в розіграші. Спробуйте пізніше.');
            }
        },

        // Отримання бонусу новачка
        claimNewbieBonus: async function() {
            try {
                window.WinixRaffles.utils.showLoading('Отримуємо бонус новачка...');

                const userId = window.WinixAPI.getUserId();
                if (!userId) {
                    throw new Error('ID користувача не знайдено');
                }

                // Покращені параметри запиту
                const response = await window.WinixAPI.apiRequest(`/api/user/${userId}/claim-newbie-bonus`, 'POST', null, {
                    timeout: 10000,
                    suppressErrors: true
                });

                window.WinixRaffles.utils.hideLoading();

                if (response && (response.status === 'success' || response.status === 'already_claimed')) {
                    // Оновлюємо баланс WINIX у користувача
                    await this.updateUserBalance();

                    return {
                        status: response.status,
                        message: response.message || 'Бонус новачка успішно отримано',
                        data: response.data
                    };
                } else {
                    throw new Error((response && response.message) || 'Помилка отримання бонусу новачка');
                }
            } catch (error) {
                console.error('❌ Помилка отримання бонусу новачка:', error);
                window.WinixRaffles.utils.hideLoading();
                return { status: 'error', message: error.message || 'Помилка отримання бонусу новачка' };
            }
        },

        // Оновлення балансу користувача
        updateUserBalance: async function() {
            try {
                // Перевіряємо наявність глобальної функції
                if (window.WinixAPI && window.WinixAPI.getBalance) {
                    await window.WinixAPI.getBalance();
                } else {
                    // Альтернативний метод оновлення
                    await window.WinixAPI.getUserData(true);

                    // Оновлюємо відображення балансу
                    const userData = await window.WinixAPI.getUserData();

                    if (userData && userData.data) {
                        // Оновлюємо елементи інтерфейсу
                        const coinsElement = document.getElementById('user-coins');
                        const tokensElement = document.getElementById('user-tokens');

                        if (coinsElement) {
                            coinsElement.textContent = userData.data.coins || 0;
                        }

                        if (tokensElement) {
                            tokensElement.textContent = userData.data.balance || 0;
                        }
                    }
                }

                return true;
            } catch (error) {
                console.error('Помилка оновлення балансу:', error);
                return false;
            }
        },

        // Поділитися розіграшем
        shareRaffle: function(raffleId) {
            // Перевіряємо наявність Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                // Отримуємо дані розіграшу
                this.getRaffleDetails(raffleId).then(raffleData => {
                    if (!raffleData) {
                        window.WinixRaffles.utils.showToast('Не вдалося отримати дані розіграшу');
                        return;
                    }

                    // Формуємо повідомлення для поширення
                    const shareText = `🎮 Розіграш WINIX: ${raffleData.title}\n\n` +
                                     `💰 Призовий фонд: ${raffleData.prize_amount} ${raffleData.prize_currency}\n` +
                                     `🏆 Кількість переможців: ${raffleData.winners_count}\n\n` +
                                     `Бери участь і вигравай призи! 🚀`;

                    // Використовуємо метод Telegram для поширення
                    if (window.Telegram.WebApp.switchInlineQuery) {
                        window.Telegram.WebApp.switchInlineQuery(shareText, ['users', 'groups']);
                        return;
                    }

                    if (navigator.share) {
                        navigator.share({
                            title: `Розіграш WINIX: ${raffleData.title}`,
                            text: shareText
                        })
                        .then(() => {
                            window.WinixRaffles.utils.showToast('Розіграш успішно поширено');
                        })
                        .catch(error => {
                            console.error('Помилка поширення:', error);
                            window.WinixRaffles.utils.showToast('Не вдалося поширити розіграш');
                        });
                    } else {
                        // Копіюємо в буфер обміну
                        navigator.clipboard.writeText(shareText)
                            .then(() => {
                                window.WinixRaffles.utils.showToast('Текст розіграшу скопійовано в буфер обміну');
                            })
                            .catch(error => {
                                console.error('Помилка копіювання:', error);
                                window.WinixRaffles.utils.showToast('Не вдалося скопіювати текст розіграшу');
                            });
                    }
                }).catch(error => {
                    console.error('Помилка отримання даних розіграшу для поширення:', error);
                    window.WinixRaffles.utils.showToast('Не вдалося отримати дані розіграшу для поширення');
                });
            } else {
                window.WinixRaffles.utils.showToast('Ця функція доступна тільки в Telegram');
            }
        }
    };

    // Експортуємо модуль
    window.WinixRaffles.participation = participationModule;
})();