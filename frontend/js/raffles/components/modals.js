/**
 * modals.js - Модуль для роботи з модальними вікнами розіграшів
 * Реалізує патерн фабрики та реєстр для управління різними типами модальних вікон
 */

import { showToast } from '../utils/ui-helpers.js';
import WinixRaffles from '../globals.js';

/**
 * Базовий клас для всіх модальних вікон
 */
class BaseModal {
  /**
   * Конструктор базового класу модальних вікон
   * @param {Object} options - Параметри модального вікна
   */
  constructor(options = {}) {
    this.id = options.id || `modal-${Date.now()}`;
    this.title = options.title || 'Модальне вікно';
    this.content = options.content || '';
    this.closeOnBackdrop = options.closeOnBackdrop !== false;
    this.cssClass = options.cssClass || '';
    this.element = null;
    this.onClose = options.onClose || null;
    this.onOpen = options.onOpen || null;
    this.eventListeners = [];
  }

  /**
   * Створення DOM-елементу модального вікна
   * @returns {HTMLElement} - DOM-елемент модального вікна
   */
  createElement() {
    // Видаляємо існуючий елемент, якщо він є
    this.removeElement();

    // Створюємо елемент модального вікна
    const modal = document.createElement('div');
    modal.id = this.id;
    modal.className = `raffle-modal ${this.cssClass}`;
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('tabindex', '-1');

    // Встановлюємо HTML-вміст модального вікна
    modal.innerHTML = this.generateHTML();

    this.element = modal;
    this.setupEventListeners();

    return modal;
  }

  /**
   * Генерація HTML-вмісту модального вікна
   * @returns {string} - HTML-вміст
   */
  generateHTML() {
    return `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${this.title}</h2>
          <span class="modal-close" data-action="close">×</span>
        </div>
        <div class="modal-body">
          ${this.content}
        </div>
      </div>
    `;
  }

  /**
   * Встановлення обробників подій
   */
  setupEventListeners() {
    if (!this.element) return;

    // Обробник закриття по кліку на хрестик
    const closeButtons = this.element.querySelectorAll('[data-action="close"]');
    closeButtons.forEach(button => {
      const closeHandler = (e) => {
        e.preventDefault();
        this.close();
      };

      button.addEventListener('click', closeHandler);
      this.eventListeners.push({ element: button, event: 'click', handler: closeHandler });
    });

    // Обробник закриття по кліку на фон
    if (this.closeOnBackdrop) {
      const backdropHandler = (e) => {
        if (e.target === this.element) {
          this.close();
        }
      };

      this.element.addEventListener('click', backdropHandler);
      this.eventListeners.push({ element: this.element, event: 'click', handler: backdropHandler });
    }

    // Обробник клавіші Escape для закриття
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };

