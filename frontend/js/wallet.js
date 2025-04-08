/**
 * wallet.js - Основна функціональність сторінки гаманця WINIX
 */

// Об'єкт для роботи з гаманцем
const WinixWallet = {
    // Налаштування
    config: {
        minSendAmount: 500,    // Мінімальна сума для відправки
        minReceiveAmount: 500, // Мінімальна сума для отримання
        transactionsLimit: 3,   // Кількість транзакцій на головній сторінці
        autoUpdateInterval: 30000  // Інтервал автооновлення (30 секунд)
    },

    // Стан програми
    state: {
        isLoading: false,
        userId: null,
        balance: 0,
        coins: 0,
        stakingAmount: 0,
        stakingRewards: 0,
        transactions: [],
        currentFilter: 'all'  // Поточний фільтр для історії транзакцій
    },

    // DOM-елементи
    elements: {},

    // Ініціалізація гаманця
    init: function() {
        console.log("WinixWallet: Ініціалізація...");

        // Отримуємо ID користувача
        this.state.userId = this.getUserId();

        // Ініціалізуємо DOM-елементи
        this.cacheElements();

        // Налаштовуємо обробники подій
        this.setupEventHandlers();

        // Завантажуємо дані користувача
        this.loadUserData();

        // Завантажуємо транзакції
        this.loadTransactions();

        // Налаштовуємо автооновлення
        this.setupAutoUpdates();

        console.log("WinixWallet: Ініціалізація завершена");
    },

    // Кешування DOM-елементів
    cacheElements: function() {
        // Елементи балансу
        this.elements.userTokens = document.getElementById('user-tokens');
        this.elements.userCoins = document.getElementById('user-coins');
        this.elements.mainBalance = document.getElementById('main-balance');

        // Елементи стейкінгу
        this.elements.stakingAmount = document.getElementById('staking-amount');
        this.elements.stakingRewards = document.getElementById('rewards-amount');

        // Елементи списку транзакцій
        this.elements.transactionsList = document.getElementById('transaction-list');

        // Кнопки дій
        this.elements.sendButton = document.getElementById('send-button');
        this.elements.receiveButton = document.getElementById('receive-button');
        this.elements.stakingButton = document.getElementById('staking-button');
        this.elements.viewAllButton = document.getElementById('view-all-transactions');

        // Модальні вікна
        this.elements.sendModal = document.getElementById('send-modal');
        this.elements.receiveModal = document.getElementById('receive-modal');
        this.elements.historyModal = document.getElementById('history-modal');

        // Елементи форми відправки
        this.elements.sendForm = document.getElementById('send-form');
        this.elements.recipientId = document.getElementById('recipient-id');
        this.elements.sendAmount = document.getElementById('send-amount');
        this.elements.sendNote = document.getElementById('send-note');
        this.elements.availableBalance = document.getElementById('available-balance');

        // Елементи вікна отримання
        this.elements.receiveId = document.getElementById('receive-id');
        this.elements.copyButton = document.getElementById('copy-id-button');

        // Елементи історії транзакцій
        this.elements.historyList = document.getElementById('history-list');
        this.elements.filterButtons = document.querySelectorAll('.filter-button');

        // Інші елементи
        this.elements.loadingIndicator = document.getElementById('loading-indicator');
    },

    // Налаштування обробників подій
    setupEventHandlers: function() {
        // Обробники для кнопок дій
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.openSendModal());
        }

        if (this.elements.receiveButton) {
            this.elements.receiveButton.addEventListener('click', () => this.openReceiveModal());
        }

        if (this.elements.stakingButton) {
            this.elements.stakingButton.addEventListener('click', () => {
                window.location.href = 'staking.html';
            });
        }

        if (this.elements.viewAllButton) {
            this.elements.viewAllButton.addEventListener('click', () => this.openHistoryModal());
        }

        // Обробники для модальних вікон
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    this.closeModal(modal);
                }
            });
        });

        // Обробник для форми відправки
        if (this.elements.sendForm) {
            this.elements.sendForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendFormSubmit();
            });
        }

        // Обробник для кнопки копіювання ID
        if (this.elements.copyButton) {
            this.elements.copyButton.addEventListener('click', () => this.copyReceiveId());
        }

        // Обробники для кнопок фільтрації транзакцій
        this.elements.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.getAttribute('data-filter');
                this.filterTransactions(filter);

                // Оновлюємо активну кнопку
                this.elements.filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
        });

        // Обробник для кнопки MAX в полі суми
        const maxButton = document.getElementById('max-button');
        if (maxButton && this.elements.sendAmount) {
            maxButton.addEventListener('click', () => {
                this.elements.sendAmount.value = Math.floor(this.state.balance);
            });
        }
    },

    // Налаштування автоматичного оновлення даних
    setupAutoUpdates: function() {
        setInterval(() => {
            // Оновлюємо дані користувача
            this.loadUserData(true); // true = тихе оновлення

            // Оновлюємо транзакції
            this.loadTransactions(true); // true = тихе оновлення
        }, this.config.autoUpdateInterval);
    },

    // Відкриття модального вікна відправки
    openSendModal: function() {
        // Очищаємо поля форми
        if (this.elements.recipientId) this.elements.recipientId.value = '';
        if (this.elements.sendAmount) this.elements.sendAmount.value = '';
        if (this.elements.sendNote) this.elements.sendNote.value = '';

        // Оновлюємо інформацію про доступний баланс
        if (this.elements.availableBalance) {
            this.elements.availableBalance.textContent = `Доступно: ${this.state.balance.toFixed(2)} $WINIX`;
        }

        // Відкриваємо модальне вікно
        if (this.elements.sendModal) {
            this.elements.sendModal.classList.add('show');

            // Встановлюємо фокус на поле ID отримувача після відкриття
            setTimeout(() => {
                if (this.elements.recipientId) this.elements.recipientId.focus();
            }, 300);
        }
    },

    // Закриття модального вікна
    closeModal: function(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
    },

    // Обробка відправки форми переказу
    handleSendFormSubmit: function() {
        // Отримуємо дані з форми
        const recipientId = this.elements.recipientId.value.trim();
        const amount = parseFloat(this.elements.sendAmount.value);
        const note = this.elements.sendNote.value.trim();

        // Валідація даних
        if (!recipientId) {
            this.showError('Введіть ID отримувача');
            return;
        }

        if (recipientId === this.state.userId) {
            this.showError('Ви не можете відправити кошти самому собі');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            this.showError('Введіть коректну суму');
            return;
        }

        if (amount < this.config.minSendAmount) {
            this.showError(`Мінімальна сума відправлення ${this.config.minSendAmount} WINIX`);
            return;
        }

        if (amount > this.state.balance) {
            this.showError('Недостатньо коштів на балансі');
            return;
        }

        // Показуємо індикатор завантаження
        this.showLoading('Відправка коштів...');

        // Надсилаємо запит на відправку коштів
        this.sendTokens(recipientId, amount, note)
            .then(response => {
                // Приховуємо індикатор завантаження
                this.hideLoading();

                if (response.status === 'success') {
                    // Оновлюємо баланс
                    this.state.balance = parseFloat(response.data.sender_balance);
                    this.updateBalanceDisplay();

                    // Закриваємо модальне вікно
                    this.closeModal(this.elements.sendModal);

                    // Показуємо повідомлення про успішну відправку
                    this.showSuccess(`Успішно відправлено ${amount} WINIX користувачу ${recipientId}`);

                    // Оновлюємо список транзакцій
                    this.loadTransactions();
                } else {
                    // Показуємо повідомлення про помилку
                    this.showError(response.message || 'Помилка відправки коштів');
                }
            })
            .catch(error => {
                console.error('Помилка відправки коштів:', error);

                // Приховуємо індикатор завантаження
                this.hideLoading();

                // Показуємо повідомлення про помилку
                this.showError('Помилка відправки коштів. Спробуйте пізніше');
            });
    },

    // Відправка токенів
    sendTokens: function(recipientId, amount, note) {
        return new Promise((resolve, reject) => {
            // Підготовка даних для запиту
            const data = {
                sender_id: this.state.userId,
                receiver_id: recipientId,
                amount: amount,
                note: note
            };

            // Спроба використати WinixAPI, якщо він доступний
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                window.WinixAPI.apiRequest('/api/send_tokens', 'POST', data)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            // Якщо WinixAPI недоступний, використовуємо fetch API
            fetch('/api/send_tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(resolve)
            .catch(reject);
        });
    },

    // Відкриття модального вікна отримання
    openReceiveModal: function() {
        // Оновлюємо ID для отримання
        if (this.elements.receiveId) {
            this.elements.receiveId.textContent = this.state.userId;
        }

        // Відкриваємо модальне вікно
        if (this.elements.receiveModal) {
            this.elements.receiveModal.classList.add('show');
        }
    },

    // Копіювання ID для отримання
    copyReceiveId: function() {
        const receiveId = this.elements.receiveId.textContent;

        // Копіюємо в буфер обміну
        navigator.clipboard.writeText(receiveId)
            .then(() => {
                // Показуємо повідомлення про успішне копіювання
                this.showSuccess(`ID ${receiveId} скопійовано в буфер обміну`);
            })
            .catch(error => {
                console.error('Помилка копіювання ID:', error);

                // Резервний варіант копіювання
                this.fallbackCopyToClipboard(receiveId);
            });
    },

    // Резервний метод копіювання в буфер обміну
    fallbackCopyToClipboard: function(text) {
        // Створюємо тимчасовий input елемент
        const tempInput = document.createElement('input');
        tempInput.style.position = 'absolute';
        tempInput.style.left = '-1000px';
        tempInput.value = text;
        document.body.appendChild(tempInput);

        // Виділяємо текст і копіюємо
        tempInput.select();
        document.execCommand('copy');

        // Видаляємо тимчасовий елемент
        document.body.removeChild(tempInput);

        // Показуємо повідомлення про успішне копіювання
        this.showSuccess(`ID ${text} скопійовано в буфер обміну`);
    },

    // Відкриття модального вікна історії транзакцій
    openHistoryModal: function() {
        // Завантажуємо всі транзакції
        this.loadTransactions(false, 100);

        // Відкриваємо модальне вікно
        if (this.elements.historyModal) {
            this.elements.historyModal.classList.add('show');
        }
    },

    // Фільтрація транзакцій за типом
    filterTransactions: function(filter) {
        this.state.currentFilter = filter;
        this.updateTransactionsList(true);
    },

    // Завантаження даних користувача
    loadUserData: function(silent = false) {
        if (!silent) {
            this.showLoading('Завантаження даних користувача...');
        }

        // Спробуємо отримати дані з API
        this.fetchUserData()
            .then(data => {
                if (!silent) {
                    this.hideLoading();
                }

                if (data) {
                    // Оновлюємо дані
                    this.updateUserData(data);
                } else {
                    // Якщо дані не отримано, використовуємо локальне сховище
                    this.loadUserDataFromLocalStorage();
                }
            })
            .catch(error => {
                console.error('Помилка завантаження даних користувача:', error);

                if (!silent) {
                    this.hideLoading();
                }

                // Якщо сталася помилка, використовуємо локальне сховище
                this.loadUserDataFromLocalStorage();
            });
    },

    // Отримання даних користувача з API
    fetchUserData: function() {
        return new Promise((resolve, reject) => {
            // Спроба використати WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                window.WinixAPI.getUserData()
                    .then(response => {
                        if (response.status === 'success' && response.data) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message || 'Помилка отримання даних користувача'));
                        }
                    })
                    .catch(reject);
                return;
            }

            // Якщо WinixAPI недоступний, використовуємо fetch API
            fetch(`/api/user/${this.state.userId}/complete-balance`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success' && data.data) {
                        resolve(data.data);
                    } else {
                        reject(new Error(data.message || 'Помилка отримання даних користувача'));
                    }
                })
                .catch(reject);
        });
    },

    // Завантаження даних користувача з локального сховища
    loadUserDataFromLocalStorage: function() {
        try {
            // Завантажуємо баланс
            const tokens = parseFloat(localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0');
            const coins = parseInt(localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0');

            // Завантажуємо дані стейкінгу
            let stakingAmount = 0;
            let stakingRewards = 0;

            try {
                const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                if (stakingDataStr) {
                    const stakingData = JSON.parse(stakingDataStr);
                    if (stakingData && stakingData.hasActiveStaking) {
                        stakingAmount = parseFloat(stakingData.stakingAmount || 0);
                        stakingRewards = parseFloat(stakingData.expectedReward || 0);
                    }
                }
            } catch (e) {
                console.error('Помилка при парсингу даних стейкінгу:', e);
            }

            // Оновлюємо стан
            this.state.balance = tokens;
            this.state.coins = coins;
            this.state.stakingAmount = stakingAmount;
            this.state.stakingRewards = stakingRewards;

            // Оновлюємо інтерфейс
            this.updateBalanceDisplay();
            this.updateStakingDisplay();
        } catch (error) {
            console.error('Помилка завантаження даних з localStorage:', error);
        }
    },

    // Оновлення даних користувача
    updateUserData: function(data) {
        // Оновлюємо стан
        this.state.balance = parseFloat(data.balance || 0);
        this.state.coins = parseInt(data.coins || 0);
        this.state.stakingAmount = parseFloat(data.in_staking || 0);
        this.state.stakingRewards = parseFloat(data.expected_rewards || 0);

        // Оновлюємо інтерфейс
        this.updateBalanceDisplay();
        this.updateStakingDisplay();

        // Зберігаємо в localStorage
        localStorage.setItem('userTokens', this.state.balance.toString());
        localStorage.setItem('winix_balance', this.state.balance.toString());
        localStorage.setItem('userCoins', this.state.coins.toString());
        localStorage.setItem('winix_coins', this.state.coins.toString());
    },

    // Оновлення відображення балансу
    updateBalanceDisplay: function() {
        // Оновлюємо баланс токенів у шапці
        if (this.elements.userTokens) {
            this.elements.userTokens.textContent = this.state.balance.toFixed(2);
        }

        // Оновлюємо баланс жетонів у шапці
        if (this.elements.userCoins) {
            this.elements.userCoins.textContent = this.state.coins.toString();
        }

        // Оновлюємо головний баланс
        if (this.elements.mainBalance) {
            // Перевіряємо, чи елемент має дочірні елементи
            if (this.elements.mainBalance.childElementCount > 0) {
                // Якщо є дочірні елементи, оновлюємо лише текстовий вміст
                const textNode = this.elements.mainBalance.childNodes[0];
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    textNode.nodeValue = this.state.balance.toFixed(2) + ' ';
                } else {
                    // Якщо текстовий вузол не знайдено, оновлюємо весь HTML
                    this.elements.mainBalance.innerHTML = `${this.state.balance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" alt="WINIX"></span>`;
                }
            } else {
                // Якщо немає дочірніх елементів, оновлюємо весь HTML
                this.elements.mainBalance.innerHTML = `${this.state.balance.toFixed(2)} <span class="main-balance-icon"><img src="assets/token.png" alt="WINIX"></span>`;
            }
        }
    },

    // Оновлення відображення стейкінгу
    updateStakingDisplay: function() {
        // Оновлюємо суму в стейкінгу
        if (this.elements.stakingAmount) {
            this.elements.stakingAmount.textContent = this.state.stakingAmount.toFixed(2);
        }

        // Оновлюємо очікувані нагороди
        if (this.elements.stakingRewards) {
            this.elements.stakingRewards.textContent = this.state.stakingRewards.toFixed(2);
        }
    },

    // Завантаження транзакцій
    loadTransactions: function(silent = false, limit = this.config.transactionsLimit) {
        if (!silent) {
            this.showLoading('Завантаження транзакцій...');
        }

        // Спробуємо отримати транзакції з API
        this.fetchTransactions(limit)
            .then(transactions => {
                if (!silent) {
                    this.hideLoading();
                }

                if (transactions && transactions.length > 0) {
                    // Сортуємо транзакції за датою (від найновіших до найстаріших)
                    transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    // Оновлюємо стан
                    this.state.transactions = transactions;

                    // Оновлюємо список транзакцій
                    this.updateTransactionsList();
                } else {
                    // Якщо транзакцій не отримано, використовуємо локальне сховище
                    this.loadTransactionsFromLocalStorage();
                }
            })
            .catch(error => {
                console.error('Помилка завантаження транзакцій:', error);

                if (!silent) {
                    this.hideLoading();
                }

                // Якщо сталася помилка, використовуємо локальне сховище
                this.loadTransactionsFromLocalStorage();
            });
    },

    // Отримання транзакцій з API
    fetchTransactions: function(limit = this.config.transactionsLimit) {
        return new Promise((resolve, reject) => {
            // Спроба використати WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.getTransactions === 'function') {
                window.WinixAPI.getTransactions(limit)
                    .then(response => {
                        if (response.status === 'success' && response.data) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message || 'Помилка отримання транзакцій'));
                        }
                    })
                    .catch(reject);
                return;
            }

            // Якщо WinixAPI недоступний, використовуємо fetch API
            fetch(`/api/user/${this.state.userId}/transactions?limit=${limit}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success' && data.data) {
                        resolve(data.data);
                    } else {
                        reject(new Error(data.message || 'Помилка отримання транзакцій'));
                    }
                })
                .catch(reject);
        });
    },

    // Завантаження транзакцій з локального сховища
    loadTransactionsFromLocalStorage: function() {
        try {
            // Спроба завантажити транзакції з localStorage
            const transactionsStr = localStorage.getItem('transactions') || '[]';
            const transactions = JSON.parse(transactionsStr);

            if (transactions && transactions.length > 0) {
                // Сортуємо транзакції за датою (від найновіших до найстаріших)
                transactions.sort((a, b) => {
                    const dateA = a.created_at || a.timestamp || a.date;
                    const dateB = b.created_at || b.timestamp || b.date;
                    return new Date(dateB) - new Date(dateA);
                });

                // Оновлюємо стан
                this.state.transactions = transactions;

                // Оновлюємо список транзакцій
                this.updateTransactionsList();
            } else {
                // Якщо транзакцій немає, створюємо демо-дані
                this.createDemoTransactions();
            }
        } catch (error) {
            console.error('Помилка завантаження транзакцій з localStorage:', error);

            // Якщо сталася помилка, створюємо демо-дані
            this.createDemoTransactions();
        }
    },

    // Створення демо-транзакцій
    createDemoTransactions: function() {
        // Поточна дата
        const now = new Date();

        // Створюємо демо-транзакції
        this.state.transactions = [
            {
                id: this.generateId(),
                type: 'receive',
                amount: 1000,
                from_address: '12345678',
                description: 'Початкове зарахування',
                created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 днів тому
                status: 'completed'
            },
            {
                id: this.generateId(),
                type: 'send',
                amount: -500,
                to_address: '87654321',
                description: 'Оплата послуг',
                created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 дні тому
                status: 'completed'
            },
            {
                id: this.generateId(),
                type: 'stake',
                amount: -200,
                description: 'Стейкінг токенів',
                created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 день тому
                status: 'completed'
            }
        ];

        // Оновлюємо список транзакцій
        this.updateTransactionsList();

        // Зберігаємо транзакції в localStorage
        localStorage.setItem('transactions', JSON.stringify(this.state.transactions));
    },

    // Оновлення списку транзакцій
    updateTransactionsList: function(isHistoryList = false) {
        // Визначаємо, який список оновлювати
        const listElement = isHistoryList ? this.elements.historyList : this.elements.transactionsList;

        if (!listElement) return;

        // Очищаємо список
        listElement.innerHTML = '';

        // Отримуємо транзакції
        let transactions = this.state.transactions;

        // Якщо це список історії, фільтруємо за типом
        if (isHistoryList && this.state.currentFilter !== 'all') {
            transactions = transactions.filter(tx => tx.type === this.state.currentFilter);
        }

        // Якщо це основний список, обмежуємо кількість транзакцій
        if (!isHistoryList) {
            transactions = transactions.slice(0, this.config.transactionsLimit);
        }

        // Якщо транзакцій немає, показуємо повідомлення
        if (transactions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';

            if (isHistoryList && this.state.currentFilter !== 'all') {
                emptyMessage.textContent = 'Немає транзакцій за обраним фільтром';
            } else {
                emptyMessage.textContent = 'Транзакції відсутні';
            }

            listElement.appendChild(emptyMessage);
            return;
        }

        // Додаємо транзакції до списку
        transactions.forEach(transaction => {
            const transactionEl = document.createElement('div');
            transactionEl.className = 'transaction-item';
            transactionEl.setAttribute('data-id', transaction.id);
            transactionEl.setAttribute('data-type', transaction.type);

            const details = document.createElement('div');
            details.className = 'transaction-details';

            const type = document.createElement('div');
            type.className = 'transaction-type';
            type.textContent = this.getTransactionTypeText(transaction.type);
            details.appendChild(type);

            const date = document.createElement('div');
            date.className = 'transaction-date';
            date.textContent = this.formatDate(transaction.created_at || transaction.timestamp || transaction.date);
            details.appendChild(date);

            const amount = document.createElement('div');
            amount.className = `transaction-amount ${this.getTransactionClass(transaction.type)}`;

            const amountValue = parseFloat(transaction.amount);
            amount.textContent = `${this.getTransactionPrefix(transaction.type)}${Math.abs(amountValue).toFixed(2)} $WINIX`;

            transactionEl.appendChild(details);
            transactionEl.appendChild(amount);

            // Додаємо анімацію появи
            transactionEl.style.animation = 'fadeIn 0.3s ease-out forwards';

            // Додаємо ефект при наведенні
            transactionEl.addEventListener('mouseenter', () => {
                transactionEl.style.transform = 'translateY(-2px)';
                transactionEl.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            });

            transactionEl.addEventListener('mouseleave', () => {
                transactionEl.style.transform = 'translateY(0)';
                transactionEl.style.boxShadow = '';
            });

            // Додаємо ефект при натисканні
            transactionEl.addEventListener('click', () => {
                this.showTransactionDetails(transaction);
            });

            listElement.appendChild(transactionEl);
        });
    },

    // Показ деталей транзакції
    showTransactionDetails: function(transaction) {
        // Створюємо модальне вікно з деталями транзакції
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-container';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        const modalTitle = document.createElement('h2');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = 'Деталі транзакції';

        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => document.body.removeChild(modal);

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-content';

        // Додаємо деталі транзакції
        const detailsHtml = `
            <div class="transaction-detail-row">
                <div class="detail-label">Тип:</div>
                <div class="detail-value">${this.getTransactionTypeText(transaction.type)}</div>
            </div>
            <div class="transaction-detail-row">
                <div class="detail-label">Сума:</div>
                <div class="detail-value ${this.getTransactionClass(transaction.type)}">
                    ${this.getTransactionPrefix(transaction.type)}${Math.abs(parseFloat(transaction.amount)).toFixed(2)} $WINIX
                </div>
            </div>
            <div class="transaction-detail-row">
                <div class="detail-label">Дата:</div>
                <div class="detail-value">${this.formatFullDate(transaction.created_at || transaction.timestamp || transaction.date)}</div>
            </div>
            ${transaction.from_address ? `
                <div class="transaction-detail-row">
                    <div class="detail-label">Від:</div>
                    <div class="detail-value">${transaction.from_address}</div>
                </div>
            ` : ''}
            ${transaction.to_address ? `
                <div class="transaction-detail-row">
                    <div class="detail-label">Кому:</div>
                    <div class="detail-value">${transaction.to_address}</div>
                </div>
            ` : ''}
            <div class="transaction-detail-row">
                <div class="detail-label">Опис:</div>
                <div class="detail-value">${transaction.description || 'Без опису'}</div>
            </div>
            <div class="transaction-detail-row">
                <div class="detail-label">Статус:</div>
                <div class="detail-value">${this.getTransactionStatusText(transaction.status)}</div>
            </div>
            <div class="transaction-detail-row">
                <div class="detail-label">ID транзакції:</div>
                <div class="detail-value" style="word-break: break-all;">${transaction.id}</div>
            </div>
        `;

        modalBody.innerHTML = detailsHtml;

        // Додаємо кнопку закриття
        const closeButtonBottom = document.createElement('button');
        closeButtonBottom.className = 'form-button';
        closeButtonBottom.textContent = 'Закрити';
        closeButtonBottom.style.marginTop = '1rem';
        closeButtonBottom.onclick = () => document.body.removeChild(modal);

        modalBody.appendChild(closeButtonBottom);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);

        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Анімація появи модального вікна
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 10);
    },

    // Отримання тексту для типу транзакції
    getTransactionTypeText: function(type) {
        switch (type) {
            case 'receive':
                return 'Отримано';
            case 'send':
                return 'Відправлено';
            case 'stake':
                return 'Стейкінг';
            case 'unstake':
                return 'Розстейкінг';
            case 'reward':
                return 'Нагорода';
            case 'fee':
                return 'Комісія';
            default:
                return 'Транзакція';
        }
    },

    // Отримання класу для типу транзакції
    getTransactionClass: function(type) {
        switch (type) {
            case 'receive':
            case 'unstake':
            case 'reward':
                return 'transaction-positive';
            case 'send':
            case 'stake':
            case 'fee':
                return 'transaction-negative';
            default:
                return 'transaction-neutral';
        }
    },

    // Отримання префікса для типу транзакції
    getTransactionPrefix: function(type) {
        switch (type) {
            case 'receive':
            case 'unstake':
            case 'reward':
                return '+';
            case 'send':
            case 'stake':
            case 'fee':
                return '-';
            default:
                return '';
        }
    },

    // Отримання тексту для статусу транзакції
    getTransactionStatusText: function(status) {
        switch (status) {
            case 'completed':
                return 'Завершено';
            case 'pending':
                return 'В обробці';
            case 'failed':
                return 'Помилка';
            default:
                return 'Невідомо';
        }
    },

    // Форматування дати для відображення в списку
    formatDate: function(dateString) {
        if (!dateString) return 'Невідома дата';

        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) {
                return 'Щойно';
            } else if (diffMin < 60) {
                return `${diffMin} хв тому`;
            } else if (diffHour < 24) {
                return `${diffHour} год тому`;
            } else if (diffDay === 1) {
                return 'Вчора';
            } else if (diffDay < 7) {
                return `${diffDay} днів тому`;
            } else {
                return date.toLocaleDateString('uk-UA');
            }
        } catch (error) {
            console.error('Помилка форматування дати:', error);
            return dateString;
        }
    },

    // Форматування дати для відображення в деталях
    formatFullDate: function(dateString) {
        if (!dateString) return 'Невідома дата';

        try {
            const date = new Date(dateString);
            return date.toLocaleString('uk-UA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.error('Помилка форматування повної дати:', error);
            return dateString;
        }
    },

    // Показ індикатора завантаження
    showLoading: function(message = 'Завантаження...') {
        if (this.elements.loadingIndicator) {
            // Оновлюємо текст
            const textElement = this.elements.loadingIndicator.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }

            // Показуємо індикатор
            this.elements.loadingIndicator.style.display = 'flex';
        } else {
            // Якщо елемент не знайдено, використовуємо WinixCore або стандартний метод
            if (window.WinixCore && typeof window.WinixCore.showLoading === 'function') {
                window.WinixCore.showLoading(message);
            } else if (window.showLoading) {
                window.showLoading(message);
            }
        }
    },

    // Приховування індикатора завантаження
    hideLoading: function() {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        } else {
            // Якщо елемент не знайдено, використовуємо WinixCore або стандартний метод
            if (window.WinixCore && typeof window.WinixCore.hideLoading === 'function') {
                window.WinixCore.hideLoading();
            } else if (window.hideLoading) {
                window.hideLoading();
            }
        }
    },

    // Показ повідомлення про помилку
    showError: function(message) {
        // Використовуємо стандартні методи, якщо вони доступні
        if (window.showNotification) {
            window.showNotification(message, true);
        } else if (window.showToast) {
            window.showToast(message, true);
        } else {
            // Створюємо власне повідомлення
            this.createToast(message, 'error');
        }
    },

    // Показ повідомлення про успіх
    showSuccess: function(message) {
        // Використовуємо стандартні методи, якщо вони доступні
        if (window.showNotification) {
            window.showNotification(message, false);
        } else if (window.showToast) {
            window.showToast(message, false);
        } else {
            // Створюємо власне повідомлення
            this.createToast(message, 'success');
        }
    },

    // Створення повідомлення toast
    createToast: function(message, type = 'info') {
        // Перевіряємо, чи існує контейнер для повідомлень
        let toast = document.getElementById('toast-message');

        if (!toast) {
            // Створюємо контейнер
            toast = document.createElement('div');
            toast.id = 'toast-message';
            toast.className = 'toast-message';
            document.body.appendChild(toast);
        }

        // Встановлюємо текст
        toast.textContent = message;

        // Встановлюємо клас типу
        toast.className = 'toast-message';
        if (type === 'error') {
            toast.classList.add('error');
        } else if (type === 'success') {
            toast.classList.add('success');
        }

        // Показуємо повідомлення
        toast.classList.add('show');

        // Приховуємо повідомлення через 3 секунди
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Генерація унікального ID
    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    // Отримання ID користувача
    getUserId: function() {
        // Функція перевірки валідності ID
        const isValidId = (id) => {
            return id &&
                   id !== 'undefined' &&
                   id !== 'null' &&
                   id !== undefined &&
                   id !== null &&
                   id.toString().trim() !== '';
        };

        // Спроба отримати ID з різних джерел

        // 1. З Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp &&
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user) {
            const id = window.Telegram.WebApp.initDataUnsafe.user.id;
            if (isValidId(id)) {
                return id.toString();
            }
        }

        // 2. З localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (isValidId(storedId)) {
            return storedId;
        }

        // 3. З DOM
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && isValidId(userIdElement.textContent)) {
            return userIdElement.textContent.trim();
        }

        // 4. З WinixAPI
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            const apiId = window.WinixAPI.getUserId();
            if (isValidId(apiId)) {
                return apiId;
            }
        }

        // Якщо не знайдено, генеруємо новий ID
        const newId = '2449' + Math.floor(Math.random() * 10000000);

        // Зберігаємо новий ID
        localStorage.setItem('telegram_user_id', newId);

        return newId;
    }
};

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded: Ініціалізація сторінки гаманця");

    // Ініціалізуємо гаманець
    WinixWallet.init();

    // Додаємо стилі для анімацій
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .transaction-detail-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(78, 181, 247, 0.2);
        }
        
        .detail-label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            font-weight: normal;
        }
        
        .detail-value {
            font-weight: bold;
            text-align: right;
            max-width: 60%;
            word-break: break-word;
        }
        
        .max-button {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(90deg, #1A1A2E, #0F3460, #00C9A7);
            border: none;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: bold;
            cursor: pointer;
            z-index: 2;
        }
        
        .amount-group {
            position: relative;
        }
        
        /* Покращені стилі для модальних вікон */
        .modal-overlay {
            z-index: 1001 !important;
        }
        
        .modal-container {
            animation: modalAppear 0.3s ease-out forwards;
        }
        
        @keyframes modalAppear {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});