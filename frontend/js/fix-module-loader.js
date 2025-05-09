/**
 * Виправлення для завантаження ES модулів та вирішення проблем з циклічними залежностями
 * Автоматично перетворює ES6 модулі на формат, сумісний з браузером
 */
(function() {
  'use strict';

  console.log('🛠️ Запуск покращеної системи виправлення завантаження модулів v2.0');

  // Створюємо глобальний реєстр модулів
  window.WinixModules = window.WinixModules || {
    modules: {},
    definitions: {},
    loading: {},
    registry: {},

    // Реєстрація модуля вручну
    register: function(name, moduleExports) {
      this.registry[name] = moduleExports;
      console.log(`✅ Зареєстровано модуль вручну: ${name}`);
      return moduleExports;
    },

    // Отримання модуля з реєстру
    get: function(name) {
      return this.registry[name] || null;
    },

    // Реєстрація визначення модуля
    define: function(name, dependencies, factory) {
      this.definitions[name] = {
        deps: dependencies,
        factory: factory,
        exports: null // Експорти будуть тут після завантаження
      };

      // Спробуємо одразу завантажити модуль, якщо всі залежності доступні
      this.tryLoadModule(name);

      return this.definitions[name];
    },

    // Спроба завантажити модуль
    tryLoadModule: function(name) {
      // Якщо модуль вже завантажено або в процесі, пропускаємо
      if (this.modules[name] || this.loading[name]) {
        return this.modules[name] || null;
      }

      const def = this.definitions[name];
      if (!def) {
        console.warn(`⚠️ Спроба завантажити невизначений модуль: ${name}`);
        return null;
      }

      // Перевіряємо чи всі залежності доступні
      const depsAvailable = def.deps.every(dep => this.modules[dep]);

      if (!depsAvailable) {
        // Записуємо залежності, які не доступні для відладки
        const missingDeps = def.deps.filter(dep => !this.modules[dep]);
        console.debug(`🔄 Модуль ${name} очікує залежності: ${missingDeps.join(', ')}`);
        return null;
      }

      // Завантажуємо модуль
      this.loading[name] = true;

      try {
        // Створюємо масив з експортами залежностей
        const depExports = def.deps.map(dep => this.modules[dep]);

        // Викликаємо фабрику з експортами залежностей
        const moduleExports = def.factory.apply(null, depExports);

        // Зберігаємо результат
        this.modules[name] = moduleExports;

        // Реєструємо також в глобальному реєстрі
        this.registry[name] = moduleExports;

        // Усуваємо статус завантаження
        delete this.loading[name];

        console.log(`✅ Завантажено модуль: ${name}`);

        // Сповіщаємо про завантаження модуля
        document.dispatchEvent(new CustomEvent('module-loaded', {
          detail: { module: name, exports: moduleExports }
        }));

        // Запускаємо спробу завантаження залежних модулів
        this.tryLoadDependentModules(name);

        return moduleExports;
      } catch (error) {
        console.error(`❌ Помилка завантаження модуля ${name}:`, error);
        delete this.loading[name];
        return null;
      }
    },

    // Спроба завантаження модулів, які залежать від щойно завантаженого
    tryLoadDependentModules: function(loadedModule) {
      // Шукаємо всі модулі, які мають залежність від завантаженого
      for (const name in this.definitions) {
        if (this.definitions[name].deps.includes(loadedModule)) {
          this.tryLoadModule(name);
        }
      }
    },

    // Отримання модуля (синхронно, якщо він доступний, або запуск завантаження)
    require: function(name) {
      // Якщо модуль вже завантажено, повертаємо його експорти
      if (this.modules[name]) {
        return this.modules[name];
      }

      // Якщо є визначення, спробуємо завантажити
      if (this.definitions[name]) {
        return this.tryLoadModule(name);
      }

      // Якщо модуль зареєстрований в глобальному реєстрі, повертаємо його
      if (this.registry[name]) {
        return this.registry[name];
      }

      console.warn(`⚠️ Не знайдено модуль: ${name}`);
      return null;
    }
  };

  // Масив критичних шляхів, які потрібно перевірити та виправити
  const criticalPaths = [
    '/js/tasks/config/index.js',
    '/js/tasks/utils/index.js',
    '/js/tasks/api/index.js',
    '/js/tasks/api/models/daily-bonus.js',
    '/js/tasks/models/types/daily-bonus-model.js',
    '/js/tasks/api/core/cache.js',
    '/js/tasks/api/core/request.js',
    '/js/tasks/api/core/config.js'
  ];

  // Перевіряємо наявність файлів
  function checkPathsExistence() {
    const promises = criticalPaths.map(path =>
      fetch(path, { method: 'HEAD' })
        .then(response => ({ path, exists: response.ok, status: response.status }))
        .catch(() => ({ path, exists: false, status: 0 }))
    );

    return Promise.all(promises);
  }

  // Функція для трансформації ES6 імпортів/експортів у сумісний формат
  function transformESModuleCode(code, path) {
    // Створюємо ім'я модуля з шляху
    const moduleName = path.replace(/^\/js\//, '').replace(/\.js$/, '').replace(/\//g, '.');

    try {
      // Замінюємо import ... from '...'; на змінні
      code = code.replace(/import\s+([\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]/g, function(match, importPart, modulePath) {
        // Якщо імпортуємо все
        if (importPart.trim() === '*') {
          return `const * = window.WinixModules.require("${modulePath}")`;
        }

        // Якщо деструктуризуємо
        if (importPart.includes('{')) {
          // Розбираємо деструктуризацію
          const destructured = importPart.match(/{\s*([\w\s,]+)\s*}/)[1].split(',').map(s => s.trim());

          // Створюємо окремі константи
          const consts = destructured.map(name => {
            return `const ${name} = window.WinixModules.require("${modulePath}")["${name}"]`;
          }).join(';\n');

          return consts;
        }

        // Простий імпорт
        return `const ${importPart.trim()} = window.WinixModules.require("${modulePath}")`;
      });

      // Замінюємо export default ... на реєстрацію
      code = code.replace(/export\s+default\s+([^;]+);?/g, function(match, exportPart) {
        return `window.WinixModules.register("${moduleName}", ${exportPart})`;
      });

      // Замінюємо named exports
      code = code.replace(/export\s+const\s+(\w+)\s*=\s*([^;]+);?/g, function(match, name, value) {
        return `const ${name} = ${value};\nif(!window.${moduleName}) window.${moduleName} = {};\nwindow.${moduleName}.${name} = ${name}`;
      });

      // Замінюємо export class ... на реєстрацію класу
      code = code.replace(/export\s+class\s+(\w+)/g, function(match, name) {
        return `class ${name}`;
      });

      // Додаємо реєстрацію в кінці файлу
      code += `\n// Автоматична реєстрація модуля\nif (typeof window !== "undefined" && !window.WinixModules.get("${moduleName}")) {\n  window.WinixModules.register("${moduleName}", {});\n}`;

      return code;
    } catch (error) {
      console.error(`Помилка трансформації ES модуля ${path}:`, error);
      // Повертаємо вихідний код у разі помилки
      return code;
    }
  }

  // Функція для завантаження та виправлення модуля
  async function loadAndFixModule(path) {
    try {
      // Завантаження файлу
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Помилка завантаження модуля: ${path}, статус: ${response.status}`);
      }

      // Отримання вмісту
      let code = await response.text();

      // Трансформація ES6 модуля
      code = transformESModuleCode(code, path);

      // Додаємо коментар для відстеження
      code = `// Модуль виправлено системою fix-module-loader.js: ${new Date().toISOString()}\n${code}`;

      // Створюємо Blob з виправленим кодом
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      // Створюємо script елемент і додаємо його на сторінку
      const scriptElement = document.createElement('script');
      scriptElement.src = blobUrl;
      scriptElement.async = false;
      scriptElement.dataset.originalPath = path;
      scriptElement.dataset.fixed = 'true';

      // Відстежуємо завантаження або помилку
      return new Promise((resolve, reject) => {
        scriptElement.onload = () => {
          resolve({ path, success: true });
        };

        scriptElement.onerror = (error) => {
          console.error(`Помилка завантаження виправленого модуля ${path}:`, error);
          reject(error);
        };

        // Додаємо елемент на сторінку
        document.head.appendChild(scriptElement);
      });
    } catch (error) {
      console.error(`Помилка завантаження і виправлення модуля ${path}:`, error);
      throw error;
    }
  }

  // Функція для фіксації всіх критичних модулів
  async function fixCriticalModules() {
    // Перевіряємо наявність файлів
    const checkResults = await checkPathsExistence();
    console.log('📋 Результати перевірки файлів:', checkResults);

    // Фільтруємо і залишаємо тільки доступні файли
    const availableModules = checkResults.filter(result => result.exists);

    // Якщо немає доступних файлів, виходимо
    if (availableModules.length === 0) {
      console.warn('⚠️ Не знайдено жодного критичного модуля для виправлення');
      return;
    }

    // Завантажуємо і виправляємо кожний модуль по черзі
    for (const module of availableModules) {
      try {
        const result = await loadAndFixModule(module.path);
        console.log(`✅ Модуль ${module.path} успішно виправлений і завантажений`);
      } catch (error) {
        console.error(`❌ Не вдалося виправити модуль ${module.path}:`, error);
      }
    }

    // Сповіщаємо про готовність модульної системи
    document.dispatchEvent(new CustomEvent('module-system-ready', {
      detail: { modules: availableModules.map(m => m.path) }
    }));
  }

  // Функція безпечного завантаження скрипта
  function loadScriptSafely(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;

      script.onload = () => {
        console.log(`✅ Скрипт завантажено: ${url}`);
        resolve();
      };

      script.onerror = (error) => {
        console.error(`❌ Помилка завантаження скрипту: ${url}`, error);
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  // Додаємо обробник для відправки інформації на сервер про помилки
  window.reportModuleError = function(modulePath, errorDetails) {
    console.error(`❌ Помилка завантаження модуля: ${modulePath}`, errorDetails);

    // Відправляємо на сервер для логування
    fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'module_error',
        module: modulePath,
        error: typeof errorDetails === 'object' ?
          (errorDetails.message || JSON.stringify(errorDetails)) :
          String(errorDetails),
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent,
        page: window.location.pathname
      })
    }).catch(err => console.error('Помилка відправки звіту:', err));
  };

  // Створюємо проксі для зберігання до window.fetch, щоб дозволити роботу з ES модулями
  function setupModuleFetch() {
    // Зберігаємо оригінальну функцію fetch для використання в XMLHttpRequests
    window._originalFetch = window.fetch;

    // Перевизначаємо fetch для обробки завантаження ES модулів
    window.fetch = function(url, options) {
      // Якщо URL є шляхом до JS модуля і це GET-запит
      if (typeof url === 'string' && url.endsWith('.js') &&
          (!options || options.method === undefined || options.method === 'GET')) {
        // Перевіряємо, чи модуль уже виправлений і завантажений
        const moduleKey = url.replace(/^\/js\//, '').replace(/\.js$/, '').replace(/\//g, '.');
        if (window.WinixModules.get(moduleKey)) {
          // Повертаємо синтетичну відповідь для вже завантаженого модуля
          console.log(`🔄 Повертаємо кешований модуль для ${url}`);
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(`// Модуль вже завантажений: ${moduleKey}`)
          });
        }

        // Завантажуємо і виправляємо модуль
        return window._originalFetch(url, options)
          .then(response => {
            if (!response.ok) {
              return response;
            }

            // Клонуємо відповідь, бо response.text() може бути використаний тільки один раз
            const clonedResponse = response.clone();

            // Отримуємо текст для аналізу модуля
            return clonedResponse.text().then(code => {
              // Трансформуємо ES модуль в сумісний формат
              const transformedCode = transformESModuleCode(code, url);

              // Створюємо синтетичну відповідь з виправленим кодом
              return {
                ok: true,
                status: 200,
                headers: new Headers(response.headers),
                text: () => Promise.resolve(transformedCode),
                json: () => Promise.reject(new Error('Not a JSON response')),
                // Додаємо інші методи, які можуть бути потрібні
                clone: () => ({ ...this, text: () => Promise.resolve(transformedCode) })
              };
            });
          });
      }

      // Для всіх інших запитів використовуємо оригінальний fetch
      return window._originalFetch(url, options);
    };
  }

  // Функція витягування ідентифікатора користувача з різних джерел
  function extractUserId() {
    // Порядок пріоритету: query параметр, localStorage, cookie
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');

    if (idFromUrl) {
      // Зберігаємо ID в localStorage для майбутнього використання
      try {
        localStorage.setItem('telegram_user_id', idFromUrl);
      } catch (e) {
        console.warn('Не вдалося зберегти ID в localStorage:', e);
      }
      return idFromUrl;
    }

    // Перевіряємо localStorage
    try {
      const idFromStorage = localStorage.getItem('telegram_user_id');
      if (idFromStorage) {
        return idFromStorage;
      }
    } catch (e) {
      console.warn('Не вдалося отримати ID з localStorage:', e);
    }

    // Якщо не вдалося отримати ID, повертаємо null
    return null;
  }

  // Створення глобальної функції для отримання ID користувача
  window.getUserId = extractUserId;

  // Функція ініціалізації
  async function initialize() {
    // Встановлюємо обробник fetch для модулів
    setupModuleFetch();

    // Фіксуємо всі критичні модулі
    await fixCriticalModules();

    // Сповіщаємо про готовність системи
    console.log('✅ Система виправлення завантаження модулів готова');
    document.dispatchEvent(new CustomEvent('module-loader-ready'));
  }

  // Перевіряємо готовність DOM і запускаємо ініціалізацію
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // DOM вже завантажений, запускаємо ініціалізацію відразу
    initialize();
  }
})();