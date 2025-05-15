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
    // Відправляємо запит на API для реєстрації реферала
    const response = await fetch('/api/referrals/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer_id: referrerId, referee_id: userId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to register referral');
    }

    return data;
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
    // Отримуємо статистику користувача для перевірки наявності реферера
    const response = await fetch(`/api/referrals/stats/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check referral status');
    }

    // Перевіряємо наявність реферера у відповіді
    if (data && data.referrals) {
      // Користувач є рефералом, якщо у нього є реферер
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking referral status:', error);
    throw new Error('Failed to check referral status');
  }
};

export default registerReferral;