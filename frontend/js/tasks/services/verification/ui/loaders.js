/**
 * Управління індикаторами завантаження для верифікації
 *
 * Функції для показу/приховування індикаторів верифікації
 */

/**
 * Налаштування UI обробників для сервісу верифікації
 * @param {Object} verificationCore - Ядро сервісу верифікації
 */
export function setupUIHandlers(verificationCore) {
  // Додаємо методи для роботи з UI
  verificationCore.showVerificationLoader = showVerificationLoader;
  verificationCore.hideVerificationLoader = hideVerificationLoader;
}

/**
 * Показати індикатор завантаження верифікації
 * @param {string} taskId - ID завдання
 */
export function showVerificationLoader(taskId) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const actionElement = taskElement.querySelector('.task-action');
    if (actionElement) {
      // Додаємо клас стану завантаження
      actionElement.classList.add('loading');

      // Зберігаємо оригінальний вміст
      const originalContent = actionElement.innerHTML;
      actionElement.setAttribute('data-original-content', originalContent);

      // Замінюємо на лоадер
      actionElement.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span data-lang-key="earn.verifying">Перевірка...</span>
        </div>
      `;
    }
  } catch (error) {
    console.warn(`Помилка відображення індикатора завантаження для завдання ${taskId}:`, error);
  }
}

/**
 * Приховати індикатор завантаження верифікації
 * @param {string} taskId - ID завдання
 */
export function hideVerificationLoader(taskId) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const actionElement = taskElement.querySelector('.task-action');
    if (actionElement) {
      // Видаляємо клас стану завантаження
      actionElement.classList.remove('loading');

      // Відновлюємо оригінальний вміст
      const originalContent = actionElement.getAttribute('data-original-content');
      if (originalContent) {
        actionElement.innerHTML = originalContent;
        actionElement.removeAttribute('data-original-content');
      }
    }
  } catch (error) {
    console.warn(`Помилка приховування індикатора завантаження для завдання ${taskId}:`, error);
  }
}

/**
 * Показати повідомлення про результат верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат верифікації
 * @param {boolean} [autoHide=true] - Чи автоматично приховувати повідомлення
 */
export function showVerificationMessage(taskId, result, autoHide = true) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Знаходимо або створюємо елемент повідомлення
    let messageElement = taskElement.querySelector('.verification-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.className = 'verification-message';
      taskElement.appendChild(messageElement);
    }

    // Встановлюємо клас відповідно до результату
    messageElement.className = 'verification-message';
    if (result.success) {
      messageElement.classList.add('success');
    } else {
      messageElement.classList.add('error');
    }

    // Встановлюємо текст повідомлення
    messageElement.textContent = result.message;

    // Показуємо повідомлення
    messageElement.style.display = 'block';

    // Автоматичне приховування повідомлення
    if (autoHide) {
      setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
          messageElement.style.display = 'none';
        }
      }, 5000);
    }
  } catch (error) {
    console.warn(`Помилка відображення повідомлення верифікації для завдання ${taskId}:`, error);
  }
}