// Покращене визначення об'єкта Telegram WebApp
let tg;
try {
    tg = window.Telegram ? window.Telegram.WebApp : null;
    if (tg) {
        console.log("Telegram WebApp API успішно ініціалізовано");
        tg.ready();
        tg.expand();
    } else {
        console.error("Telegram WebApp API недоступний");
    }
} catch (error) {
    console.error("Помилка при ініціалізації Telegram WebApp API:", error.message);
    tg = null;
}

// Функція для навігації між сторінками
function navigateTo(page) {
    window.location.href = page;
}

// Функція для показу повідомлення
function showToast(message) {
    const toast = document.getElementById('toast-message');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

// Додавання CSS для виконаних завдань
function addCompletedTasksStyles() {
    if (document.getElementById('completed-tasks-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'completed-tasks-styles';
    styleElement.textContent = `
        .task-item.completed-task {
            opacity: 0.8;
            background: rgba(15, 23, 42, 0.5) !important;
            border-left: 4px solid #00C9A7 !important;
        }
    `;
    document.head.appendChild(styleElement);
}

// Функція для перевірки статусу підписки на Telegram канал через бота
async function checkTelegramSubscription(channelUsername) {
    // У реальному додатку тут має бути інтеграція з Telegram Bot API
    // Наприклад, відправка запиту на сервер, який через бота перевірить статус підписки

    // Фіктивна перевірка для тестування інтерфейсу
    return new Promise((resolve) => {
        setTimeout(() => {
            // Перевіряємо, чи користувач клікнув на кнопку підписки
            if (localStorage.getItem('telegram_link_clicked') === 'true') {
                // В реальному додатку тут буде логіка перевірки
                const randomSuccess = Math.random() > 0.3; // 70% шанс успіху для тестування
                resolve(randomSuccess);
            } else {
                resolve(false);
            }
        }, 1000); // Імітація запиту до сервера
    });
}

// Функція для імітації перевірки підписки (для тестування)
function fakeCheckSubscription(platform) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Перевіряємо, чи користувач клікнув на кнопку підписки
            if (localStorage.getItem(`${platform}_link_clicked`) === 'true') {
                const randomSuccess = Math.random() > 0.3; // 70% шанс успіху для тестування
                resolve(randomSuccess);
            } else {
                resolve(false);
            }
        }, 1000);
    });
}

// Обробка отримання щоденного бонусу
function setupDailyBonus() {
    const claimButton = document.getElementById('claim-daily');
    if (!claimButton) return;

    // Перевірка, чи користувач вже отримав бонус сьогодні
    const lastClaimDate = localStorage.getItem('lastDailyBonusClaim');
    const today = new Date().toDateString();

    if (lastClaimDate === today) {
        claimButton.disabled = true;
        claimButton.textContent = 'Вже отримано сьогодні';
    } else {
        // Визначаємо день тижня (прогрес)
        const currentDay = parseInt(localStorage.getItem('currentBonusDay') || 0);
        // Наступний день бонусу (поточний + 1)
        const nextDay = currentDay + 1 > 7 ? 1 : currentDay + 1;
        // Розрахунок нагороди на основі наступного дня
        const rewardAmount = nextDay * 10; // 10, 20, 30, ..., 70 WINIX

        // Оновлюємо текст кнопки з вірною сумою винагороди
        claimButton.textContent = `Отримати ${rewardAmount} $WINIX`;

        claimButton.addEventListener('click', async function() {
            try {
                // Оновлення балансу через rewardSystem
                if (typeof rewardSystem !== 'undefined') {
                    await rewardSystem.addTokens(rewardAmount);
                    showToast(`Вітаємо! Отримано ${rewardAmount} $WINIX`);

                    // Зберігаємо інформацію про отримання бонусу
                    localStorage.setItem('lastDailyBonusClaim', today);
                    localStorage.setItem('currentBonusDay', nextDay);

                    // Оновлюємо UI
                    claimButton.disabled = true;
                    claimButton.textContent = 'Вже отримано сьогодні';
                    updateDailyBonusUI(nextDay);
                } else {
                    throw new Error('Система винагород недоступна');
                }
            } catch (error) {
                console.error('Помилка при отриманні бонусу:', error);
                showToast('Помилка при отриманні бонусу');
            }
        });
    }

    // Оновлюємо UI денного бонусу при завантаженні
    const currentDay = parseInt(localStorage.getItem('currentBonusDay') || 0);
    updateDailyBonusUI(currentDay);
}

