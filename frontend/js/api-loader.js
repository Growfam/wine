/**
 * API Loader - завантажує API модулі в правильному порядку
 */
(function() {
    'use strict';

    console.log('🔄 API Loader: Початок завантаження модулів');

    // Список модулів для завантаження в порядку залежностей
    const modules = [
        '/js/api.js',           // Основний API (WinixAPI)
        '/js/auth.js',          // Авторизація
        '/js/tasks/api.js'      // Tasks API
    ];

    let loadedCount = 0;

    function loadModule(src) {
        return new Promise((resolve, reject) => {
            // Перевіряємо чи модуль вже завантажено
            if (document.querySelector(`script[src="${src}"]`)) {
                console.log(`✅ API Loader: ${src} вже завантажено`);
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';

            script.onload = () => {
                console.log(`✅ API Loader: ${src} завантажено`);
                loadedCount++;
                resolve();
            };

            script.onerror = () => {
                console.error(`❌ API Loader: Помилка завантаження ${src}`);
                reject(new Error(`Failed to load ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    // Завантажуємо модулі послідовно
    async function loadAllModules() {
        for (const module of modules) {
            try {
                await loadModule(module);

                // Додаємо затримку для ініціалізації
                await new Promise(resolve => setTimeout(resolve, 100));

                // Перевіряємо доступність критичних об'єктів
                if (module.includes('api.js') && !module.includes('tasks')) {
                    // Чекаємо на WinixAPI
                    let attempts = 0;
                    while (!window.WinixAPI && attempts < 10) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                    }

                    if (!window.WinixAPI) {
                        throw new Error('WinixAPI не ініціалізовано');
                    }
                }

            } catch (error) {
                console.error(`❌ API Loader: Критична помилка:`, error);
                throw error;
            }
        }

        console.log(`✅ API Loader: Всі модулі завантажено (${loadedCount}/${modules.length})`);

        // Генеруємо подію про готовність API
        document.dispatchEvent(new CustomEvent('api-ready', {
            detail: { modules: modules }
        }));
    }

    // Запускаємо завантаження
    loadAllModules().catch(error => {
        console.error('❌ API Loader: Не вдалося завантажити модулі:', error);
    });

})();