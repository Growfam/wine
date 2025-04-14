/**
 * stats.js - Модуль для роботи зі статистикою розіграшів WINIX
 * Відповідає за збір, розрахунок та відображення статистики розіграшів.
 * @version 2.0.0
 */

import WinixRaffles from '../globals.js';
import api from '../services/api.js';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters.js';
import { CONFIG } from '../config.js';

/**
 * Клас для керування кешем статистики
 */
class StatsCache {
  constructor() {
  this.CACHE_KEY = CONFIG?.OFFLINE?.STORAGE_KEYS?.STATISTICS || 'winix_user_statistics';
  this.CACHE_VERSION = 2; // Версія для міграцій кешу
  this.MAX_AGE = CONFIG?.API?.CACHE_TTL?.STATISTICS_MAX_AGE || 30 * 24 * 60 * 60 * 1000; // 30 днів
}

  /**
   * Отримання статистики з кешу
   * @returns {Object|null} Об'єкт статистики або null
   */
  getStats() {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      if (!cachedData) return null;

      const parsedData = JSON.parse(cachedData);

      // Перевірка версії кешу
      if (parsedData.version !== this.CACHE_VERSION) {
        WinixRaffles.logger.log('Виявлено застарілу версію кешу статистики, очищаємо');
        this.clearStats();
        return null;
      }

      // Перевіряємо, чи дані не застаріли
      if (parsedData.timestamp && Date.now() - parsedData.timestamp > this.MAX_AGE) {
        WinixRaffles.logger.log('Кешовані дані статистики застаріли, видаляємо їх');
        this.clearStats();
        return null;
      }

      WinixRaffles.logger.debug(`Завантажено статистику з кешу, останнє оновлення: ${new Date(parsedData.timestamp).toLocaleString()}`);
      return parsedData.data;
    } catch (e) {
      WinixRaffles.logger.warn("Помилка читання кешу статистики:", e);
      return null;
    }
  }

  /**
   * Збереження статистики в кеш
   * @param {Object} stats - Об'єкт статистики
   */
  saveStats(stats) {
    if (!stats) return;

    try {
      const cacheData = {
        data: stats,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      WinixRaffles.logger.debug('Статистику збережено в кеш');
    } catch (e) {
      WinixRaffles.logger.warn("Помилка збереження кешу статистики:", e);
    }
  }

  /**
   * Очищення кешу статистики
   */
  clearStats() {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      WinixRaffles.logger.log('Кеш статистики очищено');
    } catch (e) {
      WinixRaffles.logger.warn("Помилка очищення кешу статистики:", e);
    }
  }
}

/**
 * Клас для розрахунку та аналізу статистики
 */
class StatsAnalyzer {
  /**
   * Отримання статистики за замовчуванням
   * @returns {Object} Об'єкт статистики з нульовими значеннями
   */
  getDefaultStats() {
    return {
      totalParticipated: 0,
      totalWins: 0,
      totalWinixWon: 0,
      totalTokensSpent: 0,
      winRate: 0,
      lastRaffle: null,
      lastWin: null,
      bestWin: null,
      longestStreak: 0,
      currentStreak: 0,
      raffleTypes: {
        daily: { participated: 0, wins: 0, winixWon: 0, tokensSpent: 0 },
        main: { participated: 0, wins: 0, winixWon: 0, tokensSpent: 0 }
      },
      history: {
        weekly: { participated: 0, wins: 0, winixWon: 0, tokensSpent: 0 },
        monthly: { participated: 0, wins: 0, winixWon: 0, tokensSpent: 0 }
      },
      efficiency: {
        tokenRoi: 0, // Повернення на інвестиції жетонів (winixWon / tokensSpent)
        winRate: 0, // Відсоток перемог (wins / participated)
        avgWin: 0, // Середній виграш (winixWon / wins)
        profitPerRaffle: 0 // Середній прибуток за розіграш (winixWon / participated)
      },
      updated: Date.now()
    };
  }

