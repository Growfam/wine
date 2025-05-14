/**
 * Сервіс для розрахунку прямих бонусів за рефералів
 *
 * Обчислює розмір винагороди за запрошення нових користувачів
 * відповідно до встановлених ставок бонусів
 *
 * @module calculateDirectBonus
 */

import { DIRECT_BONUS_AMOUNT } from '../constants/directBonuses';

/**
 * Розрахунок бонусу за нового реферала
 * @param {number} [count=1] - Кількість нових рефералів
 * @param {number} [customAmount] - Власне значення бонусу (опціонально)
 * @returns {number} Загальна сума бонусу
 */
export const calculateDirectBonus = (count = 1, customAmount) => {
  // Перевірка вхідних параметрів
  if (typeof count !== 'number' || isNaN(count) || count < 0) {
    throw new Error('Count must be a positive number');
  }

  // Округляємо до цілого числа, щоб уникнути дробових значень
  const referralCount = Math.floor(count);

  // Використовуємо власне значення бонусу, якщо вказано
  const bonusAmount = customAmount !== undefined ? customAmount : DIRECT_BONUS_AMOUNT;

  if (typeof bonusAmount !== 'number' || isNaN(bonusAmount) || bonusAmount < 0) {
    throw new Error('Bonus amount must be a positive number');
  }

  // Обчислюємо загальну суму бонусу
  return referralCount * bonusAmount;
};

/**
 * Калькулятор потенційного бонусу за реферальну програму
 *
 * @param {Object} options - Параметри для розрахунку
 * @param {number} options.referralsCount - Кількість рефералів
 * @param {number} [options.bonusAmount] - Розмір бонусу за одного реферала (опціонально)
 * @returns {Object} Результат розрахунку { totalBonus, perReferral, count }
 */
export const calculatePotentialDirectBonus = ({ referralsCount, bonusAmount }) => {
  const amount = bonusAmount || DIRECT_BONUS_AMOUNT;
  const count = Math.max(0, referralsCount || 0);

  return {
    totalBonus: count * amount,
    perReferral: amount,
    count
  };
};

export default calculateDirectBonus;