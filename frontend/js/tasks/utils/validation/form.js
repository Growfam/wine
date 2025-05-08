/**
 * Модуль валідації форм
 *
 * Відповідає за:
 * - Валідацію повних форм
 * - Обробку результатів валідації
 * - Відображення помилок у формах
 *
 * @version 1.0.0
 */

import { getLogger } from '../core';
import { validate } from './core.js';
import { addEvent, removeAllEvents, debounce, findParent, scrollToElement } from '../dom';

// Створюємо логер для модуля
const logger = getLogger('ValidationForm');

// Колекція активних форм
const activeForms = new Map();

// Колекція обробників подій валідації
const validationHandlers = new Map();

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
  // Оновлюємо налаштування
  Object.assign(config, options);

  logger.info('Ініціалізація модуля валідації форм', 'init');

  // Додаємо CSS стилі, якщо їх ще немає
  if (!document.getElementById('form-validation-styles')) {
    injectStyles();
  }

  // Знаходимо всі форми з атрибутом data-validate
  const forms = document.querySelectorAll('form[data-validate]');

  if (forms.length > 0) {
    logger.info(`Знайдено ${forms.length} форм для автоматичної валідації`, 'init');

    // Для кожної форми додаємо обробники подій
    forms.forEach((form) => {
      setupFormValidation(form);
    });
  }

  // Налаштовуємо спостереження за змінами в DOM
  setupDOMObserver();
}

/**
 * Додавання CSS стилів для валідації форм
 */
function injectStyles() {
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

  document.head.appendChild(styleElement);
  logger.debug('CSS стилі для валідації форм додано', 'injectStyles');
}

/**
 * Налаштування валідації форми
 * @param {HTMLFormElement} form - Форма для валідації
 * @param {Object} options - Опції валідації
 */
