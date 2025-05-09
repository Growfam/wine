/**
 * Сервіс сховища завдань
 *
 * Експортує сервіс для роботи зі сховищем завдань
 */

import { TaskStore } from './task-store.js';
import { setupCacheHandlers } from './cache-handlers.js';
import { setupSubscribers } from './subscribers.js';

// Створюємо єдиний екземпляр сховища
const taskStore = new TaskStore();

// Налаштовуємо кеш
setupCacheHandlers(taskStore);

// Налаштовуємо підписників
setupSubscribers(taskStore);

// Експортуємо для використання в інших модулях
export default taskStore;