// Оновлення UI денного бонусу
function updateDailyBonusUI(currentDay) {
    const dayCircles = document.querySelectorAll('.day-circle');
    const progressBar = document.getElementById('weekly-progress');

    dayCircles.forEach((circle, index) => {
        // Скидаємо всі стани
        circle.classList.remove('active', 'completed');

        // Встановлюємо правильний стан для кожного кружечка
        if (index < currentDay) {
            circle.classList.add('completed');
        } else if (index === currentDay) {
            circle.classList.add('active');
        }
    });

    // Оновлюємо прогрес-бар
    if (progressBar) {
        const progressPercentage = (currentDay / 7) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }
}

// Обробка соціальних завдань
function setupSocialTasks() {
    setupTwitterTask();
    setupTelegramTask();
    setupYoutubeTask();

    // Після налаштування всіх завдань сортуємо їх
    sortCompletedTasksToBottom();
}

// Налаштування завдання з Twitter
function setupTwitterTask() {
    const twitterSubscribeBtn = document.getElementById('twitter-subscribe');
    const twitterVerifyBtn = document.getElementById('twitter-verify');

    if (!twitterSubscribeBtn || !twitterVerifyBtn) return;

    const taskItem = twitterSubscribeBtn.closest('.task-item');

    // Перевіряємо, чи вже виконане завдання
    if (localStorage.getItem('twitter_task_completed') === 'true') {
        // Застосовуємо стилі виконаного завдання
        applyCompletedTaskStyle(taskItem, twitterSubscribeBtn, twitterVerifyBtn);
        return;
    }

    // Налаштовуємо кнопку підписки
    twitterSubscribeBtn.addEventListener('click', () => {
        // Зберігаємо інформацію про клік на кнопку підписки
        localStorage.setItem('twitter_link_clicked', 'true');
        // Відкриваємо Twitter у новому вікні/вкладці
        window.open('https://twitter.com/winix_project', '_blank');
    });

    // Налаштовуємо кнопку перевірки
    twitterVerifyBtn.addEventListener('click', async () => {
        // Перевіряємо, чи завдання вже виконано
        if (localStorage.getItem('twitter_task_completed') === 'true') {
            showToast('Це завдання вже виконано!');
            return;
        }

        // Перевіряємо, чи користувач клікнув на кнопку підписки
        if (localStorage.getItem('twitter_link_clicked') !== 'true') {
            showToast('Спочатку натисніть кнопку "Підписатись"!');
            return;
        }

        showToast('Перевірка підписки...');

        // Перевіряємо підписку
        const isSubscribed = await fakeCheckSubscription('twitter');

        if (isSubscribed) {
            // Надаємо винагороду через систему винагород
            if (typeof rewardSystem !== 'undefined') {
                await rewardSystem.addTokens(50);
                showToast('Вітаємо! Отримано 50 $WINIX');

                // Позначаємо завдання як виконане
                localStorage.setItem('twitter_task_completed', 'true');

                // Застосовуємо стилі виконаного завдання
                applyCompletedTaskStyle(taskItem, twitterSubscribeBtn, twitterVerifyBtn);

                // Перебудовуємо порядок завдань
                sortCompletedTasksToBottom();
            } else {
                showToast('Помилка системи винагород');
            }
        } else {
            showToast('Підписку не знайдено. Спробуйте ще раз.');
        }
    });
}

