// utils.js - Версія з детальним логуванням та новим форматом реферальних посилань
/**
 * Утиліти для реферальної системи
 */
window.ReferralUtils = (function() {
  'use strict';

  console.log('📦 [UTILS] ========== ЗАВАНТАЖЕННЯ МОДУЛЯ ReferralUtils ==========');
  console.log('🕐 [UTILS] Час завантаження:', new Date().toISOString());

  // Безпечна функція для перевірки включення підрядка
  window.safeIncludes = function(str, search) {
    console.log('🔍 [UTILS] === safeIncludes START ===');
    console.log('📊 [UTILS] Параметри:', {
      str: typeof str,
      strValue: str,
      search: typeof search,
      searchValue: search
    });

    // Перевіряємо, чи str це рядок
    if (typeof str !== 'string') {
      console.warn('⚠️ [UTILS] safeIncludes: перший аргумент не є рядком', str);
      return false;
    }

    // Перевіряємо, чи search це рядок
    if (typeof search !== 'string') {
      console.warn('⚠️ [UTILS] safeIncludes: другий аргумент не є рядком', search);
      return false;
    }

    const result = str.indexOf(search) >= 0;
    console.log('✅ [UTILS] safeIncludes результат:', result);
    return result;
  };

  console.log('✅ [UTILS] window.safeIncludes створено/оновлено');

  // calculatePercentage.js
  function calculatePercentage(amount, rate, round) {
    console.log('📊 [UTILS] === calculatePercentage START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      rate: rate,
      round: round
    });

    round = round !== false; // default true

    if (typeof amount !== 'number' || isNaN(amount)) {
      console.error('❌ [UTILS] Некоректне значення amount:', amount);
      throw new Error('Сума повинна бути числом');
    }

    if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
      console.error('❌ [UTILS] Некоректне значення rate:', rate);
      throw new Error('Ставка повинна бути додатнім числом');
    }

    const result = amount * rate;
    const finalResult = round ? Math.round(result) : result;

    console.log('✅ [UTILS] Результат calculatePercentage:', {
      raw: result,
      final: finalResult
    });

    return finalResult;
  }

  function formatPercentageResult(amount, rate, options) {
    console.log('💰 [UTILS] === formatPercentageResult START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      rate: rate,
      options: options
    });

    options = options || {};
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const showPercentage = options.showPercentage || false;

    const calculatedAmount = calculatePercentage(amount, rate);

    const percentageString = showPercentage
      ? ' (' + (rate * 100).toFixed(1) + '%)'
      : '';

    const result = prefix + calculatedAmount + suffix + percentageString;
    console.log('✅ [UTILS] Форматований результат:', result);

    return result;
  }

  function calculateMultiplePercentages(amount, rates) {
    console.log('📊 [UTILS] === calculateMultiplePercentages START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      rates: rates
    });

    if (!Array.isArray(rates)) {
      console.error('❌ [UTILS] rates не є масивом');
      throw new Error('Ставки повинні бути передані масивом');
    }

    const results = rates.map(function(rate, index) {
      const result = calculatePercentage(amount, rate);
      console.log(`  📊 [UTILS] Результат для ставки ${index} (${rate}):`, result);
      return result;
    });

    console.log('✅ [UTILS] Всі результати:', results);
    return results;
  }

  // formatReferralUrl.js - ОНОВЛЕНО для нового формату
  function formatReferralUrl(userId) {
    console.log('🔗 [UTILS] === formatReferralUrl START ===');
    console.log('📊 [UTILS] userId:', userId);

    if (!userId) {
      console.error('❌ [UTILS] userId відсутній');
      throw new Error('User ID обов\'язковий для генерації реферального посилання');
    }

    // Переконуємося що userId це число або можна конвертувати
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
    console.log('📊 [UTILS] Конвертація userId:', {
      original: userId,
      numeric: numericUserId,
      isNaN: isNaN(numericUserId)
    });

    if (isNaN(numericUserId)) {
      console.error('❌ [UTILS] userId не можна конвертувати в число');
      throw new Error('User ID повинен бути числом');
    }

    // Використовуємо новий формат: https://t.me/WINIX_Official_bot?start={id}
    const REFERRAL_URL_PATTERN = window.ReferralConstants.REFERRAL_URL_PATTERN;
    console.log('📊 [UTILS] URL шаблон:', REFERRAL_URL_PATTERN);

    const result = REFERRAL_URL_PATTERN.replace('{id}', numericUserId.toString());
    console.log('✅ [UTILS] Сформоване посилання:', result);

    return result;
  }

  // formatWinixAmount.js
  function formatWinixAmount(amount, options) {
    console.log('💰 [UTILS] === formatWinixAmount START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      options: options
    });

    options = options || {};
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      console.warn('⚠️ [UTILS] formatWinixAmount: Invalid amount provided', amount);
      return '0';
    }

    const separator = options.separator || ' ';
    const decimals = options.decimals !== undefined ? options.decimals : 2;
    const showCurrency = options.showCurrency || false;
    const currencySymbol = options.currencySymbol || 'winix';

    const roundedAmount = Number(numAmount.toFixed(decimals));
    const formatted = roundedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    const result = showCurrency ? formatted + ' ' + currencySymbol : formatted;
    console.log('✅ [UTILS] Форматована сума:', result);

    return result;
  }

  function abbreviateWinixAmount(amount, options) {
    console.log('💰 [UTILS] === abbreviateWinixAmount START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      options: options
    });

    options = options || {};
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      console.warn('⚠️ [UTILS] abbreviateWinixAmount: Invalid amount provided', amount);
      return '0';
    }

    const decimals = options.decimals !== undefined ? options.decimals : 1;
    const showCurrency = options.showCurrency || false;
    const currencySymbol = options.currencySymbol || 'winix';

    let result;
    if (numAmount >= 1000000000) {
      result = (numAmount / 1000000000).toFixed(decimals) + 'B';
    } else if (numAmount >= 1000000) {
      result = (numAmount / 1000000).toFixed(decimals) + 'M';
    } else if (numAmount >= 1000) {
      result = (numAmount / 1000).toFixed(decimals) + 'K';
    } else {
      result = numAmount.toFixed(decimals);
    }

    result = result.replace(/\.0+([KMBT])?$/, '$1');

    const finalResult = showCurrency ? result + ' ' + currencySymbol : result;
    console.log('✅ [UTILS] Скорочена сума:', finalResult);

    return finalResult;
  }

  function formatWinixWithTrend(amount, options) {
    console.log('📈 [UTILS] === formatWinixWithTrend START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      options: options
    });

    options = options || {};
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      console.warn('⚠️ [UTILS] formatWinixWithTrend: Invalid amount provided', amount);
      return '0';
    }

    const showPlus = options.showPlus !== false;
    const colorize = options.colorize || false;
    const separator = options.separator || ' ';
    const showCurrency = options.showCurrency || false;

    const formatted = formatWinixAmount(Math.abs(numAmount), {
      separator: separator,
      showCurrency: showCurrency
    });

    let result;
    if (numAmount > 0) {
      result = showPlus ? '+' + formatted : formatted;
      if (colorize) {
        result = '<span class="positive-trend">' + result + '</span>';
      }
    } else if (numAmount < 0) {
      result = '-' + formatted;
      if (colorize) {
        result = '<span class="negative-trend">' + result + '</span>';
      }
    } else {
      result = formatted;
    }

    console.log('✅ [UTILS] Форматована сума з трендом:', result);
    return result;
  }

  function formatWinixCompact(amount, maxLength) {
    console.log('📐 [UTILS] === formatWinixCompact START ===');
    console.log('📊 [UTILS] Параметри:', {
      amount: amount,
      maxLength: maxLength
    });

    maxLength = maxLength || 6;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      console.warn('⚠️ [UTILS] formatWinixCompact: Invalid amount provided', amount);
      return '0';
    }

    let formatted = abbreviateWinixAmount(numAmount);

    if (formatted.length > maxLength) {
      const hasLetter = /[KMBT]$/.test(formatted);
      if (hasLetter) {
        const letter = formatted.slice(-1);
        formatted = parseFloat(formatted).toFixed(0) + letter;
      } else {
        formatted = parseFloat(formatted).toFixed(0);
      }
    }

    console.log('✅ [UTILS] Компактна сума:', formatted);
    return formatted;
  }

  function normalizeWinixAmount(amount) {
    console.log('🔧 [UTILS] === normalizeWinixAmount START ===');
    console.log('📊 [UTILS] Вхідне значення:', amount, 'тип:', typeof amount);

    if (typeof amount === 'number') {
      console.log('✅ [UTILS] Вже число:', amount);
      return amount;
    }

    if (typeof amount !== 'string') {
      console.warn('⚠️ [UTILS] normalizeWinixAmount: Invalid amount provided', amount);
      return 0;
    }

    const cleaned = amount.replace(/[^\d.-]/g, '');
    const numAmount = parseFloat(cleaned);

    console.log('📊 [UTILS] Очищене значення:', cleaned);
    console.log('📊 [UTILS] Числове значення:', numAmount);

    return isNaN(numAmount) ? 0 : numAmount;
  }

  // isActiveReferral.js
  function isActiveReferral(referralData, options) {
    console.log('🎯 [UTILS] === isActiveReferral START ===');
    console.log('📊 [UTILS] Параметри:', {
      referralData: referralData,
      options: options
    });

    options = options || {};
    if (!referralData) {
      console.warn('⚠️ [UTILS] referralData відсутні');
      return false;
    }

    const drawsParticipation = referralData.drawsParticipation || 0;
    const invitedReferrals = referralData.invitedReferrals || 0;
    const manuallyActivated = referralData.manuallyActivated || false;

    const drawsThreshold = options.drawsThreshold !== undefined
      ? options.drawsThreshold
      : window.ReferralConstants.MIN_DRAWS_PARTICIPATION;
    const invitedThreshold = options.invitedThreshold !== undefined
      ? options.invitedThreshold
      : window.ReferralConstants.MIN_INVITED_REFERRALS;
    const requireAllCriteria = options.requireAllCriteria || false;

    console.log('📊 [UTILS] Дані реферала:', {
      drawsParticipation: drawsParticipation,
      invitedReferrals: invitedReferrals,
      manuallyActivated: manuallyActivated
    });

    console.log('📊 [UTILS] Пороги:', {
      drawsThreshold: drawsThreshold,
      invitedThreshold: invitedThreshold,
      requireAllCriteria: requireAllCriteria
    });

    if (manuallyActivated) {
      console.log('✅ [UTILS] Активований вручну');
      return true;
    }

    const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
    const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

    console.log('📊 [UTILS] Відповідність критеріям:', {
      meetsDrawsCriteria: meetsDrawsCriteria,
      meetsInvitedCriteria: meetsInvitedCriteria
    });

    let result;
    if (requireAllCriteria) {
      result = meetsDrawsCriteria && meetsInvitedCriteria;
    } else {
      result = meetsDrawsCriteria || meetsInvitedCriteria;
    }

    console.log('✅ [UTILS] Результат isActiveReferral:', result);
    return result;
  }

  function getDetailedActivityStatus(referralData, options) {
    console.log('📊 [UTILS] === getDetailedActivityStatus START ===');
    console.log('📊 [UTILS] Параметри:', {
      referralData: referralData,
      options: options
    });

    options = options || {};
    if (!referralData) {
      console.warn('⚠️ [UTILS] referralData відсутні');
      return {
        isActive: false,
        drawsParticipation: 0,
        invitedReferrals: 0,
        meetsDrawsCriteria: false,
        meetsInvitedCriteria: false,
        manuallyActivated: false,
        reasonForActivity: null
      };
    }

    const drawsParticipation = referralData.drawsParticipation || 0;
    const invitedReferrals = referralData.invitedReferrals || 0;
    const manuallyActivated = referralData.manuallyActivated || false;

    const drawsThreshold = options.drawsThreshold !== undefined
      ? options.drawsThreshold
      : window.ReferralConstants.MIN_DRAWS_PARTICIPATION;
    const invitedThreshold = options.invitedThreshold !== undefined
      ? options.invitedThreshold
      : window.ReferralConstants.MIN_INVITED_REFERRALS;

    const meetsDrawsCriteria = drawsParticipation >= drawsThreshold;
    const meetsInvitedCriteria = invitedReferrals >= invitedThreshold;

    let reasonForActivity = null;

    if (manuallyActivated) {
      reasonForActivity = 'manual_activation';
    } else if (meetsDrawsCriteria && meetsInvitedCriteria) {
      reasonForActivity = 'both_criteria';
    } else if (meetsDrawsCriteria) {
      reasonForActivity = 'draws_criteria';
    } else if (meetsInvitedCriteria) {
      reasonForActivity = 'invited_criteria';
    }

    const isActive = manuallyActivated || meetsDrawsCriteria || meetsInvitedCriteria;

    const result = {
      isActive: isActive,
      drawsParticipation: drawsParticipation,
      invitedReferrals: invitedReferrals,
      requiredDraws: drawsThreshold,
      requiredInvited: invitedThreshold,
      meetsDrawsCriteria: meetsDrawsCriteria,
      meetsInvitedCriteria: meetsInvitedCriteria,
      manuallyActivated: manuallyActivated,
      reasonForActivity: reasonForActivity
    };

    console.log('✅ [UTILS] Детальний статус активності:', result);
    return result;
  }

  // sortReferralsByEarnings.js
  function sortReferralsByEarnings(referrals, options) {
    console.log('🔄 [UTILS] === sortReferralsByEarnings START ===');
    console.log('📊 [UTILS] Параметри:', {
      referralsCount: referrals ? referrals.length : 0,
      options: options
    });

    options = options || {};
    if (!Array.isArray(referrals)) {
      console.error('❌ [UTILS] referrals must be an array');
      return [];
    }

    const ascending = options.ascending || false;
    const earningsField = options.earningsField || 'totalEarnings';

    console.log('📊 [UTILS] Налаштування сортування:', {
      ascending: ascending,
      earningsField: earningsField
    });

    const sorted = referrals.slice().sort(function(a, b) {
      const aEarnings = parseFloat(a[earningsField] || 0);
      const bEarnings = parseFloat(b[earningsField] || 0);

      return ascending ? aEarnings - bEarnings : bEarnings - aEarnings;
    });

    console.log('✅ [UTILS] Відсортовано рефералів:', sorted.length);
    return sorted;
  }

  function sortByPercentageRewards(referrals, ascending) {
    console.log('📊 [UTILS] sortByPercentageRewards викликано');
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'percentageEarnings'
    });
  }

  function sortByInvitedCount(referrals, ascending) {
    console.log('👥 [UTILS] sortByInvitedCount викликано');
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'invitedCount'
    });
  }

  function sortByDrawsParticipation(referrals, ascending) {
    console.log('🎲 [UTILS] sortByDrawsParticipation викликано');
    return sortReferralsByEarnings(referrals, {
      ascending: ascending,
      earningsField: 'drawsParticipation'
    });
  }

  function sortByActivity(referrals) {
    console.log('🎯 [UTILS] === sortByActivity START ===');
    console.log('📊 [UTILS] Кількість рефералів:', referrals ? referrals.length : 0);

    if (!Array.isArray(referrals)) {
      console.error('❌ [UTILS] referrals must be an array');
      return [];
    }

    const sorted = referrals.slice().sort(function(a, b) {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;

      const aEarnings = parseFloat(a.totalEarnings || 0);
      const bEarnings = parseFloat(b.totalEarnings || 0);

      return bEarnings - aEarnings;
    });

    console.log('✅ [UTILS] Відсортовано за активністю');
    return sorted;
  }

  function filterAndSortReferrals(referrals, filters, sortOptions) {
    console.log('🔍 [UTILS] === filterAndSortReferrals START ===');
    console.log('📊 [UTILS] Параметри:', {
      referralsCount: referrals ? referrals.length : 0,
      filters: filters,
      sortOptions: sortOptions
    });

    filters = filters || {};
    sortOptions = sortOptions || {};

    if (!Array.isArray(referrals)) {
      console.error('❌ [UTILS] referrals must be an array');
      return [];
    }

    const onlyActive = filters.onlyActive;
    const minEarnings = filters.minEarnings || 0;
    const by = sortOptions.by || 'earnings';
    const ascending = sortOptions.ascending || false;

    console.log('📊 [UTILS] Фільтри:', {
      onlyActive: onlyActive,
      minEarnings: minEarnings
    });

    let filtered = referrals.slice();

    if (onlyActive) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(function(referral) {
        return referral.active;
      });
      console.log(`🔍 [UTILS] Відфільтровано активних: ${filtered.length} з ${beforeCount}`);
    }

    if (minEarnings > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(function(referral) {
        const earnings = parseFloat(referral.totalEarnings || 0);
        return earnings >= minEarnings;
      });
      console.log(`🔍 [UTILS] Відфільтровано за заробітком: ${filtered.length} з ${beforeCount}`);
    }

    console.log('📊 [UTILS] Сортування за:', by);

    let result;
    switch (by) {
      case 'invites':
        result = sortByInvitedCount(filtered, ascending);
        break;
      case 'draws':
        result = sortByDrawsParticipation(filtered, ascending);
        break;
      case 'activity':
        result = sortByActivity(filtered);
        break;
      case 'percentage':
        result = sortByPercentageRewards(filtered, ascending);
        break;
      case 'earnings':
      default:
        result = sortReferralsByEarnings(filtered, { ascending: ascending });
        break;
    }

    console.log('✅ [UTILS] Результат filterAndSortReferrals:', result.length);
    return result;
  }

  // generateReferralLink.js - ОНОВЛЕНО для нового формату
  function generateReferralLink(userId) {
    console.log('🔗 [UTILS] === generateReferralLink START ===');
    console.log('📊 [UTILS] userId:', userId);

    if (!userId) {
      console.error('❌ [UTILS] userId відсутній');
      throw new Error('User ID обов\'язковий');
    }

    // Переконуємося що userId це число
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
    console.log('📊 [UTILS] Конвертація userId:', {
      original: userId,
      numeric: numericUserId,
      isNaN: isNaN(numericUserId)
    });

    if (isNaN(numericUserId)) {
      console.error('❌ [UTILS] userId не можна конвертувати в число');
      throw new Error('User ID повинен бути числом');
    }

    return new Promise(function(resolve, reject) {
      try {
        console.log('🔄 [UTILS] Виклик ReferralAPI.fetchReferralLink...');

        // Викликаємо API функцію через глобальну змінну
        window.ReferralAPI.fetchReferralLink(numericUserId)
          .then(function(referralLink) {
            console.log('✅ [UTILS] Посилання отримано від API:', referralLink);

            // Якщо API повертає повне посилання, використовуємо його
            // Інакше форматуємо URL через утиліту
            if (referralLink && referralLink.includes('t.me/WINIX_Official_bot')) {
              console.log('✅ [UTILS] Використовуємо посилання від API');
              resolve(referralLink);
            } else {
              console.log('🔧 [UTILS] Форматуємо посилання локально');
              resolve(formatReferralUrl(numericUserId));
            }
          })
          .catch(function(error) {
            console.error('❌ [UTILS] Error generating referral link:', error);
            // У випадку помилки API, використовуємо локальну утиліту
            console.log('🔧 [UTILS] Використовуємо локальне форматування через помилку API');
            resolve(formatReferralUrl(numericUserId));
          });
      } catch (error) {
        console.error('❌ [UTILS] Error in try block:', error);
        // У випадку помилки, використовуємо локальну утиліту
        console.log('🔧 [UTILS] Використовуємо локальне форматування через виключення');
        resolve(formatReferralUrl(numericUserId));
      }
    });
  }

  // Додаткові функції для роботи з новим форматом
  function getTelegramBotUrl() {
    console.log('🤖 [UTILS] getTelegramBotUrl викликано');
    const url = window.ReferralConstants.TELEGRAM_BOT_URL;
    console.log('✅ [UTILS] URL бота:', url);
    return url;
  }

  function parseReferralUrl(url) {
    console.log('🔍 [UTILS] === parseReferralUrl START ===');
    console.log('📊 [UTILS] URL для парсингу:', url);

    if (!url || typeof url !== 'string') {
      console.error('❌ [UTILS] Некоректний URL');
      return null;
    }

    // Парсимо новий формат: https://t.me/WINIX_Official_bot?start={id}
    const match = url.match(/https:\/\/t\.me\/WINIX_Official_bot\?start=(\d+)/);
    if (match) {
      const result = {
        userId: parseInt(match[1]),
        isValid: true,
        format: 'telegram'
      };
      console.log('✅ [UTILS] Розпарсено новий формат:', result);
      return result;
    }

    // Підтримуємо старий формат для зворотної сумісності: Winix/referral/{id}
    const oldMatch = url.match(/Winix\/referral\/(\d+)/);
    if (oldMatch) {
      const result = {
        userId: parseInt(oldMatch[1]),
        isValid: true,
        format: 'legacy'
      };
      console.log('✅ [UTILS] Розпарсено старий формат:', result);
      return result;
    }

    console.log('❌ [UTILS] Не вдалося розпарсити URL');
    return {
      userId: null,
      isValid: false,
      format: 'unknown'
    };
  }

  function isValidReferralUrl(url) {
    console.log('✅ [UTILS] === isValidReferralUrl START ===');
    console.log('📊 [UTILS] URL:', url);

    const parsed = parseReferralUrl(url);
    const isValid = parsed && parsed.isValid;

    console.log('✅ [UTILS] Результат валідації:', isValid);
    return isValid;
  }

  // Підрахунок функцій
  const publicAPI = {
    calculatePercentage: calculatePercentage,
    formatPercentageResult: formatPercentageResult,
    calculateMultiplePercentages: calculateMultiplePercentages,
    formatReferralUrl: formatReferralUrl,
    formatWinixAmount: formatWinixAmount,
    abbreviateWinixAmount: abbreviateWinixAmount,
    formatWinixWithTrend: formatWinixWithTrend,
    formatWinixCompact: formatWinixCompact,
    normalizeWinixAmount: normalizeWinixAmount,
    isActiveReferral: isActiveReferral,
    getDetailedActivityStatus: getDetailedActivityStatus,
    sortReferralsByEarnings: sortReferralsByEarnings,
    sortByPercentageRewards: sortByPercentageRewards,
    sortByInvitedCount: sortByInvitedCount,
    sortByDrawsParticipation: sortByDrawsParticipation,
    sortByActivity: sortByActivity,
    filterAndSortReferrals: filterAndSortReferrals,
    generateReferralLink: generateReferralLink,
    getTelegramBotUrl: getTelegramBotUrl,
    parseReferralUrl: parseReferralUrl,
    isValidReferralUrl: isValidReferralUrl
  };

  console.log('✅ [UTILS] ========== МОДУЛЬ ReferralUtils ЗАВАНТАЖЕНО УСПІШНО ==========');
  console.log('📊 [UTILS] Експортовано функцій:', Object.keys(publicAPI).length);
  console.log('📋 [UTILS] Список функцій:', Object.keys(publicAPI));

  return publicAPI;
})();

// Перевірка доступності
console.log('🔍 [UTILS] Перевірка доступності window.ReferralUtils:', {
  exists: typeof window.ReferralUtils !== 'undefined',
  type: typeof window.ReferralUtils,
  methods: window.ReferralUtils ? Object.keys(window.ReferralUtils).length : 0
});