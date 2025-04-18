// ===== ІНІЦІАЛІЗАЦІЯ І ГЛОБАЛЬНІ ЗМІННІ =====
let telegramId = null;
let authToken = null;
let activeRaffles = [];
let userRaffles = [];
let rafflesToShow = [];
let rafflePrizeMultipliers = {'WINIX': 1, 'USD': 28, 'EUR': 30};
let activeTimers = {};
let currentTab = 'active';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
const REFRESH_INTERVAL = 60000; // 60 секунд для оновлення даних

// ===== TELEGRAM WEBAPP ІНТЕГРАЦІЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔄 Ініціалізація сторінки розіграшів...");
    initTelegramWebApp();

    // Ініціалізуємо інтерфейс
    setupTabSwitching();
    createParticles();
    setupEventListeners();

    // Запускаємо автоматичне оновлення даних
    setInterval(refreshActiveRaffles, REFRESH_INTERVAL);
});

function initTelegramWebApp() {
    console.log("🔄 Перевірка Telegram WebApp...");

    if (window.Telegram && window.Telegram.WebApp) {
        try {
            // Ініціалізуємо Telegram WebApp
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();

            // Отримуємо ID користувача
            if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                console.log("✅ Отримано Telegram ID:", telegramId);

                // Зберігаємо ID в DOM та localStorage
                document.getElementById('user-id').textContent = telegramId;
                localStorage.setItem('telegram_user_id', telegramId);

                // Встановлюємо ID для відображення
                const userIdElement = document.getElementById('header-user-id');
                if (userIdElement) {
                    userIdElement.textContent = telegramId;
                }

                // Завантажуємо дані користувача та розіграші
                loadUserData();
                loadActiveRaffles();
            } else {
                console.warn("⚠️ Дані користувача відсутні в Telegram WebApp");
                tryGetUserIdFromAlternativeSources();
            }
        } catch (e) {
            console.error("❌ Помилка ініціалізації Telegram WebApp:", e);
            tryGetUserIdFromAlternativeSources();
        }
    } else {
        console.warn("⚠️ Telegram WebApp API не виявлено. Спроба використання альтернативних джерел.");
        tryGetUserIdFromAlternativeSources();
    }
}

function tryGetUserIdFromAlternativeSources() {
    // Спроба отримання ID з localStorage
    telegramId = localStorage.getItem('telegram_user_id');

    if (telegramId) {
        console.log("✅ Отримано ID із localStorage:", telegramId);
        document.getElementById('header-user-id').textContent = telegramId;

        // Завантажуємо дані користувача та розіграші
        loadUserData();
        loadActiveRaffles();
        return;
    }

    // Спроба отримання з URL-параметрів
    const urlParams = new URLSearchParams(window.location.search);
    telegramId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');

    if (telegramId) {
        console.log("✅ Отримано ID з URL-параметрів:", telegramId);
        localStorage.setItem('telegram_user_id', telegramId);
        document.getElementById('header-user-id').textContent = telegramId;

        // Завантажуємо дані користувача та розіграші
        loadUserData();
        loadActiveRaffles();
        return;
    }

    // Якщо всі варіанти не спрацювали, показуємо повідомлення про помилку
    showToast("Не вдалося визначити ID користувача. Спробуйте оновити сторінку.", "error");
}