    document.addEventListener('keydown', keyHandler);
    this.eventListeners.push({ element: document, event: 'keydown', handler: keyHandler });
  }

  /**
   * Видалення обробників подій
   */
  removeEventListeners() {
    this.eventListeners.forEach(listener => {
      listener.element.removeEventListener(listener.event, listener.handler);
    });
    this.eventListeners = [];
  }

  /**
   * Видалення DOM-елемента модального вікна
   */
  removeElement() {
    if (this.element && this.element.parentNode) {
      this.removeEventListeners();
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Відкриття модального вікна
   */
  open() {
    if (!this.element) {
      this.createElement();
    }

    // Додаємо модальне вікно до DOM, якщо його там немає
    if (!this.element.parentNode) {
      document.body.appendChild(this.element);
    }

    // Блокуємо прокрутку сторінки
    document.body.style.overflow = 'hidden';

    // Відкладаємо додавання класу для анімації
    requestAnimationFrame(() => {
      this.element.classList.add('open');

      // Викликаємо обробник відкриття, якщо він є
      if (typeof this.onOpen === 'function') {
        this.onOpen(this);
      }

      // Емітуємо подію відкриття
      WinixRaffles.events.emit('modal-opened', { id: this.id, type: this.constructor.name });
    });
  }

  /**
   * Закриття модального вікна
   */
  close() {
    if (!this.element) return;

    // Видаляємо клас для анімації закриття
    this.element.classList.remove('open');

    // Чекаємо завершення анімації перед видаленням
    setTimeout(() => {
      // Розблокуємо прокрутку сторінки
      document.body.style.overflow = '';

      // Викликаємо обробник закриття, якщо він є
      if (typeof this.onClose === 'function') {
        this.onClose(this);
      }

      // Емітуємо подію закриття
      WinixRaffles.events.emit('modal-closed', { id: this.id, type: this.constructor.name });
    }, 300);
  }

  /**
   * Оновлення вмісту модального вікна
   * @param {Object} options - Параметри для оновлення
   */
  update(options = {}) {
    // Оновлюємо властивості
    if (options.title !== undefined) this.title = options.title;
    if (options.content !== undefined) this.content = options.content;
    if (options.closeOnBackdrop !== undefined) this.closeOnBackdrop = options.closeOnBackdrop;
    if (options.cssClass !== undefined) this.cssClass = options.cssClass;
    if (options.onClose !== undefined) this.onClose = options.onClose;
    if (options.onOpen !== undefined) this.onOpen = options.onOpen;

    // Якщо елемент існує, оновлюємо його вміст
    if (this.element) {
      this.element.className = `raffle-modal ${this.cssClass}`;
      this.element.innerHTML = this.generateHTML();
      this.setupEventListeners();
    }
  }
}

/**
 * Модальне вікно підтвердження
 */
class ConfirmModal extends BaseModal {
  /**
   * Конструктор модального вікна підтвердження
   * @param {Object} options - Параметри модального вікна
   */
  constructor(options = {}) {
    super({
      ...options,
      id: options.id || 'confirm-modal',
      title: options.title || 'Підтвердження',
      cssClass: `confirm-modal ${options.cssClass || ''}`
    });

    this.message = options.message || 'Ви впевнені?';
    this.confirmText = options.confirmText || 'Так';
    this.cancelText = options.cancelText || 'Ні';
    this.onConfirm = options.onConfirm || null;
    this.onCancel = options.onCancel || null;
  }

  /**
   * Генерація HTML-вмісту модального вікна підтвердження
   * @returns {string} - HTML-вміст
   */
  generateHTML() {
    return `
      <div class="modal-content confirm-content">
        <div class="modal-header">
          <h2 class="modal-title">${this.title}</h2>
          <span class="modal-close" data-action="close">×</span>
        </div>
        <div class="modal-body">
          <p>${this.message}</p>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" data-action="cancel">${this.cancelText}</button>
          <button class="confirm-btn" data-action="confirm">${this.confirmText}</button>
        </div>
      </div>
    `;
  }

  /**
   * Встановлення обробників подій
   */
  setupEventListeners() {
    super.setupEventListeners();

    if (!this.element) return;

    // Обробник кнопки підтвердження
    const confirmButton = this.element.querySelector('[data-action="confirm"]');
    if (confirmButton) {
      const confirmHandler = (e) => {
        e.preventDefault();
        if (typeof this.onConfirm === 'function') {
          this.onConfirm();
        }
        this.close();
      };

      confirmButton.addEventListener('click', confirmHandler);
      this.eventListeners.push({ element: confirmButton, event: 'click', handler: confirmHandler });
    }

    // Обробник кнопки скасування
    const cancelButton = this.element.querySelector('[data-action="cancel"]');
    if (cancelButton) {
      const cancelHandler = (e) => {
        e.preventDefault();
        if (typeof this.onCancel === 'function') {
          this.onCancel();
        }
        this.close();
      };

      cancelButton.addEventListener('click', cancelHandler);
      this.eventListeners.push({ element: cancelButton, event: 'click', handler: cancelHandler });
    }
  }

  /**
   * Відкриття модального вікна підтвердження
   * @returns {Promise<boolean>} - Результат підтвердження
   */
  async openAsync() {
    return new Promise((resolve) => {
      this.onConfirm = () => resolve(true);
      this.onCancel = () => resolve(false);
      this.onClose = () => resolve(false);
      this.open();
    });
  }
}

/**
 * Модальне вікно деталей розіграшу
 */
class RaffleHistoryModal extends BaseModal {
  /**
   * Конструктор модального вікна деталей розіграшу
   * @param {Object} options - Параметри модального вікна
   * @param {Object} raffleData - Дані розіграшу
   */
  constructor(options = {}, raffleData = {}) {
    super({
      ...options,
      id: options.id || 'raffle-history-modal',
      title: raffleData.title || options.title || 'Деталі розіграшу',
      cssClass: `raffle-history-modal ${options.cssClass || ''}`
    });

    this.raffleData = raffleData;
  }

  /**
   * Генерація HTML-вмісту модального вікна деталей розіграшу
   * @returns {string} - HTML-вміст
   */
  generateHTML() {
    const { raffleData } = this;

    // Генеруємо список переможців, якщо вони є
    let winnersHTML = '';
    if (raffleData.winners && Array.isArray(raffleData.winners) && raffleData.winners.length > 0) {
      winnersHTML = this._generateWinnersListHTML(raffleData.winners);
    } else {
      winnersHTML = '<div class="no-winners">Інформація про переможців відсутня</div>';
    }

    // Визначаємо статус і клас статусу
    const statusClass = raffleData.status === 'won' ? 'win-status' : 'participated-status';
    const statusText = raffleData.status === 'won' ? 'Ви перемогли' : 'Участь без перемоги';

    // Визначаємо тип розіграшу
    const raffleType = raffleData.is_daily ? 'Щоденний розіграш' : 'Гранд розіграш';

    // Повертаємо HTML-розмітку
    return `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${this.title}</h2>
          <span class="modal-close" data-action="close">×</span>
        </div>
        
        <div class="prize-details">
          <div class="detail-item">
            <div class="detail-label">Дата:</div>
            <div class="detail-value">${raffleData.date || 'Не вказано'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Тип:</div>
            <div class="detail-value">${raffleType}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Призовий фонд:</div>
            <div class="detail-value prize-value">${raffleData.prize || '0 WINIX'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Ваш результат:</div>
            <div class="detail-value ${statusClass}">${statusText}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Використано жетонів:</div>
            <div class="detail-value">${raffleData.entry_count || 0}</div>
          </div>
          ${raffleData.status === 'won' ? `
          <div class="detail-item">
            <div class="detail-label">Ваше місце:</div>
            <div class="detail-value winner-place-value">${raffleData.place || '-'}</div>
          </div>
          ` : ''}
        </div>
        
        <div class="winners-container">
          <h3>Переможці розіграшу</h3>
          <div class="winners-list">
            ${winnersHTML}
          </div>
        </div>
        
        <button class="join-button" data-action="close">ЗАКРИТИ</button>
      </div>
    `;
  }

  /**
   * Генерування HTML для списку переможців
   * @param {Array} winners - Масив з переможцями
   * @returns {string} - HTML-розмітка
   * @private
   */
  _generateWinnersListHTML(winners) {
    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      return '<div class="no-winners">Інформація про переможців відсутня</div>';
    }

    // Сортуємо переможців за місцем (спочатку найвищі)
    const sortedWinners = [...winners].sort((a, b) => {
      if (!a || !b || !a.place || !b.place) return 0;
      return a.place - b.place;
    });

    return sortedWinners.map(winner => {
      if (!winner) return '';

      // Визначаємо клас для місця (top-1, top-2, top-3)
      const placeClass = winner.place <= 3 ? `place-${winner.place}` : 'default-place';

      // Визначаємо, чи це поточний користувач
      const currentUserClass = winner.isCurrentUser ? 'current-user' : '';

      // Формуємо HTML для одного переможця
      return `
        <div class="winner-item ${currentUserClass}" ${winner.isCurrentUser ? 'title="Це ви!"' : ''}>
          <div class="winner-place ${placeClass}">
            <span>${winner.place || '-'}</span>
          </div>
          <div class="winner-info">
            <div class="winner-name">${winner.username || 'Користувач'}</div>
            <div class="winner-id">ID: ${winner.userId || 'невідомо'}</div>
          </div>
          <div class="winner-prize">${winner.prize || '0 WINIX'}</div>
        </div>
      `;
    }).join('');
  }
}

