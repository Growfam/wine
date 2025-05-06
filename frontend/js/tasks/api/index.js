/**
 * Task API - головний модуль для інтеграції з API завдань
 *
 * Об'єднує функціональність базового API, API даних та API дій
 * для забезпечення єдиного інтерфейсу взаємодії з системою завдань
 */

import apiCore from './core.js';
import taskDataApi from './task-data.js';
import taskActionApi from './task-actions.js';
import { CONFIG } from './core.js';

// Імпортуємо шляхи API з конфігурації (для прикладу)
import { API_PATHS } from '../config/task-types.js';

// Ініціалізуємо шляхи API
CONFIG.API_PATHS = API_PATHS;

/**
 * Основний клас API для завдань
 */
class TaskApi {
  constructor() {
    // Базові компоненти API
    this.core = apiCore;
    this.data = taskDataApi;
    this.actions = taskActionApi;

    // Методи для зворотної сумісності
    this.baseUrl = this.core.baseUrl;
    this.fetchWithRetry = this.core.fetchWithRetry.bind(this.core);
    this.getUserId = this.core.getUserId.bind(this.core);

    // Методи роботи з даними
    this.loadAllTasks = this.data.loadAllTasks.bind(this.data);
    this.getTaskData = this.data.getTaskData.bind(this.data);
    this.getTaskProgress = this.data.getTaskProgress.bind(this.data);

    // Методи для дій
    this.startTask = this.actions.startTask.bind(this.actions);
    this.verifyTask = this.actions.verifyTask.bind(this.actions);
  }
}

// Створюємо і експортуємо єдиний екземпляр API
const taskApi = new TaskApi();
export default taskApi;

// Експортуємо також окремі компоненти для модульного використання
export {
  apiCore,
  taskDataApi,
  taskActionApi,
  CONFIG
};