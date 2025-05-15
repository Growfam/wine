/**
 * API для отримання та взаємодії з бейджами користувача
 *
 * @module referral/api/fetchBadges
 */

/**
 * Отримує інформацію про бейджі користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Інформація про бейджі
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchUserBadges = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про бейджі');
  }

  try {
    const response = await fetch(`/api/badges/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання даних про бейджі');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про бейджі:', error);
    throw new Error(`Не вдалося отримати дані про бейджі: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Перевіряє та нараховує бейджі користувачу
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Результат перевірки бейджів
 * @throws {Error} Помилка при перевірці бейджів
 */
export const checkBadges = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для перевірки бейджів');
  }

  try {
    const response = await fetch(`/api/badges/check/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка перевірки бейджів');
    }

    return data;
  } catch (error) {
    console.error('Помилка перевірки бейджів:', error);
    throw new Error(`Не вдалося перевірити бейджі: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує винагороду за бейдж
 * @param {string|number} userId - ID користувача
 * @param {string} badgeType - Тип бейджа (BRONZE, SILVER, GOLD, PLATINUM)
 * @returns {Promise<Object>} Результат отримання винагороди
 * @throws {Error} Помилка при отриманні винагороди
 */
export const claimBadgeReward = async (userId, badgeType) => {
  if (!userId || !badgeType) {
    throw new Error('ID користувача та тип бейджа обов\'язкові для отримання винагороди');
  }

  try {
    const response = await fetch(`/api/badges/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        badge_type: badgeType
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання винагороди за бейдж');
    }

    // Оновлюємо балансу користувача на фронтенді, якщо операція була успішною
    if (data.success && window.updateUserBalanceDisplay && data.reward_amount) {
      try {
        // Отримуємо поточний баланс
        const currentBalance = parseFloat(localStorage.getItem('winix_balance') || '0');
        // Оновлюємо баланс з анімацією
        window.updateUserBalanceDisplay(currentBalance + data.reward_amount, true);
      } catch (e) {
        console.warn('Не вдалося оновити відображення балансу:', e);
      }
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання винагороди за бейдж:', error);
    throw new Error(`Не вдалося отримати винагороду: ${error.message || 'Невідома помилка'}`);
  }
};