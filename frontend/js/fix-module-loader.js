
// Файл: frontend/js/fix-module-loader.js

/**
 * Виправлення для завантаження ES модулів
 * Вирішує проблему з MIME типами та шляхами до модулів
 */
(function() {
  'use strict';

  console.log('🛠️ Запуск системи виправлення завантаження модулів');

  // Масив критичних шляхів, які потрібно перевірити та виправити
  const criticalPaths = [
    '/js/tasks/config/index.js',
    '/js/tasks/utils/index.js',
    '/js/tasks/api/index.js',
    '/js/tasks/api/models/daily-bonus.js',
    '/js/tasks/models/types/daily-bonus-model.js'
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

  // Додавання обробника для динамічного імпорту модулів
  function setupModuleHandler() {
    // Оригінальний метод імпорту
    const originalImport = window.import;

    // Перевизначаємо глобальний імпорт
    window.fixedImport = function(path) {
      console.log(`🔄 Спроба імпорту: ${path}`);

      // Виправляємо шлях, якщо потрібно
      let fixedPath = path;

      // Додаємо базовий шлях, якщо шлях відносний та не починається з /
      if (!path.startsWith('/') && !path.startsWith('http') && !path.startsWith('./')) {
        fixedPath = `/js/${path}`;
      }

      // Додаємо розширення .js, якщо його немає
      if (!fixedPath.endsWith('.js')) {
        fixedPath += '.js';
      }

      console.log(`🔧 Виправлений шлях імпорту: ${fixedPath}`);

      // Використовуємо fetch для отримання файлу як текст
      return fetch(fixedPath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Не вдалося завантажити модуль: ${fixedPath}, статус: ${response.status}`);
          }
          return response.text();
        })
        .then(code => {
          // Виправляємо імпорти всередині завантаженого файлу
          const fixedCode = code.replace(/import\s+.*?from\s+['"]([^'"]+)['"]/g, (match, importPath) => {
            // Визначаємо базовий шлях поточного модуля
            const basePath = fixedPath.substring(0, fixedPath.lastIndexOf('/'));

            // Якщо імпорт починається з './' або '../', конвертуємо в абсолютний шлях
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
              let absolutePath = new URL(importPath, `http://example.com${basePath}/`).pathname;
              return match.replace(importPath, absolutePath);
            }

            return match;
          });

          // Створюємо Blob з виправленим кодом
          const blob = new Blob([fixedCode], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);

          // Динамічний імпорт
          return import(blobUrl).catch(err => {
            console.error(`❌ Помилка імпорту модуля: ${fixedPath}`, err);
            throw err;
          });
        });
    };

    console.log('✅ Обробник імпорту модулів встановлено');

    // Додаємо функцію для спрощеного імпорту модулів завдань
    window.importTaskModule = function(modulePath) {
      const fullPath = modulePath.startsWith('tasks/')
        ? `/js/${modulePath}`
        : `/js/tasks/${modulePath}`;

      return window.fixedImport(fullPath);
    };
  }

  // Створюємо глобальний регістр модулів
  window.ModuleRegistry = {
    modules: {},
    register: function(name, module) {
      this.modules[name] = module;
      console.log(`📦 Зареєстровано модуль: ${name}`);
      return module;
    },
    get: function(name) {
      return this.modules[name];
    },
    list: function() {
      return Object.keys(this.modules);
    }
  };

  // Перевіряємо наявність файлів і встановлюємо обробник
  checkPathsExistence()
    .then(results => {
      console.log('📋 Результати перевірки файлів:');
      results.forEach(result => {
        console.log(`${result.path}: ${result.exists ? '✅' : '❌'} (статус: ${result.status})`);
      });

      // Встановлюємо обробник імпорту
      setupModuleHandler();

      // Сповіщаємо про готовність системи
      const event = new CustomEvent('module-system-ready', { detail: results });
      document.dispatchEvent(event);
    })
    .catch(error => {
      console.error('❌ Помилка при перевірці файлів:', error);
    });

  // Додаємо обробник для відправки інформації на сервер
  window.reportModuleError = function(modulePath, errorDetails) {
    console.error(`❌ Помилка завантаження модуля: ${modulePath}`, errorDetails);

    // Відправляємо на сервер для логування
    fetch('/api/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'module_error',
        module: modulePath,
        error: typeof errorDetails === 'object' ?
          (errorDetails.message || JSON.stringify(errorDetails)) :
          String(errorDetails),
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.error('Помилка відправки звіту:', err));
  };

  console.log('✅ Система виправлення завантаження модулів готова');
})();