// ===== ЗАВАНТАЖЕННЯ ДАНИХ =====
function loadUserData() {
    if (!telegramId) {
        console.error("❌ Відсутній ID користувача для завантаження даних.");
        return;
    }

    // Завантажуємо дані балансу користувача
    fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}/init_data`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Оновлюємо відображення балансу
            document.getElementById('user-coins').textContent = data.data.coins || 0;
            document.getElementById('user-tokens').textContent = data.data.balance || 0;

            // Зберігаємо дані в localStorage для швидкого доступу
            localStorage.setItem('userCoins', data.data.coins);
            localStorage.setItem('userTokens', data.data.balance);

            // Встановлюємо першу літеру імені користувача в аватарі
            const avatar = document.getElementById('profile-avatar');
            if (avatar && data.data.username) {
                avatar.textContent = data.data.username.charAt(0).toUpperCase();
            }

            console.log("✅ Дані користувача завантажено успішно.");
        } else {
            console.warn("⚠️ Помилка завантаження даних користувача:", data.message);

            // Використовуємо збережені дані з localStorage, якщо вони є
            const savedCoins = localStorage.getItem('userCoins');
            const savedTokens = localStorage.getItem('userTokens');

            if (savedCoins) document.getElementById('user-coins').textContent = savedCoins;
            if (savedTokens) document.getElementById('user-tokens').textContent = savedTokens;
        }

        // Завантажуємо список розіграшів, у яких бере участь користувач
        loadUserRaffles();
    })
    .catch(error => {
        console.error("❌ Помилка запиту даних користувача:", error);

        // Використовуємо збережені дані з localStorage, якщо вони є
        const savedCoins = localStorage.getItem('userCoins');
        const savedTokens = localStorage.getItem('userTokens');

        if (savedCoins) document.getElementById('user-coins').textContent = savedCoins;
        if (savedTokens) document.getElementById('user-tokens').textContent = savedTokens;

        // Завантажуємо список розіграшів, у яких бере участь користувач
        loadUserRaffles();
    });
}

function loadActiveRaffles() {
    if (!telegramId) {
        console.error("❌ Відсутній ID користувача для завантаження розіграшів.");
        return;
    }

    showLoadingIndicator();

    // Завантажуємо активні розіграші
    fetchWithAuth(`${API_BASE_URL}/api/raffles`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingIndicator();

        if (data.status === 'success') {
            activeRaffles = data.data || [];
            console.log("✅ Активні розіграші завантажено:", activeRaffles.length);

            // Розділяємо розіграші на головний і міні
            processActiveRaffles();
        } else {
            console.warn("⚠️ Помилка завантаження активних розіграшів:", data.message);
            showToast("Не вдалося завантажити розіграші. Спробуйте пізніше.", "error");

            // Очищаємо контейнери розіграшів
            document.getElementById('main-raffle-container').innerHTML = `
                <div class="alert alert-warning">
                    <p>Не вдалося завантажити дані розіграшів. Спробуйте пізніше.</p>
                </div>
            `;
            document.getElementById('mini-raffles-container').innerHTML = '';
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        console.error("❌ Помилка запиту активних розіграшів:", error);

        // Показуємо повідомлення про помилку
        document.getElementById('main-raffle-container').innerHTML = `
            <div class="alert alert-error">
                <p>Помилка з'єднання з сервером. Перевірте підключення до інтернету.</p>
            </div>
        `;
        document.getElementById('mini-raffles-container').innerHTML = '';
    });
}

function loadUserRaffles() {
    if (!telegramId) {
        console.error("❌ Відсутній ID користувача для завантаження розіграшів користувача.");
        return;
    }

    // Завантажуємо розіграші, у яких бере участь користувач
    fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}/raffles`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            userRaffles = data.data || [];
            console.log("✅ Розіграші користувача завантажено:", userRaffles.length);

            // Оновлюємо відображення активних розіграшів, якщо вони вже завантажені
            if (activeRaffles.length > 0) {
                processActiveRaffles();
            }

            // Завантажуємо історію розіграшів
            if (currentTab === 'past') {
                loadRafflesHistory();
            }

            // Завантажуємо статистику
            if (currentTab === 'stats') {
                loadStatistics();
            }
        } else {
            console.warn("⚠️ Помилка завантаження розіграшів користувача:", data.message);
        }
    })
    .catch(error => {
        console.error("❌ Помилка запиту розіграшів користувача:", error);
    });
}