  /**
   * Розрахунок статистики на основі історії розіграшів
   * @param {Array} history - Історія розіграшів
   * @returns {Object} Об'єкт статистики
   */
  calculateStatsFromHistory(history = []) {
    // Базова статистика
    const stats = this.getDefaultStats();

    if (!Array.isArray(history) || history.length === 0) {
      return stats;
    }

    try {
      // Фільтруємо дані для безпечної обробки
      const safeHistory = history.filter(item => item && typeof item === 'object');

      if (safeHistory.length === 0) return stats;

      // Загальна кількість участей
      stats.totalParticipated = safeHistory.length;

      // Для обчислення стріків
      let currentStreak = 0;
      let maxStreak = 0;
      let lastWinTimestamp = 0;
      let bestWin = { amount: 0, prize: '' };

      // Масив для сортування за датою (для коректного розрахунку стріків)
      const sortedHistory = [...safeHistory].sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0);
        const dateB = new Date(b.date || b.created_at || 0);
        return dateB - dateA; // Сортуємо від найновіших до найстаріших
      });

      // Дати для періодів
      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);

      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);

      // Обчислюємо решту статистики
      sortedHistory.forEach(item => {
        const entryDate = new Date(item.date || item.created_at || 0);
        const isInWeek = entryDate >= oneWeekAgo;
        const isInMonth = entryDate >= oneMonthAgo;

        // Рахуємо витрачені жетони
        const tokens = parseInt(item.tokensSpent || item.entry_count || 0);
        if (!isNaN(tokens)) {
          stats.totalTokensSpent += tokens;

          // Оновлюємо статистику за типом розіграшу
          const raffleType = item.is_daily ? 'daily' : 'main';
          stats.raffleTypes[raffleType].participated++;
          stats.raffleTypes[raffleType].tokensSpent += tokens;

          // Оновлюємо статистику за періодами
          if (isInWeek) {
            stats.history.weekly.participated++;
            stats.history.weekly.tokensSpent += tokens;
          }

          if (isInMonth) {
            stats.history.monthly.participated++;
            stats.history.monthly.tokensSpent += tokens;
          }
        }

        // Рахуємо перемоги та виграші
        if (item.status === 'won' || item.won) {
          stats.totalWins++;

          // Рахуємо стрік перемог
          const winTimestamp = entryDate.getTime();

          if (lastWinTimestamp === 0) {
            // Перша перемога
            currentStreak = 1;
            lastWinTimestamp = winTimestamp;
          } else {
            // Якщо це наступний розіграш після останньої перемоги
            // (спрощена логіка стріків - рахуємо послідовні перемоги)
            currentStreak++;
          }

          // Оновлюємо максимальний стрік
          maxStreak = Math.max(maxStreak, currentStreak);

          // Оновлюємо статистику за типом розіграшу
          const raffleType = item.is_daily ? 'daily' : 'main';
          stats.raffleTypes[raffleType].wins++;

          // Оновлюємо статистику за періодами
          if (isInWeek) {
            stats.history.weekly.wins++;
          }

          if (isInMonth) {
            stats.history.monthly.wins++;
          }

          // Обчислюємо суму виграшу
          if (item.prize) {
            const match = item.prize.match(/(\d+(?:\.\d+)?)\s*WINIX/i);
            if (match) {
              const winAmount = parseFloat(match[1]);
              if (!isNaN(winAmount)) {
                stats.totalWinixWon += winAmount;

                // Оновлюємо найкращий виграш
                if (winAmount > bestWin.amount) {
                  bestWin = {
                    amount: winAmount,
                    prize: item.prize,
                    date: item.date,
                    raffleId: item.raffle_id,
                    raffleTitle: item.title
                  };
                }

                // Оновлюємо статистику за типом розіграшу
                stats.raffleTypes[raffleType].winixWon += winAmount;

                // Оновлюємо статистику за періодами
                if (isInWeek) {
                  stats.history.weekly.winixWon += winAmount;
                }

                if (isInMonth) {
                  stats.history.monthly.winixWon += winAmount;
                }
              }
            }
          }

          // Запам'ятовуємо останній виграш
          if (!stats.lastWin || (item.date && new Date(item.date) > new Date(stats.lastWin.date))) {
            stats.lastWin = {
              date: item.date,
              amount: item.prize,
              raffleId: item.raffle_id,
              raffleTitle: item.title
            };
          }
        } else {
          // Скидаємо стрік, якщо не перемога
          currentStreak = 0;
        }

        // Запам'ятовуємо останню участь
        if (!stats.lastRaffle || (item.date && new Date(item.date) > new Date(stats.lastRaffle.date))) {
          stats.lastRaffle = {
            date: item.date,
            raffleId: item.raffle_id,
            title: item.title || 'Розіграш'
          };
        }
      });

      // Зберігаємо поточний та найкращий стрік
      stats.currentStreak = currentStreak;
      stats.longestStreak = maxStreak;
      stats.bestWin = bestWin.amount > 0 ? bestWin : null;

      // Розрахунок ефективності та додаткових показників
      this.calculateEfficiencyMetrics(stats);

      return stats;
    } catch (error) {
      WinixRaffles.logger.error("Помилка обчислення статистики з історії:", error);
      return this.getDefaultStats();
    }
  }

  /**
   * Розрахунок метрик ефективності
   * @param {Object} stats - Базова статистика
   */
  calculateEfficiencyMetrics(stats) {
    if (!stats) return;

    // Розрахунок відсотка виграшів
    if (stats.totalParticipated > 0) {
      stats.efficiency.winRate = (stats.totalWins / stats.totalParticipated) * 100;
    }

    // Розрахунок середнього виграшу
    if (stats.totalWins > 0) {
      stats.efficiency.avgWin = stats.totalWinixWon / stats.totalWins;
    }

    // Розрахунок ефективності витрат жетонів (ROI)
    if (stats.totalTokensSpent > 0) {
      stats.efficiency.tokenRoi = stats.totalWinixWon / stats.totalTokensSpent;
    }

    // Розрахунок середнього прибутку за розіграш
    if (stats.totalParticipated > 0) {
      stats.efficiency.profitPerRaffle = stats.totalWinixWon / stats.totalParticipated;
    }

    // Розрахунок для типів розіграшів
    Object.keys(stats.raffleTypes).forEach(type => {
      const typeStats = stats.raffleTypes[type];
      if (typeStats.participated > 0) {
        typeStats.winRate = (typeStats.wins / typeStats.participated) * 100;
        typeStats.profitPerRaffle = typeStats.winixWon / typeStats.participated;

        if (typeStats.tokensSpent > 0) {
          typeStats.tokenRoi = typeStats.winixWon / typeStats.tokensSpent;
        }
      }
    });

    // Розрахунок для періодів
    Object.keys(stats.history).forEach(period => {
      const periodStats = stats.history[period];
      if (periodStats.participated > 0) {
        periodStats.winRate = (periodStats.wins / periodStats.participated) * 100;
        periodStats.profitPerRaffle = periodStats.winixWon / periodStats.participated;

        if (periodStats.tokensSpent > 0) {
          periodStats.tokenRoi = periodStats.winixWon / periodStats.tokensSpent;
        }
      }
    });
  }

  /**
   * Оновлення статистики на основі нової участі
   * @param {Object} currentStats - Поточна статистика
   * @param {number} tokensSpent - Кількість витрачених жетонів
   * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
   * @returns {Object} Оновлена статистика
   */
  updateStatsAfterParticipation(currentStats, tokensSpent, raffleType = 'daily') {
    // Клонуємо об'єкт для уникнення мутацій
    const stats = JSON.parse(JSON.stringify(currentStats || this.getDefaultStats()));

    // Перевіряємо коректність типу розіграшу
    const validType = (raffleType === 'daily' || raffleType === 'main') ? raffleType : 'daily';

    // Оновлюємо загальні лічильники
    stats.totalParticipated += 1;
    stats.totalTokensSpent += tokensSpent;

    // Оновлюємо лічильники за типом
    stats.raffleTypes[validType].participated += 1;
    stats.raffleTypes[validType].tokensSpent += tokensSpent;

    // Оновлюємо статистику за періодами
    stats.history.weekly.participated += 1;
    stats.history.weekly.tokensSpent += tokensSpent;

    stats.history.monthly.participated += 1;
    stats.history.monthly.tokensSpent += tokensSpent;

    // Оновлюємо останній розіграш
    stats.lastRaffle = {
      date: new Date().toISOString(),
      title: 'Розіграш' // Без деталей
    };

    // Оновлюємо додаткові метрики
    this.calculateEfficiencyMetrics(stats);

    // Оновлюємо час оновлення
    stats.updated = Date.now();

    return stats;
  }

  /**
   * Оновлення статистики після перемоги
   * @param {Object} currentStats - Поточна статистика
   * @param {number} winixAmount - Кількість виграних WINIX
   * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
   * @param {Object} details - Деталі виграшу
   * @returns {Object} Оновлена статистика
   */
  updateStatsAfterWin(currentStats, winixAmount, raffleType = 'daily', details = {}) {
    // Клонуємо об'єкт для уникнення мутацій
    const stats = JSON.parse(JSON.stringify(currentStats || this.getDefaultStats()));

    // Перевіряємо коректність типу розіграшу
    const validType = (raffleType === 'daily' || raffleType === 'main') ? raffleType : 'daily';

    // Оновлюємо загальні лічильники
    stats.totalWins += 1;
    stats.totalWinixWon += winixAmount;

    // Оновлюємо лічильники за типом
    stats.raffleTypes[validType].wins += 1;
    stats.raffleTypes[validType].winixWon += winixAmount;

    // Оновлюємо статистику за періодами
    stats.history.weekly.wins += 1;
    stats.history.weekly.winixWon += winixAmount;

    stats.history.monthly.wins += 1;
    stats.history.monthly.winixWon += winixAmount;

    // Оновлюємо стрік виграшів
    stats.currentStreak += 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);

    // Оновлюємо найкращий виграш
    if (!stats.bestWin || winixAmount > stats.bestWin.amount) {
      stats.bestWin = {
        amount: winixAmount,
        prize: `${winixAmount} WINIX`,
        date: new Date().toISOString(),
        ...details
      };
    }

    // Оновлюємо останній виграш
    stats.lastWin = {
      amount: winixAmount,
      prize: `${winixAmount} WINIX`,
      date: new Date().toISOString(),
      ...details
    };

    // Оновлюємо додаткові метрики
    this.calculateEfficiencyMetrics(stats);

    // Оновлюємо час оновлення
    stats.updated = Date.now();

    return stats;
  }
}

