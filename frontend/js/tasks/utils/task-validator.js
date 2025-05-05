/**
 * Validators - оптимізований модуль для валідації форм і даних
 * Відповідає за:
 * - Перевірку форм перед відправкою на сервер
 * - Валідацію полів введення в реальному часі
 * - Стандартизацію перевірок для різних типів даних
 *
 * @version 2.0.0
 */

window.UI = window.UI || {};

window.UI.Validators = (function() {
    // Кеш для зберігання регулярних виразів - для підвищення продуктивності
    const regexCache = {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        phone: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
        url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        number: /^-?\d*\.?\d+$/,
        integer: /^-?\d+$/,
        alphanumeric: /^[a-zA-Z0-9]+$/,
        username: /^[a-zA-Z0-9_-]{3,20}$/
    };

    // Налаштування модуля
    const config = {
        debounceTime: 300,          // Час затримки перевірки при введенні (мс)
        customErrorMessages: true,  // Використовувати користувацькі повідомлення про помилки
        liveValidation: true,       // Валідація в реальному часі
        validateOnBlur: true,       // Валідація при втраті фокусу
        showErrorIcons: true        // Показувати іконки помилок
    };

    // Кеш обробників подій
    const eventHandlers = new Map();

    // Кеш активних форм
    const activeForms = new Set();

    /**
     * Ініціалізація модуля валідаторів
     * @param {Object} options - Налаштування модуля
     */
    function init(options = {}) {
        console.log('UI.Validators: Ініціалізація модуля валідації');

        // Оновлюємо налаштування
        Object.assign(config, options);

        // Додаємо стилі для валідації
        injectStyles();

        // Налаштовуємо автоматичну валідацію для форм з атрибутами
        setupAutoValidation();

        // Очищаємо ресурси при виході зі сторінки
        window.addEventListener('beforeunload', cleanup);
    }

    /**
     * Додавання CSS стилів для відображення помилок валідації
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('validators-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'validators-styles';

        // Оптимізовані CSS стилі для валідації форм
        styleElement.textContent = `
            /* Поля з помилкою */
            .error-field {
                border-color: #FF5252 !important;
                background-color: rgba(255, 82, 82, 0.05);
                box-shadow: 0 0 0 1px rgba(255, 82, 82, 0.25);
            }
            
            /* Поля, що пройшли валідацію */
            .valid-field {
                border-color: #4CAF50 !important;
                background-color: rgba(76, 175, 80, 0.05);
            }
            
            /* Контейнер для повідомлення про помилку */
            .error-message {
                color: #FF5252;
                font-size: 0.8125rem;
                margin-top: 0.3125rem;
                display: block;
                transition: all 0.2s ease;
                overflow: hidden;
                max-height: 0;
                opacity: 0;
            }
            
            .error-message.show {
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
            .form-group {
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
    }

    /**
     * Налаштування автоматичної валідації
     */
    function setupAutoValidation() {
        // Знаходимо форми з атрибутом data-validate
        const forms = document.querySelectorAll('form[data-validate]');

        if (forms.length > 0) {
            console.log(`UI.Validators: Знайдено ${forms.length} форм для автоматичної валідації`);

            // Для кожної форми додаємо обробники подій
            forms.forEach(form => {
                setupFormValidation(form);
            });
        }

        // Налаштовуємо спостереження за змінами в DOM
        setupDOMObserver();
    }

    /**
     * Налаштування спостереження за змінами в DOM
     */
    function setupDOMObserver() {
        if (window.MutationObserver) {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        // Перевіряємо нові вузли
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Якщо додано нову форму з атрибутом data-validate
                                if (node.nodeName === 'FORM' && node.hasAttribute('data-validate')) {
                                    setupFormValidation(node);
                                }

                                // Шукаємо форми всередині доданого вузла
                                const forms = node.querySelectorAll('form[data-validate]');
                                forms.forEach(form => {
                                    setupFormValidation(form);
                                });
                            }
                        });

                        // Перевіряємо видалені вузли
                        mutation.removedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.nodeName === 'FORM' && activeForms.has(node)) {
                                    cleanupForm(node);
                                }
                            }
                        });
                    }
                });
            });

            // Спостерігаємо за всім документом
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Налаштування валідації форми
     * @param {HTMLFormElement} form - Форма для валідації
     */
    function setupFormValidation(form) {
        if (activeForms.has(form)) return;

        // Додаємо форму в кеш активних форм
        activeForms.add(form);

        // Додаємо обробник для відправки форми
        const submitHandler = function(event) {
            // Виконуємо валідацію перед відправкою
            const isValid = validateForm(form);

            // Запобігаємо відправці, якщо форма не валідна
            if (!isValid) {
                event.preventDefault();
                event.stopPropagation();

                // Показуємо загальне повідомлення про помилку, якщо воно є
                showFormErrorMessage(form);

                // Прокручуємо до першого поля з помилкою
                scrollToFirstError(form);
            }
        };

        form.addEventListener('submit', submitHandler);
        eventHandlers.set(form, { submit: submitHandler });

        // Знаходимо всі поля, які потрібно валідувати
        const fields = form.querySelectorAll('[data-validate]');

        // Додаємо обробники подій для полів
        fields.forEach(field => {
            setupFieldValidation(field);
        });

        // Додаємо обробники для кнопок відправки
        const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
        submitButtons.forEach(button => {
            button.classList.add('submit-button');
        });
    }

    /**
     * Налаштування валідації для конкретного поля
     * @param {HTMLElement} field - Поле для валідації
     */
    function setupFieldValidation(field) {
        // Пропускаємо поля, які вже були налаштовані
        if (field.hasAttribute('data-validation-setup')) return;

        // Позначаємо поле як налаштоване
        field.setAttribute('data-validation-setup', 'true');

        // Отримуємо тип валідації
        const validationType = field.getAttribute('data-validate');

        // Створюємо контейнер для повідомлення про помилку, якщо його немає
        let errorContainer = field.nextElementSibling;
        if (!errorContainer || !errorContainer.classList.contains('error-message')) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            field.parentNode.insertBefore(errorContainer, field.nextSibling);
        }

        // Додаємо іконку валідації, якщо потрібно
        if (config.showErrorIcons) {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'validation-icon';

            const fieldParent = field.parentNode;
            if (fieldParent && !fieldParent.querySelector('.validation-icon')) {
                fieldParent.style.position = 'relative';
                fieldParent.appendChild(iconContainer);
            }
        }

        // Обробники подій для валідації в реальному часі
        if (config.liveValidation) {
            // Використовуємо debounce для оптимізації
            let debounceTimeout;

            const inputHandler = function() {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    validateField(field);
                }, config.debounceTime);
            };

            field.addEventListener('input', inputHandler);

            // Зберігаємо обробник для подальшого очищення
            if (!eventHandlers.has(field)) {
                eventHandlers.set(field, {});
            }
            eventHandlers.get(field).input = inputHandler;
        }

        // Валідація при втраті фокусу
        if (config.validateOnBlur) {
            const blurHandler = function() {
                validateField(field);
            };

            field.addEventListener('blur', blurHandler);

            // Зберігаємо обробник
            if (!eventHandlers.has(field)) {
                eventHandlers.set(field, {});
            }
            eventHandlers.get(field).blur = blurHandler;
        }
    }

    /**
     * Валідація всієї форми
     * @param {HTMLFormElement} form - Форма для валідації
     * @returns {boolean} Результат валідації
     */
    function validateForm(form) {
        // Знаходимо всі поля, які потрібно валідувати
        const fields = form.querySelectorAll('[data-validate]');

        // Змінна для відстеження результату валідації
        let isValid = true;

        // Валідуємо кожне поле
        fields.forEach(field => {
            // Якщо хоча б одне поле не валідне, вся форма не валідна
            if (!validateField(field)) {
                isValid = false;
            }
        });

        // Оновлюємо стан кнопки відправки
        updateSubmitButtonState(form, isValid);

        return isValid;
    }

    /**
     * Валідація конкретного поля
     * @param {HTMLElement} field - Поле для валідації
     * @returns {boolean} Результат валідації
     */
    function validateField(field) {
        // Отримуємо тип валідації
        const validationType = field.getAttribute('data-validate');

        // Отримуємо значення поля
        let value = field.value;

        // Для чекбоксів перевіряємо стан
        if (field.type === 'checkbox') {
            value = field.checked;
        }

        // Перевіряємо обов'язкове поле
        const isRequired = field.hasAttribute('required');

        // Якщо поле не обов'язкове і порожнє, вважаємо його валідним
        if (!isRequired && (value === '' || value === null || value === undefined)) {
            clearFieldValidation(field);
            return true;
        }

        // Валідуємо значення
        let isValid = true;
        let errorMessage = '';

        if (validationType) {
            const result = performValidation(value, validationType, field);
            isValid = result.isValid;
            errorMessage = result.errorMessage;
        }

        // Оновлюємо відображення поля
        updateFieldValidationUI(field, isValid, errorMessage);

        return isValid;
    }

    /**
     * Виконання валідації значення
     * @param {*} value - Значення для валідації
     * @param {string} validationType - Тип валідації
     * @param {HTMLElement} field - Поле для додаткових параметрів
     * @returns {Object} Результат валідації {isValid, errorMessage}
     */
    function performValidation(value, validationType, field) {
        // Обробка різних типів валідації
        switch (validationType) {
            case 'required':
                return validateRequired(value);

            case 'email':
                return validateEmail(value);

            case 'phone':
                return validatePhone(value);

            case 'url':
                return validateUrl(value);

            case 'number':
                return validateNumber(value, field);

            case 'integer':
                return validateInteger(value);

            case 'length':
                const minLength = parseInt(field.getAttribute('data-min-length') || '0');
                const maxLength = parseInt(field.getAttribute('data-max-length') || '0');
                return validateLength(value, minLength, maxLength);

            case 'match':
                const targetSelector = field.getAttribute('data-match-field');
                const targetField = document.querySelector(targetSelector);
                return validateMatch(value, targetField ? targetField.value : '');

            case 'username':
                return validateUsername(value);

            case 'password':
                const strength = field.getAttribute('data-password-strength') || 'medium';
                return validatePassword(value, strength);

            case 'checkbox':
                return validateCheckbox(value);

            case 'date':
                const format = field.getAttribute('data-date-format') || 'yyyy-mm-dd';
                return validateDate(value, format);

            case 'custom':
                // Для користувацької валідації використовуємо регулярний вираз з атрибуту
                const pattern = field.getAttribute('data-pattern');
                return validatePattern(value, pattern);

            default:
                // Якщо тип валідації - це регулярний вираз
                if (validationType.startsWith('regex:')) {
                    const regex = validationType.substring(6);
                    return validateRegex(value, regex);
                }

                // Повертаємо валідний результат, якщо тип не розпізнано
                return { isValid: true, errorMessage: '' };
        }
    }

    /**
     * Оновлення UI поля відповідно до результату валідації
     * @param {HTMLElement} field - Поле для оновлення
     * @param {boolean} isValid - Результат валідації
     * @param {string} errorMessage - Повідомлення про помилку
     */
    function updateFieldValidationUI(field, isValid, errorMessage) {
        // Отримуємо контейнер для повідомлення про помилку
        const errorContainer = field.nextElementSibling;

        // Отримуємо іконку валідації, якщо вона є
        const iconContainer = field.parentNode.querySelector('.validation-icon');

        if (isValid) {
            // Знімаємо клас помилки
            field.classList.remove('error-field');
            field.classList.add('valid-field');

            // Приховуємо повідомлення про помилку
            if (errorContainer && errorContainer.classList.contains('error-message')) {
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
            field.classList.add('error-field');
            field.classList.remove('valid-field');

            // Показуємо повідомлення про помилку
            if (errorContainer && errorContainer.classList.contains('error-message')) {
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
        field.classList.remove('error-field', 'valid-field');

        // Приховуємо повідомлення про помилку
        const errorContainer = field.nextElementSibling;
        if (errorContainer && errorContainer.classList.contains('error-message')) {
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

        submitButtons.forEach(button => {
            if (isValid) {
                button.classList.remove('disabled');
                button.removeAttribute('disabled');
            } else {
                button.classList.add('disabled');
                button.setAttribute('disabled', 'disabled');
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

            // Приховуємо повідомлення через 5 секунд
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
        const firstError = form.querySelector('.error-field');

        if (firstError) {
            // Плавно прокручуємо до поля з помилкою
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Фокусуємося на полі
            setTimeout(() => {
                firstError.focus();
            }, 500);
        }
    }

    /**
     * Очищення ресурсів форми
     * @param {HTMLFormElement} form - Форма для очищення
     */
    function cleanupForm(form) {
        // Видаляємо форму з кеша активних форм
        activeForms.delete(form);

        // Видаляємо обробники подій
        if (eventHandlers.has(form)) {
            const handlers = eventHandlers.get(form);

            if (handlers.submit) {
                form.removeEventListener('submit', handlers.submit);
            }

            eventHandlers.delete(form);
        }

        // Очищаємо обробники для полів форми
        const fields = form.querySelectorAll('[data-validate]');
        fields.forEach(field => {
            if (eventHandlers.has(field)) {
                const handlers = eventHandlers.get(field);

                if (handlers.input) {
                    field.removeEventListener('input', handlers.input);
                }

                if (handlers.blur) {
                    field.removeEventListener('blur', handlers.blur);
                }

                eventHandlers.delete(field);
            }
        });
    }

    /**
     * Очищення ресурсів модуля
     */
    function cleanup() {
        // Очищаємо всі активні форми
        activeForms.forEach(form => {
            cleanupForm(form);
        });

        // Очищаємо кеш обробників подій
        eventHandlers.clear();

        // Очищаємо стан модуля
        activeForms.clear();

        console.log('UI.Validators: Ресурси модуля очищено');
    }

    /**
     * Валідація обов'язкового поля
     * @param {*} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateRequired(value) {
        const isValid = value !== '' && value !== null && value !== undefined && value !== false;
        return {
            isValid,
            errorMessage: isValid ? '' : 'Це поле обов\'язкове для заповнення'
        };
    }

    /**
     * Валідація електронної пошти
     * @param {string} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateEmail(value) {
        const isValid = regexCache.email.test(value);
        return {
            isValid,
            errorMessage: isValid ? '' : 'Введіть коректну електронну адресу'
        };
    }

    /**
     * Валідація телефонного номера
     * @param {string} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validatePhone(value) {
        // Видаляємо всі нецифрові символи для валідації
        const cleanValue = value.replace(/\D/g, '');

        // Перевіряємо довжину та формат
        const isValid = cleanValue.length >= 10 && regexCache.phone.test(value);

        return {
            isValid,
            errorMessage: isValid ? '' : 'Введіть коректний номер телефону'
        };
    }

    /**
     * Валідація URL
     * @param {string} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateUrl(value) {
        const isValid = regexCache.url.test(value);
        return {
            isValid,
            errorMessage: isValid ? '' : 'Введіть коректний URL'
        };
    }

    /**
     * Валідація числа
     * @param {string} value - Значення для валідації
     * @param {HTMLElement} field - Поле для додаткових параметрів
     * @returns {Object} Результат валідації
     */
    function validateNumber(value, field) {
        // Перевіряємо, чи значення є числом
        const isNumber = regexCache.number.test(value);

        if (!isNumber) {
            return {
                isValid: false,
                errorMessage: 'Введіть числове значення'
            };
        }

        // Конвертуємо в число
        const numValue = parseFloat(value);

        // Перевіряємо мінімальне та максимальне значення
        const min = field.hasAttribute('min') ? parseFloat(field.getAttribute('min')) : null;
        const max = field.hasAttribute('max') ? parseFloat(field.getAttribute('max')) : null;

        if (min !== null && numValue < min) {
            return {
                isValid: false,
                errorMessage: `Значення повинно бути не менше ${min}`
            };
        }

        if (max !== null && numValue > max) {
            return {
                isValid: false,
                errorMessage: `Значення повинно бути не більше ${max}`
            };
        }

        return {
            isValid: true,
            errorMessage: ''
        };
    }

    /**
     * Валідація цілого числа
     * @param {string} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateInteger(value) {
        const isValid = regexCache.integer.test(value);
        return {
            isValid,
            errorMessage: isValid ? '' : 'Введіть ціле число'
        };
    }

    /**
     * Валідація довжини рядка
     * @param {string} value - Значення для валідації
     * @param {number} minLength - Мінімальна довжина
     * @param {number} maxLength - Максимальна довжина
     * @returns {Object} Результат валідації
     */
    function validateLength(value, minLength, maxLength) {
        const length = value.length;
        let isValid = true;
        let errorMessage = '';

        if (minLength > 0 && length < minLength) {
            isValid = false;
            errorMessage = `Текст повинен містити щонайменше ${minLength} символів`;
        } else if (maxLength > 0 && length > maxLength) {
            isValid = false;
            errorMessage = `Текст повинен містити не більше ${maxLength} символів`;
        }

        return {
            isValid,
            errorMessage
        };
    }

    /**
     * Валідація співпадіння значень
     * @param {string} value - Значення для валідації
     * @param {string} targetValue - Цільове значення для порівняння
     * @returns {Object} Результат валідації
     */
    function validateMatch(value, targetValue) {
        const isValid = value === targetValue;
        return {
            isValid,
            errorMessage: isValid ? '' : 'Значення не співпадають'
        };
    }

    /**
     * Валідація імені користувача
     * @param {string} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateUsername(value) {
        const isValid = regexCache.username.test(value);
        return {
            isValid,
            errorMessage: isValid ? '' : 'Ім\'я користувача повинно містити від 3 до 20 символів (літери, цифри, _ і -)'
        };
    }

    /**
     * Валідація пароля
     * @param {string} value - Значення для валідації
     * @param {string} strength - Рівень складності пароля
     * @returns {Object} Результат валідації
     */
    function validatePassword(value, strength) {
        let isValid = false;
        let errorMessage = '';

        // Перевіряємо мінімальну довжину
        if (value.length < 8) {
            return {
                isValid: false,
                errorMessage: 'Пароль повинен містити щонайменше 8 символів'
            };
        }

        // Перевіряємо складність пароля
        switch (strength) {
            case 'low':
                // Просто мінімальна довжина
                isValid = true;
                break;

            case 'medium':
                // Повинен містити літери та цифри
                isValid = /[A-Za-z]/.test(value) && /[0-9]/.test(value);
                errorMessage = 'Пароль повинен містити літери та цифри';
                break;

            case 'high':
                // Повинен містити великі та малі літери, цифри та спеціальні символи
                isValid = /[A-Z]/.test(value) && /[a-z]/.test(value) &&
                         /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
                errorMessage = 'Пароль повинен містити великі та малі літери, цифри та спеціальні символи';
                break;

            default:
                // За замовчуванням середній рівень
                isValid = /[A-Za-z]/.test(value) && /[0-9]/.test(value);
                errorMessage = 'Пароль повинен містити літери та цифри';
        }

        return {
            isValid,
            errorMessage: isValid ? '' : errorMessage
        };
    }

    /**
     * Валідація чекбокса
     * @param {boolean} value - Значення для валідації
     * @returns {Object} Результат валідації
     */
    function validateCheckbox(value) {
        return {
            isValid: value === true,
            errorMessage: value === true ? '' : 'Це поле повинно бути відмічено'
        };
    }

    /**
     * Валідація дати
     * @param {string} value - Значення для валідації
     * @param {string} format - Формат дати
     * @returns {Object} Результат валідації
     */
    function validateDate(value, format) {
        // Реалізуємо простий алгоритм валідації дати
        let isValid = false;

        // Розбираємо формат
        const separator = format.includes('/') ? '/' : format.includes('-') ? '-' : '.';
        const parts = value.split(separator);

        // Перевіряємо формат yyyy-mm-dd
        if (format === 'yyyy-mm-dd' && parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const day = parseInt(parts[2]);

            isValid = validateDateParts(year, month, day);
        }
        // Перевіряємо формат dd.mm.yyyy
        else if (format === 'dd.mm.yyyy' && parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            isValid = validateDateParts(year, month, day);
        }
        // Перевіряємо формат mm/dd/yyyy
        else if (format === 'mm/dd/yyyy' && parts.length === 3) {
            const month = parseInt(parts[0]);
            const day = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            isValid = validateDateParts(year, month, day);
        }

        return {
            isValid,
            errorMessage: isValid ? '' : `Введіть коректну дату у форматі ${format}`
        };
    }

    /**
     * Валідація компонентів дати
     * @param {number} year - Рік
     * @param {number} month - Місяць
     * @param {number} day - День
     * @returns {boolean} Результат валідації
     */
    function validateDateParts(year, month, day) {
        // Перевіряємо межі
        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }

        // Перевіряємо кількість днів у місяці
        const daysInMonth = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        return day <= daysInMonth[month - 1];
    }

    /**
     * Перевірка високосного року
     * @param {number} year - Рік
     * @returns {boolean} Високосний рік чи ні
     */
    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Валідація по шаблону
     * @param {string} value - Значення для валідації
     * @param {string} pattern - Регулярний вираз
     * @returns {Object} Результат валідації
     */
    function validatePattern(value, pattern) {
        if (!pattern) {
            return { isValid: true, errorMessage: '' };
        }

        try {
            const regex = new RegExp(pattern);
            const isValid = regex.test(value);

            return {
                isValid,
                errorMessage: isValid ? '' : 'Значення не відповідає вказаному формату'
            };
        } catch (error) {
            console.error('UI.Validators: Помилка створення регулярного виразу:', error);
            return { isValid: true, errorMessage: '' };
        }
    }

    /**
     * Валідація за регулярним виразом
     * @param {string} value - Значення для валідації
     * @param {string} regex - Регулярний вираз
     * @returns {Object} Результат валідації
     */
    function validateRegex(value, regex) {
        try {
            const re = new RegExp(regex);
            const isValid = re.test(value);

            return {
                isValid,
                errorMessage: isValid ? '' : 'Значення не відповідає вказаному формату'
            };
        } catch (error) {
            console.error('UI.Validators: Помилка створення регулярного виразу:', error);
            return { isValid: true, errorMessage: '' };
        }
    }

    // Ініціалізуємо модуль при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        validateForm,
        validateField,
        setupFormValidation,
        setupFieldValidation,

        // Публічні методи валідації для використання в інших модулях
        validateEmail,
        validatePhone,
        validateUrl,
        validateNumber,
        validateInteger,
        validateLength,
        validateMatch,
        validateUsername,
        validatePassword,
        validateDate
    };
})();