/**
 * Task API - головний модуль для інтеграції з API завдань
 *
 * Об'єднує функціональність основних компонентів API завдань
 * для забезпечення єдиного інтерфейсу взаємодії з системою завдань
 *
 * @version 3.0.0
 */

// Імпортуємо базові модулі
import apiCore, { CONFIG } from './core.js';
import taskDataApi from './task-data.js';
import taskActionApi from './task-actions.js';

/**
 * Основний клас API для завдань
 */
class TaskApi {
    constructor() {
        // Базові компоненти API
        this.core = apiCore;
        this.data = taskDataApi;
        this.actions = taskActionApi;

        // Експортуємо основні конфігурації
        this.config = CONFIG;
        this.baseUrl = this.core.baseUrl;
    }

    /**
     * Ініціалізація API завдань
     * @param {Object} options - Параметри ініціалізації
     */
    init(options = {}) {
        // Логуємо ініціалізацію
        console.log("🔄 Task API: Ініціалізація модуля завдань");

        // Можемо оновити конфігурацію, якщо потрібно
        if (options.apiPaths) {
            Object.assign(CONFIG.API_PATHS, options.apiPaths);
        }

        // Генеруємо подію ініціалізації
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('task-api-initialized', {
                detail: {
                    timestamp: Date.now(),
                    version: '3.0.0'
                }
            }));
        }

        return this;
    }

    /**
     * Завантаження всіх завдань
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Дані завдань
     */
    async getAllTasks(options = {}) {
        return this.data.loadAllTasks(options);
    }

    /**
     * Завантаження завдань певного типу
     * @param {string} type - Тип завдань
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Дані завдань
     */
    async getTasksByType(type, options = {}) {
        return this.data.loadTasksByType(type, options);
    }

    /**
     * Отримання даних конкретного завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Дані завдання
     */
    async getTaskDetails(taskId, options = {}) {
        return this.data.getTaskData(taskId, options);
    }

    /**
     * Отримання прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Прогрес завдання
     */
    async getTaskProgress(taskId, options = {}) {
        return this.data.getTaskProgress(taskId, options);
    }

    /**
     * Отримання статусу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Статус завдання
     */
    async getTaskStatus(taskId, options = {}) {
        return this.data.getTaskStatus(taskId, options);
    }

    /**
     * Початок виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Результат операції
     */
    async startTask(taskId, options = {}) {
        return this.actions.startTask(taskId, options);
    }

    /**
     * Верифікація виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} verificationData - Дані для верифікації
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Результат верифікації
     */
    async verifyTask(taskId, verificationData = {}, options = {}) {
        return this.actions.verifyTask(taskId, verificationData, options);
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Результат оновлення
     */
    async updateTaskProgress(taskId, progressData = {}, options = {}) {
        return this.actions.updateTaskProgress(taskId, progressData, options);
    }

    /**
     * Скасування виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Результат скасування
     */
    async cancelTask(taskId, options = {}) {
        return this.actions.cancelTask(taskId, options);
    }

    /**
     * Отримання нагороди за завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Параметри запиту
     * @returns {Promise<Object>} Результат отримання нагороди
     */
    async claimTaskReward(taskId, options = {}) {
        return this.actions.claimTaskReward(taskId, options);
    }

    /**
     * Очищення кешу даних завдань
     * @param {string} taskId - ID завдання для очищення (опціонально)
     */
    clearCache(taskId) {
        if (taskId) {
            this.data.clearTaskCache(taskId);
        } else {
            this.data.clearTaskCache();
            this.core.clearCache();
        }
    }

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача
     */
    getUserId() {
        return this.core.getUserId();
    }
}

// Створюємо і експортуємо єдиний екземпляр API
const taskApi = new TaskApi();

// Виконуємо автоматичну ініціалізацію
if (typeof window !== 'undefined') {
    // При завантаженні DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => taskApi.init());
    } else {
        // DOM вже завантажено
        setTimeout(() => taskApi.init(), 0);
    }

    // Експортуємо в глобальний об'єкт для прямого доступу
    window.TaskAPI = taskApi;
}

// Експортуємо API для модульного використання
export default taskApi;

// Експортуємо окремі компоненти для розширеного використання
export {
    apiCore,
    taskDataApi,
    taskActionApi,
    CONFIG
};