export function setupFormValidation(form, options = {}) {
  try {
    // Перевіряємо, чи форма вже валідується
    if (activeForms.has(form)) {
      return;
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
        form.dispatchEvent(
          new CustomEvent('validation:failed', {
            bubbles: true,
            detail: validationResult,
          })
        );
      } else {
        // Диспетчеризуємо подію успішної валідації
        form.dispatchEvent(
          new CustomEvent('validation:success', {
            bubbles: true,
            detail: validationResult,
          })
        );

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
      setupFieldValidation(field, form, formOptions);
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
    // Пропускаємо поля, які вже налаштовані
    if (field.hasAttribute('data-validation-setup')) {
      return;
    }

    // Якщо форма не передана, намагаємося знайти форму-батька
    const parentForm = form || findParent(field, 'form');
    if (!parentForm) {
      logger.warn('Не знайдено батьківську форму для поля', 'setupFieldValidation', {
        fieldId: field.id,
      });
      return;
    }

    // Отримуємо дані форми
    const formData = activeForms.get(parentForm);
    if (!formData) {
      logger.warn('Форма не знайдена в активних формах', 'setupFieldValidation', {
        formId: parentForm.id,
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
    field.dispatchEvent(
      new CustomEvent('validation:setup', {
        bubbles: true,
        detail: { field, type: validationType, options: fieldOptions },
      })
    );

    logger.debug(
      `Налаштовано валідацію для поля: ${field.name || field.id || 'anonymous'}`,
      'setupFieldValidation'
    );
  } catch (error) {
    logger.error('Помилка налаштування валідації поля', 'setupFieldValidation', {
      error: error.message,
      fieldId: field.id,
    });
  }
}

/**
 * Отримання опцій поля з атрибутів
 * @param {HTMLElement} field - Поле форми
 * @returns {Object} Опції валідації
 */
function getFieldOptions(field) {
  const options = {};

  // Обробляємо атрибути data-* для опцій
  for (const attr of field.attributes) {
    if (attr.name.startsWith('data-validation-')) {
      // Перетворюємо data-validation-option-name в optionName
      const optionName = attr.name
        .replace('data-validation-', '')
        .replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());

      // Перетворюємо значення
      let value = attr.value;

      // Конвертуємо булеві та числові значення
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);

      options[optionName] = value;
    } else if (attr.name === 'data-validate-message') {
      options.errorMessage = attr.value;
    } else if (attr.name === 'min') {
      options.min = Number(attr.value);
    } else if (attr.name === 'max') {
      options.max = Number(attr.value);
    } else if (attr.name === 'minlength' || attr.name === 'data-min-length') {
      options.minLength = Number(attr.value);
    } else if (attr.name === 'maxlength' || attr.name === 'data-max-length') {
      options.maxLength = Number(attr.value);
    } else if (attr.name === 'data-match-field') {
      options.matchField = attr.value;
    } else if (attr.name === 'pattern') {
      options.pattern = attr.value;
    }
  }

  return options;
}

/**
 * Пошук контейнера для повідомлення про помилку
 * @param {HTMLElement} field - Поле форми
 * @returns {HTMLElement|null} Контейнер для повідомлення
 */
function findErrorContainer(field) {
  // Шукаємо контейнер одразу після поля
  let errorContainer = field.nextElementSibling;
  if (errorContainer && errorContainer.classList.contains(config.errorMessageClass)) {
    return errorContainer;
  }

  // Шукаємо контейнер у групі форми
  const formGroup = findParent(field, `.${config.formGroupClass}`);
  if (formGroup) {
    errorContainer = formGroup.querySelector(`.${config.errorMessageClass}`);
    if (errorContainer) {
      return errorContainer;
    }
  }

  // Шукаємо контейнер за атрибутом
  const errorSelector = field.getAttribute('data-error-container');
  if (errorSelector) {
    return document.querySelector(errorSelector);
  }

  return null;
}

/**
 * Створення контейнера для повідомлення про помилку
 * @param {HTMLElement} field - Поле форми
 * @returns {HTMLElement} Створений контейнер
 */
function createErrorContainer(field) {
  const errorContainer = document.createElement('div');
  errorContainer.className = config.errorMessageClass;

  // Шукаємо батьківський елемент для контейнера
  let parent = field.parentNode;

  // Якщо батьківський елемент є групою форми, додаємо контейнер до неї
  if (parent.classList.contains(config.formGroupClass)) {
    parent.appendChild(errorContainer);
  } else {
    // Додаємо контейнер після поля
    field.parentNode.insertBefore(errorContainer, field.nextSibling);
  }

  return errorContainer;
}

/**
 * Додавання іконки валідації до поля
 * @param {HTMLElement} field - Поле форми
 */
function addValidationIcon(field) {
  // Перевіряємо, чи іконка вже існує
  let fieldParent = field.parentNode;
  if (fieldParent.querySelector('.validation-icon')) {
    return;
  }

  // Створюємо контейнер для іконки
  const iconContainer = document.createElement('div');
  iconContainer.className = 'validation-icon';

  // Переконуємося, що батьківський елемент має position: relative
  const computedStyle = window.getComputedStyle(fieldParent);
  if (computedStyle.position === 'static') {
    fieldParent.style.position = 'relative';
  }

  // Додаємо іконку до батьківського елемента
  fieldParent.appendChild(iconContainer);
}

/**
 * Валідація всієї форми
 * @param {HTMLFormElement} form - Форма для валідації
 * @returns {Object} Результат валідації {isValid, errors, fields}
 */
export function validateForm(form) {
  try {
    // Перевіряємо, чи форма ініціалізована
    if (!activeForms.has(form)) {
      logger.warn('Форма не ініціалізована для валідації', 'validateForm', { formId: form.id });
      return { isValid: false, errors: ['Форма не ініціалізована для валідації'], fields: {} };
    }

    const formData = activeForms.get(form);
    const result = {
      isValid: true,
      errors: [],
      fields: {},
    };

    // Валідуємо кожне поле
    formData.fields.forEach((fieldData, field) => {
      const fieldResult = validateField(field);

      // Зберігаємо результат у загальному результаті
      const fieldName = field.name || field.id || `field_${Object.keys(result.fields).length}`;
      result.fields[fieldName] = fieldResult;

      // Якщо хоча б одне поле не валідне, вся форма не валідна
      if (!fieldResult.isValid) {
        result.isValid = false;
        result.errors.push(fieldResult.errorMessage);
      }
    });

    // Оновлюємо стан кнопки відправки
    updateSubmitButtonState(form, result.isValid);

    // Диспетчеризуємо подію
    form.dispatchEvent(
      new CustomEvent('validation:complete', {
        bubbles: true,
        detail: result,
      })
    );

    logger.debug(
      `Валідація форми: ${form.id || 'anonymous'}, результат: ${result.isValid ? 'валідна' : 'невалідна'}`,
      'validateForm'
    );

    return result;
  } catch (error) {
    logger.error('Помилка валідації форми', 'validateForm', {
      error: error.message,
      formId: form.id,
    });

    return {
      isValid: false,
      errors: ['Помилка виконання валідації: ' + error.message],
      fields: {},
    };
  }
}

/**
 * Валідація конкретного поля
 * @param {HTMLElement} field - Поле для валідації
 * @returns {Object} Результат валідації {isValid, errorMessage}
 */
export function validateField(field) {
  try {
    // Шукаємо батьківську форму
    const form = findParent(field, 'form');
    if (!form || !activeForms.has(form)) {
      logger.warn('Батьківська форма не знайдена або не ініціалізована', 'validateField', {
        fieldId: field.id,
      });
      return { isValid: false, errorMessage: "Поле не прив'язане до форми" };
    }

    const formData = activeForms.get(form);
    if (!formData.fields.has(field)) {
      logger.warn('Поле не зареєстроване для валідації', 'validateField', { fieldId: field.id });
      return { isValid: false, errorMessage: 'Поле не налаштоване для валідації' };
    }

    const fieldData = formData.fields.get(field);
    const validationType = fieldData.type;
    const options = fieldData.options;

    // Отримуємо значення поля
    let value = getFieldValue(field);

    // Перевіряємо обов'язкове поле
    const isRequired = field.hasAttribute('required') || validationType === 'required';

    // Якщо поле не обов'язкове і порожнє, вважаємо його валідним
    if (!isRequired && (value === '' || value === null || value === undefined)) {
      clearFieldValidation(field);
      return { isValid: true, errorMessage: '' };
    }

    // Готуємо опції для валідації
    const validationOptions = { ...options };

    // Для полів з типом match знаходимо цільове поле
    if (validationType === 'match' && options.matchField) {
      const targetField = form.querySelector(options.matchField);
      if (targetField) {
        validationOptions.targetValue = getFieldValue(targetField);
      }
    }

    // Валідуємо значення
    const result = validate(value, validationType, validationOptions);

    // Оновлюємо відображення поля
    updateFieldValidationUI(field, result.isValid, result.errorMessage);

    // Диспетчеризуємо подію
    field.dispatchEvent(
      new CustomEvent('validation:field', {
        bubbles: true,
        detail: { field, result },
      })
    );

    return result;
  } catch (error) {
    logger.error('Помилка валідації поля', 'validateField', {
      error: error.message,
      fieldId: field.id,
    });

    return {
      isValid: false,
      errorMessage: 'Помилка виконання валідації: ' + error.message,
    };
  }
}

/**
 * Отримання значення поля
 * @param {HTMLElement} field - Поле форми
 * @returns {*} Значення поля
 */
function getFieldValue(field) {
  // Для чекбоксів повертаємо стан checked
  if (field.type === 'checkbox') {
    return field.checked;
  }

  // Для радіо-кнопок знаходимо вибране значення
  if (field.type === 'radio') {
    const form = field.form || findParent(field, 'form');
    if (form) {
      const checkedRadio = form.querySelector(`input[name="${field.name}"]:checked`);
      return checkedRadio ? checkedRadio.value : '';
    }
  }

  // Для select multiple повертаємо масив вибраних значень
  if (field.tagName === 'SELECT' && field.multiple) {
    return Array.from(field.selectedOptions).map((option) => option.value);
  }

  // Для файлів повертаємо об'єкт File або FileList
  if (field.type === 'file') {
    return field.multiple ? field.files : field.files[0];
  }

  // Для інших полів повертаємо значення
  return field.value;
}

/**
 * Оновлення UI поля відповідно до результату валідації
 * @param {HTMLElement} field - Поле для оновлення
 * @param {boolean} isValid - Результат валідації
 * @param {string} errorMessage - Повідомлення про помилку
 */
function updateFieldValidationUI(field, isValid, errorMessage) {
  // Отримуємо контейнер для повідомлення про помилку
  const errorContainer = findErrorContainer(field);

  // Отримуємо іконку валідації, якщо вона є
  const iconContainer = field.parentNode.querySelector('.validation-icon');

  if (isValid) {
    // Знімаємо клас помилки
    field.classList.remove(config.errorClass);
    field.classList.add(config.validClass);

    // Приховуємо повідомлення про помилку
    if (errorContainer) {
      errorContainer.classList.remove('show');
      errorContainer.textContent = '';
    }

    // Оновлюємо іконку
    if (iconContainer) {
      iconContainer.classList.remove('error');
      iconContainer.classList.add('valid');
      iconContainer.innerHTML = '✓'; // Можна замінити на іконку з бібліотеки
    }
  } else {
    // Додаємо клас помилки
    field.classList.add(config.errorClass);
    field.classList.remove(config.validClass);

    // Показуємо повідомлення про помилку
    if (errorContainer) {
      errorContainer.textContent = errorMessage;
      errorContainer.classList.add('show');
    }

    // Оновлюємо іконку
    if (iconContainer) {
      iconContainer.classList.add('error');
      iconContainer.classList.remove('valid');
      iconContainer.innerHTML = '✗'; // Можна замінити на іконку з бібліотеки
    }
  }
}

/**
 * Очищення стану валідації поля
 * @param {HTMLElement} field - Поле для очищення
 */
function clearFieldValidation(field) {
  // Знімаємо класи
  field.classList.remove(config.errorClass, config.validClass);

  // Приховуємо повідомлення про помилку
  const errorContainer = findErrorContainer(field);
  if (errorContainer) {
    errorContainer.classList.remove('show');
    errorContainer.textContent = '';
  }

  // Приховуємо іконку
  const iconContainer = field.parentNode.querySelector('.validation-icon');
  if (iconContainer) {
    iconContainer.classList.remove('error', 'valid');
    iconContainer.innerHTML = '';
  }
}

/**
 * Оновлення стану кнопки відправки
 * @param {HTMLFormElement} form - Форма
 * @param {boolean} isValid - Стан валідації форми
 */
function updateSubmitButtonState(form, isValid) {
  const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');

  submitButtons.forEach((button) => {
    if (isValid) {
      button.classList.remove('disabled');
      button.disabled = false;
    } else {
      button.classList.add('disabled');
      button.disabled = true;
    }
  });
}

/**
 * Показ загального повідомлення про помилку для форми
 * @param {HTMLFormElement} form - Форма
 */
function showFormErrorMessage(form) {
  // Перевіряємо, чи є контейнер для загального повідомлення
  const errorContainer = form.querySelector('.form-error-message');

  if (errorContainer) {
    errorContainer.classList.add('show');

    // Показуємо повідомлення на деякий час
    setTimeout(() => {
      errorContainer.classList.remove('show');
    }, 5000);
  }
}

/**
 * Прокрутка до першого поля з помилкою
 * @param {HTMLFormElement} form - Форма
 */
function scrollToFirstError(form) {
  const firstError = form.querySelector(`.${config.errorClass}`);

  if (firstError) {
    // Прокручуємо до елемента
    scrollToElement(firstError, {
      behavior: 'smooth',
      block: 'center',
      offset: 50,
    });

    // Фокусуємося на полі через невеликий проміжок часу
    setTimeout(() => {
      firstError.focus();
    }, 500);
  }
}

/**
 * Налаштування спостереження за змінами в DOM
 */
function setupDOMObserver() {
  if (typeof MutationObserver === 'undefined') {
    logger.warn('MutationObserver не підтримується в цьому браузері', 'setupDOMObserver');
    return;
  }

  // Створюємо спостерігач
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Перевіряємо додані вузли
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Перевіряємо, чи це форма
          if (node.tagName === 'FORM' && node.hasAttribute('data-validate')) {
            setupFormValidation(node);
          }

          // Перевіряємо, чи містить форми
          const forms = node.querySelectorAll('form[data-validate]');
          forms.forEach((form) => {
            setupFormValidation(form);
          });
        }
      });

      // Перевіряємо видалені вузли
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Якщо вузол є формою
          if (node.tagName === 'FORM' && activeForms.has(node)) {
            cleanupForm(node);
          }

          // Перевіряємо, чи вузол містить форми
          if (node.querySelectorAll) {
            const forms = node.querySelectorAll('form');
            forms.forEach((form) => {
              if (activeForms.has(form)) {
                cleanupForm(form);
              }
            });
          }
        }
      });
    });
  });

  // Починаємо спостереження за всім документом
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  logger.debug('Налаштовано спостереження за змінами в DOM', 'setupDOMObserver');
}