function loadRafflesHistory() {
    if (!telegramId) {
        console.error("❌ Відсутній ID користувача для завантаження історії розіграшів.");
        return;
    }

    showLoadingIndicator();

    // Завантажуємо історію розіграшів
    fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}/raffles-history`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingIndicator();

        if (data.status === 'success') {
            const historyData = data.data || [];
            console.log("✅ Історія розіграшів завантажена:", historyData.length);

            // Відображаємо історію розіграшів
            renderRafflesHistory(historyData);
        } else {
            console.warn("⚠️ Помилка завантаження історії розіграшів:", data.message);

            // Показуємо повідомлення про помилку
            document.getElementById('history-container').innerHTML = `
                <div class="alert alert-warning">
                    <p>Не вдалося завантажити історію розіграшів. Спробуйте пізніше.</p>
                </div>
            `;
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        console.error("❌ Помилка запиту історії розіграшів:", error);

        // Показуємо повідомлення про помилку
        document.getElementById('history-container').innerHTML = `
            <div class="alert alert-error">
                <p>Помилка з'єднання з сервером. Перевірте підключення до інтернету.</p>
            </div>
        `;
    });
}

function loadStatistics() {
    if (!telegramId) {
        console.error("❌ Відсутній ID користувача для завантаження статистики.");
        return;
    }

    // Використаємо дані з профілю користувача для відображення статистики
    fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const userData = data.data || {};
            console.log("✅ Дані для статистики завантажено");

            // Оновлюємо статистику
            document.getElementById('total-participated').textContent = userData.participations_count || 0;
            document.getElementById('total-wins').textContent = userData.wins_count || 0;

            // Якщо є дані про виграні токени та витрачені жетони, відображаємо їх
            // В іншому випадку, залишаємо значення за замовчуванням

            // Додаткові запити для отримання транзакцій можна зробити тут
            // Наприклад, можна отримати суму виграшів і витрат за транзакціями
            fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}/transactions?limit=1000`, {
                method: 'GET'
            })
            .then(response => response.json())
            .then(txData => {
                if (txData.status === 'success') {
                    const transactions = txData.data || [];

                    // Розрахунок суми виграшів
                    const totalWinix = transactions
                        .filter(tx => tx.type === 'prize')
                        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

                    // Розрахунок витрачених жетонів
                    const totalSpent = transactions
                        .filter(tx => tx.type === 'fee')
                        .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

                    document.getElementById('total-winix-won').textContent = totalWinix.toFixed(0);
                    document.getElementById('total-tokens-spent').textContent = totalSpent.toFixed(0);
                }
            })
            .catch(error => {
                console.warn("⚠️ Помилка завантаження транзакцій для статистики:", error);
            });
        } else {
            console.warn("⚠️ Помилка завантаження даних для статистики:", data.message);
        }
    })
    .catch(error => {
        console.error("❌ Помилка запиту даних для статистики:", error);
    });
}

function refreshActiveRaffles() {
    // Оновлюємо дані лише якщо активна вкладка активних розіграшів
    if (currentTab === 'active') {
        console.log("🔄 Автоматичне оновлення активних розіграшів...");
        loadActiveRaffles();
    }
}

// ===== ОБРОБКА ДАНИХ =====
function processActiveRaffles() {
    // Спочатку очищаємо всі таймери
    clearAllTimers();

    // Якщо немає активних розіграшів, показуємо повідомлення
    if (!activeRaffles || activeRaffles.length === 0) {
        console.log("ℹ️ Активні розіграші відсутні");
        document.getElementById('main-raffle-container').innerHTML = `
            <div class="alert alert-info">
                <p>На даний момент немає активних розіграшів. Перевірте пізніше.</p>
            </div>
        `;
        document.getElementById('mini-raffles-container').innerHTML = '';
        return;
    }

    // Розділяємо розіграші на щоденні та основні
    const dailyRaffles = activeRaffles.filter(raffle => raffle.is_daily);
    const mainRaffles = activeRaffles.filter(raffle => !raffle.is_daily);

    console.log(`ℹ️ Знайдено ${mainRaffles.length} основних та ${dailyRaffles.length} щоденних розіграшів`);

    // Вибираємо головний розіграш
    let mainRaffle = null;

    if (mainRaffles.length > 0) {
        // Вибираємо розіграш з найбільшою сумою призу
        mainRaffle = mainRaffles.reduce((prev, current) => {
            const prevValue = prev.prize_amount * (rafflePrizeMultipliers[prev.prize_currency] || 1);
            const currentValue = current.prize_amount * (rafflePrizeMultipliers[current.prize_currency] || 1);
            return currentValue > prevValue ? current : prev;
        }, mainRaffles[0]);
    } else if (dailyRaffles.length > 0) {
        // Якщо немає основних розіграшів, вибираємо щоденний з найбільшою сумою призу
        mainRaffle = dailyRaffles.reduce((prev, current) => {
            const prevValue = prev.prize_amount * (rafflePrizeMultipliers[prev.prize_currency] || 1);
            const currentValue = current.prize_amount * (rafflePrizeMultipliers[current.prize_currency] || 1);
            return currentValue > prevValue ? current : prev;
        }, dailyRaffles[0]);
    }

    // Рендеримо головний розіграш
    if (mainRaffle) {
        renderMainRaffle(mainRaffle);
    } else {
        document.getElementById('main-raffle-container').innerHTML = `
            <div class="alert alert-info">
                <p>На даний момент немає активних розіграшів. Перевірте пізніше.</p>
            </div>
        `;
    }

    // Фільтруємо розіграші для міні-блоків (без головного)
    const miniRaffles = activeRaffles.filter(raffle => raffle.id !== (mainRaffle ? mainRaffle.id : null));

    // Рендеримо міні-розіграші
    renderMiniRaffles(miniRaffles);
}

