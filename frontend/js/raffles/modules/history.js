/**
 * Модуль для роботи з історією розіграшів WINIX
 * Оптимізована версія з пагінацією, покращеним кешуванням та стабільнішою взаємодією з API
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import { CONFIG } from '../config.js';


// Локальна конфігурація з використанням глобальної
const HISTORY_CONFIG = {
  // Розмір однієї сторінки історії
  PAGE_SIZE: CONFIG?.UI?.DEFAULT_PAGE_SIZE || 10,

  // Час зберігання даних у кеші (мс)
  CACHE_TTL: {
    HISTORY: CONFIG?.API?.CACHE_TTL?.HISTORY || 5 * 60 * 1000,      // 5 хвилин для історії
    DETAILS: CONFIG?.API?.CACHE_TTL?.HISTORY_DETAILS || 10 * 60 * 1000,     // 10 хвилин для деталей розіграшу
    STATS: CONFIG?.API?.CACHE_TTL?.STATISTICS || 15 * 60 * 1000       // 15 хвилин для статистики
  },

  // Мінімальний час між запитами (мс)
  MIN_REQUEST_INTERVAL: CONFIG?.API?.MIN_REQUEST_INTERVAL || 3 * 1000, // 3 секунди між запитами

  // Час охолодження після помилки 429 (мс)
  RATE_LIMIT_COOLDOWN: CONFIG?.API?.RATE_LIMIT_COOLDOWN || 60 * 1000  // 1 хвилина після досягнення ліміту запитів
};

// Клас для роботи з історією розіграшів
class HistoryModule {
  constructor() {
    // Стан модуля
    this.state = {
      loading: false,
      error: null,
      history: [],
      currentPage: 1,
      totalPages: 1,
      hasMore: false,
      filters: {
        type: 'all',
        status: 'all',
        period: 'all'
      },
      lastRequestTime: 0,
      detailsMap: new Map()
    };
  }

  /**
   * Ініціалізація модуля
   */
  init() {
    WinixRaffles.logger.log("Ініціалізація модуля історії розіграшів");

    // Відновлюємо кешовані дані
    this._loadCachedData();

    // Підписуємося на події
    this._setupEventListeners();

    WinixRaffles.logger.log("Модуль історії розіграшів успішно ініціалізовано");
    return this;
  }

  /**
   * Встановлення обробників подій
   * @private
   */
  _setupEventListeners() {
    // Підписуємося на подію запиту вкладки історії
    WinixRaffles.events.on('history-tab-requested', () => {
      this.displayHistory('history-container');
    });

    // Підписуємося на подію запиту оновлення історії
    WinixRaffles.events.on('refresh-history', (data) => {
      const containerId = data && data.containerId ? data.containerId : 'history-container';
      this.displayHistory(containerId, true);
    });

    // Реакція на зміну мережевого стану
    window.addEventListener('online', () => {
      WinixRaffles.logger.log("Мережеве з'єднання відновлено, історія доступна");
    });

    window.addEventListener('offline', () => {
      WinixRaffles.logger.warn("Мережеве з'єднання втрачено, історія може бути недоступна");
    });
  }

  /**
   * Завантаження кешованих даних
   * @private
   */
  _loadCachedData() {
    // Спробуємо відновити дані з кешу системи
    const cachedHistory = WinixRaffles.cache.get('history_data');
    if (cachedHistory) {
      this.state.history = cachedHistory;
      WinixRaffles.logger.log(`Відновлено ${cachedHistory.length} записів історії з кешу`);
    } else {
      // Якщо немає в системному кеші, пробуємо з localStorage (для зворотної сумісності)
      try {
        const localStorageHistory = localStorage.getItem('winix_raffles_history');
        if (localStorageHistory) {
          const parsedHistory = JSON.parse(localStorageHistory);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            this.state.history = parsedHistory;
            // Зберігаємо в новий кеш
            WinixRaffles.cache.set('history_data', parsedHistory, CONFIG.CACHE_TTL.HISTORY);
            WinixRaffles.logger.log(`Відновлено ${parsedHistory.length} записів історії з localStorage`);
          }
        }
      } catch (error) {
        WinixRaffles.logger.warn("Помилка відновлення історії з localStorage:", error);
      }
    }

    // Відновлюємо деталі розіграшів (якщо є)
    const cachedDetails = WinixRaffles.cache.get('history_details_map');
    if (cachedDetails) {
      this.state.detailsMap = new Map(cachedDetails);
      WinixRaffles.logger.log(`Відновлено деталі для ${this.state.detailsMap.size} розіграшів з кешу`);
    }
  }

  /**
   * Збереження даних в кеш
   * @param {Array} history - Дані історії
   * @private
   */
  _cacheData(history) {
    if (!Array.isArray(history)) return;

    // Зберігаємо в системний кеш
    WinixRaffles.cache.set('history_data', history, CONFIG.CACHE_TTL.HISTORY);

    // Зберігаємо також у localStorage для зворотної сумісності
    try {
      localStorage.setItem('winix_raffles_history', JSON.stringify(history));
    } catch (error) {
      WinixRaffles.logger.warn("Помилка збереження історії в localStorage:", error);
    }
  }

  /**
   * Збереження деталей розіграшу в кеш
   * @param {string} raffleId - ID розіграшу
   * @param {Object} details - Деталі розіграшу
   * @private
   */
  _cacheRaffleDetails(raffleId, details) {
    if (!raffleId || !details) return;

    // Оновлюємо локальну Map
    this.state.detailsMap.set(raffleId, {
      data: details,
      timestamp: Date.now()
    });

    // Зберігаємо Map в кеш
    WinixRaffles.cache.set(
      'history_details_map',
      Array.from(this.state.detailsMap.entries()),
      CONFIG.CACHE_TTL.DETAILS
    );
  }

  /**
   * Перевірка чи можна виконати запит (обмеження частоти)
   * @returns {boolean} Чи можна виконати запит
   * @private
   */
  _canMakeRequest() {
    const now = Date.now();
    return (now - this.state.lastRequestTime) >= CONFIG.MIN_REQUEST_INTERVAL;
  }

  /**
   * Оновлення часу останнього запиту
   * @private
   */
  _updateRequestTime() {
    this.state.lastRequestTime = Date.now();
  }

  /**
   * Обробка помилки обмеження частоти запитів (429)
   * @param {string} containerId - ID контейнера для відображення
   * @private
   */
  _handleRateLimitError(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    WinixRaffles.logger.warn("Досягнуто ліміту запитів до API історії");

    // Блокуємо запити на певний час
    this.state.lastRequestTime = Date.now() + CONFIG.RATE_LIMIT_COOLDOWN;

    // Показуємо повідомлення користувачу
    container.innerHTML = `
      <div class="rate-limit-message">
        <div class="rate-limit-icon">⏱️</div>
        <h3>Зачекайте, будь ласка</h3>
        <p>Перевищено ліміт запитів. Спробуйте знову через хвилину.</p>
        <div class="retry-timer">Доступно через: <span id="retry-countdown">60</span> секунд</div>
      </div>
    `;

    // Додаємо зворотний відлік
    let countdown = 60;
    const countdownElement = document.getElementById('retry-countdown');

    if (countdownElement) {
      const timer = setInterval(() => {
        countdown--;
        if (countdownElement) countdownElement.textContent = countdown;

        if (countdown <= 0) {
          clearInterval(timer);
          // Дозволяємо спробувати знову
          if (container) {
            container.innerHTML = `
              <div class="empty-history">
                <div class="empty-history-icon">📋</div>
                <h3>Готово до оновлення</h3>
                <p>Тепер ви можете спробувати отримати історію знову</p>
                <button class="refresh-history-btn" onclick="WinixRaffles.history.displayHistory('${containerId}', true)">
                  <span class="refresh-icon">🔄</span> Оновити
                </button>
              </div>
            `;
          }
        }
      }, 1000);
    }

    // Показуємо повідомлення користувачу
    WinixRaffles.utils.showToast(
      "Перевищено ліміт запитів. Зачекайте хвилину і спробуйте знову.",
      "warning",
      5000
    );
  }

  /**
   * Отримання історії розіграшів з пагінацією
   * @param {Object} options - Опції запиту
   * @returns {Promise<Object>} Об'єкт з даними історії та метаданими пагінації
   */
  async getHistory(options = {}) {
    const page = options.page || 1;
    const pageSize = options.pageSize || CONFIG.PAGE_SIZE;
    const filters = options.filters || {};
    const forceRefresh = options.forceRefresh || false;

    try {
      // Перевіряємо, чи пристрій онлайн
      if (!WinixRaffles.network.isOnline()) {
        WinixRaffles.logger.warn("Пристрій офлайн, використовуємо кешовані дані історії");
        return {
          data: this.state.history || [],
          page: 1,
          totalPages: 1,
          hasMore: false,
          isOffline: true
        };
      }

      // Перевірка можливості виконання запиту
      if (!this._canMakeRequest() && !forceRefresh) {
        WinixRaffles.logger.warn("Занадто частий запит історії, використовуємо кешовані дані");
        return {
          data: this.state.history || [],
          page,
          totalPages: Math.ceil((this.state.history?.length || 0) / pageSize),
          hasMore: page * pageSize < (this.state.history?.length || 0),
          fromCache: true
        };
      }

      // Оновлюємо час останнього запиту
      this._updateRequestTime();

      // Встановлюємо стан завантаження
      this.state.loading = true;

      // Показуємо індикатор завантаження
      WinixRaffles.loader.show("Завантаження історії...", "history-fetch");

      // Виконуємо запит до API
      const userId = api.getUserId();
      if (!userId) {
        throw new Error("ID користувача не знайдено");
      }

      // Перед запитом спробуємо оновити токен
      if (typeof api.refreshToken === 'function') {
        await api.refreshToken().catch(e => {
          WinixRaffles.logger.warn("Помилка оновлення токену:", e);
        });
      }

      // Формуємо параметри запиту
      const queryParams = [];
      if (filters.type && filters.type !== 'all') {
        queryParams.push(`type=${filters.type}`);
      }

      if (filters.status && filters.status !== 'all') {
        queryParams.push(`status=${filters.status}`);
      }

      if (filters.period && filters.period !== 'all') {
        queryParams.push(`period=${filters.period}`);
      }

      // Додаємо параметри пагінації
      queryParams.push(`page=${page}`);
      queryParams.push(`page_size=${pageSize}`);

      // Формуємо URL
      const url = `user/${userId}/raffles-history${queryParams.length ? '?' + queryParams.join('&') : ''}`;

      // Виконуємо запит
      const response = await api.apiRequest(url, 'GET', null, {
        timeout: 15000,
        suppressErrors: true
      });

      // Приховуємо індикатор завантаження
      WinixRaffles.loader.hide("history-fetch");

      // Скидаємо стан завантаження
      this.state.loading = false;

      // Перевіряємо відповідь
      if (response.status === 'success') {
        // Перевіряємо формат даних
        let historyData = [];
        let pagination = {
          page: page,
          totalPages: 1,
          hasMore: false
        };

        // Обробка формату відповіді - API може повертати дані у різних форматах
        if (Array.isArray(response.data)) {
          // Простий масив записів
          historyData = response.data;
        } else if (response.data && typeof response.data === 'object') {
          // Об'єкт з масивом даних та інформацією про пагінацію
          if (Array.isArray(response.data.items || response.data.data)) {
            historyData = response.data.items || response.data.data;

            // Отримуємо дані пагінації, якщо вони є
            if (response.data.pagination) {
              pagination = {
                page: response.data.pagination.current_page || page,
                totalPages: response.data.pagination.total_pages || 1,
                hasMore: response.data.pagination.has_more === true
              };
            } else if (response.data.meta) {
              pagination = {
                page: response.data.meta.current_page || page,
                totalPages: response.data.meta.total_pages || 1,
                hasMore: response.data.meta.has_more === true ||
                         (response.data.meta.current_page < response.data.meta.total_pages)
              };
            }
          } else {
            // Якщо немає items або data, використовуємо сам об'єкт response.data
            historyData = [response.data];
          }
        }

        // Якщо це перша сторінка і примусове оновлення, замінюємо всю історію
        if (page === 1 && forceRefresh) {
          this.state.history = historyData;
        }
        // Інакше додаємо дані до існуючої історії (для пагінації)
        else if (page > 1) {
          // Видаляємо дублікати за ID розіграшу
          const existingIds = new Set(this.state.history.map(item => item.raffle_id));
          const newItems = historyData.filter(item => !existingIds.has(item.raffle_id));

          this.state.history = [...this.state.history, ...newItems];
        } else if (page === 1 && this.state.history.length === 0) {
          // Якщо це перша сторінка і історія порожня
          this.state.history = historyData;
        }

        // Оновлюємо стан пагінації
        this.state.currentPage = pagination.page;
        this.state.totalPages = pagination.totalPages;
        this.state.hasMore = pagination.hasMore;

        // Кешуємо отримані дані
        if (this.state.history.length > 0) {
          this._cacheData(this.state.history);
        }

        // Відправляємо подію про оновлення історії
        WinixRaffles.events.emit('history-updated', {
          count: this.state.history.length,
          page: pagination.page,
          totalPages: pagination.totalPages,
          hasMore: pagination.hasMore
        });

        // Повертаємо результат
        return {
          data: page === 1 ? historyData : this.state.history,
          page: pagination.page,
          totalPages: pagination.totalPages,
          hasMore: pagination.hasMore
        };
      } else if (response.status === 'error') {
        // Спеціальна обробка для помилки перевищення ліміту запитів
        if (response.code === 429 || (response.message && response.message.includes('many requests'))) {
          this._handleRateLimitError('history-container');

          // Повертаємо кешовані дані
          return {
            data: this.state.history || [],
            page,
            totalPages: Math.ceil((this.state.history?.length || 0) / pageSize),
            hasMore: false,
            fromCache: true,
            rateLimited: true
          };
        }

        throw new Error(response.message || 'Помилка отримання історії');
      }

      throw new Error('Невідома помилка отримання історії');
    } catch (error) {
      // Приховуємо індикатор завантаження
      WinixRaffles.loader.hide("history-fetch");

      // Скидаємо стан завантаження
      this.state.loading = false;

      // Зберігаємо помилку в стані
      this.state.error = error.message || 'Помилка завантаження історії';

      WinixRaffles.logger.error("Помилка отримання історії розіграшів:", error);

      // Якщо є кешовані дані, повертаємо їх
      return {
        data: this.state.history || [],
        page,
        totalPages: Math.ceil((this.state.history?.length || 0) / pageSize),
        hasMore: false,
        fromCache: true,
        error: this.state.error
      };
    }
  }

  /**
   * Отримання деталей конкретного розіграшу
   * @param {string} raffleId - ID розіграшу
   * @returns {Promise<Object>} Деталі розіграшу
   */
  async getRaffleDetails(raffleId) {
    if (!raffleId) {
      throw new Error("ID розіграшу не вказано");
    }

    try {
      // Перевіряємо, чи пристрій онлайн
      if (!WinixRaffles.network.isOnline()) {
        // Перевіряємо кеш деталей
        if (this.state.detailsMap.has(raffleId)) {
          const cachedDetails = this.state.detailsMap.get(raffleId);
          return cachedDetails.data;
        }

        // Шукаємо в історії
        const raffleFromHistory = this.state.history.find(item => item.raffle_id === raffleId);
        if (raffleFromHistory) {
          return raffleFromHistory;
        }

        throw new Error("Деталі розіграшу недоступні в режимі офлайн");
      }

      // Перевіряємо кеш деталей
      if (this.state.detailsMap.has(raffleId)) {
        const cachedDetails = this.state.detailsMap.get(raffleId);
        const now = Date.now();

        // Якщо дані не застарілі, повертаємо їх
        if (now - cachedDetails.timestamp < CONFIG.CACHE_TTL.DETAILS) {
          return cachedDetails.data;
        }
      }

      // Перевірка можливості виконання запиту
      if (!this._canMakeRequest()) {
        // Якщо є в кеші, повертаємо без перевірки TTL
        if (this.state.detailsMap.has(raffleId)) {
          return this.state.detailsMap.get(raffleId).data;
        }

        // Шукаємо в історії
        const raffleFromHistory = this.state.history.find(item => item.raffle_id === raffleId);
        if (raffleFromHistory) {
          return raffleFromHistory;
        }

        throw new Error("Занадто багато запитів. Спробуйте пізніше.");
      }

      // Оновлюємо час останнього запиту
      this._updateRequestTime();

      // Виконуємо запит до API
      const userId = api.getUserId();
      if (!userId) {
        throw new Error("ID користувача не знайдено");
      }

      // Перед запитом спробуємо оновити токен
      if (typeof api.refreshToken === 'function') {
        await api.refreshToken().catch(e => {
          WinixRaffles.logger.warn("Помилка оновлення токену:", e);
        });
      }

      // Показуємо індикатор завантаження
      WinixRaffles.loader.show("Завантаження деталей розіграшу...", `raffle-details-${raffleId}`);

      // Виконуємо запит
      const response = await api.apiRequest(`user/${userId}/raffles-history/${raffleId}`, 'GET', null, {
        timeout: 10000,
        suppressErrors: true
      });

      // Приховуємо індикатор завантаження
      WinixRaffles.loader.hide(`raffle-details-${raffleId}`);

      // Перевіряємо відповідь
      if (response.status === 'success') {
        const details = response.data;

        // Кешуємо деталі
        this._cacheRaffleDetails(raffleId, details);

        // Оновлюємо історію, якщо розіграш є в ній
        this.state.history = this.state.history.map(item => {
          if (item.raffle_id === raffleId) {
            return { ...item, ...details };
          }
          return item;
        });

        // Кешуємо оновлену історію
        this._cacheData(this.state.history);

        return details;
      } else if (response.status === 'error') {
        throw new Error(response.message || 'Помилка отримання деталей розіграшу');
      }

      throw new Error('Невідома помилка отримання деталей розіграшу');
    } catch (error) {
      // Приховуємо індикатор завантаження
      WinixRaffles.loader.hide(`raffle-details-${raffleId}`);

      WinixRaffles.logger.error(`Помилка отримання деталей розіграшу ${raffleId}:`, error);

      // Шукаємо в історії
      const raffleFromHistory = this.state.history.find(item => item.raffle_id === raffleId);
      if (raffleFromHistory) {
        // Зберігаємо в кеш, щоб не робити повторних спроб
        this._cacheRaffleDetails(raffleId, raffleFromHistory);
        return raffleFromHistory;
      }

      // Якщо нічого не знайдено, повертаємо базову структуру
      return {
        raffle_id: raffleId,
        title: "Деталі недоступні",
        status: "unknown",
        error: error.message
      };
    }
  }

  /**
   * Отримання статистики участі в розіграшах
   * @param {boolean} forceRefresh - Примусове оновлення
   * @returns {Promise<Object>} Статистика участі
   */
  async getStatistics(forceRefresh) {
    try {
      // Спочатку перевіряємо кеш
      const cachedStats = WinixRaffles.cache.get('history_statistics');
      if (!forceRefresh && cachedStats) {
        return cachedStats;
      }

      // Якщо офлайн, рахуємо з кешованої історії
      if (!WinixRaffles.network.isOnline()) {
        return this._calculateStatsFromHistory(this.state.history);
      }

      // Якщо примусове оновлення, завантажуємо свіжу історію
      if (forceRefresh) {
        await this.getHistory({ forceRefresh: true });
      } else if (this.state.history.length === 0) {
        // Якщо історія порожня, завантажуємо її
        await this.getHistory();
      }

      // Рахуємо статистику з історії
      const stats = this._calculateStatsFromHistory(this.state.history);

      // Кешуємо статистику
      WinixRaffles.cache.set('history_statistics', stats, CONFIG.CACHE_TTL.STATS);

      return stats;
    } catch (error) {
      WinixRaffles.logger.error("Помилка отримання статистики:", error);

      // У випадку помилки повертаємо базову статистику
      return {
        totalParticipations: this.state.history.length || 0,
        totalWins: this.state.history.filter(item => item.status === 'won').length || 0,
        totalTokensSpent: 0,
        totalPrizeAmount: 0,
        error: error.message
      };
    }
  }

  /**
   * Розрахунок статистики з історії
   * @param {Array} history - Дані історії
   * @returns {Object} Розрахована статистика
   * @private
   */
  _calculateStatsFromHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return {
        totalParticipations: 0,
        totalWins: 0,
        totalTokensSpent: 0,
        totalPrizeAmount: 0
      };
    }

    try {
      // Фільтруємо виграшні розіграші
      const wonRaffles = history.filter(item => item && item.status === 'won');

      // Рахуємо загальну кількість витрачених жетонів
      let totalTokensSpent = 0;
      history.forEach(item => {
        if (item && item.entry_count) {
          totalTokensSpent += parseInt(item.entry_count) || 0;
        }
      });

      // Рахуємо загальну суму виграшів
      let totalPrizeAmount = 0;
      wonRaffles.forEach(item => {
        if (item && item.prize) {
          // Спроба витягнути числове значення з рядка призу
          const prizeMatch = item.prize.match(/(\d+(?:\.\d+)?)/);
          if (prizeMatch && prizeMatch[1]) {
            totalPrizeAmount += parseFloat(prizeMatch[1]) || 0;
          }
        }
      });

      return {
        totalParticipations: history.length,
        totalWins: wonRaffles.length,
        totalTokensSpent,
        totalPrizeAmount
      };
    } catch (error) {
      WinixRaffles.logger.error("Помилка розрахунку статистики:", error);

      return {
        totalParticipations: history.length,
        totalWins: history.filter(item => item.status === 'won').length,
        totalTokensSpent: 0,
        totalPrizeAmount: 0,
        error: error.message
      };
    }
  }

  /**
   * Відображення історії розіграшів
   * @param {string} containerId - ID контейнера для відображення
   * @param {boolean} forceRefresh - Примусове оновлення
   */
  async displayHistory(containerId, forceRefresh) {
    // Встановлюємо значення за замовчуванням
    containerId = containerId || 'history-container';
    forceRefresh = !!forceRefresh;

    const container = document.getElementById(containerId);
    if (!container) {
      WinixRaffles.logger.error(`Контейнер з ID '${containerId}' не знайдено`);
      return;
    }

    try {
      // Додаємо сітку статистики
      this._addStatsGrid(container);

      // Показуємо індикатор завантаження, якщо немає даних або потрібне оновлення
      if (this.state.history.length === 0 || forceRefresh) {
        container.innerHTML = `
          <div class="loading-placeholder">
            <div class="loading-spinner"></div>
            <div class="loading-text">Завантаження історії...</div>
            <div class="loading-subtext">Зачекайте, будь ласка</div>
          </div>
        `;
      }

      // Отримуємо нову історію для першої сторінки
      const result = await this.getHistory({
        page: 1,
        filters: this.state.filters,
        forceRefresh
      });

      // Якщо пристрій офлайн і немає кешованих даних
      if (result.isOffline && result.data.length === 0) {
        container.innerHTML = this._createEmptyHistoryHTML("Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову.");
        return;
      }

      // Якщо дані відсутні або порожні
      if (result.data.length === 0) {
        container.innerHTML = this._createEmptyHistoryHTML();

        // Оновлюємо статистику з нулями
        this._updateStatistics({
          totalParticipations: 0,
          totalWins: 0,
          totalTokensSpent: 0,
          totalPrizeAmount: 0
        });
        return;
      }

      // Отримуємо статистику
      const stats = await this.getStatistics(forceRefresh);

      // Розділяємо історію на виграшні розіграші та звичайні участі
      const wonRaffles = result.data.filter(item => item && item.status === 'won');
      const participatedRaffles = result.data.filter(item => item && item.status !== 'won');

      // Створюємо HTML для відображення
      let historyHTML = `
        <div class="history-filters">
          <div class="filter-group">
            <label>Тип:</label>
            <select id="history-type-filter">
              <option value="all"${this.state.filters.type === 'all' ? ' selected' : ''}>Усі типи</option>
              <option value="daily"${this.state.filters.type === 'daily' ? ' selected' : ''}>Щоденні</option>
              <option value="main"${this.state.filters.type === 'main' ? ' selected' : ''}>Джекпоти</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Статус:</label>
            <select id="history-status-filter">
              <option value="all"${this.state.filters.status === 'all' ? ' selected' : ''}>Усі статуси</option>
              <option value="won"${this.state.filters.status === 'won' ? ' selected' : ''}>Перемоги</option>
              <option value="participated"${this.state.filters.status === 'participated' ? ' selected' : ''}>Участь</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Період:</label>
            <select id="history-period-filter">
              <option value="all"${this.state.filters.period === 'all' ? ' selected' : ''}>Весь час</option>
              <option value="week"${this.state.filters.period === 'week' ? ' selected' : ''}>Тиждень</option>
              <option value="month"${this.state.filters.period === 'month' ? ' selected' : ''}>Місяць</option>
              <option value="year"${this.state.filters.period === 'year' ? ' selected' : ''}>Рік</option>
            </select>
          </div>
          <button id="refresh-history-btn" class="refresh-btn">
            <span class="refresh-icon">🔄</span>
          </button>
        </div>

        <div class="history-stats">
          <div class="stats-item">
            <div class="stats-value">${stats.totalParticipations}</div>
            <div class="stats-label">Всього розіграшів</div>
          </div>
          <div class="stats-item">
            <div class="stats-value">${stats.totalWins}</div>
            <div class="stats-label">Перемог</div>
          </div>
          <div class="stats-item">
            <div class="stats-value">${stats.totalPrizeAmount.toFixed(2)} WINIX</div>
            <div class="stats-label">WINIX виграно</div>
          </div>
        </div>
      `;

      // Додаємо секцію "Мої перемоги" якщо є виграші
      if (wonRaffles.length > 0) {
        historyHTML += `
          <div class="history-section">
            <h3 class="section-title">Мої перемоги</h3>
            <div class="history-cards">
              ${wonRaffles.map(raffle => this._createHistoryCardHTML(raffle)).join('')}
            </div>
          </div>
        `;
      }

      // Додаємо секцію участі
      historyHTML += `
        <div class="history-section">
          <h3 class="section-title">Історія участі</h3>
          <div class="history-cards">
            ${participatedRaffles.length > 0 
              ? participatedRaffles.map(raffle => this._createHistoryCardHTML(raffle)).join('')
              : '<div class="empty-history-section">У вас поки немає участі в розіграшах</div>'}
          </div>
        </div>
      `;

      // Додаємо кнопку "Завантажити більше", якщо є наступні сторінки
      if (result.hasMore) {
        historyHTML += `
          <div class="load-more-container">
            <button id="load-more-history" class="load-more-btn">
              Завантажити ще
            </button>
          </div>
        `;
      }

      // Вставляємо HTML в контейнер
      container.innerHTML = historyHTML;

      // Додаємо обробники подій для фільтрів
      this._setupFilterEventListeners(containerId);

      // Додаємо обробник для кнопки "Завантажити більше"
      const loadMoreBtn = document.getElementById('load-more-history');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          this._loadMoreHistory(containerId);
        });
      }

      // Оновлюємо статистику
      this._updateStatistics(stats);

      // Додаємо обробники подій для карток історії
      this._setupHistoryCardEventListeners(container);

      // Відправляємо подію про відображення історії
      WinixRaffles.events.emit('history-displayed', {
        total: result.data.length,
        wins: wonRaffles.length,
        participated: participatedRaffles.length
      });
    } catch (error) {
      WinixRaffles.logger.error("Помилка відображення історії:", error);

      // Визначаємо тип повідомлення про помилку
      let errorMessage = !WinixRaffles.network.isOnline()
        ? "Немає з'єднання з Інтернетом. Перевірте підключення та спробуйте знову."
        : "Щось пішло не так. Спробуйте оновити сторінку.";

      container.innerHTML = this._createEmptyHistoryHTML(errorMessage);
    }
  }

  /**
 * Публічний метод для оновлення даних історії
 * @param {boolean} [forceRefresh=false] Примусове оновлення
 * @returns {Promise<Array>} Історія розіграшів
 */