/**
 * Менеджер модальних вікон
 */
class ModalManager {
  /**
   * Конструктор менеджера модальних вікон
   */
  constructor() {
    this.modals = new Map();
    this.activeModals = [];
    this.modalTypes = {};

    // Реєструємо базові типи модальних вікон
    this.registerModalType('base', BaseModal);
    this.registerModalType('confirm', ConfirmModal);
    this.registerModalType('raffleHistory', RaffleHistoryModal);

    // Стек для зберігання порядку відкриття модальних вікон
    this.modalStack = [];
  }

  /**
   * Ініціалізація менеджера модальних вікон
   */
  init() {
    // Підписуємось на події
    this._setupEventListeners();

    // Шукаємо існуючі модальні вікна в DOM та реєструємо їх
    this._setupExistingModals();

    WinixRaffles.logger.log("Ініціалізовано менеджер модальних вікон");
    return this;
  }

  /**
   * Налаштування існуючих модальних вікон на сторінці
   * @private
   */
  _setupExistingModals() {
    // Знаходимо всі модальні вікна на сторінці
    const modalElements = document.querySelectorAll('.raffle-modal');

    modalElements.forEach(element => {
      const modalId = element.id;
      if (!modalId) return;

      // Створюємо базовий об'єкт модального вікна для існуючого елемента
      const modal = new BaseModal({
        id: modalId,
        title: element.querySelector('.modal-title')?.textContent || 'Модальне вікно',
      });

      modal.element = element;
      modal.setupEventListeners();

      // Зберігаємо посилання на модальне вікно
      this.modals.set(modalId, modal);
    });
  }