// ===== РЕНДЕРИНГ ІНТЕРФЕЙСУ =====
function renderMainRaffle(raffle) {
    // Перевіряємо, чи бере користувач участь у цьому розіграші
    const userParticipation = userRaffles.find(ur => ur.raffle_id === raffle.id);
    const isParticipating = !!userParticipation;
    const entryCount = userParticipation ? userParticipation.entry_count : 0;

    // Вираховуємо решту часу
    const now = Date.now();
    const endTime = raffle.end_time;
    const timeLeft = Math.max(0, endTime - now);

    // Створюємо HTML для основного розіграшу
    let html = `
        <img src="${raffle.image_url || 'assets/raffle-default.jpg'}" alt="${raffle.title}" class="main-raffle-image">
        <div class="main-raffle-content">
            <div class="main-raffle-header">
                <h3 class="main-raffle-title">${raffle.title}</h3>
                <div class="main-raffle-cost">
                    <img src="assets/token-icon.png" alt="Жетон" class="token-icon">
                    ${raffle.entry_fee}
                </div>
            </div>
            <p>${raffle.description || 'Приймайте участь у розіграші та вигравайте призи!'}</p>
            <div class="main-raffle-prize">Приз: ${raffle.prize_amount} ${raffle.prize_currency}</div>
            
            <div class="timer-container" id="timer-${raffle.id}">
                <div class="timer-block">
                    <div class="timer-value" id="days-${raffle.id}">0</div>
                    <div class="timer-label">Днів</div>
                </div>
                <div class="timer-block">
                    <div class="timer-value" id="hours-${raffle.id}">0</div>
                    <div class="timer-label">Годин</div>
                </div>
                <div class="timer-block">
                    <div class="timer-value" id="minutes-${raffle.id}">0</div>
                    <div class="timer-label">Хвилин</div>
                </div>
                <div class="timer-block">
                    <div class="timer-value" id="seconds-${raffle.id}">0</div>
                    <div class="timer-label">Секунд</div>
                </div>
            </div>
            
            <div class="main-raffle-participants">
                <span class="participants-info">Учасників: <span class="participants-count">${raffle.participants_count || 0}</span></span>
                <span>Переможців: ${raffle.winners_count}</span>
            </div>
            
            <div class="progress-bar">
                <div class="progress" style="width: ${Math.min(100, (raffle.participants_count / 100) * 100)}%"></div>
            </div>
    `;

    // Додаємо кнопку з відповідним станом
    const userCoins = parseInt(document.getElementById('user-coins').textContent) || 0;
    const canJoin = userCoins >= raffle.entry_fee;

    if (isParticipating) {
        html += `
            <button class="join-button participating" disabled>
                Ви берете участь (${entryCount} ${entryCount === 1 ? 'жетон' : (entryCount < 5 ? 'жетони' : 'жетонів')})
            </button>
        `;
    } else if (!canJoin) {
        html += `
            <button class="join-button disabled" disabled>
                Недостатньо жетонів (потрібно ${raffle.entry_fee})
            </button>
        `;
    } else {
        html += `
            <button class="join-button" data-raffle-id="${raffle.id}" data-entry-fee="${raffle.entry_fee}" 
                onclick="participateInRaffle(this, '${raffle.id}', ${raffle.entry_fee})">
                Взяти участь
            </button>
        `;
    }

    html += `</div>`;

    // Оновлюємо контейнер головного розіграшу
    document.getElementById('main-raffle-container').innerHTML = html;

    // Запускаємо таймер для розіграшу
    startTimer(raffle.id, timeLeft);
}

