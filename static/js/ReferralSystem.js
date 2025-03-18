// ReferralSystem.js - Система управління реферальною програмою
class ReferralSystem {
    constructor() {
        this.initializeReferralData();
    }

    // Ініціалізація даних реферальної системи
    initializeReferralData() {
        // Створення структури даних у localStorage, якщо вона відсутня
        if (!localStorage.getItem('referralData')) {
            const defaultData = {
                users: {},           // Інформація про користувачів
                referralLinks: {},   // Відповідність реферальних кодів до ID користувачів
                linkClicks: {}       // Статистика кліків за реферальними посиланнями
            };
            localStorage.setItem('referralData', JSON.stringify(defaultData));
        }

        if (!localStorage.getItem('currentUser')) {
            localStorage.setItem('currentUser', JSON.stringify({
                id: this.generateUserId(),
                referralCode: this.generateReferralCode(),
                referrerId: null,
                level1Referrals: [],
                level2Referrals: []
            }));
        }
    }

    // Отримання даних реферальної системи
    getReferralData() {
        return JSON.parse(localStorage.getItem('referralData'));
    }

    // Збереження даних реферальної системи
    saveReferralData(data) {
        localStorage.setItem('referralData', JSON.stringify(data));
    }

    // Отримання даних поточного користувача
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('currentUser'));
    }

    // Збереження даних поточного користувача
    saveCurrentUser(userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
    }

    // Генерація унікального ID користувача
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    // Генерація унікального реферального коду
    generateReferralCode() {
        const prefix = 'ref';
        const randomPart = Math.random().toString(36).substr(2, 6);
        const timestamp = Date.now().toString(36).substr(-4);
        return prefix + randomPart + timestamp;
    }

    // Реєстрація нового користувача (без реферала)
    registerUser() {
        const userId = this.generateUserId();
        const referralCode = this.generateReferralCode();

        const userData = {
            id: userId,
            referralCode: referralCode,
            referrerId: null,
            level1Referrals: [],
            level2Referrals: [],
            winixBalance: 0,
            referralEarnings: {
                level1: 0,
                level2: 0,
                total: 0
            },
            registrationDate: new Date().toISOString()
        };

        // Оновлюємо дані у системі
        const referralData = this.getReferralData();
        referralData.users[userId] = userData;
        referralData.referralLinks[referralCode] = userId;
        this.saveReferralData(referralData);

        // Зберігаємо поточного користувача
        this.saveCurrentUser(userData);

        console.log(`Зареєстровано нового користувача: ${userId} з реферальним кодом: ${referralCode}`);
        return userData;
    }

    // Реєстрація нового користувача з реферальним кодом
    registerUserWithReferral(referralCode) {
        const referralData = this.getReferralData();
        const referrerId = referralData.referralLinks[referralCode];

        if (!referrerId || !referralData.users[referrerId]) {
            console.error(`Невірний реферальний код: ${referralCode}`);
            return this.registerUser(); // Реєструємо без реферала, якщо код невірний
        }

        const userId = this.generateUserId();
        const newReferralCode = this.generateReferralCode();

        const userData = {
            id: userId,
            referralCode: newReferralCode,
            referrerId: referrerId,
            level1Referrals: [],
            level2Referrals: [],
            winixBalance: 0,
            referralEarnings: {
                level1: 0,
                level2: 0,
                total: 0
            },
            registrationDate: new Date().toISOString()
        };

        // Оновлюємо дані у системі
        referralData.users[userId] = userData;
        referralData.referralLinks[newReferralCode] = userId;

        // Оновлюємо дані реферала першого рівня
        const referrer = referralData.users[referrerId];
        referrer.level1Referrals.push(userId);

        // Якщо у реферала є свій реферал (тобто реферал другого рівня для нового користувача)
        if (referrer.referrerId) {
            const level2Referrer = referralData.users[referrer.referrerId];
            if (level2Referrer) {
                level2Referrer.level2Referrals.push(userId);
            }
        }

        this.saveReferralData(referralData);
        this.saveCurrentUser(userData);

        console.log(`Зареєстровано нового користувача: ${userId} з реферальним кодом: ${newReferralCode}, запрошений користувачем: ${referrerId}`);
        return userData;
    }

    // Оновлення балансу WINIX користувача
    updateUserWinixBalance(userId, newBalance) {
        const referralData = this.getReferralData();
        const user = referralData.users[userId];

        if (!user) {
            console.error(`Користувач не знайдений: ${userId}`);
            return false;
        }

        const oldBalance = user.winixBalance;
        user.winixBalance = newBalance;
        this.saveReferralData(referralData);

        // Якщо це поточний користувач, оновлюємо і його дані
        const currentUser = this.getCurrentUser();
        if (currentUser.id === userId) {
            currentUser.winixBalance = newBalance;
            this.saveCurrentUser(currentUser);
        }

        // Обчислюємо різницю для нарахування реферальних винагород
        const balanceIncrease = newBalance - oldBalance;
        if (balanceIncrease > 0) {
            this.processReferralRewards(userId, balanceIncrease);
        }

        console.log(`Оновлено баланс WINIX для користувача ${userId}: ${oldBalance} -> ${newBalance}`);
        return true;
    }

    // Обробка реферальних винагород при збільшенні балансу
    processReferralRewards(userId, balanceIncrease) {
        const referralData = this.getReferralData();
        const user = referralData.users[userId];

        if (!user) {
            console.error(`Користувач не знайдений: ${userId}`);
            return;
        }

        // Нараховуємо винагороду рефералу першого рівня (10%)
        if (user.referrerId) {
            const level1Referrer = referralData.users[user.referrerId];
            if (level1Referrer) {
                const level1Reward = balanceIncrease * 0.1; // 10% від збільшення балансу
                level1Referrer.winixBalance += level1Reward;
                level1Referrer.referralEarnings.level1 += level1Reward;
                level1Referrer.referralEarnings.total += level1Reward;

                console.log(`Нараховано реферальну винагороду 1-го рівня: ${level1Reward} WINIX для користувача ${level1Referrer.id}`);

                // Нараховуємо винагороду рефералу другого рівня (5%)
                if (level1Referrer.referrerId) {
                    const level2Referrer = referralData.users[level1Referrer.referrerId];
                    if (level2Referrer) {
                        const level2Reward = balanceIncrease * 0.05; // 5% від збільшення балансу
                        level2Referrer.winixBalance += level2Reward;
                        level2Referrer.referralEarnings.level2 += level2Reward;
                        level2Referrer.referralEarnings.total += level2Reward;

                        console.log(`Нараховано реферальну винагороду 2-го рівня: ${level2Reward} WINIX для користувача ${level2Referrer.id}`);
                    }
                }
            }
        }

        this.saveReferralData(referralData);
    }

    // Отримання реферального посилання поточного користувача
    getCurrentUserReferralLink() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            console.error('Поточний користувач не знайдений');
            return null;
        }

        return `https://t.me/winix_bot?start=${currentUser.referralCode}`;
    }

    // Отримання статистики поточного користувача
    getCurrentUserStats() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            console.error('Поточний користувач не знайдений');
            return null;
        }

        const referralData = this.getReferralData();

        // Отримуємо детальну інформацію про рефералів першого рівня
        const level1Details = currentUser.level1Referrals.map(refId => {
            const refUser = referralData.users[refId];
            if (!refUser) return null;

            return {
                id: refId,
                registrationDate: refUser.registrationDate,
                winixBalance: refUser.winixBalance
            };
        }).filter(ref => ref !== null);

        // Отримуємо детальну інформацію про рефералів другого рівня
        const level2Details = currentUser.level2Referrals.map(refId => {
            const refUser = referralData.users[refId];
            if (!refUser) return null;

            return {
                id: refId,
                registrationDate: refUser.registrationDate,
                winixBalance: refUser.winixBalance
            };
        }).filter(ref => ref !== null);

        // Загальна статистика
        return {
            userId: currentUser.id,
            referralCode: currentUser.referralCode,
            referralLink: this.getCurrentUserReferralLink(),
            winixBalance: currentUser.winixBalance,
            totalReferrals: currentUser.level1Referrals.length,
            totalLevel2Referrals: currentUser.level2Referrals.length,
            referralEarnings: currentUser.referralEarnings || { level1: 0, level2: 0, total: 0 },
            level1Referrals: level1Details,
            level2Referrals: level2Details
        };
    }

    // Реєстрація кліку за реферальним посиланням
    registerReferralLinkClick(referralCode) {
        const referralData = this.getReferralData();

        if (!referralData.linkClicks[referralCode]) {
            referralData.linkClicks[referralCode] = {
                totalClicks: 0,
                lastClickDate: null,
                clickDates: []
            };
        }

        const now = new Date().toISOString();
        referralData.linkClicks[referralCode].totalClicks++;
        referralData.linkClicks[referralCode].lastClickDate = now;
        referralData.linkClicks[referralCode].clickDates.push(now);

        this.saveReferralData(referralData);

        console.log(`Зареєстровано клік за реферальним посиланням: ${referralCode}`);
    }

    // Копіювання реферального посилання в буфер обміну
    copyReferralLinkToClipboard() {
        const link = this.getCurrentUserReferralLink();
        if (!link) return false;

        try {
            navigator.clipboard.writeText(link).then(() => {
                console.log('Реферальне посилання скопійовано в буфер обміну');
                return true;
            }).catch(err => {
                console.error('Помилка копіювання: ', err);
                return false;
            });
        } catch (err) {
            console.error('Помилка копіювання: ', err);
            return false;
        }
    }
}

// Створюємо глобальний екземпляр системи рефералів
const referralSystem = new ReferralSystem();

// Оновлюємо інформацію при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    // Ініціалізуємо систему рефералів
    if (typeof referralSystem !== 'undefined') {
        console.log('Реферальна система успішно ініціалізована');
    } else {
        console.error('Помилка ініціалізації реферальної системи');
    }
});