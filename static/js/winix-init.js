/**
 * winix-init.js
 *
 * Файл для контролю ініціалізації та координації роботи всіх скриптів системи WINIX.
 * Цей файл повинен бути підключений першим перед іншими скриптами системи.
 */

(function() {
    console.log("🚀 WINIX-INIT: Запуск координатора ініціалізації...");

    // Об'єкт для відстеження стану ініціалізації
    window.WinixInitState = {
        coreInitialized: false,
        connectorInitialized: false,
        fixInitialized: false,

        // Флаг повної ініціалізації системи
        get isFullyInitialized() {
            return this.coreInitialized && this.connectorInitialized;
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
            }
        },

        // Оновлення інтерфейсу
        updateUI: function() {
            console.log("🔄 WINIX-INIT: Оновлення інтерфейсу...");

            // Оновлюємо відображення балансу
            if (window.WinixCore && window.WinixCore.UI) {
                setTimeout(function() {
                    window.WinixCore.UI.updateBalanceDisplay();
                    window.WinixCore.UI.updateStakingDisplay();
                    window.WinixCore.UI.updateTransactionsList('transaction-list', 3);
                }, 100);
            }
        },

        // Налаштування обробників для поточної сторінки
        setupCurrentPageHandlers: function() {
            console.log("🔄 WINIX-INIT: Налаштування обробників для поточної сторінки...");

            // Визначаємо поточну сторінку
            const path = window.location.pathname;
            const filename = path.split('/').pop();

            let currentPage = '';
            if (!filename || filename === '' || filename === 'index.html') {
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
                // Інші сторінки...
                default:
                    console.log(`ℹ️ WINIX-INIT: Немає специфічної ініціалізації для сторінки ${currentPage}`);
            }
        },

        // Функції для налаштування різних сторінок
        setupStakingPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки стейкінгу...");

            // Переконуємося, що ініціалізація системи стейкінгу відбулася
            if (!window.WinixCore || !window.WinixCore.Staking) {
                console.error("❌ WINIX-INIT: Система стейкінгу не ініціалізована!");
                return;
            }

            // Налаштування розрахунку винагороди
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');
            const rewardElement = document.getElementById('expected-reward');

            if (amountInput && periodSelect && rewardElement) {
                // Функція для оновлення очікуваної винагороди
                const updateReward = () => {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    const reward = window.WinixCore.Staking.calculateExpectedReward(amount, period);
                    rewardElement.textContent = reward.toFixed(2);
                };

                // Встановлюємо обробники подій
                amountInput.addEventListener('input', updateReward);
                periodSelect.addEventListener('change', updateReward);

                // Кнопка "Max"
                const maxButton = document.getElementById('max-button');
                if (maxButton) {
                    maxButton.addEventListener('click', function() {
                        const balance = window.WinixCore.Balance.getTokens();
                        amountInput.value = balance.toFixed(2);
                        updateReward();
                    });
                }

                // Початкове обчислення
                updateReward();
            }

            // Кнопка "Застейкати"
            const stakeButton = document.getElementById('stake-button');
            if (stakeButton) {
                stakeButton.addEventListener('click', function() {
                    if (!amountInput) {
                        window.WinixCore.UI.showNotification("Не вдалося знайти поле суми", window.WinixCore.MESSAGE_TYPES.ERROR);
                        return;
                    }

                    const amount = parseFloat(amountInput.value);
                    if (isNaN(amount) || amount <= 0) {
                        window.WinixCore.UI.showNotification("Введіть коректну суму", window.WinixCore.MESSAGE_TYPES.ERROR);
                        return;
                    }

                    const period = parseInt(periodSelect ? periodSelect.value : 14);

                    const result = window.WinixCore.Staking.createStaking(amount, period);

                    if (result.success) {
                        window.WinixCore.UI.showNotification("Стейкінг успішно створено!", window.WinixCore.MESSAGE_TYPES.SUCCESS,
                            () => window.navigateTo('staking-details.html'));
                    }
                });
            }

            // Кнопка "Деталі стейкінгу"
            const detailsButton = document.getElementById('details-button');
            if (detailsButton) {
                detailsButton.addEventListener('click', function() {
                    if (window.WinixCore.Staking.hasActiveStaking()) {
                        window.navigateTo('staking-details.html');
                    } else {
                        window.WinixCore.UI.showNotification("У вас немає активного стейкінгу", window.WinixCore.MESSAGE_TYPES.WARNING);
                    }
                });
            }

            // Кнопка "Скасувати стейкінг"
            const cancelStakingButton = document.getElementById('cancel-staking-button');
            if (cancelStakingButton) {
                cancelStakingButton.addEventListener('click', function() {
                    if (!window.WinixCore.Staking.hasActiveStaking()) {
                        window.WinixCore.UI.showNotification("У вас немає активного стейкінгу", window.WinixCore.MESSAGE_TYPES.WARNING);
                        return;
                    }

                    if (confirm("Ви впевнені, що хочете скасувати стейкінг? Буде утримано 20% від суми стейкінгу як штраф.")) {
                        const result = window.WinixCore.Staking.cancelStaking();

                        if (result.success) {
                            window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.SUCCESS,
                                () => window.navigateTo('wallet.html'));
                        }
                    }
                });
            }

            // Оновлюємо відображення статусу стейкінгу
            window.WinixCore.UI.updateStakingDisplay();
        },

        setupStakingDetailsPage: function() {
            console.log("🔄 WINIX-INIT: Налаштування сторінки деталей стейкінгу...");

            // Переконуємося, що ініціалізація системи стейкінгу відбулася
            if (!window.WinixCore || !window.WinixCore.Staking) {
                console.error("❌ WINIX-INIT: Система стейкінгу не ініціалізована!");
                return;
            }

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

            // Кнопка "Додати до стейкінгу"
            const addButton = document.getElementById('add-to-stake-button');
            if (addButton) {
                addButton.addEventListener('click', async function() {
                    // Запитуємо суму для додавання
                    const amount = prompt("Введіть суму для додавання до стейкінгу:");

                    if (amount === null) return; // Натиснуто "Скасувати"

                    const numAmount = parseFloat(amount);
                    if (isNaN(numAmount) || numAmount <= 0) {
                        window.WinixCore.UI.showNotification("Введіть коректну суму", window.WinixCore.MESSAGE_TYPES.ERROR);
                        return;
                    }

                    const result = window.WinixCore.Staking.addToStaking(numAmount);

                    if (result.success) {
                        window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.SUCCESS);
                    } else {
                        window.WinixCore.UI.showNotification(result.message, window.WinixCore.MESSAGE_TYPES.ERROR);
                    }
                });
            }

            // Оновлюємо відображення деталей стейкінгу
            window.WinixCore.UI.updateStakingDisplay();
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

            // Кнопки перевірки підписки
            const verifyButtons = [
                {id: 'twitter-verify', platform: 'twitter', reward: 50},
                {id: 'telegram-verify', platform: 'telegram', reward: 80},
                {id: 'youtube-verify', platform: 'youtube', reward: 50}
            ];

            verifyButtons.forEach(button => {
                const btnElement = document.getElementById(button.id);
                if (btnElement) {
                    btnElement.addEventListener('click', async function() {
                        // Перевіряємо, чи завдання вже виконано
                        if (localStorage.getItem(`${button.platform}_task_completed`) === 'true') {
                            window.WinixCore.UI.showNotification('Це завдання вже виконано!', window.WinixCore.MESSAGE_TYPES.INFO);
                            return;
                        }

                        // Перевіряємо, чи користувач клікнув на кнопку підписки
                        if (localStorage.getItem(`${button.platform}_link_clicked`) !== 'true') {
                            window.WinixCore.UI.showNotification('Спочатку натисніть кнопку "Підписатись"!', window.WinixCore.MESSAGE_TYPES.WARNING);
                            return;
                        }

                        window.WinixCore.UI.showNotification('Перевірка підписки...', window.WinixCore.MESSAGE_TYPES.INFO);

                        // Імітуємо перевірку підписки
                        setTimeout(() => {
                            const randomSuccess = Math.random() > 0.3; // 70% шанс успіху

                            if (randomSuccess) {
                                // Нараховуємо винагороду
                                window.WinixCore.Balance.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`);

                                // Позначаємо завдання як виконане
                                localStorage.setItem(`${button.platform}_task_completed`, 'true');

                                // Оновлюємо стилі
                                const taskItem = btnElement.closest('.task-item');
                                if (taskItem) {
                                    taskItem.classList.add('completed-task');
                                }

                                window.WinixCore.UI.showNotification(`Вітаємо! Отримано ${button.reward} $WINIX`, window.WinixCore.MESSAGE_TYPES.SUCCESS);
                            } else {
                                window.WinixCore.UI.showNotification('Підписку не знайдено. Спробуйте ще раз.', window.WinixCore.MESSAGE_TYPES.ERROR);
                            }
                        }, 1500);
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

        setupHomePage: function() {
            console.log("🔄 WINIX-INIT: Налаштування домашньої сторінки...");

            // Оновлюємо показники балансу
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
            }
        }
    };

    // Перевірка стану ініціалізації
    function checkInitState() {
        if (window.WinixInitState.isFullyInitialized) {
            window.WinixInitState.onFullyInitialized();
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

    // Функція для запуску ініціалізації
    window.startWinixInitialization = function() {
        // Просто перевіряємо поточний стан
        checkInitState();
    };

    // Автоматичний запуск ініціалізації
    document.addEventListener('DOMContentLoaded', function() {
        window.startWinixInitialization();
    });

    console.log("✅ WINIX-INIT: Координатор ініціалізації готовий");
})();