function renderMiniRaffles(raffles) {
    if (!raffles || raffles.length === 0) {
        document.getElementById('mini-raffles-container').innerHTML = `
            <div class="alert alert-info">
                <p>Немає доступних щоденних розіграшів.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Створюємо HTML для кожного міні-розіграшу
    raffles.forEach(raffle => {
        // Перевіряємо, чи бере користувач участь у цьому розіграші
        const userParticipation = userRaffles.find(ur => ur.raffle_id === raffle.id);
        const isParticipating = !!userParticipation;
        const entryCount = userParticipation ? userParticipation.entry_count : 0;

        // Вираховуємо решту часу
        const now = Date.now();
        const endTime = raffle.end_time;
        const timeLeft = Math.max(0, endTime - now);

        // Створюємо HTML для міні-розіграшу
        html += `
            <div class="mini-raffle" data-raffle-id="${raffle.id}">
                <div class="mini-raffle-info">
                    <h3 class="mini-raffle-title">${raffle.title}</h3>
                    <div class="mini-raffle-cost">
                        <img src="assets/token-icon.png" alt="Жетон" class="token-icon">
                        ${raffle.entry_fee}
                    </div>
                    <div class="mini-raffle-prize">Приз: ${raffle.prize_amount} ${raffle.prize_currency}</div>
                    <div class="mini-raffle-time" id="mini-time-${raffle.id}">
                        Залишилось: ${formatTimeLeft(timeLeft)}
                    </div>
                </div>
        `;

        // Додаємо кнопку з відповідним станом
        const userCoins = parseInt(document.getElementById('user-coins').textContent) || 0;
        const canJoin = userCoins >= raffle.entry_fee;

        if (isParticipating) {
            html += `
                <button class="mini-raffle-button participating" disabled>
                    Участь (${entryCount})
                </button>
            `;
        } else if (!canJoin) {
            html += `
                <button class="mini-raffle-button disabled" disabled>
                    Недостатньо
                </button>
            `;
        } else {
            html += `
                <button class="mini-raffle-button" data-raffle-id="${raffle.id}" data-entry-fee="${raffle.entry_fee}" 
                    onclick="participateInRaffle(this, '${raffle.id}', ${raffle.entry_fee})">
                    Взяти участь
                </button>
            `;
        }

        html += `</div>`;

        // Запускаємо таймер для міні-розіграшу
        setTimeout(() => {
            startMiniTimer(raffle.id, timeLeft);
        }, 100);
    });

    // Оновлюємо контейнер міні-розіграшів
    document.getElementById('mini-raffles-container').innerHTML = html;
}

function renderRafflesHistory(historyData) {
    if (!historyData || historyData.length === 0) {
        document.getElementById('history-container').innerHTML = `
            <div class="alert alert-info">
                <p>Ви ще не брали участі в розіграшах. Перегляньте вкладку "Активні" для участі.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Сортуємо історію від найновіших до найстаріших
    historyData.sort((a, b) => {
        const dateA = new Date(a.date.split('.').reverse().join('-'));
        const dateB = new Date(b.date.split('.').reverse().join('-'));
        return dateB - dateA;
    });

    // Створюємо HTML для кожного запису історії
    historyData.forEach(item => {
        const statusClass = item.status === 'won' ? 'won' : 'participated';
        const statusText = item.status === 'won' ? 'Виграш' : 'Участь';

        html += `
            <div class="history-card ${statusClass}" data-raffle-id="${item.raffle_id}">
                <div class="history-date">${item.date}</div>
                <div class="history-prize">${item.title}</div>
                <div class="history-prize">Приз: ${item.prize}</div>
                <div class="history-winners">${item.result}</div>
                <div class="history-status ${statusClass}">${statusText}</div>
                <div class="view-details-hint">Натисніть для деталей</div>
            </div>
        `;
    });

    // Оновлюємо контейнер історії
    document.getElementById('history-container').innerHTML = html;

    // Додаємо обробники подій для відкриття деталей
    document.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', () => {
            const raffleId = card.dataset.raffleId;
            if (raffleId) {
                showRaffleDetails(raffleId);
            }
        });
    });
}

