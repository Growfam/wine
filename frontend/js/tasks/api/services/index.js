/**
 * Модуль сервісів API завдань
 *
 * Експортує сервіси для роботи з API:
 * - Сервіс завдань
 * - Сервіс дій
 * - Сервіс прогресу
 *
 * @version 3.1.0
 */

import taskService from './task-service.js';
import actionService from './action-service.js';
import progressService from './progress-service.js';

export {
    taskService,
    actionService,
    progressService
};

export default {
    tasks: taskService,
    actions: actionService,
    progress: progressService
};