/**
 * winix-init.js
 *
 * Файл для контролю ініціалізації та координації роботи всіх скриптів системи WINIX.
 * Цей файл повинен бути підключений першим перед іншими скриптами системи.
 *
 * Інтегровано з централізованим API модулем
 */
// Ініціалізуємо Telegram WebApp якомога раніше
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    console.log("Telegram WebApp успішно ініціалізовано");
}
(function() {
    console.log("🚀 WINIX-INIT: Запуск координатора ініціалізації...");

    // Лічильник спроб ініціалізації
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 5;

    // Об'єкт для відстеження стану ініціалізації
    window.WinixInitState = {
        coreInitialized: false,
        connectorInitialized: false,
        fixInitialized: false,
        apiInitialized: false,

        // Додаємо новий прапорець для відстеження готовності API модуля
        apiReady: false,

        // Флаг повної ініціалізації системи
        get isFullyInitialized() {
            return this.coreInitialized && this.connectorInitialized && this.apiInitialized;
        },

        // Функція, яка викликається після повної ініціалізації
        onFullyInitialized: function() {
            console.log("✅ WINIX-INIT: Система повністю ініціалізована!");

            // Синхронізуємо дані
            this.syncData();

            // Оновлюємо інтерфейс
            this.updateUI();

            // Запускаємо обробники для поточної сторінки
            this.setupCurrentPageHandlers();

            // Відправляємо подію про завершення ініціалізації
            document.dispatchEvent(new CustomEvent('winix-initialized'));
        },

        // Синхронізація даних між системами
        syncData: function() {
            console.log("🔄 WINIX-INIT: Синхронізація даних...");

            // Перевіряємо наявність API для отримання актуальних даних
            if (window.WinixAPI && window.WinixAPI.getUserData) {
                try {
                    // Отримуємо актуальні дані користувача
                    window.WinixAPI.getUserData((error, userData) => {
                        if (error) {
                            console.error(`❌ WINIX-INIT: Помилка отримання даних користувача: ${window.WinixAPI.handleApiError(error)}`);
                            // Переходимо до локальної синхронізації
                            this.syncLocalData();
                            return;
                        }

                        console.log("✅ WINIX-INIT: Отримано актуальні дані користувача з сервера");

                        // Оновлюємо локальні дані якщо вони доступні
                        if (userData) {
                            // Оновлюємо баланс
                            if (userData.balance !== undefined) {
                                localStorage.setItem('winix_balance', userData.balance);
                                localStorage.setItem('userTokens', userData.balance);
                            }

                            // Оновлюємо жетони
                            if (userData.coins !== undefined) {
                                localStorage.setItem('winix_coins', userData.coins);
                                localStorage.setItem('userCoins', userData.coins);
                            }

                            // Оновлюємо дані стейкінгу
                            if (userData.staking) {
                                localStorage.setItem('winix_staking', JSON.stringify(userData.staking));
                                localStorage.setItem('stakingData', JSON.stringify(userData.staking));
                            }

                            // Оновлюємо історію транзакцій
                            if (userData.transactions) {
                                localStorage.setItem('winix_transactions', JSON.stringify(userData.transactions));
                                localStorage.setItem('transactions', JSON.stringify(userData.transactions));
                            }
                        }

                        // Оновлюємо UI після отримання нових даних
                        this.updateUI();
                    });
                } catch (e) {
                    console.error("❌ WINIX-INIT: Помилка при спробі отримати дані з API:", e);
                    // Переходимо до локальної синхронізації як запасний варіант
                    this.syncLocalData();
                }
            } else {
                // Якщо API недоступне, використовуємо локальну синхронізацію
                this.syncLocalData();
            }
        },

        // Локальна синхронізація між сховищами
        syncLocalData: function() {
            console.log("🔄 WINIX-INIT: Локальна синхронізація даних...");

            // Синхронізуємо ключі локального сховища
            const keyMappings = {
                // winix_balance <-> userTokens
                'winix_balance': 'userTokens',
                // winix_coins <-> userCoins
                'winix_coins': 'userCoins',
                // winix_staking <-> stakingData
                'winix_staking': 'stakingData',
                // winix_transactions <-> transactions
                'winix_transactions': 'transactions'
            };

            // Перебираємо всі маппінги та синхронізуємо дані
            for (const [coreKey, fixKey] of Object.entries(keyMappings)) {
                try {
                    // Перевіряємо, чи є дані в coreKey
                    const coreData = localStorage.getItem(coreKey);
                    if (coreData) {
                        // Встановлюємо ті ж дані для fixKey
                        localStorage.setItem(fixKey, coreData);
                    } else {
                        // Перевіряємо, чи є дані у fixKey
                        const fixData = localStorage.getItem(fixKey);
                        if (fixData) {
                            // Встановлюємо ті ж дані для coreKey
                            localStorage.setItem(coreKey, fixData);
                        }
                    }
                } catch (e) {
                    console.warn("⚠️ WINIX-INIT: Помилка при синхронізації ключа", coreKey, e);
                }
            }
        },

        // Оновлення інтерфейсу
        updateUI: function() {
            console.log("🔄 WINIX-INIT: Оновлення інтерфейсу...");

            // Оновлюємо відображення балансу через WinixCore
            if (window.WinixCore && window.WinixCore.UI) {
                setTimeout(function() {
                    try {
                        window.WinixCore.UI.updateBalanceDisplay();
                        window.WinixCore.UI.updateStakingDisplay();
                        window.WinixCore.UI.updateTransactionsList('transaction-list', 3);
                    } catch (e) {
                        console.error("❌ WINIX-INIT: Помилка при оновленні UI через WinixCore:", e);
                    }
                }, 100);
            }
            // Якщо є API але немає Core, використовуємо API для оновлення UI
            else if (window.WinixAPI) {
                try {
                    this.updateUIWithAPI();
                } catch (e) {
                    console.error("❌ WINIX-INIT: Помилка при оновленні UI через API:", e);
                }
            }
        },

        // Оновлення UI через API
        updateUIWithAPI: function() {
            // Отримуємо баланс
            window.WinixAPI.getBalance((error, balance) => {
                if (error) return;

                // Оновлюємо відображення балансу на сторінці
                const balanceElements = document.querySelectorAll('.balance-value, #main-balance, #user-tokens');
                balanceElements.forEach(el => {
                    if (el) {
                        // Обробляємо спеціальним чином елемент main-balance, якщо він має іконку
                        if (el.id === 'main-balance' && el.innerHTML && el.innerHTML.includes('main-balance-icon')) {
                            el.innerHTML = `${balance.tokens.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                        } else {
                            el.textContent = balance.tokens.toFixed(2);
                        }
                    }
                });

                // Оновлюємо відображення жетонів на сторінці
                const coinsElements = document.querySelectorAll('.coins-value, #user-coins');
                coinsElements.forEach(el => {
                    if (el) el.textContent = balance.coins.toString();
                });
            });

            // Отримуємо дані стейкінгу, якщо на сторінці є відповідні елементи
            if (document.querySelector('.staking-info, #staking-amount, #staking-reward')) {
                window.WinixAPI.getStakingData((error, stakingData) => {
                    if (error) return;

                    // Оновлюємо відображення стейкінгу на сторінці
                    const stakingAmountEl = document.getElementById('staking-amount');
                    if (stakingAmountEl && stakingData.hasActiveStaking) {
                        stakingAmountEl.textContent = stakingData.amount.toFixed(2);
                    }

                    const stakingRewardEl = document.getElementById('staking-reward');
                    if (stakingRewardEl && stakingData.hasActiveStaking) {
                        stakingRewardEl.textContent = stakingData.reward.toFixed(2);
                    }
                });
            }

            // Отримуємо транзакції, якщо на сторінці є відповідний контейнер
            const transactionListEl = document.getElementById('transaction-list');
            if (transactionListEl) {
                window.WinixAPI.getTransactions(3, (error, transactions) => {
                    if (error || !transactions || !transactions.length) return;

                    // Очищаємо контейнер
                    transactionListEl.innerHTML = '';

                    // Додаємо кожну транзакцію
                    transactions.forEach(tx => {
                        const txEl = document.createElement('div');
                        txEl.className = 'transaction-item';
                        txEl.innerHTML = `
                            <div class="transaction-info">
                                <div class="transaction-title">${tx.description || 'Транзакція'}</div>
                                <div class="transaction-date">${tx.date || '01.01.2025'}</div>
                            </div>
                            <div class="transaction-amount ${tx.amount >= 0 ? 'positive' : 'negative'}">${tx.amount.toFixed(2)}</div>
                        `;
                        transactionListEl.appendChild(txEl);
                    });
                });
            }
        },

        // Налаштування обробників для поточної сторінки
        setupCurrentPageHandlers: function() {
            console.log("🔄 WINIX-INIT: Налаштування обробників для поточної сторінки...");

            // Визначаємо поточну сторінку
            const path = window.location.pathname;
            const filename = path.split('/').pop();

            let currentPage = '';
            if (!filename || filename === '' || filename === 'original-index.html') {
                currentPage = 'home';
            } else {
                currentPage = filename.replace('.html', '');
            }

            console.log(`📄 WINIX-INIT: Поточна сторінка: ${currentPage}`);

            // Встановлюємо обробники в залежності від сторінки
            switch (currentPage) {
                case 'staking':
                    this.setupStakingPage();
                    break;
                case 'staking-details':
                    this.setupStakingDetailsPage();
                    break;
                case 'earn':
                    this.setupEarnPage();
                    break;
                case 'wallet':
                    this.setupWalletPage();
                    break;
                case 'home':
                case 'index':
                    this.setupHomePage();
                    break;
                case 'raffles':
                    this.setupRafflesPage();
                    break;
                // Інші сторінки...
                default:
                    console.log(`ℹ️ WINIX-INIT: Немає специфічної ініціалізації для сторінки ${currentPage}`);
            }
        },

        setupStakingDetailsPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки деталей стейкінгу...");

            // Спочатку перевіряємо, чи є активний стейкінг через API
            if (window.WinixAPI && window.WinixAPI.getStakingData) {
                window.WinixAPI.getStakingData((error, stakingData) => {
                    if (error) {
                        console.error(`❌ WINIX-INIT: Помилка отримання даних стейкінгу: ${window.WinixAPI.handleApiError(error)}`);
                        return;
                    }

                    // Перевіряємо, чи є активний стейкінг
                    if (!stakingData.hasActiveStaking) {
                        // Якщо немає стейкінгу, перенаправляємо на сторінку стейкінгу
                        if (window.showNotification) {
                            window.showNotification(
                                "У вас немає активного стейкінгу",
                                "WARNING",
                                () => window.location.href = "staking.html"
                            );
                        } else {
                            alert("У вас немає активного стейкінгу");
                            window.location.href = "staking.html";
                        }
                        return;
                    }

                    // Оновлюємо відображення деталей стейкінгу
                    this.updateStakingDetailsUI(stakingData);
                });
            }
            // Запасний варіант через WinixCore
            else if (window.WinixCore && window.WinixCore.Staking) {
                // Перевіряємо, чи є активний стейкінг
                if (!window.WinixCore.Staking.hasActiveStaking()) {
                    // Якщо немає стейкінгу, перенаправляємо на сторінку стейкінгу
                    window.WinixCore.UI.showNotification(
                        "У вас немає активного стейкінгу",
                        window.WinixCore.MESSAGE_TYPES.WARNING,
                        () => window.location.href = "staking.html"
                    );
                    return;
                }

                // Оновлюємо відображення деталей стейкінгу
                window.WinixCore.UI.updateStakingDisplay();
            } else {
                console.warn("⚠️ WINIX-INIT: Не знайдено системи стейкінгу!");
            }
        },

        // Оновлення UI деталей стейкінгу
        updateStakingDetailsUI: function(stakingData) {
            // Оновлюємо відображення суми стейкінгу
            const amountEl = document.getElementById('staking-amount');
            if (amountEl) amountEl.textContent = stakingData.amount.toFixed(2);

            // Оновлюємо відображення винагороди
            const rewardEl = document.getElementById('staking-reward');
            if (rewardEl) rewardEl.textContent = stakingData.reward.toFixed(2);

            // Оновлюємо відображення дати закінчення
            const endDateEl = document.getElementById('staking-end-date');
            if (endDateEl) endDateEl.textContent = stakingData.endDate;

            // Оновлюємо відображення відсотка прибутковості
            const percentEl = document.getElementById('staking-percent');
            if (percentEl) percentEl.textContent = stakingData.interestRate + '%';

            // Оновлюємо відображення тривалості
            const durationEl = document.getElementById('staking-duration');
            if (durationEl) durationEl.textContent = stakingData.period + ' днів';
        },

        setupEarnPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки заробітку...");

            // Кнопки підписки на соцмережі
            const subscribeButtons = [
                {id: 'twitter-subscribe', platform: 'twitter'},
                {id: 'telegram-subscribe', platform: 'telegram'},
                {id: 'youtube-subscribe', platform: 'youtube'}
            ];

            subscribeButtons.forEach(button => {
                const btnElement = document.getElementById(button.id);
                if (btnElement) {
                    btnElement.addEventListener('click', function() {
                        localStorage.setItem(`${button.platform}_link_clicked`, 'true');

                        let url = '';
                        switch(button.platform) {
                            case 'twitter': url = 'https://twitter.com/winix_project'; break;
                            case 'telegram': url = 'https://t.me/winix_channel'; break;
                            case 'youtube': url = 'https://youtube.com/@winix_project'; break;
                        }

                        window.open(url, '_blank');
                    });
                }
            });

            // Кнопки перевірки підписки - використовуємо API, якщо доступне
            const verifyButtons = [
                {id: 'twitter-verify', platform: 'twitter', reward: 50},
                {id: 'telegram-verify', platform: 'telegram', reward: 80},
                {id: 'youtube-verify', platform: 'youtube', reward: 50}
            ];

            verifyButtons.forEach(button => {
                const btnElement = document.getElementById(button.id);
                if (btnElement) {
                    btnElement.addEventListener('click', async function() {
                        // Показуємо повідомлення про перевірку
                        if (window.showNotification) {
                            window.showNotification('Перевірка підписки...', 'INFO');
                        }

                        // Перевіряємо, чи користувач клікнув на кнопку підписки
                        if (localStorage.getItem(`${button.platform}_link_clicked`) !== 'true') {
                            if (window.showNotification) {
                                window.showNotification('Спочатку натисніть кнопку "Підписатись"!', 'WARNING');
                            } else {
                                alert('Спочатку натисніть кнопку "Підписатись"!');
                            }
                            return;
                        }

                        // Використовуємо API для перевірки підписки, якщо воно доступне
                        if (window.WinixAPI && window.WinixAPI.verifySocialSubscription) {
                            window.WinixAPI.verifySocialSubscription(button.platform, (error, result) => {
                                if (error) {
                                    if (window.showNotification) {
                                        window.showNotification('Помилка перевірки підписки. Спробуйте ще раз.', 'ERROR');
                                    } else {
                                        alert('Помилка перевірки підписки. Спробуйте ще раз.');
                                    }
                                    return;
                                }

                                if (result.success) {
                                    // Позначаємо завдання як виконане
                                    localStorage.setItem(`${button.platform}_task_completed`, 'true');

                                    // Оновлюємо стилі
                                    const taskItem = btnElement.closest('.task-item');
                                    if (taskItem) {
                                        taskItem.classList.add('completed-task');
                                    }

                                    if (window.showNotification) {
                                        window.showNotification(`Вітаємо! Отримано ${result.reward || button.reward} $WINIX`, 'SUCCESS');
                                    } else {
                                        alert(`Вітаємо! Отримано ${result.reward || button.reward} $WINIX`);
                                    }
                                } else {
                                    if (window.showNotification) {
                                        window.showNotification('Підписку не знайдено. Спробуйте ще раз.', 'ERROR');
                                    } else {
                                        alert('Підписку не знайдено. Спробуйте ще раз.');
                                    }
                                }
                            });
                        }
                        // Якщо API недоступне, використовуємо емуляцію
                        else {
                            // Імітуємо перевірку підписки
                            setTimeout(() => {
                                const randomSuccess = Math.random() > 0.3; // 70% шанс успіху

                                if (randomSuccess) {
                                    // Нараховуємо винагороду через WinixCore, якщо доступний
                                    if (window.WinixCore && window.WinixCore.Balance) {
                                        window.WinixCore.Balance.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`);
                                    } else {
                                        // Емулюємо додавання балансу в localStorage
                                        const currentBalance = parseFloat(localStorage.getItem('userTokens') || '0');
                                        localStorage.setItem('userTokens', (currentBalance + button.reward).toString());
                                        localStorage.setItem('winix_balance', (currentBalance + button.reward).toString());
                                    }

                                    // Позначаємо завдання як виконане
                                    localStorage.setItem(`${button.platform}_task_completed`, 'true');

                                    // Оновлюємо стилі
                                    const taskItem = btnElement.closest('.task-item');
                                    if (taskItem) {
                                        taskItem.classList.add('completed-task');
                                    }

                                    if (window.showNotification) {
                                        window.showNotification(`Вітаємо! Отримано ${button.reward} $WINIX`, 'SUCCESS');
                                    } else {
                                        alert(`Вітаємо! Отримано ${button.reward} $WINIX`);
                                    }
                                } else {
                                    if (window.showNotification) {
                                        window.showNotification('Підписку не знайдено. Спробуйте ще раз.', 'ERROR');
                                    } else {
                                        alert('Підписку не знайдено. Спробуйте ще раз.');
                                    }
                                }
                            }, 1500);
                        }
                    });
                }
            });
        },

        setupWalletPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки гаманця...");

            // Оновлюємо список транзакцій
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateTransactionsList('transaction-list', 3);
                window.WinixCore.UI.updateStakingDisplay();
            }
            // Якщо є API але немає Core, використовуємо API
            else if (window.WinixAPI) {
                // Оновлюємо список транзакцій через API
                const transactionList = document.getElementById('transaction-list');
                if (transactionList) {
                    window.WinixAPI.getTransactions(5, (error, transactions) => {
                        if (error) {
                            console.error(`❌ WINIX-INIT: Помилка отримання транзакцій: ${window.WinixAPI.handleApiError(error)}`);
                            return;
                        }

                        // Оновлюємо список транзакцій
                        this.updateTransactionsList(transactionList, transactions);
                    });
                }

                // Оновлюємо відображення стейкінгу через API
                window.WinixAPI.getStakingData((error, stakingData) => {
                    if (error) return;

                    // Оновлюємо відображення стейкінгу
                    this.updateStakingUI(stakingData);
                });
            }

            // Кнопка "Надіслати"
            const sendButton = document.getElementById('send-button');
            if (sendButton) {
                sendButton.addEventListener('click', function() {
                    window.navigateTo('send.html');
                });
            }

            // Кнопка "Отримати"
            const receiveButton = document.getElementById('receive-button');
            if (receiveButton) {
                receiveButton.addEventListener('click', function() {
                    window.navigateTo('receive.html');
                });
            }

            // Кнопка "Стейкінг"
            const stakingButton = document.getElementById('staking-button');
            if (stakingButton) {
                stakingButton.addEventListener('click', function() {
                    window.navigateTo('staking.html');
                });
            }

            // Кнопка "Переглянути всі" для транзакцій
            const viewAllButton = document.getElementById('view-all-transactions');
            if (viewAllButton) {
                viewAllButton.addEventListener('click', function() {
                    window.navigateTo('transactions.html');
                });
            }
        },

        // Оновлення списку транзакцій
        updateTransactionsList: function(container, transactions) {
            if (!container || !transactions || !transactions.length) return;

            // Очищаємо контейнер
            container.innerHTML = '';

            // Додаємо кожну транзакцію у список
            transactions.forEach(tx => {
                const transactionItem = document.createElement('div');
                transactionItem.className = 'transaction-item';

                const amountClass = tx.amount >= 0 ? 'positive' : 'negative';

                transactionItem.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-title">${tx.description || 'Транзакція'}</div>
                        <div class="transaction-date">${tx.date || new Date().toLocaleDateString()}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">${tx.amount.toFixed(2)}</div>
                `;

                container.appendChild(transactionItem);
            });
        },

        // Оновлення UI стейкінгу
        updateStakingUI: function(stakingData) {
            if (!stakingData) return;

            // Оновлюємо відображення суми стейкінгу
            const stakingAmountEl = document.getElementById('staking-amount');
            if (stakingAmountEl && stakingData.hasActiveStaking) {
                stakingAmountEl.textContent = stakingData.amount.toFixed(2);
            }

            // Оновлюємо відображення винагороди
            const stakingRewardEl = document.getElementById('staking-reward');
            if (stakingRewardEl && stakingData.hasActiveStaking) {
                stakingRewardEl.textContent = stakingData.reward.toFixed(2);
            }

            // Оновлюємо відображення тривалості стейкінгу
            const stakingPeriodEl = document.getElementById('staking-period');
            if (stakingPeriodEl && stakingData.hasActiveStaking) {
                stakingPeriodEl.textContent = stakingData.period + ' днів';
            }

            // Оновлюємо відображення стану стейкінгу
            const stakingStatusEl = document.getElementById('staking-status');
            if (stakingStatusEl) {
                if (stakingData.hasActiveStaking) {
                    stakingStatusEl.textContent = 'Активний';
                    stakingStatusEl.className = 'status active';
                } else {
                    stakingStatusEl.textContent = 'Неактивний';
                    stakingStatusEl.className = 'status inactive';
                }
            }
        },

        setupHomePage: function() {
            console.log("🔄 WINIX-INIT: Налаштування домашньої сторінки...");

            // Оновлюємо показники балансу через WinixCore, якщо доступний
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
            }
            // Або через API, якщо WinixCore недоступний
            else if (window.WinixAPI) {
                window.WinixAPI.getBalance((error, balance) => {
                    if (error) return;

                    // Оновлюємо відображення балансу на сторінці
                    const balanceElements = document.querySelectorAll('#main-balance, .balance-value, #user-tokens');
                    balanceElements.forEach(el => {
                        if (el) {
                            if (el.id === 'main-balance' && el.innerHTML && el.innerHTML.includes('main-balance-icon')) {
                                el.innerHTML = `${balance.tokens.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                            } else {
                                el.textContent = balance.tokens.toFixed(2);
                            }
                        }
                    });
                });
            }
        },

        setupRafflesPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки розіграшів...");

            // Перевіряємо, чи є об'єкт winixUnifiedFixes для інтеграції
            if (window.winixUnifiedFixes) {
                try {
                    // Оновлюємо кількість учасників в розіграшах
                    window.winixUnifiedFixes.updateRaffleParticipantsCount();

                    // Оновлюємо дати закінчення розіграшів
                    window.winixUnifiedFixes.updateRaffleEndDates();

                    // Виправляємо кнопки закриття
                    window.winixUnifiedFixes.fixCloseButtons();

                    console.log("✅ WINIX-INIT: Налаштування сторінки розіграшів завершено");
                } catch (e) {
                    console.error("❌ WINIX-INIT: Помилка налаштування сторінки розіграшів:", e);
                }
            }
            // Якщо немає об'єкта winixUnifiedFixes, але є API
            else if (window.WinixAPI && window.WinixAPI.getRaffles) {
                // Отримуємо дані розіграшів з API
                window.WinixAPI.getRaffles((error, raffles) => {
                    if (error) {
                        console.error(`❌ WINIX-INIT: Помилка отримання даних розіграшів: ${window.WinixAPI.handleApiError(error)}`);
                        return;
                    }

                    // Оновлюємо відображення розіграшів на сторінці
                    this.updateRafflesUI(raffles);

                    console.log("✅ WINIX-INIT: Налаштування сторінки розіграшів через API завершено");
                });
            }
        },

        // Оновлення UI розіграшів
        updateRafflesUI: function(raffles) {
            if (!raffles) return;

            // Оновлюємо головний розіграш
            if (raffles.mainRaffle) {
                // Оновлюємо кількість учасників
                const mainParticipantsEl = document.querySelectorAll('.participants-count');
                mainParticipantsEl.forEach(el => {
                    if (el) el.textContent = raffles.mainRaffle.participants || '1';
                });

                // Оновлюємо дату закінчення
                const mainEndTimeEl = document.getElementById('main-end-time');
                if (mainEndTimeEl) {
                    mainEndTimeEl.textContent = raffles.mainRaffle.endDate || '';
                }

                // Оновлюємо прогрес-бар
                const progressBar = document.querySelector('.progress');
                if (progressBar && raffles.mainRaffle.progressPercent) {
                    progressBar.style.width = `${raffles.mainRaffle.progressPercent}%`;
                }
            }

            // Оновлюємо щоденний розіграш
            if (raffles.dailyRaffle) {
                // Оновлюємо кількість учасників
                const dailyParticipantsEl = document.getElementById('daily-participants');
                if (dailyParticipantsEl) {
                    dailyParticipantsEl.textContent = raffles.dailyRaffle.participants || '1';
                }

                // Оновлюємо дату закінчення
                const dailyEndTimeEl = document.getElementById('daily-end-time');
                if (dailyEndTimeEl) {
                    dailyEndTimeEl.textContent = raffles.dailyRaffle.endDate || '';
                }
            }
        }
    };

    // Перевірка стану ініціалізації та повторні спроби
    function checkInitState() {
        // Збільшуємо лічильник спроб
        initAttempts++;

        // Перевіряємо готовність API модуля
        if (window.WinixAPI) {
            window.WinixInitState.apiInitialized = true;
            console.log("✅ WINIX-INIT: API модуль знайдено");

            // Перевіряємо метод getUserId як індикатор повної готовності API
            if (window.WinixAPI.getUserId) {
                window.WinixInitState.apiReady = true;
                console.log("✅ WINIX-INIT: API модуль повністю готовий");
            }
        }

        // Перевіряємо, чи всі необхідні компоненти ініціалізовано
        if (window.WinixInitState.isFullyInitialized) {
            window.WinixInitState.onFullyInitialized();
        }
        // Якщо ще не все ініціалізовано, але ще не вичерпали спроби
        else if (initAttempts < MAX_INIT_ATTEMPTS) {
            console.log(`🔄 WINIX-INIT: Очікування ініціалізації компонентів (спроба ${initAttempts}/${MAX_INIT_ATTEMPTS})...`);
            setTimeout(checkInitState, 500);
        }
        // Якщо вичерпали спроби, але API ініціалізовано - запускаємо систему на основі API
        else if (window.WinixInitState.apiInitialized) {
            console.log("⚠️ WINIX-INIT: Не всі компоненти ініціалізовано, але API доступне. Запускаємо часткову ініціалізацію.");
            window.WinixInitState.onFullyInitialized();
        }
        // Якщо вичерпали спроби і API не ініціалізовано
        else {
            console.warn("⚠️ WINIX-INIT: Не вдалося дочекатися ініціалізації всіх компонентів!");

            // Спробуємо запустити на основі того, що є
            window.WinixInitState.syncLocalData();
            window.WinixInitState.setupCurrentPageHandlers();

            // Відправляємо подію про часткову ініціалізацію
            document.dispatchEvent(new CustomEvent('winix-partial-initialized'));
        }
    }

    // Встановлюємо обробники для відстеження ініціалізації систем
    document.addEventListener('winix-core-initialized', function() {
        console.log("✅ WINIX-INIT: Core ініціалізовано");
        window.WinixInitState.coreInitialized = true;
        checkInitState();
    });

    document.addEventListener('winix-connector-initialized', function() {
        console.log("✅ WINIX-INIT: Connector ініціалізовано");
        window.WinixInitState.connectorInitialized = true;
        checkInitState();
    });

    document.addEventListener('winix-fix-initialized', function() {
        console.log("✅ WINIX-INIT: Fix ініціалізовано");
        window.WinixInitState.fixInitialized = true;
    });

    document.addEventListener('winix-api-initialized', function() {
        console.log("✅ WINIX-INIT: API модуль ініціалізовано");
        window.WinixInitState.apiInitialized = true;
        checkInitState();
    });

    // Функція для запуску ініціалізації
    window.startWinixInitialization = function() {
        // Просто перевіряємо поточний стан
        checkInitState();
    };

    // Автоматичний запуск ініціалізації
    document.addEventListener('DOMContentLoaded', function() {
        window.startWinixInitialization();
    });

    // Запускаємо першу перевірку стану
    checkInitState();

    console.log("✅ WINIX-INIT: Координатор ініціалізації готовий");
})();

