/**
 * Task Data API - модуль для отримання даних про завдання
 *
 * Відповідає за:
 * - Завантаження списку завдань
 * - Отримання даних конкретного завдання
 * - Отримання прогресу виконання завдань
 *
 * @version 3.0.0
 */

import apiCore, { CONFIG } from './core.js';

/**
 * API для роботи з даними завдань
 */
class TaskDataApi {
    constructor() {
        this.apiCore = apiCore;
        this.taskCachePrefix = 'task_data_';
        this.progressCachePrefix = 'task_progress_';
    }

    /**
     * Завантаження всіх завдань з сервера
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Дані завдань
     */
    async loadAllTasks(options = {}) {
        try {
            // Якщо задано параметр обходу кешу
            if (!options.forceRefresh) {
                // Спробуємо знайти в кеші
                const cachedTasks = this.apiCore.getCachedData('all_tasks_data');
                if (cachedTasks) {
                    return cachedTasks;
                }
            }

            const userId = this.apiCore.getUserId();
            if (!userId) {
                return {
                    status: 'error',
                    message: 'ID користувача відсутній'
                };
            }

            // Завантажуємо різні типи завдань паралельно
            const socialTasksPromise = this.apiCore.get(CONFIG.API_PATHS.TASKS.SOCIAL);
            const limitedTasksPromise = this.apiCore.get(CONFIG.API_PATHS.TASKS.LIMITED);
            const partnerTasksPromise = this.apiCore.get(CONFIG.API_PATHS.TASKS.PARTNER);
            const userProgressPromise = this.apiCore.get(CONFIG.API_PATHS.USER_PROGRESS(userId));

            // Чекаємо на виконання всіх запитів
            const [socialTasksResponse, limitedTasksResponse, partnerTasksResponse, userProgressResponse] =
                await Promise.all([socialTasksPromise, limitedTasksPromise, partnerTasksPromise, userProgressPromise]);

            // Формуємо загальний результат
            const result = {
                social: socialTasksResponse.data || [],
                limited: limitedTasksResponse.data || [],
                partner: partnerTasksResponse.data || [],
                userProgress: userProgressResponse.data || {}
            };

            // Кешуємо результат
            this.apiCore.cacheData('all_tasks_data', result);

            return result;
        } catch (error) {
            console.error('Помилка завантаження завдань:', error);

            return {
                status: 'error',
                message: 'Не вдалося завантажити завдання',
                error: error.message
            };
        }
    }

    /**
     * Завантаження завдань певного типу
     * @param {string} type - Тип завдань ('social', 'limited', 'partner')
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Дані завдань
     */
    async loadTasksByType(type, options = {}) {
        try {
            const cacheKey = `tasks_${type}`;

            // Перевіряємо кеш, якщо не вимагається обійти його
            if (!options.forceRefresh) {
                const cachedTasks = this.apiCore.getCachedData(cacheKey);
                if (cachedTasks) {
                    return cachedTasks;
                }
            }

            // Визначаємо ендпоінт на основі типу
            let endpoint;
            switch (type) {
                case 'social':
                    endpoint = CONFIG.API_PATHS.TASKS.SOCIAL;
                    break;
                case 'limited':
                    endpoint = CONFIG.API_PATHS.TASKS.LIMITED;
                    break;
                case 'partner':
                    endpoint = CONFIG.API_PATHS.TASKS.PARTNER;
                    break;
                case 'referral':
                    endpoint = CONFIG.API_PATHS.TASKS.REFERRAL;
                    break;
                default:
                    endpoint = CONFIG.API_PATHS.TASKS.BY_TYPE(type);
            }

            // Виконуємо запит
            const response = await this.apiCore.get(endpoint);

            // Кешуємо результат
            if (response.status === 'success') {
                this.apiCore.cacheData(cacheKey, response);
            }

            return response;
        } catch (error) {
            console.error(`Помилка завантаження завдань типу ${type}:`, error);
            return {
                status: 'error',
                message: `Не вдалося завантажити завдання типу ${type}`,
                error: error.message
            };
        }
    }

    /**
     * Отримання даних одного завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Дані завдання
     */
    async getTaskData(taskId, options = {}) {
        try {
            if (!taskId) {
                throw new Error('Не вказано ID завдання');
            }

            // Перевіряємо у кеші
            const cacheKey = `${this.taskCachePrefix}${taskId}`;

            if (!options.forceRefresh) {
                const cachedTask = this.apiCore.getCachedData(cacheKey);
                if (cachedTask) {
                    return cachedTask;
                }
            }

            // Завантажуємо з сервера
            const response = await this.apiCore.get(CONFIG.API_PATHS.TASKS.DETAILS(taskId));

            if (response.status === 'success' && response.data) {
                // Кешуємо результат
                this.apiCore.cacheData(cacheKey, response.data);
                return response.data;
            }

            return null;
        } catch (error) {
            console.error(`Помилка отримання даних завдання ${taskId}:`, error);
            return null;
        }
    }