/**
 * Клас для керування відображенням статистики в інтерфейсі
 */
class StatsUIManager {
  constructor() {
    this.UI_ELEMENTS = {
      totalParticipated: 'total-participated',
      totalWins: 'total-wins',
      totalWinixWon: 'total-winix-won',
      totalTokensSpent: 'total-tokens-spent',
      winRate: 'win-rate',
      avgWin: 'avg-win',
      tokenEfficiency: 'token-efficiency',
      currentStreak: 'current-streak',
      longestStreak: 'longest-streak'
    };

    // Для відстеження змінених елементів
    this.changedElements = new Set();

    // Queue for batched updates
    this.updateQueue = new Map();
    this.updateScheduled = false;
  }

  /**
   * Оновлення елемента DOM
   * @param {string} id - ID елемента
   * @param {*} value - Нове значення
   * @param {Function} formatter - Функція форматування
   */
  updateElement(id, value, formatter = null) {
    // Додаємо оновлення в чергу
    this.updateQueue.set(id, { value, formatter });
    this.changedElements.add(id);

    // Плануємо масове оновлення, якщо ще не заплановано
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  /**
   * Застосування всіх оновлень з черги
   */
  flushUpdates() {
    this.updateQueue.forEach((update, id) => {
      const element = document.getElementById(id);
      if (element) {
        const formattedValue = update.formatter
          ? update.formatter(update.value)
          : update.value;

        // Оновлюємо тільки якщо значення змінилося
        if (element.textContent !== String(formattedValue)) {
          element.textContent = formattedValue;

          // Додаємо клас для анімації
          element.classList.add('updated-value');

          // Видаляємо клас після анімації
          setTimeout(() => {
            element.classList.remove('updated-value');
          }, 1000);
        }
      }
    });

    // Очищаємо чергу та знімаємо прапорець планування
    this.updateQueue.clear();
    this.updateScheduled = false;
  }

  /**
   * Оновлення відображення статистики
   * @param {Object} stats - Дані статистики
   */
  updateStatistics(stats) {
    if (!stats) return;

    // Основні показники
    this.updateElement(this.UI_ELEMENTS.totalParticipated, stats.totalParticipated, formatNumber);
    this.updateElement(this.UI_ELEMENTS.totalWins, stats.totalWins, formatNumber);
    this.updateElement(this.UI_ELEMENTS.totalWinixWon, stats.totalWinixWon, value => formatCurrency(value, 'WINIX'));
    this.updateElement(this.UI_ELEMENTS.totalTokensSpent, stats.totalTokensSpent, formatNumber);

    // Додаткові показники
    if (stats.efficiency) {
      this.updateElement(this.UI_ELEMENTS.winRate, stats.efficiency.winRate, value => Number(value).toFixed(1) + '%');
      this.updateElement(this.UI_ELEMENTS.avgWin, stats.efficiency.avgWin, value => formatCurrency(value, 'WINIX'));
      this.updateElement(this.UI_ELEMENTS.tokenEfficiency, stats.efficiency.tokenRoi, value => Number(value).toFixed(2));
    }

    // Стріки
    this.updateElement(this.UI_ELEMENTS.currentStreak, stats.currentStreak, formatNumber);
    this.updateElement(this.UI_ELEMENTS.longestStreak, stats.longestStreak, formatNumber);

    // Застосовуємо оновлення негайно
    this.flushUpdates();
  }

  /**
   * Перевірка наявності всіх необхідних елементів UI
   * @returns {boolean} Чи всі елементи знайдено
   */
  checkUIElements() {
    let allFound = true;

    for (const id of Object.values(this.UI_ELEMENTS)) {
      if (!document.getElementById(id)) {
        allFound = false;
        break;
      }
    }

    return allFound;
  }

  /**
   * Рендерінг інтерфейсу статистики
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {Object} stats - Дані статистики
   */
  renderStatisticsUI(container, stats) {
    if (!container || !stats) return;

    // Створюємо HTML для статистики
    const html = this.generateStatsHTML(stats);

    // Оновлюємо контейнер з допомогою DocumentFragment для оптимізації
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    // Очищаємо та додаємо новий контент
    container.innerHTML = '';
    container.appendChild(fragment);

    // Додаємо обробники подій
    this.setupEventListeners(container, stats);
  }

  /**
   * Генерування HTML для відображення статистики
   * @param {Object} stats - Дані статистики
   * @returns {string} HTML-розмітка
   */
  generateStatsHTML(stats) {
    // Форматування для відображення
    const formatPercent = value => (Math.round(value * 10) / 10) + '%';
    const formatEfficiency = value => value.toFixed(2);

    // Розрахунок класу для ефективності (позитивна/негативна)
    const getEfficiencyClass = value => value >= 1 ? 'positive-value' : 'negative-value';

    // Генеруємо HTML
    return `
      <div class="stats-container">
        <div class="stats-header">
          <h2>Ваша статистика розіграшів</h2>
          <div class="stats-last-updated">
            Оновлено: ${formatDate(stats.updated)}
            <button id="refresh-stats-btn" class="refresh-btn" title="Оновити статистику">
              <span class="refresh-icon">🔄</span>
            </button>
          </div>
        </div>
        
        <!-- Основні показники -->
        <div class="stats-grid">
          <div class="stats-card">
            <div class="stats-card-title">Всього участей</div>
            <div class="stats-card-value" id="total-participated">${formatNumber(stats.totalParticipated)}</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-title">Перемоги</div>
            <div class="stats-card-value" id="total-wins">${formatNumber(stats.totalWins)}</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-title">Виграно WINIX</div>
            <div class="stats-card-value" id="total-winix-won">${formatCurrency(stats.totalWinixWon)}</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-title">Витрачено жетонів</div>
            <div class="stats-card-value" id="total-tokens-spent">${formatNumber(stats.totalTokensSpent)}</div>
          </div>
        </div>
        
        <!-- Ефективність -->
        <div class="stats-section">
          <h3>Показники ефективності</h3>
          <div class="stats-metrics-grid">
            <div class="metric-item">
              <div class="metric-title">Відсоток перемог</div>
              <div class="metric-value" id="win-rate">${formatPercent(stats.efficiency.winRate)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-title">Середній виграш</div>
              <div class="metric-value" id="avg-win">${formatCurrency(stats.efficiency.avgWin)}</div>
            </div>
            <div class="metric-item">
              <div class="metric-title">Ефективність жетонів</div>
              <div class="metric-value ${getEfficiencyClass(stats.efficiency.tokenRoi)}" id="token-efficiency">${formatEfficiency(stats.efficiency.tokenRoi)}</div>
              <div class="metric-description">WINIX за 1 жетон</div>
            </div>
            <div class="metric-item">
              <div class="metric-title">Прибуток за розіграш</div>
              <div class="metric-value ${getEfficiencyClass(stats.efficiency.profitPerRaffle)}" id="profit-per-raffle">${formatCurrency(stats.efficiency.profitPerRaffle)}</div>
            </div>
          </div>
        </div>
        
        <!-- Стріки та рекорди -->
        <div class="stats-section">
          <h3>Серії та рекорди</h3>
          <div class="stats-metrics-grid">
            <div class="metric-item">
              <div class="metric-title">Поточна серія</div>
              <div class="metric-value" id="current-streak">${formatNumber(stats.currentStreak)}</div>
              <div class="metric-description">перемог підряд</div>
            </div>
            <div class="metric-item">
              <div class="metric-title">Найдовша серія</div>
              <div class="metric-value" id="longest-streak">${formatNumber(stats.longestStreak)}</div>
              <div class="metric-description">перемог підряд</div>
            </div>
            ${stats.bestWin ? `
            <div class="metric-item best-win">
              <div class="metric-title">Найбільший виграш</div>
              <div class="metric-value">${formatCurrency(stats.bestWin.amount)}</div>
              <div class="metric-description">${stats.bestWin.date ? formatDate(stats.bestWin.date) : ''}</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Статистика за типами розіграшів -->
        <div class="stats-section">
          <h3>Статистика за типами розіграшів</h3>
          <div class="stats-tabs">
            <div class="tabs-header">
              <button class="tab-btn active" data-tab="daily-stats">Щоденні</button>
              <button class="tab-btn" data-tab="main-stats">Джекпоти</button>
            </div>
            <div class="tabs-content">
              <div class="tab-pane active" id="daily-stats">
                ${this.generateTypeStatsHTML(stats.raffleTypes.daily)}
              </div>
              <div class="tab-pane" id="main-stats">
                ${this.generateTypeStatsHTML(stats.raffleTypes.main)}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Періодична статистика -->
        <div class="stats-section">
          <h3>Періодична статистика</h3>
          <div class="stats-tabs">
            <div class="tabs-header">
              <button class="tab-btn active" data-tab="weekly-stats">За тиждень</button>
              <button class="tab-btn" data-tab="monthly-stats">За місяць</button>
            </div>
            <div class="tabs-content">
              <div class="tab-pane active" id="weekly-stats">
                ${this.generatePeriodStatsHTML(stats.history.weekly)}
              </div>
              <div class="tab-pane" id="monthly-stats">
                ${this.generatePeriodStatsHTML(stats.history.monthly)}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Останні події -->
        <div class="stats-section">
          <h3>Останні події</h3>
          <div class="last-events">
            ${stats.lastRaffle ? `
            <div class="event-item">
              <div class="event-title">Остання участь</div>
              <div class="event-value">${stats.lastRaffle.title || 'Розіграш'}</div>
              <div class="event-date">${formatDate(stats.lastRaffle.date)}</div>
            </div>
            ` : ''}
            
            ${stats.lastWin ? `
            <div class="event-item">
              <div class="event-title">Останній виграш</div>
              <div class="event-value">${stats.lastWin.amount || stats.lastWin.prize || ''}</div>
              <div class="event-date">${formatDate(stats.lastWin.date)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Генерування HTML для статистики за типом розіграшу
   * @param {Object} typeStats - Статистика типу розіграшу
   * @returns {string} HTML-розмітка
   */
  generateTypeStatsHTML(typeStats) {
    const winRate = typeStats.participated > 0
      ? (typeStats.wins / typeStats.participated * 100).toFixed(1) + '%'
      : '0%';

    const avgWin = typeStats.wins > 0
      ? formatCurrency(typeStats.winixWon / typeStats.wins)
      : '0 WINIX';

    const tokenEfficiency = typeStats.tokensSpent > 0
      ? (typeStats.winixWon / typeStats.tokensSpent).toFixed(2)
      : '0';

    const efficiencyClass = typeStats.tokensSpent > 0 && (typeStats.winixWon / typeStats.tokensSpent) >= 1
      ? 'positive-value'
      : 'negative-value';

    return `
      <div class="type-stats-grid">
        <div class="type-stat-item">
          <div class="stat-label">Участей:</div>
          <div class="stat-value">${formatNumber(typeStats.participated)}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Перемог:</div>
          <div class="stat-value">${formatNumber(typeStats.wins)}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Виграно WINIX:</div>
          <div class="stat-value">${formatCurrency(typeStats.winixWon)}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Витрачено жетонів:</div>
          <div class="stat-value">${formatNumber(typeStats.tokensSpent)}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Відсоток перемог:</div>
          <div class="stat-value">${winRate}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Середній виграш:</div>
          <div class="stat-value">${avgWin}</div>
        </div>
        <div class="type-stat-item">
          <div class="stat-label">Ефективність жетонів:</div>
          <div class="stat-value ${efficiencyClass}">${tokenEfficiency}</div>
        </div>
      </div>
    `;
  }

  /**
   * Генерування HTML для періодичної статистики
   * @param {Object} periodStats - Статистика за період
   * @returns {string} HTML-розмітка
   */
  generatePeriodStatsHTML(periodStats) {
    const winRate = periodStats.participated > 0
      ? (periodStats.wins / periodStats.participated * 100).toFixed(1) + '%'
      : '0%';

    const tokenEfficiency = periodStats.tokensSpent > 0
      ? (periodStats.winixWon / periodStats.tokensSpent).toFixed(2)
      : '0';

    const efficiencyClass = periodStats.tokensSpent > 0 && (periodStats.winixWon / periodStats.tokensSpent) >= 1
      ? 'positive-value'
      : 'negative-value';

    return `
      <div class="period-stats-grid">
        <div class="period-stat-block">
          <div class="period-stat-value">${formatNumber(periodStats.participated)}</div>
          <div class="period-stat-label">Участей</div>
        </div>
        <div class="period-stat-block">
          <div class="period-stat-value">${formatNumber(periodStats.wins)}</div>
          <div class="period-stat-label">Перемог</div>
        </div>
        <div class="period-stat-block">
          <div class="period-stat-value">${formatCurrency(periodStats.winixWon)}</div>
          <div class="period-stat-label">Виграш</div>
        </div>
        <div class="period-stat-block">
          <div class="period-stat-value">${formatNumber(periodStats.tokensSpent)}</div>
          <div class="period-stat-label">Жетонів</div>
        </div>
        <div class="period-stat-block">
          <div class="period-stat-value">${winRate}</div>
          <div class="period-stat-label">Успіх</div>
        </div>
        <div class="period-stat-block">
          <div class="period-stat-value ${efficiencyClass}">${tokenEfficiency}</div>
          <div class="period-stat-label">WINIX/жетон</div>
        </div>
      </div>
    `;
  }

  /**
   * Встановлення обробників подій
   * @param {HTMLElement} container - Контейнер з елементами
   * @param {Object} stats - Дані статистики
   */
  setupEventListeners(container, stats) {
    if (!container) return;

    // Обробник для кнопки оновлення
    const refreshButton = container.querySelector('#refresh-stats-btn');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        // Емітуємо подію про запит оновлення
        WinixRaffles.events.emit('refresh-statistics-requested', {
          source: 'user-action'
        });
      });
    }

    // Обробники для вкладок
    const tabButtons = container.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Забираємо активний клас у всіх кнопок
        tabButtons.forEach(b => b.classList.remove('active'));
        // Додаємо активний клас натиснутій кнопці
        btn.classList.add('active');

        // Отримуємо ID вкладки
        const tabId = btn.getAttribute('data-tab');

        // Активуємо відповідну вкладку
        const tabPanes = container.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === tabId) {
            pane.classList.add('active');
          }
        });
      });
    });
  }

  /**
   * Створення заглушки для відображення при помилці завантаження
   * @param {HTMLElement} container - Контейнер для відображення
   * @param {string} message - Повідомлення про помилку
   */
  renderErrorState(container, message = 'Не вдалося завантажити статистику') {
    if (!container) return;

    container.innerHTML = `
      <div class="empty-stats">
        <div class="empty-stats-icon">📊</div>
        <h3>Статистика недоступна</h3>
        <p>${message}</p>
        <button id="retry-stats-btn" class="retry-btn">
          <span class="refresh-icon">🔄</span> Спробувати знову
        </button>
      </div>
    `;

    // Додаємо обробник для кнопки retry
    const retryButton = container.querySelector('#retry-stats-btn');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        // Емітуємо подію про запит оновлення
        WinixRaffles.events.emit('refresh-statistics-requested', {
          source: 'retry-action',
          forceRefresh: true
        });
      });
    }
  }

  /**
   * Відображення стану завантаження
   * @param {HTMLElement} container - Контейнер для відображення
   */
  renderLoadingState(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="loading-placeholder">
        <div class="loading-spinner"></div>
        <div class="loading-text">Завантаження статистики...</div>
        <div class="loading-subtext">Аналізуємо ваші розіграші</div>
      </div>
    `;
  }
}

/**
 * Головний клас модуля статистики
 */
class StatisticsModule {
  constructor() {
    this.cache = new StatsCache();
    this.analyzer = new StatsAnalyzer();
    this.uiManager = new StatsUIManager();

    this.currentStats = null;
    this.isUpdating = false;
    this.lastUpdateTime = 0;
    this.updateInterval = CONFIG?.REFRESH_INTERVALS?.STATISTICS || 5 * 60 * 1000; // 5 хвилин за замовчуванням
    this.eventListeners = [];
  }

  /**
 * Оновлення статистики
 * @param {boolean} [forceRefresh=false] Примусове оновлення
 * @returns {Promise<Object>} Статистика
 */
async refresh(forceRefresh = false) {
  try {
    return await this.fetchStatistics(forceRefresh);
  } catch (error) {
    WinixRaffles.logger.error("Помилка оновлення статистики:", error);
    throw error;
  }
}

  /**
   * Ініціалізація модуля
   */
  init() {
    WinixRaffles.logger.log("Ініціалізація модуля статистики");

    try {
      // Завантажуємо кешовані дані
      this._loadCachedStats();

      // Підписуємося на події
      this._setupEventListeners();

      // Запускаємо оновлення статистики
      this.updateStatistics().catch(error => {
        WinixRaffles.logger.warn("Помилка початкового оновлення статистики:", error);
      });

      WinixRaffles.logger.log("Модуль статистики успішно ініціалізовано");
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля статистики:", error);
    }
  }

  /**
   * Завантаження статистики з кешу
   * @private
   */
  _loadCachedStats() {
    const cachedStats = this.cache.getStats();
    if (cachedStats) {
      this.currentStats = cachedStats;
      WinixRaffles.logger.log("Завантажено статистику з кешу");

      // Ініціюємо оновлення інтерфейсу, якщо він існує
      if (this.uiManager.checkUIElements()) {
        this.uiManager.updateStatistics(cachedStats);
      }
    }
  }

  /**
   * Підписка на події
   * @private
   */
  _setupEventListeners() {
    // Обробник оновлення історії розіграшів
    const historyUpdateHandler = (event) => {
      if (event.detail && Array.isArray(event.detail.data)) {
        this.updateStatsFromHistory(event.detail.data);
      }
    };

    // Обробник участі в розіграші
    const participationHandler = (event) => {
      if (event.detail) {
        this.updateParticipationStats(
          event.detail.entryCount || 1,
          event.detail.raffleType || 'daily'
        );
      }
    };

    // Обробник виграшу
    const winHandler = (event) => {
      if (event.detail) {
        this.updateWinStats(
          event.detail.winixAmount || 0,
          event.detail.raffleType || 'daily',
          event.detail.raffleId,
          event.detail.details
        );
      }
    };

    // Обробник запиту на оновлення статистики
    const refreshHandler = (event) => {
      const forceRefresh = event.detail && event.detail.forceRefresh === true;
      this.updateStatistics(forceRefresh).catch(error => {
        WinixRaffles.logger.warn("Помилка оновлення статистики за запитом:", error);
      });
    };

    // Підписуємося на події
    this._addEventListenerWithTracking(document, 'history-updated', historyUpdateHandler);
    this._addEventListenerWithTracking(document, 'raffle-participated', participationHandler);
    this._addEventListenerWithTracking(document, 'raffle-win', winHandler);

    // Підписуємося на події WinixRaffles
    if (WinixRaffles && WinixRaffles.events) {
      this._addEventListenerWithTracking(WinixRaffles.events, 'refresh-statistics-requested', refreshHandler);
    }
  }

  /**
   * Додавання обробника події з відстеженням
   * @param {EventTarget|Object} target - Цільовий об'єкт
   * @param {string} eventName - Назва події
   * @param {Function} handler - Обробник події
   * @private
   */
  _addEventListenerWithTracking(target, eventName, handler) {
    if (target === WinixRaffles.events) {
      // Для подій WinixRaffles використовуємо їх API
      const removeFunction = target.on(eventName, handler);
      this.eventListeners.push({
        target,
        eventName,
        handler,
        remove: removeFunction
      });
    } else {
      // Для стандартних подій DOM
      target.addEventListener(eventName, handler);
      this.eventListeners.push({
        target,
        eventName,
        handler,
        remove: null
      });
    }
  }

  /**
   * Видалення обробників подій
   * @private
   */
  _removeEventListeners() {
    for (const listener of this.eventListeners) {
      if (listener.remove) {
        // Для подій WinixRaffles
        listener.remove();
      } else if (listener.target && listener.eventName && listener.handler) {
        // Для стандартних подій DOM
        listener.target.removeEventListener(listener.eventName, listener.handler);
      }
    }

    this.eventListeners = [];
  }

  /**
   * Перевірка, чи пристрій онлайн
   * @returns {boolean} Стан підключення
   * @private
   */
  _isOnline() {
    return typeof navigator.onLine === 'undefined' || navigator.onLine;
  }

  /**
   * Отримання даних статистики
   * @param {boolean} forceRefresh - Примусове оновлення
   * @returns {Promise<Object>} Проміс з даними статистики
   */
  async fetchStatistics(forceRefresh = false) {
    // Перевіряємо, чи не відбувається вже оновлення
    if (this.isUpdating) {
      WinixRaffles.logger.log("Оновлення статистики вже виконується");
      return this.currentStats || this.analyzer.getDefaultStats();
    }

    // Перевіряємо, чи потрібно оновлювати дані
    const now = Date.now();
    if (!forceRefresh && this.lastUpdateTime > 0 && (now - this.lastUpdateTime) < this.updateInterval) {
      WinixRaffles.logger.log("Використання кешованої статистики");
      return this.currentStats || this.analyzer.getDefaultStats();
    }

    this.isUpdating = true;

    try {
      WinixRaffles.loader.show('Оновлення статистики...', 'stats-update');

      // Отримуємо історію розіграшів
      let history = [];

      // Спробуємо запитати історію розіграшів
      if (this._isOnline()) {
        try {
          // Отримуємо історію з API
          if (api && typeof api.getRafflesHistory === 'function') {
            const response = await api.getRafflesHistory({}, true);

            if (Array.isArray(response)) {
              history = response;
            } else if (response && response.data && Array.isArray(response.data)) {
              history = response.data;
            }
          }
          // Якщо є модуль історії, можемо спробувати отримати дані з нього
          else if (WinixRaffles && WinixRaffles.history && typeof WinixRaffles.history.getRafflesHistory === 'function') {
            history = await WinixRaffles.history.getRafflesHistory({}, true);
          }
        } catch (historyError) {
          WinixRaffles.logger.warn("Помилка отримання історії:", historyError);

          // Якщо є модуль історії, спробуємо отримати дані з нього як запасний варіант
          if (WinixRaffles && WinixRaffles.history && typeof WinixRaffles.history.getRafflesHistory === 'function') {
            try {
              history = await WinixRaffles.history.getRafflesHistory({}, false);
            } catch (moduleError) {
              WinixRaffles.logger.warn("Не вдалося отримати історію з модуля:", moduleError);
            }
          }
        }
      } else {
        WinixRaffles.logger.warn("Пристрій офлайн, використовуємо кешовану статистику");
      }

      // Обчислюємо статистику на основі історії
      const stats = history.length > 0
        ? this.analyzer.calculateStatsFromHistory(history)
        : this.currentStats || this.analyzer.getDefaultStats();

      // Оновлюємо час останнього оновлення
      this.lastUpdateTime = now;

      // Зберігаємо в кеш
      this.cache.saveStats(stats);

      // Оновлюємо поточну статистику
      this.currentStats = stats;

      // Емітуємо подію про оновлення статистики
      WinixRaffles.events.emit('statistics-updated', {
        data: stats,
        source: 'fetch'
      });

      return stats;
    } catch (error) {
      WinixRaffles.logger.warn("Помилка отримання статистики:", error);

      // Якщо є поточна статистика - використовуємо її
      if (this.currentStats) {
        return this.currentStats;
      }

      // Якщо є кешована статистика - використовуємо її
      const cachedStats = this.cache.getStats();
      if (cachedStats) {
        WinixRaffles.logger.log("Використання кешованої статистики після помилки");
        return cachedStats;
      }

      // Якщо немає кешу - повертаємо стандартні значення
      return this.analyzer.getDefaultStats();
    } finally {
      // Завжди скидаємо прапорець оновлення і приховуємо лоадер
      this.isUpdating = false;
      WinixRaffles.loader.hide('stats-update');
    }
  }

  /**
   * Оновлення статистики
   * @param {boolean} forceRefresh - Примусове оновлення з сервера
   * @returns {Promise<Object>} Проміс з актуальною статистикою
   */
  async updateStatistics(forceRefresh = false) {
    try {
      // Отримуємо дані з сервера/історії
      const stats = await this.fetchStatistics(forceRefresh);

      // Оновлюємо поточну статистику
      this.currentStats = stats;

      // Оновлюємо відображення, якщо елементи UI існують
      if (this.uiManager.checkUIElements()) {
        this.uiManager.updateStatistics(stats);
      }

      // Емітуємо подію про оновлення статистики
      WinixRaffles.events.emit('statistics-updated', {
        data: stats,
        source: 'update'
      });

      return stats;
    } catch (error) {
      WinixRaffles.logger.warn("Помилка оновлення статистики:", error);
      return this.currentStats || this.analyzer.getDefaultStats();
    }
  }

  /**
   * Відображення статистики користувача
   * @param {string} containerId - ID контейнера для відображення
   * @param {boolean} forceRefresh - Примусове оновлення даних
   */
  async displayUserStats(containerId = 'user-stats-container', forceRefresh = false) {
    const container = document.getElementById(containerId);
    if (!container) {
      WinixRaffles.logger.error(`Контейнер з ID '${containerId}' не знайдено`);
      return;
    }

    try {
      // Показуємо індикатор завантаження
      this.uiManager.renderLoadingState(container);

      // Перевіряємо підключення
      if (!this._isOnline() && !forceRefresh) {
        // В офлайн режимі використовуємо кешовані дані
        const cachedStats = this.cache.getStats();
        if (cachedStats) {
          this.uiManager.renderStatisticsUI(container, cachedStats);
          this.uiManager.updateStatistics(cachedStats);
          return;
        } else {
          this.uiManager.renderErrorState(container, "Статистика недоступна в офлайн режимі. Підключіться до Інтернету для оновлення.");
          return;
        }
      }

      // Отримуємо дані статистики
      const stats = await this.updateStatistics(forceRefresh);

      // Відображаємо статистику
      this.uiManager.renderStatisticsUI(container, stats);

      // Емітуємо подію про відображення статистики
      WinixRaffles.events.emit('statistics-displayed', {
        containerId,
        data: stats
      });
    } catch (error) {
      WinixRaffles.logger.error("Помилка відображення статистики:", error);
      this.uiManager.renderErrorState(container, "Не вдалося завантажити статистику. Спробуйте пізніше.");
    }
  }

  /**
   * Оновлення статистики на основі історії розіграшів
   * @param {Array} history - Масив історії розіграшів
   */
  updateStatsFromHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return;
    }

    WinixRaffles.logger.log(`Оновлення статистики з історії, ${history.length} записів`);

    // Розраховуємо статистику на основі історії
    const calculatedStats = this.analyzer.calculateStatsFromHistory(history);

    // Зберігаємо оновлену статистику
    this.currentStats = calculatedStats;
    this.cache.saveStats(calculatedStats);
    this.lastUpdateTime = Date.now();

    // Оновлюємо відображення, якщо елементи UI існують
    if (this.uiManager.checkUIElements()) {
      this.uiManager.updateStatistics(calculatedStats);
    }

    // Емітуємо подію про оновлення статистики
    WinixRaffles.events.emit('statistics-updated', {
      data: calculatedStats,
      source: 'history'
    });
  }

