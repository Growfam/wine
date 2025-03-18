/**
 * WINIX - Уніфікована система балансу, гаманця, стейкінгу та винагород
 *
 * Цей клас вирішує наступні проблеми:
 * 1. Об'єднує всі системи керування балансом в одну
 * 2. Виправляє помилку скасування стейкінгу
 * 3. Гарантує коректний запис транзакцій
 * 4. Забезпечує коректне відображення даних на інтерфейсі
 * 5. Надає захист від race conditions та маніпуляцій з балансом
 */

class WinixSystem {
    constructor() {
        // Перевіряємо, чи вже існує екземпляр
        if (window._winixSystemInstance) {
            console.log("🚀 Використовуємо існуючий екземпляр WinixSystem");
            return window._winixSystemInstance;
        }

    /**
     * Застосування патчів для сумісності з існуючими системами
     * @private
     */
    _applySystemPatches() {
        console.log("🚀 Застосування патчів для сумісності з існуючими системами");

        // Патч для RewardSystem
        if (window.rewardSystem && typeof window.rewardSystem !== 'object') {
            window.rewardSystem = this;
        } else {
            window.rewardSystem = this;
        }

        // Патч для StakingSystem
        if (!window.stakingSystem) {
            window.stakingSystem = {};
        }

        // Перевизначаємо методи StakingSystem
        window.stakingSystem.getStakingDisplayData = () => this.getStakingData();
        window.stakingSystem.hasActiveStaking = () => this.hasActiveStaking();
        window.stakingSystem.calculateExpectedReward = (amount, period) => this.calculateStakingReward(amount, period);
        window.stakingSystem.createStaking = (amount, period) => this.createStaking(amount, period);
        window.stakingSystem.addToExistingStaking = (stakingId, amount) => this.addToExistingStaking(stakingId, amount);
        window.stakingSystem.cancelStaking = () => this.cancelStaking();
        window.stakingSystem.updateStakingStatus = () => this.updateStakingRemainingDays ? this.updateStakingRemainingDays() : true;
        window.stakingSystem.updateStakingDisplay = () => this.updateStakingDisplay();

        // Патч для WalletSystem
        if (!window.walletSystem) {
            window.walletSystem = {};
        }

        // Перевизначаємо методи WalletSystem
        window.walletSystem.getBalance = () => this.getTokens();
        window.walletSystem.setBalance = (amount) => this.setTokens(amount);
        window.walletSystem.updateBalanceDisplay = () => this.updateBalanceDisplay();
        window.walletSystem.addTransaction = (type, amount, description) => this.addTransaction(type, amount, description);
        window.walletSystem.receiveTokens = (source, amount) => this.addTokens(amount);
        window.walletSystem.sendTokens = (recipient, amount) => this.sendTokens(recipient, amount);
        window.walletSystem.getTransactions = () => this.getTransactions();
        window.walletSystem.updateTransactionsList = () => this.updateTransactionsList();

        // Патч для BalanceManager, якщо він існує
        if (window.balanceManager) {
            const self = this;
            window.balanceManager.setCurrentBalance = (amount) => self.setTokens(amount);
            window.balanceManager.addToBalance = (amount) => {
                const result = self.addTokens(amount);
                return result > amount;
            };
            window.balanceManager.subtractFromBalance = (amount) => self.subtractTokens(amount);
            window.balanceManager.getCurrentBalance = () => self.getTokens();
            window.balanceManager.syncAllBalances = () => self.updateBalanceDisplay();
        }

        // Додаємо глобальні функції для сумісності
        window.getUserTokens = () => this.getTokens();
        window.getBalance = () => this.getTokens();
        window.getUserCoins = () => this.getCoins();

        // Уніфікований UI
        window.winixUI = {
            showAlert: (message, isSuccess, callback) => this.showAlert(message, isSuccess, callback),
            showConfirm: (message) => this.showConfirm(message),
            showInputModal: (title) => this.showInputModal(title),
            simpleAlert: (message, isSuccess) => this.showAlert(message, isSuccess)
        };

        console.log("🚀 Патчі для сумісності успішно застосовано");
    }
}

// Запуск системи і глобальний експорт
(() => {
    console.log("🚀 Ініціалізація уніфікованої системи WINIX");

    // Створюємо екземпляр WinixSystem
    const winixSystem = new WinixSystem();

    // Експортуємо для використання на інших сторінках
    window.winixSystem = winixSystem;

    // Чекаємо завантаження DOM
    document.addEventListener('DOMContentLoaded', () => {
        console.log("🚀 DOM завантажено, оновлюємо інтерфейс");
        winixSystem.updateBalanceDisplay();
        winixSystem.updateStakingDisplay();

        // Показуємо повідомлення про успішну ініціалізацію
        setTimeout(() => {
            const message = document.createElement('div');
            message.style.position = 'fixed';
            message.style.bottom = '20px';
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.backgroundColor = '#16213e';
            message.style.color = 'white';
            message.style.padding = '10px 20px';
            message.style.borderRadius = '5px';
            message.style.zIndex = '9999';
            message.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            message.style.fontWeight = 'bold';
            message.style.border = '1px solid rgba(0, 201, 167, 0.3)';
            message.textContent = 'Систему WINIX успішно активовано! 🚀';

            document.body.appendChild(message);

            setTimeout(() => {
                message.style.opacity = '0';
                message.style.transition = 'opacity 0.5s';

                setTimeout(() => {
                    if (message.parentNode) {
                        message.parentNode.removeChild(message);
                    }
                }, 500);
            }, 3000);
        }, 1000);
    });

    console.log("🚀 Уніфіковану систему WINIX успішно ініціалізовано та експортовано");
})();

        // Ініціалізація прапорців для контролю операцій
        this._isUpdatingBalance = false;
        this._isRewardingInProgress = false;
        this._isCancellingStaking = false;
        this._isCreatingStaking = false;
        this._isAddingToStaking = false;
        this._lastRewardTime = 0;
        this._stakingPatchesApplied = false;

        // Константи для ключів localStorage
        this.STORAGE_KEYS = {
            USER_TOKENS: 'userTokens',
            USER_COINS: 'userCoins',
            STAKING_DATA: 'stakingData',
            WINIX_STAKING_DATA: 'winix_stakingData',
            STAKING_SYSTEM_DATA: 'StakingSystem.data',
            COMPLETED_ACTIONS: 'completedActions',
            TRANSACTIONS: 'winix_wallet_transactions',
            LAST_KNOWN_BALANCE: 'lastKnownBalance',
            BALANCE_TIMESTAMP: 'balanceTimestamp',
            LAST_REWARD_TIMESTAMP: 'lastRewardTimestamp',
            LAST_STAKING_TIMESTAMP: 'lastStakingTimestamp',
            LAST_CANCEL_TIMESTAMP: 'lastStakingCancelTimestamp',
            CANCELED_STAKINGS: 'canceledStakings',
            CURRENT_BONUS_DAY: 'currentBonusDay',
            LAST_DAILY_BONUS_DATE: 'lastDailyBonusDate'
        };

        // Відсотки винагороди для різних періодів стейкінгу
        this.STAKING_RATES = {
            7: 3,   // 3% за 7 днів
            14: 7,  // 7% за 14 днів
            28: 15  // 15% за 28 днів
        };

        // Ініціалізація
        this.initializeSystem();

        // Зберігаємо екземпляр для повторного використання
        window._winixSystemInstance = this;

        // Встановлюємо захист балансу
        this._setupBalanceProtection();

        // Ініціалізуємо DOM-обробники
        this._initDomHandlersWithDelay();

        // Виконуємо патчі для сумісності зі старими системами
        this._applySystemPatches();

