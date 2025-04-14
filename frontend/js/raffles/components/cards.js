/**
 * Компоненти для відображення карток розіграшів
 * Використовує модульний підхід з розділенням відповідальності
 */

import WinixRaffles from '../globals.js';
import { formatTimeLeft, calculateProgressByTime, generatePrizeDistributionHTML } from '../utils/formatters.js';

/**
 * Базовий клас для всіх типів карток розіграшів
 * Містить спільні методи та властивості
 */
class BaseRaffleCard {
  /**
   * Конструктор базового класу
   * @param {Object} raffle - Дані розіграшу
   */
  constructor(raffle) {
    this.raffle = raffle || {};
    this.id = this.raffle.id || 'unknown';
    this.title = this.raffle.title || 'Розіграш';
    this.entryFee = this.raffle.entry_fee || 0;
    this.prizeAmount = this.raffle.prize_amount || 0;
    this.prizeCurrency = this.raffle.prize_currency || 'WINIX';
    this.winnersCount = this.raffle.winners_count || 1;
    this.cardType = 'base';
  }

  /**
   * Розрахунок часу, що залишився
   * @param {string} format - Формат відображення ('full' або 'short')
   * @returns {Object} Об'єкт з часом та HTML
   */
  calculateTimeLeft(format = 'full') {
    let timeLeftData = null;
    let timeLeftHTML = '';

    try {
      // Перевіряємо наявність end_time та його валідність
      if (!this.raffle.end_time) {
        throw new Error("Відсутня дата завершення розіграшу");
      }

      const now = new Date();
      const endTime = new Date(this.raffle.end_time);

      // Перевіряємо, чи є endTime валідним об'єктом Date
      if (isNaN(endTime.getTime())) {
        throw new Error("Невалідна дата завершення розіграшу");
      }

      const timeLeft = endTime - now;

      if (timeLeft > 0) {
        timeLeftData = formatTimeLeft(timeLeft, format);
      } else {
        timeLeftData = {
          days: '00',
          hours: '00',
          minutes: '00',
          seconds: '00',
          text: 'Завершується'
        };
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка розрахунку часу:", error);
      timeLeftData = {
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
        text: 'Час не визначено'
      };
    }

    return timeLeftData;
  }

  /**
   * Генерація HTML для відображення часу, що залишився
   * @param {Object} timeLeftData - Дані про час, що залишився
   * @returns {string} HTML для відображення часу
   */
  generateTimeLeftHTML(timeLeftData) {
    // Цей метод буде перевизначено у дочірніх класах
    return '';
  }

  /**
   * Розрахунок прогресу розіграшу
   * @returns {number} Відсоток прогресу (0-100)
   */
  calculateProgress() {
    try {
      // Перевіряємо наявність start_time та end_time
      if (this.raffle.start_time && this.raffle.end_time) {
        return calculateProgressByTime(this.raffle.start_time, this.raffle.end_time);
      }
      return 0;
    } catch (error) {
      WinixRaffles.logger.error("Помилка розрахунку прогресу:", error);
      return 0;
    }
  }

  /**
   * Генерація HTML вмісту картки
   * @returns {string} HTML-вміст картки
   */
  generateHTML() {
    // Цей метод буде перевизначено у дочірніх класах
    return '';
  }

  /**
   * Встановлення обробників подій для елементів картки
   * @param {HTMLElement} element - DOM-елемент картки
   */
  setupEventListeners(element) {
    // Цей метод буде перевизначено у дочірніх класах
  }

  /**
   * Додавання картки до контейнера
   * @param {HTMLElement} container - DOM-елемент контейнера
   * @returns {HTMLElement} Створений DOM-елемент картки
   */
  appendTo(container) {
    if (!container) {
      WinixRaffles.logger.error(`Не вказано контейнер для картки розіграшу #${this.id}`);
      return null;
    }

    // Створюємо елемент
    const element = document.createElement('div');
    element.className = `raffle-card ${this.cardType}-raffle-card`;
    element.setAttribute('data-raffle-id', this.id);
    element.innerHTML = this.generateHTML();

    // Додаємо обробники подій
    this.setupEventListeners(element);

    // Додаємо до контейнера
    container.appendChild(element);

    return element;
  }

  /**
   * Оновлення вмісту картки
   * @param {HTMLElement} element - DOM-елемент картки
   * @param {Object} newData - Нові дані розіграшу
   */
  update(element, newData) {
    if (!element) {
      WinixRaffles.logger.error(`Не вказано елемент для оновлення картки розіграшу #${this.id}`);
      return;
    }

    // Оновлюємо дані
    if (newData) {
      this.raffle = { ...this.raffle, ...newData };
      this.title = this.raffle.title || 'Розіграш';
      this.entryFee = this.raffle.entry_fee || 0;
      this.prizeAmount = this.raffle.prize_amount || 0;
      this.prizeCurrency = this.raffle.prize_currency || 'WINIX';
      this.winnersCount = this.raffle.winners_count || 1;
    }

    // Оновлюємо HTML
    element.innerHTML = this.generateHTML();

    // Оновлюємо обробники подій
    this.setupEventListeners(element);
  }
}

/**
 * Клас для основної картки розіграшу
 */
class MainRaffleCard extends BaseRaffleCard {
  /**
   * Конструктор
   * @param {Object} raffle - Дані розіграшу
   */
  constructor(raffle) {
    super(raffle);
    this.cardType = 'main';
    this.participantsCount = this.raffle.participants_count || 0;
    this.imageUrl = this.raffle.image_url || '/assets/prize-poster.gif';
  }