// Налаштування завдання з Telegram
function setupTelegramTask() {
    const telegramSubscribeBtn = document.getElementById('telegram-subscribe');
    const telegramVerifyBtn = document.getElementById('telegram-verify');

    if (!telegramSubscribeBtn || !telegramVerifyBtn) return;

    const taskItem = telegramSubscribeBtn.closest('.task-item');

    // Перевіряємо, чи вже виконане завдання
    if (localStorage.getItem('telegram_task_completed') === 'true') {
        // Застосовуємо стилі виконаного завдання
        applyCompletedTaskStyle(taskItem, telegramSubscribeBtn, telegramVerifyBtn);
        return;
    }

    // Налаштовуємо кнопку підписки
    telegramSubscribeBtn.addEventListener('click', () => {
        // Зберігаємо інформацію про клік на кнопку підписки
        localStorage.setItem('telegram_link_clicked', 'true');
        // Відкриваємо Telegram у новому вікні/вкладці
        window.open('https://t.me/winix_channel', '_blank');
    });

    // Налаштовуємо кнопку перевірки
    telegramVerifyBtn.addEventListener('click', async () => {
        // Перевіряємо, чи завдання вже виконано
        if (localStorage.getItem('telegram_task_completed') === 'true') {
            showToast('Це завдання вже виконано!');
            return;
        }

        // Перевіряємо, чи користувач клікнув на кнопку підписки
        if (localStorage.getItem('telegram_link_clicked') !== 'true') {
            showToast('Спочатку натисніть кнопку "Підписатись"!');
            return;
        }

        showToast('Перевірка підписки...');

        try {
            // Перевіряємо підписку
            const isSubscribed = await checkTelegramSubscription('winix_channel');

            if (isSubscribed) {
                // Надаємо винагороду через систему винагород
                if (typeof rewardSystem !== 'undefined') {
                    await rewardSystem.addTokens(80);
                    showToast('Вітаємо! Отримано 80 $WINIX');

                    // Позначаємо завдання як виконане
                    localStorage.setItem('telegram_task_completed', 'true');

                    // Застосовуємо стилі виконаного завдання
                    applyCompletedTaskStyle(taskItem, telegramSubscribeBtn, telegramVerifyBtn);

                    // Перебудовуємо порядок завдань
                    sortCompletedTasksToBottom();
                } else {
                    showToast('Помилка системи винагород');
                }
            } else {
                showToast('Підписку не знайдено. Спробуйте ще раз.');
            }
        } catch (error) {
            console.error('Помилка перевірки підписки:', error);
            showToast('Помилка перевірки. Спробуйте пізніше.');
        }
    });
}

// Налаштування завдання з YouTube
function setupYoutubeTask() {
    const youtubeSubscribeBtn = document.getElementById('youtube-subscribe');
    const youtubeVerifyBtn = document.getElementById('youtube-verify');

    if (!youtubeSubscribeBtn || !youtubeVerifyBtn) return;

    const taskItem = youtubeSubscribeBtn.closest('.task-item');

    // Перевіряємо, чи вже виконане завдання
    if (localStorage.getItem('youtube_task_completed') === 'true') {
        // Застосовуємо стилі виконаного завдання
        applyCompletedTaskStyle(taskItem, youtubeSubscribeBtn, youtubeVerifyBtn);
        return;
    }

    // Налаштовуємо кнопку підписки
    youtubeSubscribeBtn.addEventListener('click', () => {
        // Зберігаємо інформацію про клік на кнопку підписки
        localStorage.setItem('youtube_link_clicked', 'true');
        // Відкриваємо YouTube у новому вікні/вкладці
        window.open('https://youtube.com/@winix_project', '_blank');
    });

    // Налаштовуємо кнопку перевірки
    youtubeVerifyBtn.addEventListener('click', async () => {
        // Перевіряємо, чи завдання вже виконано
        if (localStorage.getItem('youtube_task_completed') === 'true') {
            showToast('Це завдання вже виконано!');
            return;
        }

        // Перевіряємо, чи користувач клікнув на кнопку підписки
        if (localStorage.getItem('youtube_link_clicked') !== 'true') {
            showToast('Спочатку натисніть кнопку "Підписатись"!');
            return;
        }

        showToast('Перевірка підписки...');

        // Перевіряємо підписку
        const isSubscribed = await fakeCheckSubscription('youtube');

        if (isSubscribed) {
            // Надаємо винагороду через систему винагород
            if (typeof rewardSystem !== 'undefined') {
                await rewardSystem.addTokens(50);
                showToast('Вітаємо! Отримано 50 $WINIX');

                // Позначаємо завдання як виконане
                localStorage.setItem('youtube_task_completed', 'true');

                // Застосовуємо стилі виконаного завдання
                applyCompletedTaskStyle(taskItem, youtubeSubscribeBtn, youtubeVerifyBtn);

                // Перебудовуємо порядок завдань
                sortCompletedTasksToBottom();
            } else {
                showToast('Помилка системи винагород');
            }
        } else {
            showToast('Підписку не знайдено. Спробуйте ще раз.');
        }
    });
}

