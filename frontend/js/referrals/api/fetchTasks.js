/**
 * API для отримання та взаємодії із завданнями користувача
 *
 * @module referral/api/fetchTasks
 */

/**
 * Отримує інформацію про завдання користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Інформація про завдання
 * @throws {Error} Помилка при отриманні даних
 */
export const fetchUserTasks = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для отримання даних про завдання');
  }

  try {
    const response = await fetch(`/api/tasks/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання даних про завдання');
    }

    return data;
  } catch (error) {
    console.error('Помилка отримання даних про завдання:', error);
    throw new Error(`Не вдалося отримати дані про завдання: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Оновлює прогрес завдань користувача
 * @param {string|number} userId - ID користувача
 * @returns {Promise<Object>} Результат оновлення завдань
 * @throws {Error} Помилка при оновленні завдань
 */
export const updateTasks = async (userId) => {
  if (!userId) {
    throw new Error('ID користувача обов\'язковий для оновлення завдань');
  }

  try {
    const response = await fetch(`/api/tasks/update/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка оновлення завдань');
    }

    return data;
  } catch (error) {
    console.error('Помилка оновлення завдань:', error);
    throw new Error(`Не вдалося оновити завдання: ${error.message || 'Невідома помилка'}`);
  }
};

/**
 * Отримує винагороду за виконане завдання
 * @param {string|number} userId - ID користувача
 * @param {string} taskType - Тип завдання (REFERRAL_COUNT, ACTIVE_REFERRALS тощо)
 * @returns {Promise<Object>} Результат отримання винагороди
 * @throws {Error} Помилка при отриманні винагороди
 */
export const claimTaskReward = async (userId, taskType) => {
  if (!userId || !taskType) {
    throw new Error('ID користувача та тип завдання обов\'язкові для отримання винагороди');
  }

  try {
    const response = await fetch(`/api/tasks/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        task_type: taskType
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Помилка отримання винагороди за завдання');
    }

    // Оновлюємо баланс користувача на фронтенді, якщо операція була успішною
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
    console.error('Помилка отримання винагороди за завдання:', error);
    throw new Error(`Не вдалося отримати винагороду: ${error.message || 'Невідома помилка'}`);
  }
};