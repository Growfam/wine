/**
 * winix-connector.js
 *
 * Файл для підключення до сторінок HTML для взаємодії з WinixCore.
 * Цей файл має бути доданий на кожну сторінку після включення winix-core.js та api.js.
 */

(function() {
    // Перевіряємо, чи завантажено WinixCore
    if (!window.WinixCore) {
        console.error('❌ Не знайдено WinixCore! Спочатку підключіть winix-core.js');
        return;
    }

    // Перевіряємо, чи завантажено API модуль
    if (!window.WinixAPI) {
        console.warn('⚠️ Не знайдено API модуль! Рекомендуємо підключити api.js');
    }

    // ДОДАНО: Функція перевірки валідності ID
    function isValidId(id) {
        return id &&
               id !== 'undefined' &&
               id !== 'null' &&
               id !== undefined &&
               id !== null &&
               id.toString().trim() !== '';
    }

    // Функція ініціалізації сторінки
    function initPage() {
        console.log('🔄 Ініціалізація сторінки через WinixCore');

        try {
            // ЗМІНЕНО: Спочатку перевіряємо та очищаємо невалідні ID
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId && !isValidId(storedId)) {
                console.warn("⚠️ CONNECTOR: Видалення невалідного ID з localStorage:", storedId);
                localStorage.removeItem('telegram_user_id');
            }

            // Перевіряємо, чи вже ініціалізовано WinixCore
            if (!window.WinixCoreInitialized && window.WinixCore) {
                window.WinixCore.init();
                window.WinixCoreInitialized = true;
                console.log('✅ WinixCore ініціалізовано через winix-connector');
            }

            // Визначаємо поточну сторінку
            const currentPage = getCurrentPage();
            console.log(`📄 Визначено поточну сторінку: ${currentPage}`);

            // Оновлюємо відображення балансу
            if (window.WinixCore && window.WinixCore.UI) {
                window.WinixCore.UI.updateBalanceDisplay();
            }

            // Запускаємо специфічну для сторінки ініціалізацію
            initSpecificPage(currentPage);

            // Встановлюємо обробники подій
            setupEventHandlers();

            // Відправляємо подію про ініціалізацію
            document.dispatchEvent(new CustomEvent('winix-connector-initialized'));

            console.log('✅ Сторінку успішно ініціалізовано');
        } catch (error) {
            console.error('❌ Помилка ініціалізації сторінки:', error);
        }
    }

    // Визначення поточної сторінки
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();

        if (!filename || filename === '' || filename === 'original-index.html') {
            return 'home';
        }

        // Прибираємо розширення .html, якщо воно є
        return filename.replace('.html', '');
    }

    // Ініціалізація специфічної для сторінки функціональності
    function initSpecificPage(page) {
        switch (page) {
            case 'home':
                initHomePage();
                break;
            case 'wallet':
                initWalletPage();
                break;
            case 'staking':
                initStakingPage();
                break;
            case 'staking-details':
                initStakingDetailsPage();
                break;
            case 'transactions':
                initTransactionsPage();
                break;
            case 'earn':
                initEarnPage();
                break;
            case 'referrals':
                initReferralsPage();
                break;
            default:
                console.log(`ℹ️ Немає специфічної ініціалізації для сторінки ${page}`);
        }
    }

    // Ініціалізація домашньої сторінки
    function initHomePage() {
        console.log('🏠 Ініціалізація домашньої сторінки');

        // Оновлюємо показники балансу
        WinixCore.UI.updateBalanceDisplay();
    }

    // Ініціалізація сторінки гаманця
    function initWalletPage() {
        console.log('💰 Ініціалізація сторінки гаманця');

        // Оновлюємо список транзакцій
        WinixCore.UI.updateTransactionsList('transaction-list', 3);

        // Оновлюємо показники стейкінгу
        WinixCore.UI.updateStakingDisplay();

        // Встановлюємо обробники для кнопок дій
        setupWalletButtons();
    }

    // Ініціалізація сторінки стейкінгу
    function initStakingPage() {
        console.log('🔒 Ініціалізація сторінки стейкінгу');

        // Оновлюємо відображення стейкінгу
        WinixCore.UI.updateStakingDisplay();

        // Встановлюємо обробники очікуваної винагороди
        setupStakingRewardCalculation();
    }

    // Ініціалізація сторінки деталей стейкінгу
    function initStakingDetailsPage() {
        console.log('📊 Ініціалізація сторінки деталей стейкінгу');

        // Перевіряємо, чи є активний стейкінг
        if (!WinixCore.Staking.hasActiveStaking()) {
            // Якщо немає стейкінгу, перенаправляємо на сторінку стейкінгу
            WinixCore.UI.showNotification(
                "У вас немає активного стейкінгу",
                WinixCore.MESSAGE_TYPES.WARNING,
                () => window.location.href = "staking.html"
            );
            return;
        }

        // Оновлюємо відображення деталей стейкінгу
        WinixCore.UI.updateStakingDisplay();
    }

    // Ініціалізація сторінки транзакцій
    function initTransactionsPage() {
        console.log('📃 Ініціалізація сторінки транзакцій');

        // Використовуємо API модуль для отримання транзакцій
        if (window.WinixAPI) {
            // ЗМІНЕНО: Додано перевірку ID перед запитом
            const userId = localStorage.getItem('telegram_user_id');
            if (!isValidId(userId)) {
                console.error('❌ Не вдалося отримати транзакції: невалідний ID користувача');
                WinixCore.UI.showNotification(
                    "Помилка отримання транзакцій. Спробуйте перезавантажити сторінку.",
                    WinixCore.MESSAGE_TYPES.ERROR
                );
                return;
            }

            window.WinixAPI.getTransactions()
                .then(data => {
                    if (data.status === 'success' && Array.isArray(data.data)) {
                        // Оновлюємо список усіх транзакцій
                        WinixCore.UI.updateTransactionsList('transaction-list', 100);
                    }
                })
                .catch(error => {
                    console.error('Помилка отримання транзакцій:', error);
                });
        } else {
            // Запасний варіант, якщо API модуль не завантажений
            WinixCore.UI.updateTransactionsList('transaction-list', 100);
        }
    }

    // Ініціалізація сторінки заробітку
    function initEarnPage() {
        console.log('💸 Ініціалізація сторінки заробітку');

        // Встановлюємо обробники для кнопок заробітку
        setupEarnButtons();
    }

    // Ініціалізація сторінки рефералів
    function initReferralsPage() {
        console.log('👥 Ініціалізація сторінки рефералів');

        // Оновлюємо реферальне посилання
        const referralLinkElement = document.getElementById('referral-link');
        if (referralLinkElement) {
            // Використовуємо API модуль для отримання реферального посилання
            if (window.WinixAPI) {
                // ЗМІНЕНО: Додано перевірку ID перед запитом
                const userId = localStorage.getItem('telegram_user_id');
                if (!isValidId(userId)) {
                    console.warn('⚠️ Не вдалося отримати реферальне посилання: невалідний ID користувача');

                    // Намагаємося використати getUserId для отримання валідного ID
                    const validId = window.WinixAPI.getUserId();
                    if (!validId) {
                        WinixCore.UI.showNotification(
                            "Помилка отримання реферального посилання. Спробуйте перезавантажити сторінку.",
                            WinixCore.MESSAGE_TYPES.ERROR
                        );
                        return;
                    }
                }

                window.WinixAPI.getReferralLink()
                    .then(data => {
                        if (data.status === 'success' && data.data && data.data.referral_link) {
                            referralLinkElement.textContent = data.data.referral_link;
                        }
                    })
                    .catch(error => {
                        console.error('Помилка отримання реферального посилання:', error);
                    });
            } else {
                // Запасний варіант
                referralLinkElement.textContent = WinixCore.Referrals.getReferralLink();
            }
        }

        // Встановлюємо обробники для кнопок реферальної програми
        setupReferralButtons();
    }

    // Встановлення обробників подій для сторінки
    function setupEventHandlers() {
        // Встановлюємо обробники для навігаційних елементів
        setupNavigation();

        // Інші загальні обробники
        setupCommonElements();
    }

    // Встановлення обробників для навігації
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const section = this.getAttribute('data-section');

                // Змінюємо активний елемент
                document.querySelectorAll('.nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                this.classList.add('active');

                // Переходимо на відповідну сторінку
                switch(section) {
                    case 'home':
                        window.navigateTo('original-index.html');
                        break;
                    case 'earn':
                        window.navigateTo('earn.html');
                        break;
                    case 'referrals':
                        window.navigateTo('referrals.html');
                        break;
                    case 'wallet':
                        window.navigateTo('wallet.html');
                        break;
                    case 'general':
                        WinixCore.UI.showNotification("Ця функція буде доступна пізніше", WinixCore.MESSAGE_TYPES.INFO);
                        break;
                }
            });
        });
    }

    // Встановлення обробників для загальних елементів
    function setupCommonElements() {
        // Кнопка "Назад", якщо вона є
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', function() {
                window.history.back();
            });
        }

        // Налаштовуємо тестову кнопку, якщо вона є
        const testRewardBtn = document.getElementById('test-reward-btn');
        if (testRewardBtn) {
            testRewardBtn.addEventListener('click', function() {
                // Використовуємо API модуль для додавання токенів
                if (window.WinixAPI) {
                    // ЗМІНЕНО: Спочатку перевіряємо ID
                    const userId = localStorage.getItem('telegram_user_id');
                    if (!isValidId(userId)) {
                        console.warn('⚠️ Не вдалося додати токени: невалідний ID користувача');

                        // Намагаємося використати getUserId для отримання валідного ID
                        const validId = window.WinixAPI.getUserId();
                        if (!validId) {
                            WinixCore.UI.showNotification(
                                "Не вдалося додати токени. Спробуйте перезавантажити сторінку.",
                                WinixCore.MESSAGE_TYPES.ERROR
                            );
                            return;
                        }
                    }

                    window.WinixAPI.addTokens(50, 'Тестова винагорода')
                        .then(data => {
                            if (data.status === 'success') {
                                WinixCore.UI.showNotification('Додано 50 WINIX!');
                            }
                        })
                        .catch(error => {
                            console.error('Помилка додавання токенів:', error);
                        });
                } else {
                    // Запасний варіант
                    WinixCore.Balance.addTokens(50, 'Тестова винагорода');
                    WinixCore.UI.showNotification('Додано 50 WINIX!');
                }
            });
        }
    }

    // Встановлення обробників для кнопок на сторінці гаманця
    function setupWalletButtons() {
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
    }

    // Встановлення обробників для розрахунку винагороди стейкінгу
    function setupStakingRewardCalculation() {
        const amountInput = document.getElementById('staking-amount');
        const periodSelect = document.getElementById('staking-period');
        const rewardElement = document.getElementById('expected-reward');

        if (!amountInput || !periodSelect || !rewardElement) return;

        // Функція оновлення винагороди
        const updateReward = () => {
            const amount = parseFloat(amountInput.value) || 0;
            const period = parseInt(periodSelect.value) || 14;

            // Використовуємо API модуль для розрахунку очікуваної винагороди
            if (window.WinixAPI) {
                // ЗМІНЕНО: Спочатку перевіряємо ID
                const userId = localStorage.getItem('telegram_user_id');
                if (!isValidId(userId)) {
                    console.warn('⚠️ Не вдалося розрахувати винагороду: невалідний ID користувача');

                    // Намагаємося використати getUserId для отримання валідного ID
                    const validId = window.WinixAPI.getUserId();
                    if (!validId) {
                        // Використовуємо локальний розрахунок як запасний варіант
                        const reward = WinixCore.Staking.calculateExpectedReward(amount, period);
                        rewardElement.textContent = reward.toFixed(2);
                        return;
                    }
                }

                window.WinixAPI.calculateExpectedReward(amount, period)
                    .then(data => {
                        if (data.status === 'success' && data.data && typeof data.data.reward === 'number') {
                            rewardElement.textContent = data.data.reward.toFixed(2);
                        } else {
                            const reward = WinixCore.Staking.calculateExpectedReward(amount, period);
                            rewardElement.textContent = reward.toFixed(2);
                        }
                    })
                    .catch(error => {
                        console.error('Помилка розрахунку винагороди:', error);
                        const reward = WinixCore.Staking.calculateExpectedReward(amount, period);
                        rewardElement.textContent = reward.toFixed(2);
                    });
            } else {
                // Запасний варіант
                const reward = WinixCore.Staking.calculateExpectedReward(amount, period);
                rewardElement.textContent = reward.toFixed(2);
            }
        };

        // Встановлюємо обробники
        amountInput.addEventListener('input', updateReward);
        periodSelect.addEventListener('change', updateReward);

        // Кнопка "Max"
        const maxButton = document.getElementById('max-button');
        if (maxButton) {
            maxButton.addEventListener('click', function() {
                const balance = WinixCore.Balance.getTokens();
                amountInput.value = balance.toFixed(2);
                updateReward();
            });
        }

        // Початкове обчислення
        updateReward();
    }

    // Встановлення обробників для кнопок на сторінці заробітку
    function setupEarnButtons() {
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
                        WinixCore.UI.showNotification('Це завдання вже виконано!', WinixCore.MESSAGE_TYPES.INFO);
                        return;
                    }

                    // Перевіряємо, чи користувач клікнув на кнопку підписки
                    if (localStorage.getItem(`${button.platform}_link_clicked`) !== 'true') {
                        WinixCore.UI.showNotification('Спочатку натисніть кнопку "Підписатись"!', WinixCore.MESSAGE_TYPES.WARNING);
                        return;
                    }

                    WinixCore.UI.showNotification('Перевірка підписки...', WinixCore.MESSAGE_TYPES.INFO);

                    // Імітуємо перевірку підписки
                    setTimeout(() => {
                        const randomSuccess = Math.random() > 0.3; // 70% шанс успіху

                        if (randomSuccess) {
                            // ЗМІНЕНО: Спочатку перевіряємо ID
                            if (window.WinixAPI) {
                                const userId = localStorage.getItem('telegram_user_id');
                                if (!isValidId(userId)) {
                                    console.warn('⚠️ Не вдалося нарахувати винагороду: невалідний ID користувача');

                                    // Намагаємося використати getUserId для отримання валідного ID
                                    const validId = window.WinixAPI.getUserId();
                                    if (!validId) {
                                        WinixCore.UI.showNotification(
                                            "Не вдалося нарахувати винагороду. Спробуйте перезавантажити сторінку.",
                                            WinixCore.MESSAGE_TYPES.ERROR
                                        );
                                        return;
                                    }
                                }

                                window.WinixAPI.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`)
                                    .then(data => {
                                        if (data.status === 'success') {
                                            // Позначаємо завдання як виконане
                                            localStorage.setItem(`${button.platform}_task_completed`, 'true');

                                            // Оновлюємо стилі
                                            const taskItem = btnElement.closest('.task-item');
                                            if (taskItem) {
                                                taskItem.classList.add('completed-task');
                                            }

                                            WinixCore.UI.showNotification(`Вітаємо! Отримано ${button.reward} $WINIX`, WinixCore.MESSAGE_TYPES.SUCCESS);
                                        } else {
                                            WinixCore.UI.showNotification('Помилка нарахування винагороди. Спробуйте ще раз.', WinixCore.MESSAGE_TYPES.ERROR);
                                        }
                                    })
                                    .catch(error => {
                                        console.error('Помилка нарахування винагороди:', error);
                                        WinixCore.UI.showNotification('Помилка нарахування винагороди. Спробуйте ще раз.', WinixCore.MESSAGE_TYPES.ERROR);
                                    });
                            } else {
                                // Запасний варіант
                                WinixCore.Balance.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`);

                                // Позначаємо завдання як виконане
                                localStorage.setItem(`${button.platform}_task_completed`, 'true');

                                // Оновлюємо стилі
                                const taskItem = btnElement.closest('.task-item');
                                if (taskItem) {
                                    taskItem.classList.add('completed-task');
                                }

                                WinixCore.UI.showNotification(`Вітаємо! Отримано ${button.reward} $WINIX`, WinixCore.MESSAGE_TYPES.SUCCESS);
                            }
                        } else {
                            WinixCore.UI.showNotification('Підписку не знайдено. Спробуйте ще раз.', WinixCore.MESSAGE_TYPES.ERROR);
                        }
                    }, 1500);
                });
            }
        });
    }

    // Встановлення обробників для кнопок на сторінці рефералів
    function setupReferralButtons() {
        // Кнопки копіювання реферального посилання
        const inviteButtons = [
            'invite-friends',
            'invite-friends-10',
            'invite-friends-25',
            'invite-friends-100'
        ];

        inviteButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', function() {
                    // Використовуємо API модуль для отримання реферального посилання
                    if (window.WinixAPI) {
                        // ЗМІНЕНО: Спочатку перевіряємо ID
                        const userId = localStorage.getItem('telegram_user_id');
                        if (!isValidId(userId)) {
                            console.warn('⚠️ Не вдалося отримати реферальне посилання: невалідний ID користувача');

                            // Намагаємося використати getUserId для отримання валідного ID
                            const validId = window.WinixAPI.getUserId();
                            if (!validId) {
                                WinixCore.UI.showNotification(
                                    "Не вдалося отримати реферальне посилання. Спробуйте перезавантажити сторінку.",
                                    WinixCore.MESSAGE_TYPES.ERROR
                                );
                                return;
                            }
                        }

                        window.WinixAPI.getReferralLink()
                            .then(data => {
                                let referralLink = '';
                                if (data.status === 'success' && data.data && data.data.referral_link) {
                                    referralLink = data.data.referral_link;
                                } else {
                                    // Запасний варіант
                                    const validId = window.WinixAPI.getUserId();
                                    referralLink = validId ? window.location.origin + '?ref=' + validId : '';
                                }

                                if (referralLink) {
                                    // Копіюємо посилання в буфер обміну
                                    navigator.clipboard.writeText(referralLink)
                                        .then(() => {
                                            WinixCore.UI.showNotification('Реферальне посилання скопійовано!', WinixCore.MESSAGE_TYPES.SUCCESS);
                                        })
                                        .catch(() => {
                                            WinixCore.UI.showNotification('Помилка копіювання посилання', WinixCore.MESSAGE_TYPES.ERROR);
                                        });
                                } else {
                                    WinixCore.UI.showNotification('Не вдалося отримати реферальне посилання', WinixCore.MESSAGE_TYPES.ERROR);
                                }
                            })
                            .catch(error => {
                                console.error('Помилка отримання реферального посилання:', error);
                                WinixCore.UI.showNotification('Помилка отримання реферального посилання', WinixCore.MESSAGE_TYPES.ERROR);
                            });
                    } else {
                        // Запасний варіант
                        const referralLink = WinixCore.Referrals.getReferralLink();

                        if (referralLink) {
                            // Копіюємо посилання в буфер обміну
                            navigator.clipboard.writeText(referralLink)
                                .then(() => {
                                    WinixCore.UI.showNotification('Реферальне посилання скопійовано!', WinixCore.MESSAGE_TYPES.SUCCESS);
                                })
                                .catch(() => {
                                    WinixCore.UI.showNotification('Помилка копіювання посилання', WinixCore.MESSAGE_TYPES.ERROR);
                                });
                        } else {
                            WinixCore.UI.showNotification('Не вдалося отримати реферальне посилання', WinixCore.MESSAGE_TYPES.ERROR);
                        }
                    }
                });
            }
        });
    }

    // Періодична синхронізація даних
    function setupPeriodicSync() {
        // Синхронізуємо дані кожні 30 секунд
        const syncInterval = setInterval(async () => {
            try {
                if (window.WinixAPI) {
                    // ЗМІНЕНО: Додано перевірку валідності ID
                    const userId = localStorage.getItem('telegram_user_id');
                    if (!isValidId(userId)) {
                        console.warn("⚠️ Синхронізацію відкладено: невалідний ID користувача");

                        // Спробуємо отримати валідний ID через покращену функцію
                        const validId = window.WinixAPI.getUserId();
                        if (!validId) {
                            return; // Пропускаємо синхронізацію цього разу
                        }
                    }

                    // Оновлюємо дані користувача
                    const data = await window.WinixAPI.getUserData();

                    if (data.status === 'success') {
                        // Оновлюємо дані в localStorage
                        if (data.data.balance !== undefined) {
                            localStorage.setItem('userTokens', data.data.balance.toString());
                            localStorage.setItem('winix_balance', data.data.balance.toString());
                        }

                        if (data.data.coins !== undefined) {
                            localStorage.setItem('userCoins', data.data.coins.toString());
                            localStorage.setItem('winix_coins', data.data.coins.toString());
                        }

                        // Оновлюємо інтерфейс
                        WinixCore.UI.updateBalanceDisplay();
                    }
                }
            } catch (error) {
                console.error("Помилка синхронізації даних:", error);
            }
        }, 30000); // 30 секунд

        // Очищаємо інтервал при закритті сторінки
        window.addEventListener('beforeunload', () => {
            clearInterval(syncInterval);
        });
    }

    // Запускаємо ініціалізацію при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Перевіряємо, чи вже відбулася повна ініціалізація
        if (window.WinixInitState && window.WinixInitState.isFullyInitialized) {
            console.log('✅ Система вже повністю ініціалізована');
            return;
        }

        // ЗМІНЕНО: Спочатку перевіряємо ID в localStorage
        const userId = localStorage.getItem('telegram_user_id');
        if (userId && !isValidId(userId)) {
            console.warn("⚠️ CONNECTOR: Видалення невалідного ID з localStorage:", userId);
            localStorage.removeItem('telegram_user_id');
        }

        // Ініціалізуємо сторінку
        initPage();

        // Налаштовуємо періодичну синхронізацію
        setupPeriodicSync();
    });

    // Виконуємо дії після повного завантаження сторінки
    window.addEventListener('load', function() {
        // Оновлюємо відображення балансу після повного завантаження
        if (window.WinixCore && window.WinixCore.UI) {
            window.WinixCore.UI.updateBalanceDisplay();
            window.WinixCore.UI.updateStakingDisplay();
        }
    });

    // Якщо DOM вже готовий, ініціалізуємо сторінку зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        // Перевіряємо, чи вже відбулася повна ініціалізація
        if (window.WinixInitState && window.WinixInitState.isFullyInitialized) {
            console.log('✅ Система вже повністю ініціалізована');
            return;
        }

        // ЗМІНЕНО: Спочатку перевіряємо ID в localStorage
        const userId = localStorage.getItem('telegram_user_id');
        if (userId && !isValidId(userId)) {
            console.warn("⚠️ CONNECTOR: Видалення невалідного ID з localStorage:", userId);
            localStorage.removeItem('telegram_user_id');
        }

        // Ініціалізуємо сторінку
        initPage();

        // Налаштовуємо періодичну синхронізацію
        setupPeriodicSync();
    }
})();