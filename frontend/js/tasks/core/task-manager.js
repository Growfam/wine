/**
 * TaskManager - модуль керування завданнями з покращеною інтеграцією компонентів
 * Відповідає за:
 * - Координацію між всіма модулями системи завдань
 * - Завантаження та відображення завдань
 * - Обробку взаємодії користувача з завданнями
 */

window.TaskManager = (function() {
    // Приватні змінні модуля
    let socialTasks = [];
    let limitedTasks = [];
    let partnerTasks = [];
    let userProgress = {};

    // Стан ініціалізації компонентів
    const componentsState = {
        progress: false,
        verification: false,
        rewards: false,
        animations: false,
        notifications: false,
        dailyBonus: false,
        leaderboard: false
    };

    // DOM-елементи
    const domElements = {
        socialTasksContainer: null,
        limitedTasksContainer: null,
        partnersTasksContainer: null,
        tabButtons: null,
        contentSections: null
    };

    /**
     * Ініціалізація менеджера завдань
     */
    function init() {
        console.log('Ініціалізація TaskManager...');

        // Знаходимо необхідні DOM-елементи
        findDomElements();

        // Налаштування перемикачів вкладок
        setupTabSwitching();

        // Ініціалізуємо інші модулі
        initializeComponents();

        // Завантаження даних користувача та завдань
        loadUserProgress()
            .then(() => {
                loadTasks();

                // Ініціалізуємо компоненти після завантаження завдань
                if (window.DailyBonus && !componentsState.dailyBonus) {
                    window.DailyBonus.init();
                    componentsState.dailyBonus = true;
                }

                if (window.Leaderboard && !componentsState.leaderboard) {
                    window.Leaderboard.init();
                    componentsState.leaderboard = true;
                }
            })
            .catch(error => {
                console.error('Помилка завантаження даних:', error);
                showErrorMessage('Не вдалося завантажити завдання. Спробуйте пізніше.');
            });

        // Підписуємося на події
        subscribeToEvents();
    }

    /**
     * Знаходження необхідних DOM-елементів
     */
    function findDomElements() {
        domElements.socialTasksContainer = document.getElementById('social-tasks-container');
        domElements.limitedTasksContainer = document.getElementById('limited-tasks-container');
        domElements.partnersTasksContainer = document.getElementById('partners-tasks-container');
        domElements.tabButtons = document.querySelectorAll('.tab');
        domElements.contentSections = document.querySelectorAll('.content-section');
    }

    /**
     * Ініціалізація компонентів
     */
    function initializeComponents() {
        // Ініціалізуємо модуль прогресу
        if (window.TaskProgress && !componentsState.progress) {
            window.TaskProgress.init();
            componentsState.progress = true;
        }

        // Ініціалізуємо модуль перевірки
        if (window.TaskVerification && !componentsState.verification) {
            window.TaskVerification.init();
            componentsState.verification = true;
        }

        // Ініціалізуємо модуль винагород
        if (window.TaskRewards && !componentsState.rewards) {
            window.TaskRewards.init();
            componentsState.rewards = true;
        }

        // Ініціалізуємо модулі UI
        if (window.UI) {
            // Анімації
            if (window.UI.Animations && !componentsState.animations) {
                window.UI.Animations.init();
                componentsState.animations = true;
            }

            // Сповіщення
            if (window.UI.Notifications && !componentsState.notifications) {
                window.UI.Notifications.init();
                componentsState.notifications = true;
            }
        }
    }

    /**
     * Налаштування перемикачів вкладок
     */
    function setupTabSwitching() {
        if (!domElements.tabButtons) return;

        domElements.tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Знімаємо активний клас з усіх вкладок
                domElements.tabButtons.forEach(btn => btn.classList.remove('active'));

                // Додаємо активний клас поточній вкладці
                this.classList.add('active');

                // Ховаємо всі секції контенту
                if (domElements.contentSections) {
                    domElements.contentSections.forEach(section => section.classList.remove('active'));
                }

                // Показуємо відповідну секцію
                const tabType = this.dataset.tab;
                const targetSection = document.getElementById(`${tabType}-content`);
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                // Зберігаємо активну вкладку в localStorage
                try {
                    localStorage.setItem('active_tasks_tab', tabType);
                } catch (e) {}
            });
        });

        // Відновлюємо активну вкладку з localStorage
        try {
            const savedTab = localStorage.getItem('active_tasks_tab');
            if (savedTab) {
                const savedTabButton = document.querySelector(`.tab[data-tab="${savedTab}"]`);
                if (savedTabButton) {
                    savedTabButton.click();
                }
            }
        } catch (e) {}
    }

    /**
     * Завантаження прогресу користувача
     */
    async function loadUserProgress() {
        try {
            // Якщо доступний модуль прогресу, використовуємо його
            if (window.TaskProgress) {
                userProgress = window.TaskProgress.getUserProgress();
                return userProgress;
            }

            // Інакше отримуємо через API
            if (window.API) {
                const response = await window.API.get('/quests/user-progress');
                userProgress = response.data || {};
                return userProgress;
            }

            // Якщо API недоступне, повертаємо пустий об'єкт
            return {};
        } catch (error) {
            console.error('Помилка завантаження прогресу користувача:', error);
            userProgress = {};
            return {};
        }
    }

    /**
     * Завантаження завдань з API
     */
    async function loadTasks() {
        try {
            if (!window.API) {
                console.error('API не доступний. Використання тестових даних.');

                // Використовуємо тестові дані
                socialTasks = getMockSocialTasks();
                limitedTasks = getMockLimitedTasks();
                partnerTasks = getMockPartnerTasks();

                // Відображаємо завдання
                renderSocialTasks();
                renderLimitedTasks();
                renderPartnerTasks();

                return;
            }

            // Виконуємо паралельні запити для швидшого завантаження
            const [socialResponse, limitedResponse, partnerResponse] = await Promise.all([
                window.API.get('/quests/tasks/social'),
                window.API.get('/quests/tasks/limited'),
                window.API.get('/quests/tasks/partners')
            ]);

            // Зберігаємо дані та відображаємо завдання
            if (socialResponse.success) {
                socialTasks = socialResponse.data || [];
                renderSocialTasks();
            }

            if (limitedResponse.success) {
                limitedTasks = limitedResponse.data || [];
                renderLimitedTasks();
            }

            if (partnerResponse.success) {
                partnerTasks = partnerResponse.data || [];
                renderPartnerTasks();
            }
        } catch (error) {
            console.error('Помилка завантаження завдань:', error);

            // Використовуємо тестові дані
            socialTasks = getMockSocialTasks();
            limitedTasks = getMockLimitedTasks();
            partnerTasks = getMockPartnerTasks();

            // Відображаємо завдання
            renderSocialTasks();
            renderLimitedTasks();
            renderPartnerTasks();

            // Показуємо повідомлення про помилку
            showErrorMessage('Не вдалося завантажити завдання. Використовуються демонстраційні дані.');
        }
    }

    /**
     * Отримання тестових соціальних завдань
     */
    function getMockSocialTasks() {
        return [
            {
                id: 'social_telegram',
                title: 'Підписатися на Telegram',
                description: 'Підпишіться на наш офіційний Telegram канал для отримання останніх новин та оновлень',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 10,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://t.me/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_twitter',
                title: 'Підписатися на Twitter',
                description: 'Підпишіться на наш Twitter акаунт та будьте в курсі останніх новин',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://twitter.com/winix_official',
                action_label: 'Підписатися'
            },
            {
                id: 'social_discord',
                title: 'Приєднатися до Discord',
                description: 'Приєднайтеся до нашої спільноти в Discord, спілкуйтеся з іншими учасниками та отримуйте підтримку',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 15,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://discord.gg/winix',
                action_label: 'Приєднатися'
            },
            {
                id: 'social_share',
                title: 'Поділитися з друзями',
                description: 'Розкажіть друзям про WINIX у соціальних мережах',
                type: 'social',
                reward_type: 'tokens',
                reward_amount: 20,
                target_value: 1,
                action_type: 'share',
                action_label: 'Поділитися'
            }
        ];
    }

    /**
     * Отримання тестових лімітованих завдань
     */
    function getMockLimitedTasks() {
        // Створюємо кінцеву дату через 3 дні
        const endDate1 = new Date();
        endDate1.setDate(endDate1.getDate() + 3);

        // Створюємо кінцеву дату через 5 днів
        const endDate2 = new Date();
        endDate2.setDate(endDate2.getDate() + 5);

        return [
            {
                id: 'limited_vote',
                title: 'Проголосувати за проект',
                description: 'Проголосуйте за WINIX на платформі CoinVote для підтримки проекту',
                type: 'limited',
                reward_type: 'tokens',
                reward_amount: 30,
                target_value: 1,
                action_type: 'visit',
                action_url: 'https://coinvote.cc/winix',
                action_label: 'Проголосувати',
                end_date: endDate1.toISOString()
            },
            {
                id: 'limited_game',
                title: 'Зіграти в мініГРУ',
                description: 'Зіграйте в нашу мініГру та отримайте бонус за досягнення 1000 очок',
                type: 'limited',
                reward_type: 'tokens',
                reward_amount: 50,
                target_value: 1,
                action_type: 'play',
                action_label: 'Грати',
                end_date: endDate2.toISOString()
            }
        ];
    }

    /**
     * Отримання тестових партнерських завдань
     */
    function getMockPartnerTasks() {
        return [
            {
                id: 'partner_exchange',
                title: 'Зареєструватися на біржі',
                description: 'Зареєструйтеся на нашій партнерській біржі та отримайте бонус',
                type: 'partner',
                reward_type: 'tokens',
                reward_amount: 100,
                target_value: 1,
                action_type: 'register',
                action_url: 'https://exchange.example.com/ref=winix',
                action_label: 'Зареєструватися',
                partner_name: 'CryptoExchange'
            }
        ];
    }

    /**
     * Відображення соціальних завдань
     */
    function renderSocialTasks() {
        if (!domElements.socialTasksContainer) return;

        // Очищаємо контейнер
        domElements.socialTasksContainer.innerHTML = '';

        if (socialTasks.length === 0) {
            domElements.socialTasksContainer.innerHTML = '<div class="no-tasks" data-lang-key="earn.no_tasks">Немає доступних завдань</div>';
            return;
        }

        // Відображаємо кожне завдання
        socialTasks.forEach(task => {
            // Перевіряємо наявність компонента для соціальних завдань
            if (window.SocialTask && window.SocialTask.create) {
                const taskElement = window.SocialTask.create(task, userProgress[task.id]);
                domElements.socialTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.socialTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Відображення лімітованих завдань
     */
    function renderLimitedTasks() {
        if (!domElements.limitedTasksContainer) return;

        // Очищаємо контейнер
        domElements.limitedTasksContainer.innerHTML = '';

        if (limitedTasks.length === 0) {
            domElements.limitedTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title" data-lang-key="earn.expect_new_tasks_title">Очікуйте на нові завдання</div><div class="timer-container"><span class="timer-icon">⏰</span> <span data-lang-key="earn.coming_soon">Скоро</span></div></div><div class="task-description" data-lang-key="earn.expect_new_tasks">Лімітовані завдання будуть доступні найближчим часом. Не пропустіть можливість отримати додаткові нагороди!</div></div>';
            return;
        }

        // Відображаємо кожне завдання
        limitedTasks.forEach(task => {
            // Перевіряємо наявність компонента для лімітованих завдань
            if (window.LimitedTask && window.LimitedTask.create) {
                const taskElement = window.LimitedTask.create(task, userProgress[task.id]);
                domElements.limitedTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.limitedTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id], true);
            }
        });
    }

    /**
     * Відображення партнерських завдань
     */
    function renderPartnerTasks() {
        if (!domElements.partnersTasksContainer) return;

        // Очищаємо контейнер
        domElements.partnersTasksContainer.innerHTML = '';

        if (partnerTasks.length === 0) {
            domElements.partnersTasksContainer.innerHTML = '<div class="task-item"><div class="task-header"><div class="task-title" data-lang-key="earn.expect_partners_title">Очікуйте на партнерські пропозиції</div></div><div class="task-description" data-lang-key="earn.expect_partners">Партнерські завдання будуть доступні найближчим часом. Слідкуйте за оновленнями!</div></div>';
            return;
        }

        // Відображаємо кожне завдання
        partnerTasks.forEach(task => {
            // Перевіряємо наявність компонента для партнерських завдань
            if (window.PartnerTask && window.PartnerTask.create) {
                const taskElement = window.PartnerTask.create(task, userProgress[task.id]);
                domElements.partnersTasksContainer.appendChild(taskElement);
            } else {
                // Запасний варіант, якщо компонент не знайдено
                domElements.partnersTasksContainer.innerHTML += createBasicTaskElement(task, userProgress[task.id]);
            }
        });
    }

    /**
     * Створення базового елементу завдання (запасний варіант)
     */
    function createBasicTaskElement(task, progress, isLimited = false) {
        const completed = progress && progress.status === 'completed';
        const progressValue = progress ? progress.progress_value : 0;
        const progressPercent = Math.min(100, Math.round((progressValue / task.target_value) * 100)) || 0;

        let timerHtml = '';
        if (isLimited && task.end_date) {
            const endDate = new Date(task.end_date);
            const now = new Date();
            const timeLeft = endDate - now;

            if (timeLeft > 0) {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                timerHtml = `<div class="timer-container"><span class="timer-icon">⏰</span> <span class="timer-value" data-end-date="${task.end_date}">${days}д ${hours}г</span></div>`;
            } else {
                timerHtml = `<div class="timer-container expired"><span class="timer-icon">⏰</span> <span data-lang-key="earn.expired">Закінчено</span></div>`;
            }
        }

        // Додаємо інформацію про партнера, якщо є
        let partnerLabel = '';
        if (task.partner_name) {
            partnerLabel = `<div class="partner-label">Партнер: ${escapeHtml(task.partner_name)}</div>`;
        }

        return `
            <div class="task-item" data-task-id="${task.id}" data-task-type="${task.type}" data-target-value="${task.target_value}">
                ${partnerLabel}
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</span></div>${timerHtml}`
                    }
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                ${task.target_value > 1 ? 
                  `<div class="task-progress">
                       <div class="progress-text">${progressValue}/${task.target_value} ${task.progress_label || ''}</div>
                       <div class="progress-bar-container">
                           <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                       </div>
                   </div>` : ''
                }
                <div class="task-action">
                    ${completed ? 
                      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                      `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>
                       <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`
                    }
                </div>
            </div>
        `;
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Делегування подій для кнопок завдань
        document.addEventListener('click', function(event) {
            const target = event.target;

            // Обробка дій з завданнями
            if (target.matches('.action-button[data-action="start"]')) {
                const taskId = target.dataset.taskId;
                startTask(taskId);
            } else if (target.matches('.action-button[data-action="verify"]')) {
                const taskId = target.dataset.taskId;
                verifyTask(taskId);
            }
        });

        // Обробка кнопки отримання щоденного бонусу
        const claimDailyButton = document.getElementById('claim-daily');
        if (claimDailyButton) {
            claimDailyButton.addEventListener('click', function() {
                if (window.DailyBonus && window.DailyBonus.claimBonus) {
                    window.DailyBonus.claimBonus();
                } else {
                    showErrorMessage('Модуль щоденних бонусів недоступний');
                }
            });
        }

        // Обробка події завершення завдання
        document.addEventListener('task-completed', function(event) {
            const { taskId } = event.detail;

            // Оновлюємо відображення завдання
            refreshTaskDisplay(taskId);
        });

        // Обробка події оновлення прогресу
        document.addEventListener('task-progress-updated', function(event) {
            const { taskId, progressData } = event.detail;

            // Оновлюємо локальний прогрес
            userProgress[taskId] = progressData;

            // Оновлюємо відображення завдання
            refreshTaskDisplay(taskId);
        });
    }

    /**
     * Розпочати виконання завдання
     */
    async function startTask(taskId) {
        try {
            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                throw new Error('Завдання не знайдено');
            }

            // Якщо є модуль верифікації, використовуємо його
            if (window.API) {
                const response = await window.API.post(`/quests/tasks/${taskId}/start`);

                if (!response.success) {
                    throw new Error(response.message || 'Не вдалося розпочати завдання');
                }
            }

            // Якщо це соціальне завдання, відкриваємо відповідне посилання
            if (task.action_url) {
                window.open(task.action_url, '_blank');
            }

            // Показуємо повідомлення
            showSuccessMessage('Завдання розпочато! Виконайте необхідні дії.');

            // Оновлюємо прогрес, якщо є модуль прогресу
            if (window.TaskProgress) {
                // Ініціалізуємо прогрес, якщо його ще немає
                if (!userProgress[taskId]) {
                    const progressData = {
                        status: 'in_progress',
                        progress_value: 0,
                        start_date: new Date().toISOString()
                    };

                    window.TaskProgress.updateTaskProgress(taskId, progressData);
                }
            }
        } catch (error) {
            console.error('Помилка при запуску завдання:', error);
            showErrorMessage('Сталася помилка при спробі розпочати завдання');
        }
    }

    /**
     * Перевірити виконання завдання
     */
    async function verifyTask(taskId) {
        try {
            // Показуємо індикатор завантаження
            showLoadingIndicator(taskId);

            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) {
                throw new Error('Завдання не знайдено');
            }

            // Якщо є модуль верифікації, використовуємо його
            if (window.TaskVerification) {
                const result = await window.TaskVerification.verifyTask(taskId);

                // Якщо верифікація успішна
                if (result.success) {
                    // Оновлюємо прогрес
                    await loadUserProgress();

                    // Оновлюємо відображення
                    refreshTaskDisplay(taskId);

                    // Показуємо повідомлення про успіх
                    showSuccessMessage(result.message || 'Завдання успішно виконано!');
                } else {
                    // Оновлюємо відображення
                    refreshTaskDisplay(taskId);

                    // Показуємо повідомлення про помилку
                    showErrorMessage(result.message || 'Не вдалося перевірити виконання завдання');
                }

                return;
            }

            // Якщо немає модуля верифікації, використовуємо API
            if (window.API) {
                const response = await window.API.post(`/quests/tasks/${taskId}/verify`);

                // Приховуємо індикатор завантаження
                hideLoadingIndicator(taskId);

                if (response.success) {
                    // Оновлюємо прогрес
                    await loadUserProgress();

                    // Оновлюємо відображення
                    refreshTaskDisplay(taskId);

                    // Показуємо повідомлення про успіх
                    showSuccessMessage(response.message || 'Завдання успішно виконано!');

                    // Якщо є винагорода, показуємо анімацію
                    if (response.reward) {
                        showRewardAnimation(response.reward);
                    }
                } else {
                    // Оновлюємо відображення
                    refreshTaskDisplay(taskId);

                    // Показуємо повідомлення про помилку
                    showErrorMessage(response.message || 'Не вдалося перевірити виконання завдання');
                }
            } else {
                // Якщо немає API, імітуємо перевірку
                simulateVerification(taskId);

                // Приховуємо індикатор завантаження
                hideLoadingIndicator(taskId);
            }
        } catch (error) {
            console.error('Помилка при перевірці завдання:', error);

            // Приховуємо індикатор завантаження
            hideLoadingIndicator(taskId);

            // Показуємо повідомлення про помилку
            showErrorMessage('Сталася помилка при спробі перевірити виконання завдання');
        }
    }

    /**
     * Імітація перевірки завдання (для тестування)
     */
    function simulateVerification(taskId) {
        // Затримка для імітації запиту
        setTimeout(() => {
            // Знаходимо завдання
            const task = findTaskById(taskId);
            if (!task) return;

            // Імітуємо успіх з ймовірністю 70%
            const isSuccess = Math.random() < 0.7;

            if (isSuccess) {
                // Ініціалізуємо прогрес, якщо його ще немає
                if (!userProgress[taskId]) {
                    userProgress[taskId] = {
                        status: 'in_progress',
                        progress_value: 0,
                        start_date: new Date().toISOString()
                    };
                }

                // Оновлюємо прогрес
                userProgress[taskId].status = 'completed';
                userProgress[taskId].progress_value = task.target_value;
                userProgress[taskId].completion_date = new Date().toISOString();

                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Показуємо повідомлення про успіх
                showSuccessMessage('Завдання успішно виконано!');

                // Показуємо анімацію винагороди
                const reward = {
                    type: task.reward_type,
                    amount: task.reward_amount
                };

                showRewardAnimation(reward);
            } else {
                // Оновлюємо відображення
                refreshTaskDisplay(taskId);

                // Показуємо повідомлення про помилку
                showErrorMessage('Умови завдання ще не виконані. Спробуйте пізніше.');
            }
        }, 1000);
    }

    /**
     * Знайти завдання за ID
     */
    function findTaskById(taskId) {
        // Шукаємо у всіх типах завдань
        return socialTasks.find(task => task.id === taskId) ||
               limitedTasks.find(task => task.id === taskId) ||
               partnerTasks.find(task => task.id === taskId);
    }

    /**
     * Оновити відображення конкретного завдання
     */
    function refreshTaskDisplay(taskId) {
        const task = findTaskById(taskId);
        if (!task) return;

        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Отримуємо прогрес
        const progress = userProgress[taskId];

        // Залежно від типу завдання викликаємо відповідний компонент
        if (task.type === 'social' && window.SocialTask) {
            const newTaskElement = window.SocialTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else if (task.type === 'limited' && window.LimitedTask) {
            const newTaskElement = window.LimitedTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else if (task.type === 'partner' && window.PartnerTask) {
            const newTaskElement = window.PartnerTask.create(task, progress);
            taskElement.parentNode.replaceChild(newTaskElement, taskElement);
        } else {
            // Якщо немає відповідного компонента, оновлюємо вручну
            taskElement.innerHTML = createBasicTaskElement(task, progress, task.type === 'limited')
                .replace('<div class="task-item"', '<div')
                .replace(/^<div class="task-item".*?>/, '')
                .replace(/<\/div>$/, '');
        }
    }

    /**
     * Показати індикатор завантаження для конкретного завдання
     */
    function showLoadingIndicator(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            actionElement.classList.add('loading');

            // Створюємо індикатор завантаження, якщо його ще немає
            if (!actionElement.querySelector('.loading-indicator')) {
                // Зберігаємо оригінальний вміст
                const originalContent = actionElement.innerHTML;
                actionElement.setAttribute('data-original-content', originalContent);

                // Замінюємо на лоадер
                actionElement.innerHTML = `
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <span data-lang-key="earn.verifying">Перевірка...</span>
                    </div>
                `;
            }
        }
    }

    /**
     * Приховати індикатор завантаження для конкретного завдання
     */
    function hideLoadingIndicator(taskId) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            actionElement.classList.remove('loading');

            // Відновлюємо оригінальний вміст
            const originalContent = actionElement.getAttribute('data-original-content');
            if (originalContent) {
                actionElement.innerHTML = originalContent;
                actionElement.removeAttribute('data-original-content');
            }
        }
    }

    /**
     * Показати анімацію отримання винагороди
     */
    function showRewardAnimation(reward) {
        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(reward);
            return;
        }

        // Якщо є модуль винагород, використовуємо його
        if (window.TaskRewards && window.TaskRewards.showRewardAnimation) {
            window.TaskRewards.showRewardAnimation(reward);
            return;
        }

        // Проста анімація, якщо модуль анімацій не доступний
        showSuccessMessage(`Ви отримали ${reward.amount} ${reward.type === 'tokens' ? '$WINIX' : 'жетонів'}!`);

        // Оновлюємо відображення балансу
        updateBalance(reward);
    }

    /**
     * Оновити відображення балансу
     */
    function updateBalance(reward) {
        // Якщо є модуль винагород, використовуємо його
        if (window.TaskRewards && window.TaskRewards.updateBalance) {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        // Інакше оновлюємо вручну
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                userTokensElement.textContent = (currentBalance + reward.amount).toFixed(2);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);
            }
        }
    }

    /**
     * Показати повідомлення про успіх
     */
    function showSuccessMessage(message) {
        // Якщо є модуль сповіщень, використовуємо його
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
            window.UI.Notifications.showSuccess(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message success';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            alert(message);
        }
    }

    /**
     * Показати повідомлення про помилку
     */
    function showErrorMessage(message) {
        // Якщо є модуль сповіщень, використовуємо його
        if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
            window.UI.Notifications.showError(message);
            return;
        }

        // Запасний варіант - використовуємо toast-повідомлення
        const toastElement = document.getElementById('toast-message');
        if (toastElement) {
            toastElement.textContent = message;
            toastElement.className = 'toast-message error';
            toastElement.classList.add('show');

            // Автоматично приховуємо повідомлення через 3 секунди
            setTimeout(() => {
                toastElement.classList.remove('show');
                // Повертаємо оригінальний стиль
                setTimeout(() => {
                    toastElement.className = 'toast-message';
                }, 300);
            }, 3000);
        } else {
            alert(message);
        }
    }

    /**
     * Функція для безпечного виведення HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Публічний API модуля
    return {
        init,
        loadTasks,
        startTask,
        verifyTask,
        refreshTaskDisplay,
        showSuccessMessage,
        showErrorMessage,
        showRewardAnimation,
        findTaskById
    };
})();