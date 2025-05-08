/**
 * staking.js - Функціональність стейкінгу WINIX
 */

(function () {
  'use strict';

  console.log('🔄 Staking: Ініціалізація модуля стейкінгу');

  // ======== КОНСТАНТИ ========

  // Конфігурація стейкінгу
  const CONFIG = {
    minAmount: 50, // Мінімальна сума стейкінгу
    maxBalancePercentage: 0.9, // Максимальний відсоток від балансу
    allowedPeriods: [7, 14, 28], // Дозволені періоди стейкінгу
    rewardRates: {
      7: 4, // 4% за 7 днів
      14: 9, // 9% за 14 днів
      28: 15, // 15% за 28 днів
    },
    cancellationFee: 0.2, // Штраф при скасуванні (20%)
    refreshInterval: 300000, // Інтервал оновлення (5 хвилин),
    maxNotificationsAtOnce: 1, // Максимальна кількість одночасних сповіщень
  };

  // ID DOM елементів
  const DOM = {
    amountInput: 'staking-amount',
    periodSelect: 'staking-period',
    expectedReward: 'expected-reward',
    stakingStatus: 'staking-status',
    activeStakingButton: 'active-staking-button',
    cancelStakingButton: 'cancel-staking-button',
    stakeButton: 'stake-button',
    maxButton: 'max-button',

    // Елементи модального вікна
    modal: 'staking-modal',
    modalClose: 'modal-close',
    modalStakingAmount: 'modal-staking-amount',
    modalStakingPeriod: 'modal-staking-period',
    modalRewardPercent: 'modal-staking-reward-percent',
    modalExpectedReward: 'modal-staking-expected-reward',
    modalRemainingDays: 'modal-staking-remaining-days',
    modalAddButton: 'modal-add-to-stake-button',
    modalCancelButton: 'modal-cancel-staking-button',
    modalAddAmount: 'modal-add-amount', // Нове поле для суми додавання
  };

  // ======== ПРИВАТНІ ЗМІННІ ========

  // Прапорці для контролю стану
  let _isProcessingCancelRequest = false;
  let _isProcessingRequest = false;
  let _notificationShowing = false;
  let _notificationsQueue = [];

  // Поточні дані стейкінгу
  let _currentStakingData = null;

  // ======== УТИЛІТИ ========

  /**
   * Отримання елемента DOM
   * @param {string} id - ID елемента
   */
  function getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Отримання поточного балансу
   */
  function getBalance() {
    try {
      if (window.WinixCore && typeof window.WinixCore.getBalance === 'function') {
        return window.WinixCore.getBalance();
      }

      return parseFloat(
        localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0'
      );
    } catch (e) {
      console.error('Помилка отримання балансу:', e);
      return 0;
    }
  }

  /**
   * Розрахунок очікуваної винагороди
   * @param {number} amount - Сума стейкінгу
   * @param {number} period - Період стейкінгу в днях
   */
  function calculateExpectedReward(amount, period) {
    try {
      amount = parseInt(amount) || 0;
      period = parseInt(period) || 14;

      if (amount <= 0) {
        return 0;
      }

      // Використовуємо конфігурацію для розрахунку
      const rewardPercent = CONFIG.rewardRates[period] || 9;
      const reward = (amount * rewardPercent) / 100;

      return parseFloat(reward.toFixed(2));
    } catch (e) {
      console.error('Помилка розрахунку очікуваної винагороди:', e);
      return 0;
    }
  }

  /**
   * Оновлення відображення балансу на всіх можливих елементах UI
   * @param {number} newBalance - Новий баланс
   */
  function updateBalanceUI(newBalance) {
    try {
      // 1. Оновлюємо через WinixCore, якщо він доступний
      if (window.WinixCore && typeof window.WinixCore.updateBalanceDisplay === 'function') {
        window.WinixCore.updateBalanceDisplay();
      }

      // 2. Безпосередньо оновлюємо DOM-елементи
      const balanceElements = [
        document.getElementById('user-tokens'),
        document.getElementById('main-balance'),
        document.querySelector('.balance-amount'),
        document.getElementById('current-balance'),
        ...document.querySelectorAll('[data-balance-display]'),
      ];

      balanceElements.forEach((element) => {
        if (element) {
          // Для основного балансу з іконкою
          if (
            element.id === 'main-balance' &&
            element.innerHTML &&
            element.innerHTML.includes('main-balance-icon')
          ) {
            const iconPart = element.querySelector('.main-balance-icon')?.outerHTML || '';
            element.innerHTML = `${parseFloat(newBalance).toFixed(2)} ${iconPart}`;
          } else {
            element.textContent = parseFloat(newBalance).toFixed(2);
          }

          // Додаємо клас для анімації оновлення
          element.classList.add('balance-updated');
          setTimeout(() => {
            element.classList.remove('balance-updated');
          }, 1000);
        }
      });

      // 3. Оновлюємо змінну стану, якщо вона є
      if (window.WinixCore && window.WinixCore.state) {
        if (window.WinixCore.state.balanceTokens !== undefined) {
          window.WinixCore.state.balanceTokens = parseFloat(newBalance);
        }
      }

      // 4. Зберігаємо в localStorage
      localStorage.setItem('userTokens', newBalance.toString());
      localStorage.setItem('winix_balance', newBalance.toString());

      // 5. Генеруємо подію для інших модулів
      document.dispatchEvent(
        new CustomEvent('balance-updated', {
          detail: { newBalance: parseFloat(newBalance) },
        })
      );

      console.log('Баланс оновлено до:', newBalance);
    } catch (error) {
      console.error('Помилка оновлення відображення балансу:', error);
    }
  }

  /**
   * Універсальна функція показу повідомлень (преміум-стиль)
   * @param {string} message - Текст повідомлення
   * @param {boolean} isError - Чи є це повідомлення про помилку
   * @param {Function} callback - Функція зворотного виклику
   */
  function showNotification(message, isError = false, callback = null) {
    // Запобігаємо показу порожніх повідомлень
    if (!message || message.trim() === '') {
      if (callback) setTimeout(callback, 100);
      return;
    }

    // Якщо уже показується сповіщення, додаємо в чергу
    if (_notificationShowing) {
      if (_notificationsQueue.length < CONFIG.maxNotificationsAtOnce) {
        _notificationsQueue.push({ message, isError, callback });
      } else {
        // Якщо черга переповнена, і це повідомлення про помилку, показуємо його через alert
        if (isError) alert(message);
        if (callback) setTimeout(callback, 100);
      }
      return;
    }

    _notificationShowing = true;

    try {
      // Перевіряємо, чи контейнер для повідомлень вже існує
      let container = document.getElementById('premium-notification-container');

      if (!container) {
        container = document.createElement('div');
        container.id = 'premium-notification-container';
        container.className = 'premium-notification-container';
        document.body.appendChild(container);

        // Додаємо стилі для преміальних сповіщень
        if (!document.getElementById('premium-notification-styles')) {
          const style = document.createElement('style');
          style.id = 'premium-notification-styles';
          style.textContent = `
                        .premium-notification-container {
                            position: fixed;
                            top: 1.25rem;
                            right: 1.25rem;
                            z-index: 9999;
                            width: 90%;
                            max-width: 380px;
                            display: flex;
                            flex-direction: column;
                            gap: 0.625rem;
                            pointer-events: none;
                        }
                        
                        .premium-notification {
                            background: rgba(30, 39, 70, 0.85);
                            backdrop-filter: blur(10px);
                            border-radius: 16px;
                            padding: 16px;
                            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(78, 181, 247, 0.1) inset;
                            display: flex;
                            align-items: center;
                            color: white;
                            transform: translateX(50px) scale(0.95);
                            opacity: 0;
                            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                            margin-bottom: 0.5rem;
                            overflow: hidden;
                            pointer-events: auto;
                            position: relative;
                        }
                        
                        .premium-notification.show {
                            transform: translateX(0) scale(1);
                            opacity: 1;
                        }
                        
                        .premium-notification.hide {
                            transform: translateX(50px) scale(0.95);
                            opacity: 0;
                        }
                        
                        .premium-notification::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 4px;
                            height: 100%;
                            background: linear-gradient(to bottom, #4DB6AC, #00C9A7);
                        }
                        
                        .premium-notification.error::before {
                            background: linear-gradient(to bottom, #FF5252, #B71C1C);
                        }
                        
                        .premium-notification.success::before {
                            background: linear-gradient(to bottom, #4CAF50, #2E7D32);
                        }
                        
                        .premium-notification-icon {
                            width: 32px;
                            height: 32px;
                            min-width: 32px;
                            border-radius: 50%;
                            background: rgba(0, 201, 167, 0.15);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-right: 12px;
                            font-size: 18px;
                        }
                        
                        .premium-notification.error .premium-notification-icon {
                            background: rgba(244, 67, 54, 0.15);
                        }
                        
                        .premium-notification.success .premium-notification-icon {
                            background: rgba(76, 175, 80, 0.15);
                        }
                        
                        .premium-notification-content {
                            flex-grow: 1;
                            padding-right: 8px;
                            font-size: 14px;
                            line-height: 1.5;
                        }
                        
                        .premium-notification-close {
                            width: 24px;
                            height: 24px;
                            background: rgba(255, 255, 255, 0.1);
                            border: none;
                            border-radius: 50%;
                            color: rgba(255, 255, 255, 0.7);
                            font-size: 14px;
                            cursor: pointer;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            transition: all 0.2s ease;
                            padding: 0;
                            margin-left: 8px;
                        }
                        
                        .premium-notification-close:hover {
                            background: rgba(255, 255, 255, 0.2);
                            color: white;
                        }
                        
                        .premium-notification-progress {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            height: 3px;
                            background: linear-gradient(to right, rgba(78, 181, 247, 0.5), rgba(0, 201, 167, 0.8));
                            width: 100%;
                            transform-origin: left;
                            animation: progress-shrink 3s linear forwards;
                        }
                        
                        .premium-notification.error .premium-notification-progress {
                            background: linear-gradient(to right, rgba(244, 67, 54, 0.5), rgba(183, 28, 28, 0.8));
                        }
                        
                        .premium-notification.success .premium-notification-progress {
                            background: linear-gradient(to right, rgba(76, 175, 80, 0.5), rgba(46, 125, 50, 0.8));
                        }
                        
                        @keyframes progress-shrink {
                            from { transform: scaleX(1); }
                            to { transform: scaleX(0); }
                        }
                        
                        .premium-notification-title {
                            font-weight: 600;
                            margin-bottom: 4px;
                            font-size: 15px;
                        }
                        
                        .premium-notification-message {
                            opacity: 0.9;
                        }
                        
                        @keyframes balance-highlight {
                            0% { color: inherit; text-shadow: none; }
                            50% { color: #4eb5f7; text-shadow: 0 0 8px rgba(78, 181, 247, 0.6); }
                            100% { color: inherit; text-shadow: none; }
                        }
                        
                        .balance-updated {
                            animation: balance-highlight 1s ease;
                        }
                    `;
          document.head.appendChild(style);
        }
      }

      // Створюємо повідомлення
      const notification = document.createElement('div');
      notification.className = `premium-notification ${isError ? 'error' : 'success'}`;

      // Додаємо іконку
      const icon = document.createElement('div');
      icon.className = 'premium-notification-icon';
      icon.innerHTML = isError ? '&#10060;' : '&#10004;';

      // Контент повідомлення
      const content = document.createElement('div');
      content.className = 'premium-notification-content';

      // Додаємо заголовок та текст
      const title = document.createElement('div');
      title.className = 'premium-notification-title';
      title.textContent = isError ? 'Помилка' : 'Успішно';

      const messageEl = document.createElement('div');
      messageEl.className = 'premium-notification-message';
      messageEl.textContent = message;

      content.appendChild(title);
      content.appendChild(messageEl);

      // Кнопка закриття
      const closeBtn = document.createElement('button');
      closeBtn.className = 'premium-notification-close';
      closeBtn.innerHTML = '&times;';

      // Індикатор прогресу
      const progress = document.createElement('div');
      progress.className = 'premium-notification-progress';

      // Збираємо елементи
      notification.appendChild(icon);
      notification.appendChild(content);
      notification.appendChild(closeBtn);
      notification.appendChild(progress);

      // Додаємо повідомлення до контейнера
      container.appendChild(notification);

      // Показуємо повідомлення після короткої затримки
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);

      // Закриття при кліку на кнопку
      closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
          notification.remove();
          _notificationShowing = false;

          // Показуємо наступне повідомлення з черги
          if (_notificationsQueue.length > 0) {
            const nextNotification = _notificationsQueue.shift();
            showNotification(
              nextNotification.message,
              nextNotification.isError,
              nextNotification.callback
            );
          } else if (callback) {
            callback();
          }
        }, 300);
      });

      // Автоматичне закриття
      setTimeout(() => {
        if (!notification.classList.contains('hide')) {
          notification.classList.remove('show');
          notification.classList.add('hide');
          setTimeout(() => {
            notification.remove();
            _notificationShowing = false;

            // Показуємо наступне повідомлення з черги
            if (_notificationsQueue.length > 0) {
              const nextNotification = _notificationsQueue.shift();
              showNotification(
                nextNotification.message,
                nextNotification.isError,
                nextNotification.callback
              );
            } else if (callback) {
              callback();
            }
          }, 300);
        }
      }, 5000);
    } catch (e) {
      console.error('Помилка показу повідомлення:', e);
      // Якщо не вдалося створити повідомлення, використовуємо alert
      alert(message);
      _notificationShowing = false;
      if (callback) callback();
    }
  }

  // Перевизначення глобальної функції показу тостів, щоб використовувати преміум-стиль
  window.showToast = function (message, isError) {
    showNotification(message, isError);
  };

  // Перевизначення глобальної функції повідомлень
  window.showNotification = showNotification;

  /**
   * Показ діалогового вікна з підтвердженням
   * @param {string} message - Текст повідомлення
   * @param {Function} confirmCallback - Функція при підтвердженні
   * @param {Function} cancelCallback - Функція при скасуванні
   */
  function showConfirmDialog(message, confirmCallback, cancelCallback) {
    try {
      // Спочатку перевіряємо, чи існує діалог
      let confirmOverlay = document.getElementById('staking-confirm-dialog');

      if (!confirmOverlay) {
        // Додаємо стилі, якщо їх немає
        if (!document.getElementById('staking-confirm-styles')) {
          const style = document.createElement('style');
          style.id = 'staking-confirm-styles';
          style.textContent = `
                        .premium-confirm-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: rgba(0, 0, 0, 0.7);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            z-index: 10000;
                            opacity: 0;
                            visibility: hidden;
                            transition: opacity 0.3s, visibility 0.3s;
                            backdrop-filter: blur(8px);
                        }
                        
                        .premium-confirm-overlay.show {
                            opacity: 1;
                            visibility: visible;
                        }
                        
                        .premium-confirm-dialog {
                            background: rgba(30, 39, 70, 0.90);
                            border-radius: 20px;
                            padding: 24px;
                            width: 90%;
                            max-width: 380px;
                            transform: scale(0.95);
                            opacity: 0;
                            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(78, 181, 247, 0.15) inset, 0 6px 12px rgba(0, 0, 0, 0.25);
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            overflow: hidden;
                            position: relative;
                        }
                        
                        .premium-confirm-overlay.show .premium-confirm-dialog {
                            transform: scale(1);
                            opacity: 1;
                        }
                        
                        .premium-confirm-icon {
                            width: 70px;
                            height: 70px;
                            background: rgba(244, 67, 54, 0.15);
                            border-radius: 50%;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            font-size: 36px;
                            color: #FF5252;
                            margin-bottom: 16px;
                        }
                        
                        .premium-confirm-title {
                            font-size: 20px;
                            font-weight: 600;
                            margin-bottom: 12px;
                            color: white;
                        }
                        
                        .premium-confirm-message {
                            font-size: 16px;
                            line-height: 1.5;
                            margin-bottom: 24px;
                            color: rgba(255, 255, 255, 0.9);
                        }
                        
                        .premium-confirm-buttons {
                            display: flex;
                            justify-content: center;
                            gap: 12px;
                            width: 100%;
                        }
                        
                        .premium-confirm-button {
                            flex-basis: 45%;
                            padding: 12px;
                            border-radius: 12px;
                            border: none;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        }
                        
                        .premium-confirm-button:active {
                            transform: scale(0.97);
                        }
                        
                        .premium-confirm-button-cancel {
                            background: rgba(255, 255, 255, 0.1);
                            color: white;
                        }
                        
                        .premium-confirm-button-confirm {
                            background: linear-gradient(90deg, #8B0000, #A52A2A, #B22222);
                            color: white;
                        }
                    `;
          document.head.appendChild(style);
        }

        // Створюємо діалог
        confirmOverlay = document.createElement('div');
        confirmOverlay.id = 'staking-confirm-dialog';
        confirmOverlay.className = 'premium-confirm-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'premium-confirm-dialog';
        dialog.innerHTML = `
                    <div class="premium-confirm-icon">⚠️</div>
                    <div class="premium-confirm-title">Скасування стейкінгу</div>
                    <div class="premium-confirm-message">${message}</div>
                    <div class="premium-confirm-buttons">
                        <button class="premium-confirm-button premium-confirm-button-cancel" id="staking-cancel-no">Скасувати</button>
                        <button class="premium-confirm-button premium-confirm-button-confirm" id="staking-cancel-yes">Підтвердити</button>
                    </div>
                `;

        confirmOverlay.appendChild(dialog);
        document.body.appendChild(confirmOverlay);
      } else {
        // Оновлюємо текст повідомлення
        const messageEl = confirmOverlay.querySelector('.premium-confirm-message');
        if (messageEl) messageEl.textContent = message;
      }

      // Отримуємо кнопки
      const cancelBtn = document.getElementById('staking-cancel-no');
      const confirmBtn = document.getElementById('staking-cancel-yes');

      // Замінюємо кнопки, щоб уникнути накопичення обробників подій
      if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Додаємо новий обробник
        newCancelBtn.addEventListener('click', function () {
          confirmOverlay.classList.remove('show');
          if (cancelCallback) cancelCallback();
        });
      }

      if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        // Додаємо новий обробник
        newConfirmBtn.addEventListener('click', function () {
          confirmOverlay.classList.remove('show');
          if (confirmCallback) confirmCallback();
        });
      }

      // Показуємо діалог
      confirmOverlay.classList.add('show');
    } catch (e) {
      console.error('Помилка показу діалогу підтвердження:', e);
      // Використовуємо стандартний confirm
      if (confirm(message)) {
        if (confirmCallback) confirmCallback();
      } else {
        if (cancelCallback) cancelCallback();
      }
    }
  }

  // Перевизначаємо глобальну функцію показу діалогу підтвердження
  window.showModernConfirm = showConfirmDialog;

  /**
   * Показ індикатора завантаження
   * @param {string} message - Повідомлення (опціонально)
   */
  function showLoading(message) {
    try {
      let spinner = document.getElementById('loading-spinner');

      if (!spinner) {
        // Створюємо індикатор завантаження
        const spinnerContainer = document.createElement('div');
        spinnerContainer.id = 'loading-spinner';
        spinnerContainer.className = 'spinner-overlay';

        spinnerContainer.innerHTML = `
                    <div class="spinner-content">
                        <div class="spinner"></div>
                        ${message ? `<div class="spinner-message">${message}</div>` : ''}
                    </div>
                `;

        // Додаємо стилі, якщо їх немає
        if (!document.getElementById('spinner-styles')) {
          const style = document.createElement('style');
          style.id = 'spinner-styles';
          style.textContent = `
                        .spinner-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.7);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            z-index: 9999;
                            opacity: 0;
                            visibility: hidden;
                            transition: opacity 0.3s ease, visibility 0.3s ease;
                            backdrop-filter: blur(3px);
                        }
                        
                        .spinner-overlay.show {
                            opacity: 1;
                            visibility: visible;
                        }
                        
                        .spinner-content {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 16px;
                        }
                        
                        .spinner {
                            width: 50px;
                            height: 50px;
                            border: 5px solid rgba(0, 201, 167, 0.3);
                            border-radius: 50%;
                            border-top-color: rgb(0, 201, 167);
                            animation: spin 1s linear infinite;
                        }
                        
                        .spinner-message {
                            color: white;
                            font-size: 16px;
                            text-align: center;
                            max-width: 300px;
                        }
                        
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `;
          document.head.appendChild(style);
        }

        document.body.appendChild(spinnerContainer);
        spinner = spinnerContainer;
      } else {
        // Оновлюємо повідомлення, якщо воно передане
        if (message) {
          const messageEl = spinner.querySelector('.spinner-message');
          if (messageEl) {
            messageEl.textContent = message;
          } else {
            const newMessageEl = document.createElement('div');
            newMessageEl.className = 'spinner-message';
            newMessageEl.textContent = message;

            const content = spinner.querySelector('.spinner-content');
            if (content) {
              content.appendChild(newMessageEl);
            }
          }
        }
      }

      // Показуємо індикатор
      spinner.classList.add('show');
    } catch (e) {
      console.error('Помилка показу індикатора завантаження:', e);
    }
  }

  /**
   * Приховування індикатора завантаження
   */
  function hideLoading() {
    try {
      const spinner = document.getElementById('loading-spinner');
      if (spinner) {
        spinner.classList.remove('show');
      }
    } catch (e) {
      console.error('Помилка приховування індикатора завантаження:', e);
    }
  }

  // Перевизначаємо глобальні функції для індикатора завантаження
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;

  // ======== ОСНОВНІ ФУНКЦІЇ СТЕЙКІНГУ ========

  /**
   * Отримання даних стейкінгу з сервера
   * @param {boolean} forceRefresh - Примусово оновити дані
   */
  async function fetchStakingData(forceRefresh = false, silent = false) {
    try {
      if (window.WinixAPI && typeof window.WinixAPI.getStakingData === 'function') {
        // Показуємо індикатор завантаження, якщо потрібно
        const showingLoader = !silent && typeof window.showLoading === 'function';
        if (showingLoader) {
          window.showLoading('Отримання даних стейкінгу...');
        }

        // Виконуємо запит
        const response = await window.WinixAPI.getStakingData();

        // Приховуємо індикатор
        if (showingLoader && typeof window.hideLoading === 'function') {
          window.hideLoading();
        }

        // Обробляємо результат
        if (response.status === 'success' && response.data) {
          _currentStakingData = response.data;

          // Зберігаємо в localStorage
          localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
          localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));
          localStorage.setItem('stakingDataCacheTime', Date.now().toString());

          // Оновлюємо інтерфейс
          updateUI();

          return _currentStakingData;
        } else {
          throw new Error(response.message || 'Не вдалося отримати дані стейкінгу');
        }
      } else {
        // Зчитуємо дані з localStorage, якщо API недоступне
        const stakingDataStr =
          localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');

        if (stakingDataStr) {
          _currentStakingData = JSON.parse(stakingDataStr);
          updateUI();
          return _currentStakingData;
        } else {
          // Встановлюємо пусті дані
          _currentStakingData = {
            hasActiveStaking: false,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0,
          };
          updateUI();
          return _currentStakingData;
        }
      }
    } catch (error) {
      console.error('Помилка отримання даних стейкінгу:', error);

      // Використовуємо кешовані дані
      try {
        const stakingDataStr =
          localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');

        if (stakingDataStr) {
          _currentStakingData = JSON.parse(stakingDataStr);
        } else {
          _currentStakingData = {
            hasActiveStaking: false,
            stakingAmount: 0,
            period: 0,
            rewardPercent: 0,
            expectedReward: 0,
            remainingDays: 0,
          };
        }
      } catch (e) {
        _currentStakingData = {
          hasActiveStaking: false,
          stakingAmount: 0,
          period: 0,
          rewardPercent: 0,
          expectedReward: 0,
          remainingDays: 0,
        };
      }

      updateUI();
      return _currentStakingData;
    }
  }

  /**
   * Створення нового стейкінгу
   * @param {number} amount - Сума стейкінгу
   * @param {number} period - Період стейкінгу в днях
   */
  async function createStaking(amount, period) {
    // Якщо запит вже виконується, просто ігноруємо нові натискання
    if (_isProcessingRequest) {
      return { success: false, message: 'in_progress' };
    }

    _isProcessingRequest = true;

    // Блокуємо кнопку (запобігання подвійним натисканням)
    const stakeButton = getElement(DOM.stakeButton);
    if (stakeButton) stakeButton.disabled = true;

    try {
      // Валідація параметрів
      amount = parseInt(amount);
      period = parseInt(period);

      if (isNaN(amount) || amount < CONFIG.minAmount) {
        throw new Error(`Мінімальна сума стейкінгу: ${CONFIG.minAmount} WINIX`);
      }

      if (!CONFIG.allowedPeriods.includes(period)) {
        throw new Error(`Дозволені періоди стейкінгу: ${CONFIG.allowedPeriods.join(', ')} днів`);
      }

      const balance = getBalance();
      if (amount > balance) {
        throw new Error(`Недостатньо коштів. Ваш баланс: ${balance} WINIX`);
      }

      const maxAllowedAmount = Math.floor(balance * CONFIG.maxBalancePercentage);
      if (amount > maxAllowedAmount) {
        throw new Error(
          `Максимальна сума: ${maxAllowedAmount} WINIX (${Math.round(CONFIG.maxBalancePercentage * 100)}% від балансу)`
        );
      }

      // Показуємо індикатор завантаження (одразу, без повідомлення про очікування)
      if (typeof window.showLoading === 'function') {
        window.showLoading('Створення стейкінгу...');
      }

      // Створюємо стейкінг через API
      const response = await window.WinixAPI.createStaking(amount, period);

      // Приховуємо індикатор завантаження
      if (typeof window.hideLoading === 'function') {
        window.hideLoading();
      }

      if (response.status !== 'success') {
        throw new Error(response.message || 'Помилка створення стейкінгу');
      }

      // Оновлюємо дані стейкінгу
      if (response.data && response.data.staking) {
        _currentStakingData = response.data.staking;

        // Оновлюємо localStorage
        localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
        localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));

        // Оновлюємо баланс негайно
        if (response.data.balance !== undefined) {
          updateBalanceUI(response.data.balance);
        }

        // Оновлюємо інтерфейс
        updateUI();

        // Показуємо повідомлення про успіх
        if (typeof window.showNotification === 'function') {
          window.showNotification('Стейкінг успішно створено');
        }

        return {
          success: true,
          data: response.data,
          message: 'Стейкінг успішно створено',
        };
      } else {
        throw new Error('Відповідь сервера не містить даних стейкінгу');
      }
    } catch (error) {
      console.error('Помилка створення стейкінгу:', error);

      if (typeof window.showNotification === 'function') {
        window.showNotification(error.message || 'Помилка створення стейкінгу', true);
      }

      return {
        success: false,
        message: error.message || 'Помилка створення стейкінгу',
      };
    } finally {
      _isProcessingRequest = false;

      // Розблоковуємо кнопку
      if (stakeButton) stakeButton.disabled = false;
    }
  }

  /**
   * Додавання коштів до стейкінгу
   * @param {number} amount - Сума для додавання
   */
  async function addToStaking(amount) {
    if (_isProcessingRequest) {
      return { success: false, message: 'in_progress' };
    }

    _isProcessingRequest = true;

    try {
      // Перевіряємо наявність активного стейкінгу
      if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
        // Оновлюємо дані стейкінгу
        await fetchStakingData(true);

        if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
          throw new Error('У вас немає активного стейкінгу');
        }
      }

      // Валідація суми
      amount = parseInt(amount);

      if (isNaN(amount) || amount <= 0) {
        throw new Error('Сума має бути додатним цілим числом');
      }

      const balance = getBalance();
      if (amount > balance) {
        throw new Error(`Недостатньо коштів. Ваш баланс: ${balance} WINIX`);
      }

      // Показуємо індикатор завантаження
      if (typeof window.showLoading === 'function') {
        window.showLoading('Додавання до стейкінгу...');
      }

      // Додаємо кошти до стейкінгу через API
      const response = await window.WinixAPI.addToStaking(amount, _currentStakingData.stakingId);

      // Приховуємо індикатор завантаження
      if (typeof window.hideLoading === 'function') {
        window.hideLoading();
      }

      if (response.status !== 'success') {
        throw new Error(response.message || 'Помилка додавання коштів до стейкінгу');
      }

      // Оновлюємо дані стейкінгу
      if (response.data && response.data.staking) {
        _currentStakingData = response.data.staking;

        // Оновлюємо localStorage
        localStorage.setItem('stakingData', JSON.stringify(_currentStakingData));
        localStorage.setItem('winix_staking', JSON.stringify(_currentStakingData));

        // Оновлюємо баланс негайно
        if (response.data.balance !== undefined) {
          updateBalanceUI(response.data.balance);
        }

        // Оновлюємо інтерфейс
        updateUI();

        // Показуємо повідомлення про успіх
        if (typeof window.showNotification === 'function') {
          window.showNotification(`До активного стейкінгу додано +${amount} WINIX`);
        }

        return {
          success: true,
          data: response.data,
          message: `Додано ${amount} WINIX до стейкінгу`,
        };
      } else {
        throw new Error('Відповідь сервера не містить даних стейкінгу');
      }
    } catch (error) {
      console.error('Помилка додавання коштів до стейкінгу:', error);

      if (typeof window.showNotification === 'function') {
        window.showNotification(error.message || 'Помилка додавання коштів до стейкінгу', true);
      }

      return {
        success: false,
        message: error.message || 'Помилка додавання коштів до стейкінгу',
      };
    } finally {
      _isProcessingRequest = false;
    }
  }

  /**
   * Скасування стейкінгу
   */
  async function cancelStaking() {
    // Запобігаємо повторним запитам
    if (_isProcessingCancelRequest) {
      return { success: false, message: 'in_progress' };
    }

    _isProcessingCancelRequest = true;

    try {
      // Приховуємо модальне вікно, якщо воно відкрите
      const modal = document.getElementById('staking-modal');
      if (modal) modal.classList.remove('active');

      // Показуємо діалог підтвердження
      return new Promise((resolve) => {
        showConfirmDialog(
          'Ви впевнені, що хочете скасувати стейкінг? Буде утримано комісію за дострокове скасування.',
          // Функція підтвердження
          async () => {
            try {
              // Показуємо індикатор завантаження
              if (typeof window.showLoading === 'function') {
                window.showLoading('Скасування стейкінгу...');
              }

              // Перевіряємо наявність активного стейкінгу
              if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                await fetchStakingData(true, true);

                if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
                  throw new Error('У вас немає активного стейкінгу');
                }
              }

              // Виконуємо запит скасування
              let result = null;

              if (window.WinixAPI && typeof window.WinixAPI.cancelStaking === 'function') {
                // Використовуємо функцію з API
                result = await window.WinixAPI.cancelStaking(_currentStakingData.stakingId);
              } else {
                // Виконуємо запит безпосередньо до сервера
                const userId = localStorage.getItem('telegram_user_id');
                if (!userId) {
                  throw new Error('Не вдалося отримати ID користувача');
                }

                const response = await fetch(
                  `/api/user/${userId}/staking/${_currentStakingData.stakingId}/cancel`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      confirm: true,
                      timestamp: Date.now(),
                    }),
                  }
                );

                if (!response.ok) {
                  throw new Error(`Помилка сервера: ${response.status}`);
                }

                result = await response.json();
              }

              // Приховуємо індикатор завантаження
              if (typeof window.hideLoading === 'function') {
                window.hideLoading();
              }

              // Очищаємо дані стейкінгу
              _currentStakingData = {
                hasActiveStaking: false,
                stakingAmount: 0,
                period: 0,
                rewardPercent: 0,
                expectedReward: 0,
                remainingDays: 0,
              };

              // Оновлюємо дані в localStorage
              localStorage.removeItem('stakingData');
              localStorage.removeItem('winix_staking');

              // Оновлюємо баланс негайно
              if (result && result.data && result.data.newBalance !== undefined) {
                // Оновлюємо відображення балансу
                updateBalanceUI(result.data.newBalance);
              }

              // Оновлюємо інтерфейс стейкінгу
              updateUI();

              // Формуємо повідомлення про успіх
              let message = 'Стейкінг успішно скасовано';

              if (result && result.data) {
                if (result.data.returnedAmount && result.data.feeAmount) {
                  message = `Стейкінг скасовано. Повернено: ${result.data.returnedAmount} WINIX. Комісія: ${result.data.feeAmount} WINIX.`;
                }
              }

              // Показуємо повідомлення
              showNotification(message, false, () => {
                setTimeout(() => {
                  resolve({
                    success: true,
                    data: result ? result.data : null,
                    message: message,
                  });
                }, 1000);
              });
            } catch (error) {
              console.error('Помилка скасування стейкінгу:', error);

              // Приховуємо індикатор завантаження
              if (typeof window.hideLoading === 'function') {
                window.hideLoading();
              }

              // Показуємо повідомлення про помилку
              showNotification(error.message || 'Помилка скасування стейкінгу', true);

              resolve({
                success: false,
                message: error.message || 'Помилка скасування стейкінгу',
              });
            } finally {
              _isProcessingCancelRequest = false;
            }
          },
          // Функція скасування
          () => {
            _isProcessingCancelRequest = false;
            resolve({
              success: false,
              message: 'Скасовано користувачем',
            });
          }
        );
      });
    } catch (error) {
      console.error('Помилка показу діалогу скасування стейкінгу:', error);
      _isProcessingCancelRequest = false;
      return {
        success: false,
        message: 'Не вдалося показати діалог скасування стейкінгу',
      };
    }
  }

  // ======== ФУНКЦІЇ ІНТЕРФЕЙСУ ========

  /**
   * Оновлення інтерфейсу
   */
  function updateUI() {
    try {
      const hasActiveStaking = _currentStakingData && _currentStakingData.hasActiveStaking;

      // Оновлення статусу стейкінгу
      const statusElement = getElement(DOM.stakingStatus);
      if (statusElement) {
        if (hasActiveStaking) {
          statusElement.style.color = '#4DB6AC';
          statusElement.style.fontWeight = 'bold';
          statusElement.textContent = `У стейкінгу: ${_currentStakingData.stakingAmount || 0} $WINIX`;

          // Додаємо інформацію про очікувану винагороду
          if (_currentStakingData.expectedReward) {
            statusElement.textContent += ` | Винагорода: ${_currentStakingData.expectedReward} $WINIX`;
          }

          // Додаємо інформацію про залишок днів
          if (_currentStakingData.remainingDays !== undefined) {
            statusElement.textContent += ` | Залишилось: ${_currentStakingData.remainingDays} дн.`;
          }
        } else {
          statusElement.style.color = '';
          statusElement.style.fontWeight = '';
          statusElement.textContent = 'Наразі немає активних стейкінгів';
        }
      }

      // Оновлюємо активність кнопок
      updateButtonsState(hasActiveStaking);
    } catch (e) {
      console.error('Помилка оновлення інтерфейсу стейкінгу:', e);
    }
  }

  /**
   * Оновлення стану кнопок
   * @param {boolean} hasActiveStaking - Чи є активний стейкінг
   */
  function updateButtonsState(hasActiveStaking) {
    try {
      // Кнопка "Активний стейкінг"
      const activeStakingButton = getElement(DOM.activeStakingButton);
      if (activeStakingButton) {
        if (hasActiveStaking) {
          activeStakingButton.classList.remove('disabled');
          activeStakingButton.disabled = false;
        } else {
          activeStakingButton.classList.add('disabled');
          activeStakingButton.disabled = true;
        }
      }

      // Кнопка "Скасувати стейкінг"
      const cancelStakingButton = getElement(DOM.cancelStakingButton);
      if (cancelStakingButton) {
        if (hasActiveStaking) {
          cancelStakingButton.style.opacity = '1';
          cancelStakingButton.style.pointerEvents = 'auto';
          cancelStakingButton.disabled = false;
        } else {
          cancelStakingButton.style.opacity = '0.5';
          cancelStakingButton.style.pointerEvents = 'none';
          cancelStakingButton.disabled = true;
        }
      }
    } catch (e) {
      console.error('Помилка оновлення стану кнопок:', e);
    }
  }

  /**
   * Показати модальне вікно стейкінгу
   */
  function showStakingModal() {
    try {
      // Перевіряємо наявність активного стейкінгу
      if (!_currentStakingData || !_currentStakingData.hasActiveStaking) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('У вас немає активного стейкінгу', true);
        }
        return;
      }

      // Оновлюємо дані в модальному вікні
      const modalStakingAmount = getElement(DOM.modalStakingAmount);
      const modalStakingPeriod = getElement(DOM.modalStakingPeriod);
      const modalRewardPercent = getElement(DOM.modalRewardPercent);
      const modalExpectedReward = getElement(DOM.modalExpectedReward);
      const modalRemainingDays = getElement(DOM.modalRemainingDays);
      const modalAddAmount = getElement(DOM.modalAddAmount);

      if (modalStakingAmount)
        modalStakingAmount.textContent = `${_currentStakingData.stakingAmount || 0} $WINIX`;
      if (modalStakingPeriod)
        modalStakingPeriod.textContent = `${_currentStakingData.period || 0} днів`;
      if (modalRewardPercent)
        modalRewardPercent.textContent = `${_currentStakingData.rewardPercent || 0}%`;
      if (modalExpectedReward)
        modalExpectedReward.textContent = `${_currentStakingData.expectedReward || 0} $WINIX`;
      if (modalRemainingDays)
        modalRemainingDays.textContent = _currentStakingData.remainingDays || 0;

      // Встановлюємо значення за замовчуванням для поля додавання
      if (modalAddAmount) modalAddAmount.value = '100';

      // Показуємо модальне вікно
      const modal = getElement(DOM.modal);
      if (modal) modal.classList.add('active');
    } catch (error) {
      console.error('Помилка показу модального вікна:', error);

      if (typeof window.showNotification === 'function') {
        window.showNotification('Помилка показу деталей стейкінгу', true);
      }
    }
  }

  /**
   * Приховати модальне вікно стейкінгу
   */
  function hideStakingModal() {
    try {
      const modal = getElement(DOM.modal);
      if (modal) modal.classList.remove('active');
    } catch (error) {
      console.error('Помилка приховування модального вікна:', error);
    }
  }

  /**
   * Обробник додавання коштів до стейкінгу з модального вікна
   */
  function handleAddToStakeFromModal() {
    try {
      // Отримуємо суму безпосередньо з поля у модальному вікні
      const amountInput = getElement(DOM.modalAddAmount);
      if (!amountInput) {
        showNotification('Помилка при додаванні коштів. Поле суми не знайдено', true);
        return;
      }

      const amount = parseInt(amountInput.value);
      if (isNaN(amount) || amount <= 0) {
        showNotification('Введіть коректну суму (ціле додатне число)', true);
        return;
      }

      // Закриваємо модальне вікно перед початком операції
      hideStakingModal();

      // Викликаємо функцію додавання коштів
      addToStaking(amount);
    } catch (error) {
      console.error('Помилка при додаванні до стейкінгу з модального вікна:', error);
      showNotification('Помилка додавання коштів до стейкінгу', true);
    }
  }

  /**
   * Оновлення очікуваної винагороди при зміні введених даних
   */
  function updateReward() {
    try {
      // Отримуємо елементи
      const amountInput = getElement(DOM.amountInput);
      const periodSelect = getElement(DOM.periodSelect);
      const expectedReward = getElement(DOM.expectedReward);

      if (!amountInput || !periodSelect || !expectedReward) {
        return;
      }

      // Отримуємо поточні значення
      const amount = parseInt(amountInput.value) || 0;
      const period = parseInt(periodSelect.value) || 14;

      // Показуємо стан завантаження
      expectedReward.classList.add('calculating');

      // Розраховуємо винагороду
      const reward = calculateExpectedReward(amount, period);

      // Оновлюємо відображення
      expectedReward.textContent = reward.toFixed(2);
      expectedReward.classList.remove('calculating');
      expectedReward.classList.add('value-updated');

      // Прибираємо клас анімації через деякий час
      setTimeout(() => {
        expectedReward.classList.remove('value-updated');
      }, 500);
    } catch (error) {
      console.error('Помилка при оновленні очікуваної винагороди:', error);
    }
  }

  /**
   * Ініціалізація обробників подій
   */
  function initEventListeners() {
    try {
      // Оновлення очікуваної винагороди при зміні суми або періоду
      const amountInput = getElement(DOM.amountInput);
      const periodSelect = getElement(DOM.periodSelect);

      if (amountInput) {
        amountInput.addEventListener('input', updateReward);
      }

      if (periodSelect) {
        periodSelect.addEventListener('change', updateReward);
      }

      // Кнопка Max
      const maxButton = getElement(DOM.maxButton);
      if (maxButton && amountInput) {
        maxButton.addEventListener('click', function () {
          const balance = getBalance();
          const maxAllowed = Math.floor(balance * CONFIG.maxBalancePercentage);

          amountInput.value = maxAllowed;

          // Викликаємо подію input для оновлення очікуваної винагороди
          amountInput.dispatchEvent(new Event('input'));

          // Додаємо анімацію натискання
          maxButton.classList.add('active');
          setTimeout(() => {
            maxButton.classList.remove('active');
          }, 300);
        });
      }

      // Кнопка "Створення стейкінгу"
      const stakeButton = getElement(DOM.stakeButton);
      if (stakeButton && amountInput && periodSelect) {
        stakeButton.addEventListener('click', async () => {
          const amount = parseInt(amountInput.value) || 0;
          const period = parseInt(periodSelect.value) || 14;

          // Створюємо стейкінг
          await createStaking(amount, period);
        });
      }

      // Кнопка "Активний стейкінг"
      const activeStakingButton = getElement(DOM.activeStakingButton);
      if (activeStakingButton) {
        activeStakingButton.addEventListener('click', showStakingModal);
      }

      // Кнопка "Скасувати стейкінг"
      const cancelStakingButton = getElement(DOM.cancelStakingButton);
      if (cancelStakingButton) {
        cancelStakingButton.addEventListener('click', cancelStaking);
      }

      // Кнопка закриття модального вікна
      const modalCloseButton = getElement(DOM.modalClose);
      if (modalCloseButton) {
        modalCloseButton.addEventListener('click', hideStakingModal);
      }

      // Кнопка "Додати до стейкінгу" в модальному вікні
      const modalAddButton = getElement(DOM.modalAddButton);
      if (modalAddButton) {
        modalAddButton.addEventListener('click', handleAddToStakeFromModal);
      }

      // Кнопка "Скасувати стейкінг" в модальному вікні
      const modalCancelButton = getElement(DOM.modalCancelButton);
      if (modalCancelButton) {
        modalCancelButton.addEventListener('click', () => {
          hideStakingModal();
          cancelStaking();
        });
      }

      // Закриття модального вікна при кліку поза ним
      const modal = getElement(DOM.modal);
      if (modal) {
        modal.addEventListener('click', function (e) {
          if (e.target === modal) {
            hideStakingModal();
          }
        });
      }

      // Кнопка "Назад"
      const backButton = document.getElementById('back-button');
      if (backButton) {
        backButton.addEventListener('click', function () {
          window.location.href = 'wallet.html';
        });
      }

      // Початкове оновлення очікуваної винагороди
      setTimeout(updateReward, 100);
    } catch (error) {
      console.error('Помилка ініціалізації обробників подій:', error);
    }
  }

  /**
   * Ініціалізація модуля стейкінгу
   */
  async function init() {
    try {
      // Отримуємо початкові дані стейкінгу
      await fetchStakingData();

      // Ініціалізуємо обробники подій
      initEventListeners();

      console.log('✅ Staking: Модуль стейкінгу успішно ініціалізовано');

      // Викликаємо подію ініціалізації стейкінгу
      document.dispatchEvent(new CustomEvent('staking-initialized'));
    } catch (error) {
      console.error('Помилка ініціалізації модуля стейкінгу:', error);
    }
  }

  // ======== ПУБЛІЧНИЙ API ========

  // Експортуємо публічні функції
  window.WinixStakingSystem = {
    // Основні функції стейкінгу
    getStakingData: () => _currentStakingData,
    hasActiveStaking: () => _currentStakingData && _currentStakingData.hasActiveStaking,
    createStaking,
    addToStaking,
    cancelStaking,
    calculateExpectedReward,
    updateBalanceUI,

    // Функції для UI
    updateUI,
    updateButtonsState,
    showStakingModal,
    hideStakingModal,

    // Обробники подій
    handleDetailsButton: showStakingModal,
    handleCancelStakingButton: cancelStaking,
    handleAddToStakeButton: handleAddToStakeFromModal,

    // Метод для оновлення
    refresh: () => fetchStakingData(true),

    // Сповіщення та індикатори
    showNotification,
    showConfirmDialog,
    showLoading,
    hideLoading,
  };

  // Ініціалізуємо модуль при завантаженні
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
