/**
 * Утиліта для розрахунку відсоткових винагород
 *
 * Містить функції для обчислення сум на основі заданих відсотків
 * та надає допоміжні методи для форматування результатів
 *
 * @module calculatePercentage
 */

/**
 * Обчислює суму на основі відсоткової ставки
 * @param {number} amount - Базова сума для обчислення відсотків
 * @param {number} rate - Відсоткова ставка (від 0 до 1)
 * @param {boolean} [round=true] - Чи округляти результат до цілого числа
 * @returns {number} Обчислена сума
 * @throws {Error} Помилка про некоректні вхідні параметри
 */
export const calculatePercentage = (amount, rate, round = true) => {
  // Перевірка вхідних параметрів
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Сума повинна бути числом');
  }

  if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
    throw new Error('Ставка повинна бути додатнім числом');
  }

  // Обчислення результату
  const result = amount * rate;

  // Округлення, якщо потрібно
  return round ? Math.round(result) : result;
};

/**
 * Обчислює суму з форматуванням для відображення
 * @param {number} amount - Базова сума для обчислення відсотків
 * @param {number} rate - Відсоткова ставка (від 0 до 1)
 * @param {Object} [options] - Опції форматування
 * @param {string} [options.prefix=''] - Префікс для результату
 * @param {string} [options.suffix=''] - Суфікс для результату
 * @param {boolean} [options.showPercentage=false] - Чи додавати відсотки до результату
 * @returns {string} Форматований рядок з результатом
 */
export const formatPercentageResult = (amount, rate, options = {}) => {
  const {
    prefix = '',
    suffix = '',
    showPercentage = false
  } = options;

  // Обчислюємо суму
  const calculatedAmount = calculatePercentage(amount, rate);

  // Формуємо рядок відсотків, якщо потрібно
  const percentageString = showPercentage
    ? ` (${(rate * 100).toFixed(1)}%)`
    : '';

  // Повертаємо форматований результат
  return `${prefix}${calculatedAmount}${suffix}${percentageString}`;
};

/**
 * Обчислює масив сум на основі базової суми та масиву ставок
 * @param {number} amount - Базова сума для обчислення
 * @param {Array<number>} rates - Масив ставок
 * @returns {Array<number>} Масив обчислених сум
 */
export const calculateMultiplePercentages = (amount, rates) => {
  if (!Array.isArray(rates)) {
    throw new Error('Ставки повинні бути передані масивом');
  }

  return rates.map(rate => calculatePercentage(amount, rate));
};

export default calculatePercentage;