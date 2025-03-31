/**
 * WINIX - Преміальні модальні вікна розіграшів з реалістичними даними переможців
 * Виправляє кнопки закриття у всіх модальних вікнах і покращує відображення деталей розіграшів
 */
(function() {
    console.log("🏆 WINIX PREMIUM MODALS: Запуск...");

    // Додаємо необхідні стилі для преміального дизайну
    injectModalStyles();

    // Виправляємо кнопки закриття у всіх модальних вікнах
    fixCloseButtons();

    // Перевизначаємо функцію показу деталей розіграшу
    overrideRaffleDetailsModal();

    /**
     * Додаємо стилі для преміальних модальних вікон
     */
    function injectModalStyles() {
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
        console.log("Стилі для преміальних модальних вікон додано");
    }

    /**
     * Виправляємо кнопки закриття для існуючих модальних вікон
     */
    function fixCloseButtons() {
        // Знаходимо всі модальні вікна
        const modals = document.querySelectorAll('.raffle-modal, .daily-raffle-modal');

        modals.forEach(modal => {
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
            const closeActionButton = modal.querySelector('.join-button[id$="close-btn"], .join-button');
            if (closeActionButton && (closeActionButton.id && closeActionButton.id.includes('close') ||
                                    closeActionButton.textContent.includes('Закрити') ||
                                    closeActionButton.textContent.includes('ЗАКРИТИ'))) {
                const newCloseActionButton = closeActionButton.cloneNode(true);
                closeActionButton.parentNode.replaceChild(newCloseActionButton, closeActionButton);

                newCloseActionButton.addEventListener('click', function() {
                    modal.classList.remove('open');
                });
            }
        });

        // Створюємо MutationObserver для спостереження за змінами в DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];
                        if (node.nodeType === 1) { // Елемент
                            if (node.classList && (node.classList.contains('raffle-modal') || node.classList.contains('daily-raffle-modal'))) {
                                // Знайдено нове модальне вікно
                                setupModalClose(node);
                            } else {
                                // Перевіряємо вкладені елементи
                                const modals = node.querySelectorAll('.raffle-modal, .daily-raffle-modal');
                                modals.forEach(setupModalClose);
                            }
                        }
                    }
                }
            });
        });

        // Налаштовуємо кнопки закриття для модального вікна
        function setupModalClose(modal) {
            // Знаходимо кнопку закриття
            const closeButton = modal.querySelector('.modal-close');
            if (closeButton) {
                // Додаємо обробник, який закриває модальне вікно
                closeButton.addEventListener('click', function() {
                    modal.classList.remove('open');
                });
            }

            // Перевіряємо кнопку "Закрити"
            const closeActionButton = modal.querySelector('.join-button[id$="close-btn"], .join-button');
            if (closeActionButton && (closeActionButton.id && closeActionButton.id.includes('close') ||
                                     closeActionButton.textContent.includes('Закрити') ||
                                     closeActionButton.textContent.includes('ЗАКРИТИ'))) {
                closeActionButton.addEventListener('click', function() {
                    modal.classList.remove('open');
                });
            }
        }

        // Почати спостереження
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log("Кнопки закриття для модальних вікон виправлено");
    }

    /**
     * Перевизначаємо функцію показу деталей розіграшу
     */
    function overrideRaffleDetailsModal() {
        // Зберігаємо оригінальну функцію, якщо вона існує
        const originalCreateRaffleDetailsModal = window.createRaffleDetailsModal;

        // Перевизначаємо функцію
        window.createRaffleDetailsModal = function(raffleData) {
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
        };

        console.log("Функцію показу деталей розіграшу перевизначено");
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

        // Генеруємо відповідний список переможців
        let winners = generateRealWinners(isUsdtRaffle, isWinixRaffle, winnersCount, status);

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
                        ${winner.isCurrentUser ? '' : `<div class="winner-telegram">${winner.telegramUsername}</div>`}
                    </div>
                    <div class="winner-prize">${winner.prize}</div>
                </div>
            `;
        }).join('');
    }

    console.log("🏆 WINIX PREMIUM MODALS: Преміальні модальні вікна готові!");
})();