/**
 * Task Actions API - модуль для виконання дій із завданнями
 *
 * Відповідає за:
 * - Початок виконання завдання
 * - Верифікацію виконання завдання
 * - Обробку результатів верифікації
 * - Керування прогресом завдань
 *
 * @version 3.0.0
 */

import apiCore, { CONFIG } from './core.js';

/**
 * API для виконання дій з завданнями
 */
class TaskActionApi {
    constructor() {
        this.apiCore = apiCore;
    }

    /**
     * Початок виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат операції
     */
    async startTask(taskId, options = {}) {
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

            // Формуємо URL для запиту
            const endpoint = CONFIG.API_PATHS.TASKS.START(taskId);

            // Підготовка даних для запиту
            const data = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                ...options.additionalData
            };

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, data);

            // Очищаємо кеш прогресу для цього завдання
            this.apiCore.clearCache(`task_progress_${taskId}`);
            this.apiCore.clearCache(`task_status_${taskId}`);

            // Генеруємо подію для відстеження
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('task-started', {
                    detail: {
                        taskId,
                        userId,
                        timestamp: Date.now(),
                        response
                    }
                }));
            }

            return response;
        } catch (error) {
            console.error(`Помилка запуску завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося запустити завдання',
                error: error.message
            };
        }
    }

    /**
     * Верифікація виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} verificationData - Дані для верифікації
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат верифікації
     */
    async verifyTask(taskId, verificationData = {}, options = {}) {
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

            // Додаємо службові дані
            const fullVerificationData = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                ...verificationData
            };

            // Формуємо URL для запиту
            const endpoint = CONFIG.API_PATHS.TASKS.VERIFICATION(taskId);

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, fullVerificationData, options);

            // Очищаємо кеш для цього завдання
            this.apiCore.clearCache(`task_progress_${taskId}`);
            this.apiCore.clearCache(`task_status_${taskId}`);
            this.apiCore.clearCache(`task_data_${taskId}`);
            this.apiCore.clearCache('all_tasks_data');

            // Генеруємо подію для відстеження
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('task-verified', {
                    detail: {
                        taskId,
                        userId,
                        timestamp: Date.now(),
                        response,
                        success: response.status === 'success'
                    }
                }));
            }

            return response;
        } catch (error) {
            console.error(`Помилка верифікації завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося верифікувати завдання',
                error: error.message
            };
        }
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат оновлення
     */
    async updateTaskProgress(taskId, progressData = {}, options = {}) {
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

            // Додаємо службові дані
            const fullProgressData = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                ...progressData
            };

            // Формуємо URL для запиту
            const endpoint = CONFIG.API_PATHS.TASKS.PROGRESS(taskId);

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, fullProgressData, options);

            // Очищаємо кеш для цього завдання
            this.apiCore.clearCache(`task_progress_${taskId}`);

            return response;
        } catch (error) {
            console.error(`Помилка оновлення прогресу завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося оновити прогрес завдання',
                error: error.message
            };
        }
    }

    /**
     * Скасування виконання завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат скасування
     */
    async cancelTask(taskId, options = {}) {
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

            // Формуємо URL для запиту
            const endpoint = `quests/tasks/${taskId}/cancel`;

            // Підготовка даних для запиту
            const data = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                reason: options.reason || 'user_cancelled',
                ...options.additionalData
            };

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, data, options);

            // Очищаємо кеш для цього завдання
            this.apiCore.clearCache(`task_progress_${taskId}`);
            this.apiCore.clearCache(`task_status_${taskId}`);
            this.apiCore.clearCache(`task_data_${taskId}`);

            return response;
        } catch (error) {
            console.error(`Помилка скасування завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося скасувати завдання',
                error: error.message
            };
        }
    }

    /**
     * Надсилання відгуку про завдання
     * @param {string} taskId - ID завдання
     * @param {Object} feedbackData - Дані відгуку
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат надсилання
     */
    async sendTaskFeedback(taskId, feedbackData = {}, options = {}) {
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

            // Додаємо службові дані
            const fullFeedbackData = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                ...feedbackData
            };

            // Формуємо URL для запиту
            const endpoint = `quests/tasks/${taskId}/feedback`;

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, fullFeedbackData, options);

            return response;
        } catch (error) {
            console.error(`Помилка надсилання відгуку про завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося надіслати відгук про завдання',
                error: error.message
            };
        }
    }

    /**
     * Отримання нагороди за завдання
     * @param {string} taskId - ID завдання
     * @param {Object} options - Додаткові опції
     * @returns {Promise<Object>} Результат отримання нагороди
     */
    async claimTaskReward(taskId, options = {}) {
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

            // Формуємо URL для запиту
            const endpoint = `quests/tasks/${taskId}/claim-reward`;

            // Підготовка даних для запиту
            const data = {
                user_id: userId,
                task_id: taskId,
                timestamp: Date.now(),
                ...options.additionalData
            };

            // Виконуємо запит
            const response = await this.apiCore.post(endpoint, data, options);

            // Генеруємо подію для відстеження
            if (typeof document !== 'undefined' && response.status === 'success') {
                document.dispatchEvent(new CustomEvent('task-reward-claimed', {
                    detail: {
                        taskId,
                        userId,
                        timestamp: Date.now(),
                        reward: response.data?.reward
                    }
                }));

                // Також генеруємо загальну подію оновлення балансу
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        source: 'task-reward',
                        taskId,
                        amount: response.data?.reward?.amount,
                        timestamp: Date.now()
                    }
                }));
            }

            return response;
        } catch (error) {
            console.error(`Помилка отримання нагороди за завдання ${taskId}:`, error);

            return {
                status: 'error',
                message: 'Не вдалося отримати нагороду за завдання',
                error: error.message
            };
        }
    }
}

// Експортуємо екземпляр класу
export default new TaskActionApi();