  /**
   * Оновлення статистики на основі участі в розіграші
   * @param {number} tokensSpent - Кількість витрачених жетонів
   * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
   */
  updateParticipationStats(tokensSpent, raffleType = 'daily') {
    // Перевіряємо, що переданий коректний параметр
    if (isNaN(tokensSpent) || tokensSpent < 0) {
      WinixRaffles.logger.warn('Некоректне значення витрачених жетонів:', tokensSpent);
      return;
    }

    // Оновлюємо статистику
    const updatedStats = this.analyzer.updateStatsAfterParticipation(
      this.currentStats || this.cache.getStats() || this.analyzer.getDefaultStats(),
      tokensSpent,
      raffleType
    );

    // Зберігаємо оновлену статистику
    this.currentStats = updatedStats;
    this.cache.saveStats(updatedStats);
    this.lastUpdateTime = Date.now();

    // Оновлюємо відображення, якщо елементи UI існують
    if (this.uiManager.checkUIElements()) {
      this.uiManager.updateStatistics(updatedStats);
    }

    WinixRaffles.logger.log(`Оновлено статистику участі, +${tokensSpent} жетонів, тип: ${raffleType}`);

    // Емітуємо подію про оновлення статистики
    WinixRaffles.events.emit('statistics-updated', {
      data: updatedStats,
      source: 'participation'
    });
  }