  /**
   * Налаштування глобальних обробників подій
   * @private
   */
  _setupEventListeners() {
    // Обробник для показу деталей історії розіграшу
    WinixRaffles.events.on('show-history-details', (data) => {
      if (data && data.raffleData) {
        this.showRaffleHistoryDetails(data.raffleData);
      }
    });

    // Обробник для закриття всіх модальних вікон при скиданні стану
    WinixRaffles.events.on('reset-all-states', () => {
      this.closeAllModals();
    });
  }

  /**
   * Реєстрація нового типу модального вікна
   * @param {string} typeName - Назва типу модального вікна
   * @param {class} modalClass - Клас модального вікна
   */
  registerModalType(typeName, modalClass) {
    if (!typeName || typeof typeName !== 'string') {
      WinixRaffles.logger.error("Не вказано назву типу модального вікна");
      return;
    }

    if (!modalClass || typeof modalClass !== 'function') {
      WinixRaffles.logger.error("Не вказано клас модального вікна");
      return;
    }

    this.modalTypes[typeName] = modalClass;
    WinixRaffles.logger.debug(`Зареєстровано тип модального вікна: ${typeName}`);
  }

  /**
   * Створення нового модального вікна
   * @param {string} type - Тип модального вікна
   * @param {Object} options - Параметри модального вікна
   * @returns {BaseModal} - Створене модальне вікно
   */
  createModal(type, options = {}) {
    const ModalClass = this.modalTypes[type] || BaseModal;
    const modal = new ModalClass(options);

    // Зберігаємо модальне вікно в колекції
    this.modals.set(modal.id, modal);

    return modal;
  }

  /**
   * Отримання модального вікна за ID
   * @param {string} modalId - ID модального вікна
   * @returns {BaseModal|null} - Модальне вікно або null
   */
  getModal(modalId) {
    return this.modals.get(modalId) || null;
  }

  /**
   * Відкриття модального вікна за ID
   * @param {string} modalId - ID модального вікна
   */
  openModal(modalId) {
    const modal = this.getModal(modalId);

    if (!modal) {
      WinixRaffles.logger.error(`Модальне вікно з ID ${modalId} не знайдено`);
      return;
    }

    // Додаємо до списку активних модальних вікон
    if (!this.activeModals.includes(modalId)) {
      this.activeModals.push(modalId);
    }

    // Додаємо до стеку для керування z-index
    this.modalStack.push(modalId);

    // Відкриваємо модальне вікно
    modal.open();
  }

  /**
   * Закриття модального вікна за ID
   * @param {string} modalId - ID модального вікна
   */
  closeModal(modalId) {
    const modal = this.getModal(modalId);

    if (!modal) {
      return;
    }

    // Видаляємо зі списку активних модальних вікон
    const index = this.activeModals.indexOf(modalId);
    if (index !== -1) {
      this.activeModals.splice(index, 1);
    }

    // Видаляємо зі стеку
    const stackIndex = this.modalStack.indexOf(modalId);
    if (stackIndex !== -1) {
      this.modalStack.splice(stackIndex, 1);
    }

    // Закриваємо модальне вікно
    modal.close();
  }

  /**
   * Закриття всіх відкритих модальних вікон
   */
  closeAllModals() {
    // Копіюємо масив, щоб уникнути проблем з ітерацією при змінах
    const activeModalsCopy = [...this.activeModals];

    activeModalsCopy.forEach(modalId => {
      this.closeModal(modalId);
    });

    // Очищаємо стек модальних вікон
    this.modalStack = [];

    // Розблоковуємо скролл
    document.body.style.overflow = '';
  }

  /**
   * Показати діалог підтвердження
   * @param {string} message - Текст повідомлення
   * @param {string} [confirmText='Так'] - Текст кнопки підтвердження
   * @param {string} [cancelText='Ні'] - Текст кнопки скасування
   * @returns {Promise<boolean>} - Результат підтвердження
   */
  async showConfirm(message, confirmText = 'Так', cancelText = 'Ні') {
    const confirmModal = this.createModal('confirm', {
      message,
      confirmText,
      cancelText
    });

    return confirmModal.openAsync();
  }

