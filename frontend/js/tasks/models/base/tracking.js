/**
 * Генерація URL з UTM-мітками для трекінгу
 */

/**
 * Створення трекінгового URL з UTM-мітками
 * @param {Object} task - Завдання
 * @param {string} userId - ID користувача
 * @returns {string} URL з трекінгом
 */
export function generateTrackingUrl(task, userId) {
  if (!task.partner_url && !task.action_url) {
    return '';
  }

  try {
    const url = new URL(task.partner_url || task.action_url);

    // Додаємо базові UTM параметри
    url.searchParams.append('utm_source', 'winix');
    url.searchParams.append('utm_medium', 'quest');
    url.searchParams.append('utm_campaign', task.id);

    // Додаємо ID користувача, якщо є
    if (userId) {
      url.searchParams.append('utm_term', userId);
    }

    // Додаємо партнерський ID та зовнішній трекінг, якщо є
    if (task.partner_id) {
      url.searchParams.append('partner_id', task.partner_id);
    }

    if (task.external_tracking_id) {
      url.searchParams.append('tracking_id', task.external_tracking_id);
    }

    return url.toString();
  } catch (error) {
    console.error('Помилка створення трекінгового URL:', error);
    return task.partner_url || task.action_url;
  }
}

/**
 * Перевірка чи містить URL трекінгові параметри
 * @param {string} url - URL для перевірки
 * @returns {boolean} Результат перевірки
 */
export function hasTrackingParams(url) {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.has('utm_source') ||
           urlObj.searchParams.has('utm_medium') ||
           urlObj.searchParams.has('utm_campaign') ||
           urlObj.searchParams.has('partner_id') ||
           urlObj.searchParams.has('tracking_id');
  } catch (error) {
    return false;
  }
}

/**
 * Видалення трекінгових параметрів з URL
 * @param {string} url - URL з трекінговими параметрами
 * @returns {string} Чистий URL
 */
export function removeTrackingParams(url) {
  if (!url) return '';

  try {
    const urlObj = new URL(url);

    // Список трекінгових параметрів
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'partner_id', 'tracking_id'
    ];

    // Видаляємо кожен параметр
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch (error) {
    console.error('Помилка видалення трекінгових параметрів:', error);
    return url;
  }
}