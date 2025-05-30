// Integration.js - Версія з виправленим парсингом даних та детальним логуванням
/**
 * Головний інтеграційний модуль для реферальної системи
 * Ініціалізує всі компоненти та забезпечує взаємодію з DOM
 */
window.ReferralIntegration = (function() {
  'use strict';

  console.log('📦 [INTEGRATION] Завантаження модуля ReferralIntegration...');

  function ReferralIntegration() {
    console.log('🏗️ [INTEGRATION] Створення екземпляру ReferralIntegration');
    this.userId = null;
    this.store = null;
    this.isInitialized = false;
    console.log('✅ [INTEGRATION] Екземпляр створено:', this);
  }

  /**
   * Ініціалізація реферальної системи
   */
  ReferralIntegration.prototype.init = function() {
    var self = this;
    console.log('🚀 [INTEGRATION] ===== ПОЧАТОК ІНІЦІАЛІЗАЦІЇ =====');
    console.log('🕐 [INTEGRATION] Час початку:', new Date().toISOString());

    return new Promise(function(resolve, reject) {
      try {
        console.log('🔍 [INTEGRATION] Крок 1: Отримання ID користувача...');

        // Отримуємо ID користувача
        self.userId = self.getUserId();
        console.log('📊 [INTEGRATION] Результат getUserId:', {
          userId: self.userId,
          type: typeof self.userId,
          isValid: !!self.userId
        });

        if (!self.userId) {
          var error = new Error('Не вдалося отримати ID користувача. Переконайтеся, що ви авторизовані.');
          console.error('❌ [INTEGRATION] КРИТИЧНА ПОМИЛКА: ID користувача відсутній');
          console.error('❌ [INTEGRATION] Деталі помилки:', error);
          self.showErrorMessage(error.message);
          throw error;
        }

        console.log('✅ [INTEGRATION] ID користувача успішно отримано:', self.userId);

        // Ініціалізуємо сховище
        console.log('🔧 [INTEGRATION] Крок 2: Ініціалізація сховища...');
        self.initStore();

        // Ініціалізуємо UI
        console.log('🎨 [INTEGRATION] Крок 3: Ініціалізація UI...');
        self.initUI()
          .then(function() {
            console.log('✅ [INTEGRATION] UI успішно ініціалізовано');
            console.log('📊 [INTEGRATION] Крок 4: Завантаження початкових даних...');

            // Завантажуємо початкові дані
            return self.loadInitialData();
          })
          .then(function() {
            console.log('✅ [INTEGRATION] Початкові дані завантажено');
            console.log('🎯 [INTEGRATION] Крок 5: Встановлення обробників подій...');

            // Встановлюємо обробники подій
            self.setupEventListeners();

            self.isInitialized = true;
            console.log('🎉 [INTEGRATION] ===== ІНІЦІАЛІЗАЦІЯ ЗАВЕРШЕНА =====');
            console.log('📊 [INTEGRATION] Фінальний стан:', {
              userId: self.userId,
              storeInitialized: !!self.store,
              isInitialized: self.isInitialized
            });
            resolve(self);
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] Помилка під час ініціалізації UI або завантаження даних');
            console.error('❌ [INTEGRATION] Тип помилки:', error.name);
            console.error('❌ [INTEGRATION] Повідомлення:', error.message);
            console.error('❌ [INTEGRATION] Stack trace:', error.stack);
            self.showErrorMessage('Помилка ініціалізації: ' + error.message);
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] КРИТИЧНА ПОМИЛКА в блоці try-catch');
        console.error('❌ [INTEGRATION] Деталі:', error);
        self.showErrorMessage('Критична помилка: ' + error.message);
        reject(error);
      }
    });
  };

  /**
   * Отримує ID користувача з різних джерел
   */
  ReferralIntegration.prototype.getUserId = function() {
    console.log('🔍 [INTEGRATION] === getUserId START ===');
    console.log('🔍 [INTEGRATION] Доступні глобальні об\'єкти:', {
      hasWindow: typeof window !== 'undefined',
      hasWinixAPI: typeof window.WinixAPI !== 'undefined',
      hasTelegram: typeof window.Telegram !== 'undefined',
      hasTelegramWebApp: window.Telegram && typeof window.Telegram.WebApp !== 'undefined'
    });

    // Спочатку пробуємо з WinixAPI якщо він доступний
    if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
      console.log('🔍 [INTEGRATION] Спроба отримати ID через WinixAPI...');
      try {
        var apiId = window.WinixAPI.getUserId();
        console.log('🔍 [INTEGRATION] WinixAPI.getUserId() повернув:', {
          value: apiId,
          type: typeof apiId,
          isValid: apiId && apiId !== 'undefined' && apiId !== 'null'
        });

        if (apiId && apiId !== 'undefined' && apiId !== 'null') {
          var numericId = parseInt(apiId);
          console.log('✅ [INTEGRATION] ID успішно отримано з WinixAPI:', numericId);
          return numericId;
        }
      } catch (e) {
        console.warn('⚠️ [INTEGRATION] Помилка виклику WinixAPI.getUserId():', e);
      }
    } else {
      console.log('⚠️ [INTEGRATION] WinixAPI недоступний або не має методу getUserId');
    }

    // Потім пробуємо з Telegram
    console.log('🔍 [INTEGRATION] Спроба отримати ID через Telegram WebApp...');
    if (window.Telegram && window.Telegram.WebApp) {
      console.log('📊 [INTEGRATION] Telegram WebApp доступний. initDataUnsafe:',
        window.Telegram.WebApp.initDataUnsafe);

      if (window.Telegram.WebApp.initDataUnsafe &&
          window.Telegram.WebApp.initDataUnsafe.user &&
          window.Telegram.WebApp.initDataUnsafe.user.id) {
        var tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
        console.log('✅ [INTEGRATION] ID успішно отримано з Telegram:', tgUserId);
        return parseInt(tgUserId);
      } else {
        console.log('⚠️ [INTEGRATION] Telegram WebApp доступний, але дані користувача відсутні');
      }
    } else {
      console.log('⚠️ [INTEGRATION] Telegram WebApp недоступний');
    }

    // Потім з localStorage
    console.log('🔍 [INTEGRATION] Спроба отримати ID з localStorage...');
    var telegramId = localStorage.getItem('telegram_user_id');
    var userId = localStorage.getItem('user_id');
    console.log('📊 [INTEGRATION] Дані з localStorage:', {
      telegram_user_id: telegramId,
      user_id: userId
    });

    var storedId = telegramId || userId;
    if (storedId) {
      var numericId = parseInt(storedId);
      console.log('📊 [INTEGRATION] Конвертація ID:', {
        original: storedId,
        numeric: numericId,
        isNaN: isNaN(numericId)
      });

      if (!isNaN(numericId)) {
        console.log('✅ [INTEGRATION] ID успішно отримано з localStorage:', numericId);
        return numericId;
      }
    }

    // Якщо нічого немає - повертаємо null
    console.error('❌ [INTEGRATION] === getUserId FAILED - ID не знайдено в жодному джерелі ===');
    return null;
  };

  /**
   * Ініціалізує Redux сховище
   */
  ReferralIntegration.prototype.initStore = function() {
    console.log('🔧 [INTEGRATION] === initStore START ===');
    console.log('🔧 [INTEGRATION] Перевірка доступності ReferralStore:', {
      hasReferralStore: typeof window.ReferralStore !== 'undefined',
      hasConfigureMethod: window.ReferralStore && typeof window.ReferralStore.configureReferralStore === 'function',
      availableReducers: window.ReferralStore ? Object.keys(window.ReferralStore) : []
    });

    try {
      var reducers = {
        referralLink: window.ReferralStore.referralLinkReducer,
        directBonus: window.ReferralStore.directBonusReducer,
        referralLevels: window.ReferralStore.referralLevelsReducer,
        badges: window.ReferralStore.badgeReducer
      };

      console.log('📊 [INTEGRATION] Редюсери для ініціалізації:', Object.keys(reducers));

      this.store = window.ReferralStore.configureReferralStore(reducers);

      console.log('✅ [INTEGRATION] Store створено:', {
        hasStore: !!this.store,
        hasGetState: typeof this.store.getState === 'function',
        hasDispatch: typeof this.store.dispatch === 'function',
        hasSubscribe: typeof this.store.subscribe === 'function'
      });

      // Підписуємося на зміни стану
      var self = this;
      var unsubscribe = this.store.subscribe(function() {
        console.log('🔄 [INTEGRATION] Store state змінився');
        self.handleStateChange();
      });

      console.log('✅ [INTEGRATION] Підписка на зміни store встановлена');
      console.log('📊 [INTEGRATION] Початковий стан store:', this.store.getState());
      console.log('✅ [INTEGRATION] === initStore SUCCESS ===');
    } catch (error) {
      console.error('❌ [INTEGRATION] === initStore FAILED ===');
      console.error('❌ [INTEGRATION] Помилка:', error);
      throw error;
    }
  };

  /**
   * Ініціалізує інтерфейс користувача
   */
  ReferralIntegration.prototype.initUI = function() {
    var self = this;
    console.log('🎨 [INTEGRATION] === initUI START ===');

    return new Promise(function(resolve, reject) {
      try {
        // Встановлюємо ID користувача в заголовку
        console.log('🎨 [INTEGRATION] Крок 1: Встановлення ID в заголовку...');
        self.setUserIdInHeader();

        // Ініціалізуємо реферальне посилання
        console.log('🎨 [INTEGRATION] Крок 2: Ініціалізація реферального посилання...');
        self.initReferralLink()
          .then(function() {
            console.log('✅ [INTEGRATION] Реферальне посилання ініціалізовано');

            // Ініціалізуємо відображення винагород
            console.log('🎨 [INTEGRATION] Крок 3: Ініціалізація відображення винагород...');
            self.initRewardsDisplay();

            console.log('✅ [INTEGRATION] === initUI SUCCESS ===');
            resolve();
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] Помилка ініціалізації реферального посилання');
            console.error('❌ [INTEGRATION] Деталі:', error);
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] === initUI FAILED ===');
        console.error('❌ [INTEGRATION] Помилка:', error);
        reject(error);
      }
    });
  };

  /**
   * Встановлює ID користувача в заголовку
   */
  ReferralIntegration.prototype.setUserIdInHeader = function() {
    console.log('🏷️ [INTEGRATION] === setUserIdInHeader START ===');

    var userIdElements = document.querySelectorAll('.user-id-value, #header-user-id');
    console.log('📊 [INTEGRATION] Знайдено елементів для ID:', userIdElements.length);

    var self = this;
    userIdElements.forEach(function(element, index) {
      if (element) {
        var value = self.userId || 'Не визначено';
        console.log('🏷️ [INTEGRATION] Встановлення ID в елемент ' + index + ':', {
          element: element,
          oldValue: element.textContent,
          newValue: value
        });
        element.textContent = value;
      }
    });

    console.log('✅ [INTEGRATION] === setUserIdInHeader COMPLETE ===');
  };

  /**
   * Ініціалізує реферальне посилання
   */
  ReferralIntegration.prototype.initReferralLink = function() {
    var self = this;
    console.log('🔗 [INTEGRATION] === initReferralLink START ===');
    console.log('📊 [INTEGRATION] Параметри:', {
      userId: self.userId,
      hasStore: !!self.store,
      hasDispatch: self.store && typeof self.store.dispatch === 'function'
    });

    return new Promise(function(resolve, reject) {
      try {
        // Перевіряємо наявність необхідних компонентів
        if (!window.ReferralStore || !window.ReferralStore.fetchReferralLink) {
          throw new Error('ReferralStore.fetchReferralLink недоступний');
        }

        console.log('🔗 [INTEGRATION] Диспатч fetchReferralLink action...');

        // Диспатчимо дію для отримання посилання
        self.store.dispatch(window.ReferralStore.fetchReferralLink(self.userId))
          .then(function(result) {
            console.log('✅ [INTEGRATION] fetchReferralLink успішно виконано');
            console.log('📊 [INTEGRATION] Результат:', result);
            resolve();
          })
          .catch(function(error) {
            console.error('❌ [INTEGRATION] fetchReferralLink помилка:', error);
            self.showErrorMessage('Не вдалося отримати реферальне посилання: ' + error.message);
            reject(error);
          });
      } catch (error) {
        console.error('❌ [INTEGRATION] === initReferralLink FAILED ===');
        console.error('❌ [INTEGRATION] Помилка:', error);
        self.showErrorMessage('Критична помилка: ' + error.message);
        reject(error);
      }
    });
  };

  /**
   * Оновлює відображення реферального посилання
   */
  ReferralIntegration.prototype.updateReferralLinkDisplay = function(link) {
    console.log('🔗 [INTEGRATION] === updateReferralLinkDisplay START ===');
    console.log('📊 [INTEGRATION] Отримано посилання:', {
      link: link,
      type: typeof link,
      length: link ? link.length : 0
    });

    var linkDisplay = document.querySelector('.link-display');
    console.log('📊 [INTEGRATION] Елемент для відображення:', {
      found: !!linkDisplay,
      currentText: linkDisplay ? linkDisplay.textContent : null
    });

    if (linkDisplay) {
      // Переконаємося, що link це рядок
      if (typeof link !== 'string') {
        console.error("❌ [INTEGRATION] Некоректний формат посилання:", link);
        linkDisplay.textContent = 'Помилка завантаження посилання';
        linkDisplay.dataset.link = '';
        return;
      }

      console.log('✅ [INTEGRATION] Оновлення відображення посилання');
      linkDisplay.textContent = link;
      linkDisplay.dataset.link = link;
      console.log('✅ [INTEGRATION] === updateReferralLinkDisplay SUCCESS ===');
    } else {
      console.error('❌ [INTEGRATION] Елемент .link-display не знайдено');
    }
  };

  /**
   * Ініціалізує відображення винагород
   */
  ReferralIntegration.prototype.initRewardsDisplay = function() {
    console.log('💰 [INTEGRATION] === initRewardsDisplay START ===');

    // Встановлюємо базові значення винагород
    var bonusAmountElements = document.querySelectorAll('.bonus-amount');
    var bonusAmount = window.ReferralConstants.DIRECT_BONUS_AMOUNT || 50;

    console.log('📊 [INTEGRATION] Налаштування бонусів:', {
      elementsFound: bonusAmountElements.length,
      bonusAmount: bonusAmount
    });

    bonusAmountElements.forEach(function(element, index) {
      console.log('💰 [INTEGRATION] Встановлення бонусу в елемент ' + index);
      element.textContent = bonusAmount;
    });

    // Встановлюємо пороги для бейджів
    console.log('🏆 [INTEGRATION] Оновлення порогів бейджів...');
    this.updateBadgeThresholds();

    console.log('✅ [INTEGRATION] === initRewardsDisplay COMPLETE ===');
  };

  /**
   * Оновлює пороги для бейджів
   */
  ReferralIntegration.prototype.updateBadgeThresholds = function() {
    console.log('🏆 [INTEGRATION] === updateBadgeThresholds START ===');

    var thresholdElements = {
      '.bronze-threshold': window.ReferralConstants.BRONZE_BADGE_THRESHOLD || 25,
      '.silver-threshold': window.ReferralConstants.SILVER_BADGE_THRESHOLD || 50,
      '.gold-threshold': window.ReferralConstants.GOLD_BADGE_THRESHOLD || 100,
      '.platinum-threshold': window.ReferralConstants.PLATINUM_BADGE_THRESHOLD || 500
    };

    console.log('📊 [INTEGRATION] Пороги бейджів:', thresholdElements);

    Object.keys(thresholdElements).forEach(function(selector) {
      var value = thresholdElements[selector];
      var element = document.querySelector(selector);
      console.log('🏆 [INTEGRATION] Оновлення ' + selector + ':', {
        found: !!element,
        value: value
      });
      if (element) {
        element.textContent = value;
      }
    });

    var rewardElements = {
      '.bronze-reward': window.ReferralConstants.BRONZE_BADGE_REWARD || 2500,
      '.silver-reward': window.ReferralConstants.SILVER_BADGE_REWARD || 5000,
      '.gold-reward': window.ReferralConstants.GOLD_BADGE_REWARD || 10000,
      '.platinum-reward': window.ReferralConstants.PLATINUM_BADGE_REWARD || 20000
    };

    console.log('📊 [INTEGRATION] Винагороди бейджів:', rewardElements);

    Object.keys(rewardElements).forEach(function(selector) {
      var value = rewardElements[selector];
      var element = document.querySelector(selector);
      console.log('💰 [INTEGRATION] Оновлення винагороди ' + selector + ':', {
        found: !!element,
        value: value
      });
      if (element) {
        element.textContent = value;
      }
    });

    console.log('✅ [INTEGRATION] === updateBadgeThresholds COMPLETE ===');
  };

  /**
   * Завантажує початкові дані
   */
  ReferralIntegration.prototype.loadInitialData = function() {
    var self = this;
    console.log('📊 [INTEGRATION] === loadInitialData START ===');
    console.log('🕐 [INTEGRATION] Час початку завантаження:', new Date().toISOString());

    // Завантажуємо дані паралельно, але не зупиняємо весь процес при помилці
    var promises = [
      self.loadReferralStats().catch(function(error) {
        console.error('❌ [INTEGRATION] ПОМИЛКА loadReferralStats:', error);
        self.showErrorMessage('Не вдалося завантажити статистику рефералів');
        return null;
      }),
      self.loadBadgesData().catch(function(error) {
        console.error('❌ [INTEGRATION] ПОМИЛКА loadBadgesData:', error);
        self.showErrorMessage('Не вдалося завантажити дані про бейджі');
        return null;
      }),
      self.loadDirectBonusHistory().catch(function(error) {
        console.error('❌ [INTEGRATION] ПОМИЛКА loadDirectBonusHistory:', error);
        self.showErrorMessage('Не вдалося завантажити історію бонусів');
        return null;
      })
    ];

    console.log('📊 [INTEGRATION] Запущено паралельне завантаження 3 наборів даних');

    return Promise.all(promises)
      .then(function(results) {
        console.log('📊 [INTEGRATION] Результати завантаження:', {
          stats: results[0] ? 'SUCCESS' : 'FAILED',
          badges: results[1] ? 'SUCCESS' : 'FAILED',
          bonuses: results[2] ? 'SUCCESS' : 'FAILED'
        });

        // Перевіряємо чи хоча б щось завантажилось
        var hasAnyData = results.some(function(result) {
          return result !== null;
        });

        console.log('📊 [INTEGRATION] Статус завантаження:', {
          hasAnyData: hasAnyData,
          successCount: results.filter(function(r) { return r !== null; }).length,
          failureCount: results.filter(function(r) { return r === null; }).length
        });

        if (!hasAnyData) {
          console.error('❌ [INTEGRATION] КРИТИЧНО: Жодні дані не були завантажені');
          self.showErrorMessage('Не вдалося завантажити жодні дані. Перевірте підключення до сервера.');
        } else {
          console.log('✅ [INTEGRATION] Частково успішне завантаження даних');
        }

        console.log('✅ [INTEGRATION] === loadInitialData COMPLETE ===');
      });
  };

  /**
   * Завантажує статистику рефералів
   */
  ReferralIntegration.prototype.loadReferralStats = function() {
    var self = this;
    console.log('📊 [INTEGRATION] === loadReferralStats START ===');
    console.log('🔄 [INTEGRATION] Запит статистики для userId:', this.userId);

    return window.ReferralAPI.fetchReferralStats(this.userId)
      .then(function(statsData) {
        console.log('✅ [INTEGRATION] Статистика отримана успішно');
        console.log('📊 [INTEGRATION] Дані статистики:', JSON.stringify(statsData, null, 2));

        console.log('🔄 [INTEGRATION] Оновлення відображення статистики...');
        self.updateReferralStatsDisplay(statsData);

        console.log('✅ [INTEGRATION] === loadReferralStats SUCCESS ===');
        return statsData;
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] === loadReferralStats FAILED ===');
        console.error('❌ [INTEGRATION] Тип помилки:', error.name);
        console.error('❌ [INTEGRATION] Повідомлення:', error.message);
        console.error('❌ [INTEGRATION] Stack trace:', error.stack);

        // Показуємо помилку в UI
        self.showErrorMessage('Помилка завантаження статистики: ' + error.message);

        // Пробрасуємо помилку далі
        throw error;
      });
  };

  /**
   * Завантажує дані про бейджі
   */
  ReferralIntegration.prototype.loadBadgesData = function() {
    var self = this;
    console.log('🏆 [INTEGRATION] === loadBadgesData START ===');
    console.log('🔄 [INTEGRATION] Запит бейджів для userId:', this.userId);

    return this.store.dispatch(window.ReferralStore.fetchUserBadges(this.userId))
      .then(function(result) {
        console.log('✅ [INTEGRATION] Бейджі отримані успішно');
        console.log('📊 [INTEGRATION] Результат:', result);
        console.log('✅ [INTEGRATION] === loadBadgesData SUCCESS ===');
        return result;
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] === loadBadgesData FAILED ===');
        console.error('❌ [INTEGRATION] Помилка:', error);
        self.showErrorMessage('Помилка завантаження бейджів: ' + error.message);
        throw error;
      });
  };

  /**
   * Завантажує історію прямих бонусів
   */
  ReferralIntegration.prototype.loadDirectBonusHistory = function() {
    var self = this;
    console.log('💰 [INTEGRATION] === loadDirectBonusHistory START ===');
    console.log('🔄 [INTEGRATION] Запит історії бонусів для userId:', this.userId);

    return this.store.dispatch(window.ReferralStore.fetchDirectBonusHistory(this.userId))
      .then(function(result) {
        console.log('✅ [INTEGRATION] Історія бонусів отримана успішно');
        console.log('📊 [INTEGRATION] Результат:', result);
        console.log('✅ [INTEGRATION] === loadDirectBonusHistory SUCCESS ===');
        return result;
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] === loadDirectBonusHistory FAILED ===');
        console.error('❌ [INTEGRATION] Помилка:', error);
        self.showErrorMessage('Помилка завантаження історії: ' + error.message);
        throw error;
      });
  };

  /**
   * ВИПРАВЛЕНИЙ МЕТОД: Оновлює відображення статистики рефералів
   */
  ReferralIntegration.prototype.updateReferralStatsDisplay = function(statsData) {
    console.log('📊 [INTEGRATION] === updateReferralStatsDisplay START ===');
    console.log('📊 [INTEGRATION] Вхідні дані:', JSON.stringify(statsData, null, 2));

    if (!statsData) {
      console.error('❌ [INTEGRATION] statsData відсутні або null');
      this.showErrorMessage('Дані статистики недоступні');
      return;
    }

    // Перевіряємо чи дані успішні
    if (statsData.success === false) {
      console.error('❌ [INTEGRATION] Відповідь містить помилку:', statsData.error);
      this.showErrorMessage('Помилка отримання статистики: ' + (statsData.error || 'Невідома помилка'));
      return;
    }

    // ВИПРАВЛЕНО: Правильне отримання даних згідно структури бекенду
    var stats = {
      totalReferrals: 0,
      activeReferrals: 0,
      inactiveReferrals: 0,
      conversionRate: "0"
    };

    console.log('📊 [INTEGRATION] Аналіз структури даних...');

    // Перевіряємо наявність поля statistics (пріоритетне)
    if (statsData.statistics && typeof statsData.statistics === 'object') {
      console.log('📊 [INTEGRATION] Знайдено поле statistics:', statsData.statistics);

      // Безпечне отримання даних з перевіркою на undefined/null
      stats.totalReferrals = statsData.statistics.totalReferrals || 0;
      stats.activeReferrals = statsData.statistics.activeReferrals || 0;
      stats.inactiveReferrals = statsData.statistics.inactiveReferrals || 0;

      // Конверсія може бути числом або потребувати розрахунку
      if (typeof statsData.statistics.conversionRate !== 'undefined') {
        stats.conversionRate = statsData.statistics.conversionRate;
      }

      console.log('📊 [INTEGRATION] Дані з поля statistics:', stats);
    }

    // Додатково перевіряємо поле referrals для підрахунку (якщо statistics не повне)
    if (statsData.referrals && typeof statsData.referrals === 'object') {
      console.log('📊 [INTEGRATION] Знайдено поле referrals:', {
        hasLevel1: Array.isArray(statsData.referrals.level1),
        hasLevel2: Array.isArray(statsData.referrals.level2),
        level1Length: statsData.referrals.level1 ? statsData.referrals.level1.length : 0,
        level2Length: statsData.referrals.level2 ? statsData.referrals.level2.length : 0
      });

      // Якщо totalReferrals ще 0, рахуємо з масивів
      if (stats.totalReferrals === 0) {
        var level1Count = 0;
        var level2Count = 0;
        var activeCount = 0;

        if (Array.isArray(statsData.referrals.level1)) {
          level1Count = statsData.referrals.level1.length;
          // Рахуємо активних рефералів 1-го рівня
          activeCount += statsData.referrals.level1.filter(function(ref) {
            return ref && ref.active === true;
          }).length;
        }

        if (Array.isArray(statsData.referrals.level2)) {
          level2Count = statsData.referrals.level2.length;
          // Рахуємо активних рефералів 2-го рівня
          activeCount += statsData.referrals.level2.filter(function(ref) {
            return ref && ref.active === true;
          }).length;
        }

        stats.totalReferrals = level1Count + level2Count;

        // Якщо activeReferrals ще 0, використовуємо підрахований
        if (stats.activeReferrals === 0) {
          stats.activeReferrals = activeCount;
        }

        console.log('📊 [INTEGRATION] Підраховано з масивів referrals:', {
          level1Count: level1Count,
          level2Count: level2Count,
          activeCount: activeCount,
          totalReferrals: stats.totalReferrals
        });
      }
    }

    // Розраховуємо неактивних рефералів
    stats.inactiveReferrals = Math.max(0, stats.totalReferrals - stats.activeReferrals);

    // Розраховуємо конверсію якщо вона не задана
    if (stats.conversionRate === "0" && stats.totalReferrals > 0) {
      stats.conversionRate = ((stats.activeReferrals / stats.totalReferrals) * 100).toFixed(1);
    } else if (typeof stats.conversionRate === 'number') {
      // Якщо конверсія прийшла як число, форматуємо до рядка
      stats.conversionRate = stats.conversionRate.toFixed(1);
    }

    console.log('📊 [INTEGRATION] Фінальні розраховані значення:', stats);

    // Оновлюємо DOM елементи
    console.log('🔄 [INTEGRATION] Оновлення DOM елементів...');

    // Оновлюємо загальні показники
    this.updateElement('.total-referrals-count', stats.totalReferrals);
    this.updateElement('.active-referrals-count', stats.activeReferrals);
    this.updateElement('.conversion-rate', stats.conversionRate + '%');

    // Оновлюємо статистику активності (з #)
    this.updateElement('#active-referrals-count', stats.activeReferrals);
    this.updateElement('#inactive-referrals-count', stats.inactiveReferrals);
    this.updateElement('#conversion-rate', stats.conversionRate + '%');

    // ВАЖЛИВО: Оновлюємо прогрес бейджів з правильним числом рефералів
    console.log('🏆 [INTEGRATION] Оновлення прогресу бейджів з totalReferrals:', stats.totalReferrals);
    this.updateBadgeProgress(stats.totalReferrals);

    // Оновлюємо таблицю активності якщо є дані
    if (statsData.referrals) {
      this.updateActivityTable(statsData.referrals);
    }

    // Оновлюємо списки рефералів якщо є дані
    if (statsData.referrals) {
      this.updateReferralLists(statsData.referrals);
    }

    console.log('✅ [INTEGRATION] === updateReferralStatsDisplay COMPLETE ===');
  };

  /**
   * Оновлює таблицю активності рефералів
   */
  ReferralIntegration.prototype.updateActivityTable = function(referralsData) {
    console.log('📊 [INTEGRATION] === updateActivityTable START ===');

    var tableBody = document.getElementById('activity-table-body');
    if (!tableBody) {
      console.error('❌ [INTEGRATION] Елемент activity-table-body не знайдено');
      return;
    }

    // Очищуємо таблицю
    tableBody.innerHTML = '';

    // Об'єднуємо рефералів обох рівнів
    var allReferrals = [];

    if (Array.isArray(referralsData.level1)) {
      allReferrals = allReferrals.concat(referralsData.level1);
    }

    if (Array.isArray(referralsData.level2)) {
      allReferrals = allReferrals.concat(referralsData.level2);
    }

    console.log('📊 [INTEGRATION] Всього рефералів для таблиці:', allReferrals.length);

    if (allReferrals.length === 0) {
      tableBody.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Немає даних про рефералів</p>';
      return;
    }

    // Створюємо рядки таблиці
    allReferrals.forEach(function(referral, index) {
      var row = document.createElement('div');
      row.className = 'activity-table-row';

      // Безпечне отримання даних
      var refId = referral.id || referral.rawId || 'N/A';
      var isActive = referral.active === true;

      row.innerHTML = [
        '<div class="activity-table-data activity-data-id">' + refId + '</div>',
        '<div class="activity-table-data activity-data-draws">-</div>',
        '<div class="activity-table-data activity-data-invited">-</div>',
        '<div class="activity-table-data activity-data-status">',
        '  <span class="activity-status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">',
        isActive ? 'Активний' : 'Неактивний',
        '  </span>',
        '</div>'
      ].join('');

      tableBody.appendChild(row);
    });

    console.log('✅ [INTEGRATION] === updateActivityTable COMPLETE ===');
  };

  /**
   * Оновлює списки рефералів у вкладках
   */
  ReferralIntegration.prototype.updateReferralLists = function(referralsData) {
    console.log('📊 [INTEGRATION] === updateReferralLists START ===');

    // Оновлюємо список 1-го рівня
    var level1List = document.getElementById('level1-list');
    if (level1List && Array.isArray(referralsData.level1)) {
      this.renderReferralList(level1List, referralsData.level1, 1);
    }

    // Оновлюємо список 2-го рівня
    var level2List = document.getElementById('level2-list');
    if (level2List && Array.isArray(referralsData.level2)) {
      this.renderReferralList(level2List, referralsData.level2, 2);
    }

    console.log('✅ [INTEGRATION] === updateReferralLists COMPLETE ===');
  };

  /**
   * Рендерить список рефералів
   */
  ReferralIntegration.prototype.renderReferralList = function(container, referrals, level) {
    console.log('📊 [INTEGRATION] Рендеринг списку рефералів рівня ' + level + ', кількість:', referrals.length);

    container.innerHTML = '';

    if (referrals.length === 0) {
      container.innerHTML = '<p style="color: #888; text-align: center;">Немає рефералів ' + level + '-го рівня</p>';
      return;
    }

    referrals.forEach(function(referral) {
      var item = document.createElement('div');
      item.className = 'referral-item level-' + level;

      var refId = referral.id || referral.rawId || 'N/A';
      var isActive = referral.active === true;
      var regDate = 'Невідома дата';

      if (referral.registrationDate) {
        try {
          regDate = new Date(referral.registrationDate).toLocaleDateString('uk-UA');
        } catch (e) {
          console.error('❌ [INTEGRATION] Помилка парсингу дати:', e);
        }
      }

      item.innerHTML = [
        '<div class="referral-id">' + refId + '</div>',
        '<div class="referral-info">',
        '  <div class="referral-date">Реєстрація: ' + regDate + '</div>',
        '</div>',
        '<div class="referral-stats">',
        '  <div class="referral-earnings">0 winix</div>',
        '  <span class="referral-status ' + (isActive ? 'active' : 'inactive') + '">',
        isActive ? 'Активний' : 'Неактивний',
        '  </span>',
        '</div>'
      ].join('');

      container.appendChild(item);
    });
  };

  /**
   * Оновлює прогрес бейджів
   */
  ReferralIntegration.prototype.updateBadgeProgress = function(referralsCount) {
    console.log('🏆 [INTEGRATION] === updateBadgeProgress START ===');
    console.log('📊 [INTEGRATION] Кількість рефералів:', referralsCount);

    if (!window.ReferralServices || !window.ReferralServices.checkBadgesProgress) {
      console.error('❌ [INTEGRATION] ReferralServices.checkBadgesProgress недоступний');
      return;
    }

    // Переконаємося, що це число, а не текст
    referralsCount = parseInt(referralsCount) || 0;
    console.log('📊 [INTEGRATION] Нормалізована кількість:', referralsCount);

    var badgeProgress = window.ReferralServices.checkBadgesProgress(referralsCount);
    console.log('📊 [INTEGRATION] Результат checkBadgesProgress:', JSON.stringify(badgeProgress, null, 2));

    if (badgeProgress) {
      // Оновлюємо загальну статистику бейджів
      console.log('🔄 [INTEGRATION] Оновлення статистики бейджів...');
      this.updateElement('#earned-badges-count', badgeProgress.earnedBadgesCount);
      this.updateElement('#remaining-badges-count', 4 - badgeProgress.earnedBadgesCount);

      // Оновлюємо прогрес наступного бейджа
      if (badgeProgress.nextBadge) {
        console.log('🏆 [INTEGRATION] Оновлення прогресу наступного бейджа:', badgeProgress.nextBadge);

        var nextBadgeTitle = this.getBadgeTitle(badgeProgress.nextBadge.type);
        var nextBadgeTitleElement = document.querySelector('.next-badge-title');
        if (nextBadgeTitleElement) {
          nextBadgeTitleElement.textContent = 'Наступний бейдж: ' + nextBadgeTitle;
        }

        var progressPercent = Math.round(badgeProgress.nextBadge.progress);
        var progressBar = document.querySelector('.next-badge-container .progress-fill');
        if (progressBar) {
          console.log('🔄 [INTEGRATION] Встановлення ширини прогрес-бару: ' + progressPercent + '%');
          progressBar.style.width = progressPercent + '%';
        }

        var progressText = document.querySelector('.next-badge-container .progress-text');
        if (progressText) {
          progressText.textContent = progressPercent + '% (' + referralsCount + '/' + badgeProgress.nextBadge.threshold + ')';
        }

        var remainingText = document.querySelector('.next-badge-remaining');
        if (remainingText) {
          remainingText.textContent = 'Залишилось: ' + badgeProgress.nextBadge.remaining + ' рефералів';
        }
      }

      // Оновлюємо індивідуальні прогрес-бари бейджів
      console.log('🔄 [INTEGRATION] Оновлення індивідуальних бейджів...');
      var self = this;
      badgeProgress.badgeProgress.forEach(function(badge, index) {
        console.log('🏆 [INTEGRATION] Оновлення бейджа ' + index + ':', badge);
        self.updateBadgeItem(badge);
      });
    }

    console.log('✅ [INTEGRATION] === updateBadgeProgress COMPLETE ===');
  };

  /**
   * Оновлює конкретний елемент бейджа
   */
  ReferralIntegration.prototype.updateBadgeItem = function(badge) {
    console.log('🏆 [INTEGRATION] === updateBadgeItem START ===');
    console.log('📊 [INTEGRATION] Дані бейджа:', badge);

    var badgeClass = badge.type.toLowerCase();
    var badgeItems = document.querySelectorAll('.badge-item');
    var badgeItem = null;

    // Знаходимо елемент бейджа за іконкою
    var iconClasses = {
      'bronze': 'brave-icon',
      'silver': 'innovator-icon',
      'gold': 'legend-icon',
      'platinum': 'visionary-icon'
    };

    console.log('🔍 [INTEGRATION] Пошук елемента з класом ' + iconClasses[badgeClass]);

    badgeItems.forEach(function(item) {
      if (item.querySelector('.' + iconClasses[badgeClass])) {
        badgeItem = item;
        console.log('✅ [INTEGRATION] Знайдено елемент бейджа');
      }
    });

    if (badgeItem) {
      var progressBar = badgeItem.querySelector('.badge-progress-fill');
      var progressText = badgeItem.querySelector('.badge-progress-text');
      var button = badgeItem.querySelector('.claim-badge-button');

      if (progressBar) {
        console.log('🔄 [INTEGRATION] Оновлення прогрес-бару: ' + badge.progress + '%');
        progressBar.style.width = badge.progress + '%';
      }

      if (progressText) {
        var current = Math.min(Math.round((badge.progress / 100) * badge.threshold), badge.threshold);
        var text = Math.round(badge.progress) + '% (' + current + '/' + badge.threshold + ')';
        console.log('🔄 [INTEGRATION] Оновлення тексту прогресу: ' + text);
        progressText.textContent = text;
      }

      if (button) {
        console.log('🔄 [INTEGRATION] Оновлення кнопки. isEligible: ' + badge.isEligible);
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
    } else {
      console.warn('⚠️ [INTEGRATION] Елемент бейджа не знайдено для типу:', badge.type);
    }

    console.log('✅ [INTEGRATION] === updateBadgeItem COMPLETE ===');
  };

  /**
   * Повертає назву бейджа українською
   */
  ReferralIntegration.prototype.getBadgeTitle = function(badgeType) {
    console.log('🏷️ [INTEGRATION] getBadgeTitle для:', badgeType);

    var titles = {
      'BRONZE': 'Сміливець',
      'SILVER': 'Новатор',
      'GOLD': 'Легенда',
      'PLATINUM': 'Візіонер'
    };

    var title = titles[badgeType] || badgeType;
    console.log('🏷️ [INTEGRATION] Повертаємо назву:', title);
    return title;
  };

  /**
   * Допоміжна функція для оновлення тексту елемента
   */
  ReferralIntegration.prototype.updateElement = function(selector, value) {
    console.log('🔄 [INTEGRATION] updateElement: ' + selector + ' = ' + value);

    var element = document.querySelector(selector);
    if (element) {
      console.log('✅ [INTEGRATION] Елемент знайдено, оновлюємо значення');
      element.textContent = value;
    } else {
      console.warn('⚠️ [INTEGRATION] Елемент не знайдено: ' + selector);
    }
  };

  /**
   * Встановлює обробники подій
   */
  ReferralIntegration.prototype.setupEventListeners = function() {
    console.log('🎯 [INTEGRATION] === setupEventListeners START ===');

    var self = this;

    // Обробник для кнопок отримання винагороди за бейджі
    console.log('🎯 [INTEGRATION] Додавання глобального обробника кліків...');
    document.addEventListener('click', function(event) {
      if (event.target.classList.contains('claim-badge-button') && !event.target.disabled) {
        console.log('🎯 [INTEGRATION] Клік на кнопку claim badge:', event.target);
        var badgeType = event.target.dataset.badge;
        console.log('🏆 [INTEGRATION] Тип бейджа:', badgeType);

        if (badgeType) {
          self.handleClaimBadge(badgeType, event.target);
        }
      }
    });

    // Обробник для копіювання реферального посилання
    var copyButton = document.querySelector('.copy-link-button, .copy-button');
    console.log('🔍 [INTEGRATION] Пошук кнопки копіювання:', {
      found: !!copyButton,
      selector: '.copy-link-button, .copy-button'
    });

    if (copyButton) {
      copyButton.addEventListener('click', function() {
        console.log('📋 [INTEGRATION] Клік на кнопку копіювання');

        var linkDisplay = document.querySelector('.link-display');
        console.log('📊 [INTEGRATION] Дані для копіювання:', {
          linkElement: !!linkDisplay,
          linkText: linkDisplay ? linkDisplay.textContent : null,
          linkData: linkDisplay ? linkDisplay.dataset.link : null
        });

        if (linkDisplay && linkDisplay.dataset.link) {
          try {
            navigator.clipboard.writeText(linkDisplay.dataset.link).then(function() {
              console.log('✅ [INTEGRATION] Успішно скопійовано через Clipboard API');
              self.showSuccessMessage('Посилання скопійовано!');
            }).catch(function(err) {
              console.error('❌ [INTEGRATION] Помилка Clipboard API:', err);
              // Fallback для старих браузерів
              self.fallbackCopyToClipboard(linkDisplay.dataset.link);
            });
          } catch (e) {
            console.error('❌ [INTEGRATION] Помилка при спробі копіювання:', e);
            self.fallbackCopyToClipboard(linkDisplay.dataset.link);
          }
        } else {
          console.warn('⚠️ [INTEGRATION] Посилання для копіювання відсутнє');
        }
      });
    }

    console.log('✅ [INTEGRATION] === setupEventListeners COMPLETE ===');
  };

  /**
   * Резервне копіювання в буфер обміну
   */
  ReferralIntegration.prototype.fallbackCopyToClipboard = function(text) {
    console.log('📋 [INTEGRATION] === fallbackCopyToClipboard START ===');
    console.log('📊 [INTEGRATION] Текст для копіювання:', text);

    var self = this;

    try {
      // Створюємо тимчасовий елемент
      var textarea = document.createElement('textarea');
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

      console.log('📋 [INTEGRATION] Спроба execCommand("copy")...');
      try {
        var successful = document.execCommand('copy');
        console.log('📊 [INTEGRATION] Результат execCommand:', successful);

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
      console.log('✅ [INTEGRATION] Тимчасовий елемент видалено');
    } catch (e) {
      console.error('❌ [INTEGRATION] Критична помилка fallbackCopyToClipboard:', e);
      self.showErrorMessage('Не вдалося скопіювати посилання');
    }

    console.log('✅ [INTEGRATION] === fallbackCopyToClipboard COMPLETE ===');
  };

  /**
   * Обробник отримання винагороди за бейдж
   */
  ReferralIntegration.prototype.handleClaimBadge = function(badgeType, button) {
    console.log('💎 [INTEGRATION] === handleClaimBadge START ===');
    console.log('📊 [INTEGRATION] Параметри:', {
      badgeType: badgeType,
      userId: this.userId,
      buttonText: button.textContent
    });

    var self = this;

    // Діактивуємо кнопку
    button.disabled = true;
    button.textContent = 'Отримуємо...';
    console.log('🔄 [INTEGRATION] Кнопка деактивована');

    // Викликаємо дію
    this.store.dispatch(window.ReferralStore.claimBadgeReward(this.userId, badgeType))
      .then(function(result) {
        console.log('✅ [INTEGRATION] Результат claimBadgeReward:', result);

        if (result.success) {
          // Показуємо повідомлення про успіх
          self.showSuccessMessage('Винагорода за бейдж "' + self.getBadgeTitle(badgeType) + '" отримана!');

          // Оновлюємо відображення
          button.textContent = 'Отримано';
          button.classList.add('claimed');
          console.log('✅ [INTEGRATION] Кнопка оновлена на "Отримано"');

          // Перезавантажуємо дані
          console.log('🔄 [INTEGRATION] Перезавантаження даних...');
          return Promise.all([
            self.loadBadgesData(),
            self.loadReferralStats()
          ]);
        } else {
          throw new Error(result.error || 'Невідома помилка');
        }
      })
      .then(function() {
        console.log('✅ [INTEGRATION] Дані успішно перезавантажені');
        console.log('✅ [INTEGRATION] === handleClaimBadge SUCCESS ===');
      })
      .catch(function(error) {
        console.error('❌ [INTEGRATION] === handleClaimBadge FAILED ===');
        console.error('❌ [INTEGRATION] Помилка:', error);
        self.showErrorMessage('Помилка отримання винагороди: ' + error.message);

        // Відновлюємо кнопку
        button.disabled = false;
        button.textContent = 'Отримати';
        console.log('🔄 [INTEGRATION] Кнопка відновлена');
      });
  };

  /**
   * Показує повідомлення про успіх
   */
  ReferralIntegration.prototype.showSuccessMessage = function(message) {
    console.log('✅ [INTEGRATION] showSuccessMessage:', message);

    var toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'success');
      setTimeout(function() {
        toast.classList.remove('show', 'success');
        console.log('✅ [INTEGRATION] Повідомлення приховано');
      }, 3000);
    } else {
      console.warn('⚠️ [INTEGRATION] Елемент toast не знайдено');
    }
  };

  /**
   * Показує повідомлення про помилку
   */
  ReferralIntegration.prototype.showErrorMessage = function(message) {
    console.error('❌ [INTEGRATION] showErrorMessage:', message);

    var toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show', 'error');
      setTimeout(function() {
        toast.classList.remove('show', 'error');
        console.log('❌ [INTEGRATION] Повідомлення про помилку приховано');
      }, 5000);
    } else {
      console.warn('⚠️ [INTEGRATION] Елемент toast не знайдено');
    }
  };

  /**
   * Обробляє зміни стану
   */
  ReferralIntegration.prototype.handleStateChange = function() {
    console.log('🔄 [INTEGRATION] === handleStateChange START ===');

    var state = this.store.getState();
    console.log('📊 [INTEGRATION] Поточний стан store:', JSON.stringify(state, null, 2));

    // Перевіряємо помилки в різних частинах стану
    if (state.referralLink && state.referralLink.error) {
      console.error('❌ [INTEGRATION] Помилка в referralLink:', state.referralLink.error);
      this.showErrorMessage('Помилка посилання: ' + state.referralLink.error);
    }

    if (state.badges && state.badges.error) {
      console.error('❌ [INTEGRATION] Помилка в badges:', state.badges.error);
      this.showErrorMessage('Помилка бейджів: ' + state.badges.error);
    }

    if (state.directBonus && state.directBonus.error) {
      console.error('❌ [INTEGRATION] Помилка в directBonus:', state.directBonus.error);
      this.showErrorMessage('Помилка бонусів: ' + state.directBonus.error);
    }

    if (state.referralLevels && state.referralLevels.error) {
      console.error('❌ [INTEGRATION] Помилка в referralLevels:', state.referralLevels.error);
      this.showErrorMessage('Помилка рівнів: ' + state.referralLevels.error);
    }

    // Обробляємо зміни реферального посилання
    if (state.referralLink && state.referralLink.link) {
      console.log('🔗 [INTEGRATION] Оновлення реферального посилання:', state.referralLink.link);
      this.updateReferralLinkDisplay(state.referralLink.link);
    }

    // Обробляємо зміни історії бонусів
    if (state.directBonus && state.directBonus.history) {
      console.log('💰 [INTEGRATION] Оновлення історії бонусів. Кількість записів:',
        state.directBonus.history.length);
      this.updateBonusHistory(state.directBonus.history);
    }

    console.log('✅ [INTEGRATION] === handleStateChange COMPLETE ===');
  };

  /**
   * Оновлює відображення історії бонусів
   */
  ReferralIntegration.prototype.updateBonusHistory = function(history) {
    console.log('💰 [INTEGRATION] === updateBonusHistory START ===');
    console.log('📊 [INTEGRATION] Історія:', history);

    var container = document.querySelector('.bonus-history-items');
    if (!container) {
      console.error('❌ [INTEGRATION] Контейнер .bonus-history-items не знайдено');
      return;
    }

    // Переконаємося, що history це масив
    if (!Array.isArray(history)) {
      console.error('❌ [INTEGRATION] history не є масивом:', typeof history);
      container.innerHTML = '<p style="color: #f44336; text-align: center;">Помилка завантаження історії</p>';
      return;
    }

    console.log('📊 [INTEGRATION] Кількість записів в історії:', history.length);
    container.innerHTML = '';

    if (history.length === 0) {
      console.log('📊 [INTEGRATION] Історія порожня');
      container.innerHTML = '<p style="color: #888; text-align: center;">Поки що немає історії бонусів</p>';
      return;
    }

    console.log('🔄 [INTEGRATION] Відображення перших 5 записів...');
    history.slice(0, 5).forEach(function(item, index) {
      console.log('💰 [INTEGRATION] Запис ' + index + ':', item);

      var historyItem = document.createElement('div');
      historyItem.className = 'bonus-history-item';

      var date;
      try {
        date = new Date(item.timestamp).toLocaleDateString('uk-UA');
        console.log('📅 [INTEGRATION] Дата запису ' + index + ': ' + date);
      } catch (e) {
        console.error('❌ [INTEGRATION] Помилка парсингу дати для запису ' + index + ':', e);
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

    console.log('✅ [INTEGRATION] === updateBonusHistory COMPLETE ===');
  };

  console.log('✅ [INTEGRATION] Модуль ReferralIntegration завантажено');
  return ReferralIntegration;
})();

// Глобальна функція ініціалізації
window.initReferralSystem = function() {
  console.log('🎬 [GLOBAL] === initReferralSystem START ===');
  console.log('🕐 [GLOBAL] Час виклику:', new Date().toISOString());

  return new Promise(function(resolve, reject) {
    try {
      console.log('🏗️ [GLOBAL] Створення екземпляру ReferralIntegration...');
      var integration = new window.ReferralIntegration();

      console.log('🚀 [GLOBAL] Запуск integration.init()...');
      integration.init()
        .then(function() {
          // Зберігаємо екземпляр глобально для налагодження
          window.ReferralIntegrationInstance = integration;
          console.log('✅ [GLOBAL] Екземпляр збережено в window.ReferralIntegrationInstance');

          console.log('🏁 [GLOBAL] === initReferralSystem SUCCESS ===');
          resolve(integration);
        })
        .catch(function(error) {
          console.error('💥 [GLOBAL] === initReferralSystem FAILED ===');
          console.error('💥 [GLOBAL] Помилка:', error);
          reject(error);
        });
    } catch (error) {
      console.error('💥 [GLOBAL] Критична помилка в try-catch блоці');
      console.error('💥 [GLOBAL] Деталі:', error);
      reject(error);
    }
  });
};

console.log('✅ [GLOBAL] window.initReferralSystem функція зареєстрована');