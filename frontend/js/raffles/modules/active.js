/**
 * active.js - Модуль для роботи з активними розіграшами WINIX
 * Використовує покращену структуру відповідно до нової архітектури
 * з мінімізацією дублювання коду та кращим керуванням життєвим циклом
 */

import WinixRaffles from '../globals.js';
import { CONFIG } from '../config.js';

/**
 * Клас для управління активними розіграшами
 */
class ActiveRafflesManager {
  /**
   * Створює екземпляр менеджера активних розіграшів
   */
  constructor() {
    // Стан модуля
    this.state = {
      activeRaffles: null,
      isLoading: false,
      lastUpdateTime: 0,
      timerIntervals: [],
      requestId: 0,
      loadingTimeoutId: null
    };

    // Константи
    this.CONSTANTS = {
      CACHE_TTL: 60000, // 1 хвилина
      REQUEST_TIMEOUT: 20000, // 20 секунд
      TIMER_UPDATE_INTERVAL: 60000 // 1 хвилина
    };

    // Елементи DOM
    this.DOM = {
      mainRaffleContainer: null,
      miniRafflesContainer: null
    };
  }

  /**
   * Ініціалізація модуля
   * @returns {Promise<void>}
   */
  async init() {
  WinixRaffles.logger.log("Ініціалізація модуля активних розіграшів");

  try {
    // Знаходимо потрібні DOM елементи
    this._findDOMElements();

    // Встановлюємо обробники подій
    this._setupEventListeners();

    // Додаємо виклик нового методу
    this._setupRefreshTimers();

    // Перевіряємо, чи пристрій онлайн
    if (!WinixRaffles.network.isOnline()) {
      WinixRaffles.logger.warn("Пристрій офлайн, відображаємо кешовані дані");
      this.displayOfflineData();
      return this;
    }

    // Отримуємо та відображаємо активні розіграші
    await this.getActiveRaffles();
    await this.displayRaffles();

    WinixRaffles.logger.log("Ініціалізацію модуля активних розіграшів завершено");
    return this;
  } catch (error) {
    WinixRaffles.logger.error("Критична помилка при ініціалізації модуля активних розіграшів:", error);
    this.resetAllStates();
    this.displayOfflineData();
    throw error;
  }
}

  /**
   * Знаходження необхідних DOM елементів
   * @private
   */
  _findDOMElements() {
    this.DOM.mainRaffleContainer = document.querySelector('.main-raffle');
    this.DOM.miniRafflesContainer = document.querySelector('.mini-raffles-container');

    if (!this.DOM.mainRaffleContainer && !this.DOM.miniRafflesContainer) {
      WinixRaffles.logger.warn("Не знайдено контейнери для розіграшів");
    }
  }

  /**
   * Встановлення обробників подій
   * @private
   */
  _setupEventListeners() {
    // Обробник події участі в розіграші
    WinixRaffles.events.on('raffle-participated', async (data) => {
      WinixRaffles.logger.log(`Отримано подію участі в розіграші: ${data.raffleId}`);

      if (this._isOnline()) {
        try {
          await this.getActiveRaffles(true);
          await this.displayRaffles();
        } catch (error) {
          WinixRaffles.logger.error("Помилка оновлення даних після участі:", error);
        }
      }
    });

    // Обробник події онлайн
    window.addEventListener('online', () => {
      WinixRaffles.logger.log("З'єднання з мережею відновлено");

      // Затримка для уникнення миттєвих запитів після відновлення з'єднання
      setTimeout(async () => {
        try {
          await this.getActiveRaffles(true);
          await this.displayRaffles();
        } catch (error) {
          WinixRaffles.logger.error("Помилка оновлення даних після відновлення з'єднання:", error);
        }
      }, 1000);
    });

    // Обробник події офлайн
    window.addEventListener('offline', () => {
      WinixRaffles.logger.warn("З'єднання з мережею втрачено");
    });

    // Обробник для перемикання вкладок
    const tabButtons = document.querySelectorAll('.tab-button');
    if (tabButtons.length > 0) {
      tabButtons.forEach(button => {
        if (button) {
          button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            if (tabName) {
              this.switchTab(tabName);
            }
          });
        }
      });
    }
  }

  /**
 * Налаштування таймерів оновлення
 * @private
 */
