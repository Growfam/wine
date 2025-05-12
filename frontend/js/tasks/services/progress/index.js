/**
 * Сервіс управління прогресом
 *
 * Експортує функціональність для відстеження та оновлення прогресу завдань
 */

import TaskProgress from './task-progress.js';
import { setupUIUpdater } from './ui-updater.js';
import { setupSyncService } from './sync-service.js';

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
