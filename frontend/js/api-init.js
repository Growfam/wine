/**
 * API Initialization - забезпечує правильний порядок ініціалізації
 */
(function() {
    'use strict';

    console.log('🔧 API Init: Початок ініціалізації');

    // Глобальний об'єкт для відстеження стану
    window.WinixInit = {
        modules: {
            api: false,
            auth: false,
            core: false,
            tasksConstants: false,
            tasksUtils: false,
            tasksAPI: false
        },

        checkModule: function(moduleName) {
            this.modules[moduleName] = true;
            console.log(`✅ Module ready: ${moduleName}`);
            this.checkAllReady();
        },

        checkAllReady: function() {
            const allReady = Object.values(this.modules).every(v => v === true);
            if (allReady && !this.initialized) {
                this.initialized = true;
                console.log('🎉 Всі модулі готові!');
                document.dispatchEvent(new CustomEvent('winix-modules-ready'));
            }
        },

        waitForModules: function() {
            return new Promise((resolve) => {
                if (this.initialized) {
                    resolve();
                } else {
                    document.addEventListener('winix-modules-ready', () => resolve(), { once: true });
                }
            });
        }
    };
})();