// referrals-integration.js
/**
 * Головний інтеграційний модуль для реферальної системи
 * Ініціалізує всі компоненти та забезпечує взаємодію з DOM
 */

class ReferralIntegration {
  constructor() {
    this.userId = null;
    this.store = null;
    this.isInitialized = false;
  }

  /**
   * Ініціалізація реферальної системи
   */
  async init() {
    try {
      console.log('🚀 [INTEGRATION] Ініціалізація реферальної системи...');

      // Отримуємо ID користувача
      this.userId = this.getUserId();
      if (!this.userId) {
        throw new Error('Не вдалося отримати ID користувача');
      }

      console.log('✅ [INTEGRATION] ID користувача:', this.userId);

      // Ініціалізуємо сховище
      this.initStore();

      // Ініціалізуємо UI
      await this.initUI();

      // Завантажуємо початкові дані
      await this.loadInitialData();

      // Встановлюємо обробники подій
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('🎉 [INTEGRATION] Реферальна система успішно ініціалізована!');

    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка ініціалізації:', error);
      throw error;
    }
  }

  /**
   * Отримує ID користувача з різних джерел
   */
  getUserId() {
    // Спочатку пробуємо з Telegram
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
    }

    // Потім з localStorage
    const storedId = localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
    if (storedId) {
      return storedId;
    }

