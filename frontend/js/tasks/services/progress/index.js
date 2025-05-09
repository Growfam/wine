/**
 * Сервіс управління прогресом
 *
 * Експортує функціональність для відстеження та оновлення прогресу завдань
 */

import TaskProgress from 'js/tasks/services/progress/task-progress.js';
import { setupUIUpdater } from 'js/tasks/services/progress/ui-updater.js';
import { setupSyncService } from 'js/tasks/services/progress/sync-service.js';

// Створюємо екземпляр сервісу прогресу
const taskProgress = new TaskProgress();

// Налаштовуємо оновлення UI
setupUIUpdater(taskProgress);

// Налаштовуємо синхронізацію з сервером
setupSyncService(taskProgress);

// Ініціалізуємо, якщо документ уже готовий
if (document.readyState !== 'loading') {
  taskProgress.initialize();
} else {
  document.addEventListener('DOMContentLoaded', () => taskProgress.initialize());
}

export default taskProgress;