  /**
   * Оновлення статистики на основі виграшу в розіграші
   * @param {number} winixAmount - Кількість виграних WINIX
   * @param {string} raffleType - Тип розіграшу ('daily' або 'main')
   * @param {string} raffleId - ID розіграшу
   * @param {Object} details - Деталі розіграшу
   */
  updateWinStats(winixAmount, raffleType = 'daily', raffleId, details = {}) {
    // Перевіряємо, що переданий коректний параметр
    if (isNaN(winixAmount) || winixAmount < 0) {
      WinixRaffles.logger.warn('Некоректне значення виграшу WINIX:', winixAmount);
      return;
    }

    // Оновлюємо статистику
    const updatedStats = this.analyzer.updateStatsAfterWin(
      this.currentStats || this.cache.getStats() || this.analyzer.getDefaultStats(),
      winixAmount,
      raffleType,
      {
        raffleId,
        ...details
      }
    );

    // Зберігаємо оновлену статистику
    this.currentStats = updatedStats;
    this.cache.saveStats(updatedStats);
    this.lastUpdateTime = Date.now();

    // Оновлюємо відображення, якщо елементи UI існують
    if (this.uiManager.checkUIElements()) {
      this.uiManager.updateStatistics(updatedStats);
    }

    WinixRaffles.logger.log(`Оновлено статистику виграшів, +${winixAmount} WINIX, тип: ${raffleType}`);

    // Емітуємо подію про оновлення статистики
    WinixRaffles.events.emit('statistics-updated', {
      data: updatedStats,
      source: 'win'
    });
  }