  /**
   * Показати деталі розіграшу з історії
   * @param {Object} raffleData - Дані розіграшу
   */
  showRaffleHistoryDetails(raffleData) {
    if (!raffleData) {
      showToast('Не вдалося отримати дані розіграшу', 'error');
      return;
    }

    // ID модального вікна з унікальним ідентифікатором для даного розіграшу
    const modalId = `raffle-history-modal-${raffleData.id || Date.now()}`;

    // Видаляємо існуюче модальне вікно з таким ID, якщо воно є
    if (this.getModal(modalId)) {
      this.closeModal(modalId);
      this.modals.delete(modalId);
    }

    // Створюємо нове модальне вікно
    const historyModal = this.createModal('raffleHistory', {
      id: modalId,
      title: raffleData.title || 'Деталі розіграшу'
    }, raffleData);

    // Створюємо елемент модального вікна (якщо він ще не створений)
    historyModal.createElement();

    // Оновлюємо зміст модального вікна даними розіграшу
    historyModal.raffleData = raffleData;
    historyModal.update();

    // Відкриваємо модальне вікно
    historyModal.open();

    return historyModal;
  }

  /**
   * Знищення менеджера та звільнення ресурсів
   */
  destroy() {
    // Закриваємо всі відкриті модальні вікна
    this.closeAllModals();

    // Видаляємо всі модальні вікна і їх елементи
    for (const [id, modal] of this.modals.entries()) {
      modal.removeElement();
    }

    // Очищаємо колекції
    this.modals.clear();
    this.activeModals = [];
    this.modalStack = [];

    WinixRaffles.logger.log("Менеджер модальних вікон знищено");
    return this;
  }
}

/**
 * Модуль модальних вікон для системи WinixRaffles
 */
const modalsModule = {
  manager: null,

  /**
   * Ініціалізація модуля
   */
  init: function() {
    WinixRaffles.logger.log("Ініціалізація модуля модальних вікон");

    // Створюємо менеджер модальних вікон
    this.manager = new ModalManager();
    this.manager.init();

    // Експортуємо методи для зворотної сумісності
    this.exportBackwardCompatibleMethods();

    return this;
  },

  /**
   * Експорт методів для зворотної сумісності
   */
  exportBackwardCompatibleMethods: function() {
    // Експортуємо необхідні методи в глобальний об'єкт WinixRaffles
    WinixRaffles.modals = {
      // Загальні методи управління модальними вікнами
      openModal: this.manager.openModal.bind(this.manager),
      closeModal: this.manager.closeModal.bind(this.manager),
      closeAllModals: this.manager.closeAllModals.bind(this.manager),
      showConfirm: this.manager.showConfirm.bind(this.manager),

      // Специфічні методи для розіграшів
      showRaffleHistoryDetails: this.manager.showRaffleHistoryDetails.bind(this.manager),

      // Службові методи
      init: this.init.bind(this),
      destroy: this.destroy.bind(this)
    };
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }

    WinixRaffles.logger.log("Модуль модальних вікон знищено");
  }
};

// Реєструємо модуль в системі WinixRaffles
WinixRaffles.registerModule('modals', modalsModule);

// Для зворотної сумісності створюємо об'єкт raffleModals
const raffleModals = {
  init() {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule) {
      modalsModule.init();
    }
    return this;
  },

  openModal(modalId) {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule && modalsModule.manager) {
      modalsModule.manager.openModal(modalId);
    }
  },

  closeModal(modalId) {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule && modalsModule.manager) {
      modalsModule.manager.closeModal(modalId);
    }
  },

  closeAllModals() {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule && modalsModule.manager) {
      modalsModule.manager.closeAllModals();
    }
  },

  showConfirm(message, confirmText, cancelText) {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule && modalsModule.manager) {
      return modalsModule.manager.showConfirm(message, confirmText, cancelText);
    }
    return Promise.resolve(false);
  },

  showRaffleHistoryDetails(raffleData) {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule && modalsModule.manager) {
      return modalsModule.manager.showRaffleHistoryDetails(raffleData);
    }
    return null;
  },

  destroy() {
    const modalsModule = WinixRaffles.getModule('modals');
    if (modalsModule) {
      modalsModule.destroy();
    }
  }
};

// Ініціалізуємо модуль при завантаженні документа
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      raffleModals.init();
    }, 100);
  });
} else {
  setTimeout(() => {
    raffleModals.init();
  }, 100);
}

// Експортуємо об'єкт для зворотної сумісності
export default raffleModals;