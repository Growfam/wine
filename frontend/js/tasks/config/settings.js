/**
 * Конфігурація системи
 *
 * Містить загальні налаштування для всіх модулів
 */

// Загальні налаштування
const CONFIG = {
  // Час кешування, мс
  CACHE_TTL: 60000,

  // Затримки між перевірками (мс)
  THROTTLE_DELAY: 3000,

  // Максимальна кількість спроб верифікації
  MAX_VERIFICATION_ATTEMPTS: 3,

  // Інтервал перезапитів (мс)
  RETRY_INTERVAL: 2000,

  // Таймаут запитів (мс)
  REQUEST_TIMEOUT: 15000,

  // Інтервал оновлення прогресу (мс)
  PROGRESS_UPDATE_INTERVAL: 2000,

  // Інтервал дедуплікації винагород (мс)
  REWARD_DEDUPLICATION_WINDOW: 5000,

  // Затримка анімації появи завдань (мс)
  TASK_APPEAR_DURATION: 350,

  // Затримка між появою завдань (мс)
  TASK_APPEAR_DELAY: 50
};

export default CONFIG;