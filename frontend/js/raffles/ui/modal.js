/**
 * WINIX - Преміальні модальні вікна (modal.js)
 * Універсальний компонент модального вікна з сучасним дизайном
 * @version 3.0.0
 */

(function() {
    'use strict';

    // Перевіряємо, чи вже є глобальна функція showModal
    if (typeof window.showModal === 'function') {
        console.log('✅ Функція showModal вже існує');
        return;
    }

    console.log('🔄 Ініціалізація модуля преміальних модальних вікон...');

    // Додаємо базові стилі для модальних вікон
    if (!document.getElementById('premium-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'premium-modal-styles';
        style.textContent = `
            /* Базові стилі модальних вікон */
            .modal-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: rgba(0, 0, 0, 0.8) !important;
                backdrop-filter: blur(3px) !important;
                z-index: 9999 !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transition: opacity 0.3s, visibility 0.3s !important;
            }

            .modal-overlay.show {
                opacity: 1 !important;
                visibility: visible !important;
            }

            .modal-container {
                width: 90% !important;
                max-width: 500px !important;
                max-height: 90vh !important;
                background: linear-gradient(145deg, #1A1A2E, #0F3460) !important;
                border-radius: 1.25rem !important;
                overflow-y: auto !important;
                box-shadow: 0 0.625rem 1.25rem rgba(0, 0, 0, 0.5) !important;
                transform: scale(0.9) !important;
                opacity: 0 !important;
                transition: transform 0.3s, opacity 0.3s !important;
                display: flex !important;
                flex-direction: column !important;
                color: #ffffff !important;
                margin: 0 auto !important;
            }

            .modal-overlay.show .modal-container {
                transform: scale(1) !important;
                opacity: 1 !important;
            }

            .modal-header {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                padding: 1rem 1.5rem !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
                position: relative !important;
                background: linear-gradient(90deg, rgba(30, 39, 70, 0.9), rgba(15, 52, 96, 0.9)) !important;
            }

            .modal-title {
                font-size: 1.25rem !important;
                font-weight: bold !important;
                color: white !important;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
                margin: 0 !important;
                text-align: center !important;
            }

            .modal-close {
                position: absolute !important;
                right: 15px !important;
                color: rgba(255, 255, 255, 0.7) !important;
                font-size: 1.5rem !important;
                cursor: pointer !important;
                transition: color 0.2s !important;
                background: none !important;
                border: none !important;
                width: 32px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50% !important;
                background: rgba(255, 255, 255, 0.1) !important;
            }

            .modal-close:hover {
                color: white !important;
                background: rgba(255, 255, 255, 0.2) !important;
            }

            .modal-body {
                padding: 1rem 1.5rem !important;
                color: #ffffff !important;
                flex-grow: 1 !important;
                overflow-y: auto !important;
                background-color: transparent !important;
            }

            .modal-footer {
                padding: 1rem !important;
                display: flex !important;
                justify-content: flex-end !important;
                border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            
            /* Преміальні стилі для модальних вікон */
            .premium-modal .modal-container {
                background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(15, 52, 96, 0.98)) !important;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset !important;
                border-radius: 20px !important;
                overflow: hidden !important;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) !important;
                animation: modal-appear 0.4s cubic-bezier(0.19, 1, 0.22, 1) !important;
                margin: 0 auto !important;
            }
            
            .premium-modal .modal-container::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 2px !important;
                background: linear-gradient(90deg,
                    rgba(0, 201, 167, 0),
                    rgba(0, 201, 167, 0.8),
                    rgba(0, 201, 167, 0)) !important;
                animation: glow-line 2s infinite !important;
                z-index: 10 !important;
            }
            
            @keyframes glow-line {
                0% { opacity: 0.3; transform: translateX(-100%); }
                50% { opacity: 1; }
                100% { opacity: 0.3; transform: translateX(100%); }
            }
            
            @keyframes modal-appear {
                0% { transform: scale(0.8); opacity: 0; }
                70% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .premium-modal .modal-header {
                background: linear-gradient(90deg, rgba(30, 39, 70, 0.9), rgba(15, 52, 96, 0.9)) !important;
                padding: 20px !important;
                position: relative !important;
                border-bottom: 1px solid rgba(78, 181, 247, 0.2) !important;
            }
            
            .premium-modal .modal-title {
                font-size: 22px !important;
                font-weight: bold !important;
                color: white !important;
                margin: 0 !important;
                text-align: center !important;
                text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3) !important;
            }
            
            .premium-modal .modal-close {
                position: absolute !important;
                top: 15px !important;
                right: 15px !important;
                background: rgba(255, 255, 255, 0.1) !important;
                border: none !important;
                color: white !important;
                width: 30px !important;
                height: 30px !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 22px !important;
                cursor: pointer !important;
                transition: all 0.3s !important;
                z-index: 15 !important;
            }
            
            .premium-modal .modal-close:hover {
                background: rgba(255, 255, 255, 0.2) !important;
                transform: rotate(90deg) !important;
            }
            
            .premium-modal .modal-body {
                padding: 20px !important;
                color: #fff !important;
                font-size: 16px !important;
                line-height: 1.5 !important;
                background: transparent !important;
            }
            
            /* Стилі для розіграшів */
            .raffle-details-modal {
                padding: 0 !important;
                width: 100% !important;
                background: transparent !important;
                color: #fff !important;
            }
            
            .raffle-section {
                margin-bottom: 20px !important;
                background: rgba(26, 32, 44, 0.3) !important;
                border-radius: 12px !important;
                padding: 16px !important;
                border: 1px solid rgba(78, 181, 247, 0.1) !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            
            .section-title {
                color: #4eb5f7 !important;
                font-size: 18px !important;
                font-weight: bold !important;
                margin: 0 0 12px 0 !important;
                border-bottom: 1px solid rgba(78, 181, 247, 0.2) !important;
                padding-bottom: 8px !important;
                background: transparent !important;
            }
            
            .raffle-image {
                width: 100% !important;
                height: 180px !important;
                object-fit: cover !important;
                border-radius: 12px !important;
                margin-bottom: 20px !important;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3) !important;
            }
            
            .raffle-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 15px !important;
                background: transparent !important;
            }
            
            .raffle-title {
                font-size: 20px !important;
                font-weight: bold !important;
                color: white !important;
                text-shadow: 0 0 0.3125rem rgba(0, 0, 0, 0.5) !important;
                margin: 0 !important;
            }
            
            .raffle-prize {
                display: inline-block !important;
                padding: 0.25rem 0.625rem !important;
                background: linear-gradient(90deg, #FFD700, #00dfd1) !important;
                border-radius: 1rem !important;
                font-size: 1rem !important;
                color: #1A1A2E !important;
                font-weight: bold !important;
            }
            
            .raffle-description {
                margin: 0 0 10px 0 !important;
                line-height: 1.5 !important;
                color: #fff !important;
            }
            
            /* Графік */
            .chart-container {
                height: 200px !important;
                margin: 20px 0 !important;
                background-color: rgba(30, 39, 70, 0.5) !important;
                border-radius: 8px !important;
                padding: 15px !important;
                position: relative !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }
            
            .chart-bar {
                position: absolute !important;
                bottom: 15px !important;
                width: 12% !important;
                background: linear-gradient(to top, #4eb5f7, #52C0BD) !important;
                border-radius: 3px 3px 0 0 !important;
                transition: height 1s ease !important;
            }
            
            .chart-bar:nth-child(odd) {
                background: linear-gradient(to top, #00C9A7, #4eb5f7) !important;
            }
            
            .chart-label {
                position: absolute !important;
                bottom: -25px !important;
                font-size: 12px !important;
                color: rgba(255, 255, 255, 0.7) !important;
                width: 12% !important;
                text-align: center !important;
            }
            
            .chart-title {
                text-align: center !important;
                color: #fff !important;
                margin-bottom: 15px !important;
                font-size: 14px !important;
            }
            
            /* Список призів */
            .prizes-list {
                list-style: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
            }
            
            .prize-item {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 10px 15px !important;
                margin-bottom: 8px !important;
                border-radius: 8px !important;
                background: rgba(26, 32, 44, 0.3) !important;
                border: 1px solid rgba(78, 181, 247, 0.1) !important;
            }
            
            .prize-place {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                font-size: 14px !important;
                color: #fff !important;
            }
            
            .prize-icon {
                width: 24px !important;
                height: 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50% !important;
                background: linear-gradient(to right, #4eb5f7, #00C9A7) !important;
                color: #1A1A2E !important;
                font-weight: bold !important;
                font-size: 12px !important;
                min-width: 24px !important;
            }
            
            .prize-amount {
                font-weight: bold !important;
                font-size: 14px !important;
                color: #00C9A7 !important;
            }
            
            /* Умови участі */
            .conditions-list {
                list-style: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
            }
            
            .condition-item {
                display: flex !important;
                gap: 10px !important;
                margin-bottom: 8px !important;
                align-items: flex-start !important;
                color: #fff !important;
            }
            
            .condition-item:last-child {
                margin-bottom: 0 !important;
            }
            
            .condition-icon {
                color: #4eb5f7 !important;
                font-size: 18px !important;
                min-width: 18px !important;
            }
            
            /* Адаптивність для мобільних пристроїв */
            @media (max-width: 450px) {
                .modal-container {
                    width: 95% !important;
                    max-height: 85vh !important;
                }
                
                .modal-header {
                    padding: 15px !important;
                }
                
                .modal-title {
                    font-size: 18px !important;
                }
                
                .modal-body {
                    padding: 15px !important;
                }
                
                .section-title {
                    font-size: 16px !important;
                }
                
                .raffle-section {
                    padding: 12px !important;
                    margin-bottom: 15px !important;
                }
                
                .chart-container {
                    height: 150px !important;
                    margin: 15px 0 !important;
                }
                
                .chart-label {
                    font-size: 10px !important;
                }
                
                .prize-item {
                    padding: 8px 12px !important;
                }
                
                .raffle-description {
                    font-size: 14px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

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
            onClose: null,      // Callback при закритті
            premium: true,      // Використовувати преміальний стиль
            animation: true     // Використовувати анімацію
        };

        // Об'єднуємо опції за замовчуванням з переданими опціями
        const settings = { ...defaultOptions, ...options };

        // Видаляємо існуюче модальне вікно, якщо воно є
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal && existingModal.parentNode) {
            existingModal.parentNode.removeChild(existingModal);
        }

        // Створюємо контейнер модального вікна
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay' + (settings.premium ? ' premium-modal' : '');

        // Створюємо HTML модального вікна
        modalOverlay.innerHTML = `
            <div class="modal-container">
                ${title ? `
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                ` : ''}
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        // Додаємо модальне вікно до DOM
        document.body.appendChild(modalOverlay);

        // Застосовуємо користувацькі стилі
        const modalContent = modalOverlay.querySelector('.modal-container');
        modalContent.style.width = settings.width;
        modalContent.style.maxWidth = settings.maxWidth;

        // Додаємо клас show з невеликою затримкою для анімації
        setTimeout(() => {
            modalOverlay.classList.add('show');
        }, 10);

        // Запобігаємо прокрутці сторінки під модальним вікном
        document.body.style.overflow = 'hidden';

        // Функція для закриття модального вікна з анімацією
        const closeModal = () => {
            // Видаляємо клас show для анімації закриття
            modalOverlay.classList.remove('show');

            // Чекаємо завершення анімації і видаляємо модальне вікно
            setTimeout(() => {
                // Перевіряємо чи модальне вікно все ще існує в DOM
                if (document.body.contains(modalOverlay)) {
                    document.body.removeChild(modalOverlay);
                }

                // Відновлюємо прокрутку
                document.body.style.overflow = '';

                // Викликаємо callback, якщо він переданий
                if (typeof settings.onClose === 'function') {
                    settings.onClose();
                }
            }, settings.animation ? 300 : 0); // Час анімації або 0, якщо анімація вимкнена
        };

        // Додаємо обробник кліку для закриття модального вікна
        const closeButton = modalOverlay.querySelector('.modal-close');
        if (closeButton) {
            closeButton.addEventListener('click', closeModal);
        }

        // Якщо увімкнено закриття при кліку на фон
        if (settings.closeOnBackdrop) {
            modalOverlay.addEventListener('click', function(e) {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            });
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

    /**
     * Функція для показу діалогового вікна підтвердження
     * @param {string} title - Заголовок діалогу
     * @param {string} message - Текст повідомлення
     * @param {Function} onConfirm - Функція при підтвердженні
     * @param {Function} onCancel - Функція при скасуванні
     */
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

    /**
     * Функція для показу модального вікна з відображенням деталей розіграшу
     * Оновлений преміальний дизайн, що відповідає стилю сторінки
     * @param {Object} raffle - Об'єкт з даними розіграшу
     * @param {boolean} isParticipating - Чи бере участь користувач
     * @param {number} ticketCount - Кількість білетів користувача
     */
    window.showRaffleDetailsModal = function(raffle, isParticipating = false, ticketCount = 0) {
        // Перевірка наявності об'єкта розіграшу
        if (!raffle || !raffle.id) {
            console.error('Помилка: невалідний об\'єкт розіграшу');
            window.showToast('Неможливо відобразити деталі розіграшу', 'error');
            return;
        }

        // Формуємо випадкові дані для графіка (у реальному додатку можна отримати з API)
        const chartData = {
            labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
            values: [
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50,
                Math.floor(Math.random() * 300) + 50
            ]
        };

        // Визначаємо максимальне значення для масштабування
        const maxValue = Math.max(...chartData.values);

        // Створюємо HTML для графіка
        let chartHtml = `
            <div class="raffle-section">
                <h3 class="section-title">Статистика участі</h3>
                <p class="chart-title">Кількість учасників за останні 5 днів</p>
                <div class="chart-container">
        `;

        // Додаємо стовпці та підписи
        chartData.values.forEach((value, index) => {
            const heightPercent = (value / maxValue) * 100;
            chartHtml += `
                <div class="chart-bar" style="left: ${index * 17 + 5}%; height: ${heightPercent}%"></div>
                <div class="chart-label" style="left: ${index * 17 + 5}%">${chartData.labels[index]}</div>
            `;
        });

        chartHtml += `
                </div>
            </div>
        `;

        // Форматуємо дату завершення
        const formatDateTime = (dateTime) => {
            if (!dateTime) return 'Невідомо';
            try {
                const date = new Date(dateTime);
                return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            } catch (e) {
                return 'Невідомо';
            }
        };

        const formattedEndDate = formatDateTime(raffle.end_time);

        // Використовуємо саме ті дані, що є у розіграші для розподілу призів
        let prizeDistributionHtml = '';

        // Головний приз
        if (raffle.prize_amount && raffle.prize_currency) {
            prizeDistributionHtml = `
                <div class="raffle-section">
                    <h3 class="section-title">Розподіл призів</h3>
                    <ul class="prizes-list">
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">1</div>
                                <span>1-5 місце</span>
                            </div>
                            <div class="prize-amount">Грошові винагороди (частина від $250)</div>
                        </li>
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">2</div>
                                <span>6-10 місце</span>
                            </div>
                            <div class="prize-amount">$Winix токени</div>
                        </li>
                        <li class="prize-item">
                            <div class="prize-place">
                                <div class="prize-icon">3</div>
                                <span>Кожен учасник</span>
                            </div>
                            <div class="prize-amount">550 $Winix токенів</div>
                        </li>
                    </ul>
                </div>
            `;
        }

        // Умови участі (без emoji)
        const conditionsHtml = `
            <div class="raffle-section">
                <h3 class="section-title">Умови участі</h3>
                <ul class="conditions-list">
                    <li class="condition-item">
                        <div class="condition-icon">-</div>
                        <div>Для участі потрібно мати мінімум ${raffle.entry_fee} жетони на балансі</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">-</div>
                        <div>Один користувач може брати участь кілька разів</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">-</div>
                        <div>Розіграш завершується ${formattedEndDate}</div>
                    </li>
                    <li class="condition-item">
                        <div class="condition-icon">-</div>
                        <div>Переможці обираються випадковим чином серед усіх учасників</div>
                    </li>
                </ul>
            </div>
        `;

        // Створюємо HTML для секції "Про розіграш" (ТЕПЕР БЕЗ EMOJI)
        const aboutHtml = `
            <div class="raffle-section">
                <h3 class="section-title">Про розіграш</h3>
                <p class="raffle-description">ВЕЛИКИЙ ДЖЕКПОТ РОЗІГРАШ - Головний приз: $250 USD + 550,000 $Winix токенів!</p>
                <p class="raffle-description">10 ПЕРЕМОЖЦІВ - 1-5 місце: Грошові винагороди (частина від $250) - 6-10 місце: $Winix токени</p>
                <p class="raffle-description">БОНУС ДЛЯ ВСІХ УЧАСНИКІВ - Кожен учасник гарантовано отримає 550 $Winix токенів після завершення розіграшу!</p>
                <p class="raffle-description">Вартість участі: 3 жетони. Тривалість: 7 днів</p>
            </div>
        `;

        // Створюємо повний HTML для модального вікна
        const content = `
            <div class="raffle-details-modal">
                ${aboutHtml}
                ${chartHtml}
                ${prizeDistributionHtml}
                ${conditionsHtml}
            </div>
        `;

        // Відображаємо модальне вікно
        window.showModal('Деталі розіграшу', content, {
            width: '90%',
            maxWidth: '500px',
            premium: true
        });
    };

    console.log('Модуль преміальних модальних вікон успішно ініціалізовано');
})();