// Налаштування реферальних завдань
function setupReferralTasks() {
    const inviteBtns = [
        document.getElementById('invite-friends'),
        document.getElementById('invite-friends-10'),
        document.getElementById('invite-friends-25'),
        document.getElementById('invite-friends-100')
    ];

    inviteBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function() {
                // В реальному додатку тут буде отримання реферального посилання
                if (typeof referralSystem !== 'undefined' && referralSystem.getCurrentUserReferralLink) {
                    const referralLink = referralSystem.getCurrentUserReferralLink();

                    if (referralLink) {
                        navigator.clipboard.writeText(referralLink)
                            .then(() => {
                                showToast('Реферальне посилання скопійовано в буфер обміну!');
                            })
                            .catch(err => {
                                console.error('Помилка копіювання: ', err);
                                showToast('Помилка копіювання посилання.');
                            });
                    } else {
                        showToast('Не вдалося отримати реферальне посилання');
                    }
                } else {
                    showToast('Реферальна система недоступна');
                }
            });
        }
    });

    // Оновлення прогресу реферальних завдань
    updateReferralProgress();
}

// Оновлення прогресу реферальних завдань
function updateReferralProgress() {
    try {
        if (typeof referralSystem !== 'undefined' && referralSystem.getCurrentUserStats) {
            const stats = referralSystem.getCurrentUserStats();

            if (stats && stats.totalReferrals !== undefined) {
                const referralCount = stats.totalReferrals || 0;

                // Оновлюємо прогрес для кожного реферального завдання
                updateReferralTaskProgress('invite-friends', referralCount, 5, 300);
                updateReferralTaskProgress('invite-friends-10', referralCount, 10, 700);
                updateReferralTaskProgress('invite-friends-25', referralCount, 25, 1500);
                updateReferralTaskProgress('invite-friends-100', referralCount, 100, 5000);

                // Сортуємо завдання після оновлення прогресу
                sortCompletedTasksToBottom();
            }
        }
    } catch (error) {
        console.error('Помилка при оновленні прогресу рефералів:', error);
    }
}

// Оновлення прогресу для конкретного реферального завдання
function updateReferralTaskProgress(buttonId, currentCount, targetCount, reward) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    const taskItem = button.closest('.task-item');
    if (!taskItem) return;

    // Ключ для перевірки чи завдання вже виконано
    const completedKey = `referral_task_${targetCount}_completed`;

    // Якщо завдання вже виконано, застосовуємо стилі і виходимо
    if (localStorage.getItem(completedKey) === 'true') {
        // Додаємо клас для виконаних завдань
        taskItem.classList.add('completed-task');

        // Ховаємо кнопку
        button.style.display = 'none';

        // Показуємо позначку "Виконано"
        const completedLabel = taskItem.querySelector('.completed-label');
        if (completedLabel) {
            completedLabel.style.display = 'block';
        }

        return;
    }

    // Оновлюємо текст прогресу
    const progressText = taskItem.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = `${currentCount}/${targetCount} друзів запрошено`;
    }

    // Оновлюємо шкалу прогресу
    const progressFill = taskItem.querySelector('.progress-fill');
    if (progressFill) {
        const percentage = Math.min((currentCount / targetCount) * 100, 100);
        progressFill.style.width = `${percentage}%`;
    }

    // Якщо завдання виконано, але винагорода ще не отримана
    if (currentCount >= targetCount && localStorage.getItem(completedKey) !== 'true') {
        // Нараховуємо винагороду
        if (typeof rewardSystem !== 'undefined') {
            rewardSystem.addTokens(reward)
                .then(() => {
                    showToast(`Вітаємо! Отримано ${reward} $WINIX за запрошення ${targetCount} друзів`);

                    // Позначаємо завдання як виконане
                    localStorage.setItem(completedKey, 'true');

                    // Ховаємо кнопку
                    button.style.display = 'none';

                    // Показуємо позначку "Виконано"
                    const completedLabel = taskItem.querySelector('.completed-label');
                    if (completedLabel) {
                        completedLabel.style.display = 'block';
                    }

                    // Додаємо клас для виконаних завдань
                    taskItem.classList.add('completed-task');

                    // Перебудовуємо порядок завдань
                    sortCompletedTasksToBottom();
                })
                .catch(error => {
                    console.error('Помилка нарахування винагороди:', error);
                });
        }
    }
}