// Інтеграція кнопки "Всі розіграші" з системою WINIX
(function() {
    // Функція для налаштування кнопки "Всі розіграші" з повною інтеграцією в екосистему WINIX
    function setupRafflesButton() {
        console.log("🎮 WINIX: Налаштування кнопки 'Всі розіграші'");

        const rafflesBtn = document.getElementById('view-all-raffles');
        if (!rafflesBtn) return;

        // Очищаємо попередні обробники, що могли бути встановлені
        const newBtn = rafflesBtn.cloneNode(true);
        rafflesBtn.parentNode.replaceChild(newBtn, rafflesBtn);

        // Встановлюємо новий обробник через WinixNavigation (повна інтеграція)
        newBtn.addEventListener('click', function() {
            console.log("🎮 WINIX: Кнопка 'Всі розіграші' натиснута");

            // Використовуємо навігаційну систему WINIX, якщо вона доступна
            if (window.WinixNavigation && window.WinixNavigation.navigateTo) {
                window.WinixNavigation.navigateTo('raffles.html');
            }
            // Резервний метод через WinixCore
            else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.navigateTo) {
                window.WinixCore.UI.navigateTo('raffles.html');
            }
            // Якщо є допоміжна функція navigateTo
            else if (window.navigateTo) {
                window.navigateTo('raffles.html');
            }
            // Резервний стандартний метод
            else {
                window.location.href = 'raffles.html';
            }
        });

        console.log("✅ WINIX: Кнопка 'Всі розіграші' успішно інтегрована");
    }

    // Інтегруємося з системою ініціалізації WINIX
    if (window.WinixInitState) {
        // Якщо система вже ініціалізована, налаштовуємо кнопку зараз
        if (window.WinixInitState.isFullyInitialized) {
            setupRafflesButton();
        }

        // Додаємо обробник для події повної ініціалізації
        document.addEventListener('winix-initialized', setupRafflesButton);

        // Також слухаємо часткову ініціалізацію
        document.addEventListener('winix-partial-initialized', setupRafflesButton);
    } else {
        // Без системи WINIX просто виконуємо при завантаженні
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(setupRafflesButton, 500);
            });
        } else {
            setTimeout(setupRafflesButton, 500);
        }
    }
})();