    /**
     * Отримання прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Прогрес завдання
     */
    async getTaskProgress(taskId, options = {}) {
        try {
            if (!taskId) {
                throw new Error('Не вказано ID завдання');
            }

            // Перевіряємо у кеші
            const cacheKey = `${this.progressCachePrefix}${taskId}`;

            if (!options.forceRefresh) {
                const cachedProgress = this.apiCore.getCachedData(cacheKey);
                if (cachedProgress) {
                    return cachedProgress;
                }
            }

            const userId = this.apiCore.getUserId();
            if (!userId) {
                return {
                    status: 'error',
                    message: 'ID користувача відсутній'
                };
            }

            // Завантажуємо з сервера
            const response = await this.apiCore.get(CONFIG.API_PATHS.TASKS.PROGRESS(taskId));

            if (response.status === 'success' && response.data) {
                // Кешуємо результат
                this.apiCore.cacheData(cacheKey, response.data);
                return response.data;
            }

            return null;
        } catch (error) {
            console.error(`Помилка отримання прогресу завдання ${taskId}:`, error);
            return null;
        }
    }

    /**
     * Отримання статусу завдання користувача
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Статус завдання
     */
    async getTaskStatus(taskId, options = {}) {
        try {
            if (!taskId) {
                throw new Error('Не вказано ID завдання');
            }

            const userId = this.apiCore.getUserId();
            if (!userId) {
                return {
                    status: 'error',
                    message: 'ID користувача відсутній'
                };
            }

            // Перевіряємо у кеші, якщо не вказано forceRefresh
            const cacheKey = `task_status_${taskId}_${userId}`;

            if (!options.forceRefresh) {
                const cachedStatus = this.apiCore.getCachedData(cacheKey);
                if (cachedStatus) {
                    return cachedStatus;
                }
            }

            // Завантажуємо з сервера
            const response = await this.apiCore.get(CONFIG.API_PATHS.USER_TASK_STATUS(userId, taskId));

            if (response.status === 'success') {
                // Кешуємо результат
                this.apiCore.cacheData(cacheKey, response);
                return response;
            }

            return {
                status: 'error',
                message: 'Не вдалося отримати статус завдання'
            };
        } catch (error) {
            console.error(`Помилка отримання статусу завдання ${taskId}:`, error);
            return {
                status: 'error',
                message: 'Помилка отримання статусу завдання',
                error: error.message
            };
        }
    }

    /**
     * Отримання прогресу всіх завдань користувача
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Прогрес всіх завдань
     */
    async getUserTasksProgress(options = {}) {
        try {
            const userId = this.apiCore.getUserId();
            if (!userId) {
                return {
                    status: 'error',
                    message: 'ID користувача відсутній'
                };
            }

            // Перевіряємо у кеші
            const cacheKey = `user_tasks_progress_${userId}`;

            if (!options.forceRefresh) {
                const cachedProgress = this.apiCore.getCachedData(cacheKey);
                if (cachedProgress) {
                    return cachedProgress;
                }
            }

            // Завантажуємо з сервера
            const response = await this.apiCore.get(CONFIG.API_PATHS.USER_PROGRESS(userId));

            if (response.status === 'success') {
                // Кешуємо результат
                this.apiCore.cacheData(cacheKey, response);
                return response;
            }

            return {
                status: 'error',
                message: 'Не вдалося отримати прогрес завдань користувача'
            };
        } catch (error) {
            console.error('Помилка отримання прогресу завдань користувача:', error);
            return {
                status: 'error',
                message: 'Помилка отримання прогресу завдань',
                error: error.message
            };
        }
    }

    /**
     * Очищення кешу даних завдань
     * @param {string} [taskId] - Опціонально, ID конкретного завдання для очищення кешу
     */
    clearTaskCache(taskId) {
        if (taskId) {
            // Очищаємо кеш конкретного завдання
            this.apiCore.clearCache(`${this.taskCachePrefix}${taskId}`);
            this.apiCore.clearCache(`${this.progressCachePrefix}${taskId}`);
            this.apiCore.clearCache(`task_status_${taskId}`);
        } else {
            // Очищаємо весь кеш завдань
            this.apiCore.clearCache(this.taskCachePrefix);
            this.apiCore.clearCache(this.progressCachePrefix);
            this.apiCore.clearCache('task_status_');
            this.apiCore.clearCache('all_tasks_data');
            this.apiCore.clearCache('tasks_social');
            this.apiCore.clearCache('tasks_limited');
            this.apiCore.clearCache('tasks_partner');
        }
    }
}

// Експортуємо екземпляр класу
export default new TaskDataApi();