async refresh(forceRefresh = false) {
  try {
    WinixRaffles.logger.log("Оновлення історії розіграшів");

    // Очищуємо кеш якщо потрібне примусове оновлення
    if (forceRefresh) {
      this.clearCache();
    }

    // Отримуємо оновлену історію
    const history = await this.getRafflesHistory({}, forceRefresh);

    // Якщо відображення активне, оновлюємо його
    const historyContainer = document.getElementById('history-container');
    if (historyContainer && historyContainer.offsetParent !== null) {
      await this.displayHistory('history-container', forceRefresh);
    }

    return history;
  } catch (error) {
    WinixRaffles.logger.error("Помилка оновлення історії розіграшів:", error);
    throw error;
  }
}

  /**
   * Завантаження наступної сторінки історії
   * @param {string} containerId - ID контейнера для відображення
   * @private
   */
  async _loadMoreHistory(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // Замінюємо кнопку "Завантажити ще" на індикатор завантаження
      const loadMoreContainer = container.querySelector('.load-more-container');
      if (loadMoreContainer) {
        loadMoreContainer.innerHTML = `
          <div class="loading-spinner-small"></div>
          <div class="loading-text-small">Завантаження...</div>
        `;
      }

      // Завантажуємо наступну сторінку
      const nextPage = this.state.currentPage + 1;
      const result = await this.getHistory({
        page: nextPage,
        filters: this.state.filters
      });

      // Отримуємо всі контейнери карток
      const historyCards = container.querySelectorAll('.history-cards');

      // Додаємо нові картки в відповідні розділи
      if (result.data.length > 0) {
        // Розділяємо дані на виграшні та звичайні
        const newWonRaffles = result.data.filter(item =>
          item && item.status === 'won' &&
          !document.querySelector(`.history-card[data-raffle-id="${item.raffle_id}"]`)
        );

        const newParticipatedRaffles = result.data.filter(item =>
          item && item.status !== 'won' &&
          !document.querySelector(`.history-card[data-raffle-id="${item.raffle_id}"]`)
        );

        // Додаємо нові виграші в перший контейнер
        if (newWonRaffles.length > 0 && historyCards.length > 0) {
          const wonContainer = historyCards[0];
          newWonRaffles.forEach(raffle => {
            const cardHTML = this._createHistoryCardHTML(raffle);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHTML;
            const card = tempDiv.firstElementChild;
            wonContainer.appendChild(card);
          });
        }

        // Додаємо нові участі в другий контейнер
        if (newParticipatedRaffles.length > 0) {
          const participatedContainer = historyCards[historyCards.length - 1];

          // Видаляємо повідомлення "У вас поки немає участі в розіграшах", якщо воно є
          const emptySection = participatedContainer.querySelector('.empty-history-section');
          if (emptySection) {
            emptySection.remove();
          }

          newParticipatedRaffles.forEach(raffle => {
            const cardHTML = this._createHistoryCardHTML(raffle);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHTML;
            const card = tempDiv.firstElementChild;
            participatedContainer.appendChild(card);
          });
        }
      }

      // Оновлюємо або видаляємо контейнер "Завантажити ще"
      if (loadMoreContainer) {
        if (result.hasMore) {
          loadMoreContainer.innerHTML = `
            <button id="load-more-history" class="load-more-btn">
              Завантажити ще
            </button>
          `;

          // Додаємо обробник для нової кнопки
          const loadMoreBtn = document.getElementById('load-more-history');
          if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
              this._loadMoreHistory(containerId);
            });
          }
        } else {
          // Якщо більше немає даних, видаляємо контейнер
          loadMoreContainer.remove();
        }
      }

      // Додаємо обробники подій для нових карток
      this._setupHistoryCardEventListeners(container);
    } catch (error) {
      WinixRaffles.logger.error("Помилка завантаження додаткової історії:", error);

      // Відновлюємо кнопку "Завантажити ще"
      const loadMoreContainer = container.querySelector('.load-more-container');
      if (loadMoreContainer) {
        loadMoreContainer.innerHTML = `
          <button id="load-more-history" class="load-more-btn">
            Завантажити ще
          </button>
          <div class="error-text">Помилка завантаження</div>
        `;

        // Додаємо обробник для кнопки
        const loadMoreBtn = document.getElementById('load-more-history');
        if (loadMoreBtn) {
          loadMoreBtn.addEventListener('click', () => {
            this._loadMoreHistory(containerId);
          });
        }
      }

      // Показуємо повідомлення про помилку
      WinixRaffles.utils.showToast(
        "Не вдалося завантажити додаткові дані. Спробуйте ще раз.",
        "error"
      );
    }
  }

  /**
   * Налаштування обробників подій для фільтрів
   * @param {string} containerId - ID контейнера для відображення
   * @private
   */
  _setupFilterEventListeners(containerId) {
    // Обробники для фільтрів
    const typeFilter = document.getElementById('history-type-filter');
    const statusFilter = document.getElementById('history-status-filter');
    const periodFilter = document.getElementById('history-period-filter');
    const refreshBtn = document.getElementById('refresh-history-btn');

    // Функція для застосування фільтрів
    const applyFilters = async () => {
      if (!WinixRaffles.network.isOnline()) {
        WinixRaffles.utils.showToast(
          "Фільтрація недоступна в режимі офлайн",
          "warning"
        );
        return;
      }

      // Оновлюємо фільтри в стані
      this.state.filters = {
        type: typeFilter?.value || 'all',
        status: statusFilter?.value || 'all',
        period: periodFilter?.value || 'all'
      };

      // Оновлюємо відображення
      await this.displayHistory(containerId, true);
    };

    // Додаємо обробники подій
    if (typeFilter) typeFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (periodFilter) periodFilter.addEventListener('change', applyFilters);

    // Обробник для кнопки оновлення
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        if (!WinixRaffles.network.isOnline()) {
          WinixRaffles.utils.showToast(
            "Оновлення недоступне в режимі офлайн",
            "warning"
          );
          return;
        }

        await this.displayHistory(containerId, true);
      });
    }
  }

  /**
   * Налаштування обробників подій для карток історії
   * @param {HTMLElement} container - Контейнер з картками
   * @private
   */
  _setupHistoryCardEventListeners(container) {
    const historyCards = container.querySelectorAll('.history-card');

    historyCards.forEach(card => {
      card.addEventListener('click', async () => {
        const raffleId = card.getAttribute('data-raffle-id');
        if (!raffleId) return;

        try {
          // Показуємо індикатор завантаження
          WinixRaffles.loader.show("Завантаження деталей...", `card-${raffleId}`);

          // Отримуємо деталі розіграшу
          const details = await this.getRaffleDetails(raffleId);

          // Приховуємо індикатор завантаження
          WinixRaffles.loader.hide(`card-${raffleId}`);

          // Відправляємо подію для відображення деталей
          WinixRaffles.events.emit('show-history-details', { raffleData: details });
        } catch (error) {
          // Приховуємо індикатор завантаження
          WinixRaffles.loader.hide(`card-${raffleId}`);

          WinixRaffles.logger.error(`Помилка отримання деталей розіграшу ${raffleId}:`, error);

          // Показуємо повідомлення про помилку
          WinixRaffles.utils.showToast(
            "Не вдалося завантажити деталі розіграшу",
            "error"
          );
        }
      });
    });
  }

  /**
   * Створення HTML для картки історії
   * @param {Object} raffle - Дані розіграшу
   * @returns {string} HTML-розмітка картки
   * @private
   */
  _createHistoryCardHTML(raffle) {
    if (!raffle) return '';

    // Визначаємо основні параметри
    const raffleId = raffle.raffle_id || raffle.id || 'unknown';
    const title = raffle.title || 'Розіграш';
    const date = raffle.date || raffle.created_at || 'Невідома дата';
    const prize = raffle.prize || '0 WINIX';
    const isWon = raffle.status === 'won';
    const statusClass = isWon ? 'win-status' : 'participated-status';
    const statusText = isWon ? 'Ви перемогли' : 'Участь без перемоги';
    const raffleType = raffle.is_daily ? 'Щоденний розіграш' : 'Гранд розіграш';
    const entryCount = raffle.entry_count || 0;

    // Додаткова інформація для переможців
    const wonInfoHTML = isWon ? `
      <div class="raffle-history-place">
        <span class="place-label">Місце:</span>
        <span class="place-value">${raffle.place || '-'}</span>
      </div>
    ` : '';

    return `
      <div class="history-card ${isWon ? 'won-card' : ''}" data-raffle-id="${raffleId}">
        <div class="raffle-history-header">
          <div class="raffle-history-title">${title}</div>
          <div class="raffle-history-date">${date}</div>
        </div>
        <div class="raffle-history-info">
          <div class="raffle-history-type">${raffleType}</div>
          <div class="raffle-history-prize">${prize}</div>
          <div class="raffle-history-status ${statusClass}">${statusText}</div>
          <div class="raffle-history-entries">
            <span class="entries-label">Витрачено жетонів:</span>
            <span class="entries-value">${entryCount}</span>
          </div>
          ${wonInfoHTML}
        </div>
        <div class="raffle-history-footer">
          <span class="raffle-history-detail-label">Натисніть для деталей</span>
        </div>
      </div>
    `;
  }

  /**
   * Створення HTML для порожньої історії
   * @param {string} message - Повідомлення для відображення
   * @returns {string} HTML для порожньої історії
   * @private
   */
  _createEmptyHistoryHTML(message) {
    message = message || 'У вас ще немає історії розіграшів';

    return `
      <div class="empty-history">
        <div class="empty-history-icon">📋</div>
        <h3>Історія порожня</h3>
        <p>${message}</p>
        <button class="refresh-history-btn" onclick="WinixRaffles.history.displayHistory('history-container', true)">
          <span class="refresh-icon">🔄</span> Оновити
        </button>
      </div>
    `;
  }

  /**
   * Додавання сітки статистики
   * @param {HTMLElement} container - Контейнер для додавання сітки
   * @private
   */
  _addStatsGrid(container) {
    // Додаємо статистику, якщо її ще немає на сторінці
    if (!document.querySelector('.stats-grid') && container) {
      const statsGrid = document.createElement('div');
      statsGrid.className = 'stats-grid';
      statsGrid.innerHTML = `
        <div class="stats-card">
          <div class="stats-card-title">Всього участей</div>
          <div class="stats-card-value" id="total-participated">-</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">Перемоги</div>
          <div class="stats-card-value" id="total-wins">-</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">Виграно WINIX</div>
          <div class="stats-card-value" id="total-winix-won">-</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">Витрачено жетонів</div>
          <div class="stats-card-value" id="total-tokens-spent">-</div>
        </div>
      `;

      // Додаємо сітку перед контейнером історії
      if (container.parentNode) {
        container.parentNode.insertBefore(statsGrid, container);
      }
    }
  }

  /**
   * Оновлення статистики
   * @param {Object} stats - Об'єкт зі статистикою
   * @private
   */
  _updateStatistics(stats) {
    try {
      // Оновлюємо елементи інтерфейсу
      const totalParticipated = document.getElementById('total-participated');
      const totalWins = document.getElementById('total-wins');
      const totalWinixWon = document.getElementById('total-winix-won');
      const totalTokensSpent = document.getElementById('total-tokens-spent');

      if (totalParticipated) {
        totalParticipated.textContent = stats.totalParticipations || 0;
      }

      if (totalWins) {
        totalWins.textContent = stats.totalWins || 0;
      }

      if (totalWinixWon) {
        totalWinixWon.textContent = stats.totalPrizeAmount
          ? stats.totalPrizeAmount.toFixed(2)
          : '0';
      }

      if (totalTokensSpent) {
        totalTokensSpent.textContent = stats.totalTokensSpent || 0;
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка оновлення статистики:", error);
    }
  }

  /**
   * Експорт історії розіграшів у CSV
   */
  exportHistoryToCSV() {
    try {
      // Перевіряємо, чи є дані для експорту
      if (this.state.history.length === 0) {
        WinixRaffles.utils.showToast('Немає даних для експорту', 'warning');
        return;
      }

      // Створюємо заголовки колонок
      const headers = [
        'ID розіграшу',
        'Назва',
        'Дата',
        'Тип',
        'Статус',
        'Приз',
        'Жетонів використано',
        'Місце'
      ];

      // Підготовка рядків даних
      const rows = this.state.history.map(raffle => [
        raffle.raffle_id || raffle.id || '',
        raffle.title || 'Розіграш',
        raffle.date || raffle.created_at || '',
        raffle.is_daily ? 'Щоденний' : 'Гранд',
        raffle.status === 'won' ? 'Перемога' : 'Участь',
        raffle.prize || '0 WINIX',
        raffle.entry_count || '0',
        raffle.status === 'won' ? (raffle.place || '-') : '-'
      ]);

      // Формуємо CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Завантажуємо файл
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.setAttribute('href', url);
      link.setAttribute('download', `winix_raffles_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      WinixRaffles.utils.showToast('Історію успішно експортовано', 'success');
    } catch (error) {
      WinixRaffles.logger.error('Помилка експорту історії:', error);
      WinixRaffles.utils.showToast('Не вдалося експортувати історію', 'error');
    }
  }

  /**
   * Очищення кешу історії
   */
  clearCache() {
    // Очищаємо локальний стан
    this.state.history = [];
    this.state.detailsMap = new Map();
    this.state.currentPage = 1;
    this.state.totalPages = 1;
    this.state.hasMore = false;
    this.state.lastRequestTime = 0;

    // Очищаємо кеш системи
    WinixRaffles.cache.remove('history_data');
    WinixRaffles.cache.remove('history_details_map');
    WinixRaffles.cache.remove('history_statistics');

    // Очищаємо localStorage
    try {
      localStorage.removeItem('winix_raffles_history');
    } catch (error) {
      WinixRaffles.logger.warn("Помилка очищення localStorage:", error);
    }

    WinixRaffles.logger.log("Кеш історії розіграшів очищено");
  }

  /**
   * Скидання стану запитів
   */
  resetRequestState() {
    this.state.loading = false;
    this.state.error = null;
    this.state.lastRequestTime = 0;

    WinixRaffles.logger.log("Стан запитів історії скинуто");
  }

  /**
   * Знищення модуля
   */
  destroy() {
    // Видаляємо обробники подій
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});

    WinixRaffles.logger.log("Модуль історії розіграшів знищено");
  }
}

// Створюємо екземпляр модуля
const historyModule = new HistoryModule();

// Оновлюємо експорт для єдиної системи
export default {
  /**
   * Ініціалізація модуля історії
   */
  init: async function() {
    try {
      await historyModule.init();

      // Експортуємо методи для зворотної сумісності
      WinixRaffles.history = historyModule;

      // Реєструємо модуль в системі WinixRaffles (для нової архітектури)
      if (typeof WinixRaffles.registerModule === 'function') {
        WinixRaffles.registerModule('history', {
          init: historyModule.init.bind(historyModule),
          refresh: historyModule.refresh.bind(historyModule),
          getRafflesHistory: historyModule.getRafflesHistory.bind(historyModule),
          displayHistory: historyModule.displayHistory.bind(historyModule),
          getStatistics: historyModule.getStatistics.bind(historyModule),
          destroy: historyModule.destroy.bind(historyModule)
        });
      }

      return historyModule;
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля історії:", error);
      throw error;
    }
  },

  /**
   * Метод оновлення даних
   * @param {boolean} [forceRefresh=false] Примусове оновлення
   * @returns {Promise<Array>} Історія розіграшів
   */
  refresh: function(forceRefresh = false) {
    return historyModule.refresh(forceRefresh);
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    historyModule.destroy();
  }
};