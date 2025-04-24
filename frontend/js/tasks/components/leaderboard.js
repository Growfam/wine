/**
 * Leaderboard - компонент для відображення таблиці лідерів
 * Відповідає за:
 * - Завантаження даних лідерської дошки
 * - Відображення ТОП користувачів
 * - Підсвічування поточного користувача
 */

window.Leaderboard = (function() {
    // Приватні змінні модуля
    let leaderboardData = [];
    let currentUserId = null;

    // DOM-елементи
    const leaderboardContainer = document.getElementById('leaderboard-container');

    /**
     * Ініціалізація модуля лідерської дошки
     */
    function init() {
        console.log('Ініціалізація Leaderboard...');

        // Отримуємо ID поточного користувача
        currentUserId = getUserId();

        // Завантажуємо дані лідерської дошки
        loadLeaderboardData();

        // Підписуємося на події зміни мови для оновлення текстів
        if (window.WinixLanguage) {
            document.addEventListener('language-changed', function() {
                renderLeaderboard();
            });
        }
    }

    /**
     * Отримання ID поточного користувача
     */
    function getUserId() {
        if (window.WinixAPI && window.WinixAPI.getUserId) {
            return window.WinixAPI.getUserId();
        }
        // Запасний варіант - отримання ID з DOM
        const userIdElement = document.getElementById('user-id');
        return userIdElement ? userIdElement.textContent : null;
    }

    /**
     * Завантаження даних лідерської дошки
     */
    async function loadLeaderboardData() {
        try {
            // Для тестування використовуємо макет даних
            // В реальному проекті тут буде API запит
            // const response = await window.API.get('/leaderboard/referrals');

            // Моковані дані для тестування
            const mockData = getMockLeaderboardData();

            // Обробка успішної відповіді
            leaderboardData = mockData;

            // Відображаємо лідерську дошку
            renderLeaderboard();

            return leaderboardData;
        } catch (error) {
            console.error('Помилка завантаження лідерської дошки:', error);

            // У випадку помилки відображаємо заглушку
            showFallbackLeaderboard();

            return [];
        }
    }

    /**
     * Функція для отримання мокованих даних
     */
    function getMockLeaderboardData() {
        // Генеруємо ID поточного користувача, якщо його немає
        if (!currentUserId) {
            currentUserId = "7066583465";
        }

        // Базовий набір даних
        const mockUsers = [
            { id: "9876543210", username: "CryptoWhale", referrals_count: 153, reward: 7650 },
            { id: "8765432109", username: "TokenMaster", referrals_count: 129, reward: 6450 },
            { id: "7654321098", username: "BlockchainGuru", referrals_count: 112, reward: 5600 },
            { id: "6543210987", username: "CoinHunter", referrals_count: 98, reward: 4900 },
            { id: "5432109876", username: "SatoshiFan", referrals_count: 87, reward: 4350 },
            { id: "4321098765", username: "CryptoKing", referrals_count: 76, reward: 3800 },
            { id: "3210987654", username: "TokenExplorer", referrals_count: 65, reward: 3250 },
            { id: "2109876543", username: "WinixLover", referrals_count: 54, reward: 2700 },
            { id: "1098765432", username: "CryptoNinja", referrals_count: 43, reward: 2150 },
            { id: "1234567890", username: "BlockGenius", referrals_count: 32, reward: 1600 }
        ];

        // Перевіряємо, чи є поточний користувач у списку
        const hasCurrentUser = mockUsers.some(user => user.id === currentUserId);

        // Якщо поточного користувача немає у ТОП-10, додаємо його з випадковою позицією нижче 10
        if (!hasCurrentUser) {
            // Створюємо запис для поточного користувача
            const currentUserEntry = {
                id: currentUserId,
                username: "Ви",
                referrals_count: Math.floor(Math.random() * 30) + 1, // 1-30 рефералів
                reward: Math.floor(Math.random() * 30) * 50, // винагорода
                position: Math.floor(Math.random() * 40) + 11 // позиція 11-50
            };

            // Додаємо до набору даних
            mockUsers.push(currentUserEntry);
        }

        return mockUsers;
    }

    /**
     * Відображення лідерської дошки
     */
    function renderLeaderboard() {
        if (!leaderboardContainer) return;

        // Очищаємо контейнер
        leaderboardContainer.innerHTML = '';

        // Якщо немає даних, показуємо заглушку
        if (!leaderboardData || leaderboardData.length === 0) {
            showFallbackLeaderboard();
            return;
        }

        // Сортуємо за кількістю рефералів
        const sortedData = [...leaderboardData].sort((a, b) => b.referrals_count - a.referrals_count);

        // Відображаємо топ-10 користувачів
        const topUsers = sortedData.slice(0, 10);

        // Визначаємо, чи є поточний користувач у ТОП-10
        const currentUserInTop = topUsers.findIndex(user => user.id === currentUserId);

        // Відображаємо кожного користувача зі списку
        topUsers.forEach((user, index) => {
            const position = index + 1;
            const isCurrentUser = user.id === currentUserId;

            // Створюємо елемент для користувача
            const userElement = createLeaderboardItem(user, position, isCurrentUser);

            // Додаємо до контейнера
            leaderboardContainer.appendChild(userElement);
        });

        // Якщо поточний користувач не входить у ТОП-10, але є в даних,
        // додаємо його окремим рядком в кінці таблиці
        if (currentUserInTop === -1) {
            const currentUser = sortedData.find(user => user.id === currentUserId);

            if (currentUser) {
                // Визначаємо позицію поточного користувача
                const currentUserPosition = sortedData.findIndex(user => user.id === currentUserId) + 1;

                // Додаємо розділювач
                const divider = document.createElement('div');
                divider.className = 'leaderboard-divider';
                divider.textContent = '...';
                leaderboardContainer.appendChild(divider);

                // Створюємо елемент для поточного користувача
                const userElement = createLeaderboardItem(currentUser, currentUserPosition, true);

                // Додаємо до контейнера
                leaderboardContainer.appendChild(userElement);
            }
        }
    }

    /**
     * Створення елементу лідерської дошки для користувача
     */
    function createLeaderboardItem(user, position, isCurrentUser) {
        // Створюємо основний елемент
        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        // Додаємо клас для поточного користувача
        if (isCurrentUser) {
            item.classList.add('current-user');
        }

        // Створюємо елемент позиції
        const positionElement = document.createElement('div');
        positionElement.className = 'position';

        // Додаємо клас для ТОП-3
        if (position <= 3) {
            positionElement.classList.add('top-3');
        }

        positionElement.textContent = position;

        // Створюємо елемент з інформацією про користувача
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';

        // Додаємо ім'я користувача
        const username = document.createElement('div');
        username.className = 'username';
        username.textContent = isCurrentUser ? 'Ви' : user.username;

        // Додаємо кількість рефералів
        const referralCount = document.createElement('div');
        referralCount.className = 'referral-count';

        // Отримуємо локалізований текст, якщо можливо
        let referralsText = `${user.referrals_count} запрошених`;
        if (window.WinixLanguage && window.WinixLanguage.get) {
            // Параметризований текст у форматі шаблонних рядків
            referralsText = window.WinixLanguage.get('earn.leaderboard.referrals_count',
                { count: user.referrals_count }) || referralsText;
        }

        referralCount.textContent = referralsText;

        // Додаємо інформацію про користувача
        userInfo.appendChild(username);
        userInfo.appendChild(referralCount);

        // Створюємо елемент з винагородою
        const userReward = document.createElement('div');
        userReward.className = 'user-reward';
        userReward.textContent = `${user.reward} $WINIX`;

        // Збираємо все до купи
        item.appendChild(positionElement);
        item.appendChild(userInfo);
        item.appendChild(userReward);

        return item;
    }

    /**
     * Відображення заглушки для лідерської дошки
     */
    function showFallbackLeaderboard() {
        if (!leaderboardContainer) return;

        // Очищаємо контейнер
        leaderboardContainer.innerHTML = '';

        // Створюємо заглушку
        const fallbackElement = document.createElement('div');
        fallbackElement.className = 'leaderboard-fallback';

        // Отримуємо локалізований текст, якщо можливо
        let fallbackText = 'Дані лідерської дошки тимчасово недоступні. Спробуйте пізніше.';
        if (window.WinixLanguage && window.WinixLanguage.get) {
            fallbackText = window.WinixLanguage.get('earn.leaderboard.fallback') || fallbackText;
        }

        fallbackElement.textContent = fallbackText;

        // Додаємо до контейнера
        leaderboardContainer.appendChild(fallbackElement);
    }

    /**
     * Оновлення даних лідерської дошки
     */
    function refreshLeaderboard() {
        loadLeaderboardData();
    }

    // Публічний API модуля
    return {
        init,
        loadLeaderboardData,
        renderLeaderboard,
        refreshLeaderboard
    };
})();