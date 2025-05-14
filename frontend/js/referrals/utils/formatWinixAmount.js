/**
 * Утиліта для форматування сум Winix для відображення
 * Додає роздільники тисяч, скорочує великі числа,
 * забезпечує уніфіковане представлення сум в інтерфейсі
 *
 * @module referral/utils/formatWinixAmount
 */

/**
 * Форматує суму Winix для відображення з роздільниками тисяч
 *
 * @param {number|string} amount - Сума для форматування
 * @param {Object} [options] - Опції форматування
 * @param {string} [options.separator=' '] - Роздільник тисяч
 * @param {number} [options.decimals=2] - Кількість десяткових знаків
 * @param {boolean} [options.showCurrency=false] - Додавати символ валюти
 * @returns {string} Форматована сума
 */
export const formatWinixAmount = (amount, options = {}) => {
  // Перевіряємо вхідні дані
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('formatWinixAmount: Invalid amount provided', amount);
    return '0';
  }

  // Встановлюємо опції за замовчуванням
  const {
    separator = ' ',
    decimals = 2,
    showCurrency = false,
    currencySymbol = 'winix'
  } = options;

  // Округляємо до потрібної кількості знаків
  const roundedAmount = Number(numAmount.toFixed(decimals));

  // Форматуємо з роздільниками тисяч
  const formatted = roundedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  // Додаємо символ валюти, якщо потрібно
  return showCurrency ? `${formatted} ${currencySymbol}` : formatted;
};

/**
 * Скорочує великі суми для кращого відображення
 * Наприклад: 1500 -> 1.5K, 2500000 -> 2.5M
 *
 * @param {number|string} amount - Сума для скорочення
 * @param {Object} [options] - Опції форматування
 * @param {number} [options.decimals=1] - Кількість десяткових знаків
 * @param {boolean} [options.showCurrency=false] - Додавати символ валюти
 * @returns {string} Скорочена сума
 */
export const abbreviateWinixAmount = (amount, options = {}) => {
  // Перевіряємо вхідні дані
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('abbreviateWinixAmount: Invalid amount provided', amount);
    return '0';
  }

  // Встановлюємо опції за замовчуванням
  const {
    decimals = 1,
    showCurrency = false,
    currencySymbol = 'winix'
  } = options;

  // Визначаємо префікс в залежності від розміру суми
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

  // Видаляємо нульові десяткові частини
  result = result.replace(/\.0+([KMBT])?$/, '$1');

  // Додаємо символ валюти, якщо потрібно
  return showCurrency ? `${result} ${currencySymbol}` : result;
};

/**
 * Форматує суму із зазначенням тренду (позитивний/негативний)
 *
 * @param {number|string} amount - Сума для форматування
 * @param {Object} [options] - Опції форматування
 * @param {boolean} [options.showPlus=true] - Показувати "+" для позитивних сум
 * @param {boolean} [options.colorize=false] - Повертати HTML з CSS-класами для кольору
 * @returns {string} Форматована сума з трендом
 */
export const formatWinixWithTrend = (amount, options = {}) => {
  // Перевіряємо вхідні дані
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('formatWinixWithTrend: Invalid amount provided', amount);
    return '0';
  }

  // Встановлюємо опції за замовчуванням
  const {
    showPlus = true,
    colorize = false,
    separator = ' ',
    showCurrency = false
  } = options;

  // Форматуємо суму
  const formatted = formatWinixAmount(Math.abs(numAmount), {
    separator,
    showCurrency
  });

  let result;
  if (numAmount > 0) {
    result = showPlus ? `+${formatted}` : formatted;
    if (colorize) {
      result = `<span class="positive-trend">${result}</span>`;
    }
  } else if (numAmount < 0) {
    result = `-${formatted}`;
    if (colorize) {
      result = `<span class="negative-trend">${result}</span>`;
    }
  } else {
    result = formatted;
  }

  return result;
};

/**
 * Форматує суму для відображення в графіках або обмежених просторах
 *
 * @param {number|string} amount - Сума для форматування
 * @param {number} maxLength - Максимальна довжина результуючого рядка
 * @returns {string} Форматована скорочена сума
 */
export const formatWinixCompact = (amount, maxLength = 6) => {
  // Перевіряємо вхідні дані
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    console.warn('formatWinixCompact: Invalid amount provided', amount);
    return '0';
  }

  // Скорочуємо суму
  let formatted = abbreviateWinixAmount(numAmount);

  // Якщо результат все ще довший за maxLength, скорочуємо десяткові
  if (formatted.length > maxLength) {
    const hasLetter = /[KMBT]$/.test(formatted);
    if (hasLetter) {
      const letter = formatted.slice(-1);
      formatted = parseFloat(formatted).toFixed(0) + letter;
    } else {
      formatted = parseFloat(formatted).toFixed(0);
    }
  }

  return formatted;
};

/**
 * Форматує суму для запису в базу даних або для обчислень
 * (видаляє всі не-числові символи і конвертує в число)
 *
 * @param {string|number} amount - Сума для форматування
 * @returns {number} Числова сума
 */
export const normalizeWinixAmount = (amount) => {
  if (typeof amount === 'number') {
    return amount;
  }

  if (typeof amount !== 'string') {
    console.warn('normalizeWinixAmount: Invalid amount provided', amount);
    return 0;
  }

  // Видаляємо всі не-числові символи, крім крапки
  const cleaned = amount.replace(/[^\d.-]/g, '');
  const numAmount = parseFloat(cleaned);

  return isNaN(numAmount) ? 0 : numAmount;
};