// Відмітка завдання як виконаного
function applyCompletedTaskStyle(taskItem, subscribeBtn, verifyBtn) {
    if (!taskItem) return;

    // Додаємо клас для виконаних завдань
    taskItem.classList.add('completed-task');

    // Вимикаємо кнопки
    if (subscribeBtn) {
        subscribeBtn.disabled = true;
        subscribeBtn.style.display = 'none';
    }

    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.style.display = 'none';
    }

    // Показуємо позначку "Виконано"
    const taskAction = taskItem.querySelector('.task-action');
    if (taskAction) {
        const completedLabel = taskAction.querySelector('.completed-label');
        if (completedLabel) {
            completedLabel.style.display = 'block';
        }
    }
}

// Сортування завдань - виконані переміщуємо в кінець
function sortCompletedTasksToBottom() {
    // Знаходимо всі контейнери завдань
    const taskContainers = document.querySelectorAll('.task-container');

    taskContainers.forEach(container => {
        // Отримуємо всі завдання
        const tasks = Array.from(container.querySelectorAll('.task-item'));

        // Розділяємо завдання на виконані і невиконані
        const completedTasks = tasks.filter(task => task.classList.contains('completed-task'));
        const incompleteTasks = tasks.filter(task => !task.classList.contains('completed-task'));

        // Видаляємо всі завдання з контейнера
        tasks.forEach(task => task.remove());

        // Додаємо спочатку невиконані завдання
        incompleteTasks.forEach(task => {
            container.appendChild(task);
        });

        // Потім додаємо виконані завдання
        completedTasks.forEach(task => {
            container.appendChild(task);
        });
    });
}

// Перемикання між вкладками
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Змінюємо активну вкладку
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Показуємо відповідний контент
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            const contentSection = document.getElementById(`${tabId}-content`);
            if (contentSection) {
                contentSection.classList.add('active');

                // Після переключення вкладки, сортуємо завдання
                setTimeout(() => {
                    sortCompletedTasksToBottom();
                }, 100);
            }
        });
    });
}

// Обробники для навігаційної панелі
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            console.log(`Перехід до секції: ${section}`);

            if (section === 'home') {
                navigateTo('index.html');
            } else if (section === 'earn') {
                // Вже на сторінці earn, нічого не робимо
                console.log('Вже на сторінці Earn');
            } else if (section === 'referrals') {
                navigateTo('referrals.html');
            } else if (section === 'wallet') {
                navigateTo('wallet.html');
            } else if (section === 'general') {
                navigateTo('general.html');
            }
        });
    });
}

// Ініціалізація сторінки
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded: Ініціалізація сторінки Earn");

    // Додаємо стилі для виконаних завдань
    addCompletedTasksStyles();

    // Оновлюємо відображення балансу
    if (typeof rewardSystem !== 'undefined') {
        rewardSystem.updateBalanceDisplay();
    } else {
        console.error("RewardSystem не знайдено! Перевірте підключення RewardSystem.js");
    }

    // Налаштовуємо функціонал сторінки
    setupDailyBonus();
    setupSocialTasks();
    setupReferralTasks();
    setupTabSwitching();
    setupNavigation();

    // Сортуємо завдання при завантаженні сторінки
    setTimeout(() => {
        sortCompletedTasksToBottom();
    }, 500);

    // Періодичне оновлення балансу та прогресу
    setInterval(() => {
        if (typeof rewardSystem !== 'undefined') {
            rewardSystem.updateBalanceDisplay();
        }
        updateReferralProgress();
    }, 30000); // Оновлення кожні 30 секунд
});