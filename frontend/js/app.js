/**
 * app.js - Головний entry point для WINIX WebApp
 * Координує ініціалізацію всіх модулів та компонентів
 * @version 4.0.0
 */

class WinixApp {
    constructor() {
        this.isInitialized = false;
        this.modules = new Map();
        this.components = new Map();
        this.startTime = performance.now();

        // Performance tracking
        this.metrics = {
            initTime: 0,
            componentsLoaded: 0,
            errors: 0
        };

        // Binding
        this.handleError = this.handleError.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);
        this.handleTelegramEvent = this.handleTelegramEvent.bind(this);

        console.log('🚀 WinixApp: Ініціалізація розпочата');
    }

    /**
     * Головна функція ініціалізації додатку
     */
    async init() {
        try {
            if (this.isInitialized) {
                console.warn('⚠️ WinixApp вже ініціалізовано');
                return;
            }

            console.log('🔄 WinixApp: Початок ініціалізації модулів');

            // 1. Setup error handling (найперше!)
            this.setupErrorHandling();

            // 2. Initialize Telegram WebApp
            await this.initTelegramWebApp();

            // 3. Initialize core modules (в правильному порядку)
            await this.initCoreModules();

            // 4. Load page-specific components
            await this.loadPageComponents();

            // 5. Setup global event listeners
            this.setupEventListeners();

            // 6. Initialize performance monitoring
            this.initPerformanceMonitoring();

            // 7. Final setup
            await this.finalizeInitialization();

            this.isInitialized = true;
            this.metrics.initTime = performance.now() - this.startTime;

            console.log(`✅ WinixApp: Ініціалізація завершена за ${this.metrics.initTime.toFixed(2)}ms`);

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('winix-app-ready', {
                detail: {
                    initTime: this.metrics.initTime,
                    modules: Array.from(this.modules.keys()),
                    components: Array.from(this.components.keys())
                }
            }));

        } catch (error) {
            console.error('❌ WinixApp: Критична помилка ініціалізації:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Налаштування глобальної обробки помилок
     */
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handleError);

        console.log('✅ Error handling налаштовано');
    }

    /**
     * Ініціалізація Telegram WebApp
     */
    async initTelegramWebApp() {
        return new Promise((resolve) => {
            if (window.Telegram?.WebApp) {
                // Configure Telegram WebApp
                const tg = window.Telegram.WebApp;

                tg.ready();
                tg.expand();

                // Set theme
                if (tg.themeParams) {
                    this.applyTelegramTheme(tg.themeParams);
                }

                // Setup main button
                tg.MainButton.hide();

                // Setup haptic feedback availability
                this.hasFeedback = !!tg.HapticFeedback;

                // Listen to theme changes
                tg.onEvent('themeChanged', this.handleTelegramEvent);
                tg.onEvent('viewportChanged', this.handleTelegramEvent);

                console.log('✅ Telegram WebApp ініціалізовано');

                // Get user data
                const userData = tg.initDataUnsafe?.user;
                if (userData) {
                    localStorage.setItem('telegram_user_id', userData.id.toString());
                    localStorage.setItem('telegram_username', userData.username || 'User');
                }

                resolve();
            } else {
                console.warn('⚠️ Telegram WebApp недоступний, використовуємо mock');
                this.initTelegramMock();
                resolve();
            }
        });
    }

    /**
     * Mock Telegram для development
     */
    initTelegramMock() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.Telegram = {
                WebApp: {
                    ready: () => console.log('📱 Mock Telegram ready'),
                    expand: () => console.log('📱 Mock expand'),
                    initDataUnsafe: {
                        user: {
                            id: 7066583465,
                            username: 'testuser',
                            first_name: 'Test',
                            last_name: 'User'
                        }
                    },
                    themeParams: {
                        bg_color: '#1e2746',
                        text_color: '#ffffff',
                        hint_color: '#aaaaaa',
                        link_color: '#4eb5f7',
                        button_color: '#4eb5f7',
                        button_text_color: '#ffffff'
                    },
                    MainButton: {
                        text: '',
                        color: '#4eb5f7',
                        textColor: '#ffffff',
                        isVisible: false,
                        isActive: true,
                        setText: function(text) { this.text = text; },
                        onClick: function(callback) { this._callback = callback; },
                        show: function() { this.isVisible = true; },
                        hide: function() { this.isVisible = false; }
                    },
                    HapticFeedback: {
                        impactOccurred: (style) => console.log(`📳 Haptic: ${style}`)
                    },
                    onEvent: (event, callback) => console.log(`📱 Event listener: ${event}`)
                }
            };

            // Set mock user data
            localStorage.setItem('telegram_user_id', '7066583465');
            localStorage.setItem('telegram_username', 'testuser');
        }
    }

    /**
     * Ініціалізація основних модулів в правильному порядку
     */
    async initCoreModules() {
        const modules = [
            { name: 'State', init: () => this.initStateManager() },
            { name: 'API', init: () => this.initAPIModule() },
            { name: 'Auth', init: () => this.initAuthModule() },
            { name: 'Utils', init: () => this.initUtilsModule() }
        ];

        for (const module of modules) {
            try {
                await module.init();
                this.modules.set(module.name, { status: 'loaded', timestamp: Date.now() });
                console.log(`✅ ${module.name} модуль завантажено`);
            } catch (error) {
                console.error(`❌ Помилка завантаження ${module.name}:`, error);
                this.modules.set(module.name, { status: 'error', error });

                // Critical modules must load
                if (['State', 'API'].includes(module.name)) {
                    throw new Error(`Critical module ${module.name} failed to load`);
                }
            }
        }
    }

    /**
     * Ініціалізація State Manager
     */
    async initStateManager() {
        if (!window.WinixState) {
            throw new Error('WinixState не знайдено. Перевірте завантаження state.js');
        }

        // Connect to state changes
        window.WinixState.on('stateChange', this.handleStateChange);

        // Initialize with user data from Telegram
        const userData = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (userData) {
            window.WinixState.user = {
                telegram_id: userData.id.toString(),
                username: userData.username || userData.first_name || 'User',
                first_name: userData.first_name,
                last_name: userData.last_name
            };
        }

        // Load cached data
        const cachedCoins = localStorage.getItem('userCoins');
        const cachedBalance = localStorage.getItem('userTokens');

        if (cachedCoins) window.WinixState.coins = parseInt(cachedCoins);
        if (cachedBalance) window.WinixState.balance = parseFloat(cachedBalance);

        return Promise.resolve();
    }

    /**
     * Ініціалізація API модуля
     */
    async initAPIModule() {
        if (!window.WinixAPI) {
            throw new Error('WinixAPI не знайдено. Перевірте завантаження api.js');
        }

        // Test API connectivity
        try {
            const userId = window.WinixState?.user?.telegram_id;
            if (userId) {
                // Try to get user data
                const userData = await window.WinixAPI.getUserData();
                if (userData && userData.status === 'success') {
                    // Update state with fresh data
                    if (userData.data.coins !== undefined) {
                        window.WinixState.coins = userData.data.coins;
                    }
                    if (userData.data.balance !== undefined) {
                        window.WinixState.balance = userData.data.balance;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Не вдалося завантажити початкові дані користувача:', error);
            // Не критична помилка - працюємо з кешованими даними
        }

        return Promise.resolve();
    }

    /**
     * Ініціалізація Auth модуля
     */
    async initAuthModule() {
        if (window.WinixAuth) {
            try {
                await window.WinixAuth.init();
                console.log('✅ Auth модуль ініціалізовано');
            } catch (error) {
                console.warn('⚠️ Auth модуль не вдалося ініціалізувати:', error);
            }
        }
        return Promise.resolve();
    }

    /**
     * Ініціалізація Utils модуля
     */
    async initUtilsModule() {
        // Utils already loaded via script tags, just verify
        const requiredUtils = ['showNotification', 'showLoading', 'hideLoading'];

        for (const util of requiredUtils) {
            if (typeof window[util] !== 'function') {
                console.warn(`⚠️ Utility function ${util} not found`);
            }
        }

        return Promise.resolve();
    }

    /**
     * Завантаження компонентів специфічних для сторінки
     */
    async loadPageComponents() {
        const currentPage = this.getCurrentPage();
        console.log(`🔄 Завантаження компонентів для сторінки: ${currentPage}`);

        // Define page-specific components
        const pageComponents = {
            'index': ['balance', 'tasks', 'navigation'],
            'home': ['balance', 'tasks', 'navigation'],
            'staking': ['balance', 'staking', 'navigation'],
            'tasks': ['balance', 'tasks', 'navigation'],
            'general': ['balance', 'settings', 'navigation'],
            'wallet': ['balance', 'wallet', 'navigation']
        };

        const components = pageComponents[currentPage] || ['balance', 'navigation'];

        // Load components in parallel
        const loadPromises = components.map(componentName =>
            this.loadComponent(componentName)
        );

        try {
            await Promise.allSettled(loadPromises);
            console.log(`✅ Компоненти для ${currentPage} завантажено`);
        } catch (error) {
            console.error('❌ Помилка завантаження компонентів:', error);
        }
    }

    /**
     * Завантаження окремого компонента
     */
    async loadComponent(componentName) {
        try {
            const containerId = `${componentName}-container`;
            const container = document.getElementById(containerId);

            if (!container) {
                console.warn(`⚠️ Container ${containerId} не знайдено для ${componentName}`);
                return;
            }

            switch (componentName) {
                case 'balance':
                    if (window.BalanceComponent) {
                        this.components.set('balance', new window.BalanceComponent(containerId));
                    }
                    break;

                case 'staking':
                    if (window.WinixStakingSystem) {
                        await window.WinixStakingSystem.init();
                        this.components.set('staking', window.WinixStakingSystem);
                    }
                    break;

                case 'tasks':
                    // Load tasks component if available
                    if (window.TasksComponent) {
                        this.components.set('tasks', new window.TasksComponent(containerId));
                    }
                    break;

                case 'navigation':
                    // Initialize navigation
                    if (window.fixNavigation) {
                        window.fixNavigation();
                    }
                    break;

                case 'settings':
                    // Settings page specific initialization
                    this.initSettingsPage();
                    break;

                case 'wallet':
                    // Wallet page specific initialization
                    this.initWalletPage();
                    break;
            }

            this.metrics.componentsLoaded++;
            console.log(`✅ Компонент ${componentName} завантажено`);

        } catch (error) {
            console.error(`❌ Помилка завантаження компонента ${componentName}:`, error);
            this.metrics.errors++;
        }
    }

    /**
     * Налаштування глобальних слухачів подій
     */
    setupEventListeners() {
        // Online/offline detection
        window.addEventListener('online', () => {
            window.WinixState.connected = true;
            window.showNotification?.('З\'єднання відновлено', false);
        });

        window.addEventListener('offline', () => {
            window.WinixState.connected = false;
            window.showNotification?.('Немає з\'єднання з інтернетом', true);
        });

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // App became visible - refresh data if needed
                this.handleAppVisible();
            }
        });

        // Prevent default mobile behaviors
        document.addEventListener('touchmove', (e) => {
            if (e.scale !== 1) {
                e.preventDefault();
            }
        }, { passive: false });

        console.log('✅ Event listeners налаштовано');
    }

    /**
     * Ініціалізація моніторингу продуктивності
     */
    initPerformanceMonitoring() {
        // Performance observer for long tasks
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Long task > 50ms
                        console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });

            try {
                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Longtask API not supported
            }
        }

        // Monitor memory usage (if available)
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                    console.warn('⚠️ High memory usage detected');
                }
            }, 30000);
        }

        console.log('✅ Performance monitoring налаштовано');
    }

    /**
     * Фінальні налаштування
     */
    async finalizeInitialization() {
        // Hide loading screen
        window.hideLoading?.();

        // Show app content
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.style.opacity = '1';
        }

        // Initialize router if SPA
        if (window.WinixRouter) {
            window.WinixRouter.init();
        }

        // Setup periodic background sync
        this.setupBackgroundSync();

        console.log('✅ Фінальні налаштування завершено');
    }

    /**
     * Налаштування фонової синхронізації
     */
    setupBackgroundSync() {
        // Sync every 5 minutes when app is active
        setInterval(async () => {
            if (!document.hidden && window.WinixState?.connected) {
                try {
                    await window.WinixAPI?.getBalance();
                } catch (error) {
                    console.warn('⚠️ Background sync failed:', error);
                }
            }
        }, 300000); // 5 minutes
    }

    /**
     * Обробники подій
     */
    handleError(event) {
        this.metrics.errors++;

        const error = event.error || event.reason;
        console.error('❌ Global error:', error);

        // Don't show UI errors for network issues
        if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
            window.WinixState.connected = false;
            return;
        }

        // Show user-friendly error for other issues
        window.showNotification?.('Виникла помилка. Спробуйте оновити сторінку.', true);
    }

    handleStateChange({ property, value, oldValue }) {
        // Log significant state changes
        if (['coins', 'balance'].includes(property) && value !== oldValue) {
            console.log(`📊 State change: ${property} ${oldValue} → ${value}`);
        }

        // Update Telegram MainButton based on state
        this.updateTelegramMainButton();
    }

    handleTelegramEvent(eventData) {
        console.log('📱 Telegram event:', eventData);

        if (eventData.eventType === 'themeChanged') {
            this.applyTelegramTheme(window.Telegram.WebApp.themeParams);
        }
    }

    handleAppVisible() {
        // Refresh data when app becomes visible
        if (Date.now() - this.lastRefresh > 60000) { // 1 minute
            this.refreshData();
            this.lastRefresh = Date.now();
        }
    }

    handleInitializationError(error) {
        console.error('❌ Initialization failed:', error);

        // Show fallback UI
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: #1e2746;
                color: white;
                text-align: center;
                padding: 20px;
            ">
                <h2>❌ Помилка завантаження</h2>
                <p>Не вдалося ініціалізувати додаток</p>
                <button onclick="window.location.reload()" style="
                    margin-top: 20px;
                    padding: 12px 24px;
                    background: #4eb5f7;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Оновити сторінку</button>
            </div>
        `;
    }

    /**
     * Утиліти
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '') || 'index';
        return page === '' ? 'index' : page;
    }

    applyTelegramTheme(themeParams) {
        if (!themeParams) return;

        const root = document.documentElement;
        root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color || '#1e2746');
        root.style.setProperty('--tg-theme-text-color', themeParams.text_color || '#ffffff');
        root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color || '#aaaaaa');
        root.style.setProperty('--tg-theme-link-color', themeParams.link_color || '#4eb5f7');
        root.style.setProperty('--tg-theme-button-color', themeParams.button_color || '#4eb5f7');
        root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color || '#ffffff');

        console.log('🎨 Telegram theme застосовано');
    }

    updateTelegramMainButton() {
        const tg = window.Telegram?.WebApp;
        if (!tg?.MainButton) return;

        const currentPage = this.getCurrentPage();

        // Configure MainButton based on current page and state
        switch (currentPage) {
            case 'staking':
                if (window.WinixState?.coins > 0) {
                    tg.MainButton.setText('Почати стейкінг');
                    tg.MainButton.show();
                } else {
                    tg.MainButton.hide();
                }
                break;

            default:
                tg.MainButton.hide();
                break;
        }
    }

    async refreshData() {
        try {
            if (window.WinixAPI && window.WinixState?.connected) {
                await window.WinixAPI.getBalance();
            }
        } catch (error) {
            console.warn('⚠️ Data refresh failed:', error);
        }
    }

    initSettingsPage() {
        // Settings page specific logic
        console.log('⚙️ Settings page ініціалізовано');
    }

    initWalletPage() {
        // Wallet page specific logic
        console.log('💰 Wallet page ініціалізовано');
    }

    /**
     * Публічні методи
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: performance.now() - this.startTime,
            modules: Object.fromEntries(this.modules),
            components: Array.from(this.components.keys())
        };
    }

    destroy() {
        // Cleanup
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handleError);

        if (window.WinixState) {
            window.WinixState.off('stateChange', this.handleStateChange);
        }

        this.components.forEach(component => {
            if (component.destroy) component.destroy();
        });

        console.log('🗑️ WinixApp знищено');
    }
}

// Ініціалізація додатку
const winixApp = new WinixApp();

// Auto-start на DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        winixApp.init();
    });
} else {
    // Document already loaded
    winixApp.init();
}

// Export global
window.WinixApp = winixApp;

console.log('✅ app.js: Готовий до ініціалізації');