function showRaffleDetails(raffleId) {
    console.log(`ℹ️ Відкриття деталей розіграшу ${raffleId}`);
    showLoadingIndicator();

    // Завантажуємо деталі розіграшу
    fetchWithAuth(`${API_BASE_URL}/api/raffles/${raffleId}`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingIndicator();

        if (data.status === 'success') {
            const raffleDetails = data.data;

            // Формуємо HTML для модального вікна з деталями
            // Якщо ваш проект використовує модальні вікна, тут можна додати код для їх відображення
            // В даному випадку, покажемо деталі в спливаючому повідомленні

            let detailsMessage = `
                ${raffleDetails.title}
                Приз: ${raffleDetails.prize_amount} ${raffleDetails.prize_currency}
                Статус: ${raffleDetails.status === 'active' ? 'Активний' : 'Завершений'}
            `;

            if (raffleDetails.winners && raffleDetails.winners.length > 0) {
                detailsMessage += `\nПереможці:\n`;
                raffleDetails.winners.forEach(winner => {
                    detailsMessage += `${winner.place} місце: ${winner.username} (${winner.prize_amount} ${winner.prize_currency})\n`;
                });
            }

            // Використовуємо Telegram WebApp ShowPopup для відображення деталей
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showPopup(
                    {
                        title: 'Деталі розіграшу',
                        message: detailsMessage,
                        buttons: [{type: 'close'}]
                    }
                );
            } else {
                // Якщо Telegram WebApp недоступний, використовуємо звичайне повідомлення
                showToast('Деталі недоступні. Перегляньте в Telegram.', 'info');
            }
        } else {
            console.warn("⚠️ Помилка завантаження деталей розіграшу:", data.message);
            showToast("Не вдалося завантажити деталі розіграшу", "error");
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        console.error("❌ Помилка запиту деталей розіграшу:", error);
        showToast("Помилка з'єднання з сервером", "error");
    });
}

// ===== УПРАВЛІННЯ ТАЙМЕРАМИ =====
function startTimer(raffleId, duration) {
    if (activeTimers[raffleId]) {
        clearInterval(activeTimers[raffleId]);
    }

    const timer = setInterval(() => {
        const days = document.getElementById(`days-${raffleId}`);
        const hours = document.getElementById(`hours-${raffleId}`);
        const minutes = document.getElementById(`minutes-${raffleId}`);
        const seconds = document.getElementById(`seconds-${raffleId}`);

        if (!days || !hours || !minutes || !seconds) {
            clearInterval(timer);
            delete activeTimers[raffleId];
            return;
        }

        const now = Date.now();
        const endTime = now + duration - 1000; // Віднімаємо 1 секунду, щоб компенсувати затримку функції
        const timeLeft = Math.max(0, endTime - now);

        // Якщо час закінчився, оновлюємо розіграші
        if (timeLeft <= 0) {
            clearInterval(timer);
            delete activeTimers[raffleId];

            // Перезавантажуємо дані
            loadActiveRaffles();
            return;
        }

        // Оновлюємо таймер
        const timeValues = calculateTimeLeft(timeLeft);
        days.textContent = timeValues.days;
        hours.textContent = timeValues.hours;
        minutes.textContent = timeValues.minutes;
        seconds.textContent = timeValues.seconds;
    }, 1000);

    // Зберігаємо таймер для подальшого очищення
    activeTimers[raffleId] = timer;

    // Запускаємо таймер одразу
    const timeValues = calculateTimeLeft(duration);
    document.getElementById(`days-${raffleId}`).textContent = timeValues.days;
    document.getElementById(`hours-${raffleId}`).textContent = timeValues.hours;
    document.getElementById(`minutes-${raffleId}`).textContent = timeValues.minutes;
    document.getElementById(`seconds-${raffleId}`).textContent = timeValues.seconds;
}