  /**
   * Очищення ресурсів при закритті модуля
   */
  destroy() {
    // Видаляємо обробники подій
    this._removeEventListeners();

    // Приховуємо лоадер, якщо він активний
    WinixRaffles.loader.hide('stats-update');

    WinixRaffles.logger.log("Модуль статистики закрито");
  }
}

// Створюємо екземпляр класу
const statisticsModule = new StatisticsModule();

// Оновлюємо експорт для єдиної системи
export default {
  /**
   * Ініціалізація модуля статистики
   */
  init: async function() {
    try {
      await statisticsModule.init();

      // Експортуємо методи для зворотної сумісності
      WinixRaffles.stats = statisticsModule;

      // Реєструємо модуль в системі WinixRaffles (для нової архітектури)
      if (typeof WinixRaffles.registerModule === 'function') {
        WinixRaffles.registerModule('stats', {
          init: statisticsModule.init.bind(statisticsModule),
          refresh: statisticsModule.refresh.bind(statisticsModule),
          fetchStatistics: statisticsModule.fetchStatistics.bind(statisticsModule),
          displayUserStats: statisticsModule.displayUserStats.bind(statisticsModule),
          updateStatistics: statisticsModule.updateStatistics.bind(statisticsModule),
          destroy: statisticsModule.destroy.bind(statisticsModule)
        });
      }

      return statisticsModule;
    } catch (error) {
      WinixRaffles.logger.error("Помилка ініціалізації модуля статистики:", error);
      throw error;
    }
  },

  /**
   * Метод оновлення даних
   * @param {boolean} [forceRefresh=false] Примусове оновлення
   * @returns {Promise<Object>} Статистика
   */
  refresh: function(forceRefresh = false) {
    return statisticsModule.refresh(forceRefresh);
  },

  /**
   * Знищення модуля
   */
  destroy: function() {
    statisticsModule.destroy();
  }
};