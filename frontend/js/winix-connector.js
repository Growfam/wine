/**
 * winix-connector.js
 *
 * Файл для підключення до сторінок HTML для взаємодії з WinixCore.
 * Цей файл має бути доданий на кожну сторінку після включення winix-core.js та api.js.
 */

(function() {
    console.log("🔄 Ініціалізація WINIX Connector...");

    // Перевірка ініціалізації Telegram WebApp
    initTelegramWebApp();

    // Флаг, щоб запобігти повторній ініціалізації
    window.WinixConnectorInitialized = window.WinixConnectorInitialized || false;

    if (window.WinixConnectorInitialized) {
        console.log("ℹ️ WINIX Connector вже ініціалізовано, пропускаємо");
        return;
    }

    // Перевіряємо, чи завантажено WinixCore
    if (!window.WinixCore) {
        console.error('❌ Не знайдено WinixCore! Спочатку підключіть winix-core.js');
        console.log("⚠️ Connector продовжить роботу в обмеженому режимі");
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

    // ДОДАНО: Ініціалізація Telegram WebApp
    function initTelegramWebApp() {
        try {
            // Перевіряємо наявність Telegram WebApp API
            if (window.Telegram && window.Telegram.WebApp) {
                console.log("✅ Telegram WebApp API знайдено");

                // Викликаємо методи ready() та expand()
                try {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                    console.log("✅ Telegram WebApp успішно ініціалізовано");

                    // Перевіряємо наявність даних користувача
                    if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                        const user = window.Telegram.WebApp.initDataUnsafe.user;
                        const userId = user.id.toString();

                        if (isValidId(userId)) {
                            localStorage.setItem('telegram_user_id', userId);
                            console.log("✅ Отримано Telegram ID:", userId);
                        }
                    } else {
                        console.warn("⚠️ Дані користувача відсутні в Telegram WebApp");
                    }
                } catch (e) {
                    console.error("❌ Помилка ініціалізації Telegram WebApp:", e);
                }
            } else {
                console.warn("⚠️ Telegram WebApp API не знайдено. Можливо, додаток запущено поза Telegram.");
            }
        } catch (e) {
            console.error("❌ Критична помилка при ініціалізації Telegram WebApp:", e);
        }
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

            // ДОДАНО: Викликаємо getUserData для отримання актуального ID, якщо WinixAuth доступний
            if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                window.WinixAuth.getUserData()
                    .then(() => {
                        console.log("✅ CONNECTOR: Дані користувача оновлено при ініціалізації сторінки");
                    })
                    .catch(error => {
                        console.warn("⚠️ CONNECTOR: Помилка оновлення даних користувача", error);
                    });
            }

            // Перевіряємо, чи вже ініціалізовано WinixCore
            if (!window.WinixCoreInitialized && window.WinixCore) {
                // ЗМІНЕНО: Додаємо перевірку наявності методу init перед його викликом
                if (typeof window.WinixCore.init === 'function') {
                    window.WinixCore.init();
                    window.WinixCoreInitialized = true;
                    console.log('✅ WinixCore ініціалізовано через winix-connector');
                } else {
                    console.warn('⚠️ WinixCore.init не є функцією. Можливо, WinixCore не повністю завантажений.');
                }
            }

            // Визначаємо поточну сторінку
            const currentPage = getCurrentPage();
            console.log(`📄 Визначено поточну сторінку: ${currentPage}`);

            // Оновлюємо відображення балансу, якщо доступно
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateBalanceDisplay === 'function') {
                try {
                    window.WinixCore.UI.updateBalanceDisplay();
                } catch (e) {
                    console.warn("⚠️ Помилка при оновленні відображення балансу:", e);
                }
            }

            // Запускаємо специфічну для сторінки ініціалізацію
            initSpecificPage(currentPage);

            // Встановлюємо обробники подій
            setupEventHandlers();

            // Відправляємо подію про ініціалізацію
            document.dispatchEvent(new CustomEvent('winix-connector-initialized'));

            // Встановлюємо флаг успішної ініціалізації
            window.WinixConnectorInitialized = true;

            console.log('✅ Сторінку успішно ініціалізовано');
        } catch (error) {
            console.error('❌ Помилка ініціалізації сторінки:', error);
        }
    }

    // Визначення поточної сторінки
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();

        if (!filename || filename === '' || filename === 'original-index.html' || filename === 'index.html') {
            return 'home';
        }

        // Прибираємо розширення .html, якщо воно є
        return filename.replace('.html', '');
    }

    // Ініціалізація специфічної для сторінки функціональності
    function initSpecificPage(page) {
        // Перевіряємо наявність WinixCore перед ініціалізацією сторінки
        if (!window.WinixCore || !window.WinixCore.UI) {
            console.warn(`⚠️ WinixCore або WinixCore.UI відсутні при ініціалізації сторінки ${page}`);
            return;
        }

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

        try {
            // Оновлюємо показники балансу
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateBalanceDisplay === 'function') {
                window.WinixCore.UI.updateBalanceDisplay();
            }
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації домашньої сторінки:", e);
        }
    }

    // Ініціалізація сторінки гаманця
    function initWalletPage() {
        console.log('💰 Ініціалізація сторінки гаманця');

        try {
            // ДОДАНО: Перевіряємо ID перед оновленням
            const userId = window.WinixAPI ? window.WinixAPI.getUserId() : localStorage.getItem('telegram_user_id');
            if (isValidId(userId)) {
                console.log(`💰 Wallet ініціалізація з ID: ${userId}`);
            } else {
                console.warn('⚠️ Wallet ініціалізація без ID, буде запущено повторну спробу');
                if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                    window.WinixAuth.getUserData().catch(e => console.error('Помилка отримання даних:', e));
                }
            }

            // Оновлюємо список транзакцій
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateTransactionsList === 'function') {
                window.WinixCore.UI.updateTransactionsList('transaction-list', 3);
            }

            // Оновлюємо показники стейкінгу
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateStakingDisplay === 'function') {
                window.WinixCore.UI.updateStakingDisplay();
            }

            // Встановлюємо обробники для кнопок дій
            setupWalletButtons();
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки гаманця:", e);
        }
    }

    // Ініціалізація сторінки стейкінгу
    function initStakingPage() {
        console.log('🔒 Ініціалізація сторінки стейкінгу');

        try {
            // Оновлюємо відображення стейкінгу
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateStakingDisplay === 'function') {
                window.WinixCore.UI.updateStakingDisplay();
            }

            // Встановлюємо обробники очікуваної винагороди
            setupStakingRewardCalculation();
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки стейкінгу:", e);
        }
    }

    // Ініціалізація сторінки деталей стейкінгу
    function initStakingDetailsPage() {
        console.log('📊 Ініціалізація сторінки деталей стейкінгу');

        try {
            // Перевіряємо, чи є активний стейкінг
            if (window.WinixCore && window.WinixCore.Staking && typeof window.WinixCore.Staking.hasActiveStaking === 'function') {
                if (!window.WinixCore.Staking.hasActiveStaking()) {
                    // Якщо немає стейкінгу, перенаправляємо на сторінку стейкінгу
                    if (window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                        window.WinixCore.UI.showNotification(
                            "У вас немає активного стейкінгу",
                            window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.WARNING : 'warning',
                            () => window.location.href = "staking.html"
                        );
                    } else {
                        alert("У вас немає активного стейкінгу");
                        window.location.href = "staking.html";
                    }
                    return;
                }
            }

            // Оновлюємо відображення деталей стейкінгу
            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateStakingDisplay === 'function') {
                window.WinixCore.UI.updateStakingDisplay();
            }
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки деталей стейкінгу:", e);
        }
    }

    // Ініціалізація сторінки транзакцій
    function initTransactionsPage() {
        console.log('📃 Ініціалізація сторінки транзакцій');

        try {
            // Використовуємо API модуль для отримання транзакцій
            if (window.WinixAPI && typeof window.WinixAPI.getTransactions === 'function') {
                // ЗМІНЕНО: Додано спробу отримати свіжий ID через getUserData перед запитом
                if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                    window.WinixAuth.getUserData()
                        .then(() => {
                            // Тепер отримуємо транзакції з оновленим ID
                            window.WinixAPI.getTransactions()
                                .then(data => {
                                    if (data.status === 'success' && Array.isArray(data.data)) {
                                        // Оновлюємо список усіх транзакцій
                                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateTransactionsList === 'function') {
                                            window.WinixCore.UI.updateTransactionsList('transaction-list', 100);
                                        }
                                    }
                                })
                                .catch(error => {
                                    console.error('Помилка отримання транзакцій:', error);
                                });
                        })
                        .catch(error => {
                            console.warn('⚠️ Не вдалося оновити дані користувача:', error);

                            // Перевіряємо ID перед запитом
                            const userId = localStorage.getItem('telegram_user_id');
                            if (!isValidId(userId)) {
                                console.error('❌ Не вдалося отримати транзакції: невалідний ID користувача');
                                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                    window.WinixCore.UI.showNotification(
                                        "Помилка отримання транзакцій. Спробуйте перезавантажити сторінку.",
                                        window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                                    );
                                }
                                return;
                            }

                            // Пробуємо отримати транзакції з існуючим ID
                            window.WinixAPI.getTransactions()
                                .then(data => {
                                    if (data.status === 'success' && Array.isArray(data.data)) {
                                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateTransactionsList === 'function') {
                                            window.WinixCore.UI.updateTransactionsList('transaction-list', 100);
                                        }
                                    }
                                })
                                .catch(error => {
                                    console.error('Помилка отримання транзакцій:', error);
                                });
                        });
                } else {
                    // Якщо немає функції getUserData, використовуємо звичайний підхід
                    const userId = localStorage.getItem('telegram_user_id');
                    if (!isValidId(userId)) {
                        console.error('❌ Не вдалося отримати транзакції: невалідний ID користувача');
                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                            window.WinixCore.UI.showNotification(
                                "Помилка отримання транзакцій. Спробуйте перезавантажити сторінку.",
                                window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                            );
                        }
                        return;
                    }

                    window.WinixAPI.getTransactions()
                        .then(data => {
                            if (data.status === 'success' && Array.isArray(data.data)) {
                                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateTransactionsList === 'function') {
                                    window.WinixCore.UI.updateTransactionsList('transaction-list', 100);
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Помилка отримання транзакцій:', error);
                        });
                }
            } else {
                // Запасний варіант, якщо API модуль не завантажений
                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateTransactionsList === 'function') {
                    window.WinixCore.UI.updateTransactionsList('transaction-list', 100);
                }
            }
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки транзакцій:", e);
        }
    }

    // Ініціалізація сторінки заробітку
    function initEarnPage() {
        console.log('💸 Ініціалізація сторінки заробітку');

        try {
            // Встановлюємо обробники для кнопок заробітку
            setupEarnButtons();
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки заробітку:", e);
        }
    }

    // Ініціалізація сторінки рефералів
    function initReferralsPage() {
        console.log('👥 Ініціалізація сторінки рефералів');

        try {
            // ДОДАНО: Спочатку оновлюємо ID через getUserData
            if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                window.WinixAuth.getUserData()
                    .then(() => {
                        console.log("✅ Дані користувача оновлено для сторінки рефералів");
                        updateReferralLinks();
                    })
                    .catch(error => {
                        console.warn("⚠️ Помилка оновлення даних користувача:", error);
                        updateReferralLinks();
                    });
            } else {
                updateReferralLinks();
            }

            // Встановлюємо обробники для кнопок реферальної програми
            setupReferralButtons();
        } catch (e) {
            console.warn("⚠️ Помилка при ініціалізації сторінки рефералів:", e);
        }
    }

    // Функція для оновлення реферального посилання
    function updateReferralLinks() {
        try {
            const referralLinkElement = document.getElementById('referral-link');
            if (referralLinkElement) {
                if (window.WinixAPI && typeof window.WinixAPI.getReferralLink === 'function') {
                    const userId = localStorage.getItem('telegram_user_id');
                    if (!isValidId(userId)) {
                        console.warn('⚠️ Не вдалося отримати реферальне посилання: невалідний ID користувача');

                        // Намагаємося використати getUserId для отримання валідного ID
                        const validId = window.WinixAPI.getUserId();
                        if (!validId) {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification(
                                    "Помилка отримання реферального посилання. Спробуйте перезавантажити сторінку.",
                                    window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                                );
                            }
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
                } else if (window.WinixCore && window.WinixCore.Referrals && typeof window.WinixCore.Referrals.getReferralLink === 'function') {
                    // Запасний варіант
                    referralLinkElement.textContent = window.WinixCore.Referrals.getReferralLink();
                }
            }
        } catch (e) {
            console.warn("⚠️ Помилка при оновленні реферальних посилань:", e);
        }
    }

    // Встановлення обробників подій для сторінки
    function setupEventHandlers() {
        try {
            // Встановлюємо обробники для навігаційних елементів
            setupNavigation();

            // Інші загальні обробники
            setupCommonElements();
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників подій:", e);
        }
    }

    // Встановлення обробників для навігації
    function setupNavigation() {
        try {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                // Створюємо копію елемента для видалення всіх обробників
                const newItem = item.cloneNode(true);
                if (item.parentNode) {
                    item.parentNode.replaceChild(newItem, item);
                }

                newItem.addEventListener('click', function() {
                    const section = this.getAttribute('data-section');
                    if (!section) return;

                    // Змінюємо активний елемент
                    document.querySelectorAll('.nav-item').forEach(navItem => {
                        navItem.classList.remove('active');
                    });
                    this.classList.add('active');

                    // Переходимо на відповідну сторінку
                    navigateTo(section);
                });
            });
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників навігації:", e);
        }
    }

    // Функція для навігації
    function navigateTo(section) {
        try {
            // Визначаємо URL для переходу
            let url = '';
            switch(section) {
                case 'home':
                    url = 'original-index.html';
                    break;
                case 'earn':
                    url = 'earn.html';
                    break;
                case 'referrals':
                    url = 'referrals.html';
                    break;
                case 'wallet':
                    url = 'wallet.html';
                    break;
                case 'general':
                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                        window.WinixCore.UI.showNotification(
                            "Ця функція буде доступна пізніше",
                            window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.INFO : 'info'
                        );
                    } else {
                        alert("Ця функція буде доступна пізніше");
                    }
                    return;
                default:
                    url = section + '.html';
            }

            // Зберігаємо поточний баланс перед навігацією
            saveBalanceBeforeNavigation();

            // Переходимо на сторінку
            window.location.href = url;
        } catch (e) {
            console.error("❌ Помилка при навігації:", e);
        }
    }

    // Збереження балансу перед навігацією
    function saveBalanceBeforeNavigation() {
        try {
            if (window.WinixCore && window.WinixCore.Balance) {
                if (typeof window.WinixCore.Balance.getTokens === 'function') {
                    const tokens = window.WinixCore.Balance.getTokens();
                    sessionStorage.setItem('lastBalance', tokens.toString());
                }

                if (typeof window.WinixCore.Balance.getCoins === 'function') {
                    const coins = window.WinixCore.Balance.getCoins();
                    sessionStorage.setItem('lastCoins', coins.toString());
                }
            } else if (window.balanceSystem) {
                if (typeof window.balanceSystem.getTokens === 'function') {
                    const tokens = window.balanceSystem.getTokens();
                    sessionStorage.setItem('lastBalance', tokens.toString());
                }

                if (typeof window.balanceSystem.getCoins === 'function') {
                    const coins = window.balanceSystem.getCoins();
                    sessionStorage.setItem('lastCoins', coins.toString());
                }
            }

            sessionStorage.setItem('navigationTime', Date.now().toString());
        } catch (e) {
            console.warn("⚠️ Помилка при збереженні балансу:", e);
        }
    }

    // Встановлення обробників для загальних елементів
    function setupCommonElements() {
        try {
            // Кнопка "Назад", якщо вона є
            const backButton = document.getElementById('back-button');
            if (backButton) {
                // Створюємо копію елемента для видалення всіх обробників
                const newBackButton = backButton.cloneNode(true);
                if (backButton.parentNode) {
                    backButton.parentNode.replaceChild(newBackButton, backButton);
                }

                newBackButton.addEventListener('click', function() {
                    // Зберігаємо поточний баланс перед навігацією
                    saveBalanceBeforeNavigation();

                    // Визначаємо, на яку сторінку повертатися
                    const currentPage = getCurrentPage();

                    if (currentPage === 'staking-details') {
                        window.location.href = 'staking.html';
                    } else if (currentPage === 'staking') {
                        window.location.href = 'wallet.html';
                    } else {
                        window.history.back();
                    }
                });
            }

            // Налаштовуємо тестову кнопку, якщо вона є
            const testRewardBtn = document.getElementById('test-reward-btn');
            if (testRewardBtn) {
                // Створюємо копію елемента для видалення всіх обробників
                const newTestRewardBtn = testRewardBtn.cloneNode(true);
                if (testRewardBtn.parentNode) {
                    testRewardBtn.parentNode.replaceChild(newTestRewardBtn, testRewardBtn);
                }

                newTestRewardBtn.addEventListener('click', function() {
                    // ДОДАНО: Спочатку оновлюємо ID через getUserData
                    if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                        window.WinixAuth.getUserData()
                            .then(() => {
                                addTestTokens();
                            })
                            .catch(error => {
                                console.warn("⚠️ Помилка оновлення даних користувача:", error);
                                addTestTokens();
                            });
                    } else {
                        addTestTokens();
                    }
                });
            }
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні загальних обробників:", e);
        }
    }

    // Функція для додавання тестових токенів
    function addTestTokens() {
        try {
            // Використовуємо API модуль для додавання токенів
            if (window.WinixAPI && typeof window.WinixAPI.addTokens === 'function') {
                // Перевіряємо ID
                const userId = localStorage.getItem('telegram_user_id');
                if (!isValidId(userId)) {
                    console.warn('⚠️ Не вдалося додати токени: невалідний ID користувача');

                    // Намагаємося використати getUserId для отримання валідного ID
                    if (typeof window.WinixAPI.getUserId === 'function') {
                        const validId = window.WinixAPI.getUserId();
                        if (!validId) {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification(
                                    "Не вдалося додати токени. Спробуйте перезавантажити сторінку.",
                                    window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                                );
                            } else {
                                alert("Не вдалося додати токени. Спробуйте перезавантажити сторінку.");
                            }
                            return;
                        }
                    }
                }

                window.WinixAPI.addTokens(50, 'Тестова винагорода')
                    .then(data => {
                        if (data.status === 'success') {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification('Додано 50 WINIX!');
                            } else {
                                alert('Додано 50 WINIX!');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Помилка додавання токенів:', error);
                    });
            } else if (window.WinixCore && window.WinixCore.Balance && typeof window.WinixCore.Balance.addTokens === 'function') {
                // Запасний варіант
                window.WinixCore.Balance.addTokens(50, 'Тестова винагорода');
                if (window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                    window.WinixCore.UI.showNotification('Додано 50 WINIX!');
                } else {
                    alert('Додано 50 WINIX!');
                }
            } else {
                alert('Додано 50 WINIX! (тільки демо)');
            }
        } catch (e) {
            console.error("❌ Помилка при додаванні тестових токенів:", e);
        }
    }

    // Встановлення обробників для кнопок на сторінці гаманця
    function setupWalletButtons() {
        try {
            // Кнопка "Надіслати"
            const sendButton = document.getElementById('send-button');
            if (sendButton) {
                // Створюємо копію елемента для видалення всіх обробників
                const newSendButton = sendButton.cloneNode(true);
                if (sendButton.parentNode) {
                    sendButton.parentNode.replaceChild(newSendButton, sendButton);
                }

                newSendButton.addEventListener('click', function() {
                    saveBalanceBeforeNavigation();
                    window.location.href = 'send.html';
                });
            }

            // Кнопка "Отримати"
            const receiveButton = document.getElementById('receive-button');
            if (receiveButton) {
                // Створюємо копію елемента для видалення всіх обробників
                const newReceiveButton = receiveButton.cloneNode(true);
                if (receiveButton.parentNode) {
                    receiveButton.parentNode.replaceChild(newReceiveButton, receiveButton);
                }

                newReceiveButton.addEventListener('click', function() {
                    saveBalanceBeforeNavigation();
                    window.location.href = 'receive.html';
                });
            }

            // Кнопка "Стейкінг"
            const stakingButton = document.getElementById('staking-button');
            if (stakingButton) {
                // Створюємо копію елемента для видалення всіх обробників
                const newStakingButton = stakingButton.cloneNode(true);
                if (stakingButton.parentNode) {
                    stakingButton.parentNode.replaceChild(newStakingButton, stakingButton);
                }

                newStakingButton.addEventListener('click', function() {
                    saveBalanceBeforeNavigation();
                    window.location.href = 'staking.html';
                });
            }

            // Кнопка "Переглянути всі" для транзакцій
            const viewAllButton = document.getElementById('view-all-transactions');
            if (viewAllButton) {
                // Створюємо копію елемента для видалення всіх обробників
                const newViewAllButton = viewAllButton.cloneNode(true);
                if (viewAllButton.parentNode) {
                    viewAllButton.parentNode.replaceChild(newViewAllButton, viewAllButton);
                }

                newViewAllButton.addEventListener('click', function() {
                    saveBalanceBeforeNavigation();
                    window.location.href = 'transactions.html';
                });
            }
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників для кнопок гаманця:", e);
        }
    }

    // Встановлення обробників для розрахунку винагороди стейкінгу
    function setupStakingRewardCalculation() {
        try {
            const amountInput = document.getElementById('staking-amount');
            const periodSelect = document.getElementById('staking-period');
            const rewardElement = document.getElementById('expected-reward');

            if (!amountInput || !periodSelect || !rewardElement) return;

            // Функція оновлення винагороди
            const updateReward = () => {
                try {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Використовуємо API модуль для розрахунку очікуваної винагороди
                    if (window.WinixAPI && typeof window.WinixAPI.calculateExpectedReward === 'function') {
                        // ДОДАНО: Спочатку оновлюємо ID через getUserData
                        if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                            window.WinixAuth.getUserData()
                                .then(() => {
                                    calculateReward();
                                })
                                .catch(error => {
                                    console.warn("⚠️ Помилка оновлення даних користувача:", error);
                                    calculateReward();
                                });
                        } else {
                            calculateReward();
                        }
                    } else {
                        // Запасний варіант
                        localCalculateReward();
                    }
                } catch (e) {
                    console.warn("⚠️ Помилка при оновленні винагороди стейкінгу:", e);
                    localCalculateReward();
                }
            };

            // Функція локального розрахунку винагороди
            function localCalculateReward() {
                try {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Визначаємо відсоток винагороди
                    let rewardPercent;
                    if (period === 7) rewardPercent = 4;
                    else if (period === 14) rewardPercent = 9;
                    else if (period === 28) rewardPercent = 15;
                    else rewardPercent = 9;

                    // Розраховуємо винагороду
                    const reward = amount * (rewardPercent / 100);

                    // Оновлюємо відображення
                    rewardElement.textContent = reward.toFixed(2);
                } catch (e) {
                    console.error("❌ Помилка при локальному розрахунку винагороди:", e);
                    rewardElement.textContent = '0.00';
                }
            }

            // Функція для розрахунку винагороди через API
            function calculateReward() {
                try {
                    const amount = parseFloat(amountInput.value) || 0;
                    const period = parseInt(periodSelect.value) || 14;

                    // Перевіряємо ID
                    const userId = localStorage.getItem('telegram_user_id');
                    if (!isValidId(userId)) {
                        console.warn('⚠️ Не вдалося розрахувати винагороду: невалідний ID користувача');

                        // Намагаємося використати getUserId для отримання валідного ID
                        if (typeof window.WinixAPI.getUserId === 'function') {
                            const validId = window.WinixAPI.getUserId();
                            if (!validId) {
                                // Використовуємо локальний розрахунок як запасний варіант
                                localCalculateReward();
                                return;
                            }
                        } else {
                            localCalculateReward();
                            return;
                        }
                    }

                    window.WinixAPI.calculateExpectedReward(amount, period)
                        .then(data => {
                            if (data.status === 'success' && data.data && typeof data.data.reward === 'number') {
                                rewardElement.textContent = data.data.reward.toFixed(2);
                            } else {
                                // Локальний розрахунок при помилці даних
                                localCalculateReward();
                            }
                        })
                        .catch(error => {
                            console.error('Помилка розрахунку винагороди:', error);
                            // Локальний розрахунок при помилці запиту
                            localCalculateReward();
                        });
                } catch (e) {
                    console.error('Помилка при спробі розрахунку винагороди:', e);
                    localCalculateReward();
                }
            }

            // Встановлюємо обробники подій для елементів форми
            // Створюємо копії елементів для видалення всіх обробників
            if (amountInput.parentNode) {
                const newAmountInput = amountInput.cloneNode(true);
                amountInput.parentNode.replaceChild(newAmountInput, amountInput);
                newAmountInput.addEventListener('input', updateReward);
            }

            if (periodSelect.parentNode) {
                const newPeriodSelect = periodSelect.cloneNode(true);
                periodSelect.parentNode.replaceChild(newPeriodSelect, periodSelect);
                newPeriodSelect.addEventListener('change', updateReward);
            }

            // Кнопка "Max"
            const maxButton = document.getElementById('max-button');
            if (maxButton && amountInput) {
                // Створюємо копію елемента для видалення всіх обробників
                const newMaxButton = maxButton.cloneNode(true);
                if (maxButton.parentNode) {
                    maxButton.parentNode.replaceChild(newMaxButton, maxButton);
                }

                newMaxButton.addEventListener('click', function() {
                    try {
                        let balance = 0;

                        // Отримуємо баланс
                        if (window.WinixCore && window.WinixCore.Balance && typeof window.WinixCore.Balance.getTokens === 'function') {
                            balance = window.WinixCore.Balance.getTokens();
                        } else {
                            // Спроба отримати баланс з localStorage
                            balance = parseFloat(localStorage.getItem('userTokens') || '0');
                        }

                        // Оновлюємо значення поля вводу
                        document.getElementById('staking-amount').value = balance.toFixed(2);

                        // Викликаємо оновлення винагороди
                        updateReward();
                    } catch (e) {
                        console.error("❌ Помилка при використанні кнопки Max:", e);
                    }
                });
            }

            // Початкове обчислення
            updateReward();
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників розрахунку винагороди стейкінгу:", e);
        }
    }

    // Встановлення обробників для кнопок на сторінці заробітку
    function setupEarnButtons() {
        try {
            // Кнопки підписки на соцмережі
            const subscribeButtons = [
                {id: 'twitter-subscribe', platform: 'twitter'},
                {id: 'telegram-subscribe', platform: 'telegram'},
                {id: 'youtube-subscribe', platform: 'youtube'}
            ];

            subscribeButtons.forEach(button => {
                const btnElement = document.getElementById(button.id);
                if (btnElement) {
                    // Створюємо копію елемента для видалення всіх обробників
                    const newBtnElement = btnElement.cloneNode(true);
                    if (btnElement.parentNode) {
                        btnElement.parentNode.replaceChild(newBtnElement, btnElement);
                    }

                    newBtnElement.addEventListener('click', function() {
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
                    // Створюємо копію елемента для видалення всіх обробників
                    const newBtnElement = btnElement.cloneNode(true);
                    if (btnElement.parentNode) {
                        btnElement.parentNode.replaceChild(newBtnElement, btnElement);
                    }

                    newBtnElement.addEventListener('click', async function() {
                        try {
                            // Перевіряємо, чи завдання вже виконано
                            if (localStorage.getItem(`${button.platform}_task_completed`) === 'true') {
                                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                    window.WinixCore.UI.showNotification('Це завдання вже виконано!', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.INFO : 'info');
                                } else {
                                    alert('Це завдання вже виконано!');
                                }
                                return;
                            }

                            // Перевіряємо, чи користувач клікнув на кнопку підписки
                            if (localStorage.getItem(`${button.platform}_link_clicked`) !== 'true') {
                                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                    window.WinixCore.UI.showNotification('Спочатку натисніть кнопку "Підписатись"!', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.WARNING : 'warning');
                                } else {
                                    alert('Спочатку натисніть кнопку "Підписатись"!');
                                }
                                return;
                            }

                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification('Перевірка підписки...', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.INFO : 'info');
                            } else {
                                alert('Перевірка підписки...');
                            }

                            // ДОДАНО: Спочатку оновлюємо ID через getUserData
                            if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                                window.WinixAuth.getUserData()
                                    .then(() => {
                                        verifySubscription();
                                    })
                                    .catch(error => {
                                        console.warn("⚠️ Помилка оновлення даних користувача:", error);
                                        verifySubscription();
                                    });
                            } else {
                                verifySubscription();
                            }
                        } catch (e) {
                            console.error("❌ Помилка при верифікації підписки:", e);
                        }
                    });
                }
            });
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників для кнопок заробітку:", e);
        }
    }

    // Функція перевірки підписки
    function verifySubscription(button) {
        try {
            // Імітуємо перевірку підписки
            setTimeout(() => {
                const randomSuccess = Math.random() > 0.3; // 70% шанс успіху

                if (randomSuccess) {
                    if (window.WinixAPI && typeof window.WinixAPI.addTokens === 'function') {
                        // Перевіряємо ID
                        const userId = localStorage.getItem('telegram_user_id');
                        if (!isValidId(userId)) {
                            console.warn('⚠️ Не вдалося нарахувати винагороду: невалідний ID користувача');

                            // Намагаємося використати getUserId для отримання валідного ID
                            if (typeof window.WinixAPI.getUserId === 'function') {
                                const validId = window.WinixAPI.getUserId();
                                if (!validId) {
                                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                        window.WinixCore.UI.showNotification(
                                            "Не вдалося нарахувати винагороду. Спробуйте перезавантажити сторінку.",
                                            window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                                        );
                                    } else {
                                        alert("Не вдалося нарахувати винагороду. Спробуйте перезавантажити сторінку.");
                                    }
                                    return;
                                }
                            }
                        }

                        window.WinixAPI.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`)
                            .then(data => {
                                if (data.status === 'success') {
                                    // Обробляємо успішне нарахування
                                    handleSuccessfulVerification(button);
                                } else {
                                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                        window.WinixCore.UI.showNotification('Помилка нарахування винагороди. Спробуйте ще раз.', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                                    } else {
                                        alert('Помилка нарахування винагороди. Спробуйте ще раз.');
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('Помилка нарахування винагороди:', error);
                                if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                    window.WinixCore.UI.showNotification('Помилка нарахування винагороди. Спробуйте ще раз.', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                                } else {
                                    alert('Помилка нарахування винагороди. Спробуйте ще раз.');
                                }
                            });
                    } else if (window.WinixCore && window.WinixCore.Balance && typeof window.WinixCore.Balance.addTokens === 'function') {
                        // Запасний варіант
                        window.WinixCore.Balance.addTokens(button.reward, `Винагорода за підписку на ${button.platform}`);
                        handleSuccessfulVerification(button);
                    } else {
                        // Симуляція
                        handleSuccessfulVerification(button);
                    }
                } else {
                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                        window.WinixCore.UI.showNotification('Підписку не знайдено. Спробуйте ще раз.', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                    } else {
                        alert('Підписку не знайдено. Спробуйте ще раз.');
                    }
                }
            }, 1500);
        } catch (e) {
            console.error("❌ Помилка при перевірці підписки:", e);
        }
    }

    // Обробка успішної верифікації
    function handleSuccessfulVerification(button) {
        try {
            // Позначаємо завдання як виконане
            localStorage.setItem(`${button.platform}_task_completed`, 'true');

            // Оновлюємо стилі
            const btnElement = document.getElementById(`${button.id}`);
            const taskItem = btnElement ? btnElement.closest('.task-item') : null;
            if (taskItem) {
                taskItem.classList.add('completed-task');
            }

            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                window.WinixCore.UI.showNotification(`Вітаємо! Отримано ${button.reward} $WINIX`, window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.SUCCESS : 'success');
            } else {
                alert(`Вітаємо! Отримано ${button.reward} $WINIX`);
            }
        } catch (e) {
            console.error("❌ Помилка при обробці успішної верифікації:", e);
        }
    }

    // Встановлення обробників для кнопок на сторінці рефералів
    function setupReferralButtons() {
        try {
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
                    // Створюємо копію елемента для видалення всіх обробників
                    const newButton = button.cloneNode(true);
                    if (button.parentNode) {
                        button.parentNode.replaceChild(newButton, button);
                    }

                    newButton.addEventListener('click', function() {
                        try {
                            // ДОДАНО: Спочатку оновлюємо ID через getUserData
                            if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                                window.WinixAuth.getUserData()
                                    .then(() => {
                                        copyReferralLink();
                                    })
                                    .catch(error => {
                                        console.warn("⚠️ Помилка оновлення даних користувача:", error);
                                        copyReferralLink();
                                    });
                            } else {
                                copyReferralLink();
                            }
                        } catch (e) {
                            console.error("❌ Помилка при копіюванні реферального посилання:", e);
                        }
                    });
                }
            });
        } catch (e) {
            console.warn("⚠️ Помилка при встановленні обробників для кнопок рефералів:", e);
        }
    }

    // Функція для копіювання реферального посилання
    function copyReferralLink() {
        try {
            // Використовуємо API модуль для отримання реферального посилання
            if (window.WinixAPI && typeof window.WinixAPI.getReferralLink === 'function') {
                // Перевіряємо ID
                const userId = localStorage.getItem('telegram_user_id');
                if (!isValidId(userId)) {
                    console.warn('⚠️ Не вдалося отримати реферальне посилання: невалідний ID користувача');

                    // Намагаємося використати getUserId для отримання валідного ID
                    if (typeof window.WinixAPI.getUserId === 'function') {
                        const validId = window.WinixAPI.getUserId();
                        if (!validId) {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification(
                                    "Не вдалося отримати реферальне посилання. Спробуйте перезавантажити сторінку.",
                                    window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error'
                                );
                            } else {
                                alert("Не вдалося отримати реферальне посилання. Спробуйте перезавантажити сторінку.");
                            }
                            return;
                        }
                    }
                }

                window.WinixAPI.getReferralLink()
                    .then(data => {
                        let referralLink = '';
                        if (data.status === 'success' && data.data && data.data.referral_link) {
                            referralLink = data.data.referral_link;
                        } else {
                            // Запасний варіант
                            if (typeof window.WinixAPI.getUserId === 'function') {
                                const validId = window.WinixAPI.getUserId();
                                referralLink = validId ? window.location.origin + '?ref=' + validId : '';
                            }
                        }

                        if (referralLink) {
                            // Копіюємо посилання в буфер обміну
                            navigator.clipboard.writeText(referralLink)
                                .then(() => {
                                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                        window.WinixCore.UI.showNotification('Реферальне посилання скопійовано!', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.SUCCESS : 'success');
                                    } else {
                                        alert('Реферальне посилання скопійовано!');
                                    }
                                })
                                .catch(() => {
                                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                        window.WinixCore.UI.showNotification('Помилка копіювання посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                                    } else {
                                        alert('Помилка копіювання посилання');
                                    }
                                });
                        } else {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification('Не вдалося отримати реферальне посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                            } else {
                                alert('Не вдалося отримати реферальне посилання');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Помилка отримання реферального посилання:', error);
                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                            window.WinixCore.UI.showNotification('Помилка отримання реферального посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                        } else {
                            alert('Помилка отримання реферального посилання');
                        }
                    });
            } else if (window.WinixCore && window.WinixCore.Referrals && typeof window.WinixCore.Referrals.getReferralLink === 'function') {
                // Запасний варіант
                const referralLink = window.WinixCore.Referrals.getReferralLink();

                if (referralLink) {
                    // Копіюємо посилання в буфер обміну
                    navigator.clipboard.writeText(referralLink)
                        .then(() => {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification('Реферальне посилання скопійовано!', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.SUCCESS : 'success');
                            } else {
                                alert('Реферальне посилання скопійовано!');
                            }
                        })
                        .catch(() => {
                            if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                                window.WinixCore.UI.showNotification('Помилка копіювання посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                            } else {
                                alert('Помилка копіювання посилання');
                            }
                        });
                } else {
                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                        window.WinixCore.UI.showNotification('Не вдалося отримати реферальне посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                    } else {
                        alert('Не вдалося отримати реферальне посилання');
                    }
                }
            } else {
                // Симуляція
                const userId = localStorage.getItem('telegram_user_id') || '123456';
                const referralLink = window.location.origin + '?ref=' + userId;

                navigator.clipboard.writeText(referralLink)
                    .then(() => {
                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                            window.WinixCore.UI.showNotification('Реферальне посилання скопійовано!', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.SUCCESS : 'success');
                        } else {
                            alert('Реферальне посилання скопійовано!');
                        }
                    })
                    .catch(() => {
                        if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.showNotification === 'function') {
                            window.WinixCore.UI.showNotification('Помилка копіювання посилання', window.WinixCore.MESSAGE_TYPES ? window.WinixCore.MESSAGE_TYPES.ERROR : 'error');
                        } else {
                            alert('Помилка копіювання посилання');
                        }
                    });
            }
        } catch (e) {
            console.error("❌ Помилка при копіюванні реферального посилання:", e);
        }
    }

    // Періодична синхронізація даних
    function setupPeriodicSync() {
        // Синхронізуємо дані кожні 30 секунд
        const syncInterval = setInterval(async () => {
            try {
                // ДОДАНО: Пріоритетна синхронізація через getUserData
                if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
                    window.WinixAuth.getUserData()
                        .then(() => {
                            console.log("✅ Періодичне оновлення даних користувача");
                        })
                        .catch(err => {
                            console.warn("⚠️ Помилка періодичного оновлення даних:", err);
                            syncFallback();
                        });
                } else {
                    syncFallback();
                }

                // Резервний метод синхронізації
                function syncFallback() {
                    if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                        // Перевіряємо валідність ID
                        const userId = localStorage.getItem('telegram_user_id');
                        if (!isValidId(userId)) {
                            console.warn("⚠️ Синхронізацію відкладено: невалідний ID користувача");

                            // Спробуємо отримати валідний ID через покращену функцію
                            if (typeof window.WinixAPI.getUserId === 'function') {
                                const validId = window.WinixAPI.getUserId();
                                if (!validId) {
                                    return; // Пропускаємо синхронізацію цього разу
                                }
                            } else {
                                return; // Пропускаємо синхронізацію цього разу
                            }
                        }

                        // Оновлюємо дані користувача
                        window.WinixAPI.getUserData()
                            .then(data => {
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
                                    if (window.WinixCore && window.WinixCore.UI && typeof window.WinixCore.UI.updateBalanceDisplay === 'function') {
                                        window.WinixCore.UI.updateBalanceDisplay();
                                    }
                                }
                            })
                            .catch(error => {
                                console.error("Помилка синхронізації даних:", error);
                            });
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

    // Експортуємо глобальні функції для використання іншими модулями
    window.navigateTo = function(section) {
        saveBalanceBeforeNavigation();

        // Переходимо на сторінку
        if (section === 'home') {
            window.location.href = 'original-index.html';
        } else {
            window.location.href = section + '.html';
        }
    };

    window.goBack = function() {
        saveBalanceBeforeNavigation();
        window.history.back();
    };

    // Запускаємо ініціалізацію при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Перевіряємо, чи вже відбулася повна ініціалізація
        if (window.WinixConnectorInitialized) {
            console.log('✅ WINIX Connector вже повністю ініціалізований');
            return;
        }

        // ЗМІНЕНО: Спочатку ініціалізуємо Telegram WebApp
        initTelegramWebApp();

        // ЗМІНЕНО: Спочатку перевіряємо ID в localStorage
        const userId = localStorage.getItem('telegram_user_id');
        if (userId && !isValidId(userId)) {
            console.warn("⚠️ CONNECTOR: Видалення невалідного ID з localStorage:", userId);
            localStorage.removeItem('telegram_user_id');
        }

        // ДОДАНО: Спочатку оновлюємо дані через getUserData
        if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
            window.WinixAuth.getUserData()
                .then(() => {
                    console.log("✅ Дані користувача оновлено при завантаженні DOM");
                    initPage();
                })
                .catch(error => {
                    console.warn("⚠️ Помилка оновлення даних користувача:", error);
                    initPage();
                });
        } else {
            initPage();
        }

        // Налаштовуємо періодичну синхронізацію
        setupPeriodicSync();
    });

    // Виконуємо дії після повного завантаження сторінки
    window.addEventListener('load', function() {
        // ДОДАНО: Оновлюємо дані через getUserData після повного завантаження
        if (window.WinixAuth && typeof window.WinixAuth.getUserData === 'function') {
            window.WinixAuth.getUserData()
                .then(() => {
                    console.log("✅ Дані користувача оновлено після повного завантаження");
                })
                .catch(error => {
                    console.warn("⚠️ Помилка оновлення даних користувача:", error);
                });
        }

        // Оновлюємо відображення балансу після повного завантаження
        if (window.WinixCore && window.WinixCore.UI) {
            if (typeof window.WinixCore.UI.updateBalanceDisplay === 'function') {
                window.WinixCore.UI.updateBalanceDisplay();
            }

            if (typeof window.WinixCore.UI.updateStakingDisplay === 'function') {
                window.WinixCore.UI.updateStakingDisplay();
            }
        }
    });

    // Якщо DOM вже готовий, ініціалізуємо сторінку зараз
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        // Перевіряємо, чи вже відбулася повна ініціалізація
        if (window.WinixConnectorInitialized) {
            console.log('✅ WINIX Connector вже повністю ініціалізований');
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