function startMiniTimer(raffleId, duration) {
    if (activeTimers[`mini-${raffleId}`]) {
        clearInterval(activeTimers[`mini-${raffleId}`]);
    }

    const timer = setInterval(() => {
        const timeElement = document.getElementById(`mini-time-${raffleId}`);

        if (!timeElement) {
            clearInterval(timer);
            delete activeTimers[`mini-${raffleId}`];
            return;
        }

        const now = Date.now();
        const endTime = now + duration - 1000; // Віднімаємо 1 секунду, щоб компенсувати затримку функції
        const timeLeft = Math.max(0, endTime - now);

        // Якщо час закінчився, оновлюємо розіграші
        if (timeLeft <= 0) {
            clearInterval(timer);
            delete activeTimers[`mini-${raffleId}`];

            // Перезавантажуємо дані
            loadActiveRaffles();
            return;
        }

        // Оновлюємо текст таймера
        timeElement.textContent = `Залишилось: ${formatTimeLeft(timeLeft)}`;
    }, 1000);

    // Зберігаємо таймер для подальшого очищення
    activeTimers[`mini-${raffleId}`] = timer;

    // Запускаємо таймер одразу
    const timeElement = document.getElementById(`mini-time-${raffleId}`);
    if (timeElement) {
        timeElement.textContent = `Залишилось: ${formatTimeLeft(duration)}`;
    }
}

function clearAllTimers() {
    // Очищуємо всі активні таймери
    Object.keys(activeTimers).forEach(key => {
        clearInterval(activeTimers[key]);
        delete activeTimers[key];
    });
}

function calculateTimeLeft(duration) {
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);

    return {
        days: days.toString().padStart(2, '0'),
        hours: hours.toString().padStart(2, '0'),
        minutes: minutes.toString().padStart(2, '0'),
        seconds: seconds.toString().padStart(2, '0')
    };
}

function formatTimeLeft(duration) {
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}д ${hours}г`;
    } else if (hours > 0) {
        return `${hours}г ${minutes}хв`;
    } else {
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        return `${minutes}хв ${seconds}с`;
    }
}

// ===== УЧАСТЬ В РОЗІГРАШАХ =====
function participateInRaffle(button, raffleId, entryFee) {
    if (!telegramId) {
        showToast("Помилка авторизації. Спробуйте оновити сторінку.", "error");
        return;
    }

    // Перевіряємо, чи достатньо жетонів
    const userCoins = parseInt(document.getElementById('user-coins').textContent) || 0;
    if (userCoins < entryFee) {
        showToast(`Недостатньо жетонів. Потрібно: ${entryFee}`, "error");
        return;
    }

    // Деактивуємо кнопку, щоб уникнути подвійних кліків
    button.disabled = true;
    button.textContent = "Обробка...";
    showLoadingIndicator();

    // Відправляємо запит на участь у розіграші
    fetchWithAuth(`${API_BASE_URL}/api/user/${telegramId}/participate-raffle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            raffle_id: raffleId,
            entry_count: 1
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingIndicator();

        if (data.status === 'success') {
            console.log("✅ Успішна участь у розіграші:", data);

            // Оновлюємо баланс жетонів
            document.getElementById('user-coins').textContent = data.data.new_coins_balance || (userCoins - entryFee);

            // Оновлюємо кнопку
            button.classList.add('participating');
            button.disabled = true;
            button.textContent = 'Ви берете участь';

            // Показуємо повідомлення про успіх
            showToast("Ви успішно взяли участь у розіграші!", "success");

            // Оновлюємо списки розіграшів
            loadUserRaffles();

            // Якщо це був основний розіграш, оновлюємо кількість учасників
            const raffleElement = document.querySelector(`[data-raffle-id="${raffleId}"]`);
            if (raffleElement) {
                const participantsCountElement = raffleElement.querySelector('.participants-count');
                if (participantsCountElement) {
                    const currentCount = parseInt(participantsCountElement.textContent) || 0;
                    participantsCountElement.textContent = currentCount + 1;
                }
            }
        } else {
            console.warn("⚠️ Помилка участі в розіграші:", data.message);

            // Відновлюємо кнопку
            button.disabled = false;
            button.textContent = 'Взяти участь';

            // Показуємо повідомлення про помилку
            showToast(data.message || "Не вдалося взяти участь у розіграші", "error");
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        console.error("❌ Помилка запиту участі в розіграші:", error);

        // Відновлюємо кнопку
        button.disabled = false;
        button.textContent = 'Взяти участь';

        // Показуємо повідомлення про помилку
        showToast("Помилка з'єднання з сервером. Спробуйте ще раз.", "error");
    });
}

