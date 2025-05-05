/**
 * API сервіс для взаємодії з сервером
 *
 * Відповідає за:
 * - Завантаження завдань
 * - Запуск завдань
 * - Верифікацію завдань
 * - Отримання прогресу
 */

import { API_PATHS, CONFIG } from '../config/task-types.js';
import TaskStore from './task-store.js';

class TaskAPI {
  constructor() {
    this.baseUrl = '';
    this.requestTimeout = CONFIG.REQUEST_TIMEOUT;
    this.maxRetries = 2;

    // Ініціалізація базового URL API
    this.initBaseUrl();
  }

  /**
   * Ініціалізація базового URL API
   */
  initBaseUrl() {
    // Визначаємо базовий URL з наявних джерел
    if (window.API_BASE_URL) {
      this.baseUrl = window.API_BASE_URL;
    } else if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
      this.baseUrl = window.WinixAPI.config.baseUrl;
    } else {
      this.baseUrl = ''; // Порожній базовий URL, якщо не знайдено
    }
  }

  /**
   * Безпечне отримання ID користувача
   * @returns {string|null} ID користувача
   */
  getUserId() {
    // Використовуємо глобальну функцію, якщо вона є
    if (typeof window.getUserId === 'function') {
      return window.getUserId();
    }

    // Перевіряємо Telegram WebApp
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
    }

    // Перевіряємо локальне сховище
    try {
      const storedId = localStorage.getItem('telegram_user_id');
      if (storedId && storedId !== 'undefined' && storedId !== 'null') {
        return storedId;
      }
    } catch (e) {
      // Ігноруємо помилки localStorage
    }

    // Перевіряємо DOM
    const userIdElement = document.getElementById('user-id');
    if (userIdElement?.textContent) {
      return userIdElement.textContent.trim();
    }

    // Перевіряємо URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
      if (urlId) {
        return urlId;
      }
    } catch (e) {
      // Ігноруємо помилки URL
    }

    return null;
  }

  /**
   * Виконання запиту з повторними спробами
   * @param {string} url - URL запиту
   * @param {Object} options - Опції запиту
   * @returns {Promise<Object>} Результат запиту
   */
  async fetchWithRetry(url, options = {}) {
    let lastError = null;
    let attempts = 0;

    // Додаємо базову адресу API, якщо вона не вказана в URL
    if (this.baseUrl && !url.startsWith('http')) {
      url = `${this.baseUrl}/${url.startsWith('/') ? url.substring(1) : url}`;
    }

    // Логіка повторних спроб
    while (attempts <= this.maxRetries) {
      try {
        attempts++;

        // Створюємо контролер для таймауту
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        // Додаємо сигнал до опцій
        const fetchOptions = {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        };

        // Виконуємо запит
        const response = await fetch(url, fetchOptions);

        // Очищаємо таймаут
        clearTimeout(timeoutId);

        // Перевіряємо статус відповіді
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Парсимо JSON
        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;

        // Перевіряємо тип помилки
        const isNetworkError = error.name === 'TypeError' ||
                              error.name === 'AbortError' ||
                              (error.message && error.message.includes('fetch'));

        const isCorsError = error.message && error.message.includes('CORS');

        // Для мережевих помилок і CORS помилок пробуємо повторно
        if ((isNetworkError || isCorsError) && attempts <= this.maxRetries) {
          // Очікуємо перед повторною спробою
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
          continue;
        }

        // Інші помилки - просто виходимо з циклу
        break;
      }
    }

    // Якщо всі спроби невдалі, повертаємо помилку
    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Завантаження усіх типів завдань
   * @returns {Promise<Object>} Результат запиту
   */
  async loadAllTasks() {
    try {
      // Отримуємо ID користувача
      const userId = this.getUserId();
      if (!userId) {
        throw new Error('ID користувача не знайдено');
      }

      // Виконуємо паралельні запити для всіх типів завдань
      const [socialResponse, limitedResponse, partnerResponse] = await Promise.all([
        this.loadTasks(API_PATHS.TASKS.SOCIAL),
        this.loadTasks(API_PATHS.TASKS.LIMITED),
        this.loadTasks(API_PATHS.TASKS.PARTNER)
      ]);

      // Завантажуємо прогрес користувача
      let userProgress = {};
      try {
        const progressResponse = await this.fetchWithRetry(API_PATHS.USER_PROGRESS);
        if (progressResponse.status === 'success' && progressResponse.data) {
          userProgress = progressResponse.data;
        }
      } catch (progressError) {
        console.warn('Помилка отримання прогресу користувача:', progressError);
      }

      // Повертаємо об'єднані дані
      return {
        social: this.extractTasksFromResponse(socialResponse),
        limited: this.extractTasksFromResponse(limitedResponse),
        partner: this.extractTasksFromResponse(partnerResponse),
        userProgress
      };
    } catch (error) {
      console.error('Помилка завантаження завдань:', error);
      throw error;
    }
  }

  /**
   * Завантаження завдань за типом
   * @param {string} path - Шлях API
   * @returns {Promise<Object>} Результат запиту
   */
  async loadTasks(path) {
    try {
      // Перевіряємо наявність API
      if (!window.API) {
        throw new Error('API недоступне');
      }

      // Виконуємо запит через глобальний API
      const response = await window.API.get(path);
      return response;
    } catch (error) {
      console.error(`Помилка завантаження завдань з ${path}:`, error);

      // Спробуємо альтернативний запит
      try {
        return await this.fetchWithRetry(path);
      } catch (fetchError) {
        console.error(`Помилка альтернативного запиту до ${path}:`, fetchError);
        throw fetchError;
      }
    }
  }

  /**
   * Запуск завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат запиту
   */
  async startTask(taskId) {
    try {
      // Отримуємо ID користувача
      const userId = this.getUserId();
      if (!userId) {
        throw new Error('ID користувача не знайдено');
      }

      // Формуємо URL
      const url = API_PATHS.START_TASK.replace('{taskId}', taskId);

      // Виконуємо запит через глобальний API, якщо доступний
      if (window.API && typeof window.API.post === 'function') {
        const response = await window.API.post(url);
        return response;
      }

      // Альтернативно використовуємо fetch
      return await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({})
      });
    } catch (error) {
      console.error(`Помилка запуску завдання ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Верифікація завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат запиту
   */
  async verifyTask(taskId, verificationData = {}) {
    try {
      // Отримуємо ID користувача
      const userId = this.getUserId();
      if (!userId) {
        throw new Error('ID користувача не знайдено');
      }

      // Формуємо URL
      const url = API_PATHS.VERIFICATION.replace('{taskId}', taskId);

      // Формуємо тіло запиту
      const payload = {
        verification_data: {
          ...verificationData,
          timestamp: Date.now(),
          user_agent: navigator.userAgent,
          platform: navigator.platform
        }
      };

      // Виконуємо запит через глобальний API, якщо доступний
      if (window.API && typeof window.API.post === 'function') {
        const response = await window.API.post(url, payload);
        return response;
      }

      // Альтернативно використовуємо fetch
      return await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(`Помилка верифікації завдання ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат запиту
   */
  async getTaskProgress(taskId) {
    try {
      // Отримуємо ID користувача
      const userId = this.getUserId();
      if (!userId) {
        throw new Error('ID користувача не знайдено');
      }

      // Формуємо URL
      const url = `quests/tasks/${taskId}/progress`;

      // Виконуємо запит через глобальний API, якщо доступний
      if (window.API && typeof window.API.get === 'function') {
        const response = await window.API.get(url);
        return response;
      }

      // Альтернативно використовуємо fetch
      return await this.fetchWithRetry(url);
    } catch (error) {
      console.error(`Помилка отримання прогресу завдання ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Тестування з'єднання з API
   * @returns {Promise<Object>} Результат тесту
   */
  async testConnection() {
    try {
      // Спробуємо зробити простий запит
      const response = await this.fetchWithRetry('quests/health-check', {
        method: 'GET'
      });

      return {
        success: true,
        message: 'З\'єднання з API успішне',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: `Помилка з'єднання: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Витягнення завдань з відповіді API
   * @param {Object} response - Відповідь API
   * @returns {Array} Масив завдань
   */
  extractTasksFromResponse(response) {
    let tasksData = [];

    if (response.status === 'success' && response.data && response.data.tasks) {
      tasksData = response.data.tasks;
    } else if (response.status === 'success' && response.data && Array.isArray(response.data)) {
      tasksData = response.data;
    } else if (response.success && response.data) {
      tasksData = Array.isArray(response.data) ? response.data :
        (response.data.tasks || []);
    } else if (Array.isArray(response)) {
      tasksData = response;
    } else if (response.tasks && Array.isArray(response.tasks)) {
      tasksData = response.tasks;
    }

    return tasksData;
  }
}

// Створюємо і експортуємо єдиний екземпляр API
const taskApi = new TaskAPI();
export default taskApi;