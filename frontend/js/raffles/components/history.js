/**
 * WINIX - Система розіграшів (history.js)
 * Модуль для роботи з історією розіграшів
 */

(function () {
  'use strict';

  // Перевірка наявності головного модуля розіграшів
  if (typeof WinixRaffles === 'undefined') {
    console.error(
      '❌ WinixRaffles не знайдено! Переконайтеся, що core.js підключено раніше history.js'
    );
    return;
  }

  // Підмодуль для історії розіграшів
  const history = {
    // Дані історії
    historyData: [],

    // Останній час оновлення
    lastUpdate: 0,

    // Інтервал кешування (10 хвилин)
    cacheInterval: 10 * 60 * 1000,

    // Ініціалізація модуля
    init: function () {
      console.log('📜 Ініціалізація модуля історії розіграшів...');

      // Додаємо обробники подій
      this.setupEventListeners();

      // Перевіряємо, чи потрібно відразу завантажити історію
      if (WinixRaffles.state.activeTab === 'past') {
        this.loadRaffleHistory();
      }
    },

    // Налаштування обробників подій
    setupEventListeners: function () {
      // Обробник для карток історії
      document.addEventListener('click', (e) => {
        const historyCard = e.target.closest('.history-card');
        if (historyCard) {
          const raffleId = historyCard.getAttribute('data-raffle-id');
          if (raffleId) {
            e.preventDefault();
            this.showRaffleDetails(raffleId);
          }
        }
      });
    },

    // Завантаження історії розіграшів
    loadRaffleHistory: async function (forceRefresh = false) {
      const userId = WinixRaffles.state.telegramId || WinixAPI.getUserId();

      if (!userId) {
        console.error('❌ Не вдалося визначити ID користувача для завантаження історії');
        this.renderEmptyHistory();
        return;
      }

      // Перевіряємо чи потрібно оновлювати кеш
      const now = Date.now();
      if (
        !forceRefresh &&
        now - this.lastUpdate < this.cacheInterval &&
        this.historyData.length > 0
      ) {
        console.log('📜 Використовуємо кешовану історію розіграшів');
        this.renderRaffleHistory(this.historyData);
        return;
      }

      window.showLoading();

      try {
        console.log('📜 Завантаження історії розіграшів...');

        const response = await WinixAPI.apiRequest(`user/${userId}/raffles-history`, 'GET');

        window.hideLoading();

        if (response.status === 'success' && Array.isArray(response.data)) {
          this.historyData = response.data;
          this.lastUpdate = now;

          // Зберігаємо в локальному сховищі
          try {
            localStorage.setItem(
              'winix_raffle_history',
              JSON.stringify({
                timestamp: now,
                data: this.historyData,
              })
            );
          } catch (e) {
            console.warn('⚠️ Не вдалося зберегти історію в локальному сховищі:', e);
          }

          this.renderRaffleHistory(this.historyData);
        } else if (response.status === 'error') {
          console.error('❌ Помилка завантаження історії:', response.message);
          this.tryLoadFromLocalStorage();
        } else {
          console.error('❌ Неправильний формат відповіді:', response);
          this.tryLoadFromLocalStorage();
        }
      } catch (error) {
        window.hideLoading();
        console.error('❌ Помилка завантаження історії розіграшів:', error);
        this.tryLoadFromLocalStorage();
      }
    },

    // Спроба завантажити історію з локального сховища
    tryLoadFromLocalStorage: function () {
      try {
        const storedHistory = localStorage.getItem('winix_raffle_history');
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory);
          if (parsedHistory && Array.isArray(parsedHistory.data) && parsedHistory.data.length > 0) {
            console.log('📜 Використовуємо історію з локального сховища');
            this.historyData = parsedHistory.data;
            this.renderRaffleHistory(this.historyData);
            return;
          }
        }
      } catch (e) {
        console.warn('⚠️ Помилка завантаження історії з локального сховища:', e);
      }

      // Якщо не вдалося завантажити з локального сховища
      this.renderEmptyHistory();
    },

    // Відображення історії розіграшів
    renderRaffleHistory: function (history) {
      const historyContainer = document.getElementById('history-container');

      if (!historyContainer) {
        console.error('❌ Не знайдено контейнер для історії');
        return;
      }

      // Перевіряємо наявність даних
      if (!Array.isArray(history) || history.length === 0) {
        this.renderEmptyHistory();
        return;
      }

      // Очищаємо контейнер
      historyContainer.innerHTML = '';

      // Сортуємо за датою (від найновіших до найстаріших)
      const sortedHistory = [...history].sort((a, b) => {
        // Конвертуємо дату з формату DD.MM.YYYY
        const datePartsA = a.date.split('.');
        const datePartsB = b.date.split('.');

        // Створюємо об'єкти Date у форматі YYYY-MM-DD
        const dateA = new Date(`${datePartsA[2]}-${datePartsA[1]}-${datePartsA[0]}`);
        const dateB = new Date(`${datePartsB[2]}-${datePartsB[1]}-${datePartsB[0]}`);

        return dateB - dateA;
      });

      // Додаємо картки історії
      sortedHistory.forEach((raffle) => {
        const historyCard = document.createElement('div');
        historyCard.className = `history-card ${raffle.status || ''}`;
        historyCard.setAttribute('data-raffle-id', raffle.raffle_id);

        let statusText = 'Завершено';
        if (raffle.status === 'won') {
          statusText = 'Ви виграли!';
        } else if (raffle.status === 'participated') {
          statusText = 'Ви брали участь';
        }

        historyCard.innerHTML = `
                    <div class="history-date">${raffle.date}</div>
                    <div class="history-prize">${raffle.title || 'Розіграш'}: ${raffle.prize}</div>
                    <div class="history-winners">${raffle.result || 'Переможці визначені'}</div>
                    <div class="history-status ${raffle.status || ''}">${statusText}</div>
                    <div class="view-details-hint">Натисніть для деталей</div>
                `;

        historyContainer.appendChild(historyCard);
      });
    },

    // Відображення порожньої історії
    renderEmptyHistory: function () {
      const historyContainer = document.getElementById('history-container');

      if (!historyContainer) {
        console.error('❌ Не знайдено контейнер для історії');
        return;
      }

      historyContainer.innerHTML = `
                <div class="history-card">
                    <div class="history-date">Історія відсутня</div>
                    <div class="history-prize">У вас ще немає історії участі в розіграшах</div>
                    <div class="history-winners">Візьміть участь у розіграшах, щоб побачити свою історію тут</div>
                </div>
            `;
    },

    // Показ деталей розіграшу - оновлена версія для використання централізованого модального вікна
    showRaffleDetails: function (raffleId) {
      // Пошук розіграшу в історії
      const raffle = this.historyData.find((r) => r.raffle_id === raffleId);

      if (!raffle) {
        window.showToast('Не вдалося знайти інформацію про розіграш', 'error');
        return;
      }

      // Формування HTML для модального вікна
      const modalContent = `
                <div class="raffle-details-modal">
                    <div class="raffle-section">
                        <h3 class="section-title">Деталі розіграшу</h3>
                        <div class="raffle-info">
                            <p><strong>Дата:</strong> ${raffle.date}</p>
                            <p><strong>Призовий фонд:</strong> ${raffle.prize}</p>
                            <p><strong>Ваша участь:</strong> ${raffle.entry_count || 1} жетонів</p>
                            <p><strong>Результат:</strong> ${raffle.result || 'Розіграш завершено'}</p>
                        </div>
                    </div>
                    ${this.getWinnersHtml(raffle)}
                </div>
            `;

      // Показуємо модальне вікно через централізовану функцію
      window.showModal('Деталі розіграшу', modalContent);
    },

    // Допоміжна функція для форматування переможців
    getWinnersHtml: function (raffle) {
      if (!raffle.winners || !raffle.winners.length) return '';

      return `
                <div class="raffle-section">
                    <h3 class="section-title">Переможці розіграшу</h3>
                    <ul class="prizes-list">
                        ${raffle.winners
                          .map(
                            (winner) => `
                            <li class="prize-item ${winner.isCurrentUser ? 'current-user' : ''}">
                                <div class="prize-place">
                                    <div class="prize-icon">${winner.place}</div>
                                    <span>${winner.username}</span>
                                </div>
                                <div class="prize-amount">${winner.prize}</div>
                            </li>
                        `
                          )
                          .join('')}
                    </ul>
                </div>
            `;
    },

    // Оновлення даних історії
    refreshHistory: function () {
      this.loadRaffleHistory(true);
    },
  };

  // Додаємо модуль історії до основного модуля розіграшів
  WinixRaffles.history = history;

  // Ініціалізація модуля при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', function () {
    if (WinixRaffles.state.isInitialized) {
      history.init();
    } else {
      // Додаємо обробник події ініціалізації
      document.addEventListener('winix-raffles-initialized', function () {
        history.init();
      });
    }
  });
})();
