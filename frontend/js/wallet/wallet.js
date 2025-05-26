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
        filteredTransactions: [], // Додане нове поле для відфільтрованих транзакцій
        transactionsSource: null, // 'api', 'localStorage', або 'demo'
        currentFilter: 'all',  // Поточний фільтр для історії транзакцій
        hasShownCacheMessage: false, // Прапорець для повідомлення про кешовані дані
        historyModalLoaded: false // Прапорець для відстеження чи були завантажені дані для історії
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

        // Додаємо преміум-анімації
        this.addPremiumAnimations();

        console.log("WinixWallet: Ініціалізація завершена");
    },

    // Додавання преміум-анімацій
    addPremiumAnimations: function() {
        try {
            // Додаємо стилі для анімацій (якщо їх ще немає)
            if (!document.getElementById('premium-animations-style')) {
                const style = document.createElement('style');
                style.id = 'premium-animations-style';
                style.textContent = `
                /* Плавне з'явлення модальних вікон */
                .modal-overlay {
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                    backdrop-filter: blur(8px) !important;
                }

                .modal-container {
                    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), 
                                opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4),
                                0 0 0 1px rgba(78, 181, 247, 0.2) inset,
                                0 5px 15px rgba(0, 201, 167, 0.15) !important;
                    overflow: hidden;
                }

                .modal-overlay.show .modal-container {
                    transform: scale(1) !important;
                    opacity: 1 !important;
                }

                /* Ефект свічення для модалок */
                .modal-overlay.show .modal-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, 
                        rgba(0, 201, 167, 0), 
                        rgba(0, 201, 167, 0.8), 
                        rgba(0, 201, 167, 0));
                    animation: glow-line 2s infinite;
                }

                @keyframes glow-line {
                    0% { opacity: 0.3; transform: translateX(-100%); }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; transform: translateX(100%); }
                }

                /* Анімовані кнопки */
                .action-button, .form-button, .filter-button {
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                    overflow: hidden;
                    position: relative;
                }

                .action-button::after, .form-button::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
                    opacity: 0;
                    transition: opacity 0.8s;
                    pointer-events: none;
                }

                .action-button:active::after, .form-button:active::after {
                    opacity: 1;
                    transition: 0s;
                }

                /* Анімація для карток транзакцій */
                .transaction-item {
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                    border-left: 3px solid transparent;
                }

                .transaction-item.transaction-receive,
                .transaction-item[data-type="receive"] {
                    border-left-color: var(--positive-color);
                }

                .transaction-item.transaction-send,
                .transaction-item[data-type="send"] {
                    border-left-color: var(--negative-color);
                }

                .transaction-item:hover {
                    transform: translateY(-4px) !important;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2) !important;
                }

                /* Анімація для головного балансу */
                .main-balance {
                    position: relative;
                    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .main-balance.updated {
                    animation: balance-updated 1.5s;
                }

                @keyframes balance-updated {
                    0% { transform: scale(1); color: var(--text-color); }
                    50% { transform: scale(1.1); color: rgb(0, 201, 167); }
                    100% { transform: scale(1); color: var(--text-color); }
                }

                /* Анімації для модальних вікон при відкритті/закритті */
                @keyframes modal-in {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes modal-out {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0; }
                }

                /* Анімоване свічення для кнопок */
                .action-button, .form-button {
                    position: relative;
                    overflow: hidden;
                }

                .action-button::before, .form-button::before {
                    content: '';
                    position: absolute;
                    top: -10px;
                    left: -10px;
                    width: 10px;
                    height: 10px;
                    background-color: rgba(255, 255, 255, 0.5);
                    border-radius: 50%;
                    box-shadow: 0 0 20px 10px rgba(255, 255, 255, 0.3);
                    transition: all 0.5s;
                    opacity: 0;
                    pointer-events: none;
                }

                .action-button:hover::before, .form-button:hover::before {
                    animation: button-glow 2s infinite;
                }

                @keyframes button-glow {
                    0% { opacity: 0; transform: translate(0, 0); }
                    50% { opacity: 0.5; }
                    100% { opacity: 0; transform: translate(calc(100% + 20px), calc(100% + 20px)); }
                }
                `;
                document.head.appendChild(style);
            }

            // Додаємо клас premium-modal до модальних вікон
            const modals = ['send-modal', 'receive-modal', 'history-modal'];
            modals.forEach(id => {
                const modalElement = document.getElementById(id);
                if (modalElement && !modalElement.classList.contains('premium-modal')) {
                    modalElement.classList.add('premium-modal');
                }
            });

        } catch (error) {
            console.error('Помилка додавання преміум-анімацій:', error);
        }
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

        // Поле нотатки може бути відсутнім в деяких реалізаціях (наприклад в Telegram WebApp)
        this.elements.sendNote = document.getElementById('send-note');

        this.elements.availableBalance = document.getElementById('available-balance');

        // Елементи вікна отримання
        this.elements.receiveId = document.getElementById('receive-id');
        this.elements.copyButton = document.getElementById('copy-id-button');

        // Елементи історії транзакцій
        this.elements.historyList = document.getElementById('history-list');

        // Старі елементи фільтрів
        this.elements.filterButtons = document.querySelectorAll('.filter-button');

        // Новий селектор фільтрів
        this.elements.filterSelect = document.getElementById('transaction-filter');

        // Інші елементи
        this.elements.loadingIndicator = document.getElementById('loading-indicator');

        // Кнопка MAX
        this.elements.maxButton = document.getElementById('max-button');
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

        // Обробник для нового селектора фільтрів
        if (this.elements.filterSelect) {
            this.elements.filterSelect.addEventListener('change', () => {
                const filter = this.elements.filterSelect.value.toLowerCase();
                this.filterTransactions(filter);
            });
        }

        // Обробник для кнопки MAX в полі суми
        if (this.elements.maxButton && this.elements.sendAmount) {
            this.elements.maxButton.addEventListener('click', () => {
                this.elements.sendAmount.value = Math.floor(this.state.balance);
            });
        }

        // Додаємо обробник для оновлення при потягуванні вниз (pull-to-refresh)
        this.setupPullToRefresh();
    },

    // Налаштування оновлення при потягуванні вниз
    setupPullToRefresh: function() {
        let touchStartY = 0;
        let touchEndY = 0;
        const container = document.querySelector('.container');

        if (!container) return;

        container.addEventListener('touchstart', (e) => {
            // Не застосовуємо pull-to-refresh, якщо відкрите модальне вікно історії
            if (document.querySelector('.modal-overlay.show')) return;

            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            // Не застосовуємо pull-to-refresh, якщо відкрите модальне вікно історії
            if (document.querySelector('.modal-overlay.show')) return;

            touchEndY = e.touches[0].clientY;

            // Якщо скрол досяг верху і користувач тягне вниз
            if (container.scrollTop === 0 && touchEndY > touchStartY) {
                // Показуємо індикатор завантаження
                const refreshIndicator = document.querySelector('.pull-to-refresh-indicator');
                if (refreshIndicator) {
                    refreshIndicator.style.transform = `translateY(${Math.min((touchEndY - touchStartY) / 3, 60)}px)`;
                }
            }
        }, { passive: true });

        container.addEventListener('touchend', () => {
            // Не застосовуємо pull-to-refresh, якщо відкрите модальне вікно історії
            if (document.querySelector('.modal-overlay.show')) return;

            // Якщо скрол досяг верху і користувач потягнув достатньо вниз
            if (container.scrollTop === 0 && touchEndY > touchStartY && touchEndY - touchStartY > 100) {
                // Оновлюємо дані
                this.refreshAll();

                // Анімація індикатора завантаження
                const refreshIndicator = document.querySelector('.pull-to-refresh-indicator');
                if (refreshIndicator) {
                    refreshIndicator.style.transition = 'transform 0.3s';
                    refreshIndicator.style.transform = 'translateY(0)';
                    setTimeout(() => {
                        refreshIndicator.style.transition = '';
                    }, 300);
                }
            }
        }, { passive: true });

        // Створюємо індикатор оновлення, якщо його немає
        if (!document.querySelector('.pull-to-refresh-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'pull-to-refresh-indicator';
            indicator.innerHTML = `
                <div class="refresh-spinner"></div>
                <div class="refresh-text">Потягніть, щоб оновити</div>
            `;

            // Додаємо стилі для індикатора
            const style = document.createElement('style');
            style.textContent = `
                .pull-to-refresh-indicator {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transform: translateY(-100%);
                    padding: 10px;
                    z-index: 5;
                }
                .refresh-spinner {
                    width: 30px;
                    height: 30px;
                    border: 3px solid rgba(0, 201, 167, 0.3);
                    border-top-color: rgb(0, 201, 167);
                    border-radius: 50%;
                    margin-bottom: 5px;
                    animation: spin 1s linear infinite;
                }
                .refresh-text {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                }
            `;

            document.head.appendChild(style);
            container.prepend(indicator);
        }
    },

    // Оновлення всіх даних
    refreshAll: function() {
        this.showNotification('Оновлення даних...', false);

        // Оновлюємо дані користувача
        this.loadUserData(false, true);

        // Оновлюємо транзакції
        this.loadTransactions(false, this.config.transactionsLimit);

        // Анімуємо баланс
        if (this.elements.mainBalance) {
            this.elements.mainBalance.classList.add('updated');
            setTimeout(() => {
                this.elements.mainBalance.classList.remove('updated');
            }, 1500);
        }
    },

    // Налаштування автоматичного оновлення даних
    setupAutoUpdates: function() {
        setInterval(() => {
            // Оновлюємо дані користувача тільки якщо модальне вікно історії не відкрите
            if (!document.querySelector('.modal-overlay.show')) {
                // Оновлюємо дані користувача
                this.loadUserData(true); // true = тихе оновлення

                // Оновлюємо транзакції
                this.loadTransactions(true); // true = тихе оновлення
            }
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

            // Скидаємо прапорець завантаження історії, якщо закривається вікно історії
            if (modal.id === 'history-modal') {
                this.state.historyModalLoaded = false;
            }
        }
    },

    // Обробка відправки форми переказу
    handleSendFormSubmit: function() {
        // Отримуємо дані з форми
        const recipientId = this.elements.recipientId ? this.elements.recipientId.value.trim() : '';
        const amount = this.elements.sendAmount ? parseFloat(this.elements.sendAmount.value) : 0;

        // Поле примітки може бути відсутнім (в Telegram WebApp)
        const note = this.elements.sendNote ? this.elements.sendNote.value.trim() : '';

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
                    this.state.balance = parseFloat(response.data.sender_balance || response.data.newBalance);
                    this.updateBalanceDisplay();

                    // Закриваємо модальне вікно
                    this.closeModal(this.elements.sendModal);

                    // Показуємо повідомлення про успішну відправку
                    this.showSuccess(`Успішно відправлено ${amount} WINIX користувачу ${recipientId}`);

                    // Створюємо нову транзакцію і додаємо її до списку
                    const newTransaction = {
                        id: response.data.transaction_id || this.generateId(),
                        type: 'send',
                        amount: -amount,
                        to_address: recipientId,
                        description: note || `Надсилання ${amount} WINIX користувачу ${recipientId}`,
                        created_at: new Date().toISOString(),
                        status: 'completed',
                        isNew: true,
                        telegram_id: this.state.userId // Явно вказуємо, що це транзакція цього користувача
                    };

                    // Додаємо транзакцію на початок списку
                    this.state.transactions.unshift(newTransaction);

                    // Оновлюємо список транзакцій
                    this.updateTransactionsList();

                    // Анімуємо баланс
                    if (this.elements.mainBalance) {
                        this.elements.mainBalance.classList.add('updated');
                        setTimeout(() => {
                            this.elements.mainBalance.classList.remove('updated');
                        }, 1500);
                    }
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
                amount: amount
            };

            // Додаємо примітку тільки якщо вона не порожня
            if (note) {
                data.note = note;
            }

            console.log('Відправляємо дані:', data);

            // Спроба використати WinixAPI, якщо він доступний
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                window.WinixAPI.apiRequest('/api/send_tokens', 'POST', data)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            // Перевірка на Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                console.log('Використовуємо Telegram WebApp для надсилання токенів', data);
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
        // Відкриваємо модальне вікно
        if (this.elements.historyModal) {
            this.elements.historyModal.classList.add('show');
        }

        // Перевіряємо, чи вже завантажували дані для історії
        if (!this.state.historyModalLoaded) {
            // Показуємо індикатор завантаження
            this.showLoading('Завантаження історії транзакцій...');

            // Завантажуємо всі транзакції і оновлюємо список в модальному вікні
            this.loadTransactions(false, 100).then(() => {
                this.hideLoading();
                this.state.historyModalLoaded = true;

                // Явне оновлення списку історії транзакцій
                this.updateTransactionsList(true);

                // Встановлюємо фільтр "all" і оновлюємо селектор
                this.state.currentFilter = 'all';
                if (this.elements.filterSelect) {
                    this.elements.filterSelect.value = 'all';
                }
            });
        } else {
            // Якщо дані вже були завантажені, просто оновлюємо відображення
            this.updateTransactionsList(true);
        }
    },

    // Фільтрація транзакцій за типом
    filterTransactions: function(filter) {
        this.state.currentFilter = filter;

        // Синхронізуємо значення нового селектора
        if (this.elements.filterSelect && this.elements.filterSelect.value.toLowerCase() !== filter) {
            this.elements.filterSelect.value = filter;
        }

        // Якщо це фільтрація "all", просто оновлюємо відображення
        if (filter === 'all') {
            this.updateTransactionsList(true);
            return;
        }

        // Показуємо індикатор завантаження
        this.showLoading('Фільтрація транзакцій...');

        // Завантажуємо транзакції з фільтром
        this.fetchTransactionsWithFilter(100, filter).then(transactions => {
            this.hideLoading();

            if (transactions && transactions.length >= 0) {
                // Оновлюємо стан
                this.state.filteredTransactions = transactions;
                // Оновлюємо список
                this.updateTransactionsList(true, true);
            } else {
                // Фільтруємо локально, якщо серверна фільтрація не доступна
                this.updateTransactionsList(true);
            }
        }).catch(error => {
            console.error('Помилка фільтрації:', error);
            this.hideLoading();
            // Фільтруємо локально, якщо виникла помилка
            this.updateTransactionsList(true);
        });
    },

    // Завантаження даних користувача
    loadUserData: function(silent = false, forceRefresh = false) {
        if (!silent) {
            this.showLoading('Завантаження даних користувача...');
        }

        // Спробуємо отримати дані з API
        this.fetchUserData(forceRefresh)
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
    fetchUserData: function(forceRefresh = false) {
        return new Promise((resolve, reject) => {
            // Додаємо параметр для запобігання кешуванню
            const cacheBuster = forceRefresh ? Date.now() : '';

            // Спроба використати WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
                window.WinixAPI.getUserData(forceRefresh)
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
            fetch(`/api/user/${this.state.userId}/complete-balance?t=${cacheBuster}`)
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

    // Покращена функція завантаження транзакцій
    loadTransactions: function(silent = false, limit = this.config.transactionsLimit) {
        if (!silent) {
            this.showLoading('Завантаження транзакцій...');
        }

        // Збільшуємо кількість спроб для надійнішого підключення до API
        const maxRetries = 3;
        let retryCount = 0;

        const tryFetchTransactions = () => {
            return this.fetchTransactions(limit)
                .then(transactions => {
                    if (!silent) {
                        this.hideLoading();
                    }

                    if (transactions && transactions.length >= 0) {
                        // Сортуємо транзакції за датою (від найновіших до найстаріших)
                        transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                        // Оновлюємо стан
                        this.state.transactions = transactions;
                        this.state.transactionsSource = 'api';

                        // Зберігаємо в localStorage для офлайн-доступу
                        localStorage.setItem('transactions', JSON.stringify(transactions));
                        localStorage.setItem('transactions_timestamp', Date.now());

                        // Оновлюємо список транзакцій
                        this.updateTransactionsList();
                        return true;
                    } else {
                        throw new Error('Транзакції не знайдено');
                    }
                })
                .catch(error => {
                    console.warn(`Спроба ${retryCount + 1}/${maxRetries} завантаження транзакцій не вдалася:`, error);

                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Повторна спроба з експоненційною затримкою
                        const delay = 300 * Math.pow(2, retryCount);
                        return new Promise(resolve => setTimeout(() => resolve(tryFetchTransactions()), delay));
                    } else {
                        // Всі спроби не вдалися, використовуємо локальне сховище
                        console.error('Всі спроби завантаження транзакцій не вдалися, використовуємо локальні дані');
                        if (!silent) {
                            this.hideLoading();
                        }
                        this.loadTransactionsFromLocalStorage();
                        return false;
                    }
                });
        };

        return tryFetchTransactions();
    },

    // Отримання транзакцій з фільтром
    fetchTransactionsWithFilter: function(limit = 100, filter = 'all') {
        return new Promise((resolve, reject) => {
            // Генеруємо унікальний параметр для запобігання кешуванню
            const cacheBuster = Date.now();
            const userId = this.state.userId || this.getUserId();

            // Формуємо URL з додатковими параметрами
            const apiUrl = `/api/user/${userId}/transactions?limit=${limit}&type=${filter}&t=${cacheBuster}`;

            console.log(`Запит транзакцій з фільтром: ${apiUrl}`);

            // Спроба використати WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                window.WinixAPI.apiRequest(apiUrl, 'GET', null, {
                    timeout: 10000 // 10 секунд таймаут
                })
                    .then(response => {
                        if (response.status === 'success' && response.data) {
                            console.log(`Отримано ${response.data.length} транзакцій через WinixAPI`);
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message || 'Помилка отримання транзакцій'));
                        }
                    })
                    .catch(reject);
                return;
            }

            // Якщо WinixAPI недоступний, використовуємо fetch API
            fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success' && data.data) {
                        console.log(`Отримано ${data.data.length} транзакцій через fetch API`);
                        resolve(data.data);
                    } else {
                        reject(new Error(data.message || 'Помилка отримання транзакцій'));
                    }
                })
                .catch(reject);
        });
    },

    // Покращена функція отримання транзакцій з API
    fetchTransactions: function(limit = this.config.transactionsLimit) {
        return new Promise((resolve, reject) => {
            // Генеруємо унікальний параметр для запобігання кешуванню
            const cacheBuster = Date.now();
            const userId = this.state.userId || this.getUserId();

            // Формуємо URL з додатковими параметрами
            const apiUrl = `/api/user/${userId}/transactions?limit=${limit}&t=${cacheBuster}`;

            console.log(`Запит транзакцій: ${apiUrl}`);

            // Спроба використати WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function') {
                window.WinixAPI.apiRequest(apiUrl, 'GET', null, {
                    timeout: 10000 // 10 секунд таймаут
                })
                    .then(response => {
                        if (response.status === 'success' && response.data) {
                            console.log(`Отримано ${response.data.length} транзакцій через WinixAPI`);
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message || 'Помилка отримання транзакцій'));
                        }
                    })
                    .catch(reject);
                return;
            }

            // Якщо WinixAPI недоступний, використовуємо fetch API
            fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.status === 'success' && data.data) {
                        console.log(`Отримано ${data.data.length} транзакцій через fetch API`);
                        resolve(data.data);
                    } else {
                        reject(new Error(data.message || 'Помилка отримання транзакцій'));
                    }
                })
                .catch(reject);
        });
    },

    // Покращена функція завантаження транзакцій з локального сховища
    loadTransactionsFromLocalStorage: function() {
        try {
            // Спроба завантажити транзакції з localStorage
            const transactionsStr = localStorage.getItem('transactions');
            const timestamp = localStorage.getItem('transactions_timestamp');

            // Перевіряємо, чи дані не застарілі (не старіші 24 годин)
            const isOutdated = !timestamp || (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000);

            if (transactionsStr && !isOutdated) {
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
                    this.state.transactionsSource = 'localStorage';

                    // Оновлюємо список транзакцій
                    this.updateTransactionsList();

                    // Показуємо повідомлення про використання кешованих даних
                    if (!this.state.hasShownCacheMessage) {
                        setTimeout(() => {
                            this.showNotification('Показано кешовані транзакції. Потягніть вниз, щоб оновити.');
                            this.state.hasShownCacheMessage = true;
                        }, 1000);
                    }

                    return;
                }
            }

            // Якщо транзакцій немає або дані застарілі, створюємо демо-транзакції
            this.createRealFallbackTransactions();
        } catch (error) {
            console.error('Помилка завантаження транзакцій з localStorage:', error);

            // Якщо сталася помилка, створюємо демо-транзакції
            this.createRealFallbackTransactions();
        }
    },

    // Створення реалістичних резервних транзакцій (використовується лише в крайньому випадку)
    createRealFallbackTransactions: function() {
        // Поточна дата
        const now = new Date();
        const userId = this.state.userId || this.getUserId();

        // Створюємо більш реалістичні демо-транзакції з реальними датами і сумами
        // Використовуємо різні ID для транзакцій
        this.state.transactions = [
            {
                id: "tx_" + Math.random().toString(36).substr(2, 9),
                type: "receive",
                amount: Math.floor(Math.random() * 10000) + 1000,
                from_address: "5824093721", // Випадковий ID відправника
                telegram_id: userId, // ID поточного користувача (важливо для фільтрації)
                description: "Отримано від користувача",
                created_at: new Date(now.getTime() - (Math.floor(Math.random() * 7) + 1) * 24 * 60 * 60 * 1000).toISOString(),
                status: "completed"
            },
            {
                id: "tx_" + Math.random().toString(36).substr(2, 9),
                type: "send",
                amount: Math.floor(Math.random() * 500) + 500,
                to_address: "4935721084", // Випадковий ID отримувача
                telegram_id: userId, // ID поточного користувача (важливо для фільтрації)
                description: "Переказ користувачу",
                created_at: new Date(now.getTime() - (Math.floor(Math.random() * 3) + 1) * 24 * 60 * 60 * 1000).toISOString(),
                status: "completed"
            },
            {
                id: "tx_" + Math.random().toString(36).substr(2, 9),
                type: "stake",
                amount: Math.floor(Math.random() * 2000) + 1000,
                telegram_id: userId, // ID поточного користувача (важливо для фільтрації)
                description: "Стейкінг токенів на 14 днів",
                created_at: new Date(now.getTime() - (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000).toISOString(),
                status: "completed"
            },
            {
                id: "tx_" + Math.random().toString(36).substr(2, 9),
                type: "receive",
                amount: Math.floor(Math.random() * 200) + 100,
                from_address: "3894615203", // Випадковий ID відправника
                telegram_id: userId, // ID поточного користувача (важливо для фільтрації)
                description: "Бонус за активність",
                created_at: new Date(now.getTime() - (Math.floor(Math.random() * 2) + 1) * 24 * 60 * 60 * 1000).toISOString(),
                status: "completed"
            }
        ];

        // Додаємо мітку, що це демо-дані
        this.state.transactionsSource = 'demo';

        // Зберігаємо в localStorage
        localStorage.setItem('transactions', JSON.stringify(this.state.transactions));
        localStorage.setItem('transactions_timestamp', Date.now());

        // Оновлюємо список транзакцій
        this.updateTransactionsList();

        // Показуємо повідомлення про використання демо-даних
        setTimeout(() => {
            this.showNotification('Показано демонстраційні транзакції. Перевірте підключення до мережі.');
        }, 1000);
    },

    // Оновлена функція оновлення списку транзакцій з анімаціями
    updateTransactionsList: function(isHistoryList = false, useFilteredData = false) {
        // Визначаємо, який список оновлювати
        const listElement = isHistoryList ? this.elements.historyList : this.elements.transactionsList;

        if (!listElement) return;

        // Очищаємо список
        listElement.innerHTML = '';

        // Отримуємо транзакції
        let transactions = useFilteredData ? this.state.filteredTransactions : this.state.transactions;

        // Фільтруємо транзакції, щоб показувати тільки ті, що безпосередньо стосуються користувача
        // Якщо telegram_id збігається з ID користувача, це відправка або інша операція цього користувача
        // Якщо to_address збігається з ID користувача, це отримання коштів цим користувачем
        transactions = transactions.filter(tx => {
            const userId = this.state.userId.toString();
            // Якщо користувач є надсилачем, показуємо транзакцію відправки
            if (tx.telegram_id && tx.telegram_id.toString() === userId) {
                return true;
            }
            // Якщо користувач є отримувачем, показуємо транзакцію отримання,
            // але тільки якщо це не дублює транзакцію відправки
            else if (tx.to_address && tx.to_address.toString() === userId && tx.type === 'receive') {
                return true;
            }
            return false;
        });

        // Якщо це список історії і не використовуємо відфільтровані дані, фільтруємо за типом
        if (isHistoryList && !useFilteredData && this.state.currentFilter !== 'all') {
            transactions = transactions.filter(tx => tx.type === this.state.currentFilter);
        }

        // Якщо це основний список, обмежуємо кількість транзакцій
        if (!isHistoryList) {
            transactions = transactions.slice(0, this.config.transactionsLimit);
        }

        // Перевіряємо, чи є транзакції
        if (!transactions || transactions.length === 0) {
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
        transactions.forEach((transaction, index) => {
            const transactionEl = document.createElement('div');
            transactionEl.className = `transaction-item transaction-${transaction.type}`;
            transactionEl.setAttribute('data-id', transaction.id);
            transactionEl.setAttribute('data-type', transaction.type);

            // Встановлюємо номер індексу як атрибут (не як CSS змінну)
            transactionEl.setAttribute('data-index', index);

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
            const absAmount = Math.abs(amountValue);

            // Виправлення для коректного відображення суми в залежності від типу транзакції
            if (transaction.type === 'receive' || transaction.type === 'reward' || transaction.type === 'unstake') {
                amount.textContent = `+${absAmount.toFixed(2)} $WINIX`;
            } else {
                amount.textContent = `-${absAmount.toFixed(2)} $WINIX`;
            }

            transactionEl.appendChild(details);
            transactionEl.appendChild(amount);

            // Додаємо додаткову інформацію про джерело даних
            if (this.state.transactionsSource === 'demo') {
                const demoLabel = document.createElement('div');
                demoLabel.className = 'transaction-demo-label';
                demoLabel.textContent = 'Демо';
                demoLabel.style.fontSize = '10px';
                demoLabel.style.opacity = '0.7';
                demoLabel.style.marginTop = '4px';
                details.appendChild(demoLabel);
            }

            // Ефект при наведенні
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

            // Для нових транзакцій додаємо клас для анімації
            if (transaction.isNew) {
                setTimeout(() => {
                    transactionEl.classList.add('new');
                }, 100);
            }
        });
    },

    // Показ деталей транзакції
    showTransactionDetails: function(transaction) {
        // Створюємо модальне вікно з деталями транзакції
        const modal = document.createElement('div');
        modal.className = 'modal-overlay premium-modal show';

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

        // Правильно відображаємо суму з відповідним знаком
        const amountValue = parseFloat(transaction.amount);
        const absAmount = Math.abs(amountValue);
        const amountPrefix = (transaction.type === 'receive' || transaction.type === 'reward' || transaction.type === 'unstake') ? '+' : '-';
        const amountText = `${amountPrefix}${absAmount.toFixed(2)} $WINIX`;

        // Додаємо деталі транзакції
        const detailsHtml = `
            <div class="transaction-detail-row">
                <div class="detail-label">Тип:</div>
                <div class="detail-value">${this.getTransactionTypeText(transaction.type)}</div>
            </div>
            <div class="transaction-detail-row">
                <div class="detail-label">Сума:</div>
                <div class="detail-value ${this.getTransactionClass(transaction.type)}">
                    ${amountText}
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

    // Показ загального повідомлення
    showNotification: function(message, isError = false) {
        if (window.showNotification) {
            window.showNotification(message, isError);
        } else if (window.showToast) {
            window.showToast(message, isError);
        } else {
            this.createToast(message, isError ? 'error' : 'info');
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

});
// Додайте функціонал для навігаційних елементів
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        const section = this.getAttribute('data-section');

        // Якщо вже на цій сторінці, нічого не робимо
        if (section === 'wallet') {
            console.log('Вже на сторінці гаманця');
            return;
        }

        // Показуємо індикатор завантаження
        const spinner = document.getElementById('loading-indicator');
        if (spinner) spinner.style.display = 'flex';

        // Переходимо на відповідну сторінку
        setTimeout(() => {
            switch (section) {
                case 'home':
                    window.location.href = 'original-index.html';
                    break;
                case 'earn':
                    window.location.href = 'earn.html';
                    break;
                case 'referrals':
                    window.location.href = 'referrals.html';
                    break;
                case 'general':
                    window.location.href = 'general.html';
                    break;
                default:
                    window.location.href = `${section}.html`;
            }
        }, 100);
    });
});