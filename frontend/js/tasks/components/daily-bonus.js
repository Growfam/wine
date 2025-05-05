/**
 * WINIX - Щоденний бонус (30-денний цикл)
 * Версія: 2.1.0
 *
 * Модуль для управління щоденними бонусами в системі WINIX
 * Забезпечує 30-денний цикл бонусів з прогресивною системою винагород та жетонами
 *
 * ВИПРАВЛЕННЯ:
 * - Покращена стабільність відображення кнопки бонусу
 * - Оптимізована взаємодія з TaskManager
 * - Додана система самовідновлення при помилках
 * - Виправлена проблема з видимістю в різних вкладках
 */

window.DailyBonus = (function() {
    // Конфігурація модуля
    const config = {
        cacheDuration: 300000,      // 5 хвилин кеш
        debug: false,               // Режим відлагодження
        apiTimeout: 10000,          // 10 секунд таймаут для запитів
        maxRetries: 1,              // Максимальна кількість повторних спроб
        retryDelay: 1000,           // Затримка між повторними спробами (мс)
        cycleDays: 30,              // Загальна кількість днів у циклі
        visibleDays: 7,             // Кількість днів, що відображаються у вікні
        defaultRewards: [           // Винагороди по днях, для випадку, якщо API не повертає повну таблицю
            35, 45, 55, 65, 75, 85, 100, 115, 130, 145,
            165, 185, 205, 230, 255, 285, 315, 345, 375, 405,
            445, 485, 525, 570, 615, 665, 715, 800, 950, 1200
        ],
        tokenDays: {                // Дні з жетонами (номер дня: кількість)
            3: 1, 7: 1, 10: 1, 14: 2, 17: 1, 21: 3, 24: 2, 28: 3, 30: 3
        },
        useDirectDomUpdates: true,  // Використовувати прямі оновлення DOM для балансу
        animationDebounce: 100,     // Мінімальний інтервал між анімаціями (мс)
        cleanupModals: true,        // Очищати модальні вікна при закритті для звільнення пам'яті
        buttonRestoreInterval: 3000, // Інтервал перевірки і відновлення кнопки (мс)
        tabCoordination: true       // Координація з TaskManager для роботи з вкладками
    };

    // Стан модуля
    const state = {
        isInitialized: false,
        bonusData: null,
        lastLoaded: 0,
        isLoading: false,
        userId: null,
        pendingOperation: false,        // Прапорець очікування результату операції
        lastError: null,                // Останнє повідомлення про помилку
        containerElement: null,         // Кешований DOM-елемент контейнера
        claimButtonElement: null,       // Кешований DOM-елемент кнопки
        progressContainerElement: null, // Кешований DOM-елемент для прогресу
        infoButtonElement: null,        // Кнопка інформації
        infoModalElement: null,         // Модальне вікно з інформацією
        lastAnimationTime: 0,           // Час останньої анімації для дебаунсингу
        isModalVisible: false,          // Прапорець видимості модального вікна
        taskManagerReady: false,        // Прапорець готовності TaskManager
        buttonRestoreTimeout: null,     // Таймер для відновлення кнопки
        restorationAttempts: 0,         // Лічильник спроб відновлення кнопки
        lastButtonCheck: 0,             // Час останньої перевірки кнопки
        originalButtonHTML: null,       // Збережений оригінальний HTML кнопки
        lastBalanceUpdate: {            // Останнє оновлення балансу
            tokens: null,
            coins: null,
            timestamp: 0
        }
    };

    // Шляхи API
    const API_PATHS = {
        STATUS: (userId) => `api/user/${userId}/daily-bonus`,
        CLAIM: (userId) => `api/user/${userId}/claim-daily-bonus`
    };

    /**
     * Спрощена функція для отримання ID користувача
     * Зосереджена на найбільш надійних джерелах
     */
    function getUserId() {
        // Перевіряємо, чи ID вже кешовано
        if (state.userId) {
            return state.userId;
        }

        // Спрощений список джерел для отримання ID
        const sources = [
            // 1. Глобальна змінна USER_ID
            () => window.USER_ID,

            // 2. Telegram WebApp
            () => {
                if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                    return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                }
                return null;
            },

            // 3. User data з localStorage
            () => {
                try {
                    const userData = localStorage.getItem('user_data');
                    if (userData) {
                        const parsed = JSON.parse(userData);
                        if (parsed?.telegram_id) {
                            return parsed.telegram_id.toString();
                        }
                    }
                    return localStorage.getItem('telegram_user_id');
                } catch (e) {
                    return null;
                }
            },

            // 4. DOM-елемент user-id
            () => document.getElementById('user-id')?.textContent?.trim(),

            // 5. URL-параметри
            () => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            },

            // 6. Спробуємо отримати через TaskManager, якщо він доступний
            () => {
                if (window.TaskManager && typeof window.TaskManager.safeGetUserId === 'function') {
                    return window.TaskManager.safeGetUserId();
                }
                return null;
            }
        ];

        // Перебираємо всі джерела, поки не знайдемо ID
        for (const getIdFunc of sources) {
            try {
                const id = getIdFunc();
                if (id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.length > 3) {
                    // Кешуємо ID для майбутніх викликів
                    state.userId = id;

                    // Зберігаємо в localStorage для інших модулів
                    try {
                        localStorage.setItem('telegram_user_id', id);
                    } catch (e) {}

                    return id;
                }
            } catch (e) {}
        }

        if (config.debug) {
            console.warn("DailyBonus: ID користувача не знайдено в жодному джерелі");
        }

        return null;
    }

    /**
     * Ініціалізація модуля щоденних бонусів
     */
    function init() {
        if (state.isInitialized) return;

        console.log("DailyBonus: Початок ініціалізації модуля");

        // ВИПРАВЛЕННЯ 5: Повідомляємо TaskManager про ініціалізацію
        document.dispatchEvent(new CustomEvent('daily-bonus-loaded'));

        // Перевіряємо готовність TaskManager
        checkTaskManagerReady();

        // Кешування DOM-елементів для швидшого доступу
        state.containerElement = document.getElementById('daily-bonus-container');
        state.claimButtonElement = document.getElementById('claim-daily');
        state.progressContainerElement = document.getElementById('daily-progress-container');

        // Якщо елементи не знайдено, спробуємо почекати їх появи
        if (!state.containerElement || !state.progressContainerElement) {
            console.warn("DailyBonus: Не знайдено контейнери для щоденних бонусів, чекаємо 500мс");

            // Чекаємо поки DOM-елементи з'являться
            setTimeout(init, 500);
            return;
        }

        // Якщо не знайдено кнопку бонусу, але є контейнер, створюємо її
        if (!state.claimButtonElement && state.containerElement) {
            console.log("DailyBonus: Не знайдено кнопку бонусу, створюємо...");
            createClaimButton();
        }

        console.log("DailyBonus: DOM-елементи знайдено");

        // Збереження оригінального HTML кнопки для можливого відновлення
        if (state.claimButtonElement) {
            state.originalButtonHTML = state.claimButtonElement.outerHTML;
        }

        // Додаємо інформаційну кнопку, якщо її ще немає
        if (!document.getElementById('daily-bonus-info')) {
            createInfoButton();
        }

        // Перевірка наявності ID користувача
        const userId = getUserId();
        if (!userId) {
            console.warn("DailyBonus: Не вдалося отримати ID користувача. Система бонусів недоступна.");

            // Показуємо повідомлення про необхідність авторизації
            state.containerElement.innerHTML = `
                <div class="category-title">Щоденний бонус</div>
                <div class="auth-required-message">
                    <p>Для отримання щоденних бонусів необхідно авторизуватися</p>
                    <button class="auth-button">Увійти</button>
                </div>
            `;

            // Додаємо обробник для кнопки авторизації
            const authButton = state.containerElement.querySelector('.auth-button');
            if (authButton) {
                authButton.addEventListener('click', function() {
                    if (window.auth && typeof window.auth.login === 'function') {
                        window.auth.login();
                    } else if (typeof loginWithTelegram === 'function') {
                        loginWithTelegram();
                    } else {
                        window.location.href = '/login';
                    }
                });
            }

            return;
        }

        console.log(`DailyBonus: ID користувача отримано: ${userId}`);

        // Спробуємо завантажити дані з localStorage для швидкої ініціалізації
        try {
            const cachedData = localStorage.getItem('daily_bonus_data');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.timestamp && parsed.userId === userId) {
                    // Перевіряємо чи дані не застаріли
                    const age = Date.now() - parsed.timestamp;
                    if (age < config.cacheDuration) {
                        state.bonusData = parsed.data;
                        state.lastLoaded = parsed.timestamp;

                        // Відразу оновлюємо інтерфейс
                        console.log("DailyBonus: Дані завантажені з кешу");
                        renderBonusUI();
                    }
                }
            }
        } catch (e) {
            console.warn("DailyBonus: Помилка завантаження даних з кешу:", e);
        }

        // Додаємо обробник подій для кнопки отримання бонусу
        setupClaimButtonHandler();

        // Додаємо обробник для закриття модального вікна при натисканні Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && state.isModalVisible) {
                hideInfoModal();
            }
        });

        // ВИПРАВЛЕННЯ 5: Додаємо обробник для координації з TaskManager
        if (config.tabCoordination) {
            setupTaskManagerCoordination();
        }

        // ВИПРАВЛЕННЯ 5: Додаємо обробник для відновлення кнопки
        setupButtonRestoration();

        // Оновлюємо стан ініціалізації
        state.isInitialized = true;
        console.log("DailyBonus: Модуль ініціалізовано");

        // Асинхронно завантажуємо дані з серверу
        loadBonusData(true);

        // Надсилаємо подію про готовність модуля
        document.dispatchEvent(new CustomEvent('daily-bonus-initialized'));
    }

    /**
     * ВИПРАВЛЕННЯ 5: Перевірка готовності TaskManager
     */
    function checkTaskManagerReady() {
        // Спробуємо дізнатися, чи TaskManager вже ініціалізовано
        if (window.TaskManager && window.TaskManager.initialized) {
            state.taskManagerReady = true;
            console.log("DailyBonus: TaskManager вже ініціалізовано");
            return true;
        }

        // Відправляємо запит на перевірку статусу
        document.dispatchEvent(new CustomEvent('daily-bonus-taskmanager-check'));

        // Слухаємо відповідь
        document.addEventListener('taskmanager-status', function(event) {
            if (event.detail && event.detail.initialized) {
                state.taskManagerReady = true;
                console.log("DailyBonus: Отримано підтвердження про готовність TaskManager");
            }
        }, { once: true });

        // Чекаємо на подію ініціалізації TaskManager
        document.addEventListener('taskmanager-initialized', function() {
            state.taskManagerReady = true;
            console.log("DailyBonus: Отримано подію ініціалізації TaskManager");
        }, { once: true });

        return state.taskManagerReady;
    }

    /**
     * ВИПРАВЛЕННЯ 5: Інформування TaskManager про готовність DailyBonus
     */
    function notifyTaskManagerReady(ready = true) {
        console.log(`DailyBonus: ${ready ? 'Повідомляємо' : 'Відміняємо повідомлення'} TaskManager про готовність`);

        // Відправляємо подію про готовність DailyBonus
        if (ready) {
            document.dispatchEvent(new CustomEvent('daily-bonus-ready', {
                detail: { initialized: state.isInitialized }
            }));
        }
    }

    /**
     * ВИПРАВЛЕННЯ 5: Створення обробника для кнопки бонусу
     */
    function setupClaimButtonHandler() {
        if (!state.claimButtonElement) {
            console.warn("DailyBonus: Не знайдено кнопку бонусу для налаштування обробника");
            return;
        }

        // Видаляємо старі обробники, щоб уникнути дублювання
        const newClaimButton = state.claimButtonElement.cloneNode(true);
        if (state.claimButtonElement.parentNode) {
            state.claimButtonElement.parentNode.replaceChild(newClaimButton, state.claimButtonElement);
        }
        state.claimButtonElement = newClaimButton;

        // Додаємо новий обробник
        state.claimButtonElement.addEventListener('click', handleClaimButtonClick);

        // ВИПРАВЛЕННЯ 5: Додаємо спеціальний атрибут для захисту від автоматичного видалення
        state.claimButtonElement.setAttribute('data-protected', 'true');
        state.claimButtonElement.setAttribute('data-role', 'claim-daily-bonus');

        console.log("DailyBonus: Додано обробник кнопки отримання бонусу");
    }

    /**
     * ВИПРАВЛЕННЯ 5: Налаштування системи відновлення кнопки
     */
    function setupButtonRestoration() {
        // Зупиняємо попередній таймер, якщо він є
        if (state.buttonRestoreTimeout) {
            clearInterval(state.buttonRestoreTimeout);
        }

        // Запускаємо новий таймер для регулярної перевірки кнопки
        state.buttonRestoreTimeout = setInterval(checkAndRestoreButton, config.buttonRestoreInterval);

        // Підписуємось на події відновлення кнопки
        document.addEventListener('daily-bonus-button-restored', function() {
            console.log("DailyBonus: Отримано подію відновлення кнопки");

            // Оновлюємо посилання на кнопку
            state.claimButtonElement = document.getElementById('claim-daily');

            // Налаштовуємо обробник подій для відновленої кнопки
            if (state.claimButtonElement) {
                setupClaimButtonHandler();
            }
        });
    }

    /**
     * ВИПРАВЛЕННЯ 5: Перевірка та відновлення кнопки бонусу
     */
    function checkAndRestoreButton() {
        // Пропускаємо перевірку, якщо недавно вже перевіряли
        const now = Date.now();
        if (now - state.lastButtonCheck < 1000) {
            return;
        }

        state.lastButtonCheck = now;

        // Перевіряємо наявність кнопки в DOM
        const buttonExists = !!document.getElementById('claim-daily');

        // Якщо кнопка відсутня і у нас є контейнер, відновлюємо її
        if (!buttonExists && state.containerElement) {
            console.log("DailyBonus: Виявлено відсутність кнопки бонусу, відновлюємо...");

            // Шукаємо контейнер для кнопки
            const bonusContainer = state.containerElement.querySelector('.daily-bonus');

            if (bonusContainer) {
                if (state.originalButtonHTML) {
                    // Використовуємо збережений HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = state.originalButtonHTML;
                    const newButton = tempDiv.firstChild;

                    // Додаємо кнопку до контейнера
                    bonusContainer.appendChild(newButton);

                    // Оновлюємо посилання
                    state.claimButtonElement = newButton;

                    // Налаштовуємо обробник подій
                    setupClaimButtonHandler();

                    console.log("DailyBonus: Кнопку бонусу успішно відновлено");

                    // Скидаємо лічильник спроб
                    state.restorationAttempts = 0;
                } else {
                    // Створюємо нову кнопку, якщо немає збереженого HTML
                    createClaimButton();
                }
            } else {
                console.warn("DailyBonus: Не знайдено контейнер для кнопки бонусу");

                // Спроба знайти будь-який підходящий контейнер
                const possibleContainers = [
                    state.containerElement,
                    document.querySelector('.daily-bonus'),
                    document.querySelector('#daily-bonus-container')
                ];

                for (const container of possibleContainers) {
                    if (container) {
                        console.log("DailyBonus: Знайдено альтернативний контейнер, спроба відновлення кнопки");

                        // Створюємо нову кнопку
                        const newButton = document.createElement('button');
                        newButton.id = 'claim-daily';
                        newButton.className = 'claim-button';
                        newButton.setAttribute('data-lang-key', 'earn.get');
                        newButton.textContent = 'Отримати бонус';

                        // Додаємо кнопку до контейнера
                        container.appendChild(newButton);

                        // Оновлюємо посилання
                        state.claimButtonElement = newButton;

                        // Налаштовуємо обробник подій
                        setupClaimButtonHandler();

                        // Зберігаємо HTML для майбутнього відновлення
                        state.originalButtonHTML = newButton.outerHTML;

                        console.log("DailyBonus: Створено нову кнопку бонусу");
                        break;
                    }
                }
            }

            // Збільшуємо лічильник спроб
            state.restorationAttempts++;

            // Якщо зроблено багато невдалих спроб, сповільнюємо перевірку
            if (state.restorationAttempts > 5) {
                console.warn("DailyBonus: Багато невдалих спроб відновлення кнопки, збільшуємо інтервал перевірки");

                // Змінюємо інтервал перевірки
                clearInterval(state.buttonRestoreTimeout);
                state.buttonRestoreTimeout = setInterval(checkAndRestoreButton, config.buttonRestoreInterval * 2);
            }
        } else if (buttonExists) {
            // Кнопка існує, просто оновлюємо посилання, якщо потрібно
            if (!state.claimButtonElement) {
                state.claimButtonElement = document.getElementById('claim-daily');
                setupClaimButtonHandler();
            }

            // Скидаємо лічильник спроб
            state.restorationAttempts = 0;
        }
    }

    /**
     * ВИПРАВЛЕННЯ 5: Створення кнопки отримання бонусу
     */
    function createClaimButton() {
        // Перевіряємо, чи є контейнер для кнопки
        const bonusContainer = state.containerElement ?
                             state.containerElement.querySelector('.daily-bonus') :
                             document.querySelector('.daily-bonus');

        if (!bonusContainer) {
            console.warn("DailyBonus: Не знайдено контейнер для кнопки бонусу");
            return null;
        }

        // Створюємо нову кнопку
        const newButton = document.createElement('button');
        newButton.id = 'claim-daily';
        newButton.className = 'claim-button';
        newButton.setAttribute('data-lang-key', 'earn.get');
        newButton.setAttribute('data-protected', 'true');
        newButton.setAttribute('data-role', 'claim-daily-bonus');
        newButton.textContent = 'Отримати бонус';

        // Додаємо стилі для гарантованої видимості
        newButton.style.display = 'block';
        newButton.style.visibility = 'visible';
        newButton.style.opacity = '1';

        // Додаємо кнопку до контейнера
        bonusContainer.appendChild(newButton);

        // Оновлюємо посилання
        state.claimButtonElement = newButton;

        // Налаштовуємо обробник подій
        setupClaimButtonHandler();

        // Зберігаємо HTML для майбутнього відновлення
        state.originalButtonHTML = newButton.outerHTML;

        console.log("DailyBonus: Створено нову кнопку бонусу");
        return newButton;
    }

    /**
     * ВИПРАВЛЕННЯ 5: Налаштування координації з TaskManager
     */
    function setupTaskManagerCoordination() {
        // Підписуємось на події від TaskManager
        document.addEventListener('safe-buttons-list', function(event) {
            if (event.detail && event.detail.buttonIds &&
                event.detail.buttonIds.includes('claim-daily') &&
                state.claimButtonElement) {

                console.log("DailyBonus: Отримано список захищених кнопок від TaskManager");

                // Додатково захищаємо нашу кнопку
                state.claimButtonElement.style.display = 'block';
                state.claimButtonElement.style.visibility = 'visible';
                state.claimButtonElement.style.opacity = '1';
                state.claimButtonElement.setAttribute('data-protected', 'true');
            }
        });

        // Підписуємось на події зміни вкладок
        document.addEventListener('tab-switched', function(event) {
            if (event.detail && event.detail.tabType === 'social') {
                console.log("DailyBonus: Перемикання на вкладку social");

                // Перевіряємо видимість кнопки після переходу на вкладку social
                setTimeout(checkAndRestoreButton, 300);
            }
        });

        // Відправляємо запит на статус TaskManager
        if (state.claimButtonElement) {
            // Повідомляємо TaskManager про нашу кнопку
            document.dispatchEvent(new CustomEvent('register-protected-button', {
                detail: {
                    buttonId: 'claim-daily',
                    selector: '#claim-daily, .claim-button',
                    role: 'claim-daily-bonus'
                }
            }));
        }
    }

    /**
     * Створення кнопки інформації (і) та модального вікна
     */
    function createInfoButton() {
        console.log("DailyBonus: Створення кнопки інформації");
        // Створюємо кнопку інформації, якщо вона ще не існує
        if (state.containerElement && !document.getElementById('daily-bonus-info')) {
            // Знаходимо елемент заголовку
            const titleElement = state.containerElement.querySelector('.category-title');

            if (titleElement) {
                // Створюємо обгортку для заголовку та кнопки
                const titleWrapper = document.createElement('div');
                titleWrapper.className = 'title-wrapper';

                // Отримуємо поточний текст заголовку
                const titleText = titleElement.textContent || 'Щоденний бонус';

                // Створюємо новий заголовок
                const newTitle = document.createElement('div');
                newTitle.className = 'category-title';
                newTitle.textContent = titleText;

                // Створюємо кнопку інформації з виправленим стилем
                const infoButton = document.createElement('button');
                infoButton.id = 'daily-bonus-info';
                infoButton.className = 'info-button';
                infoButton.textContent = 'і';
                infoButton.setAttribute('aria-label', 'Інформація про щоденний бонус');

                // Додаємо елементи до обгортки
                titleWrapper.appendChild(newTitle);
                titleWrapper.appendChild(infoButton);

                // Замінюємо оригінальний заголовок на обгортку
                titleElement.parentNode.replaceChild(titleWrapper, titleElement);

                // Зберігаємо посилання на кнопку інформації
                state.infoButtonElement = infoButton;

                // Додаємо обробник подій для кнопки інформації
                infoButton.addEventListener('click', showInfoModal);
                console.log("DailyBonus: Кнопка інформації створена");
            }

            // Створюємо модальне вікно для відображення інформації
            if (!document.getElementById('daily-bonus-modal')) {
                const modal = document.createElement('div');
                modal.id = 'daily-bonus-modal';
                modal.className = 'daily-bonus-modal';
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-labelledby', 'modal-title');
                modal.setAttribute('aria-modal', 'true');

                // Створюємо контент модального вікна
                const modalContent = document.createElement('div');
                modalContent.className = 'daily-bonus-modal-content';

                // Створюємо кнопку закриття
                const closeButton = document.createElement('button');
                closeButton.className = 'daily-bonus-modal-close';
                closeButton.innerHTML = '&times;';
                closeButton.setAttribute('aria-label', 'Закрити');

                // Додаємо обробник для закриття модального вікна
                closeButton.addEventListener('click', hideInfoModal);

                // Створюємо заголовок модального вікна
                const modalTitle = document.createElement('h3');
                modalTitle.id = 'modal-title';
                modalTitle.textContent = 'Календар щоденних бонусів';

                // Створюємо контейнер для вмісту
                const modalBodyContent = document.createElement('div');
                modalBodyContent.id = 'daily-bonus-modal-content';
                modalBodyContent.className = 'daily-bonus-modal-body';

                // Додаємо елементи до модального вікна
                modalContent.appendChild(closeButton);
                modalContent.appendChild(modalTitle);
                modalContent.appendChild(modalBodyContent);
                modal.appendChild(modalContent);

                // Додаємо модальне вікно до body
                document.body.appendChild(modal);

                // Додаємо обробник для закриття по кліку поза модальним вікном
                modal.addEventListener('click', function(event) {
                    if (event.target === modal) {
                        hideInfoModal();
                    }
                });

                // Зберігаємо посилання на модальне вікно
                state.infoModalElement = modal;

                console.log("DailyBonus: Модальне вікно створено");
            }
        }
    }

    /**
     * Показати модальне вікно з інформацією про щоденні бонуси
     */
    function showInfoModal() {
        if (!state.infoModalElement) {
            console.warn("DailyBonus: Модальне вікно не знайдено");
            return;
        }

        // Оновлюємо вміст модального вікна перед показом
        updateInfoModalContent();

        // Показуємо модальне вікно з анімацією
        state.infoModalElement.style.display = 'block';
        state.isModalVisible = true;

        // Додаємо клас для анімації
        setTimeout(() => {
            state.infoModalElement.classList.add('visible');
        }, 10);

        // Блокуємо прокрутку основного контенту
        document.body.style.overflow = 'hidden';

        console.log("DailyBonus: Модальне вікно показано");
    }

    /**
     * Приховати модальне вікно
     */
    function hideInfoModal() {
        if (!state.infoModalElement || !state.isModalVisible) return;

        // Прибираємо клас для анімації
        state.infoModalElement.classList.remove('visible');

        // Чекаємо завершення анімації
        setTimeout(() => {
            state.infoModalElement.style.display = 'none';
            state.isModalVisible = false;

            // Розблоковуємо прокрутку основного контенту
            document.body.style.overflow = '';

            // Очищаємо вміст модального вікна для звільнення пам'яті
            if (config.cleanupModals) {
                const contentContainer = document.getElementById('daily-bonus-modal-content');
                if (contentContainer) {
                    contentContainer.innerHTML = '';
                }
            }
        }, 300);

        console.log("DailyBonus: Модальне вікно приховано");
    }

    /**
     * Оновлення вмісту модального вікна з інформацією про бонуси
     */
    function updateInfoModalContent() {
        // Отримуємо контейнер для вмісту
        const contentContainer = document.getElementById('daily-bonus-modal-content');
        if (!contentContainer) {
            console.warn("DailyBonus: Контейнер вмісту модального вікна не знайдено");
            return;
        }

        // Отримуємо дані про бонуси
        const bonusData = state.bonusData;

        // Генеруємо HTML для таблиці винагород
        let html = '<div class="modal-rewards-table">';

        // Створюємо сітку для відображення днів
        html += '<div class="rewards-grid">';

        // Отримуємо дані винагород
        let rewards = config.defaultRewards;
        let tokenRewards = config.tokenDays;
        let claimedDays = [];
        let currentDay = 1;

        // Якщо є дані з API, використовуємо їх
        if (bonusData) {
            // Використовуємо винагороди з API, якщо доступні
            if (bonusData.all_rewards && Array.isArray(bonusData.all_rewards)) {
                rewards = bonusData.all_rewards;
            }

            // Використовуємо інформацію про жетони з API, якщо доступна
            if (bonusData.token_rewards && typeof bonusData.token_rewards === 'object') {
                tokenRewards = bonusData.token_rewards;
            }

            // Отримуємо список виконаних днів
            if (bonusData.claimed_days && Array.isArray(bonusData.claimed_days)) {
                claimedDays = bonusData.claimed_days;
            }

            // Отримуємо поточний день циклу
            if (bonusData.current_day) {
                currentDay = bonusData.current_day;
            }
        }

        // Відображаємо дні
        for (let day = 1; day <= config.cycleDays; day++) {
            const isClaimed = claimedDays.includes(day);
            const isCurrent = day === currentDay;
            const hasToken = tokenRewards[day] > 0;
            const rewardAmount = rewards[day - 1] || day * 10;

            html += `
                <div class="reward-day ${isClaimed ? 'claimed' : ''} ${isCurrent ? 'current' : ''}">
                    <div class="day-number">День ${day}</div>
                    <div class="day-reward">${rewardAmount} $WINIX</div>
                    ${hasToken ? `<div class="token-badge">${tokenRewards[day]}</div>` : ''}
                </div>
            `;
        }

        html += '</div>'; // Закриваємо rewards-grid

        // Додаємо сумарну інформацію
        html += '<div class="summary-box">';
        html += '<div class="summary-title">Підсумок винагород</div>';

        // Рахуємо загальну суму винагород
        const totalReward = rewards.reduce((sum, reward) => sum + reward, 0);

        // Рахуємо загальну кількість жетонів
        let totalTokens = 0;
        for (const day in tokenRewards) {
            if (tokenRewards.hasOwnProperty(day)) {
                totalTokens += tokenRewards[day];
            }
        }

        html += `
            <div class="summary-item">
                <span>Загальна сума $WINIX:</span>
                <span>${totalReward.toLocaleString()}</span>
            </div>
            <div class="summary-item">
                <span>Загальна кількість жетонів:</span>
                <span>${totalTokens}</span>
            </div>
            <div class="summary-item">
                <span>Прогрес:</span>
                <span>${claimedDays.length}/${config.cycleDays} днів</span>
            </div>
        `;

        html += '</div>'; // Закриваємо summary-box

        // Додаємо інформацію про бонус за повне проходження
        html += `
            <div class="completion-bonus">
                <div class="completion-title">Бонус за повне проходження</div>
                <div class="summary-item">
                    <span>Додаткова винагорода:</span>
                    <span>3000 $WINIX</span>
                </div>
                <div class="summary-item">
                    <span>Додаткові жетони:</span>
                    <span>5 жетонів</span>
                </div>
                <div class="summary-item">
                    <span>Значок:</span>
                    <span>"Залізна дисципліна"</span>
                </div>
            </div>
        `;

        html += '</div>'; // Закриваємо modal-rewards-table

        // Оновлюємо вміст контейнера
        contentContainer.innerHTML = html;
        console.log("DailyBonus: Вміст модального вікна оновлено");
    }

    /**
     * Обробник натискання на кнопку отримання бонусу
     * @param {Event} event - Подія кліку
     */
    function handleClaimButtonClick(event) {
        // Зупиняємо стандартне опрацювання події
        event.preventDefault();

        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            if (typeof window.showToast === 'function') {
                window.showToast("Запит вже обробляється, зачекайте...", "info");
            }
            return;
        }

        // Візуальний зворотній зв'язок - зміна стану кнопки
        if (state.claimButtonElement) {
            state.claimButtonElement.classList.add('processing');
            state.claimButtonElement.disabled = true;
        }

        // Перевіряємо наявність даних бонусу
        if (!state.bonusData) {
            loadBonusData(true).then(() => {
                if (state.bonusData && state.bonusData.can_claim) {
                    claimDailyBonus();
                } else {
                    // Відновлюємо стан кнопки
                    restoreButtonState();
                }
            }).catch(error => {
                console.error("DailyBonus: Помилка при завантаженні даних:", error);
                if (typeof window.showToast === 'function') {
                    window.showToast("Помилка завантаження даних. Спробуйте пізніше.", "error");
                }
                // Відновлюємо стан кнопки
                restoreButtonState();
            });
            return;
        }

        // Перевіряємо можливість отримання бонусу
        if (!state.bonusData.can_claim) {
            if (typeof window.showToast === 'function') {
                window.showToast("Ви вже отримали бонус сьогодні", "info");
            }
            // Відновлюємо стан кнопки
            restoreButtonState();
            return;
        }

        // Запускаємо процес отримання бонусу
        claimDailyBonus().finally(() => {
            // Відновлюємо стан кнопки в будь-якому випадку
            restoreButtonState();
        });
    }

    /**
     * Відновлення стану кнопки після операції
     */
    function restoreButtonState() {
        if (state.claimButtonElement) {
            state.claimButtonElement.classList.remove('processing');
            state.claimButtonElement.disabled = false;
        } else {
            // Якщо посилання на кнопку втрачено, спробуємо знайти її в DOM
            const button = document.getElementById('claim-daily');
            if (button) {
                button.classList.remove('processing');
                button.disabled = false;

                // Оновлюємо посилання
                state.claimButtonElement = button;
            } else {
                // Якщо кнопку не знайдено, спробуємо відновити її
                checkAndRestoreButton();
            }
        }
    }

    /**
     * Формування повного URL API
     * @param {string} endpoint - Ендпоінт API
     * @returns {string} Повний URL API
     */
    function getApiUrl(endpoint) {
        // Спочатку перевіряємо налаштування в window.WinixAPI
        if (window.WinixAPI?.config?.baseUrl) {
            return `${window.WinixAPI.config.baseUrl}/${endpoint}`;
        }

        // Потім перевіряємо глобальний API_BASE_URL
        if (window.API_BASE_URL) {
            return `${window.API_BASE_URL}/${endpoint}`;
        }

        // Якщо немає налаштувань, використовуємо поточний домен
        return `${window.location.origin}/${endpoint}`;
    }

    /**
     * Виконання запиту до API з обробкою помилок
     * @param {string} endpoint - Шлях до API ендпоінту
     * @param {string} method - HTTP метод (GET, POST, тощо)
     * @param {Object} data - Дані для відправки
     * @returns {Promise<Object>} Результат запиту
     */
    async function fetchApi(endpoint, method = 'GET', data = null) {
        // Формуємо повний URL
        const url = getApiUrl(endpoint);

        console.log(`DailyBonus: Виконуємо запит ${method} до ${url}`, data);

        // Налаштування запиту
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        // Додаємо тіло запиту для методів POST/PUT
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        // Перевірка чи доступно Fetch API
        if (typeof fetch !== 'function') {
            throw new Error('Fetch API недоступне в цьому браузері');
        }

        try {
            // Створюємо AbortController для контролю таймауту
            const controller = new AbortController();
            options.signal = controller.signal;

            // Встановлюємо таймаут
            const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

            // Виконуємо запит
            const response = await fetch(url, options);

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Перевіряємо статус відповіді
            if (!response.ok) {
                // Спробуємо отримати деталі помилки з відповіді
                let errorMsg;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || `Помилка запиту: ${response.status} ${response.statusText}`;
                } catch {
                    errorMsg = `Помилка запиту: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }

            // Парсимо відповідь
            const responseData = await response.json();

            console.log("DailyBonus: Отримано відповідь:", responseData);

            // Перевіряємо відповідь на успіх
            if (responseData.status === 'success') {
                return responseData;
            } else {
                throw new Error(responseData.message || 'Невідома помилка API');
            }
        } catch (error) {
            // Спеціальна обробка помилки таймауту
            if (error.name === 'AbortError') {
                throw new Error('Перевищено час очікування відповіді від сервера');
            }

            // Якщо це виконується повторна спроба, генеруємо більш детальне повідомлення
            throw error;
        }
    }

    /**
     * Завантаження даних щоденного бонусу
     * @param {boolean} showLoader - Показувати індикатор завантаження
     * @returns {Promise<Object>} Дані щоденного бонусу
     */
    async function loadBonusData(showLoader = false) {
        // Запобігаємо одночасним запитам
        if (state.isLoading) return Promise.resolve(state.bonusData);

        // Перевіряємо, чи варто завантажувати свіжі дані
        const now = Date.now();
        const dataAge = now - state.lastLoaded;

        // Якщо дані свіжі (менше часу кешування), не робимо новий запит
        if (state.bonusData && dataAge < config.cacheDuration) {
            return Promise.resolve(state.bonusData);
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            const error = new Error("ID користувача не знайдено");
            state.lastError = error.message;
            return Promise.reject(error);
        }

        // Показуємо індикатор завантаження
        if (showLoader && typeof window.showLoading === 'function') {
            window.showLoading();
        }

        state.isLoading = true;
        console.log("DailyBonus: Починаємо завантаження даних бонусу");

        try {
            // Формуємо шлях API
            const endpoint = API_PATHS.STATUS(userId);

            // Виконуємо запит до API
            const response = await fetchApi(endpoint, 'GET');

            // Оновлюємо стан
            state.bonusData = response.data;
            state.lastLoaded = now;
            state.lastError = null;

            // Зберігаємо в localStorage
            try {
                localStorage.setItem('daily_bonus_data', JSON.stringify({
                    data: response.data,
                    timestamp: now,
                    userId: userId
                }));
            } catch (e) {
                console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
            }

            // Перевіряємо наявність необхідних полів
            if (!response.data.all_rewards) {
                console.warn("DailyBonus: У відповіді відсутній масив all_rewards, використовуємо значення за замовчуванням");
                // Використовуємо масив за замовчуванням
                state.bonusData.all_rewards = config.defaultRewards;
            }

            if (!response.data.token_rewards) {
                console.warn("DailyBonus: У відповіді відсутній об'єкт token_rewards, використовуємо значення за замовчуванням");
                // Використовуємо об'єкт за замовчуванням
                state.bonusData.token_rewards = config.tokenDays;
            }

            // Оновлюємо інтерфейс
            renderBonusUI();
            console.log("DailyBonus: Дані успішно завантажено");

            return response.data;
        } catch (error) {
            state.lastError = error.message;
            console.error("DailyBonus: Помилка завантаження даних:", error.message);

            // Створюємо резервну структуру даних у випадку помилки
            if (!state.bonusData) {
                state.bonusData = {
                    can_claim: false,
                    current_day: 1,
                    claimed_days: [],
                    streak_days: 0,
                    all_rewards: config.defaultRewards,
                    token_rewards: config.tokenDays,
                    cycle_days: config.cycleDays
                };
            }

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function' && showLoader) {
                window.showToast("Не вдалося завантажити дані щоденного бонусу. Спробуйте пізніше.", "error");
            }

            // Показуємо резервний інтерфейс у випадку помилки
            renderBackupUI();

            throw error;
        } finally {
            state.isLoading = false;

            // Приховуємо індикатор завантаження
            if (showLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    }

    /**
     * Відображення резервного інтерфейсу у випадку помилки
     */
    function renderBackupUI() {
        if (!state.progressContainerElement) return;

        // Очищаємо контейнер прогресу
        state.progressContainerElement.innerHTML = '';

        // Додаємо повідомлення про помилку
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Помилка завантаження даних. Спробуйте пізніше.';

        // Додаємо кнопку повторного завантаження
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Спробувати знову';
        retryButton.className = 'retry-button';
        retryButton.addEventListener('click', () => loadBonusData(true));

        errorMessage.appendChild(retryButton);
        state.progressContainerElement.appendChild(errorMessage);

        // Оновлюємо стан кнопки отримання бонусу
        if (state.claimButtonElement) {
            state.claimButtonElement.disabled = true;
            state.claimButtonElement.textContent = 'Недоступно';
        } else {
            // Якщо кнопка відсутня, спробуємо створити її
            createClaimButton();
        }
    }

    /**
     * Відображення інтерфейсу бонусів
     */
    function renderBonusUI() {
        try {
            if (!state.bonusData || !state.progressContainerElement) {
                console.error("DailyBonus: Недостатньо даних для відображення інтерфейсу", {
                    bonusData: !!state.bonusData,
                    progressContainer: !!state.progressContainerElement
                });
                renderBackupUI();
                return;
            }

            // ВИПРАВЛЕННЯ 5: Перевіряємо наявність кнопки і створюємо її при необхідності
            if (!state.claimButtonElement) {
                state.claimButtonElement = document.getElementById('claim-daily');
                // Якщо кнопки все ще немає, створюємо її
                if (!state.claimButtonElement) {
                    createClaimButton();
                }
            }

            // Переконуємося, що кнопка видима
            if (state.claimButtonElement) {
                state.claimButtonElement.style.display = 'block';
                state.claimButtonElement.style.visibility = 'visible';
                state.claimButtonElement.style.opacity = '1';
                state.claimButtonElement.style.pointerEvents = 'auto';
            }

            // Очищаємо контейнер прогресу
            state.progressContainerElement.innerHTML = '';

            // Визначаємо максимальну кількість днів (за замовчуванням 7)
            const MAX_DAYS_VISIBLE = config.visibleDays;

            // Отримуємо поточний день та вже отримані дні
            const currentDay = state.bonusData.current_day || 1;
            const claimedDays = state.bonusData.claimed_days || [];
            const canClaim = state.bonusData.can_claim !== false;

            // Визначаємо таблицю винагород
            let rewards = config.defaultRewards;
            if (state.bonusData.all_rewards && Array.isArray(state.bonusData.all_rewards)) {
                rewards = state.bonusData.all_rewards;
            }

            // Визначаємо дні з жетонами
            let tokenRewards = config.tokenDays;
            if (state.bonusData.token_rewards && typeof state.bonusData.token_rewards === 'object') {
                tokenRewards = state.bonusData.token_rewards;
            }

            // Визначаємо, які дні будуть відображатися у вікні прогресу
            // Починаємо з поточного дня як крайнього лівого
            let startDay = currentDay;
            let endDay = Math.min(currentDay + MAX_DAYS_VISIBLE - 1, config.cycleDays);

            // Якщо днів менше, ніж MAX_DAYS_VISIBLE, додаємо дні зліва
            if (endDay - startDay + 1 < MAX_DAYS_VISIBLE) {
                startDay = Math.max(1, endDay - MAX_DAYS_VISIBLE + 1);
            }

            console.log(`DailyBonus: Відображення днів від ${startDay} до ${endDay}`);

            // Фрагмент для оптимізації рендерингу
            const fragment = document.createDocumentFragment();

            // Створюємо елементи для кожного дня
            for (let day = startDay; day <= endDay; day++) {
                // Визначаємо суму винагороди для цього дня
                const rewardAmount = rewards[day - 1] || day * 10;

                // Перевіряємо, чи є жетони в цей день
                const hasToken = tokenRewards[day] > 0;
                const tokenAmount = tokenRewards[day] || 0;

                // Створюємо маркер дня
                const dayMarker = document.createElement('div');
                dayMarker.className = 'day-marker';

                // Створюємо коло дня
                const dayCircle = document.createElement('div');
                dayCircle.className = 'day-circle';

                // Визначаємо стан дня
                if (claimedDays.includes(day)) {
                    dayCircle.classList.add('completed');
                } else if (day === currentDay && canClaim) {
                    dayCircle.classList.add('active');
                }

                // Встановлюємо вміст
                dayCircle.textContent = day;

                // Додаємо позначку жетона, якщо є
                if (hasToken) {
                    const tokenBadge = document.createElement('div');
                    tokenBadge.className = 'token-badge';
                    tokenBadge.textContent = tokenAmount;
                    dayCircle.appendChild(tokenBadge);
                }

                dayMarker.appendChild(dayCircle);

                // Додаємо винагороду
                const dayReward = document.createElement('div');
                dayReward.className = 'day-reward';
                dayReward.textContent = `${rewardAmount} $W`;
                dayMarker.appendChild(dayReward);

                // Додаємо маркер до фрагменту
                fragment.appendChild(dayMarker);
            }

            // Додаємо фрагмент до контейнера за один раз
            state.progressContainerElement.appendChild(fragment);

            // Оновлюємо стан кнопки отримання бонусу
            updateClaimButton();

            console.log("DailyBonus: Інтерфейс успішно відображено");

            // ВИПРАВЛЕННЯ 5: Остаточно переконуємося, що кнопка видима
            if (state.claimButtonElement) {
                state.claimButtonElement.style.display = 'block';
                state.claimButtonElement.style.visibility = 'visible';
                state.claimButtonElement.style.opacity = '1';
                state.claimButtonElement.style.pointerEvents = 'auto';
                updateClaimButton();
            }
        } catch (error) {
            console.error("DailyBonus: Помилка відображення інтерфейсу:", error);
            renderBackupUI();
        }
    }

    /**
     * Оновлення стану кнопки отримання бонусу
     */
    function updateClaimButton() {
        if (!state.claimButtonElement) {
            // Пробуємо знайти кнопку в DOM
            state.claimButtonElement = document.getElementById('claim-daily');

            // Якщо кнопки все ще немає, виходимо
            if (!state.claimButtonElement) {
                console.warn("DailyBonus: Кнопка бонусу не знайдена при оновленні");
                return;
            }
        }

        // Перевіряємо чи є дані про бонус
        if (!state.bonusData) {
            state.claimButtonElement.disabled = true;
            state.claimButtonElement.textContent = 'Завантаження...';
            return;
        }

        // Визначаємо, чи можна отримати бонус
        const canClaim = state.bonusData.can_claim !== false;

        // Отримуємо інформацію про жетони
        const currentDay = state.bonusData.current_day || 1;
        const tokenAmount = state.bonusData.token_amount || 0;
        const tokenText = tokenAmount > 0 ? ` + ${tokenAmount} жетон${tokenAmount > 1 ? 'и' : ''}` : '';

        // Оновлюємо стан кнопки
        if (canClaim) {
            state.claimButtonElement.disabled = false;
            state.claimButtonElement.textContent = `Отримати бонус${tokenText}`;
            state.claimButtonElement.classList.remove('disabled');
            state.claimButtonElement.style.opacity = '1';
        } else {
            state.claimButtonElement.disabled = true;
            state.claimButtonElement.textContent = 'Вже отримано';
            state.claimButtonElement.classList.add('disabled');
            state.claimButtonElement.style.opacity = '0.7';
        }
    }

    /**
     * Отримання щоденного бонусу
     * @returns {Promise<Object>} Результат отримання бонусу
     */
    async function claimDailyBonus() {
        // Перевіряємо чи не виконується вже інша операція
        if (state.pendingOperation) {
            if (typeof window.showToast === 'function') {
                window.showToast("Запит вже обробляється, зачекайте...", "info");
            }
            return Promise.reject(new Error("Операція вже виконується"));
        }

        // Отримуємо ID користувача
        const userId = getUserId();
        if (!userId) {
            if (typeof window.showToast === 'function') {
                window.showToast("Неможливо отримати бонус: ви не авторизовані", "error");
            }
            return Promise.reject(new Error("ID користувача не знайдено"));
        }

        // Встановлюємо прапорець очікування
        state.pendingOperation = true;

        // Показуємо індикатор завантаження
        if (typeof window.showLoading === 'function') {
            window.showLoading();
        }

        try {
            // Перевіряємо можливість отримання бонусу
            if (state.bonusData && !state.bonusData.can_claim) {
                if (typeof window.showToast === 'function') {
                    window.showToast("Ви вже отримали бонус сьогодні", "info");
                }
                return Promise.reject(new Error("Бонус вже отримано сьогодні"));
            }

            // Формуємо шлях API
            const endpoint = API_PATHS.CLAIM(userId);

            // Дані для відправки
            const requestData = state.bonusData ? { day: state.bonusData.current_day } : null;

            // Виконуємо запит до API
            const response = await fetchApi(endpoint, 'POST', requestData);

            // Оновлюємо стан
            if (response && response.status === 'success' && response.data) {
                // Оновлюємо бонусні дані
                state.bonusData = {
                    ...state.bonusData,
                    can_claim: false,
                    current_day: response.data.next_day,
                    claimed_days: [...(state.bonusData.claimed_days || []), state.bonusData.current_day],
                    streak_days: response.data.streak_days,
                    last_claimed_date: new Date().toISOString()
                };

                state.lastLoaded = Date.now();

                // Оновлюємо кеш
                try {
                    localStorage.setItem('daily_bonus_data', JSON.stringify({
                        data: state.bonusData,
                        timestamp: state.lastLoaded,
                        userId: userId
                    }));
                } catch (e) {
                    console.warn("DailyBonus: Помилка збереження даних в кеш:", e);
                }

                // Оновлюємо інтерфейс
                renderBonusUI();

                // Складаємо повідомлення про отриманий бонус
                let rewardMessage = `Щоденний бонус отримано: +${response.data.reward || 0} WINIX`;

                // Додаємо інформацію про жетони, якщо вони отримані
                if (response.data.token_amount > 0) {
                    const tokenWord = response.data.token_amount === 1 ? 'жетон' :
                                      (response.data.token_amount < 5 ? 'жетони' : 'жетонів');
                    rewardMessage += ` та ${response.data.token_amount} ${tokenWord}`;
                }

                // Додаємо інформацію про бонус за завершення циклу, якщо він отриманий
                if (response.data.cycle_completed && response.data.completion_bonus) {
                    const completionBonus = response.data.completion_bonus;
                    rewardMessage += `\nБонус за завершення циклу: +${completionBonus.amount} WINIX та ${completionBonus.tokens} жетонів!`;

                    // Додаємо інформацію про значок
                    if (completionBonus.badge) {
                        rewardMessage += `\nОтримано значок "${completionBonus.badge}"!`;
                    }
                }

                // Показуємо повідомлення про успіх
                if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
                    window.UI.Notifications.showSuccess(rewardMessage);
                } else if (typeof window.showToast === 'function') {
                    // Використовуйте кастомну реалізацію toast для успіху
                    const toastElement = document.getElementById('toast-message');
                    if (toastElement) {
                        toastElement.textContent = rewardMessage;
                        toastElement.className = 'toast-message success show';

                        setTimeout(() => {
                            toastElement.classList.remove('show');
                            setTimeout(() => {
                                toastElement.className = 'toast-message';
                            }, 300);
                        }, 3000);
                    }
                }

                // Оновлюємо баланс користувача негайно
                if (response.data.reward) {
                    updateUserBalance(response.data.reward, response.data.new_balance);
                }

                // Оновлюємо баланс жетонів, якщо вони отримані
                if (response.data.token_amount > 0) {
                    updateUserCoins(response.data.token_amount, response.data.new_coins);
                }

                // Показуємо анімацію винагороди через спеціальний метод
                if (response.data.reward && window.UI?.Animations?.showDailyBonusReward) {
                    window.UI.Animations.showDailyBonusReward(
                        response.data.reward,
                        response.data.token_amount,
                        response.data.cycle_completed,
                        response.data.completion_bonus
                    );
                }

                // Відправляємо подію про отримання бонусу
                document.dispatchEvent(new CustomEvent('daily-bonus-claimed', {
                    detail: response.data
                }));

                console.log("DailyBonus: Бонус успішно отримано:", response.data);
                return response.data;
            } else {
                throw new Error(response.message || "Неочікувана відповідь сервера");
            }
        } catch (error) {
            console.error("DailyBonus: Помилка отримання щоденного бонусу:", error.message);

            // Показуємо повідомлення про помилку
            if (typeof window.showToast === 'function') {
                window.showToast(error.message || "Не вдалося отримати щоденний бонус. Спробуйте пізніше.", "error");
            }

            throw error;
        } finally {
            // Знімаємо прапорець очікування
            state.pendingOperation = false;

            // Приховуємо індикатор завантаження
            if (typeof window.hideLoading === 'function') {
                window.hideLoading();
            }
        }
    }

    /**
     * Оновлення балансу токенів користувача з оптимізаціями
     * @param {number} amount - Кількість токенів
     * @param {number} newTotalBalance - Новий загальний баланс (якщо відомий)
     */
    function updateUserBalance(amount, newTotalBalance = null) {
        // Виконуємо пряме оновлення DOM для миттєвого зворотного зв'язку
        if (config.useDirectDomUpdates) {
            const tokenElement = document.getElementById('user-tokens');
            if (tokenElement) {
                const currentBalance = parseFloat(tokenElement.textContent) || 0;

                // Якщо переданий новий загальний баланс, використовуємо його
                // інакше обчислюємо на основі поточного значення
                let newBalance = typeof newTotalBalance === 'number' ?
                    newTotalBalance : (currentBalance + amount);

                // Перевіряємо, чи баланс змінився, щоб не викликати зайвий reflow
                if (currentBalance !== newBalance) {
                    tokenElement.textContent = newBalance.toFixed(2);
                    tokenElement.classList.add('increasing');

                    // Видаляємо клас анімації через затримку для закінчення анімації
                    setTimeout(() => {
                        tokenElement.classList.remove('increasing');
                    }, 1500);

                    // Оновлюємо локальний кеш балансу
                    try {
                        localStorage.setItem('userTokens', newBalance.toString());
                        localStorage.setItem('winix_balance', newBalance.toString());
                    } catch (e) {}

                    console.log(`DailyBonus: Баланс токенів оновлено на ${amount}, новий баланс: ${newBalance}`);
                }
            }
        }

        // Використовуємо setBalance для миттєвого оновлення
        if (newTotalBalance !== null) {
            if (window.TaskRewards?.setBalance) {
                window.TaskRewards.setBalance('tokens', newTotalBalance, true);
            }

            // Також оновлюємо через Core для повної синхронізації
            if (window.WinixCore?.updateLocalBalance) {
                window.WinixCore.updateLocalBalance(newTotalBalance, 'daily-bonus', true);
            }
        } else {
            // Якщо новий баланс невідомий, оновлюємо на значення
            if (window.TaskRewards?.updateBalance) {
                window.TaskRewards.updateBalance({
                    type: 'tokens',
                    amount: amount
                });
            }
        }
    }

    /**
     * Оновлення балансу жетонів користувача з оптимізаціями
     * @param {number} amount - Кількість жетонів
     * @param {number} newTotalCoins - Новий загальний баланс жетонів (якщо відомий)
     */
    function updateUserCoins(amount, newTotalCoins = null) {
        // Виконуємо пряме оновлення DOM для миттєвого зворотного зв'язку
        if (config.useDirectDomUpdates) {
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                const currentCoins = parseInt(coinsElement.textContent) || 0;

                // Якщо переданий новий загальний баланс, використовуємо його
                // інакше обчислюємо на основі поточного значення
                let newCoins = typeof newTotalCoins === 'number' ?
                    newTotalCoins : (currentCoins + amount);

                // Перевіряємо, чи баланс змінився, щоб не викликати зайвий reflow
                if (currentCoins !== newCoins) {
                    coinsElement.textContent = newCoins.toString();
                    coinsElement.classList.add('increasing');

                    // Видаляємо клас анімації через затримку для закінчення анімації
                    setTimeout(() => {
                        coinsElement.classList.remove('increasing');
                    }, 1500);

                    // Оновлюємо локальний кеш балансу
                    try {
                        localStorage.setItem('userCoins', newCoins.toString());
                        localStorage.setItem('winix_coins', newCoins.toString());
                    } catch (e) {}

                    console.log(`DailyBonus: Баланс жетонів оновлено на ${amount}, новий баланс: ${newCoins}`);
                }
            }
        }

        // Використовуємо setBalance для миттєвого оновлення
        if (newTotalCoins !== null) {
            if (window.TaskRewards?.setBalance) {
                window.TaskRewards.setBalance('coins', newTotalCoins, true);
            }

            // Також оновлюємо через Core для повної синхронізації
            if (window.WinixCore?.updateLocalBalance) {
                window.WinixCore.updateLocalBalance(newTotalCoins, 'daily-bonus', true);
            }
        } else {
            // Якщо новий баланс невідомий, оновлюємо на значення
            if (window.TaskRewards?.updateBalance) {
                window.TaskRewards.updateBalance({
                    type: 'coins',
                    amount: amount
                });
            }
        }
    }

    /**
     * Отримання стану
     * @returns {Object} Поточний стан модуля
     */
    function getState() {
        return {
            isInitialized: state.isInitialized,
            bonusData: state.bonusData,
            lastLoaded: state.lastLoaded,
            isLoading: state.isLoading,
            pendingOperation: state.pendingOperation,
            lastError: state.lastError,
            hasContainer: !!state.containerElement,
            hasButton: !!state.claimButtonElement,
            hasProgressContainer: !!state.progressContainerElement,
            taskManagerReady: state.taskManagerReady
        };
    }

    /**
     * Скидання кешу
     */
    function resetCache() {
        state.bonusData = null;
        state.lastLoaded = 0;
        localStorage.removeItem('daily_bonus_data');
        console.log("DailyBonus: Кеш скинуто");
    }

    // Підписка на події DOM для автоматичного запуску
    document.addEventListener('DOMContentLoaded', function() {
        // Відкладена ініціалізація для уникнення блокування рендерингу сторінки
        setTimeout(function() {
            if (!state.isInitialized) {
                console.log("DailyBonus: Автоматичний запуск ініціалізації");
                init();
            }
        }, 500);
    });

    // Якщо DOM вже завантажено, запускаємо ініціалізацію негайно
    if (document.readyState !== 'loading') {
        setTimeout(function() {
            if (!state.isInitialized) {
                console.log("DailyBonus: Запуск ініціалізації, DOM вже готовий");
                init();
            }
        }, 100);
    }

    // Публічний API
    return {
        init,
        loadBonusData,
        claimDailyBonus,
        renderBonusUI,
        getState,
        resetCache,
        showInfoModal,
        hideInfoModal,
        updateUserBalance,
        updateUserCoins,
        notifyTaskManagerReady,
        checkAndRestoreButton,
        // Додатковий метод для надійного оновлення кнопки
        ensureButtonVisible: function() {
            if (state.claimButtonElement) {
                state.claimButtonElement.style.display = 'block';
                state.claimButtonElement.style.visibility = 'visible';
                state.claimButtonElement.style.opacity = '1';
                updateClaimButton();
            } else {
                checkAndRestoreButton();
            }
        }
    };
})();