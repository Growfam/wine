/**
 * WINIX - Модальне вікно для деталей розіграшів (modal.js)
 * Універсальний компонент модального вікна для відображення деталей розіграшів
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Перевіряємо, чи вже є глобальна функція showModal
    if (typeof window.showModal === 'function') {
        console.log('✅ Функція showModal вже існує');
        return;
    }

    console.log('🔄 Ініціалізація модуля модального вікна...');

    // Додаємо стилі для модального вікна
    function injectModalStyles() {
        // Перевіряємо, чи стилі вже були додані
        if (document.getElementById('modal-styles')) {
            return;
        }

        // Створюємо стильовий елемент
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .modal-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                animation: backdrop-fade-in 0.3s ease;
            }
            
            @keyframes backdrop-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .modal-content {
                position: relative;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                background-color: #202a38;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 25px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                animation: modal-appear 0.3s ease-out;
            }
            
            @keyframes modal-appear {
                from { opacity: 0; transform: scale(0.95) translateY(-20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background-color: #1a2130;
                border-bottom: 1px solid #313e52;
            }
            
            .modal-title {
                margin: 0;
                color: white;
                font-size: 1.3rem;
                font-weight: bold;
            }
            
            .modal-close-button {
                background: none;
                border: none;
                color: #a0aec0;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0 5px;
                transition: color 0.2s ease;
            }
            
            .modal-close-button:hover {
                color: white;
            }
            
            .modal-body {
                padding: 20px;
                overflow-y: auto;
                max-height: calc(90vh - 70px);
                color: white;
            }
            
            /* Стилі для деталей розіграшу */
            .raffle-details-modal {
                display: flex;
                flex-direction: column;
                gap: 20px;
                color: white;
            }
            
            .raffle-details-image {
                width: 100%;
                text-align: center;
            }
            
            .raffle-details-image img {
                max-width: 100%;
                max-height: 200px;
                border-radius: 8px;
                object-fit: cover;
            }
            
            .raffle-details-content {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .raffle-details-title {
                margin: 0;
                color: #4CAF50;
                font-size: 1.4rem;
            }
            
            .raffle-details-description {
                margin: 0 0 15px 0;
                line-height: 1.5;
            }
            
            .raffle-details-metadata {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .metadata-item {
                display: flex;
                flex-direction: column;
            }
            
            .metadata-label {
                font-size: 0.9rem;
                color: #a0aec0;
            }
            
            .metadata-value {
                font-weight: bold;
            }
            
            .prize-distribution {
                margin: 15px 0;
                padding: 15px;
                background-color: rgba(76, 175, 80, 0.1);
                border-left: 3px solid #4CAF50;
                border-radius: 4px;
            }
            
            .prize-distribution h4 {
                margin: 0 0 10px 0;
                color: #4CAF50;
            }
            
            .prize-distribution ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .prize-distribution li {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .prize-distribution li:last-child {
                border-bottom: none;
            }
            
            .participation-status {
                padding: 10px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 10px;
            }
            
            .participation-status.participating {
                background-color: rgba(76, 175, 80, 0.1);
                border: 1px solid rgba(76, 175, 80, 0.3);
            }
            
            .participation-status.not-participating {
                background-color: rgba(244, 67, 54, 0.1);
                border: 1px solid rgba(244, 67, 54, 0.3);
            }
            
            .status-icon {
                font-size: 1.2rem;
            }
            
            .raffle-details-actions {
                margin-top: 15px;
                text-align: center;
            }
            
            .raffle-details-actions .join-button {
                width: 100%;
                padding: 12px 20px;
                border-radius: 25px;
                border: none;
                background: linear-gradient(90deg, #4CAF50, #009688);
                color: white;
                font-weight: bold;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .raffle-details-actions .join-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
            }
            
            .raffle-details-actions .join-button:active {
                transform: translateY(1px);
            }
            
            .raffle-details-actions .join-button.participating {
                background: linear-gradient(90deg, #2196F3, #03A9F4);
            }
            
            /* Стилі для анімації модальних вікон */
            .modal-container.closing .modal-backdrop {
                animation: backdrop-fade-out 0.3s ease forwards;
            }
            
            .modal-container.closing .modal-content {
                animation: modal-disappear 0.3s ease-in forwards;
            }
            
            @keyframes backdrop-fade-out {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes modal-disappear {
                from { opacity: 1; transform: scale(1) translateY(0); }
                to { opacity: 0; transform: scale(0.95) translateY(-20px); }
            }
            
            @media (max-width: 768px) {
                .raffle-details-metadata {
                    grid-template-columns: 1fr;
                }
                
                .modal-content {
                    width: 95%;
                }
            }
        `;

        // Додаємо стилі до head
        document.head.appendChild(style);
    }

    // Ініціалізуємо стилі
    injectModalStyles();

    /**
     * Функція відображення модального вікна
     * @param {string} title - Заголовок модального вікна
     * @param {string} content - HTML-вміст модального вікна
     * @param {Object} options - Додаткові параметри
     */
    window.showModal = function(title, content, options = {}) {
        // Опції за замовчуванням
        const defaultOptions = {
            width: '90%',       // Ширина модального вікна
            maxWidth: '600px',  // Максимальна ширина
            closeOnBackdrop: true, // Закривати при кліку на фон
            closeAfter: 0,      // Автоматичне закриття через N мс (0 - не закривати)
            onClose: null       // Callback при закритті
        };

        // Об'єднуємо опції за замовчуванням з переданими опціями
        const settings = { ...defaultOptions, ...options };

        // Видаляємо існуюче модальне вікно, якщо воно є
        const existingModal = document.querySelector('.modal-container');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // Створюємо контейнер модального вікна
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';

        // Створюємо HTML модального вікна
        modalContainer.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${title}</h2>
                    <button class="modal-close-button">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        // Застосовуємо користувацькі стилі
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.style.width = settings.width;
        modalContent.style.maxWidth = settings.maxWidth;

        // Додаємо модальне вікно до DOM
        document.body.appendChild(modalContainer);

        // Запобігаємо прокрутці сторінки під модальним вікном
        document.body.style.overflow = 'hidden';

        // Функція для закриття модального вікна з анімацією
        const closeModal = () => {
            // Додаємо клас для анімації закриття
            modalContainer.classList.add('closing');

            // Чекаємо завершення анімації і видаляємо модальне вікно
            setTimeout(() => {
                // Перевіряємо чи модальне вікно все ще існує в DOM
                if (document.body.contains(modalContainer)) {
                    document.body.removeChild(modalContainer);
                }

                // Відновлюємо прокрутку
                document.body.style.overflow = '';

                // Викликаємо callback, якщо він переданий
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, 300); // Час анімації
        };

        // Додаємо обробник кліку для закриття модального вікна
        const closeButton = modalContainer.querySelector('.modal-close-button');
        closeButton.addEventListener('click', closeModal);

        // Якщо увімкнено закриття при кліку на фон
        if (settings.closeOnBackdrop) {
            const backdrop = modalContainer.querySelector('.modal-backdrop');
            backdrop.addEventListener('click', closeModal);
        }

        // Додаємо обробник для кнопки Escape
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeModal();
                // Видаляємо обробник після закриття
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Автоматичне закриття, якщо вказано
        if (settings.closeAfter > 0) {
            setTimeout(closeModal, settings.closeAfter);
        }

        // Повертаємо функцію закриття модального вікна
        return closeModal;
    };

    // Додаткова функція для показу повідомлень або підтверджень
    window.showConfirmModal = function(title, message, onConfirm, onCancel) {
        const content = `
            <div class="confirm-modal">
                <p class="confirm-message">${message}</p>
                <div class="confirm-buttons">
                    <button class="confirm-button-yes">Так</button>
                    <button class="confirm-button-no">Ні</button>
                </div>
            </div>
        `;

        // Додаємо стилі для модального вікна підтвердження
        const style = document.createElement('style');
        style.textContent = `
            .confirm-modal {
                text-align: center;
                padding: 10px;
            }
            
            .confirm-message {
                font-size: 1.1rem;
                margin-bottom: 20px;
            }
            
            .confirm-buttons {
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            
            .confirm-button-yes, .confirm-button-no {
                padding: 10px 25px;
                border-radius: 25px;
                border: none;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .confirm-button-yes {
                background: linear-gradient(90deg, #4CAF50, #009688);
                color: white;
            }
            
            .confirm-button-no {
                background: linear-gradient(90deg, #f44336, #e53935);
                color: white;
            }
            
            .confirm-button-yes:hover, .confirm-button-no:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(style);

        // Відображаємо модальне вікно
        const closeModal = window.showModal(title, content, {
            width: '85%',
            maxWidth: '400px'
        });

        // Додаємо обробники для кнопок
        setTimeout(() => {
            const yesButton = document.querySelector('.confirm-button-yes');
            const noButton = document.querySelector('.confirm-button-no');

            yesButton.addEventListener('click', () => {
                closeModal();
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });

            noButton.addEventListener('click', () => {
                closeModal();
                if (typeof onCancel === 'function') {
                    onCancel();
                }
            });
        }, 100);
    };

    // Додаткова функція для показу модального вікна з відображенням деталей розіграшу
    window.showRaffleDetailsModal = function(raffle, isParticipating = false, ticketCount = 0) {
        // Перевірка наявності об'єкта розіграшу
        if (!raffle || !raffle.id) {
            console.error('❌ Помилка: невалідний об\'єкт розіграшу');
            window.showToast('Неможливо відобразити деталі розіграшу', 'error');
            return;
        }

        // Форматуємо дані розіграшу для відображення
        const formattedEndDate = window.WinixRaffles && window.WinixRaffles.formatters ?
            window.WinixRaffles.formatters.formatDateTime(raffle.end_time) :
            new Date(raffle.end_time).toLocaleString('uk-UA');

        // Створюємо HTML для розподілу призів
        let prizeDistributionHtml = '';
        if (raffle.prize_distribution && Array.isArray(raffle.prize_distribution)) {
            prizeDistributionHtml = `
                <div class="prize-distribution">
                    <h4>Розподіл призів:</h4>
                    <ul>
                        ${raffle.prize_distribution.map((prize, index) => `
                            <li>
                                <span class="prize-place">${index + 1} місце:</span>
                                <span class="prize-amount">${prize.amount} ${prize.currency || raffle.prize_currency}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else if (raffle.winners_count > 1) {
            // Якщо є декілька переможців, але немає точного розподілу
            const avgPrize = Math.floor(raffle.prize_amount / raffle.winners_count);
            prizeDistributionHtml = `
                <div class="prize-distribution">
                    <h4>Розподіл призів:</h4>
                    <p>Приз ${raffle.prize_amount} ${raffle.prize_currency} буде розподілено між ${raffle.winners_count} переможцями (приблизно по ${avgPrize} ${raffle.prize_currency}).</p>
                </div>
            `;
        }

        // Визначення HTML для статусу участі
        const participationStatusHtml = isParticipating ?
            `<div class="participation-status participating">
                <span class="status-icon">✅</span> 
                <span class="status-text">Ви берете участь із ${ticketCount} білетами</span>
            </div>` :
            `<div class="participation-status not-participating">
                <span class="status-icon">❌</span> 
                <span class="status-text">Ви не берете участь у цьому розіграші</span>
            </div>`;

        // Створюємо HTML для модального вікна
        const modalContent = `
            <div class="raffle-details-modal">
                <div class="raffle-details-image">
                    <img src="${raffle.image_url || 'assets/prize-poster.gif'}" alt="${raffle.title}">
                </div>
                
                <div class="raffle-details-content">
                    <h3 class="raffle-details-title">${raffle.title}</h3>
                    
                    <div class="raffle-details-info">
                        <p class="raffle-details-description">${raffle.description || 'Опис відсутній'}</p>
                        
                        <div class="raffle-details-metadata">
                            <div class="metadata-item">
                                <span class="metadata-label">Призовий фонд:</span>
                                <span class="metadata-value">${raffle.prize_amount} ${raffle.prize_currency}</span>
                            </div>
                            
                            <div class="metadata-item">
                                <span class="metadata-label">Кількість переможців:</span>
                                <span class="metadata-value">${raffle.winners_count}</span>
                            </div>
                            
                            <div class="metadata-item">
                                <span class="metadata-label">Вартість участі:</span>
                                <span class="metadata-value">${raffle.entry_fee} жетон${raffle.entry_fee > 1 ? 'и' : ''}</span>
                            </div>
                            
                            <div class="metadata-item">
                                <span class="metadata-label">Завершення:</span>
                                <span class="metadata-value">${formattedEndDate}</span>
                            </div>
                            
                            <div class="metadata-item">
                                <span class="metadata-label">Учасників:</span>
                                <span class="metadata-value">${raffle.participants_count || 0}</span>
                            </div>
                        </div>
                        
                        ${prizeDistributionHtml}
                        
                        ${participationStatusHtml}
                    </div>
                    
                    <div class="raffle-details-actions">
                        ${!isParticipating ? `
                            <button class="join-button" data-raffle-id="${raffle.id}" data-raffle-type="${raffle.is_daily ? 'daily' : 'main'}">
                                Взяти участь за ${raffle.entry_fee} жетон${raffle.entry_fee > 1 ? 'и' : ''}
                            </button>
                        ` : `
                            <button class="join-button participating" data-raffle-id="${raffle.id}" data-raffle-type="${raffle.is_daily ? 'daily' : 'main'}">
                                Додати ще білет (у вас: ${ticketCount})
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Відображаємо модальне вікно
        return window.showModal('Деталі розіграшу', modalContent);
    };

    // Передаємо показ модального вікна у глобальне меню
    window.modalUtils = {
        show: window.showModal,
        confirm: window.showConfirmModal,
        showRaffleDetails: window.showRaffleDetailsModal
    };

    console.log('✅ Модуль модального вікна успішно ініціалізовано');
})();