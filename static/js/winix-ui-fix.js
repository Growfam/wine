/**
 * winix-ui-fix.js
 *
 * Файл для виправлення проблем з інтерфейсом та дублюванням полів у системі WINIX.
 * Цей файл повинен бути підключений останнім після всіх інших скриптів системи.
 */

(function() {
    console.log("🔄 WINIX-UI-FIX: Запуск виправлень інтерфейсу...");

    /**
     * Виправлення дублювання полів вводу на сторінці стейкінгу
     */
    function fixDuplicateInputFields() {
        try {
            // Виконуємо на сторінці стейкінгу
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            if (currentPage !== 'staking') return;

            console.log("🔧 WINIX-UI-FIX: Перевірка дублікатів полів стейкінгу...");

            // Перевіряємо поле суми стейкінгу
            const stakingAmountInputs = document.querySelectorAll('#staking-amount, [name="staking-amount"]');
            if (stakingAmountInputs.length > 1) {
                console.log(`🔧 WINIX-UI-FIX: Знайдено ${stakingAmountInputs.length} полів вводу суми стейкінгу`);

                // Залишаємо тільки перше поле
                for (let i = 1; i < stakingAmountInputs.length; i++) {
                    stakingAmountInputs[i].parentNode.removeChild(stakingAmountInputs[i]);
                }

                console.log("✅ WINIX-UI-FIX: Дублікати полів вводу суми видалено");
            }

            // Перевіряємо селект періоду стейкінгу
            const stakingPeriodSelects = document.querySelectorAll('#staking-period, [name="staking-period"]');
            if (stakingPeriodSelects.length > 1) {
                console.log(`🔧 WINIX-UI-FIX: Знайдено ${stakingPeriodSelects.length} полів вибору періоду`);

                // Залишаємо тільки перше поле
                for (let i = 1; i < stakingPeriodSelects.length; i++) {
                    stakingPeriodSelects[i].parentNode.removeChild(stakingPeriodSelects[i]);
                }

                console.log("✅ WINIX-UI-FIX: Дублікати полів вибору періоду видалено");
            }

            return true;
        } catch (e) {
            console.error("❌ WINIX-UI-FIX: Помилка видалення дублікатів полів:", e);
            return false;
        }
    }

    /**
     * Удосконалення повідомлень (нотифікацій) системи
     */
    function enhanceNotifications() {
        try {
            console.log("🔧 WINIX-UI-FIX: Удосконалення системи нотифікацій...");

            // Якщо WinixCore недоступний, виходимо
            if (!window.WinixCore || !window.WinixCore.UI) {
                console.error("❌ WINIX-UI-FIX: WinixCore.UI не знайдено");
                return false;
            }

            // Зберігаємо посилання на оригінальну функцію
            const originalShowNotification = window.WinixCore.UI.showNotification;

            // Замінюємо функцію показу нотифікацій
            window.WinixCore.UI.showNotification = function(message, type, callback) {
                console.log(`🔔 WINIX-UI-FIX: Показ нотифікації: ${message}`);

                // Видаляємо попередні повідомлення, якщо вони є
                const existingNotification = document.getElementById('winix-styled-notification');
                if (existingNotification) {
                    existingNotification.parentNode.removeChild(existingNotification);
                }

                // Створюємо стилізований елемент нотифікації
                const notification = document.createElement('div');
                notification.id = 'winix-styled-notification';
                notification.style.position = 'fixed';
                notification.style.top = '50%';
                notification.style.left = '50%';
                notification.style.transform = 'translate(-50%, -50%)';
                notification.style.borderRadius = '10px';
                notification.style.padding = '15px 20px';
                notification.style.zIndex = '9999';
                notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                notification.style.fontFamily = 'Arial, sans-serif';
                notification.style.fontSize = '16px';
                notification.style.textAlign = 'center';
                notification.style.minWidth = '200px';
                notification.style.maxWidth = '80%';
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease-in-out';

                // Налаштування стилю в залежності від типу повідомлення
                if (type === window.WinixCore.MESSAGE_TYPES.SUCCESS) {
                    notification.style.backgroundColor = 'rgba(75, 181, 67, 0.95)';
                    notification.style.color = 'white';
                } else if (type === window.WinixCore.MESSAGE_TYPES.ERROR) {
                    notification.style.backgroundColor = 'rgba(220, 53, 69, 0.95)';
                    notification.style.color = 'white';
                } else if (type === window.WinixCore.MESSAGE_TYPES.WARNING) {
                    notification.style.backgroundColor = 'rgba(255, 193, 7, 0.95)';
                    notification.style.color = 'black';
                } else {
                    notification.style.backgroundColor = 'rgba(13, 110, 253, 0.95)';
                    notification.style.color = 'white';
                }

                // Додаємо текст повідомлення
                notification.textContent = message;

                // Додаємо нотифікацію на сторінку
                document.body.appendChild(notification);

                // Анімуємо появу
                setTimeout(() => {
                    notification.style.opacity = '1';
                }, 10);

                // Автоматично ховаємо нотифікацію через 3 секунди
                setTimeout(() => {
                    notification.style.opacity = '0';

                    // Видаляємо елемент після завершення анімації
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }

                        // Викликаємо callback, якщо він є
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }, 300);
                }, 3000);

                // Також викликаємо оригінальну функцію для сумісності
                // але з порожнім повідомленням, щоб оригінальна нотифікація була непомітною
                if (originalShowNotification) {
                    const emptyMessage = "";
                    originalShowNotification.call(window.WinixCore.UI, emptyMessage, type, null);
                }

                return true;
            };

            console.log("✅ WINIX-UI-FIX: Систему нотифікацій удосконалено");
            return true;
        } catch (e) {
            console.error("❌ WINIX-UI-FIX: Помилка удосконалення нотифікацій:", e);
            // Повертаємо оригінальну функцію, якщо сталася помилка
            if (window.WinixCore && window.WinixCore.UI && originalShowNotification) {
                window.WinixCore.UI.showNotification = originalShowNotification;
            }
            return false;
        }
    }

    /**
     * Додавання індикатора завантаження та оптимізація асинхронних операцій
     */
    function enhanceAsyncOperations() {
        try {
            console.log("🔧 WINIX-UI-FIX: Оптимізація асинхронних операцій...");

            // Додаємо стилі для індикатора завантаження
            const style = document.createElement('style');
            style.textContent = `
                .winix-loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9998;
                    opacity: 0;
                    transition: opacity 0.3s ease-in-out;
                    pointer-events: none;
                }
                
                .winix-loader.show {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                .winix-loader .spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: winix-spin 1s linear infinite;
                }
                
                @keyframes winix-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);

            // Створюємо індикатор завантаження
            const loader = document.createElement('div');
            loader.className = 'winix-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);

            // Функції для показу та приховування індикатора
            window.WinixLoader = {
                show: function() {
                    loader.classList.add('show');
                },
                hide: function() {
                    loader.classList.remove('show');
                }
            };

            // Удосконалюємо функцію створення стейкінгу, якщо вона доступна
            if (window.WinixCore && window.WinixCore.Staking) {
                const originalCreateStaking = window.WinixCore.Staking.createStaking;

                window.WinixCore.Staking.createStaking = function(amount, period) {
                    // Показуємо індикатор завантаження
                    window.WinixLoader.show();

                    try {
                        // Виконуємо оригінальну функцію
                        const result = originalCreateStaking.call(window.WinixCore.Staking, amount, period);

                        // Приховуємо індикатор з затримкою
                        setTimeout(() => {
                            window.WinixLoader.hide();
                        }, 1000);

                        return result;
                    } catch (e) {
                        // Приховуємо індикатор у разі помилки
                        window.WinixLoader.hide();
                        throw e;
                    }
                };

                // Удосконалюємо функцію скасування стейкінгу
                const originalCancelStaking = window.WinixCore.Staking.cancelStaking;

                window.WinixCore.Staking.cancelStaking = function() {
                    // Показуємо індикатор завантаження
                    window.WinixLoader.show();

                    try {
                        // Виконуємо оригінальну функцію
                        const result = originalCancelStaking.call(window.WinixCore.Staking);

                        // Приховуємо індикатор з затримкою
                        setTimeout(() => {
                            window.WinixLoader.hide();
                        }, 1000);

                        return result;
                    } catch (e) {
                        // Приховуємо індикатор у разі помилки
                        window.WinixLoader.hide();
                        throw e;
                    }
                };

                // Удосконалюємо функцію додавання до стейкінгу
                const originalAddToStaking = window.WinixCore.Staking.addToStaking;

                window.WinixCore.Staking.addToStaking = function(amount) {
                    // Показуємо індикатор завантаження
                    window.WinixLoader.show();

                    try {
                        // Виконуємо оригінальну функцію
                        const result = originalAddToStaking.call(window.WinixCore.Staking, amount);

                        // Приховуємо індикатор з затримкою
                        setTimeout(() => {
                            window.WinixLoader.hide();
                        }, 1000);

                        return result;
                    } catch (e) {
                        // Приховуємо індикатор у разі помилки
                        window.WinixLoader.hide();
                        throw e;
                    }
                };
            }

            console.log("✅ WINIX-UI-FIX: Асинхронні операції оптимізовано");
            return true;
        } catch (e) {
            console.error("❌ WINIX-UI-FIX: Помилка оптимізації асинхронних операцій:", e);
            return false;
        }
    }

    // Запускаємо виправлення після повного завантаження сторінки
    window.addEventListener('load', function() {
        // Виправляємо дублювання полів вводу
        setTimeout(fixDuplicateInputFields, 500);

        // Удосконалюємо систему нотифікацій
        setTimeout(enhanceNotifications, 700);

        // Оптимізуємо асинхронні операції
        setTimeout(enhanceAsyncOperations, 900);

        console.log("✅ WINIX-UI-FIX: Всі виправлення інтерфейсу застосовано");
    });

    // Якщо сторінка вже завантажена
    if (document.readyState === 'complete') {
        setTimeout(fixDuplicateInputFields, 500);
        setTimeout(enhanceNotifications, 700);
        setTimeout(enhanceAsyncOperations, 900);
        console.log("✅ WINIX-UI-FIX: Всі виправлення інтерфейсу застосовано (сторінка вже завантажена)");
    }

    console.log("✅ WINIX-UI-FIX: Модуль виправлень інтерфейсу ініціалізовано");
})();