_setupRefreshTimers() {
  // Очищаємо існуючі таймери
  this._stopRaffleTimers();

  // Встановлюємо інтервал оновлення з конфігурації
  const refreshInterval = CONFIG.REFRESH_INTERVALS.ACTIVE_RAFFLES;

  // Запускаємо оновлення таймерів кожну хвилину
  const interval = setInterval(() => this._updateRaffleTimers(), 60000);
  this.state.timerIntervals.push(interval);

  // Запускаємо оновлення даних
  if (refreshInterval > 0) {
    const dataInterval = setInterval(() => {
      if (WinixRaffles.network.isOnline()) {
        this.getActiveRaffles(true)
          .then(data => this.displayRaffles(data))
          .catch(error => {
            WinixRaffles.logger.warn("Помилка автоматичного оновлення активних розіграшів:", error);
          });
      }
    }, refreshInterval);
    this.state.timerIntervals.push(dataInterval);
  }

  // Відразу запускаємо оновлення
  this._updateRaffleTimers();
}

  /**
   * Перевірка, чи пристрій онлайн
   * @returns {boolean} - Статус підключення
   * @private
   */
  _isOnline() {
    return WinixRaffles.network.isOnline();
  }

  /**
   * Отримання активних розіграшів
   * @param {boolean} forceRefresh - Примусове оновлення
   * @returns {Promise<Array>} - Масив активних розіграшів
   */
  async getActiveRaffles(forceRefresh = false) {
    // Перевіряємо, чи пристрій онлайн
    if (!this._isOnline() && !forceRefresh) {
      WinixRaffles.logger.warn("Пристрій офлайн, повертаємо кешовані дані");
      return this._getCachedRaffles();
    }

    // Перевіряємо кеш, якщо не потрібне примусове оновлення
    const now = Date.now();
    if (!forceRefresh &&
        this.state.activeRaffles &&
        (now - this.state.lastUpdateTime < this.CONSTANTS.CACHE_TTL)) {
      WinixRaffles.logger.log("Використання кешованих даних активних розіграшів");
      return this.state.activeRaffles;
    }

    // Автоматичне скидання зависаючих запитів
    if (this.state.isLoading && (now - this.state.lastUpdateTime > 30000)) {
      WinixRaffles.logger.warn("Виявлено потенційно зависаючий запит розіграшів, скидаємо стан");
      this.state.isLoading = false;
      if (this.state.loadingTimeoutId) {
        clearTimeout(this.state.loadingTimeoutId);
        this.state.loadingTimeoutId = null;
      }
    }

    // Перевіряємо, чи вже виконується запит
    if (this.state.isLoading) {
      WinixRaffles.logger.log("Завантаження розіграшів вже виконується");
      return this.state.activeRaffles || [];
    }

    // Встановлюємо прапорці
    this.state.isLoading = true;
    this.state.lastUpdateTime = now;
    const currentRequestId = ++this.state.requestId;

    // Встановлюємо таймаут для автоматичного скидання
    if (this.state.loadingTimeoutId) {
      clearTimeout(this.state.loadingTimeoutId);
    }
    this.state.loadingTimeoutId = setTimeout(() => {
      if (this.state.isLoading) {
        WinixRaffles.logger.warn("Завантаження розіграшів триває занадто довго, скидаємо стан");
        this.state.isLoading = false;
      }
    }, this.CONSTANTS.REQUEST_TIMEOUT);

    // Показуємо індикатор завантаження
    WinixRaffles.loader.show('Завантаження розіграшів...', 'active-raffles');

    try {
      // Отримуємо API сервіс
      const apiService = WinixRaffles.getModule('api');
      if (!apiService) {
        throw new Error("API сервіс не знайдено");
      }

      // Виконуємо запит через API сервіс
      const response = await apiService.apiRequest('/api/raffles', 'GET', null, {
        timeout: 15000,
        suppressErrors: true,
        forceCleanup: forceRefresh
      });

      // Перевіряємо, чи це актуальний запит
      if (currentRequestId !== this.state.requestId) {
        WinixRaffles.logger.warn("Отримано відповідь для застарілого запиту, ігноруємо");
        WinixRaffles.loader.hide('active-raffles');
        return this.state.activeRaffles || [];
      }

      // Обробляємо відповідь
      if (response && response.status === 'success') {
        this.state.activeRaffles = Array.isArray(response.data) ? response.data : [];
        this.state.lastUpdateTime = now;

        // Зберігаємо дані в localStorage для offline доступу
        this._saveCachedRaffles(this.state.activeRaffles);

        WinixRaffles.logger.log(`Отримано ${this.state.activeRaffles.length} активних розіграшів`);

        // Генеруємо подію оновлення розіграшів
        WinixRaffles.events.emit('raffles-updated', {
          count: this.state.activeRaffles.length,
          data: this.state.activeRaffles
        });

        return this.state.activeRaffles;
      } else {
        // Краща обробка помилок
        WinixRaffles.logger.error("Помилка отримання розіграшів:", response?.message || "Невідома помилка");

        // Використовуємо кешовані дані при помилці
        if (this.state.activeRaffles) {
          WinixRaffles.logger.warn("Використання кешованих даних після помилки");
          return this.state.activeRaffles;
        }

        throw new Error((response && response.message) || 'Помилка отримання розіграшів');
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка отримання активних розіграшів:', error);

      // Генеруємо подію про помилку
      WinixRaffles.events.emit('raffles-error', {
        message: error.message || 'Помилка отримання розіграшів',
        error
      });

      // Використовуємо кешовані дані при помилці
      return this._getCachedRaffles();
    } finally {
      // ЗАВЖДИ скидаємо прапорці і приховуємо лоадер
      WinixRaffles.loader.hide('active-raffles');
      this.state.isLoading = false;

      if (this.state.loadingTimeoutId) {
        clearTimeout(this.state.loadingTimeoutId);
        this.state.loadingTimeoutId = null;
      }
    }
  }

  /**
   * Збереження розіграшів у кеш
   * @param {Array} raffles - Масив розіграшів
   * @private
   */
  _saveCachedRaffles(raffles) {
    try {
      localStorage.setItem('winix_active_raffles', JSON.stringify(raffles));
    } catch (e) {
      WinixRaffles.logger.warn("Помилка збереження даних в localStorage:", e);
    }
  }

  /**
   * Отримання розіграшів з кешу
   * @returns {Array} - Масив розіграшів
   * @private
   */
  _getCachedRaffles() {
    // Якщо є стан в пам'яті, використовуємо його
    if (this.state.activeRaffles) {
      return this.state.activeRaffles;
    }

    // Спробуємо завантажити з локального сховища
    try {
      const cachedRaffles = localStorage.getItem('winix_active_raffles');
      if (cachedRaffles) {
        const parsedRaffles = JSON.parse(cachedRaffles);
        if (Array.isArray(parsedRaffles)) {
          this.state.activeRaffles = parsedRaffles;
          return parsedRaffles;
        }
      }
    } catch (e) {
      WinixRaffles.logger.warn("Помилка парсингу кешованих даних:", e);
    }

    // Якщо нічого не знайдено, повертаємо порожній масив
    return [];
  }

  /**
   * Відображення активних розіграшів
   * @param {Array} forcedRaffles - Примусовий список розіграшів для відображення
   * @returns {Promise<void>}
   */
  async displayRaffles(forcedRaffles = null) {
    WinixRaffles.logger.log("Відображення активних розіграшів");

    // Перевіряємо наявність контейнерів
    this._findDOMElements();
    if (!this.DOM.mainRaffleContainer && !this.DOM.miniRafflesContainer) {
      WinixRaffles.logger.error("Не знайдено контейнери для розіграшів");
      return;
    }

    // Показуємо індикатор завантаження
    WinixRaffles.loader.show('Завантаження розіграшів...', 'active-raffles-display');

    try {
      // Отримуємо активні розіграші (або використовуємо вже надані)
      const raffles = forcedRaffles || await this.getActiveRaffles(!this._isOnline());

      // Приховуємо індикатор завантаження
      WinixRaffles.loader.hide('active-raffles-display');

      if (!raffles || raffles.length === 0) {
        WinixRaffles.logger.log("Активні розіграші не знайдено");
        this._displayEmptyState();
        return;
      }

      // Розділяємо розіграші на основні та міні
      const mainRaffles = raffles.filter(raffle => raffle && raffle.is_daily === false);
      const miniRaffles = raffles.filter(raffle => raffle && raffle.is_daily === true);

      // Відображаємо основний розіграш
      if (this.DOM.mainRaffleContainer) {
        if (mainRaffles.length > 0) {
          this._displayMainRaffle(this.DOM.mainRaffleContainer, mainRaffles[0]);
        } else {
          this._displayEmptyMainRaffle();
        }
      }

      // Відображаємо міні-розіграші
      if (this.DOM.miniRafflesContainer) {
        this._displayMiniRaffles(this.DOM.miniRafflesContainer, miniRaffles);
      }

      // Активуємо таймери
      this._startRaffleTimers();

      // Генеруємо подію про оновлення відображення
      WinixRaffles.events.emit('raffles-displayed', {
        mainCount: mainRaffles.length,
        miniCount: miniRaffles.length
      });
    } catch (error) {
      WinixRaffles.logger.error("Помилка при завантаженні активних розіграшів:", error);
      WinixRaffles.loader.hide('active-raffles-display');

      // Показуємо інформацію про помилку користувачу
      this._displayErrorState(error);
    }
  }

  /**
   * Відображення порожнього стану (немає розіграшів)
   * @private
   */
  _displayEmptyState() {
    // Показуємо повідомлення про відсутність розіграшів
    if (this.DOM.mainRaffleContainer) {
      this.DOM.mainRaffleContainer.innerHTML = `
        <div class="empty-raffles">
          <div class="empty-raffles-icon">🎮</div>
          <h3>Немає активних розіграшів</h3>
          <p>На даний момент немає доступних розіграшів. Перевірте пізніше!</p>
        </div>
      `;
    }

    // Очищаємо контейнер міні-розіграшів
    if (this.DOM.miniRafflesContainer) {
      this.DOM.miniRafflesContainer.innerHTML = '';
      // Додаємо елемент для бонусу новачка
      this._addNewbieBonusElement(this.DOM.miniRafflesContainer);
    }
  }

  /**
   * Відображення порожнього стану для основного розіграшу
   * @private
   */
  _displayEmptyMainRaffle() {
    if (this.DOM.mainRaffleContainer) {
      this.DOM.mainRaffleContainer.innerHTML = `
        <div class="empty-main-raffle">
          <div class="empty-raffles-icon">🎮</div>
          <h3>Немає активних розіграшів</h3>
          <p>Скоро будуть нові розіграші. Слідкуйте за оновленнями!</p>
        </div>
      `;
    }
  }

  /**
   * Відображення стану помилки
   * @param {Error} error - Об'єкт помилки
   * @private
   */
  _displayErrorState(error) {
    if (this.DOM.mainRaffleContainer) {
      let errorMessage = !this._isOnline()
        ? "Немає з'єднання з Інтернетом. Перевірте підключення."
        : "Сталася помилка при спробі завантажити розіграші.";

      this.DOM.mainRaffleContainer.innerHTML = `
        <div class="empty-raffles">
          <div class="empty-raffles-icon">❌</div>
          <h3>Помилка завантаження</h3>
          <p>${errorMessage} Спробуйте оновити сторінку.</p>
          <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
        </div>
      `;
    }
  }

  /**
   * Відображення даних в офлайн режимі або при помилці
   */
  displayOfflineData() {
    try {
      // Перевіряємо наявність контейнерів
      this._findDOMElements();
      if (!this.DOM.mainRaffleContainer && !this.DOM.miniRafflesContainer) {
        WinixRaffles.logger.error("Не знайдено контейнери для розіграшів");
        return;
      }

      // Завантажуємо локальні дані, якщо є
      const raffles = this._getCachedRaffles();
      if (raffles && raffles.length > 0) {
        WinixRaffles.logger.log("Використання кешованих даних розіграшів з localStorage");
        this.displayRaffles(raffles);
        return;
      }

      // Якщо немає кешованих даних, показуємо повідомлення
      if (this.DOM.mainRaffleContainer) {
        let statusMessage = !this._isOnline()
          ? "Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову."
          : "Не вдалося завантажити розіграші. Спробуйте оновити сторінку.";

        this.DOM.mainRaffleContainer.innerHTML = `
          <div class="empty-raffles">
            <div class="empty-raffles-icon">⚠️</div>
            <h3>Дані недоступні</h3>
            <p>${statusMessage}</p>
            <button class="join-raffle-btn" onclick="location.reload()">Оновити сторінку</button>
          </div>
        `;
      }

      // Очищаємо контейнер міні-розіграшів
      if (this.DOM.miniRafflesContainer) {
        this.DOM.miniRafflesContainer.innerHTML = '';
        // Додаємо елемент для бонусу новачка
        this._addNewbieBonusElement(this.DOM.miniRafflesContainer);
      }
    } catch (error) {
      WinixRaffles.logger.error("Критична помилка відображення офлайн даних:", error);
    }
  }

  /**
   * Відображення основного розіграшу
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {Object} raffle - Дані розіграшу
   * @private
   */
  _displayMainRaffle(container, raffle) {
    if (!container || !raffle) {
      WinixRaffles.logger.error("Не вказано контейнер або дані розіграшу");
      return;
    }

    try {
      // Отримуємо сервіс карток, якщо доступний
      const cardsModule = WinixRaffles.getModule('cards');
      if (cardsModule) {
        if (typeof cardsModule.displayMainRaffle === 'function') {
          cardsModule.displayMainRaffle(container, raffle);
          return;
        }
      }

      // Запасний варіант - використовуємо глобальний об'єкт
      if (WinixRaffles.components && typeof WinixRaffles.components.displayMainRaffle === 'function') {
        WinixRaffles.components.displayMainRaffle(container, raffle);
        return;
      }

      // Останній варіант - якщо немає жодного сервісу карток, використовуємо власний метод
      this._renderMainRaffleCard(container, raffle);
    } catch (error) {
      WinixRaffles.logger.error("Помилка відображення основного розіграшу:", error);
      container.innerHTML = `
        <div class="raffle-error">
          <div class="error-icon">⚠️</div>
          <h3>Помилка відображення розіграшу</h3>
          <p>Сталася помилка при відображенні даних розіграшу.</p>
        </div>
      `;
    }
  }

  /**
   * Рендеринг основної картки розіграшу (резервний метод)
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {Object} raffle - Дані розіграшу
   * @private
   */
  _renderMainRaffleCard(container, raffle) {
    // Отримуємо форматери, якщо доступні
    const formatTimeLeft = WinixRaffles.utils?.formatTimeLeft ||
      ((time) => ({ days: '00', hours: '00', minutes: '00' }));

    const calculateProgressByTime = WinixRaffles.utils?.calculateProgressByTime ||
      (() => 0);

    const generatePrizeDistributionHTML = WinixRaffles.utils?.generatePrizeDistributionHTML ||
      (() => '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>');

    // Базові дані розіграшу
    const title = raffle.title || 'Розіграш';
    const entryFee = raffle.entry_fee || 0;
    const prizeAmount = raffle.prize_amount || 0;
    const prizeCurrency = raffle.prize_currency || 'WINIX';
    const winnersCount = raffle.winners_count || 1;
    const participantsCount = raffle.participants_count || 0;
    const raffleId = raffle.id || 'unknown';
    const imageUrl = raffle.image_url || '/assets/prize-poster.gif';

    // Розраховуємо прогрес
    let progressWidth = 0;
    try {
      if (raffle.start_time && raffle.end_time) {
        progressWidth = calculateProgressByTime(raffle.start_time, raffle.end_time);
      }
    } catch (e) {
      WinixRaffles.logger.error("Помилка розрахунку прогресу:", e);
    }

    // Генеруємо розподіл призів
    let prizeDistributionHTML = '';
    try {
      if (raffle.prize_distribution && typeof raffle.prize_distribution === 'object') {
        prizeDistributionHTML = generatePrizeDistributionHTML(raffle.prize_distribution);
      } else {
        prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
      }
    } catch (e) {
      WinixRaffles.logger.error("Помилка генерації розподілу призів:", e);
      prizeDistributionHTML = '<div class="prize-item"><span class="prize-place">Помилка відображення</span></div>';
    }

    // Формуємо HTML
    container.innerHTML = `
      <img class="main-raffle-image" src="${imageUrl}" alt="${title}" onerror="this.src='/assets/prize-poster.gif'">
      <div class="main-raffle-content">
        <div class="main-raffle-header">
          <h3 class="main-raffle-title">${title}</h3>
          <div class="main-raffle-cost">
            <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
            <span>${entryFee} жетон${entryFee !== 1 ? 'и' : ''}</span>
          </div>
        </div>

        <span class="main-raffle-prize">${prizeAmount} ${prizeCurrency}</span>

        <div class="timer-container">
          <div class="timer-block">
            <span class="timer-value" id="days">00</span>
            <span class="timer-label">днів</span>
          </div>
          <div class="timer-block">
            <span class="timer-value" id="hours">00</span>
            <span class="timer-label">год</span>
          </div>
          <div class="timer-block">
            <span class="timer-value" id="minutes">00</span>
            <span class="timer-label">хв</span>
          </div>
        </div>

        <div class="prize-distribution">
          <div class="prize-distribution-title">Розподіл призів (${winnersCount} переможців):</div>
          <div class="prize-list">
            ${prizeDistributionHTML}
          </div>
        </div>

        <div class="main-raffle-participants">
          <div class="participants-info">Учасників: <span class="participants-count">${participantsCount}</span></div>
          <div class="share-container">
            <button class="share-button" id="share-raffle-btn" data-raffle-id="${raffleId}">Поділитися</button>
          </div>
        </div>

        <div class="progress-bar">
          <div class="progress" style="width: ${progressWidth}%"></div>
        </div>

        <button class="join-button" data-raffle-id="${raffleId}" data-raffle-type="main">Взяти участь</button>
      </div>
    `;

    // Додаємо обробники подій
    this._setupMainRaffleEventListeners(container, raffleId);
  }

  /**
   * Встановлення обробників подій для основного розіграшу
   * @param {HTMLElement} container - Контейнер розіграшу
   * @param {string} raffleId - Ідентифікатор розіграшу
   * @private
   */
  _setupMainRaffleEventListeners(container, raffleId) {
    // Кнопка участі
    const joinButton = container.querySelector('.join-button');
    if (joinButton) {
      joinButton.addEventListener('click', () => {
        const raffleId = joinButton.getAttribute('data-raffle-id');
        if (!raffleId) {
          WinixRaffles.logger.error("ID розіграшу не знайдено");
          return;
        }

        const raffleType = joinButton.getAttribute('data-raffle-type') || 'main';

        // Перевіряємо, чи ми онлайн
        if (!this._isOnline()) {
          const uiComponents = WinixRaffles.getModule('uiComponents');
          if (uiComponents && uiComponents.helpers) {
            uiComponents.helpers.showToast("Неможливо взяти участь без підключення до Інтернету", "error");
          } else if (WinixRaffles.utils && WinixRaffles.utils.showToast) {
            WinixRaffles.utils.showToast("Неможливо взяти участь без підключення до Інтернету", "error");
          }
          return;
        }

        // Генеруємо подію для відкриття деталей розіграшу
        WinixRaffles.events.emit('open-raffle-details', {
          raffleId,
          raffleType
        });
      });
    }

    // Кнопка "Поділитися"
    const shareButton = container.querySelector('#share-raffle-btn');
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

  /**
   * Відображення міні-розіграшів
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {Array} raffles - Масив розіграшів
   * @private
   */
  _displayMiniRaffles(container, raffles) {
    // Очищаємо контейнер
    container.innerHTML = '';

    if (raffles.length > 0) {
      // Отримуємо сервіс карток, якщо доступний
      const cardsModule = WinixRaffles.getModule('cards');

      // Додаємо кожен міні-розіграш
      raffles.forEach(raffle => {
        if (!raffle) return;

        // Спробуємо використати метод з модуля карток
        if (cardsModule && typeof cardsModule.createMiniRaffleElement === 'function') {
          const miniRaffleElement = cardsModule.createMiniRaffleElement(raffle);
          if (miniRaffleElement) {
            container.appendChild(miniRaffleElement);
          }
        } else if (WinixRaffles.components && typeof WinixRaffles.components.createMiniRaffleElement === 'function') {
          // Альтернативно використовуємо метод з глобального об'єкта
          const miniRaffleElement = WinixRaffles.components.createMiniRaffleElement(raffle);
          if (miniRaffleElement) {
            container.appendChild(miniRaffleElement);
          }
        } else {
          // Якщо немає жодного сервісу карток, створюємо власний елемент
          const miniRaffleElement = this._createMiniRaffleElement(raffle);
          if (miniRaffleElement) {
            container.appendChild(miniRaffleElement);
          }
        }
      });
    } else {
      // Додаємо елемент для бонусу новачка, якщо міні-розіграшів немає
      this._addNewbieBonusElement(container);
    }
  }

  /**
   * Створення елементу міні-розіграшу (резервний метод)
   * @param {Object} raffle - Дані розіграшу
   * @returns {HTMLElement} Елемент міні-розіграшу
   * @private
   */
  _createMiniRaffleElement(raffle) {
    if (!raffle) return null;

    try {
      // Отримуємо форматери, якщо доступні
      const formatTimeLeft = WinixRaffles.utils?.formatTimeLeft ||
        ((time, format) => ({ text: 'Час не визначено' }));

      // Створюємо контейнер
      const miniRaffle = document.createElement('div');
      miniRaffle.className = 'mini-raffle';
      miniRaffle.setAttribute('data-raffle-id', raffle.id || 'unknown');

      // Розраховуємо час, що залишився
      let timeLeftText = '';
      try {
        if (raffle.end_time) {
          const now = new Date();
          const endTime = new Date(raffle.end_time);

          if (!isNaN(endTime.getTime())) {
            const timeLeft = endTime - now;

            if (timeLeft > 0) {
              const timeLeftData = formatTimeLeft(timeLeft, 'short');
              timeLeftText = `Залишилось: ${timeLeftData.text}`;
            } else {
              timeLeftText = 'Завершується';
            }
          } else {
            timeLeftText = 'Час не визначено';
          }
        } else {
          timeLeftText = 'Час не визначено';
        }
      } catch (error) {
        WinixRaffles.logger.error("Помилка розрахунку часу міні-розіграшу:", error);
        timeLeftText = 'Час не визначено';
      }

      // Базові дані розіграшу
      const title = raffle.title || 'Розіграш';
      const entryFee = raffle.entry_fee || 0;
      const prizeAmount = raffle.prize_amount || 0;
      const prizeCurrency = raffle.prize_currency || 'WINIX';
      const winnersCount = raffle.winners_count || 1;
      const raffleId = raffle.id || 'unknown';

      // Форматуємо кількість переможців
      const winnersText = `${prizeAmount} ${prizeCurrency} (${winnersCount} переможців)`;

      // Формуємо HTML
      miniRaffle.innerHTML = `
        <div class="mini-raffle-info">
          <div class="mini-raffle-title">${title}</div>
          <div class="mini-raffle-cost">
            <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
            <span>${entryFee} жетон${entryFee !== 1 ? 'и' : ''}</span>
          </div>
          <div class="mini-raffle-prize">${winnersText}</div>
          <div class="mini-raffle-time">${timeLeftText}</div>
        </div>
        <button class="mini-raffle-button" data-raffle-id="${raffleId}" data-raffle-type="daily">Участь</button>
      `;

      // Додаємо обробник натискання
      const button = miniRaffle.querySelector('.mini-raffle-button');
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

          // Перевіряємо, чи ми онлайн
          if (!this._isOnline()) {
            const uiComponents = WinixRaffles.getModule('uiComponents');
            if (uiComponents && uiComponents.helpers) {
              uiComponents.helpers.showToast("Неможливо взяти участь без підключення до Інтернету", "error");
            } else if (WinixRaffles.utils && WinixRaffles.utils.showToast) {
              WinixRaffles.utils.showToast("Неможливо взяти участь без підключення до Інтернету", "error");
            }
            return;
          }

          // Генеруємо подію для відкриття деталей розіграшу
          WinixRaffles.events.emit('open-raffle-details', {
            raffleId,
            raffleType
          });
        });
      }

      return miniRaffle;
    } catch (error) {
      WinixRaffles.logger.error("Помилка створення елементу міні-розіграшу:", error);
      return null;
    }
  }

  /**
   * Додавання елементу бонусу новачка
   * @param {HTMLElement} container - Контейнер для додавання
   * @private
   */
  _addNewbieBonusElement(container) {
    if (!container) return;

    try {
      // Отримуємо сервіс карток, якщо доступний
      const cardsModule = WinixRaffles.getModule('cards');

      // Спробуємо використати метод з модуля карток
      if (cardsModule && typeof cardsModule.addNewbieBonusElement === 'function') {
        cardsModule.addNewbieBonusElement(container);
        return;
      }

      // Альтернативно використовуємо метод з глобального об'єкта
      if (WinixRaffles.components && typeof WinixRaffles.components.addNewbieBonusElement === 'function') {
        WinixRaffles.components.addNewbieBonusElement(container);
        return;
      }

      // Якщо немає жодного сервісу карток, використовуємо власну реалізацію
      this._renderNewbieBonusElement(container);
    } catch (error) {
      WinixRaffles.logger.error("Помилка створення елементу бонусу новачка:", error);
    }
  }

  /**
   * Рендеринг елементу бонусу новачка (резервний метод)
   * @param {HTMLElement} container - Контейнер для додавання
   * @private
   */
  _renderNewbieBonusElement(container) {
    const newbieBonus = document.createElement('div');
    newbieBonus.className = 'mini-raffle';
    newbieBonus.setAttribute('data-raffle-id', 'newbie');

    newbieBonus.innerHTML = `
      <div class="mini-raffle-info">
        <div class="mini-raffle-title">Бонус новачка</div>
        <div class="mini-raffle-cost">
          <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
          <span>0 жетонів</span>
        </div>
        <div class="mini-raffle-prize">500 WINIX + 1 жетон</div>
        <div class="mini-raffle-time">Доступно тільки новим користувачам</div>
      </div>
      <button class="mini-raffle-button" data-raffle-id="newbie">Отримати</button>
    `;

    const button = newbieBonus.querySelector('.mini-raffle-button');
    if (button) {
      button.addEventListener('click', async (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Перевіряємо, чи ми онлайн
        if (!this._isOnline()) {
          const uiComponents = WinixRaffles.getModule('uiComponents');
          if (uiComponents && uiComponents.helpers) {
            uiComponents.helpers.showToast("Неможливо отримати бонус без підключення до Інтернету", "error");
          } else if (WinixRaffles.utils && WinixRaffles.utils.showToast) {
            WinixRaffles.utils.showToast("Неможливо отримати бонус без підключення до Інтернету", "error");
          }
          return;
        }

        // Генеруємо подію для отримання бонусу новачка
        WinixRaffles.events.emit('claim-newbie-bonus', {
          element: button,
          container: newbieBonus
        });
      });
    }

    container.appendChild(newbieBonus);

    // Перевіряємо, чи вже отримано бонус
    this._checkNewbieBonusStatus(button, newbieBonus);
  }

  /**
   * Перевірка статусу бонусу новачка
   * @param {HTMLElement} button - Кнопка бонусу
   * @param {HTMLElement} container - Контейнер бонусу
   * @private
   */
  async _checkNewbieBonusStatus(button, container) {
    try {
      // Спочатку перевіряємо статус в localStorage
      const newbieBonusClaimed = localStorage.getItem('newbie_bonus_claimed') === 'true';

      if (newbieBonusClaimed) {
        this._markNewbieBonusClaimed(button, container);
        return;
      }

      // Потім перевіряємо через API
      const apiService = WinixRaffles.getModule('api');
      if (apiService && typeof apiService.getUserData === 'function') {
        try {
          const userData = await apiService.getUserData();
          if (userData && userData.data && userData.data.newbie_bonus_claimed) {
            this._markNewbieBonusClaimed(button, container);
            // Зберігаємо статус в localStorage
            localStorage.setItem('newbie_bonus_claimed', 'true');
          }
        } catch (err) {
          WinixRaffles.logger.error("Помилка перевірки статусу бонусу:", err);
        }
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка перевірки статусу бонусу:", error);
    }
  }

  /**
   * Маркування бонусу новачка як отриманого
   * @param {HTMLElement} button - Кнопка бонусу
   * @param {HTMLElement} container - Контейнер бонусу
   * @private
   */
  _markNewbieBonusClaimed(button, container) {
    if (button) {
      button.textContent = 'Отримано';
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'default';
    }

    // Додаємо водяний знак, якщо є функція
    if (container) {
      const uiUtils = WinixRaffles.getModule('uiComponents');
      if (uiUtils && uiUtils.helpers && typeof uiUtils.helpers.markElement === 'function') {
        uiUtils.helpers.markElement(container);
      } else if (WinixRaffles.utils && typeof WinixRaffles.utils.markElement === 'function') {
        WinixRaffles.utils.markElement(container);
      } else if (typeof window.markElement === 'function') {
        window.markElement(container);
      }
    }
  }

  /**
   * Функція переключення вкладок
   * @param {string} tabName - Назва вкладки для активації
   */
  switchTab(tabName) {
    if (!tabName) {
      WinixRaffles.logger.error("Назва вкладки не вказана");
      return;
    }

    WinixRaffles.logger.log(`Переключення на вкладку ${tabName}`);

    try {
      // Оновлюємо активну вкладку
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabSections = document.querySelectorAll('.tab-content');

      // Знімаємо активний стан з усіх вкладок і секцій
      if (tabButtons && tabButtons.length > 0) {
        tabButtons.forEach(btn => {
          if (btn) btn.classList.remove('active');
        });
      }

      if (tabSections && tabSections.length > 0) {
        tabSections.forEach(section => {
          if (section) section.classList.remove('active');
        });
      }

      // Додаємо активний стан до вибраної вкладки і секції
      const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
      const activeTabSection = document.getElementById(`${tabName}-raffles`);

      if (activeTabButton) activeTabButton.classList.add('active');
      if (activeTabSection) activeTabSection.classList.add('active');

      // Генеруємо подію про зміну вкладки
      WinixRaffles.events.emit('tab-switched', { tab: tabName });

      // Обробляємо різні типи вкладок
      if (tabName === 'past' || tabName === 'history') {
        // Вкладка історії
        WinixRaffles.events.emit('history-tab-requested', {});
      } else if (tabName === 'active') {
        // Вкладка активних розіграшів
        if (this._isOnline()) {
          this.displayRaffles();
        } else {
          this.displayOfflineData();
        }
      } else if (tabName === 'stats') {
        // Вкладка статистики
        if (!this._isOnline()) {
          const uiComponents = WinixRaffles.getModule('uiComponents');
          if (uiComponents && uiComponents.helpers) {
            uiComponents.helpers.showToast("Статистика недоступна без підключення до Інтернету", "warning");
          } else if (WinixRaffles.utils && WinixRaffles.utils.showToast) {
            WinixRaffles.utils.showToast("Статистика недоступна без підключення до Інтернету", "warning");
          }
        }
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка при переключенні вкладок:", error);
    }
  }

  /**
   * Запуск таймерів для розіграшів
   * @private
   */
  _startRaffleTimers() {
    // Очищаємо існуючі таймери
    this._stopRaffleTimers();

    // Запускаємо оновлення таймерів кожну хвилину
    const interval = setInterval(() => this._updateRaffleTimers(), this.CONSTANTS.TIMER_UPDATE_INTERVAL);
    this.state.timerIntervals.push(interval);

    // Відразу запускаємо оновлення
    this._updateRaffleTimers();
  }

  /**
   * Зупинка таймерів
   * @private
   */
  _stopRaffleTimers() {
    if (this.state.timerIntervals && this.state.timerIntervals.length > 0) {
      this.state.timerIntervals.forEach(interval => {
        if (interval) {
          clearInterval(interval);
        }
      });
      this.state.timerIntervals = [];
    }
  }

  /**
   * Оновлення таймерів для розіграшів
   * @private
   */
  _updateRaffleTimers() {
    try {
      // Оновлюємо таймер головного розіграшу
      const daysElement = document.querySelector('#days');
      const hoursElement = document.querySelector('#hours');
      const minutesElement = document.querySelector('#minutes');

      if (daysElement && hoursElement && minutesElement &&
          this.state.activeRaffles &&
          Array.isArray(this.state.activeRaffles) &&
          this.state.activeRaffles.length > 0) {

        // Знаходимо основний розіграш
        const mainRaffle = this.state.activeRaffles.find(raffle => raffle && raffle.is_daily === false);

        if (mainRaffle && mainRaffle.end_time) {
          const now = new Date();
          const endTime = new Date(mainRaffle.end_time);

          // Перевіряємо, чи валідна дата
          if (!isNaN(endTime.getTime())) {
            const timeLeft = endTime - now;

            if (timeLeft > 0) {
              // Отримуємо форматер, якщо доступний
              const formatTimeLeft = WinixRaffles.utils?.formatTimeLeft ||
                ((time) => ({ days: '00', hours: '00', minutes: '00' }));

              const timeLeftData = formatTimeLeft(timeLeft);
              daysElement.textContent = timeLeftData.days;
              hoursElement.textContent = timeLeftData.hours;
              minutesElement.textContent = timeLeftData.minutes;
            } else {
              // Розіграш завершено
              daysElement.textContent = '00';
              hoursElement.textContent = '00';
              minutesElement.textContent = '00';

              // Оновлюємо дані тільки якщо ми онлайн
              if (this._isOnline()) {
                this.getActiveRaffles(true).then(() => {
                  this.displayRaffles();
                }).catch(err => {
                  WinixRaffles.logger.error("Помилка оновлення після завершення таймера:", err);
                });
              }
            }
          } else {
            daysElement.textContent = '00';
            hoursElement.textContent = '00';
            minutesElement.textContent = '00';
          }
        }
      }

      // Оновлюємо таймери міні-розіграшів
      this._updateMiniRaffleTimers();
    } catch (error) {
      WinixRaffles.logger.error("Критична помилка оновлення таймерів:", error);
    }
  }

  /**
   * Оновлення таймерів для міні-розіграшів
   * @private
   */
  _updateMiniRaffleTimers() {
    try {
      const miniRaffleTimeElements = document.querySelectorAll('.mini-raffle-time');

      if (miniRaffleTimeElements && miniRaffleTimeElements.length > 0 &&
          this.state.activeRaffles &&
          Array.isArray(this.state.activeRaffles) &&
          this.state.activeRaffles.length > 0) {

        // Знаходимо щоденні розіграші
        const dailyRaffles = this.state.activeRaffles.filter(raffle => raffle && raffle.is_daily === true);

        if (dailyRaffles.length > 0) {
          const miniRaffles = document.querySelectorAll('.mini-raffle');

          if (miniRaffles && miniRaffles.length > 0) {
            miniRaffles.forEach(raffleElement => {
              if (!raffleElement) return;

              const raffleId = raffleElement.getAttribute('data-raffle-id');
              const timeElement = raffleElement.querySelector('.mini-raffle-time');

              if (!timeElement || !raffleId || raffleId === 'newbie') return;

              const raffle = dailyRaffles.find(r => r && r.id === raffleId);
              if (!raffle || !raffle.end_time) return;

              const now = new Date();
              const endTime = new Date(raffle.end_time);

              // Перевіряємо, чи валідна дата
              if (!isNaN(endTime.getTime())) {
                const timeLeft = endTime - now;

                if (timeLeft > 0) {
                  // Отримуємо форматер, якщо доступний
                  const formatTimeLeft = WinixRaffles.utils?.formatTimeLeft ||
                    ((time, format) => ({ text: 'Час не визначено' }));

                  const timeLeftData = formatTimeLeft(timeLeft, 'short');
                  timeElement.textContent = `Залишилось: ${timeLeftData.text}`;
                } else {
                  timeElement.textContent = 'Завершується';

                  // Оновлюємо дані тільки якщо ми онлайн
                  if (this._isOnline()) {
                    this.getActiveRaffles(true).then(() => {
                      this.displayRaffles();
                    }).catch(err => {
                      WinixRaffles.logger.error("Помилка оновлення після завершення таймера міні-розіграшу:", err);
                    });
                  }
                }
              } else {
                timeElement.textContent = 'Час не визначено';
              }
            });
          }
        }
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка оновлення таймерів міні-розіграшів:", error);
    }
  }

  /**
   * Очищення всіх станів модуля
   */
  resetAllStates() {
    // Скидаємо прапорці
    this.state.isLoading = false;

    // Очищаємо таймаути
    if (this.state.loadingTimeoutId) {
      clearTimeout(this.state.loadingTimeoutId);
      this.state.loadingTimeoutId = null;
    }

    // Очищаємо інтервали таймерів
    this._stopRaffleTimers();

    // Приховуємо лоадери
    WinixRaffles.loader.hide('active-raffles');
    WinixRaffles.loader.hide('active-raffles-display');

    // Очищаємо активні запити через API
    const apiService = WinixRaffles.getModule('api');
    if (apiService && typeof apiService.forceCleanupRequests === 'function') {
      apiService.forceCleanupRequests();
    }

    WinixRaffles.logger.log("Примусове скидання всіх станів модуля активних розіграшів");
    return true;
  }

  /**
 * Публічний метод для оновлення даних
 * @param {boolean} [forceRefresh=false] Примусове оновлення
 * @returns {Promise<Array>} Масив активних розіграшів
 */
async refresh(forceRefresh = false) {
  try {
    const raffles = await this.getActiveRaffles(forceRefresh);
    await this.displayRaffles(raffles);
    return raffles;
  } catch (error) {
    WinixRaffles.logger.error("Помилка оновлення активних розіграшів:", error);
    throw error;
  }
}

  /**
   * Знищення модуля при вивантаженні сторінки
   */
  destroy() {
    try {
      // Зупиняємо таймери
      this._stopRaffleTimers();

      // Скидаємо стани
      this.resetAllStates();

      // Видаляємо обробники подій
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});

      // Відписуємося від подій
      WinixRaffles.events.off('raffle-participated', () => {});

      WinixRaffles.logger.log("Модуль активних розіграшів знищено");
    } catch (error) {
      WinixRaffles.logger.error("Помилка при знищенні модуля активних розіграшів:", error);
    }
  }
}

