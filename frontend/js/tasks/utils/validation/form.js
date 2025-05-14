/**
 * Модуль валідації форм
 *
 * Відповідає за:
 * - Валідацію повних форм
 * - Обробку результатів валідації
 * - Відображення помилок у формах
 *
 * @version 1.0.1
 */

import { getLogger } from '../core/logger.js';
import { validate } from './core.js';
import {
  addEvent,
  removeAllEvents,
  debounce,
  findParent,
  scrollToElement,
  onDOMReady
} from '../dom/index.js';

// Створюємо логер для модуля
const logger = getLogger('ValidationForm');

// Колекція активних форм
const activeForms = new Map();

// Колекція обробників подій валідації
const validationHandlers = new Map();

// Стан модуля
const state = {
  isInitialized: false, // Прапорець ініціалізації
  stylesInjected: false, // Прапорець додавання стилів
};

// Конфігурація за замовчуванням
const config = {
  debounceTime: 300, // Час затримки перевірки при введенні (мс)
  liveValidation: true, // Валідація в реальному часі
  validateOnBlur: true, // Валідація при втраті фокусу
  showErrorIcons: true, // Показувати іконки помилок
  scrollToErrors: true, // Прокручувати до помилок
  errorClass: 'error-field', // Клас для поля з помилкою
  validClass: 'valid-field', // Клас для валідного поля
  errorMessageClass: 'error-message', // Клас для повідомлення про помилку
  formGroupClass: 'form-group', // Клас для групи полів
  autoSubmit: false, // Автоматично відправляти форму, якщо валідна
};

/**
 * Ініціалізація модуля валідації форм
 * @param {Object} options - Параметри конфігурації
 */
export function init(options = {}) {
  // Перевіряємо, чи модуль вже ініціалізовано
  if (state.isInitialized) {
    logger.debug('Модуль валідації форм вже ініціалізовано', 'init');
    return;
  }

  // Оновлюємо налаштування
  Object.assign(config, options);

  logger.info('Ініціалізація модуля валідації форм', 'init');

  // Чекаємо, поки DOM повністю завантажиться
  onDOMReady(() => {
    // Додаємо CSS стилі, якщо їх ще немає
    if (!state.stylesInjected) {
      injectStyles();
      state.stylesInjected = true;
    }

    // Знаходимо всі форми з атрибутом data-validate
    try {
      const forms = document.querySelectorAll('form[data-validate]:not([data-validation-initialized])');

      if (forms.length > 0) {
        logger.info(`Знайдено ${forms.length} форм для автоматичної валідації`, 'init');

        // Для кожної форми додаємо обробники подій
        forms.forEach((form) => {
          try {
            setupFormValidation(form);
          } catch (formError) {
            logger.error('Помилка налаштування валідації форми', 'init', {
              formId: form.id || 'unnamed',
              error: formError.message,
            });
          }
        });
      }

      // Налаштовуємо спостереження за змінами в DOM
      setupDOMObserver();

      // Позначаємо модуль як ініціалізований
      state.isInitialized = true;
    } catch (error) {
      logger.error('Помилка ініціалізації валідації форм', 'init', { error });
    }
  });
}

/**
 * Додавання CSS стилів для валідації форм
 */
function injectStyles() {
  try {
    if (document.getElementById('form-validation-styles')) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'form-validation-styles';

    styleElement.textContent = `
      /* Поля з помилкою */
      .${config.errorClass} {
        border-color: #FF5252 !important;
        background-color: rgba(255, 82, 82, 0.05);
        box-shadow: 0 0 0 1px rgba(255, 82, 82, 0.25);
      }
      
      /* Поля, що пройшли валідацію */
      .${config.validClass} {
        border-color: #4CAF50 !important;
        background-color: rgba(76, 175, 80, 0.05);
      }
      
      /* Контейнер для повідомлення про помилку */
      .${config.errorMessageClass} {
        color: #FF5252;
        font-size: 0.8125rem;
        margin-top: 0.3125rem;
        display: block;
        transition: all 0.2s ease;
        overflow: hidden;
        max-height: 0;
        opacity: 0;
      }
      
      .${config.errorMessageClass}.show {
        max-height: 3.125rem;
        opacity: 1;
        margin-bottom: 0.625rem;
      }
      
      /* Іконки валідації */
      .validation-icon {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        width: 1.25rem;
        height: 1.25rem;
        display: none;
      }
      
      .validation-icon.error {
        display: block;
        color: #FF5252;
      }
      
      .validation-icon.valid {
        display: block;
        color: #4CAF50;
      }
      
      /* Групи форм */
      .${config.formGroupClass} {
        position: relative;
        margin-bottom: 1.25rem;
      }
      
      /* Кнопка відправки при валідації */
      .submit-button.disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    `;

    // Додаємо стилі в head документа
    if (document.head) {
      document.head.appendChild(styleElement);
      logger.debug('CSS стилі для валідації форм додано', 'injectStyles');
    } else {
      logger.warn('Не вдалося додати CSS стилі - document.head недоступний', 'injectStyles');
    }
  } catch (error) {
    logger.error('Помилка додавання CSS стилів для валідації форм', 'injectStyles', { error });
  }
}