/**
 * Очищення ресурсів форми
 * @param {HTMLFormElement} form - Форма для очищення
 */
function cleanupForm(form) {
  try {
    if (!activeForms.has(form)) {
      return;
    }

    const formData = activeForms.get(form);

    // Видаляємо обробник відправки форми
    if (formData.submitHandler) {
      form.removeEventListener('submit', formData.submitHandler);
    }

    // Очищаємо кожне поле
    formData.fields.forEach((fieldData, field) => {
      // Видаляємо обробники подій
      fieldData.handlers.forEach((handler) => {
        if (typeof handler.removeHandler === 'function') {
          handler.removeHandler();
        }
      });

      // Очищаємо стан валідації
      clearFieldValidation(field);

      // Видаляємо атрибут налаштування
      field.removeAttribute('data-validation-setup');
    });

    // Видаляємо форму з активних
    activeForms.delete(form);

    // Видаляємо атрибут ініціалізації
    form.removeAttribute('data-validation-initialized');

    logger.debug(`Очищено ресурси форми: ${form.id || 'anonymous'}`, 'cleanupForm');
  } catch (error) {
    logger.error('Помилка очищення ресурсів форми', 'cleanupForm', {
      formId: form.id,
      error: error.message,
    });
  }
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  try {
    // Копіюємо активні форми, щоб уникнути проблем з ітерацією при видаленні
    const forms = [...activeForms.keys()];

    // Очищаємо кожну форму
    forms.forEach((form) => {
      cleanupForm(form);
    });

    logger.info('Ресурси модуля валідації форм очищено', 'cleanup');
  } catch (error) {
    logger.error('Помилка очищення ресурсів модуля', 'cleanup', {
      error: error.message,
    });
  }
}

/**
 * Оновлення налаштувань модуля
 * @param {Object} newConfig - Нові налаштування
 * @returns {Object} Поточні налаштування
 */
export function updateConfig(newConfig = {}) {
  Object.assign(config, newConfig);
  logger.debug('Оновлено налаштування модуля валідації форм', 'updateConfig', { newConfig });
  return { ...config };
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
