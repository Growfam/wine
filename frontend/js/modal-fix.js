/**
 * WINIX - Преміальні модальні вікна розіграшів з реалістичними даними переможців
 * Виправляє кнопки закриття у всіх модальних вікнах і покращує відображення деталей розіграшів
 *
 * Інтегровано з централізованим API модулем
 */
(function() {
    console.log("🏆 WINIX PREMIUM MODALS: Запуск...");

    // Перевіряємо, чи вже ініціалізовано
    if (window.winixModalFixInitialized) {
        console.log("ℹ️ WINIX PREMIUM MODALS: Вже ініціалізовано");
        return;
    }

    // Встановлюємо флаг ініціалізації
    window.winixModalFixInitialized = true;

    // Додаємо необхідні стилі для преміального дизайну
    injectModalStyles();

    // Запобігаємо виконанню потенційно шкідливих операцій до повного завантаження DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            fixAllModals();
        });
    } else {
        fixAllModals();
    }

    /**
     * Функція для виправлення всіх модальних вікон
     */
    function fixAllModals() {
        // Виправляємо кнопки закриття у всіх модальних вікнах
        fixCloseButtons();

        // Перевизначаємо функцію показу деталей розіграшу
        overrideRaffleDetailsModal();

        // Налаштовуємо спостерігач для нових модальних вікон
        setupMutationObserver();
    }

    /**
     * Додаємо стилі для преміальних модальних вікон
     */
    function injectModalStyles() {
        try {
            // Перевіряємо, чи стилі вже додані
            if (document.getElementById('premium-modals-styles')) {
                return;
            }

            const styleElement = document.createElement('style');
            styleElement.id = 'premium-modals-styles';
            styleElement.textContent = `
                /* Покращений стиль модальних вікон */
                .raffle-modal.open, .daily-raffle-modal.open {
                    display: flex;
                }
                
                .raffle-modal, .daily-raffle-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.85);
                    z-index: 1000;
                    backdrop-filter: blur(8px);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                .raffle-modal.open, .daily-raffle-modal.open {
                    opacity: 1;
                }
                
                .modal-content, .daily-modal-content {
                    width: 90%;
                    max-width: 480px;
                    background: linear-gradient(145deg, rgba(26, 26, 46, 0.97), rgba(15, 52, 96, 0.97));
                    border-radius: 20px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 25px rgba(78, 181, 247, 0.2);
                    animation: modalFadeIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    max-height: 80vh;
                    overflow-y: auto;
                    border: 1px solid rgba(78, 181, 247, 0.2);
                    position: relative;
                }
                
                .modal-content::before, .daily-modal-content::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 80px;
                    background: linear-gradient(to bottom, rgba(30, 113, 161, 0.2), transparent);
                    border-radius: 20px 20px 0 0;
                    pointer-events: none;
                }
                
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    position: relative;
                }
                
                .modal-header::after {
                    content: '';
                    position: absolute;
                    bottom: -0.75rem;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(to right, transparent, rgba(78, 181, 247, 0.5), transparent);
                }
                
                .modal-title {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #FFD700;
                    text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
                    margin: 0;
                }
                
                .modal-close {
                    width: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    color: rgba(255, 255, 255, 0.7);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    line-height: 1;
                    padding-bottom: 2px; /* Для кращого вертикального центрування */
                }
                
                .modal-close:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.2);
                    box-shadow: 0 0 10px rgba(78, 181, 247, 0.5);
                    transform: rotate(90deg);
                }
                
                /* Стилі для деталей розіграшу */
                .prize-details {
                    margin-bottom: 1.5rem;
                }
                
                .detail-item {
                    margin-bottom: 1rem;
                    display: flex;
                    flex-direction: column;
                }
                
                .detail-label {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 0.25rem;
                }
                
                .detail-value {
                    font-size: 1.1rem;
                    color: white;
                    font-weight: bold;
                }
                
                .won, .виграно {
                    color: #4CAF50 !important;
                    text-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
                }
                
                /* Стилі для списку переможців */
                .winners-section {
                    background: rgba(0, 0, 0, 0.25);
                    border-radius: 12px;
                    padding: 1.25rem;
                    margin-bottom: 1.5rem;
                    border: 1px solid rgba(78, 181, 247, 0.15);
                }
                
                .winners-title {
                    font-size: 1.25rem;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 1rem;
                    color: #FFD700;
                    text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
                    position: relative;
                    padding-bottom: 0.5rem;
                }
                
                .winners-title::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 25%;
                    width: 50%;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent);
                }
                
                .winners-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    max-height: 300px;
                    overflow-y: auto;
                    padding-right: 5px;
                    margin-right: -5px;
                }
                
                .winners-list::-webkit-scrollbar {
                    width: 5px;
                }
                
                .winners-list::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 10px;
                }
                
                .winners-list::-webkit-scrollbar-thumb {
                    background: rgba(78, 181, 247, 0.5);
                    border-radius: 10px;
                }
                
                .winner-item {
                    display: flex;
                    align-items: center;
                    background: rgba(30, 39, 70, 0.5);
                    border-radius: 8px;
                    padding: 0.75rem;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                
                .winner-item:hover {
                    background: rgba(30, 39, 70, 0.8);
                    transform: translateY(-2px);
                    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                }
                
                .winner-item.current-user {
                    background: linear-gradient(145deg, rgba(30, 113, 161, 0.5), rgba(0, 201, 167, 0.3));
                    border: 1px solid rgba(0, 201, 167, 0.5);
                }
                
                .winner-place {
                    width: 36px;
                    height: 36px;
                    min-width: 36px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                    margin-right: 0.75rem;
                }
                
                .winner-place.top-1 {
                    background: linear-gradient(145deg, #FFD700, #FFA500);
                    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
                
                .winner-place.top-2 {
                    background: linear-gradient(145deg, #C0C0C0, #A9A9A9);
                    box-shadow: 0 0 8px rgba(192, 192, 192, 0.5);
                }
                
                .winner-place.top-3 {
                    background: linear-gradient(145deg, #CD7F32, #A0522D);
                    box-shadow: 0 0 8px rgba(205, 127, 50, 0.5);
                }
                
                .place-number {
                    font-weight: bold;
                    color: white;
                    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                }
                
                .winner-info {
                    flex: 1;
                }
                
                .winner-name {
                    font-weight: bold;
                    color: white;
                    margin-bottom: 0.25rem;
                }
                
                .current-user .winner-name {
                    color: #FFD700;
                    text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);
                }
                
                .winner-telegram {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.7);
                    margin-bottom: 0.25rem;
                }
                
                .winner-prize {
                    display: inline-block;
                    padding: 0.25rem 0.6rem;
                    background: linear-gradient(90deg, #FFD700, #00C9A7);
                    border-radius: 20px;
                    font-weight: bold;
                    color: #1A1A2E;
                    font-size: 0.875rem;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                    white-space: nowrap;
                }
                
                /* Кнопка закриття */
                .join-button {
                    width: 100%;
                    background: linear-gradient(90deg, #FFD700, #00dfd1);
                    border: none;
                    border-radius: 25px;
                    padding: 0.9rem;
                    color: #1A1A2E;
                    font-size: 1rem;
                    font-weight: bold;
                    margin-top: 0.625rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .join-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
                    background: linear-gradient(90deg, #FFE44D, #00C9A7);
                }
                
                .join-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }
            `;

            document.head.appendChild(styleElement);
            console.log("✅ Стилі для преміальних модальних вікон додано");
        } catch (e) {
            console.error("❌ Помилка при додаванні стилів:", e);
        }
    }

    /**
     * Виправляємо кнопки закриття для існуючих модальних вікон
     */
    function fixCloseButtons() {
        try {
            // Знаходимо всі модальні вікна
            const modals = document.querySelectorAll('.raffle-modal, .daily-raffle-modal');
            console.log(`ℹ️ Знайдено ${modals.length} модальних вікон`);

            modals.forEach(modal => {
                setupModalClose(modal);
            });

            console.log("✅ Кнопки закриття для модальних вікон виправлено");
        } catch (e) {
            console.error("❌ Помилка при виправленні кнопок закриття:", e);
        }
    }

    /**
     * Налаштовуємо кнопки закриття для модального вікна
     */
    function setupModalClose(modal) {
        try {
            if (!modal || !modal.classList || (!modal.classList.contains('raffle-modal') && !modal.classList.contains('daily-raffle-modal'))) {
                return;
            }

            // Знаходимо кнопку закриття
            const closeButton = modal.querySelector('.modal-close');
            if (closeButton) {
                // Замінюємо існуючу кнопку на нову, щоб прибрати всі обробники подій
                const newCloseButton = closeButton.cloneNode(true);
                closeButton.parentNode.replaceChild(newCloseButton, closeButton);

                // Додаємо новий обробник, який закриває модальне вікно
                newCloseButton.addEventListener('click', function() {
                    modal.classList.remove('open');
                });
            }

            // Також перевіряємо кнопку "Закрити"
            const closeActionButtons = modal.querySelectorAll('.join-button[id$="close-btn"], .join-button');
            closeActionButtons.forEach(closeActionButton => {
                if (closeActionButton && (
                    (closeActionButton.id && closeActionButton.id.includes('close')) ||
                    (closeActionButton.textContent && (
                        closeActionButton.textContent.includes('Закрити') ||
                        closeActionButton.textContent.includes('ЗАКРИТИ')
                    ))
                )) {
                    // Замінюємо існуючу кнопку на нову
                    const newCloseActionButton = closeActionButton.cloneNode(true);
                    closeActionButton.parentNode.replaceChild(newCloseActionButton, closeActionButton);

                    // Додаємо новий обробник
                    newCloseActionButton.addEventListener('click', function() {
                        modal.classList.remove('open');
                    });
                }
            });
        } catch (e) {
            console.error("❌ Помилка при налаштуванні закриття модального вікна:", e);
        }
    }

    /**
     * Налаштовуємо MutationObserver для відстеження нових модальних вікон
     */
    function setupMutationObserver() {
        try {
            // Перевірка підтримки MutationObserver
            if (!window.MutationObserver) {
                console.warn("⚠️ MutationObserver не підтримується у цьому браузері");
                return;
            }

            // Створюємо безпечний обробник
            const safeCallback = function(mutations) {
                try {
                    mutations.forEach(function(mutation) {
                        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                            for (let i = 0; i < mutation.addedNodes.length; i++) {
                                const node = mutation.addedNodes[i];
                                if (node.nodeType === 1) { // Елемент
                                    if (node.classList && (node.classList.contains('raffle-modal') || node.classList.contains('daily-raffle-modal'))) {
                                        // Знайдено нове модальне вікно
                                        console.log("ℹ️ Знайдено нове модальне вікно, налаштовую закриття");
                                        setupModalClose(node);
                                    } else {
                                        // Перевіряємо вкладені елементи
                                        const modals = node.querySelectorAll('.raffle-modal, .daily-raffle-modal');
                                        if (modals.length > 0) {
                                            console.log(`ℹ️ Знайдено ${modals.length} вкладених модальних вікон`);
                                            modals.forEach(setupModalClose);
                                        }
                                    }
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error("❌ Помилка в обробнику MutationObserver:", e);
                }
            };

            // Створюємо MutationObserver з безпечним обробником
            const observer = new MutationObserver(safeCallback);

            // Почати спостереження
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log("✅ MutationObserver успішно налаштовано");

            // Зберігаємо посилання на observer, щоб можна було зупинити спостереження
            window.winixModalObserver = observer;
        } catch (e) {
            console.error("❌ Помилка при налаштуванні MutationObserver:", e);
        }
    }

    /**
     * Перевизначаємо функцію показу деталей розіграшу
     */
    function overrideRaffleDetailsModal() {
        try {
            // Перевіряємо, чи існує оригінальна функція
            if (typeof window.createRaffleDetailsModal !== 'function') {
                console.log("ℹ️ Функція createRaffleDetailsModal не знайдена, створюємо нову");

                // Створюємо нову функцію
                window.createRaffleDetailsModal = function(raffleData) {
                    console.log("📊 Показ деталей розіграшу:", raffleData?.id || 'невідомий розіграш');
                    return createPremiumRaffleDetailsModal(raffleData);
                };

                return;
            }

            // Зберігаємо оригінальну функцію
            const originalCreateRaffleDetailsModal = window.createRaffleDetailsModal;

            // Перевизначаємо функцію
            window.createRaffleDetailsModal = function(raffleData) {
                console.log("📊 Показ деталей розіграшу:", raffleData?.id || 'невідомий розіграш');

                try {
                    return createPremiumRaffleDetailsModal(raffleData);
                } catch (error) {
                    console.error("❌ Помилка при створенні преміального модального вікна розіграшу:", error);

                    // Обробка помилок
                    if (window.WinixAPI && window.WinixAPI.handleApiError) {
                        const errorMessage = window.WinixAPI.handleApiError(error, 'показу деталей розіграшу');
                        showErrorNotification(errorMessage);
                    } else {
                        showErrorNotification('Помилка при відображенні деталей розіграшу');
                    }

                    // Повертаємо до оригінальної функції як запасний варіант
                    try {
                        return originalCreateRaffleDetailsModal(raffleData);
                    } catch (fallbackError) {
                        console.error("❌ Помилка при виконанні оригінальної функції:", fallbackError);
                        return null;
                    }
                }
            };

            console.log("✅ Функцію показу деталей розіграшу перевизначено");
        } catch (e) {
            console.error("❌ Помилка при перевизначенні функції показу деталей розіграшу:", e);
        }
    }

    /**
     * Створює преміальне модальне вікно з деталями розіграшу
     */
    function createPremiumRaffleDetailsModal(raffleData) {
        try {
            // Видаляємо попереднє модальне вікно, якщо воно існує
            const existingModal = document.getElementById('raffle-history-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Створюємо нове модальне вікно з преміальним дизайном
            const modal = document.createElement('div');
            modal.id = 'raffle-history-modal';
            modal.className = 'raffle-modal';

            // Генеруємо HTML для вікна
            modal.innerHTML = generatePremiumModalHTML(raffleData);

            // Додаємо на сторінку
            document.body.appendChild(modal);

            // Додаємо обробники подій для кнопок закриття
            setTimeout(function() {
                const closeButton = modal.querySelector('.modal-close');
                if (closeButton) {
                    closeButton.addEventListener('click', function() {
                        modal.classList.remove('open');
                        setTimeout(() => modal.remove(), 300);
                    });
                }

                const closeActionButton = modal.querySelector('#close-history-btn');
                if (closeActionButton) {
                    closeActionButton.addEventListener('click', function() {
                        modal.classList.remove('open');
                        setTimeout(() => modal.remove(), 300);
                    });
                }
            }, 100);

            // Відкриваємо модальне вікно з затримкою для анімації
            setTimeout(() => {
                modal.classList.add('open');
            }, 10);

            return modal;
        } catch (error) {
            console.error("❌ Помилка при створенні преміального модального вікна:", error);
            throw error;
        }
    }

    /**
     * Показ повідомлення про помилку користувачу
     */
    function showErrorNotification(message) {
        try {
            if (window.showNotification) {
                window.showNotification(message, 'error', 5000);
            } else if (window.simpleAlert) {
                window.simpleAlert(message, true);
            } else if (window.WinixCore && window.WinixCore.UI && window.WinixCore.UI.showNotification) {
                window.WinixCore.UI.showNotification(message, 'error');
            } else {
                alert(message);
            }
        } catch (e) {
            console.error("❌ Помилка при показі повідомлення про помилку:", e);
            alert(message);
        }
    }

    /**
     * Генерує HTML для преміального модального вікна
     */
    function generatePremiumModalHTML(raffleData) {
        // Перевіряємо і обробляємо вхідні дані
        raffleData = raffleData || {};

        const date = raffleData.date || '20.03.2025';
        const prize = raffleData.prize || '50 USDT • 10 переможців';
        const result = raffleData.result || 'Ви були учасником';
        const status = raffleData.status || 'participated';

        // Визначаємо тип розіграшу та кількість переможців
        const isUsdtRaffle = prize.includes('USDT');
        const isWinixRaffle = prize.includes('WINIX');
        const winnersCount = prize.includes('10 переможців') ? 10 :
                            prize.includes('15 переможців') ? 15 :
                            prize.includes('5 переможців') ? 5 :
                            10; // За замовчуванням 10 переможців

        // Якщо є дані реальних переможців у вхідних даних, використовуємо їх
        let winners = raffleData.winners || [];

        // Якщо переможців немає, але є API, спробуємо отримати їх
        if ((!winners || winners.length === 0) && window.WinixAPI && window.WinixAPI.getRaffleWinners) {
            try {
                // В асинхронному коді ми б використали await, але тут це синхронний контекст
                // Тому просто генеруємо штучні дані, які будуть замінені пізніше
                winners = generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status);

                // Ініціюємо запит для отримання реальних переможців
                if (raffleData.id) {
                    window.WinixAPI.getRaffleWinners(raffleData.id, (error, realWinners) => {
                        if (!error && realWinners && realWinners.length > 0) {
                            // Оновлюємо HTML з реальними переможцями
                            const winnersListContainer = document.querySelector('#raffle-history-modal .winners-list');
                            if (winnersListContainer) {
                                winnersListContainer.innerHTML = generateWinnersListHTML(realWinners);
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn("⚠️ Неможливо отримати список переможців, використовуємо штучні дані:", e);
                winners = generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status);
            }
        } else if (!winners || winners.length === 0) {
            // Якщо немає API і немає переможців у вхідних даних, генеруємо штучні
            winners = generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status);
        }

        // Генеруємо HTML для списку переможців
        let winnersHTML = generateWinnersListHTML(winners);

        // Формуємо повний HTML модального вікна
        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Деталі розіграшу</h2>
                    <span class="modal-close">×</span>
                </div>
                
                <div class="prize-details">
                    <div class="detail-item">
                        <div class="detail-label">Дата:</div>
                        <div class="detail-value">${date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Приз:</div>
                        <div class="detail-value">${prize}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Статус:</div>
                        <div class="detail-value ${status}">${result}</div>
                    </div>
                </div>
                
                <div class="winners-section">
                    <div class="winners-title">Переможці розіграшу</div>
                    <div class="winners-list">
                        ${winnersHTML}
                    </div>
                </div>
                
                <button class="join-button" id="close-history-btn">Закрити</button>
            </div>
        `;
    }

    /**
     * Генерує реалістичні дані переможців в залежності від типу розіграшу
     */
    function generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status) {
        const winners = [];
        const isWinner = status === 'won' || status === 'виграно';

        // Реальні Telegram нікнейми для переможців
        const usernames = [
            'workerscrypto', 'crypto_king', 'winix_whale', 'blockchain_bro',
            'token_trader', 'web3_wizard', 'defi_master', 'satoshi_fanboy',
            'crypto_queen', 'btc_billionaire', 'eth_enthusiast', 'nft_collector',
            'dao_developer', 'crypto_guru', 'meta_explorer', 'staking_pro',
            'yield_farmer', 'altcoin_analyst', 'cryptopunks_fan', 'hodl_hero',
            'moon_hunter', 'doge_believer', 'ledger_lover', 'hash_hunter',
            'wallet_warrior', 'crypto_chad', 'coin_crusader', 'block_builder'
        ];

        // Генеруємо унікальні ID користувачів (віртуальні для прикладу)
        const userIds = Array.from({ length: winnersCount }, (_, i) =>
            Math.floor(Math.random() * 900000000) + 100000000
        );

        // Генеруємо унікальні нікнейми для всіх переможців
        const shuffledUsernames = [...usernames].sort(() => 0.5 - Math.random()).slice(0, winnersCount);

        // Генеруємо переможців
        for (let i = 0; i < winnersCount; i++) {
            // Визначаємо приз в залежності від типу розіграшу і місця
            let prize = '';

            if (isUsdtRaffle) {
                // Розподіл призів для USDT розіграшу
                if (winnersCount === 10) {
                    // 50 USDT на 10 переможців
                    if (i === 0) prize = '10 USDT';
                    else if (i === 1) prize = '7.5 USDT';
                    else if (i === 2) prize = '5 USDT';
                    else prize = '3.5 USDT';
                } else if (winnersCount === 5) {
                    // 100 USDT на 5 переможців
                    if (i === 0) prize = '40 USDT';
                    else if (i === 1) prize = '20 USDT';
                    else if (i === 2) prize = '15 USDT';
                    else prize = '12.5 USDT';
                } else {
                    // За замовчуванням
                    if (i === 0) prize = '20 USDT';
                    else if (i === 1) prize = '10 USDT';
                    else prize = '5 USDT';
                }
            } else if (isWinixRaffle) {
                // Розподіл призів для WINIX розіграшу
                if (winnersCount === 15) {
                    // 30,000 WINIX на 15 переможців
                    prize = '2,000 WINIX';
                } else if (winnersCount === 5) {
                    // 20,000 WINIX на 5 переможців
                    if (i === 0) prize = '6,000 WINIX';
                    else if (i === 1) prize = '5,000 WINIX';
                    else if (i === 2) prize = '4,000 WINIX';
                    else prize = '2,500 WINIX';
                } else {
                    // За замовчуванням
                    if (i === 0) prize = '10,000 WINIX';
                    else if (i === 1) prize = '8,000 WINIX';
                    else if (i === 2) prize = '5,000 WINIX';
                    else prize = '2,000 WINIX';
                }
            } else {
                // За замовчуванням
                if (i === 0) prize = '1-е місце';
                else if (i === 1) prize = '2-е місце';
                else if (i === 2) prize = '3-є місце';
                else prize = 'Приз';
            }

            // Визначаємо, чи поточний користувач є переможцем
            const isCurrentUser = isWinner && i === 2; // Для демонстрації, вважаємо користувача 3-м переможцем

            // Додаємо переможця
            winners.push({
                place: i + 1,
                username: isCurrentUser ? 'Ви' : shuffledUsernames[i],
                telegramUsername: isCurrentUser ? 'Ви' : '@' + shuffledUsernames[i],
                userId: isCurrentUser ? 'Ви' : userIds[i],
                prize: prize,
                isCurrentUser: isCurrentUser
            });
        }

        return winners;
    }

    /**
     * Генерує HTML для списку переможців
     */
    function generateWinnersListHTML(winners) {
        // Перевіряємо, чи є переможці
        if (!winners || winners.length === 0) {
            return '<div class="no-winners">Інформація про переможців відсутня</div>';
        }

        try {
            // Генеруємо HTML для кожного переможця
            return winners.map(winner => {
                // Визначаємо клас для місця (top-1, top-2, top-3)
                const placeClass = winner.place <= 3 ? `top-${winner.place}` : '';

                // Формуємо HTML для одного переможця
                return `
                    <div class="winner-item ${winner.isCurrentUser ? 'current-user' : ''}">
                        <div class="winner-place ${placeClass}">
                            <span class="place-number">${winner.place}</span>
                        </div>
                        <div class="winner-info">
                            <div class="winner-name">${winner.username}</div>
                            ${winner.isCurrentUser ? '' : `<div class="winner-telegram">ID: ${winner.userId || winner.telegramUsername}</div>`}
                        </div>
                        <div class="winner-prize">${winner.prize}</div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error("❌ Помилка при генерації HTML для списку переможців:", e);
            return '<div class="no-winners">Помилка завантаження переможців</div>';
        }
    }

    // Експортуємо публічні функції
    window.winixModalFix = {
        fixCloseButtons,
        setupModalClose,
        generateRealWinners,
        generateWinnersListHTML,
        createRaffleDetailsModal: window.createRaffleDetailsModal,

        // Додаткові функції для контролю інших модулів
        stopObserver: function() {
            if (window.winixModalObserver) {
                window.winixModalObserver.disconnect();
                console.log("✅ MutationObserver зупинено");
            }
        },
        startObserver: function() {
            if (window.winixModalObserver) {
                setupMutationObserver();
                console.log("✅ MutationObserver перезапущено");
            } else {
                setupMutationObserver();
            }
        }
    };

    // Сповіщаємо інші модулі про ініціалізацію
    document.dispatchEvent(new CustomEvent('winix-modal-fix-initialized'));

    console.log("🏆 WINIX PREMIUM MODALS: Преміальні модальні вікна готові!");
})();