/**
 * Налаштування валідації форми
 * @param {HTMLFormElement} form - Форма для валідації
 * @param {Object} options - Опції валідації
 * @returns {boolean} Успішність налаштування
 */
export function setupFormValidation(form, options = {}) {
  try {
    // Перевіряємо, чи форма не є null
    if (!form || form.nodeType !== Node.ELEMENT_NODE || form.tagName !== 'FORM') {
      logger.warn('Передано невірний елемент форми', 'setupFormValidation');
      return false;
    }

    // Перевіряємо, чи форма вже валідується
    if (activeForms.has(form)) {
      logger.debug('Форма вже налаштована для валідації', 'setupFormValidation', { formId: form.id });
      return true;
    }

    // Параметри за замовчуванням
    const formOptions = {
      ...config,
      ...options,
    };

    // Зберігаємо форму та її опції
    activeForms.set(form, {
      options: formOptions,
      fields: new Map(),
      submitHandler: null,
    });

    // Додаємо обробник для відправки форми
    const submitHandler = function (event) {
      // Виконуємо валідацію перед відправкою
      const validationResult = validateForm(form);

      // Запобігаємо відправці, якщо форма не валідна
      if (!validationResult.isValid) {
        event.preventDefault();
        event.stopPropagation();

        // Показуємо загальне повідомлення про помилку, якщо воно є
        showFormErrorMessage(form);

        // Прокручуємо до першого поля з помилкою
        if (formOptions.scrollToErrors) {
          scrollToFirstError(form);
        }

        // Диспетчеризуємо подію невдалої валідації
        try {
          form.dispatchEvent(
            new CustomEvent('validation:failed', {
              bubbles: true,
              detail: validationResult,
            })
          );
        } catch (eventError) {
          logger.warn('Помилка створення події validation:failed', 'setupFormValidation', {
            formId: form.id,
            error: eventError.message
          });
        }
      } else {
        // Диспетчеризуємо подію успішної валідації
        try {
          form.dispatchEvent(
            new CustomEvent('validation:success', {
              bubbles: true,
              detail: validationResult,
            })
          );
        } catch (eventError) {
          logger.warn('Помилка створення події validation:success', 'setupFormValidation', {
            formId: form.id,
            error: eventError.message
          });
        }

        // Якщо автоматична відправка вимкнена, запобігаємо відправці
        if (!formOptions.autoSubmit) {
          event.preventDefault();
        }
      }
    };

    // Зберігаємо обробник у Map для можливості подальшого видалення
    activeForms.get(form).submitHandler = submitHandler;

    // Додаємо обробник до форми
    addEvent(form, 'submit', submitHandler);

    // Знаходимо всі поля, які потрібно валідувати
    const fields = form.querySelectorAll('[data-validate]');

    // Додаємо обробники подій для полів
    fields.forEach((field) => {
      try {
        setupFieldValidation(field, form, formOptions);
      } catch (fieldError) {
        logger.warn('Помилка налаштування валідації поля', 'setupFormValidation', {
          fieldId: field.id || field.name || 'unnamed',
          error: fieldError.message
        });
      }
    });

    // Додаємо обробники для кнопок відправки
    const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
    submitButtons.forEach((button) => {
      button.classList.add('submit-button');
    });

    // Додаємо атрибут, щоб відмітити форму як ініціалізовану
    form.setAttribute('data-validation-initialized', 'true');

    logger.debug(
      `Налаштовано валідацію для форми: ${form.id || 'anonymous'}`,
      'setupFormValidation'
    );

    return true;
  } catch (error) {
    logger.error('Помилка налаштування валідації форми', 'setupFormValidation', {
      formId: form ? form.id : 'undefined',
      error: error.message,
    });
    return false;
  }
}

/**
 * Налаштування валідації для конкретного поля
 * @param {HTMLElement} field - Поле для валідації
 * @param {HTMLFormElement} form - Батьківська форма
 * @param {Object} options - Опції валідації
 */