        console.log("🚀 WinixSystem успішно ініціалізовано");
    }

    /* ===== ІНІЦІАЛІЗАЦІЯ СИСТЕМИ ===== */

    /**
     * Ініціалізація всієї системи
     */
    initializeSystem() {
        try {
            // Ініціалізуємо баланс
            this.initializeBalance();

            // Завантажуємо список виконаних дій
            this._completedActions = this.getCompletedActions();

            // Синхронізуємо дані стейкінгу
            this._syncStakingStorageKeys();

            // Ініціалізуємо транзакції
            this._initializeTransactions();

            console.log("🚀 Система успішно ініціалізована");
            return true;
        } catch (error) {
            console.error("🚀 Помилка ініціалізації системи:", error);
            return false;
        }
    }

    /**
     * Ініціалізація балансу
     */
    initializeBalance() {
        try {
            // Ініціалізуємо базові змінні, якщо вони не існують
            if (!localStorage.getItem(this.STORAGE_KEYS.USER_TOKENS)) {
                localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, '0');
            }
            if (!localStorage.getItem(this.STORAGE_KEYS.USER_COINS)) {
                localStorage.setItem(this.STORAGE_KEYS.USER_COINS, '0');
            }

            // Ініціалізуємо захисні змінні для балансу
            if (!localStorage.getItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE)) {
                localStorage.setItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE, localStorage.getItem(this.STORAGE_KEYS.USER_TOKENS) || '0');
                localStorage.setItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP, Date.now().toString());
            }

            // Ініціалізуємо список скасованих стейкінгів
            if (!localStorage.getItem(this.STORAGE_KEYS.CANCELED_STAKINGS)) {
                localStorage.setItem(this.STORAGE_KEYS.CANCELED_STAKINGS, JSON.stringify([]));
            }

            console.log("🚀 Баланс успішно ініціалізовано");
            return true;
        } catch (error) {
            console.error("🚀 Помилка ініціалізації балансу:", error);
            return false;
        }
    }

    /**
     * Ініціалізація транзакцій
     * @private
     */
    _initializeTransactions() {
        try {
            if (!localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS)) {
                localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
            }
            return true;
        } catch (error) {
            console.error("🚀 Помилка ініціалізації транзакцій:", error);
            return false;
        }
    }

    /* ===== МЕТОДИ УПРАВЛІННЯ БАЛАНСОМ ===== */

    /**
     * Отримати поточний баланс токенів
     * @returns {number} Поточний баланс
     */
    getTokens() {
        try {
            return parseFloat(localStorage.getItem(this.STORAGE_KEYS.USER_TOKENS)) || 0;
        } catch (error) {
            console.error("🚀 Помилка отримання балансу токенів:", error);
            return 0;
        }
    }

    /**
     * Отримати баланс токенів (альтернативний метод для сумісності)
     * @returns {number} Поточний баланс
     */
    getBalance() {
        return this.getTokens();
    }

    /**
     * Отримати поточний баланс жетонів
     * @returns {number} Поточний баланс жетонів
     */
    getCoins() {
        try {
            return parseFloat(localStorage.getItem(this.STORAGE_KEYS.USER_COINS)) || 0;
        } catch (error) {
            console.error("🚀 Помилка отримання балансу жетонів:", error);
            return 0;
        }
    }

    /**
     * Встановити новий баланс токенів
     * @param {number} amount - Нове значення балансу
     * @returns {boolean} Результат операції
     */
    setTokens(amount) {
        if (this._isUpdatingBalance) {
            console.log("🚀 Вже виконується оновлення балансу, пропускаємо");
            return false;
        }

        this._isUpdatingBalance = true;

        try {
            amount = parseFloat(amount);
            if (isNaN(amount) || amount < 0) {
                console.error("🚀 Некоректне значення балансу:", amount);
                return false;
            }

            // Зберігаємо нове значення
            localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, amount.toString());
            console.log("🚀 Баланс встановлено:", amount);

            // Оновлюємо захисні змінні
            localStorage.setItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE, amount.toString());
            localStorage.setItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP, Date.now().toString());

            // Оновлюємо відображення
            this.updateBalanceDisplay();

            return true;
        } catch (error) {
            console.error("🚀 Помилка встановлення балансу:", error);
            return false;
        } finally {
            this._isUpdatingBalance = false;
        }
    }

    /**
     * Встановити баланс (альтернативний метод для сумісності)
     * @param {number} amount - Нове значення балансу
     * @returns {boolean} Результат операції
     */
    setBalance(amount) {
        return this.setTokens(amount);
    }

    /**
     * Додати токени до балансу
     * @param {number} amount - Кількість токенів для додавання
     * @param {boolean} isReward - Чи є це винагородою
     * @returns {number} Новий баланс
     */
    addTokens(amount, isReward = false) {
        if (this._isUpdatingBalance) {
            console.log("🚀 Вже виконується оновлення балансу, пропускаємо");
            return this.getTokens();
        }

        this._isUpdatingBalance = true;

        try {
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) {
                console.warn("🚀 Спроба додати некоректну кількість токенів:", amount);
                return this.getTokens();
            }

            // Отримуємо поточний баланс
            const currentTokens = this.getTokens();
            const newBalance = currentTokens + amount;

            console.log(`🚀 Додаємо ${amount} токенів, було ${currentTokens}, стало ${newBalance}`);

            // Зберігаємо нове значення
            localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, newBalance.toString());

            // Якщо це винагорода, зберігаємо часову мітку
            if (isReward) {
                this._lastRewardTime = Date.now();
                localStorage.setItem(this.STORAGE_KEYS.LAST_REWARD_TIMESTAMP, this._lastRewardTime.toString());
            }

            // Оновлюємо захисні змінні
            localStorage.setItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE, newBalance.toString());
            localStorage.setItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP, Date.now().toString());

            // Додаємо транзакцію
            if (!isReward) { // не додаємо транзакцію для винагороди, це буде окрема
                this.addTransaction('receive', amount, 'Поповнення балансу');
            }

            // Оновлюємо відображення
            this.updateBalanceDisplay();

            return newBalance;
        } catch (error) {
            console.error("🚀 Помилка додавання токенів:", error);
            return this.getTokens();
        } finally {
            this._isUpdatingBalance = false;
        }
    }

    /**
     * Спробувати зняти кошти з балансу
     * @param {number} amount - Кількість для зняття
     * @param {string} reason - Причина зняття (для транзакції)
     * @returns {boolean} - Чи успішно виконано зняття
     */
    subtractTokens(amount, reason = 'Списання коштів') {
        if (this._isUpdatingBalance) {
            console.log("🚀 Вже виконується оновлення балансу, пропускаємо");
            return false;
        }

        this._isUpdatingBalance = true;

        try {
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) {
                console.warn("🚀 Спроба зняти некоректну кількість токенів:", amount);
                return false;
            }

            // Отримуємо поточний баланс
            const currentTokens = this.getTokens();

            // Перевіряємо, чи достатньо коштів
            if (currentTokens < amount) {
                console.warn(`🚀 Недостатньо коштів для зняття: ${currentTokens} < ${amount}`);
                return false;
            }

            // Перевіряємо, чи була недавня винагорода (захист)
            const now = Date.now();
            const lastRewardTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.LAST_REWARD_TIMESTAMP) || '0');
            const recentReward = (now - lastRewardTime) < 60000; // 1 хвилина захист

            if (recentReward && !this._isCreatingStaking && !this._isAddingToStaking) {
                console.warn("🚀 Блокування зняття коштів після недавньої винагороди");
                return false;
            }

            // Розраховуємо новий баланс
            const newBalance = currentTokens - amount;
            console.log(`🚀 Знімаємо ${amount} токенів, було ${currentTokens}, стало ${newBalance}`);

            // Зберігаємо нове значення
            localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, newBalance.toString());

            // Оновлюємо захисні змінні
            localStorage.setItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE, newBalance.toString());
            localStorage.setItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP, Date.now().toString());

            // Додаємо транзакцію, якщо це не операція стейкінгу (вона буде додана окремо)
            if (!this._isCreatingStaking && !this._isAddingToStaking) {
                this.addTransaction('send', amount, reason);
            }

            // Оновлюємо відображення
            this.updateBalanceDisplay();

            return true;
        } catch (error) {
            console.error("🚀 Помилка зняття токенів:", error);
            return false;
        } finally {
            this._isUpdatingBalance = false;
        }
    }

    /**
     * Додати жетони до балансу
     * @param {number} amount - Кількість жетонів для додавання
     * @returns {number} Новий баланс жетонів
     */
    addCoins(amount) {
        try {
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) {
                console.warn("🚀 Спроба додати некоректну кількість жетонів:", amount);
                return this.getCoins();
            }

            // Отримуємо поточний баланс жетонів
            const currentCoins = this.getCoins();
            const newBalance = currentCoins + amount;

            console.log(`🚀 Додаємо ${amount} жетонів, було ${currentCoins}, стало ${newBalance}`);

            // Зберігаємо нове значення
            localStorage.setItem(this.STORAGE_KEYS.USER_COINS, newBalance.toString());

            // Оновлюємо відображення
            this.updateBalanceDisplay();

            return newBalance;
        } catch (error) {
            console.error("🚀 Помилка додавання жетонів:", error);
            return this.getCoins();
        }
    }

    /* ===== МЕТОДИ ЗАХИСТУ БАЛАНСУ ===== */

    /**
     * Встановлення захисту балансу
     * @private
     */
    _setupBalanceProtection() {
        // Встановлюємо патч для localStorage.setItem
        this._patchLocalStorage();

        // Встановлюємо періодичну перевірку балансу
        setInterval(() => {
            this._guardBalance();
        }, 5000);

        // Запобігання втраті балансу при навігації
        window.addEventListener('beforeunload', () => {
            try {
                const balance = this.getTokens();
                if (balance > 0) {
                    sessionStorage.setItem('lastBalance', balance.toString());
                    sessionStorage.setItem('navigationTime', Date.now().toString());
                }
            } catch (e) {
                console.error("🚀 Помилка збереження балансу при навігації:", e);
            }
        });

        // Перевірка балансу після навігації
        setTimeout(() => {
            try {
                const savedBalance = parseFloat(sessionStorage.getItem('lastBalance') || '0');
                const currentBalance = this.getTokens();

                // Отримуємо час останньої операції
                const lastStakingTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.LAST_STAKING_TIMESTAMP) || '0');
                const lastRewardTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.LAST_REWARD_TIMESTAMP) || '0');
                const navigationTime = parseInt(sessionStorage.getItem('navigationTime') || '0');
                const lastOperationTime = Math.max(lastStakingTime, lastRewardTime, navigationTime);

                const now = Date.now();

                // Відновлюємо баланс, якщо він зменшився не через законні операції
                if (savedBalance > 0 && savedBalance > currentBalance && (now - lastOperationTime) > 5000) {
                    console.log(`🚀 Відновлюємо баланс після навігації: ${currentBalance} -> ${savedBalance}`);
                    localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, savedBalance.toString());
                    this.updateBalanceDisplay();
                }
            } catch (e) {
                console.error("🚀 Помилка відновлення балансу після навігації:", e);
            }
        }, 1000);
    }

    /**
     * Патч для localStorage.setItem
     * @private
     */
    _patchLocalStorage() {
        if (window._winixSystemSetItemPatched) return;

        window._winixSystemSetItemPatched = true;
        const originalSetItem = localStorage.setItem;
        const self = this;

        localStorage.setItem = function(key, value) {
            // Захист балансу токенів від несанкціонованого зменшення
            if (key === self.STORAGE_KEYS.USER_TOKENS && self._isRewardingInProgress) {
                const currentValue = parseFloat(localStorage.getItem(self.STORAGE_KEYS.USER_TOKENS) || '0');
                const newValue = parseFloat(value);

                if (!isNaN(newValue) && !isNaN(currentValue) && newValue < currentValue) {
                    console.warn(`🚀 Блокування зменшення балансу під час нагороди: ${currentValue} -> ${newValue}`);
                    return;
                }
            }

            // Захист балансу після недавньої нагороди
            if (key === self.STORAGE_KEYS.USER_TOKENS) {
                const currentValue = parseFloat(localStorage.getItem(self.STORAGE_KEYS.USER_TOKENS) || '0');
                const newValue = parseFloat(value);
                const now = Date.now();
                const lastRewardTime = parseInt(localStorage.getItem(self.STORAGE_KEYS.LAST_REWARD_TIMESTAMP) || '0');
                const recentReward = (now - lastRewardTime) < 60000; // 1 хвилина захисту

                if (recentReward && !isNaN(newValue) && !isNaN(currentValue) && newValue < currentValue && !self._isCreatingStaking && !self._isAddingToStaking) {
                    console.warn(`🚀 Блокування зменшення балансу після нещодавньої нагороди: ${currentValue} -> ${newValue}`);
                    return;
                }
            }

            // Захист ключів стейкінгу від прямого редагування
            const stakingKeys = [
                self.STORAGE_KEYS.STAKING_DATA,
                self.STORAGE_KEYS.WINIX_STAKING_DATA,
                'winix_staking_data',
                self.STORAGE_KEYS.STAKING_SYSTEM_DATA,
                self.STORAGE_KEYS.LAST_CANCEL_TIMESTAMP,
                self.STORAGE_KEYS.CANCELED_STAKINGS
            ];

            // Якщо це ключ стейкінгу і операція не ініційована системою
            if (stakingKeys.includes(key) && !self._isUpdatingBalance && !self._isRewardingInProgress &&
                !self._isCancellingStaking && !self._isCreatingStaking && !self._isAddingToStaking) {
                console.warn(`🔒 Блокування прямої модифікації ключа стейкінгу: ${key}`);
                return;
            }

            return originalSetItem.call(localStorage, key, value);
        };

        // Патч для removeItem
        const originalRemoveItem = localStorage.removeItem;
        localStorage.removeItem = function(key) {
            // Захист критичних ключів від видалення
            const protectedKeys = [
                self.STORAGE_KEYS.STAKING_DATA,
                self.STORAGE_KEYS.WINIX_STAKING_DATA,
                'winix_staking_data',
                self.STORAGE_KEYS.STAKING_SYSTEM_DATA,
                self.STORAGE_KEYS.CANCELED_STAKINGS,
                self.STORAGE_KEYS.USER_TOKENS
            ];

            if (protectedKeys.includes(key)) {
                console.warn(`🔒 Блокування видалення захищеного ключа: ${key}`);
                return;
            }

            return originalRemoveItem.call(localStorage, key);
        };

        console.log("🚀 Патч localStorage успішно встановлено");
    }

    /**
     * Захист балансу від несанкціонованих змін
     * @private
     */
    _guardBalance() {
        try {
            if (this._isRewardingInProgress || this._isCreatingStaking ||
                this._isAddingToStaking || this._isCancellingStaking) {
                return;
            }

            // Перевіряємо, чи не зменшився баланс за останні секунди
            const currentBalance = this.getTokens();
            const lastKnownBalance = parseFloat(localStorage.getItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE) || '0');
            const balanceTimestamp = parseInt(localStorage.getItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP) || '0');

            const now = Date.now();
            const timeDiff = now - balanceTimestamp;

            // Якщо баланс зменшився протягом останніх 10 секунд і не було оповіщення про це
            if (currentBalance < lastKnownBalance && timeDiff < 10000 && !this._isUpdatingBalance) {
                console.warn(`🚀 Виявлено несанкціоноване зменшення балансу: ${lastKnownBalance} -> ${currentBalance}, відновлюємо`);
                localStorage.setItem(this.STORAGE_KEYS.USER_TOKENS, lastKnownBalance.toString());
                this.updateBalanceDisplay();
            }

            // Якщо баланс змінився, або пройшло більше 10 секунд, оновлюємо збережені значення
            if (currentBalance !== lastKnownBalance || timeDiff > 10000) {
                localStorage.setItem(this.STORAGE_KEYS.LAST_KNOWN_BALANCE, currentBalance.toString());
                localStorage.setItem(this.STORAGE_KEYS.BALANCE_TIMESTAMP, now.toString());
            }
        } catch (error) {
            console.error("🚀 Помилка захисту балансу:", error);
        }
    }

    /* ===== МЕТОДИ НАРАХУВАННЯ ВИНАГОРОД ===== */

    /**
     * Отримання списку виконаних дій
     * @returns {Array} Список виконаних дій
     */
    getCompletedActions() {
        try {
            const actions = localStorage.getItem(this.STORAGE_KEYS.COMPLETED_ACTIONS);
            return actions ? JSON.parse(actions) : [];
        } catch (error) {
            console.error("🚀 Помилка отримання виконаних дій:", error);
            return [];
        }
    }

    /**
     * Перевірка чи дія вже виконана
     * @param {string} actionId - Ідентифікатор дії
     * @returns {boolean} Чи дія виконана
     */
    isActionCompleted(actionId) {
        return this._completedActions.includes(actionId);
    }

    /**
     * Збереження виконаної дії
     * @param {string} actionId - Ідентифікатор дії
     */
    saveCompletedAction(actionId) {
        try {
            if (!this.isActionCompleted(actionId)) {
                this._completedActions.push(actionId);
                localStorage.setItem(this.STORAGE_KEYS.COMPLETED_ACTIONS, JSON.stringify(this._completedActions));
            }
        } catch (error) {
            console.error("🚀 Помилка збереження виконаної дії:", error);
        }
    }

    /**
     * Нарахування винагороди за дію
     * @param {string} actionId - Ідентифікатор дії
     * @param {number} tokens - Кількість токенів для нарахування
     * @param {number} coins - Кількість жетонів для нарахування
     * @returns {boolean} Результат операції
     */
    reward(actionId, tokens, coins) {
        try {
            console.log(`🚀 ВИКЛИК REWARD: actionId=${actionId}, tokens=${tokens}, coins=${coins}`);

            // Перевіряємо чи дія вже виконана
            if (this.isActionCompleted(actionId)) {
                console.log(`🚀 Винагороду за дію ${actionId} вже отримано раніше.`);
                return false;
            }

            // Встановлюємо прапорець нарахування нагороди
            this._isRewardingInProgress = true;
            console.log(`🚀 ПОЧАТОК НАРАХУВАННЯ НАГОРОДИ за дію ${actionId}`);

            // Спершу зберігаємо виконану дію, щоб уникнути подвійного нарахування
            this.saveCompletedAction(actionId);

            // Важливо: додаємо часову мітку винагороди ПЕРЕД зміною балансу
            this._lastRewardTime = Date.now();
            localStorage.setItem(this.STORAGE_KEYS.LAST_REWARD_TIMESTAMP, this._lastRewardTime.toString());

            // Додаємо токени
            let tokensAdded = false;
            if (tokens > 0) {
                const newBalance = this.addTokens(tokens, true);
                tokensAdded = true;

                // Додаємо транзакцію окремо для винагороди
                this.addTransaction('receive', tokens, `Винагорода за дію: ${actionId}`);
            }

            // Додаємо жетони
            if (coins > 0) {
                this.addCoins(coins);
            }

            // Показ повідомлення про винагороду
            if (tokensAdded || coins > 0) {
                this.showRewardMessage(tokens, coins);
            }

            console.log(`🚀 Нараховано винагороду за дію ${actionId}: ${tokens} токенів і ${coins} жетонів.`);

            // Оновлюємо відображення балансу
            this.updateBalanceDisplay();

            // Відкладаємо завершення процесу нарахування
            setTimeout(() => {
                this._isRewardingInProgress = false;
                console.log("🚀 ЗАВЕРШЕННЯ НАРАХУВАННЯ НАГОРОДИ");
            }, 1000);

            return true;
        } catch (error) {
            console.error("🚀 Помилка нарахування винагороди:", error);
            this._isRewardingInProgress = false;
            return false;
        }
    }

    /**
     * Нарахування винагороди за соціальні дії
     * @param {string} platform - Назва соціальної платформи
     * @param {number} tokens - Кількість токенів для нарахування
     * @returns {boolean} Результат операції
     */
    rewardSocialAction(platform, tokens) {
        const actionId = `social_${platform}`;
        return this.reward(actionId, tokens, 0);
    }

    /**
     * Нарахування щоденного бонусу
     * @param {number} day - День бонусу (якщо передано)
     * @returns {Object} Результат операції з інформацією про бонус
     */
    rewardDailyBonus(day) {
        const today = new Date().toDateString();
        const lastBonusDate = localStorage.getItem(this.STORAGE_KEYS.LAST_DAILY_BONUS_DATE);

        if (lastBonusDate === today) {
            console.log("🚀 Щоденний бонус вже отримано сьогодні");
            return { success: false, message: "Бонус вже отримано" };
        }

        const bonusDay = day || parseInt(localStorage.getItem(this.STORAGE_KEYS.CURRENT_BONUS_DAY) || 0) + 1;
        const bonusAmount = bonusDay * 10; // 10, 20, 30...

        // Встановлюємо прапорець нарахування нагороди
        this._isRewardingInProgress = true;

        // Зберігаємо дату отримання бонусу та день бонусу
        localStorage.setItem(this.STORAGE_KEYS.LAST_DAILY_BONUS_DATE, today);
        localStorage.setItem(this.STORAGE_KEYS.CURRENT_BONUS_DAY, bonusDay > 7 ? 1 : bonusDay);

        // Додаємо часову мітку винагороди
        this._lastRewardTime = Date.now();
        localStorage.setItem(this.STORAGE_KEYS.LAST_REWARD_TIMESTAMP, this._lastRewardTime.toString());

        // Додаємо бонус до балансу
        this.addTokens(bonusAmount, true);

        // Додаємо транзакцію для щоденного бонусу
        this.addTransaction('receive', bonusAmount, `Щоденний бонус: День ${bonusDay}`);

        // Показуємо повідомлення
        this.showRewardMessage(bonusAmount, 0);

        // Завершуємо процес нарахування
        setTimeout(() => {
            this._isRewardingInProgress = false;
        }, 1000);

        return {
            success: true,
            day: bonusDay,
            amount: bonusAmount
        };
    }

    /**
     * Показ повідомлення про отриману винагороду
     * @param {number} tokens - Кількість нарахованих токенів
     * @param {number} coins - Кількість нарахованих жетонів
     */
    showRewardMessage(tokens, coins) {
        try {
            // Перевіряємо, чи є щось для відображення
            tokens = parseFloat(tokens) || 0;
            coins = parseFloat(coins) || 0;

            if (tokens <= 0 && coins <= 0) {
                return;
            }

            const messageContainer = document.createElement('div');
            messageContainer.style.position = 'fixed';
            messageContainer.style.top = '20px';
            messageContainer.style.left = '50%';
            messageContainer.style.transform = 'translateX(-50%)';
            messageContainer.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
            messageContainer.style.color = 'white';
            messageContainer.style.padding = '15px';
            messageContainer.style.borderRadius = '10px';
            messageContainer.style.zIndex = '1000';
            messageContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            messageContainer.style.textAlign = 'center';

            let messageContent = '<h4 style="margin: 0 0 10px 0;">Вітаємо!</h4><p style="margin: 0;">Ви отримали:</p>';

            if (tokens > 0) {
                messageContent += `<p style="margin: 5px 0; font-weight: bold;">${tokens.toFixed(2)} $WINIX</p>`;
            }

            if (coins > 0) {
                messageContent += `<p style="margin: 5px 0; font-weight: bold;">${coins.toFixed(0)} жетонів</p>`;
            }

            messageContainer.innerHTML = messageContent;
            document.body.appendChild(messageContainer);

            // Автоматичне видалення повідомлення через 3 секунди
            setTimeout(() => {
                messageContainer.style.opacity = '0';
                messageContainer.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    if (document.body.contains(messageContainer)) {
                        document.body.removeChild(messageContainer);
                    }
                }, 500);
            }, 3000);
        } catch (error) {
            console.error("🚀 Помилка показу повідомлення про винагороду:", error);
        }
    }

    /* ===== МЕТОДИ УПРАВЛІННЯ ТРАНЗАКЦІЯМИ ===== */

    /**
     * Додавання нової транзакції
     * @param {string} type - Тип транзакції ('receive', 'send', 'stake', 'unstake')
     * @param {number} amount - Сума транзакції
     * @param {string} description - Опис транзакції
     * @returns {boolean} Результат операції
     */
    addTransaction(type, amount, description = '') {
        try {
            // Перевіряємо параметри
            amount = parseFloat(amount);
            if (isNaN(amount) || amount <= 0) {
                console.warn("🚀 Некоректна сума для транзакції:", amount);
                return false;
            }

            // Перевіряємо тип транзакції
            const validTypes = ['receive', 'send', 'stake', 'unstake'];
            if (!validTypes.includes(type)) {
                console.warn("🚀 Некоректний тип транзакції:", type);
                return false;
            }

            // Отримуємо існуючі транзакції
            let transactions = this.getTransactions();

            // Створюємо нову транзакцію
            const newTransaction = {
                id: Date.now().toString(),
                type: type,
                amount: amount,
                description: description,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };

            // Додаємо транзакцію до списку
            transactions.unshift(newTransaction); // Додаємо на початок

            // Обмежуємо кількість збережених транзакцій
            if (transactions.length > 100) {
                transactions = transactions.slice(0, 100);
            }

            // Зберігаємо оновлений список
            localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));

            // Оновлюємо відображення транзакцій
            this.updateTransactionsList();

            return true;
        } catch (error) {
            console.error("🚀 Помилка додавання транзакції:", error);
            return false;
        }
    }

    /**
     * Отримання всіх транзакцій
     * @returns {Array} Список транзакцій
     */
    getTransactions() {
        try {
            const transactionsData = localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS);
            return transactionsData ? JSON.parse(transactionsData) : [];
        } catch (error) {
            console.error("🚀 Помилка отримання транзакцій:", error);
            return [];
        }
    }

    /**
     * Отримання останніх N транзакцій
     * @param {number} count - Кількість транзакцій для отримання
     * @returns {Array} Список останніх транзакцій
     */
    getRecentTransactions(count = 3) {
        const allTransactions = this.getTransactions();
        return allTransactions.slice(0, count);
    }

    /**
     * Оновлення списку транзакцій на сторінці
     * @returns {boolean} Результат операції
     */
    updateTransactionsList() {
        const transactionListElement = document.getElementById('transaction-list');
        if (!transactionListElement) return false;

        try {
            // Отримуємо останні транзакції
            const recentTransactions = this.getRecentTransactions(5);

            // Очищаємо поточний список
            transactionListElement.innerHTML = '';

            if (recentTransactions.length === 0) {
                transactionListElement.innerHTML = '<div class="empty-message">У вас ще немає транзакцій</div>';
                return true;
            }

            // Додаємо кожну транзакцію в список
            recentTransactions.forEach(transaction => {
                const transactionElement = document.createElement('div');
                transactionElement.className = 'transaction-item';

                // Визначаємо текст і клас в залежності від типу транзакції
                let transactionText = '';
                let amountClass = '';
                let amountPrefix = '';

                switch (transaction.type) {
                    case 'receive':
                        transactionText = 'Отримано';
                        amountClass = 'transaction-positive';
                        amountPrefix = '+';
                        break;
                    case 'send':
                        transactionText = 'Надіслано';
                        amountClass = 'transaction-negative';
                        amountPrefix = '-';
                        break;
                    case 'stake':
                        transactionText = 'Застейкано';
                        amountClass = 'transaction-neutral';
                        amountPrefix = '-';
                        break;
                    case 'unstake':
                        transactionText = 'Розстейкано';
                        amountClass = 'transaction-positive';
                        amountPrefix = '+';
                        break;
                    default:
                        transactionText = 'Транзакція';
                        amountClass = 'transaction-neutral';
                        break;
                }

                // Додаємо опис, якщо є
                if (transaction.description) {
                    transactionText += `: ${transaction.description}`;
                }

                // Форматуємо дату
                const timestamp = new Date(transaction.timestamp);
                const formattedDate = `${timestamp.getDate().toString().padStart(2, '0')}.${(timestamp.getMonth()+1).toString().padStart(2, '0')}.${timestamp.getFullYear()} ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

                transactionElement.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-details">${transactionText}</div>
                        <div class="transaction-date">${formattedDate}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">${amountPrefix}${transaction.amount.toFixed(2)} $WINIX</div>
                `;

                transactionListElement.appendChild(transactionElement);
            });

            return true;
        } catch (error) {
            console.error("🚀 Помилка оновлення списку транзакцій:", error);
            return false;
        }
    }

    /**
     * Надсилання токенів іншому користувачу
     * @param {string} recipientId - Ідентифікатор отримувача
     * @param {number} amount - Сума для надсилання
     * @returns {Object} Результат операції
     */
    sendTokens(recipientId, amount) {
        try {
            amount = parseFloat(amount);

            if (isNaN(amount) || amount <= 0) {
                return { success: false, message: "Невірна сума для переказу" };
            }

            if (!recipientId) {
                return { success: false, message: "Потрібно вказати ID отримувача" };
            }

            // Перевіряємо баланс
            if (this.getTokens() < amount) {
                return { success: false, message: "Недостатньо коштів для переказу" };
            }

            // Знімаємо кошти
            const success = this.subtractTokens(amount, `Надіслано користувачу ${recipientId}`);

            if (success) {
                return {
                    success: true,
                    message: `Успішно надіслано ${amount.toFixed(2)} $WINIX користувачу ${recipientId}`,
                    newBalance: this.getTokens()
                };
            } else {
                return { success: false, message: "Помилка під час відправки коштів" };
            }
        } catch (error) {
            console.error("🚀 Помилка відправки токенів:", error);
            return { success: false, message: "Сталася помилка при відправці токенів" };
        }
    }

    /**
     * Отримання токенів (для симуляції)
     * @param {string} senderId - Ідентифікатор відправника
     * @param {number} amount - Сума для отримання
     * @returns {Object} Результат операції
     */
    receiveTokens(senderId, amount) {
        try {
            amount = parseFloat(amount);

            if (isNaN(amount) || amount <= 0) {
                return { success: false, message: "Невірна сума для отримання" };
            }

            // Додаємо кошти
            const newBalance = this.addTokens(amount);

            // Додаємо транзакцію (addTokens вже додає транзакцію, але без опису)
            this.addTransaction('receive', amount, `Отримано від користувача ${senderId}`);

            return {
                success: true,
                message: `Успішно отримано ${amount.toFixed(2)} $WINIX від користувача ${senderId}`,
                newBalance: newBalance
            };
        } catch (error) {
            console.error("🚀 Помилка отримання токенів:", error);
            return { success: false, message: "Сталася помилка при отриманні токенів" };
        }
    }

    /* ===== МЕТОДИ УПРАВЛІННЯ СТЕЙКІНГОМ ===== */

    /**
     * Отримання даних стейкінгу
     * @returns {Object} Дані стейкінгу
     */
    getStakingData() {
        console.log("🚀 Отримання даних стейкінгу");

        try {
            // Синхронізуємо дані між різними ключами
            this._syncStakingStorageKeys();

            // Отримуємо дані з localStorage
            const dataStr = localStorage.getItem(this.STORAGE_KEYS.STAKING_DATA);
            if (!dataStr) {
                console.log("🚀 Дані стейкінгу не знайдено");
                return { hasActiveStaking: false };
            }

            const data = JSON.parse(dataStr);

            // Оновлюємо кількість днів, що залишились
            if (data.hasActiveStaking && data.startDate) {
                const startDate = new Date(data.startDate);
                const endDate = new Date(data.endDate);
                const now = new Date();

                // Якщо стейкінг завершився, автоматично нараховуємо винагороду
                if (now >= endDate) {
                    console.log("🚀 Стейкінг завершено, нараховуємо винагороду");
                    this._finalizeStaking(data);
                    return { hasActiveStaking: false };
                }

                // Інакше оновлюємо кількість днів, що залишились
                const diffTime = endDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                data.remainingDays = Math.max(0, diffDays);
            }

            console.log("🚀 Отримано дані стейкінгу:", data);
            return data;
        } catch (error) {
            console.error("🚀 Помилка отримання даних стейкінгу:", error);
            return { hasActiveStaking: false };
        }
    }

    /**
     * Завершення стейкінгу і нарахування винагороди
     * @private
     * @param {Object} stakingData - Дані стейкінгу
     */
    _finalizeStaking(stakingData) {
        try {
            if (!stakingData || !stakingData.hasActiveStaking) return false;

            // Рахуємо загальну суму (стейкінг + винагорода)
            const totalAmount = stakingData.stakingAmount + stakingData.expectedReward;

            // Додаємо суму до балансу
            this.addTokens(totalAmount);

            // Додаємо транзакцію про завершення стейкінгу
            this.addTransaction('unstake', totalAmount,
                `Стейкінг завершено: ${stakingData.stakingAmount} + ${stakingData.expectedReward} винагорода`);

            // Очищаємо дані стейкінгу
            const emptyStakingData = { hasActiveStaking: false };
            this.saveStakingData(emptyStakingData);

            // Показуємо повідомлення
            this.showAlert(`Стейкінг завершено! Ви отримали ${totalAmount.toFixed(2)} $WINIX (включаючи винагороду ${stakingData.expectedReward.toFixed(2)} $WINIX)`);

            return true;
        } catch (error) {
            console.error("🚀 Помилка завершення стейкінгу:", error);
            return false;
        }
    }

    /**
     * Збереження даних стейкінгу
     * @param {Object} stakingData - Дані стейкінгу для збереження
     * @returns {boolean} Результат операції
     */
    saveStakingData(stakingData) {
        console.log("🚀 Збереження даних стейкінгу:", stakingData);

        try {
            // Зберігаємо у всіх форматах для максимальної сумісності
            const simpleFormat = JSON.stringify(stakingData);
            localStorage.setItem(this.STORAGE_KEYS.STAKING_DATA, simpleFormat);
            localStorage.setItem(this.STORAGE_KEYS.WINIX_STAKING_DATA, simpleFormat);
            localStorage.setItem('winix_staking_data', simpleFormat);

            // Зберігаємо також у форматі StakingSystem, якщо є активний стейкінг
            if (stakingData.hasActiveStaking) {
                const systemFormat = {
                    activeStaking: [{
                        id: stakingData.stakingId || ('staking_' + Date.now()),
                        amount: stakingData.stakingAmount,
                        period: stakingData.period,
                        rewardPercent: stakingData.rewardPercent,
                        expectedReward: stakingData.expectedReward,
                        remainingDays: stakingData.remainingDays || stakingData.period,
                        startTime: stakingData.startTime || stakingData.startDate || new Date().toISOString(),
                        endTime: stakingData.endTime || stakingData.endDate || new Date().toISOString(),
                        status: 'active'
                    }],
                    stakingHistory: [],
                    totalStaked: stakingData.stakingAmount,
                    totalRewards: 0,
                    lastUpdated: new Date().toISOString()
                };

                localStorage.setItem(this.STORAGE_KEYS.STAKING_SYSTEM_DATA, JSON.stringify(systemFormat));
            } else {
                // Очищаємо системний формат, якщо немає активного стейкінгу
                const emptySystemFormat = {
                    activeStaking: [],
                    stakingHistory: [],
                    totalStaked: 0,
                    totalRewards: 0,
                    lastUpdated: new Date().toISOString()
                };
                localStorage.setItem(this.STORAGE_KEYS.STAKING_SYSTEM_DATA, JSON.stringify(emptySystemFormat));
            }

            return true;
        } catch (error) {
            console.error("🚀 Помилка збереження даних стейкінгу:", error);
            return false;
        }
    }

    /**
     * Синхронізація ключів сховища для стейкінгу
     * @private
     * @returns {boolean} Чи знайдено активний стейкінг
     */
    _syncStakingStorageKeys() {
        try {
            // Спроба синхронізувати всі ключі
            const keys = [
                this.STORAGE_KEYS.STAKING_DATA,
                this.STORAGE_KEYS.WINIX_STAKING_DATA,
                'winix_staking_data',
                this.STORAGE_KEYS.STAKING_SYSTEM_DATA
            ];
            let bestData = null;

            // Знаходимо найкращі дані з усіх ключів
            for (const key of keys) {
                const dataStr = localStorage.getItem(key);
                if (!dataStr) continue;

                try {
                    const data = JSON.parse(dataStr);

                    // Перевіряємо, чи це активний стейкінг
                    if (data.hasActiveStaking === true ||
                       (data.activeStaking && data.activeStaking.length > 0)) {
                        bestData = data;
                        break;
                    }
                } catch (e) {
                    console.warn(`🚀 Помилка розбору JSON для ключа ${key}:`, e);
                }
            }

            // Якщо знайдено дані стейкінгу, зберігаємо їх в усіх форматах
            if (bestData) {
                console.log("🚀 Знайдено активний стейкінг, синхронізуємо:", bestData);

                // Зберігаємо в простому форматі
                if (bestData.hasActiveStaking === undefined && bestData.activeStaking && bestData.activeStaking.length > 0) {
                    // Конвертуємо формат StakingSystem у простий формат
                    const staking = bestData.activeStaking[0];
                    const simpleData = {
                        hasActiveStaking: true,
                        stakingId: staking.id || ('staking_' + Date.now()),
                        stakingAmount: staking.amount || staking.stakingAmount,
                        period: staking.period,
                        rewardPercent: staking.rewardPercent,
                        expectedReward: staking.expectedReward,
                        remainingDays: staking.remainingDays || staking.period,
                        startTime: staking.startTime || staking.startDate || new Date().toISOString(),
                        endTime: staking.endTime || staking.endDate || new Date().toISOString(),
                        startDate: staking.startTime || staking.startDate || new Date().toISOString(),
                        endDate: staking.endTime || staking.endDate || new Date().toISOString()
                    };

                    this.saveStakingData(simpleData);
                }
                else if (bestData.hasActiveStaking === true) {
                    // Це вже простий формат, зберігаємо його
                    this.saveStakingData(bestData);
                }

                console.log("🚀 Дані стейкінгу синхронізовано в усіх ключах");
                return true;
            }

            return false;
        } catch (e) {
            console.error("🚀 Помилка синхронізації сховища стейкінгу:", e);
            return false;
        }
    }

    /**
     * Перевірити наявність активного стейкінгу
     * @returns {boolean} Чи є активний стейкінг
     */
    hasActiveStaking() {
        try {
            const stakingData = this.getStakingData();
            return stakingData && stakingData.hasActiveStaking === true;
        } catch (error) {
            console.error("🚀 Помилка перевірки активного стейкінгу:", error);
            return false;
        }
    }

    /**
     * Розрахувати очікувану винагороду за стейкінг
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу у днях
     * @returns {number} Очікувана винагорода
     */
    calculateStakingReward(amount, period) {
        try {
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || amount <= 0 || isNaN(period) || period <= 0) {
                return 0;
            }

            // Отримуємо відсоток для обраного періоду
            let rewardPercent = this.STAKING_RATES[period] || 7;

            // Розраховуємо винагороду
            const reward = amount * (rewardPercent / 100);

            return parseFloat(reward.toFixed(2));
        } catch (error) {
            console.error("🚀 Помилка розрахунку винагороди за стейкінг:", error);
            return 0;
        }
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу у днях
     * @returns {Object} Результат операції
     */
    createStaking(amount, period) {
        console.log(`🚀 Створення стейкінгу: сума=${amount}, період=${period}`);

        // Захист від повторного виклику
        if (this._isCreatingStaking) {
            console.log("🚀 Вже виконується створення стейкінгу, пропускаємо");
            return { success: false, message: "Операція вже виконується" };
        }

        this._isCreatingStaking = true;

        try {
            amount = parseFloat(amount);
            period = parseInt(period);

            if (isNaN(amount) || amount <= 0) {
                this.showAlert("Будь ласка, введіть коректну суму для стейкінгу", false);
                return { success: false, message: "Невірна сума" };
            }

            // Обмеження на максимальну суму стейкінгу
            const maxStakingAmount = 10000;
            if (amount > maxStakingAmount) {
                this.showAlert(`Максимальна сума для стейкінгу: ${maxStakingAmount} WINIX`, false);
                return { success: false, message: "Перевищено максимальну суму" };
            }

            // Перевіряємо, чи є вже активний стейкінг
            if (this.hasActiveStaking()) {
                this.showAlert("У вас вже є активний стейкінг", false);
                return { success: false, message: "Вже є активний стейкінг" };
            }

            // Перевіряємо баланс
            const userTokens = this.getTokens();
            if (amount > userTokens) {
                this.showAlert(`Недостатньо коштів. Ваш баланс: ${userTokens.toFixed(2)} WINIX`, false);
                return { success: false, message: "Недостатньо коштів" };
            }

            // Визначаємо відсоток відповідно до періоду
            let rewardPercent = this.STAKING_RATES[period] || 7;

            // Розрахунок очікуваної винагороди
            const expectedReward = this.calculateStakingReward(amount, period);

            // Перевірка на адекватність винагороди
            if (expectedReward > amount) {
                console.warn("🔒 Виявлено некоректну винагороду при створенні стейкінгу:", expectedReward);
                this.showAlert("Виявлено помилку в розрахунку винагороди", false);
                return { success: false, message: "Помилка розрахунку винагороди" };
            }

            // Створюємо дані стейкінгу
            const currentDate = new Date();
            const endDate = new Date(currentDate);
            endDate.setDate(endDate.getDate() + period);

            const stakingId = 'staking_' + Date.now();

            // Створюємо дані в простому форматі
            const stakingData = {
                hasActiveStaking: true,
                stakingId: stakingId,
                stakingAmount: amount,
                period: period,
                rewardPercent: rewardPercent,
                expectedReward: expectedReward,
                remainingDays: period,
                startDate: currentDate.toISOString(),
                endDate: endDate.toISOString(),
                startTime: currentDate.toISOString(),
                endTime: endDate.toISOString(),
                creationTimestamp: Date.now()
            };

            // Знімаємо кошти
            if (!this.subtractTokens(amount, `Стейкінг на ${period} днів (${rewardPercent}%)`)) {
                this.showAlert("Помилка при знятті коштів", false);
                return { success: false, message: "Помилка списання коштів" };
            }

            // Зберігаємо дані стейкінгу
            if (!this.saveStakingData(stakingData)) {
                // Якщо не вдалося зберегти дані, повертаємо кошти
                this.addTokens(amount);
                this.showAlert("Помилка при збереженні даних стейкінгу", false);
                return { success: false, message: "Помилка збереження" };
            }

            // Додаємо мітку часу стейкінгу
            localStorage.setItem(this.STORAGE_KEYS.LAST_STAKING_TIMESTAMP, Date.now().toString());

            // Додаємо транзакцію стейкінгу
            this.addTransaction('stake', amount, `Стейкінг на ${period} днів (${rewardPercent}%)`);

            console.log("🚀 Стейкінг успішно створено:", stakingData);

            // Показуємо повідомлення про успіх
            this.showAlert("Стейкінг успішно створено!");

            // Оновлюємо відображення на сторінці
            setTimeout(() => {
                this.updateStakingDisplay();
            }, 500);

            return {
                success: true,
                message: "Стейкінг успішно створено",
                shouldRedirect: true
            };
        } catch (error) {
            console.error("🚀 Помилка створення стейкінгу:", error);
            this.showAlert("Сталася помилка при створенні стейкінгу", false);
            return { success: false, message: "Помилка створення стейкінгу" };
        } finally {
            setTimeout(() => {
                this._isCreatingStaking = false;
            }, 1000);
        }
    }

    /**
     * Додавання коштів до існуючого стейкінгу
     * @param {string} stakingId - Ідентифікатор стейкінгу (не використовується)
     * @param {number} amount - Сума для додавання
     * @returns {Object} Результат операції
     */
    addToExistingStaking(stakingId, amount) {
        console.log(`🚀 Додавання до стейкінгу: ${amount} WINIX`);

        // Захист від повторного виклику
        if (this._isAddingToStaking) {
            console.log("🚀 Вже виконується додавання до стейкінгу, пропускаємо");
            return { success: false, message: "Операція вже виконується" };
        }

        this._isAddingToStaking = true;

        try {
            amount = parseFloat(amount);

            if (isNaN(amount) || amount <= 0) {
                this.showAlert("Будь ласка, введіть коректну суму", false);
                return { success: false, message: "Невірна сума" };
            }

            // Перевіряємо наявність активного стейкінгу
            if (!this.hasActiveStaking()) {
                this.showAlert("У вас немає активного стейкінгу", false);
                return { success: false, message: "Немає активного стейкінгу" };
            }

            // Перевіряємо баланс
            const userTokens = this.getTokens();
            if (amount > userTokens) {
                this.showAlert(`Недостатньо коштів. Ваш баланс: ${userTokens.toFixed(2)} WINIX`, false);
                return { success: false, message: "Недостатньо коштів" };
            }

            // Отримуємо поточні дані стейкінгу
            const stakingData = this.getStakingData();

            // Знімаємо кошти
            if (!this.subtractTokens(amount, `Додавання до стейкінгу`)) {
                this.showAlert("Помилка при знятті коштів", false);
                return { success: false, message: "Помилка списання коштів" };
            }

            // Оновлюємо дані стейкінгу
            stakingData.stakingAmount += amount;
            stakingData.expectedReward = this.calculateStakingReward(stakingData.stakingAmount, stakingData.period);

            // Зберігаємо оновлені дані
            if (!this.saveStakingData(stakingData)) {
                // Якщо не вдалося зберегти, повертаємо кошти
                this.addTokens(amount);
                this.showAlert("Помилка при збереженні даних стейкінгу", false);
                return { success: false, message: "Помилка збереження" };
            }

            // Додаємо мітку часу
            localStorage.setItem(this.STORAGE_KEYS.LAST_STAKING_TIMESTAMP, Date.now().toString());

            // Додаємо транзакцію
            this.addTransaction('stake', amount, `Додавання до стейкінгу`);

            console.log("🚀 Стейкінг успішно поповнено:", stakingData);

            // Показуємо повідомлення про успіх
            this.showAlert(`Додано ${amount.toFixed(2)} WINIX до стейкінгу`);

            // Оновлюємо відображення на сторінці
            setTimeout(() => {
                this.updateStakingDisplay();
            }, 500);

            return { success: true, message: `Додано ${amount.toFixed(2)} WINIX до стейкінгу` };
        } catch (error) {
            console.error("🚀 Помилка додавання до стейкінгу:", error);
            this.showAlert("Сталася помилка при додаванні до стейкінгу", false);
            return { success: false, message: "Помилка додавання до стейкінгу" };
        } finally {
            setTimeout(() => {
                this._isAddingToStaking = false;
            }, 1000);
        }
    }

    /**
     * Скасування стейкінгу
     * @returns {Object} Результат операції
     */
    cancelStaking() {
        console.log("🚀 Скасування стейкінгу");

        // Захист від повторного виклику
        if (this._isCancellingStaking) {
            console.log("🚀 Вже виконується скасування стейкінгу, пропускаємо");
            return { success: false, message: "Операція вже виконується" };
        }

        this._isCancellingStaking = true;

        try {
            // Перевіряємо наявність активного стейкінгу
            if (!this.hasActiveStaking()) {
                this.showAlert("У вас немає активного стейкінгу", false);
                return { success: false, message: "Немає активного стейкінгу" };
            }

            // Отримуємо дані стейкінгу
            const stakingData = this.getStakingData();

            // Перевірка на валідність даних стейкінгу
            if (!stakingData.stakingId || !stakingData.stakingAmount || stakingData.stakingAmount <= 0) {
                console.warn("🔒 Виявлено невалідні дані стейкінгу при скасуванні:", stakingData);
                this.showAlert("Неможливо скасувати стейкінг з некоректними даними", false);

                // Очищаємо невалідні дані
                this._cleanupInvalidStakingData();
                return { success: false, message: "Невалідні дані стейкінгу" };
            }

            // Маємо запам'ятати ідентифікатор скасованого стейкінгу
            const canceledStakingId = stakingData.stakingId;

            // Перевіряємо, чи не було вже скасовано цей стейкінг
            const canceledStakings = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CANCELED_STAKINGS) || '[]');
            if (canceledStakings.includes(canceledStakingId)) {
                console.warn("🔒 Виявлено спробу повторно скасувати той самий стейкінг:", canceledStakingId);
                this.showAlert("Цей стейкінг вже було скасовано", false);

                // Очищаємо дані стейкінгу, якщо вони залишились
                this._cleanupInvalidStakingData();
                return { success: false, message: "Стейкінг вже скасовано" };
            }

            // Додаємо ідентифікатор до списку скасованих
            canceledStakings.push(canceledStakingId);
            localStorage.setItem(this.STORAGE_KEYS.CANCELED_STAKINGS, JSON.stringify(canceledStakings));

            // Зберігаємо час скасування
            localStorage.setItem(this.STORAGE_KEYS.LAST_CANCEL_TIMESTAMP, Date.now().toString());

            // Розраховуємо суму для повернення (80% коштів)
            const returnAmount = stakingData.stakingAmount * 0.8;

            // Створюємо контрольну копію даних
            const stakingDataCopy = { ...stakingData };

            // Очищаємо дані стейкінгу ПЕРЕД поверненням коштів
            const emptyStakingData = {
                hasActiveStaking: false,
                stakingId: null,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0
            };

            // Важливо зберегти контрольну копію даних для аудиту
            localStorage.setItem('lastCanceledStaking', JSON.stringify({
                stakingId: stakingData.stakingId,
                stakingAmount: stakingData.stakingAmount,
                cancelTime: Date.now()
            }));

            // Зберігаємо порожні дані перед поверненням коштів
            this.saveStakingData(emptyStakingData);

            // Додаємо кошти до балансу ПІСЛЯ очищення даних стейкінгу
            this.addTokens(returnAmount);

            // Додаємо транзакцію про скасування стейкінгу
            this.addTransaction('unstake', returnAmount,
                `Стейкінг скасовано (утримано 20% як штраф)`);

            console.log("🚀 Стейкінг успішно скасовано");

            // Показуємо повідомлення про успіх
            this.showAlert(`Стейкінг скасовано. Повернено ${returnAmount.toFixed(2)} WINIX (утримано 20% як штраф)`);

            return {
                success: true,
                message: `Стейкінг скасовано. Повернено ${returnAmount.toFixed(2)} WINIX`,
                shouldRedirect: true
            };
        } catch (error) {
            console.error("🚀 Помилка скасування стейкінгу:", error);
            this.showAlert("Сталася помилка при скасуванні стейкінгу", false);
            return { success: false, message: "Помилка скасування стейкінгу" };
        } finally {
            setTimeout(() => {
                this._isCancellingStaking = false;
            }, 1000);
        }
    }

    /**
     * Очищення невалідних даних стейкінгу
     * @private
     */
    _cleanupInvalidStakingData() {
        const emptyStakingData = {
            hasActiveStaking: false,
            stakingId: null,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0
        };

        // Очищаємо всі дані стейкінгу з усіх можливих ключів
        localStorage.setItem(this.STORAGE_KEYS.STAKING_DATA, JSON.stringify(emptyStakingData));
        localStorage.setItem(this.STORAGE_KEYS.WINIX_STAKING_DATA, JSON.stringify(emptyStakingData));
        localStorage.setItem('winix_staking_data', JSON.stringify(emptyStakingData));
        localStorage.setItem(this.STORAGE_KEYS.STAKING_SYSTEM_DATA, JSON.stringify({
            activeStaking: [],
            stakingHistory: [],
            totalStaked: 0,
            lastUpdated: new Date().toISOString()
        }));

        console.log("🔒 Проведено очищення невалідних даних стейкінгу");
    }

    /* ===== UI ТА ВІДОБРАЖЕННЯ ===== */

    /**
     * Оновлення відображення балансу на сторінці
     * @returns {boolean} Результат операції
     */
    updateBalanceDisplay() {
        try {
            // Отримуємо поточний баланс
            const tokenBalance = this.getTokens();
            const coinsBalance = this.getCoins();

            console.log(`🚀 Оновлюємо відображення балансу: ${tokenBalance} WINIX, ${coinsBalance} жетонів`);

            // Оновлюємо всі елементи, які показують баланс токенів
            const tokenSelectors = [
                '#user-tokens',
                '#main-balance',
                '.balance-amount',
                '#current-balance',
                '.balance-value'
            ];

            tokenSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        // Якщо елемент має спеціальну розмітку для іконки, зберігаємо її
                        if (element.id === 'main-balance' && element.innerHTML && element.innerHTML.includes('main-balance-icon')) {
                            element.innerHTML = `${tokenBalance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" width="100" height="100" alt="WINIX"></span>`;
                        } else {
                            element.textContent = tokenBalance.toFixed(2);
                        }
                    }
                });
            });

            // Оновлюємо відображення жетонів
            const coinsSelectors = [
                '#user-coins',
                '.coins-amount',
                '.coins-value'
            ];

            coinsSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element) {
                        element.textContent = coinsBalance.toFixed(0);
                    }
                });
            });

            // Оновлюємо транзакції
            this.updateTransactionsList();

            return true;
        } catch (error) {
            console.error("🚀 Помилка оновлення відображення балансу:", error);
            return false;
        }
    }

    /**
     * Оновлення відображення стейкінгу на сторінці
     * @returns {boolean} Результат операції
     */
    updateStakingDisplay() {
        try {
            // Отримуємо дані стейкінгу
            const stakingData = this.getStakingData();
            const hasStaking = stakingData && stakingData.hasActiveStaking;

            console.log("🚀 Оновлюємо відображення стейкінгу:", hasStaking ? "є активний стейкінг" : "немає активного стейкінгу");

            // Якщо ми на сторінці стейкінгу
            if (window.location.href.includes('staking.html')) {
                // Оновлюємо статус стейкінгу
                const statusElement = document.getElementById('staking-status');
                if (statusElement) {
                    statusElement.textContent = hasStaking
                        ? `У стейкінгу: ${stakingData.stakingAmount.toFixed(2)} $WINIX`
                        : "Наразі немає активних стейкінгів";
                }

                // Оновлюємо видимість кнопок
                const detailsButton = document.getElementById('details-button');
                const cancelButton = document.getElementById('cancel-staking-button');

                if (detailsButton) {
                    detailsButton.style.opacity = hasStaking ? '1' : '0.5';
                    detailsButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }

                if (cancelButton) {
                    cancelButton.style.opacity = hasStaking ? '1' : '0.5';
                    cancelButton.style.pointerEvents = hasStaking ? 'auto' : 'none';
                }

                // Якщо є форма стейкінгу, оновлюємо очікувану винагороду при введенні
                const amountInput = document.getElementById('staking-amount');
                const periodSelect = document.getElementById('staking-period');
                const rewardElement = document.getElementById('expected-reward');

                if (amountInput && rewardElement) {
                    const updateReward = () => {
                        const amount = parseFloat(amountInput.value) || 0;
                        const period = periodSelect ? parseInt(periodSelect.value) : 14;
                        const reward = this.calculateStakingReward(amount, period);
                        rewardElement.textContent = reward.toFixed(2);
                    };

                    // Додаємо обробники тільки якщо їх ще немає
                    if (!amountInput.hasAttribute('data-reward-handler-set')) {
                        amountInput.addEventListener('input', updateReward);
                        amountInput.setAttribute('data-reward-handler-set', 'true');
                    }

                    if (periodSelect && !periodSelect.hasAttribute('data-reward-handler-set')) {
                        periodSelect.addEventListener('change', updateReward);
                        periodSelect.setAttribute('data-reward-handler-set', 'true');
                    }

                    // Ініціюємо перше оновлення
                    updateReward();
                }
            }
            // Якщо ми на сторінці деталей стейкінгу
            else if (window.location.href.includes('staking-details.html')) {
                // Якщо немає активного стейкінгу, перенаправляємо на сторінку стейкінгу
                if (!hasStaking) {
                    this.showAlert("У вас немає активного стейкінгу", false, () => {
                        window.location.href = "staking.html";
                    });
                    return false;
                }

                // Оновлюємо елементи інтерфейсу
                const amountElement = document.getElementById('staking-amount');
                const periodElement = document.getElementById('staking-period');
                const rewardPercentElement = document.getElementById('staking-reward-percent');
                const expectedRewardElement = document.getElementById('staking-expected-reward');
                const remainingDaysElement = document.getElementById('staking-remaining-days');

                if (amountElement) amountElement.textContent = `${stakingData.stakingAmount.toFixed(2)} $WINIX`;
                if (periodElement) periodElement.textContent = `${stakingData.period} днів`;
                if (rewardPercentElement) rewardPercentElement.textContent = `${stakingData.rewardPercent}%`;
                if (expectedRewardElement) expectedRewardElement.textContent = `${stakingData.expectedReward.toFixed(2)} $WINIX`;
                if (remainingDaysElement) remainingDaysElement.textContent = stakingData.remainingDays.toString();
            }

            return true;
        } catch (error) {
            console.error("🚀 Помилка оновлення відображення стейкінгу:", error);
            return false;
        }
    }

    /**
     * Встановлення обробників подій DOM
     * @private
     */
    _initDomHandlersWithDelay() {
        // Запускаємо з затримкою, щоб інші скрипти були завантажені
        setTimeout(() => {
            this._setupStakingButtons();
            this.updateBalanceDisplay();
            this.updateStakingDisplay();
        }, 500);

        // Оновлюємо після повного завантаження сторінки
        window.addEventListener('load', () => {
            this.updateBalanceDisplay();
            this.updateStakingDisplay();
            this._setupStakingButtons();
        });

        // Встановлюємо обробники на DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            this.updateBalanceDisplay();
            this.updateStakingDisplay();
            this._setupStakingButtons();
        });
    }

    /**
     * Налаштування кнопок для стейкінгу
     * @private
     */
    _setupStakingButtons() {
        // Кнопка створення стейкінгу
        const stakeButton = document.getElementById('stake-button');
        if (stakeButton && !stakeButton.getAttribute('data-handler-set')) {
            console.log("🚀 Налаштовуємо кнопку створення стейкінгу");

            const newButton = stakeButton.cloneNode(true);
            stakeButton.parentNode.replaceChild(newButton, stakeButton);
            newButton.setAttribute('data-handler-set', 'true');

            newButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log("🚀 Натиснуто кнопку стейкінгу");

                // Отримуємо значення суми
                const amountInput = document.getElementById('staking-amount');
                if (!amountInput) {
                    this.showAlert("Помилка: поле суми не знайдено", false);
                    return;
                }

                const amount = parseFloat(amountInput.value);
                if (isNaN(amount) || amount <= 0) {
                    this.showAlert("Будь ласка, введіть коректну суму для стейкінгу", false);
                    return;
                }

                // Отримуємо період
                let period = 14; // За замовчуванням
                const periodSelect = document.getElementById('staking-period');
                if (periodSelect) {
                    period = parseInt(periodSelect.value);
                }

                // Створюємо стейкінг
                const result = this.createStaking(amount, period);
                if (result.success && result.shouldRedirect) {
                    setTimeout(() => {
                        window.location.href = "staking-details.html";
                    }, 1000);
                }
            });
        }

        // Кнопка додавання до стейкінгу
        const addToStakeButton = document.getElementById('add-to-stake-button');
        if (addToStakeButton && !addToStakeButton.getAttribute('data-handler-set')) {
            console.log("🚀 Налаштовуємо кнопку додавання до стейкінгу");

            const newButton = addToStakeButton.cloneNode(true);
            addToStakeButton.parentNode.replaceChild(newButton, addToStakeButton);
            newButton.setAttribute('data-handler-set', 'true');

            newButton.addEventListener('click', async () => {
                console.log("🚀 Натиснуто кнопку додавання до стейкінгу");

                // Запитуємо суму для додавання
                const amount = await this.showInputModal("Введіть суму для додавання до стейкінгу");
                if (!amount) return;

                // Додаємо до стейкінгу
                const stakingData = this.getStakingData();
                this.addToExistingStaking(stakingData.stakingId || 'default', amount);
            });
        }

        // Кнопка скасування стейкінгу
        const cancelStakingButton = document.getElementById('cancel-staking-button');
        if (cancelStakingButton && !cancelStakingButton.getAttribute('data-handler-set')) {
            console.log("🚀 Налаштовуємо кнопку скасування стейкінгу");

            const newButton = cancelStakingButton.cloneNode(true);
            cancelStakingButton.parentNode.replaceChild(newButton, cancelStakingButton);
            newButton.setAttribute('data-handler-set', 'true');

            newButton.addEventListener('click', async () => {
                console.log("🚀 Натиснуто кнопку скасування стейкінгу");

                // Запитуємо підтвердження
                const confirmed = await this.showConfirm(
                    "Ви впевнені, що хочете скасувати стейкінг? Буде утримано 20% від суми стейкінгу."
                );

                if (!confirmed) {
                    console.log("🚀 Скасування відмінено користувачем");
                    return;
                }

                // Скасовуємо стейкінг
                const result = this.cancelStaking();
                if (result.success && result.shouldRedirect) {
                    setTimeout(() => {
                        window.location.href = "staking.html";
                    }, 1000);
                }
            });
        }

        // Кнопка деталей стейкінгу
        const detailsButton = document.getElementById('details-button');
        if (detailsButton && !detailsButton.getAttribute('data-handler-set')) {
            console.log("🚀 Налаштовуємо кнопку деталей стейкінгу");

            const newButton = detailsButton.cloneNode(true);
            detailsButton.parentNode.replaceChild(newButton, detailsButton);
            newButton.setAttribute('data-handler-set', 'true');

            newButton.addEventListener('click', () => {
                console.log("🚀 Натиснуто кнопку деталей стейкінгу");

                // Перевіряємо наявність активного стейкінгу
                if (this.hasActiveStaking()) {
                    window.location.href = "staking-details.html";
                } else {
                    this.showAlert("У вас немає активного стейкінгу", false);
                }
            });
        }
    }

    /* ===== МОДАЛЬНІ ВІКНА ТА ПОВІДОМЛЕННЯ ===== */

    /**
     * Показати спливаюче повідомлення
     * @param {string} message - Текст повідомлення
     * @param {boolean} isSuccess - Чи успішна операція (зелений/червоний кольори)
     * @param {Function} callback - Функція зворотного виклику після закриття
     */
    showAlert(message, isSuccess = true, callback = null) {
        try {
            // Створюємо елементи
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '9999';

            const alert = document.createElement('div');
            alert.style.backgroundColor = isSuccess ? '#16213e' : '#3e1616';
            alert.style.borderRadius = '15px';
            alert.style.padding = '20px';
            alert.style.width = '300px';
            alert.style.textAlign = 'center';
            alert.style.boxShadow = isSuccess ? '0 0 20px rgba(0, 201, 167, 0.4)' : '0 0 20px rgba(201, 0, 0, 0.4)';
            alert.style.border = isSuccess ? '1px solid rgba(0, 201, 167, 0.3)' : '1px solid rgba(201, 0, 0, 0.3)';

            const text = document.createElement('p');
            text.textContent = message;
            text.style.color = 'white';
            text.style.margin = '0 0 20px 0';

            const btn = document.createElement('button');
            btn.textContent = 'OK';
            btn.style.padding = '10px 30px';
            btn.style.backgroundColor = isSuccess ? '#00c9a7' : '#c90000';
            btn.style.border = 'none';
            btn.style.borderRadius = '8px';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';

            // Додаємо елементи до DOM
            alert.appendChild(text);
            alert.appendChild(btn);
            overlay.appendChild(alert);
            document.body.appendChild(overlay);

            // Функція закриття повідомлення
            const closeAlert = () => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                    if (callback) callback();
                }
            };

            // Обробник кліку
            btn.addEventListener('click', closeAlert);

            // Автоматичне закриття
            setTimeout(closeAlert, 3000);
        } catch (error) {
            console.error("🚀 Помилка показу повідомлення:", error);
            alert(message);
            if (callback) callback();
        }
    }

    /**
     * Показати діалог підтвердження
     * @param {string} message - Текст запитання
     * @returns {Promise<boolean>} Promise з результатом підтвердження
     */
    async showConfirm(message) {
        return new Promise((resolve) => {
            try {
                // Створюємо елементи
                const overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.zIndex = '9999';

                const confirm = document.createElement('div');
                confirm.style.backgroundColor = '#16213e';
                confirm.style.borderRadius = '15px';
                confirm.style.padding = '20px';
                confirm.style.width = '300px';
                confirm.style.textAlign = 'center';
                confirm.style.boxShadow = '0 0 20px rgba(201, 0, 0, 0.4)';
                confirm.style.border = '1px solid rgba(201, 0, 0, 0.3)';

                const text = document.createElement('p');
                text.textContent = message;
                text.style.color = 'white';
                text.style.margin = '0 0 20px 0';

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'space-between';
                buttonContainer.style.gap = '10px';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Ні';
                cancelBtn.style.padding = '10px';
                cancelBtn.style.width = '48%';
                cancelBtn.style.backgroundColor = '#1e2747';
                cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                cancelBtn.style.borderRadius = '8px';
                cancelBtn.style.color = 'white';
                cancelBtn.style.cursor = 'pointer';

                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = 'Так';
                confirmBtn.style.padding = '10px';
                confirmBtn.style.width = '48%';
                confirmBtn.style.backgroundColor = '#c90000';
                confirmBtn.style.border = 'none';
                confirmBtn.style.borderRadius = '8px';
                confirmBtn.style.color = 'white';
                confirmBtn.style.cursor = 'pointer';

                // Додаємо елементи до DOM
                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(confirmBtn);
                confirm.appendChild(text);
                confirm.appendChild(buttonContainer);
                overlay.appendChild(confirm);
                document.body.appendChild(overlay);

                // Обробники подій
                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(overlay);
                    resolve(false);
                });

                confirmBtn.addEventListener('click', () => {
                    document.body.removeChild(overlay);
                    resolve(true);
                });
            } catch (error) {
                console.error("🚀 Помилка показу підтвердження:", error);
                resolve(confirm(message));
            }
        });
    }

    /**
     * Показати модальне вікно для введення значення
     * @param {string} title - Заголовок вікна
     * @returns {Promise<number|null>} Promise з введеним значенням або null
     */
    async showInputModal(title) {
        return new Promise((resolve) => {
            try {
                // Створюємо елементи
                const overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.zIndex = '9999';

                const modal = document.createElement('div');
                modal.style.backgroundColor = '#16213e';
                modal.style.borderRadius = '15px';
                modal.style.padding = '20px';
                modal.style.width = '300px';
                modal.style.boxShadow = '0 0 20px rgba(0, 201, 167, 0.4)';
                modal.style.border = '1px solid rgba(0, 201, 167, 0.3)';

                const header = document.createElement('h3');
                header.textContent = title;
                header.style.textAlign = 'center';
                header.style.margin = '0 0 20px 0';
                header.style.color = 'white';

                const input = document.createElement('input');
                input.type = 'number';
                input.placeholder = 'Введіть суму';
                input.style.width = '100%';
                input.style.padding = '10px';
                input.style.boxSizing = 'border-box';
                input.style.marginBottom = '20px';
                input.style.backgroundColor = '#1e2747';
                input.style.border = '1px solid rgba(0, 201, 167, 0.3)';
                input.style.borderRadius = '8px';
                input.style.color = 'white';
                input.style.fontSize = '16px';

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'space-between';
                buttonContainer.style.gap = '10px';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Скасувати';
                cancelBtn.style.padding = '10px';
                cancelBtn.style.width = '48%';
                cancelBtn.style.backgroundColor = '#1e2747';
                cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                cancelBtn.style.borderRadius = '8px';
                cancelBtn.style.color = 'white';
                cancelBtn.style.cursor = 'pointer';

                const okBtn = document.createElement('button');
                okBtn.textContent = 'OK';
                okBtn.style.padding = '10px';
                okBtn.style.width = '48%';
                okBtn.style.backgroundColor = '#00c9a7';
                okBtn.style.border = 'none';
                okBtn.style.borderRadius = '8px';
                okBtn.style.color = 'white';
                okBtn.style.cursor = 'pointer';

                // Додаємо елементи до DOM
                buttonContainer.appendChild(cancelBtn);
                buttonContainer.appendChild(okBtn);
                modal.appendChild(header);
                modal.appendChild(input);
                modal.appendChild(buttonContainer);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                // Фокусуємо input
                setTimeout(() => input.focus(), 100);

                // Обробники подій
                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(overlay);
                    resolve(null);
                });

                okBtn.addEventListener('click', () => {
                    const value = parseFloat(input.value);
                    if (!isNaN(value) && value > 0) {
                        document.body.removeChild(overlay);
                        resolve(value);
                    } else {
                        input.style.border = '1px solid red';
                        setTimeout(() => {
                            input.style.border = '1px solid rgba(0, 201, 167, 0.3)';
                        }, 500);
                    }
                });

                // Обробка Enter/Escape
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') okBtn.click();
                    if (e.key === 'Escape') cancelBtn.click();
                });
            } catch (error) {
                console.error("🚀 Помилка показу модального вікна введення:", error);
                const value = parseFloat(prompt(title));
                resolve(isNaN(value) || value <= 0 ? null : value);
            }
        });
    }