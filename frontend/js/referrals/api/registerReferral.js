/**
 * API для реєстрації нових рефералів
 *
 * Функції для взаємодії з бекендом при реєстрації нового реферала
 * та нарахуванні бонусів за запрошення
 *
 * @module registerReferral
 */

/**
 * Реєструє нового реферала у системі
 * @param {string|number} referrerId - ID користувача, який запросив нового користувача (реферера)
 * @param {string|number} userId - ID нового користувача (реферала)
 * @returns {Promise<Object>} Інформація про успішну реєстрацію реферала
 * @throws {Error} Помилка при реєстрації реферала
 */
export const registerReferral = async (referrerId, userId) => {
  if (!referrerId) {
    throw new Error('Referrer ID is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  // Перевірка на реєстрацію самого себе як реферала
  if (referrerId === userId) {
    throw new Error('User cannot refer themselves');
  }

  try {
    // Імітація запиту до API
    // В реальному додатку тут був би код для відправки запиту на сервер
    // const response = await fetch('/api/referrals/register', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ referrerId, userId })
    // });
    // const data = await response.json();
    // if (!response.ok) throw new Error(data.message || 'Failed to register referral');
    // return data;

    // Для тестування, імітуємо затримку мережі і повертаємо тестові дані
    await new Promise(resolve => setTimeout(resolve, 300));

    // Імітація відповіді від сервера
    return {
      success: true,
      referrerId,
      userId,
      timestamp: new Date().toISOString(),
      bonusAmount: 50 // Це значення в реальності має повертатись від бекенду
    };
  } catch (error) {
    console.error('Error registering referral:', error);
    throw new Error('Failed to register referral: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Перевіряє чи є користувач рефералом
 * @param {string|number} userId - ID користувача для перевірки
 * @returns {Promise<boolean>} Чи є користувач рефералом
 */
export const checkIfReferral = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Імітація запиту до API
    await new Promise(resolve => setTimeout(resolve, 200));

    // В реальному додатку тут був би запит до API
    // Для тестування повертаємо випадковий результат
    return Math.random() > 0.5;
  } catch (error) {
    console.error('Error checking referral status:', error);
    throw new Error('Failed to check referral status');
  }
};

export default registerReferral;