function setupFieldValidation(field, form, options = {}) {
  try {
    // Перевіряємо, чи поле не є null
    if (!field) {
      logger.warn('Передано невірний елемент поля', 'setupFieldValidation');
      return;
    }

    // Пропускаємо поля, які вже налаштовані
    if (field.hasAttribute('data-validation-setup')) {
      return;
    }

    // Якщо форма не передана, намагаємося знайти форму-батька
    const parentForm = form || findParent(field, 'form');
    if (!parentForm) {
      logger.warn('Не знайдено батьківську форму для поля', 'setupFieldValidation', {
        fieldId: field.id || field.name || 'unnamed',
      });
      return;
    }

    // Отримуємо дані форми
    const formData = activeForms.get(parentForm);
    if (!formData) {
      logger.warn('Форма не знайдена в активних формах', 'setupFieldValidation', {
        formId: parentForm.id || 'unnamed',
      });
      return;
    }

    // Позначаємо поле як налаштоване
    field.setAttribute('data-validation-setup', 'true');

    // Отримуємо тип валідації
    const validationType = field.getAttribute('data-validate');

    // Опції поля
    const fieldOptions = {
      ...formData.options,
      ...getFieldOptions(field),
    };

    // Зберігаємо дані поля
    formData.fields.set(field, {
      type: validationType,
      options: fieldOptions,
      handlers: [],
    });

    // Створюємо контейнер для повідомлення про помилку, якщо його немає
    let errorContainer = findErrorContainer(field);
    if (!errorContainer) {
      errorContainer = createErrorContainer(field);
    }

    // Додаємо іконку валідації, якщо потрібно
    if (fieldOptions.showErrorIcons) {
      addValidationIcon(field);
    }

    // Формуємо обробники подій для валідації в реальному часі
    if (fieldOptions.liveValidation) {
      // Використовуємо debounce для обробника input
      const debouncedHandler = debounce(() => {
        validateField(field);
      }, fieldOptions.debounceTime);

      // Зберігаємо обробник у Map для можливості видалення
      const fieldData = formData.fields.get(field);
      const removeInputHandler = addEvent(field, 'input', debouncedHandler);
      fieldData.handlers.push({ event: 'input', removeHandler: removeInputHandler });
    }

    // Валідація при втраті фокусу
    if (fieldOptions.validateOnBlur) {
      const blurHandler = () => {
        validateField(field);
      };

      // Зберігаємо обробник у Map для можливості видалення
      const fieldData = formData.fields.get(field);
      const removeBlurHandler = addEvent(field, 'blur', blurHandler);
      fieldData.handlers.push({ event: 'blur', removeHandler: removeBlurHandler });
    }

    // Диспетчеризуємо подію
    try {
      field.dispatchEvent(
        new CustomEvent('validation:setup', {
          bubbles: true,
          detail: { field, type: validationType, options: fieldOptions },
        })
      );
    } catch (eventError) {
      logger.warn('Помилка створення події validation:setup', 'setupFieldValidation', {
        fieldId: field.id || field.name || 'unnamed',
        error: eventError.message
      });
    }

    logger.debug(
      `Налаштовано валідацію для поля: ${field.name || field.id || 'anonymous'}`,
      'setupFieldValidation'
    );
  } catch (error) {
    logger.error('Помилка налаштування валідації поля', 'setupFieldValidation', {
      error: error.message,
      fieldId: field ? (field.id || field.name || 'unnamed') : 'undefined',
    });
  }
}

// ... Інші функції з подібними покращеннями ...

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
  try {
    // Копіюємо активні форми, щоб уникнути проблем з ітерацією при видаленні
    const forms = [...activeForms.keys()];

    // Очищаємо кожну форму
    forms.forEach((form) => {
      try {
        cleanupForm(form);
      } catch (formError) {
        logger.warn('Помилка очищення форми', 'cleanup', {
          formId: form.id || 'unnamed',
          error: formError.message
        });
      }
    });

    // Скидаємо стан модуля
    state.isInitialized = false;

    logger.info('Ресурси модуля валідації форм очищено', 'cleanup');
  } catch (error) {
    logger.error('Помилка очищення ресурсів модуля', 'cleanup', {
      error: error.message,
    });

    // При критичній помилці просто очищаємо колекцію
    activeForms.clear();
  }
}

// Експорт основних функцій
export default {
  init,
  cleanup,
  updateConfig,
  setupFormValidation,
  validateForm,
  validateField,

  // Експортуємо конфігурацію як readonly
  get config() {
    return { ...config };
  },
};