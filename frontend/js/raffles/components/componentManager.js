/**
 * componentManager.js - Ініціалізація та експорт UI компонентів
 */

import WinixRaffles from '../globals.js';

// Спроба імпорту конфігурації з обробкою помилок
let CONFIG;
try {
  CONFIG = (await import('../config.js')).CONFIG;
} catch (error) {
  console.warn("Не вдалося імпортувати конфігурацію, використовуємо значення за замовчуванням");
  // Резервна конфігурація
  CONFIG = {
    REFRESH_INTERVALS: {
      ACTIVE_RAFFLES: 60000,    // 1 хвилина
      HISTORY: 300000,          // 5 хвилин
      STATISTICS: 600000,       // 10 хвилин
    },
    UI: {
      TOAST_DURATION: 3000,     // 3 секунди
      ANIMATION_DURATION: 300,  // 300 мс
    },
    ASSETS: {
      DEFAULT_IMAGE: '/assets/prize-poster.gif',
      TOKEN_ICON: '/assets/token-icon.png'
    }
  };
}

/**
 * Ініціалізація всіх UI компонентів
 * @returns {Object} Об'єкт з компонентами
 */
export async function initUIComponents() {
  try {
    WinixRaffles.logger.log("Ініціалізація UI компонентів");

    // Отримуємо компоненти з наявних файлів
    const cards = await initCardsComponent();
    const modals = await initModalsComponent();
    const statistics = await initStatisticsComponent();

    // Створюємо єдиний об'єкт з компонентами
    const components = {
      cards,
      modals,
      statistics,

      // Допоміжні методи для роботи з компонентами
      showLoading: function(message, id) {
        if (WinixRaffles && WinixRaffles.loader) {
          WinixRaffles.loader.show(message, id);
        }
      },

      hideLoading: function(id) {
        if (WinixRaffles && WinixRaffles.loader) {
          WinixRaffles.loader.hide(id);
        }
      },

      showToast: function(message, type = 'info', duration) {
        if (WinixRaffles.utils && typeof WinixRaffles.utils.showToast === 'function') {
          WinixRaffles.utils.showToast(message, type, duration);
        } else if (modals && typeof modals.showToast === 'function') {
          modals.showToast(message, type, duration);
        }
      },

      showModal: function(modalId, data) {
        if (modals && typeof modals.openModal === 'function') {
          modals.openModal(modalId, data);
        }
      },

      closeModal: function(modalId) {
        if (modals && typeof modals.closeModal === 'function') {
          modals.closeModal(modalId);
        }
      },

      // Метод оновлення UI
      refresh: function() {
        // Оновлюємо всі компоненти
        if (cards && typeof cards.refresh === 'function') {
          cards.refresh();
        }

        if (statistics && typeof statistics.refresh === 'function') {
          statistics.refresh();
        }
      }
    };

    WinixRaffles.logger.log("UI компоненти успішно ініціалізовано");

    return components;
  } catch (error) {
    WinixRaffles.logger.error("Помилка ініціалізації UI компонентів:", error);
    throw error;
  }
}

/**
 * Ініціалізація компонента карток розіграшів
 * @returns {Object} Компонент карток
 */
