// Integration.js - Виправлена версія без fallback на mock дані
/**
 * Головний інтеграційний модуль для реферальної системи
 * Ініціалізує всі компоненти та забезпечує взаємодію з DOM
 */
window.ReferralIntegration = (function() {
  'use strict';

  function ReferralIntegration() {
    this.userId = null;
    this.store = null;
    this.isInitialized = false;
  }

  /**
   * Ініціалізація реферальної системи
   */
  ReferralIntegration.prototype.init = function() {
    const self = this;

    return new Promise(function(resolve, reject) {
      try {
        console.log('🚀 [INTEGRATION] Ініціалізація реферальної системи...');

        // Отримуємо ID користувача
        self.userId = self.getUserId();
        if (!self.userId) {
          throw new Error('Не вдалося отримати ID користувача');
        }

        console.log('✅ [INTEGRATION] ID користувача:', self.userId);

        // Ініціалізуємо сховище
        self.initStore();

        // Ініціалізуємо UI
        self.initUI()
          .then(function() {
            // Завантажуємо початкові дані
            return self.loadInitialData();
          })
          .then(function() {
            // Встановлюємо обробники подій
            self.setupEventListeners();

            self.isInitialized = true;
            console.log('🎉 [INTEGRATION] Реферальна система успішно ініціалізована!');
            resolve(self);
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] Помилка ініціалізації:', error);
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] Помилка ініціалізації:', error);
        reject(error);
      }
    });
  };

  /**
   * Отримує ID користувача з різних джерел
   */
  ReferralIntegration.prototype.getUserId = function() {
    console.log('🔍 [INTEGRATION] Спроба отримання ID користувача з усіх доступних джерел');

    // Спочатку пробуємо з WinixAPI якщо він доступний
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
      try {
        const apiId = window.WinixAPI.getUserId();
        if (apiId && apiId !== 'undefined' && apiId !== 'null') {
          console.log('🔍 [INTEGRATION] Знайдено ID у WinixAPI:', apiId);
          return parseInt(apiId);
        }
      } catch (e) {
        console.warn('⚠️ [INTEGRATION] Помилка отримання ID через WinixAPI:', e);
      }
    }

    // Потім пробуємо з Telegram
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe &&
        window.Telegram.WebApp.initDataUnsafe.user && window.Telegram.WebApp.initDataUnsafe.user.id) {
        const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
        console.log('🔍 [INTEGRATION] Знайдено ID у Telegram WebApp:', tgUserId);
        return parseInt(tgUserId);
    }

    // Потім з localStorage
    const storedId = localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
    console.log('🔍 [INTEGRATION] ID у localStorage:', storedId);
    if (storedId) {
        const numericId = parseInt(storedId);
        if (!isNaN(numericId)) {
            return numericId;
        }
    }

    // Якщо нічого немає, використовуємо тестовий ID
    console.warn('⚠️ [INTEGRATION] ID користувача не знайдено, використовуємо тестовий');
    return 6859825214; // Тестовий ID як числове значення
  };

  /**
   * Ініціалізує Redux сховище
   */
  ReferralIntegration.prototype.initStore = function() {
    console.log('🔧 [INTEGRATION] Ініціалізація сховища...');

    try {
      this.store = window.ReferralStore.configureReferralStore({
        referralLink: window.ReferralStore.referralLinkReducer,
        directBonus: window.ReferralStore.directBonusReducer,
        referralLevels: window.ReferralStore.referralLevelsReducer,
        badges: window.ReferralStore.badgeReducer
      });

      // Підписуємося на зміни стану
      const self = this;
      this.store.subscribe(function() {
        self.handleStateChange();
      });

      console.log('✅ [INTEGRATION] Сховище ініціалізовано');
    } catch (error) {
      console.error('❌ [INTEGRATION] Помилка ініціалізації сховища:', error);
      throw error;
    }
  };

  /**
   * Ініціалізує інтерфейс користувача
   */
  ReferralIntegration.prototype.initUI = function() {
    const self = this;

    return new Promise(function(resolve, reject) {
      console.log('🎨 [INTEGRATION] Ініціалізація UI...');

      try {
        // Встановлюємо ID користувача в заголовку
        self.setUserIdInHeader();

        // Ініціалізуємо реферальне посилання
        self.initReferralLink()
          .then(function() {
            // Ініціалізуємо відображення винагород
            self.initRewardsDisplay();

            console.log('✅ [INTEGRATION] UI ініціалізовано');
            resolve();
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] Помилка ініціалізації UI:', error);
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] Помилка ініціалізації UI:', error);
        reject(error);
      }
    });
  };

  /**
   * Встановлює ID користувача в заголовку
   */
  ReferralIntegration.prototype.setUserIdInHeader = function() {
    const userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
    const self = this;

    userIdElements.forEach(function(element) {
      if (element) {
        element.textContent = self.userId;
      }
    });
  };

  /**
   * Ініціалізує реферальне посилання
   */
  ReferralIntegration.prototype.initReferralLink = function() {
    const self = this;

    return new Promise(function(resolve, reject) {
      try {
        console.log('🔗 [INTEGRATION] Генерація реферального посилання...');

        // Диспатчимо дію для отримання посилання
        self.store.dispatch(window.ReferralStore.fetchReferralLink(self.userId))
          .then(function() {
            resolve();
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] Помилка генерації реферального посилання:', error);
            self.showErrorMessage('Не вдалося отримати реферальне посилання. Спробуйте пізніше.');
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] Помилка генерації реферального посилання:', error);
        self.showErrorMessage('Не вдалося отримати реферальне посилання. Спробуйте пізніше.');
        reject(error);
      }
    });
  };

  /**
   * Оновлює відображення реферального посилання
   */
  ReferralIntegration.prototype.updateReferralLinkDisplay = function(link) {
    const linkDisplay = document.querySelector('.link-display');
    if (linkDisplay) {
        // Переконаємося, що link це рядок
        if (typeof link !== 'string') {
            console.warn("⚠️ [INTEGRATION] Отримано некоректний формат посилання:", link);
            // Отримаємо ID користувача
            const userId = this.userId || localStorage.getItem('telegram_user_id') || '6859825214';
            link = 'https://t.me/WINIX_Official_bot?start=' + userId;
        }

        linkDisplay.textContent = link;
        linkDisplay.dataset.link = link;
    }
  };

  /**
   * Ініціалізує відображення винагород
   */
  ReferralIntegration.prototype.initRewardsDisplay = function() {
    // Встановлюємо базові значення винагород
    const bonusAmountElements = document.querySelectorAll('.bonus-amount');
    bonusAmountElements.forEach(function(element) {
      element.textContent = window.ReferralConstants.DIRECT_BONUS_AMOUNT || '50';
    });

    // Встановлюємо пороги для бейджів
    this.updateBadgeThresholds();
  };

  /**
   * Оновлює пороги для бейджів
   */
  ReferralIntegration.prototype.updateBadgeThresholds = function() {
    const thresholdElements = {
      '.bronze-threshold': window.ReferralConstants.BRONZE_BADGE_THRESHOLD || 25,
      '.silver-threshold': window.ReferralConstants.SILVER_BADGE_THRESHOLD || 50,
      '.gold-threshold': window.ReferralConstants.GOLD_BADGE_THRESHOLD || 100,
      '.platinum-threshold': window.ReferralConstants.PLATINUM_BADGE_THRESHOLD || 500
    };

    Object.keys(thresholdElements).forEach(function(selector) {
      const value = thresholdElements[selector];
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    });

    const rewardElements = {
      '.bronze-reward': window.ReferralConstants.BRONZE_BADGE_REWARD || 2500,
      '.silver-reward': window.ReferralConstants.SILVER_BADGE_REWARD || 5000,
      '.gold-reward': window.ReferralConstants.GOLD_BADGE_REWARD || 10000,
      '.platinum-reward': window.ReferralConstants.PLATINUM_BADGE_REWARD || 20000
    };

    Object.keys(rewardElements).forEach(function(selector) {
      const value = rewardElements[selector];
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    });
  };

  /**
   * Завантажує початкові дані
   */
  ReferralIntegration.prototype.loadInitialData = function() {
    const self = this;
    const maxRetries = 3;
    let retryCount = 0;

    function attemptLoad() {
      return new Promise(function(resolve, reject) {
        console.log('📊 [INTEGRATION] Завантаження початкових даних...');

        // Завантажуємо базові дані паралельно
        Promise.all([
          self.loadReferralStats(),
          self.loadBadgesData(),
          self.loadDirectBonusHistory()
        ])
        .then(function() {
          console.log('✅ [INTEGRATION] Початкові дані завантажено');
          resolve();
        })
        .catch(function(error) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`❌ [INTEGRATION] Помилка завантаження даних (спроба ${retryCount}/${maxRetries}):`, error);
            setTimeout(function() {
              attemptLoad().then(resolve).catch(reject);
            }, 1000 * retryCount); // Збільшуємо затримку з кожною спробою
          } else {
            console.error('❌ [INTEGRATION] Помилка завантаження даних:', error);
            self.showErrorMessage('Не вдалося завантажити дані. Перевірте підключення до інтернету.');
            reject(error);
          }
        });
      });
    }

    return attemptLoad();
  };

  /**
   * Завантажує статистику рефералів
   */
  ReferralIntegration.prototype.loadReferralStats = function() {
    const self = this;
    console.log('🔄 [INTEGRATION] Запит статистики рефералів з API для ID:', this.userId);

    return window.ReferralAPI.fetchReferralStats(this.userId)
      .then(function(statsData) {
        console.log('✅ [INTEGRATION] Отримано статистику рефералів:', JSON.stringify(statsData));
        self.updateReferralStatsDisplay(statsData);
        return statsData;
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] Помилка завантаження статистики рефералів:', error);
        console.error('❌ [INTEGRATION] Stack trace:', error.stack);

        // Повертаємо базову структуру даних при помилці
        const fallbackData = {
          success: true,
          source: 'fallback_error',
          statistics: {
            totalReferrals: 0,
            activeReferrals: 0,
            conversionRate: 0
          },
          referrals: {
            level1: [],
            level2: []
          }
        };

        self.updateReferralStatsDisplay(fallbackData);
        return fallbackData;
      });
  };

  /**
   * Завантажує дані про бейджі
   */
  ReferralIntegration.prototype.loadBadgesData = function() {
    const self = this;
    return this.store.dispatch(window.ReferralStore.fetchUserBadges(this.userId))
      .catch(function(error) {
        console.error('❌ [INTEGRATION] Помилка завантаження бейджів:', error);
        // Все одно повертаємо дані, щоб не блокувати ланцюжок промісів
        return {
          success: true,
          earnedBadges: [],
          availableBadges: [],
          badgesProgress: []
        };
      });
  };

  /**
   * Завантажує історію прямих бонусів
   */
  ReferralIntegration.prototype.loadDirectBonusHistory = function() {
    const self = this;
    return this.store.dispatch(window.ReferralStore.fetchDirectBonusHistory(this.userId))
      .catch(function(error) {
        console.error('❌ [INTEGRATION] Помилка завантаження історії бонусів:', error);
        // Повертаємо базову структуру при помилці
        return {
          totalBonus: 0,
          history: []
        };
      });
  };

  /**
   * Оновлює відображення статистики рефералів
   */
  ReferralIntegration.prototype.updateReferralStatsDisplay = function(statsData) {
    console.log('📊 [INTEGRATION] Оновлення відображення статистики:', statsData);

    // Установка даних за замовчуванням, якщо не отримано дані
    const stats = {
        totalReferrals: 0,
        activeReferrals: 0,
        inactiveReferrals: 0,
        conversionRate: "0"
    };

    // Перевіряємо наявність даних і джерело
    if (!statsData) {
        console.warn('⚠️ [INTEGRATION] Відсутні дані статистики');
    } else {
        console.log('📊 [INTEGRATION] Джерело даних:', statsData.source || 'unknown');
    }

    // Обробка для різних форматів відповіді
    if (statsData && statsData.statistics) {
        stats.totalReferrals = statsData.statistics.totalReferrals || 0;
        stats.activeReferrals = statsData.statistics.activeReferrals || 0;
        stats.inactiveReferrals = stats.totalReferrals - stats.activeReferrals;

        // Розрахунок відсотка конверсії
        if (stats.totalReferrals > 0) {
            stats.conversionRate = ((stats.activeReferrals / stats.totalReferrals) * 100).toFixed(1);
        }
    } else if (statsData && statsData.referrals) {
        // Альтернативний формат відповіді
        if (Array.isArray(statsData.referrals.level1)) {
            stats.totalReferrals = statsData.referrals.level1.length;
            stats.activeReferrals = statsData.referrals.level1.filter(ref => ref.active).length;
            stats.inactiveReferrals = stats.totalReferrals - stats.activeReferrals;

            if (stats.totalReferrals > 0) {
                stats.conversionRate = ((stats.activeReferrals / stats.totalReferrals) * 100).toFixed(1);
            }
        }
    } else if (statsData && typeof statsData.totalReferrals === 'number') {
        // Пряме передавання значень
        stats.totalReferrals = statsData.totalReferrals;
        stats.activeReferrals = statsData.activeReferrals || 0;
        stats.inactiveReferrals = stats.totalReferrals - stats.activeReferrals;
        stats.conversionRate = ((stats.activeReferrals / stats.totalReferrals) * 100).toFixed(1);
    }

    console.log('📊 [INTEGRATION] Розраховані значення для відображення:', stats);

    // Оновлюємо загальні показники
    this.updateElement('.total-referrals-count', stats.totalReferrals);
    this.updateElement('.active-referrals-count', stats.activeReferrals);
    this.updateElement('.conversion-rate', stats.conversionRate + '%');

    // Оновлюємо статистику активності
    this.updateElement('#active-referrals-count', stats.activeReferrals);
    this.updateElement('#inactive-referrals-count', stats.inactiveReferrals);
    this.updateElement('#conversion-rate', stats.conversionRate + '%');

    // Оновлюємо прогрес бейджів
    this.updateBadgeProgress(stats.totalReferrals);
  };

  /**
   * Оновлює прогрес бейджів
   */
  ReferralIntegration.prototype.updateBadgeProgress = function(referralsCount) {
    console.log('🔄 [INTEGRATION] Оновлення прогресу бейджів для кількості рефералів:', referralsCount);

    if (!window.ReferralServices || !window.ReferralServices.checkBadgesProgress) {
        console.warn('⚠️ [INTEGRATION] ReferralServices недоступний для розрахунку прогресу бейджів');
        return;
    }

    // Переконаємося, що це число, а не текст
    referralsCount = parseInt(referralsCount) || 0;

    const badgeProgress = window.ReferralServices.checkBadgesProgress(referralsCount);
    console.log('📊 [INTEGRATION] Розрахований прогрес бейджів:', badgeProgress);

    if (badgeProgress) {
        // Оновлюємо загальну статистику бейджів
        this.updateElement('#earned-badges-count', badgeProgress.earnedBadgesCount);
        this.updateElement('#remaining-badges-count', 4 - badgeProgress.earnedBadgesCount);

        // Оновлюємо прогрес наступного бейджа
        if (badgeProgress.nextBadge) {
            const nextBadgeTitle = this.getBadgeTitle(badgeProgress.nextBadge.type);
            const nextBadgeTitleElement = document.querySelector('.next-badge-title');
            if (nextBadgeTitleElement) {
                nextBadgeTitleElement.textContent = 'Наступний бейдж: ' + nextBadgeTitle;
            }

            const progressPercent = Math.round(badgeProgress.nextBadge.progress);
            const progressBar = document.querySelector('.next-badge-container .progress-fill');
            if (progressBar) {
                progressBar.style.width = progressPercent + '%';
            }

            const progressText = document.querySelector('.next-badge-container .progress-text');
            if (progressText) {
                progressText.textContent = progressPercent + '% (' + referralsCount + '/' + badgeProgress.nextBadge.threshold + ')';
            }

            const remainingText = document.querySelector('.next-badge-remaining');
            if (remainingText) {
                remainingText.textContent = 'Залишилось: ' + badgeProgress.nextBadge.remaining + ' рефералів';
            }
        }

        // Оновлюємо індивідуальні прогрес-бари бейджів
        const self = this;
        badgeProgress.badgeProgress.forEach(function(badge) {
            self.updateBadgeItem(badge);
        });
    }
  };

  /**
   * Оновлює конкретний елемент бейджа
   */
  ReferralIntegration.prototype.updateBadgeItem = function(badge) {
    const badgeClass = badge.type.toLowerCase();
    const badgeItems = document.querySelectorAll('.badge-item');
    let badgeItem = null;

    // Знаходимо елемент бейджа за іконкою
    badgeItems.forEach(function(item) {
      if (item.querySelector('.' + badgeClass + '-icon')) {
        badgeItem = item;
      }
    });

    if (badgeItem) {
      const progressBar = badgeItem.querySelector('.badge-progress-fill');
      const progressText = badgeItem.querySelector('.badge-progress-text');
      const button = badgeItem.querySelector('.claim-badge-button');

      if (progressBar) {
        progressBar.style.width = badge.progress + '%';
      }

      if (progressText) {
        const current = Math.min(Math.round((badge.progress / 100) * badge.threshold), badge.threshold);
        progressText.textContent = Math.round(badge.progress) + '% (' + current + '/' + badge.threshold + ')';
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
  };

  /**
   * Повертає назву бейджа українською
   */
  ReferralIntegration.prototype.getBadgeTitle = function(badgeType) {
    const titles = {
      'BRONZE': 'Сміливець',
      'SILVER': 'Новатор',
      'GOLD': 'Легенда',
      'PLATINUM': 'Візіонер'
    };
    return titles[badgeType] || badgeType;
  };

  /**
   * Допоміжна функція для оновлення тексту елемента
   */
  ReferralIntegration.prototype.updateElement = function(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  };

  /**
   * Встановлює обробники подій
   */
  ReferralIntegration.prototype.setupEventListeners = function() {
    console.log('🎯 [INTEGRATION] Встановлення обробників подій...');

    const self = this;

    // Обробник для кнопок отримання винагороди за бейджі
    document.addEventListener('click', function(event) {
      if (event.target.classList.contains('claim-badge-button') && !event.target.disabled) {
        const badgeType = event.target.dataset.badge;
        if (badgeType) {
          self.handleClaimBadge(badgeType, event.target);
        }
      }
    });

    // Обробник для копіювання реферального посилання
    const copyButton = document.querySelector('.copy-link-button');
    if (copyButton) {
      copyButton.addEventListener('click', function() {
        const linkDisplay = document.querySelector('.link-display');
        if (linkDisplay && linkDisplay.dataset.link) {
          try {
            navigator.clipboard.writeText(linkDisplay.dataset.link).then(function() {
              self.showSuccessMessage('Посилання скопійовано!');
            }).catch(function(err) {
              console.error('❌ [INTEGRATION] Помилка копіювання посилання:', err);
              // Fallback для старих браузерів
              self.fallbackCopyToClipboard(linkDisplay.dataset.link);
            });
          } catch (e) {
            console.error('❌ [INTEGRATION] Помилка копіювання посилання:', e);
            self.fallbackCopyToClipboard(linkDisplay.dataset.link);
          }
        }
      });
    }

    console.log('✅ [INTEGRATION] Обробники подій встановлено');
  };

  /**
   * Резервне копіювання в буфер обміну
   */
  ReferralIntegration.prototype.fallbackCopyToClipboard = function(text) {
    const self = this;

    try {
      // Створюємо тимчасовий елемент
      const textarea = document.createElement('textarea');
      textarea.value = text;

      // Ховаємо елемент від користувача
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = 0;
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          self.showSuccessMessage('Посилання скопійовано!');
        } else {
          self.showErrorMessage('Не вдалося скопіювати посилання');
        }
      } catch (err) {
        console.error('❌ [INTEGRATION] Помилка execCommand:', err);
        self.showErrorMessage('Не вдалося скопіювати посилання');
      }

      document.body.removeChild(textarea);
    } catch (e) {
      console.error('❌ [INTEGRATION] Помилка fallbackCopyToClipboard:', e);
      self.showErrorMessage('Не вдалося скопіювати посилання');
    }
  };

  /**
   * Обробник отримання винагороди за бейдж
   */
  ReferralIntegration.prototype.handleClaimBadge = function(badgeType, button) {
    const self = this;

    // Діактивуємо кнопку
    button.disabled = true;
    button.textContent = 'Отримуємо...';

    // Викликаємо дію
    this.store.dispatch(window.ReferralStore.claimBadgeReward(this.userId, badgeType))
      .then(function(result) {
        if (result.success) {
          // Показуємо повідомлення про успіх
          self.showSuccessMessage('Винагорода за бейдж "' + self.getBadgeTitle(badgeType) + '" отримана!');

          // Оновлюємо відображення
          button.textContent = 'Отримано';
          button.classList.add('claimed');

          // Перезавантажуємо дані
          return Promise.all([
            self.loadBadgesData(),
            self.loadReferralStats()
          ]);
        } else {
          throw new Error(result.error || 'Невідома помилка');
        }
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] Помилка отримання винагороди за бейдж:', error);
        self.showErrorMessage('Помилка отримання винагороди. Спробуйте пізніше.');

        // Відновлюємо кнопку
        button.disabled = false;
        button.textContent = 'Отримати';
      });
  };

  /**
   * Показує повідомлення про успіх
   */
  ReferralIntegration.prototype.showSuccessMessage = function(message) {
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'success');
      setTimeout(function() {
        toast.classList.remove('show', 'success');
      }, 3000);
    }
  };

  /**
   * Показує повідомлення про помилку
   */
  ReferralIntegration.prototype.showErrorMessage = function(message) {
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'error');
      setTimeout(function() {
        toast.classList.remove('show', 'error');
      }, 3000);
    }
  };

  /**
   * Обробляє зміни стану
   */
  ReferralIntegration.prototype.handleStateChange = function() {
    const state = this.store.getState();

    // Обробляємо зміни реферального посилання
    if (state.referralLink && state.referralLink.link) {
      this.updateReferralLinkDisplay(state.referralLink.link);
    }

    // Обробляємо зміни історії бонусів
    if (state.directBonus && state.directBonus.history) {
      this.updateBonusHistory(state.directBonus.history);
    }
  };

  /**
   * Оновлює відображення історії бонусів
   */
  ReferralIntegration.prototype.updateBonusHistory = function(history) {
    const container = document.querySelector('.bonus-history-items');
    if (!container) return;

    // Переконаємося, що history це масив
    if (!Array.isArray(history)) {
      console.warn('⚠️ [INTEGRATION] Отримано некоректний формат історії бонусів:', history);
      history = [];
    }

    container.innerHTML = '';

    if (history.length === 0) {
      container.innerHTML = '<p style="color: #888; text-align: center;">Поки що немає історії бонусів</p>';
      return;
    }

    history.slice(0, 5).forEach(function(item) {
      const historyItem = document.createElement('div');
      historyItem.className = 'bonus-history-item';

      let date;
      try {
        date = new Date(item.timestamp).toLocaleDateString('uk-UA');
      } catch (e) {
        date = 'Невідома дата';
      }

      historyItem.innerHTML = [
        '<div class="bonus-history-icon"></div>',
        '<div class="bonus-history-details">',
        '<div class="bonus-history-title">Реферальний бонус</div>',
        '<div class="bonus-history-amount">+' + (item.bonusAmount || window.ReferralConstants.DIRECT_BONUS_AMOUNT) + ' winix</div>',
        '<div class="bonus-history-date">' + date + '</div>',
        '</div>'
      ].join('');

      container.appendChild(historyItem);
    });
  };

  return ReferralIntegration;
})();

// Глобальна функція ініціалізації
window.initReferralSystem = function() {
  return new Promise(function(resolve, reject) {
    try {
      console.log('🎬 [INTEGRATION] Запуск ініціалізації реферальної системи...');

      const integration = new window.ReferralIntegration();
      integration.init()
        .then(function() {
          // Зберігаємо екземпляр глобально для налагодження
          window.ReferralIntegrationInstance = integration;

          console.log('🏁 [INTEGRATION] Ініціалізація завершена успішно!');
          resolve(integration);
        })
        .catch(function(error) {
          console.error('💥 [INTEGRATION] Критична помилка ініціалізації:', error);
          reject(error);
        });
    } catch (error) {
      console.error('💥 [INTEGRATION] Критична помилка ініціалізації:', error);
      reject(error);
    }
  });
};