  /**
   * Генерація HTML для відображення часу, що залишився
   * @param {Object} timeLeftData - Дані про час, що залишився
   * @returns {string} HTML для відображення часу
   */
  generateTimeLeftHTML(timeLeftData) {
    if (timeLeftData && timeLeftData.days !== undefined) {
      if (timeLeftData.text === 'Завершується') {
        return `
          <div class="timer-container">
            <div class="timer-finished">Завершується</div>
          </div>
        `;
      }

      return `
        <div class="timer-container">
          <div class="timer-block">
            <span class="timer-value" id="days">${timeLeftData.days}</span>
            <span class="timer-label">днів</span>
          </div>
          <div class="timer-block">
            <span class="timer-value" id="hours">${timeLeftData.hours}</span>
            <span class="timer-label">год</span>
          </div>
          <div class="timer-block">
            <span class="timer-value" id="minutes">${timeLeftData.minutes}</span>
            <span class="timer-label">хв</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="timer-container">
        <div class="timer-error">Час не визначено</div>
      </div>
    `;
  }

  /**
   * Отримання HTML-розмітки для розподілу призів
   * @returns {string} HTML-розмітка розподілу призів
   */
  getPrizeDistributionHTML() {
    let prizeDistributionHTML = '';

    try {
      if (this.raffle.prize_distribution && typeof this.raffle.prize_distribution === 'object') {
        prizeDistributionHTML = generatePrizeDistributionHTML(this.raffle.prize_distribution);
      } else {
        prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка генерації розподілу призів:", error);
      prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Помилка відображення</span></div>';
    }

    return prizeDistributionHTML;
  }

  /**
   * Генерація HTML вмісту картки
   * @returns {string} HTML-вміст картки
   */
  generateHTML() {
    const timeLeftData = this.calculateTimeLeft('full');
    const timeLeftHTML = this.generateTimeLeftHTML(timeLeftData);
    const progressWidth = this.calculateProgress();
    const prizeDistributionHTML = this.getPrizeDistributionHTML();

    return `
      <img class="main-raffle-image" src="${this.imageUrl}" alt="${this.title}">
      <div class="main-raffle-content">
        <div class="main-raffle-header">
          <h3 class="main-raffle-title">${this.title}</h3>
          <div class="main-raffle-cost">
            <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
            <span>${this.entryFee} жетон${this.entryFee !== 1 ? 'и' : ''}</span>
          </div>
        </div>

        <span class="main-raffle-prize">${this.prizeAmount} ${this.prizeCurrency}</span>

        ${timeLeftHTML}

        <div class="prize-distribution">
          <div class="prize-distribution-title">Розподіл призів (${this.winnersCount} переможців):</div>
          <div class="prize-list">
            ${prizeDistributionHTML}
          </div>
        </div>

        <div class="main-raffle-participants">
          <div class="participants-info">Учасників: <span class="participants-count">${this.participantsCount}</span></div>
          <div class="share-container">
            <button class="share-button" id="share-raffle-btn" data-raffle-id="${this.id}">Поділитися</button>
          </div>
        </div>

        <div class="progress-bar">
          <div class="progress" style="width: ${progressWidth}%"></div>
        </div>

        <button class="join-button" data-raffle-id="${this.id}" data-raffle-type="main">Взяти участь</button>
      </div>
    `;
  }

  /**
   * Встановлення обробників подій для елементів картки
   * @param {HTMLElement} element - DOM-елемент картки
   */
  setupEventListeners(element) {
    if (!element) return;

    // Додаємо обробник для кнопки "Взяти участь"
    const joinButton = element.querySelector('.join-button');
    if (joinButton) {
      joinButton.addEventListener('click', () => {
        const raffleId = joinButton.getAttribute('data-raffle-id');
        if (!raffleId) {
          WinixRaffles.logger.error("ID розіграшу не знайдено");
          return;
        }

        const raffleType = joinButton.getAttribute('data-raffle-type') || 'main';

        // Генеруємо подію для відкриття деталей розіграшу
        WinixRaffles.events.emit('open-raffle-details', {
          raffleId,
          raffleType
        });
      });
    }

    // Додаємо обробник для кнопки "Поділитися"
    const shareButton = element.querySelector('#share-raffle-btn');
    if (shareButton) {
      shareButton.addEventListener('click', () => {
        const raffleId = shareButton.getAttribute('data-raffle-id');
        if (!raffleId) {
          WinixRaffles.logger.error("ID розіграшу не знайдено");
          return;
        }

        // Генеруємо подію для поширення розіграшу
        WinixRaffles.events.emit('share-raffle', { raffleId });
      });
    }
  }
}

/**
 * Клас для картки міні-розіграшу
 */
class MiniRaffleCard extends BaseRaffleCard {
  /**
   * Конструктор
   * @param {Object} raffle - Дані розіграшу
   */
  constructor(raffle) {
    super(raffle);
    this.cardType = 'mini';
  }

  /**
   * Генерація HTML вмісту картки
   * @returns {string} HTML-вміст картки
   */
  generateHTML() {
    const timeLeftData = this.calculateTimeLeft('short');
    const timeLeftText = timeLeftData.text || 'Час не визначено';
    const winnersText = `${this.prizeAmount} ${this.prizeCurrency} (${this.winnersCount} переможців)`;

    return `
      <div class="mini-raffle-info">
        <div class="mini-raffle-title">${this.title}</div>
        <div class="mini-raffle-cost">
          <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
          <span>${this.entryFee} жетон${this.entryFee !== 1 ? 'и' : ''}</span>
        </div>
        <div class="mini-raffle-prize">${winnersText}</div>
        <div class="mini-raffle-time">Залишилось: ${timeLeftText}</div>
      </div>
      <button class="mini-raffle-button" data-raffle-id="${this.id}" data-raffle-type="daily">Участь</button>
    `;
  }

  /**
   * Встановлення обробників подій для елементів картки
   * @param {HTMLElement} element - DOM-елемент картки
   */
  setupEventListeners(element) {
    if (!element) return;

    // Додаємо обробник для кнопки "Участь"
    const button = element.querySelector('.mini-raffle-button');
    if (button) {
      button.addEventListener('click', (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        const raffleId = button.getAttribute('data-raffle-id');
        if (!raffleId) {
          WinixRaffles.logger.error("ID розіграшу не знайдено");
          return;
        }

        const raffleType = button.getAttribute('data-raffle-type') || 'daily';

        // Генеруємо подію для відкриття деталей розіграшу
        WinixRaffles.events.emit('open-raffle-details', {
          raffleId,
          raffleType
        });
      });
    }
  }

  /**
   * Створення DOM-елементу міні-розіграшу
   * @returns {HTMLElement} DOM-елемент міні-розіграшу
   */
  createElement() {
    const element = document.createElement('div');
    element.className = 'mini-raffle';
    element.setAttribute('data-raffle-id', this.id);
    element.innerHTML = this.generateHTML();

    this.setupEventListeners(element);

    return element;
  }
}

/**
 * Клас для картки бонусу новачка
 */
class NewbieBonusCard extends BaseRaffleCard {
  /**
   * Конструктор
   */
  constructor() {
    // Створюємо спеціальні дані для бонусу новачка
    const newbieData = {
      id: 'newbie',
      title: 'Бонус новачка',
      entry_fee: 0,
      prize_amount: 500,
      prize_currency: 'WINIX',
      winners_count: 1
    };

    super(newbieData);
    this.cardType = 'newbie';
    this.bonusClaimed = false;
  }

  /**
   * Генерація HTML вмісту картки
   * @returns {string} HTML-вміст картки
   */
  generateHTML() {
    const buttonText = this.bonusClaimed ? 'Отримано' : 'Отримати';
    const buttonDisabled = this.bonusClaimed ? 'disabled' : '';
    const buttonStyle = this.bonusClaimed ? 'opacity: 0.6; cursor: default;' : '';

    return `
      <div class="mini-raffle-info">
        <div class="mini-raffle-title">Бонус новачка</div>
        <div class="mini-raffle-cost">
          <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
          <span>0 жетонів</span>
        </div>
        <div class="mini-raffle-prize">500 WINIX + 1 жетон</div>
        <div class="mini-raffle-time">Доступно тільки новим користувачам</div>
      </div>
      <button class="mini-raffle-button" data-raffle-id="newbie" ${buttonDisabled} style="${buttonStyle}">
        ${buttonText}
      </button>
    `;
  }

  /**
   * Встановлення обробників подій для елементів картки
   * @param {HTMLElement} element - DOM-елемент картки
   */
  setupEventListeners(element) {
    if (!element || this.bonusClaimed) return;

    const button = element.querySelector('.mini-raffle-button');
    if (button && !button.disabled) {
      button.addEventListener('click', async (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Генеруємо подію для отримання бонусу новачка
        WinixRaffles.events.emit('claim-newbie-bonus', {
          element: button,
          container: element
        });
      });
    }
  }

  /**
   * Встановлення статусу отримання бонусу
   * @param {boolean} claimed - Статус отримання бонусу
   * @param {HTMLElement} element - DOM-елемент картки
   */
  setBonusClaimed(claimed, element) {
    this.bonusClaimed = claimed;

    if (element) {
      const button = element.querySelector('.mini-raffle-button');
      if (button) {
        button.textContent = 'Отримано';
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'default';
      }

      // Додаємо водяний знак, якщо є функція markElement
      if (typeof window.markElement === 'function') {
        window.markElement(element);
      }
    }
  }

  /**
   * Перевірка статусу бонусу новачка з API
   * @param {HTMLElement} element - DOM-елемент картки
   */
  async checkBonusStatus(element) {
    try {
      if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
        const userData = await window.WinixAPI.getUserData();
        if (userData && userData.data && userData.data.newbie_bonus_claimed) {
          this.setBonusClaimed(true, element);
        }
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка перевірки статусу бонусу:", error);
    }
  }
}

/**
 * Менеджер карток розіграшів
 * Керує створенням та відображенням всіх типів карток
 */
class RaffleCardsManager {
  /**
   * Ініціалізація менеджера карток
   */
  constructor() {
    // Зберігаємо посилання на створені картки для можливості оновлення
    this.cardInstances = new Map();

    // Підписуємося на події для взаємодії з іншими модулями
    this._setupEventListeners();
  }

  /**
   * Підписка на події
   * @private
   */
  _setupEventListeners() {
    // Підписуємося на подію для бонусу новачка
    WinixRaffles.events.on('display-bonus-claimed', (data) => {
      if (data && data.element && data.container) {
        const newbieCard = this.cardInstances.get('newbie');
        if (newbieCard) {
          newbieCard.setBonusClaimed(true, data.container);
        }
      }
    });
  }

  /**
   * Відображення основного розіграшу
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {Object} raffle - Дані розіграшу
   * @returns {HTMLElement} Створений DOM-елемент картки
   */
  displayMainRaffle(container, raffle) {
    if (!container || !raffle) {
      WinixRaffles.logger.error("Не вказано контейнер або дані для основного розіграшу");
      return null;
    }

    // Очищаємо контейнер
    container.innerHTML = '';

    // Створюємо картку
    const mainCard = new MainRaffleCard(raffle);
    this.cardInstances.set(`main_${raffle.id}`, mainCard);

    // Додаємо до контейнера
    const element = mainCard.appendTo(container);

    return element;
  }

  /**
   * Створення елементу міні-розіграшу
   * @param {Object} raffle - Дані розіграшу
   * @returns {HTMLElement} Елемент міні-розіграшу
   */
  createMiniRaffleElement(raffle) {
    if (!raffle) {
      WinixRaffles.logger.error("Не вказано дані для міні-розіграшу");
      return null;
    }

    // Створюємо картку
    const miniCard = new MiniRaffleCard(raffle);
    this.cardInstances.set(`mini_${raffle.id}`, miniCard);

    // Створюємо елемент
    return miniCard.createElement();
  }

  /**
   * Додавання елементу бонусу новачка
   * @param {HTMLElement} container - Контейнер для додавання
   * @returns {HTMLElement} Створений DOM-елемент картки
   */
  addNewbieBonusElement(container) {
    if (!container) {
      WinixRaffles.logger.error("Не вказано контейнер для бонусу новачка");
      return null;
    }

    // Створюємо картку бонусу новачка
    const newbieCard = new NewbieBonusCard();
    this.cardInstances.set('newbie', newbieCard);

    // Додаємо до контейнера
    const element = newbieCard.appendTo(container);

    // Перевіряємо статус бонусу
    newbieCard.checkBonusStatus(element);

    return element;
  }

  /**
   * Оновлення картки розіграшу
   * @param {string} cardId - Ідентифікатор картки
   * @param {Object} newData - Нові дані розіграшу
   */
  updateCard(cardId, newData) {
    const card = this.cardInstances.get(cardId);
    if (!card) {
      WinixRaffles.logger.error(`Картка з ідентифікатором ${cardId} не знайдена`);
      return;
    }

    // Знаходимо елемент в DOM
    const element = document.querySelector(`[data-raffle-id="${card.id}"]`);
    if (!element) {
      WinixRaffles.logger.error(`Елемент картки з ідентифікатором ${card.id} не знайдений в DOM`);
      return;
    }

    // Оновлюємо картку
    card.update(element, newData);
  }

  /**
   * Знищення всіх карток та очищення ресурсів
   */
  destroy() {
    // Очищаємо картки
    this.cardInstances.clear();

    WinixRaffles.logger.log("Модуль карток розіграшів знищено");
  }
}

/**
 * Реєстрація модуля карток в системі WinixRaffles
 */
const raffleCardsModule = {
  manager: null,

  /**
   * Ініціалізація модуля
   */
  init: function() {
    WinixRaffles.logger.log("Ініціалізація модуля карток розіграшів");

    // Створюємо менеджер карток
    this.manager = new RaffleCardsManager();

    // Експортуємо методи для зворотної сумісності
    WinixRaffles.components = WinixRaffles.components || {};
    WinixRaffles.components.displayMainRaffle = this.manager.displayMainRaffle.bind(this.manager);
    WinixRaffles.components.createMiniRaffleElement = this.manager.createMiniRaffleElement.bind(this.manager);
    WinixRaffles.components.addNewbieBonusElement = this.manager.addNewbieBonusElement.bind(this.manager);

    return this;
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }

    WinixRaffles.logger.log("Модуль карток розіграшів знищено");
  }
};

// Реєструємо модуль в системі WinixRaffles
WinixRaffles.registerModule('cards', raffleCardsModule);

// Для зворотної сумісності
const raffleCards = {
  displayMainRaffle: function(container, raffle) {
    const cardsModule = WinixRaffles.getModule('cards');
    if (cardsModule && cardsModule.manager) {
      return cardsModule.manager.displayMainRaffle(container, raffle);
    }
    return null;
  },

  createMiniRaffleElement: function(raffle) {
    const cardsModule = WinixRaffles.getModule('cards');
    if (cardsModule && cardsModule.manager) {
      return cardsModule.manager.createMiniRaffleElement(raffle);
    }
    return null;
  },

  addNewbieBonusElement: function(container) {
    const cardsModule = WinixRaffles.getModule('cards');
    if (cardsModule && cardsModule.manager) {
      return cardsModule.manager.addNewbieBonusElement(container);
    }
    return null;
  },

  destroy: function() {
    const cardsModule = WinixRaffles.getModule('cards');
    if (cardsModule) {
      cardsModule.destroy();
    }
  }
};

// Експортуємо модуль для зворотної сумісності
export default raffleCards;