async function initCardsComponent() {
  try {
    // Спробуємо імпортувати компонент карток, якщо він доступний
    try {
      const { initCards } = await import('./cards.js');
      if (typeof initCards === 'function') {
        return initCards();
      }
    } catch (importError) {
      WinixRaffles.logger.warn("Не вдалося імпортувати компонент карток, використовуємо резервний варіант");
    }

    // Спробуємо використати існуючу функцію ініціалізації з глобального об'єкту
    if (typeof window.initCards === 'function') {
      return window.initCards();
    }

    // Якщо функція недоступна, створюємо базову реалізацію
    return {
      displayMainRaffle: function(container, raffleData) {
        if (!container || !raffleData) return;

        // Базова логіка відображення головного розіграшу
        container.innerHTML = `
          <div class="raffle-card" data-raffle-id="${raffleData.id || ''}">
            <h3 class="raffle-title">${raffleData.title || 'Розіграш'}</h3>
            <div class="raffle-prize">${raffleData.prize_amount || 0} ${raffleData.prize_currency || 'WINIX'}</div>
            <button class="join-button">Взяти участь</button>
          </div>
        `;
      },

      createMiniRaffleElement: function(raffleData) {
        if (!raffleData) return null;

        // Базова логіка створення елемента міні-розіграшу
        const element = document.createElement('div');
        element.className = 'mini-raffle';
        element.setAttribute('data-raffle-id', raffleData.id || '');

        element.innerHTML = `
          <div class="mini-raffle-info">
            <div class="mini-raffle-title">${raffleData.title || 'Розіграш'}</div>
            <div class="mini-raffle-prize">${raffleData.prize_amount || 0} ${raffleData.prize_currency || 'WINIX'}</div>
          </div>
          <button class="mini-raffle-button">Участь</button>
        `;

        return element;
      },

      refresh: function() {
        // Базова логіка оновлення карток
        WinixRaffles.logger.log("Оновлення карток розіграшів");
      }
    };
  } catch (error) {
    WinixRaffles.logger.error("Помилка ініціалізації компонента карток:", error);
    throw error;
  }
}

/**
 * Ініціалізація компонента модальних вікон
 * @returns {Object} Компонент модальних вікон
 */
async function initModalsComponent() {
  try {
    // Спробуємо імпортувати компонент модальних вікон, якщо він доступний
    try {
      const { initModals } = await import('./modals.js');
      if (typeof initModals === 'function') {
        return initModals();
      }
    } catch (importError) {
      WinixRaffles.logger.warn("Не вдалося імпортувати компонент модальних вікон, використовуємо резервний варіант");
    }

    // Спробуємо використати існуючу функцію ініціалізації
    if (typeof window.initModals === 'function') {
      return window.initModals();
    }

    // Якщо функція недоступна, створюємо базову реалізацію
    return {
      openModal: function(modalId, data) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      },

      closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove('open');
        document.body.style.overflow = '';
      },

      showToast: function(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION || 3000) {
        // Базова логіка показу тостів
        const toast = document.getElementById('toast-message') || document.createElement('div');
        toast.id = 'toast-message';
        toast.className = 'toast-message ' + (type || 'info');
        toast.textContent = message || '';

        if (!document.getElementById('toast-message')) {
          document.body.appendChild(toast);
        }

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => toast.classList.remove('show'), duration);
      }
    };
  } catch (error) {
    WinixRaffles.logger.error("Помилка ініціалізації компонента модальних вікон:", error);
    throw error;
  }
}

/**
 * Ініціалізація компонента статистики
 * @returns {Object} Компонент статистики
 */
async function initStatisticsComponent() {
  try {
    // Спробуємо імпортувати компонент статистики, якщо він доступний
    try {
      const { initStatistics } = await import('./statistics.js');
      if (typeof initStatistics === 'function') {
        return initStatistics();
      }
    } catch (importError) {
      WinixRaffles.logger.warn("Не вдалося імпортувати компонент статистики, використовуємо резервний варіант");
    }

    // Спробуємо використати існуючу функцію ініціалізації
    if (typeof window.initStatistics === 'function') {
      return window.initStatistics();
    }

    // Якщо функція недоступна, створюємо базову реалізацію
    return {
      displayStats: function(container, stats) {
        if (!container || !stats) return;

        // Базова логіка відображення статистики
        container.innerHTML = `
          <div class="stats-container">
            <h3>Статистика розіграшів</h3>
            <div class="stats-grid">
              <div class="stats-item">
                <div class="stats-value">${stats.totalParticipated || 0}</div>
                <div class="stats-label">Участей</div>
              </div>
              <div class="stats-item">
                <div class="stats-value">${stats.totalWins || 0}</div>
                <div class="stats-label">Перемог</div>
              </div>
            </div>
          </div>
        `;
      },

      refresh: function() {
        // Базова логіка оновлення статистики
        WinixRaffles.logger.log("Оновлення статистики");
      }
    };
  } catch (error) {
    WinixRaffles.logger.error("Помилка ініціалізації компонента статистики:", error);
    throw error;
  }
}

// Експорт для використання в index.js
export default {
  initUIComponents
};