// Оновлений експортований об'єкт
const activeRafflesModule = {
  manager: null,

  /**
   * Ініціалізація модуля
   */
  init: async function() {
    // Створюємо менеджер активних розіграшів
    this.manager = new ActiveRafflesManager();

    // Ініціалізуємо менеджер
    await this.manager.init();

    // Експортуємо методи для зворотної сумісності в WinixRaffles.active
    WinixRaffles.active = {
      init: this.manager.init.bind(this.manager),
      getActiveRaffles: this.manager.getActiveRaffles.bind(this.manager),
      displayRaffles: this.manager.displayRaffles.bind(this.manager),
      displayOfflineData: this.manager.displayOfflineData.bind(this.manager),
      switchTab: this.manager.switchTab.bind(this.manager),
      resetAllStates: this.manager.resetAllStates.bind(this.manager),
      destroy: this.manager.destroy.bind(this.manager),
      refresh: this.manager.refresh.bind(this.manager)
    };

    // Реєструємо модуль в глобальній системі, якщо є метод registerModule
    if (typeof WinixRaffles.registerModule === 'function') {
      WinixRaffles.registerModule('active', {
        init: this.manager.init.bind(this.manager),
        refresh: this.manager.refresh.bind(this.manager),
        getActiveRaffles: this.manager.getActiveRaffles.bind(this.manager),
        displayRaffles: this.manager.displayRaffles.bind(this.manager),
        destroy: this.manager.destroy.bind(this.manager)
      });
    }

    return this;
  },

  /**
   * Метод оновлення даних
   * @param {boolean} [forceRefresh=false] Примусове оновлення
   * @returns {Promise<Array>} Масив активних розіграшів
   */
  refresh: function(forceRefresh = false) {
    if (this.manager) {
      return this.manager.refresh(forceRefresh);
    }
    return Promise.resolve([]);
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }
};

export default activeRafflesModule;