// ===== UI УТІЛІТИ =====
function setupTabSwitching() {
    // Додаємо обробники подій для вкладок
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            // Змінюємо активну вкладку
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Змінюємо видимість вмісту вкладок
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-raffles`).classList.add('active');

            // Зберігаємо поточну вкладку
            currentTab = tabId;

            // Завантажуємо дані для вкладки
            if (tabId === 'active') {
                loadActiveRaffles();
                loadUserRaffles();
            } else if (tabId === 'past') {
                loadRafflesHistory();
            } else if (tabId === 'stats') {
                loadStatistics();
            }
        });
    });
}

function createParticles() {
    // Створюємо частинки для кожного заголовка секції
    document.querySelectorAll('.particles-container').forEach(container => {
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');

            // Випадкові розміри та позиції
            const size = Math.random() * 10 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;

            // Випадкова затримка анімації
            particle.style.animationDelay = `${Math.random() * 5}s`;

            container.appendChild(particle);
        }
    });
}

function setupEventListeners() {
    // Додаємо обробники подій для навігаційних елементів
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            console.log(`🔄 Перехід до розділу: ${section}`);

            // Якщо використовується Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                // Відкриття іншої сторінки через Telegram WebApp
                window.Telegram.WebApp.openTelegramLink(`https://t.me/winix_bot?start=${section}`);
            }
        });
    });

    // Додаємо обробник для закриття toast-повідомлень
    document.getElementById('toast-message').addEventListener('click', () => {
        hideToast();
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-message');
    toast.textContent = message;
    toast.className = 'toast-message';

    // Додаємо клас для типу повідомлення
    if (type === 'success') {
        toast.classList.add('success');
    } else if (type === 'error') {
        toast.classList.add('error');
    }

    // Показуємо повідомлення
    toast.classList.add('show');

    // Автоматично приховуємо через 3 секунди
    setTimeout(() => {
        hideToast();
    }, 3000);
}

function hideToast() {
    const toast = document.getElementById('toast-message');
    toast.classList.remove('show');
}

function showLoadingIndicator() {
    document.getElementById('loading-spinner').style.display = 'flex';
}

function hideLoadingIndicator() {
    document.getElementById('loading-spinner').style.display = 'none';
}

// ===== УТІЛІТИ ДЛЯ РОБОТИ З API =====
function fetchWithAuth(url, options = {}) {
    // Додаємо заголовки авторизації, якщо є
    const headers = options.headers || {};

    // Додаємо токен авторизації, якщо є
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Додаємо заголовок користувача
    if (telegramId) {
        headers['X-Telegram-User-Id'] = telegramId;
    }

    // Повертаємо проміс з fetch
    return fetch(url, {
        ...options,
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        }
    }).then(response => {
        // Перевіряємо статус відповіді
        if (!response.ok && response.status === 401) {
            // Якщо помилка авторизації, оновлюємо токен
            return refreshAuthToken().then(() => {
                // Повторюємо запит з новим токеном
                const newHeaders = {
                    ...headers,
                    'Authorization': `Bearer ${authToken}`
                };

                return fetch(url, {
                    ...options,
                    headers: newHeaders
                });
            });
        }

        return response;
    }).catch(error => {
        console.error('Мережева помилка:', error);
        throw error;
    });
}

function refreshAuthToken() {
    // Спроба оновлення токена
    return fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-User-Id': telegramId
        },
        body: JSON.stringify({ telegram_id: telegramId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' && data.token) {
            authToken = data.token;
            console.log('✅ Токен успішно оновлено');
            return true;
        } else {
            console.warn('⚠️ Не вдалося оновити токен:', data.message);
            throw new Error('Failed to refresh token');
        }
    });
}