    // Якщо нічого немає, використовуємо тестовий ID
    console.warn('[INTEGRATION] ID користувача не знайдено, використовуємо тестовий');
    return 'test_user_123';
  }

  /**
   * Ініціалізує Redux сховище
   */
  initStore() {
    console.log('🔧 [INTEGRATION] Ініціалізація сховища...');

    try {
      this.store = window.ReferralStore.configureReferralStore({
        referralLink: window.ReferralStore.referralLinkReducer,
        directBonus: window.ReferralStore.directBonusReducer,
        referralLevels: window.ReferralStore.referralLevelsReducer,
        badges: window.ReferralStore.badgeReducer
      });

      // Підписуємося на зміни стану
      this.store.subscribe(() => {
        this.handleStateChange();
      });

      console.log('✅ [INTEGRATION] Сховище ініціалізовано');
    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка ініціалізації сховища:', error);
      throw error;
    }
  }

  /**
   * Ініціалізує інтерфейс користувача
   */
  async initUI() {
    console.log('🎨 [INTEGRATION] Ініціалізація UI...');

    try {
      // Встановлюємо ID користувача в заголовку
      this.setUserIdInHeader();

      // Ініціалізуємо реферальне посилання
      await this.initReferralLink();

      // Ініціалізуємо відображення винагород
      this.initRewardsDisplay();

      console.log('✅ [INTEGRATION] UI ініціалізовано');
    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка ініціалізації UI:', error);
      throw error;
    }
  }

  /**
   * Встановлює ID користувача в заголовку
   */
  setUserIdInHeader() {
    const userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
    userIdElements.forEach(element => {
      if (element) {
        element.textContent = this.userId;
      }
    });
  }

  /**
   * Ініціалізує реферальне посилання
   */
  async initReferralLink() {
    try {
      console.log('🔗 [INTEGRATION] Генерація реферального посилання...');

      // Диспатчимо дію для отримання посилання
      await this.store.dispatch(window.ReferralStore.fetchReferralLink(this.userId));

    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка генерації реферального посилання:', error);
      // Встановлюємо fallback посилання
      this.updateReferralLinkDisplay(`Winix/referral/${this.userId}`);
    }
  }

  /**
   * Оновлює відображення реферального посилання
   */
  updateReferralLinkDisplay(link) {
    const linkDisplay = document.querySelector('.link-display');
    if (linkDisplay) {
      linkDisplay.textContent = link;
      linkDisplay.dataset.link = link;
    }
  }

  /**
   * Ініціалізує відображення винагород
   */
  initRewardsDisplay() {
    // Встановлюємо базові значення винагород
    const bonusAmountElements = document.querySelectorAll('.bonus-amount');
    bonusAmountElements.forEach(element => {
      element.textContent = window.DIRECT_BONUS_AMOUNT || '50';
    });

    // Встановлюємо пороги для бейджів
    this.updateBadgeThresholds();
  }

  /**
   * Оновлює пороги для бейджів
   */
  updateBadgeThresholds() {
    const thresholdElements = {
      '.bronze-threshold': window.BRONZE_BADGE_THRESHOLD || 25,
      '.silver-threshold': window.SILVER_BADGE_THRESHOLD || 50,
      '.gold-threshold': window.GOLD_BADGE_THRESHOLD || 100,
      '.platinum-threshold': window.PLATINUM_BADGE_THRESHOLD || 500
    };

    Object.entries(thresholdElements).forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    });

    const rewardElements = {
      '.bronze-reward': window.BRONZE_BADGE_REWARD || 2500,
      '.silver-reward': window.SILVER_BADGE_REWARD || 5000,
      '.gold-reward': window.GOLD_BADGE_REWARD || 10000,
      '.platinum-reward': window.PLATINUM_BADGE_REWARD || 20000
    };

    Object.entries(rewardElements).forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    });
  }

  /**
   * Завантажує початкові дані
   */
  async loadInitialData() {
    console.log('📊 [INTEGRATION] Завантаження початкових даних...');

    try {
      // Завантажуємо базові дані паралельно
      await Promise.all([
        this.loadReferralStats(),
        this.loadBadgesData(),
        this.loadDirectBonusHistory()
      ]);

      console.log('✅ [INTEGRATION] Початкові дані завантажено');
    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка завантаження даних:', error);
      // Не перериваємо ініціалізацію, показуємо базовий UI
    }
  }

  /**
   * Завантажує статистику рефералів
   */
  async loadReferralStats() {
    try {
      const statsData = await window.ReferralAPI.fetchReferralStats(this.userId);
      this.updateReferralStatsDisplay(statsData);
    } catch (error) {
      console.error('Помилка завантаження статистики рефералів:', error);
    }
  }

  /**
   * Завантажує дані про бейджі
   */
  async loadBadgesData() {
    try {
      await this.store.dispatch(window.ReferralStore.fetchUserBadges(this.userId));
    } catch (error) {
      console.error('Помилка завантаження бейджів:', error);
    }
  }

  /**
   * Завантажує історію прямих бонусів
   */
  async loadDirectBonusHistory() {
    try {
      await this.store.dispatch(window.ReferralStore.fetchDirectBonusHistory(this.userId));
    } catch (error) {
      console.error('Помилка завантаження історії бонусів:', error);
    }
  }

  /**
   * Оновлює відображення статистики рефералів
   */
  updateReferralStatsDisplay(statsData) {
    if (!statsData || !statsData.statistics) return;

    const stats = statsData.statistics;

    // Оновлюємо загальні показники
    this.updateElement('.total-referrals-count', stats.totalReferralsCount || 0);
    this.updateElement('.active-referrals-count', stats.activeReferralsCount || 0);

    const conversionRate = stats.totalReferralsCount > 0
      ? ((stats.activeReferralsCount / stats.totalReferralsCount) * 100).toFixed(1)
      : '0';
    this.updateElement('.conversion-rate', `${conversionRate}%`);

    // Оновлюємо статистику активності
    this.updateElement('#active-referrals-count', stats.activeReferralsCount || 0);
    this.updateElement('#inactive-referrals-count', (stats.totalReferralsCount || 0) - (stats.activeReferralsCount || 0));
    this.updateElement('#conversion-rate', `${conversionRate}%`);

    // Оновлюємо прогрес бейджів
    this.updateBadgeProgress(stats.totalReferralsCount || 0);
  }

  /**
   * Оновлює прогрес бейджів
   */
  updateBadgeProgress(referralsCount) {
    const badgeProgress = window.ReferralServices.checkBadgesProgress(referralsCount);

    if (badgeProgress) {
      // Оновлюємо загальну статистику бейджів
      this.updateElement('#earned-badges-count', badgeProgress.earnedBadgesCount);
      this.updateElement('#remaining-badges-count', 4 - badgeProgress.earnedBadgesCount);

      // Оновлюємо прогрес наступного бейджа
      if (badgeProgress.nextBadge) {
        const nextBadgeTitle = this.getBadgeTitle(badgeProgress.nextBadge.type);
        document.querySelector('.next-badge-title').textContent = `Наступний бейдж: ${nextBadgeTitle}`;

        const progressPercent = Math.round(badgeProgress.nextBadge.progress);
        const progressBar = document.querySelector('.next-badge-container .progress-fill');
        if (progressBar) {
          progressBar.style.width = `${progressPercent}%`;
        }

        const progressText = document.querySelector('.next-badge-container .progress-text');
        if (progressText) {
          progressText.textContent = `${progressPercent}% (${referralsCount}/${badgeProgress.nextBadge.threshold})`;
        }

        const remainingText = document.querySelector('.next-badge-remaining');
        if (remainingText) {
          remainingText.textContent = `Залишилось: ${badgeProgress.nextBadge.remaining} рефералів`;
        }
      }

      // Оновлюємо індивідуальні прогрес-бари бейджів
      badgeProgress.badgeProgress.forEach(badge => {
        this.updateBadgeItem(badge);
      });
    }
  }

  /**
   * Оновлює конкретний елемент бейджа
   */
  updateBadgeItem(badge) {
    const badgeClass = badge.type.toLowerCase();
    const badgeItem = document.querySelector(`.badge-item:has(.${badgeClass}-icon)`);

    if (badgeItem) {
      const progressBar = badgeItem.querySelector('.badge-progress-fill');
      const progressText = badgeItem.querySelector('.badge-progress-text');
      const button = badgeItem.querySelector('.claim-badge-button');

      if (progressBar) {
        progressBar.style.width = `${badge.progress}%`;
      }

      if (progressText) {
        const current = Math.round((badge.progress / 100) * badge.threshold);
        progressText.textContent = `${Math.round(badge.progress)}% (${current}/${badge.threshold})`;
      }

      if (button) {
        if (badge.isEligible) {
          button.textContent = 'Отримати';
          button.disabled = false;
          badgeItem.classList.remove('not-eligible');
          badgeItem.classList.add('eligible');
        } else {
          button.textContent = 'Недоступно';
          button.disabled = true;
          badgeItem.classList.add('not-eligible');
          badgeItem.classList.remove('eligible');
        }
      }
    }
  }

  /**
   * Повертає назву бейджа українською
   */
  getBadgeTitle(badgeType) {
    const titles = {
      'BRONZE': 'Сміливець',
      'SILVER': 'Новатор',
      'GOLD': 'Легенда',
      'PLATINUM': 'Візіонер'
    };
    return titles[badgeType] || badgeType;
  }

  /**
   * Допоміжна функція для оновлення тексту елемента
   */
  updateElement(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Встановлює обробники подій
   */
  setupEventListeners() {
    console.log('🎯 [INTEGRATION] Встановлення обробників подій...');

    // Обробник для кнопок отримання винагороди за бейджі
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('claim-badge-button') && !event.target.disabled) {
        const badgeType = event.target.dataset.badge;
        if (badgeType) {
          this.handleClaimBadge(badgeType, event.target);
        }
      }
    });

    console.log('✅ [INTEGRATION] Обробники подій встановлено');
  }

  /**
   * Обробник отримання винагороди за бейдж
   */
  async handleClaimBadge(badgeType, button) {
    try {
      // Діактивуємо кнопку
      button.disabled = true;
      button.textContent = 'Отримуємо...';

      // Викликаємо дію
      const result = await this.store.dispatch(
        window.ReferralStore.claimBadgeReward(this.userId, badgeType)
      );

      if (result.success) {
        // Показуємо повідомлення про успіх
        this.showSuccessMessage(`Винагорода за бейдж "${this.getBadgeTitle(badgeType)}" отримана!`);

        // Оновлюємо відображення
        button.textContent = 'Отримано';
        button.classList.add('claimed');

        // Перезавантажуємо дані
        await this.loadBadgesData();
        await this.loadReferralStats();
      } else {
        throw new Error(result.error || 'Невідома помилка');
      }
    } catch (error) {
      console.error('Помилка отримання винагороди за бейдж:', error);
      this.showErrorMessage('Помилка отримання винагороди. Спробуйте пізніше.');

      // Відновлюємо кнопку
      button.disabled = false;
      button.textContent = 'Отримати';
    }
  }

  /**
   * Показує повідомлення про успіх
   */
  showSuccessMessage(message) {
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'success');
      setTimeout(() => {
        toast.classList.remove('show', 'success');
      }, 3000);
    }
  }

  /**
   * Показує повідомлення про помилку
   */
  showErrorMessage(message) {
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'error');
      setTimeout(() => {
        toast.classList.remove('show', 'error');
      }, 3000);
    }
  }

  /**
   * Обробляє зміни стану
   */
  handleStateChange() {
    const state = this.store.getState();

    // Обробляємо зміни реферального посилання
    if (state.referralLink?.link) {
      this.updateReferralLinkDisplay(state.referralLink.link);
    }

    // Обробляємо зміни історії бонусів
    if (state.directBonus?.history) {
      this.updateBonusHistory(state.directBonus.history);
    }
  }

  /**
   * Оновлює відображення історії бонусів
   */
  updateBonusHistory(history) {
    const container = document.querySelector('.bonus-history-items');
    if (!container || !Array.isArray(history)) return;

    container.innerHTML = '';

    if (history.length === 0) {
      container.innerHTML = '<p style="color: #888; text-align: center;">Поки що немає історії бонусів</p>';
      return;
    }

    history.slice(0, 5).forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'bonus-history-item';

      const date = new Date(item.timestamp).toLocaleDateString('uk-UA');

      historyItem.innerHTML = `
        <div class="bonus-history-icon"></div>
        <div class="bonus-history-details">
          <div class="bonus-history-title">Реферальний бонус</div>
          <div class="bonus-history-amount">+${item.bonusAmount || window.DIRECT_BONUS_AMOUNT} winix</div>
          <div class="bonus-history-date">${date}</div>
        </div>
      `;

      container.appendChild(historyItem);
    });
  }
}

// Глобальна функція ініціалізації
export const initReferralSystem = async () => {
  try {
    console.log('🎬 [INTEGRATION] Запуск ініціалізації реферальної системи...');

    const integration = new ReferralIntegration();
    await integration.init();

    // Зберігаємо екземпляр глобально для налагодження
    window.ReferralIntegration = integration;

    console.log('🏁 [INTEGRATION] Ініціалізація завершена успішно!');
    return integration;
  } catch (error) {
    console.error('💥 [INTEGRATION] Критична помилка ініціалізації:', error);
    throw error;
  }
};