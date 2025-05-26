/**
 * state.js - Реактивний менеджер стану для WINIX
 * Забезпечує instant UI updates і централізоване управління даними
 */

class WinixStateManager {
    constructor() {
        this.state = new Proxy({
            user: null,
            balance: 0,
            coins: 0,
            loading: false,
            connected: true,
            notifications: []
        }, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;

                // Instant UI update
                this.updateUI(property, value, oldValue);

                // Emit change event
                this.emit('stateChange', { property, value, oldValue });

                return true;
            }
        });

        this.listeners = new Map();
        this.cache = new Map();
        this.updateQueue = [];
        this.isUpdating = false;
    }

    // Реактивні оновлення UI
    updateUI(property, newValue, oldValue) {
        switch (property) {
            case 'balance':
                this.updateBalanceUI(newValue, oldValue);
                break;
            case 'coins':
                this.updateCoinsUI(newValue, oldValue);
                break;
            case 'loading':
                newValue ? this.showLoading() : this.hideLoading();
                break;
            case 'connected':
                this.updateConnectionStatus(newValue);
                break;
        }
    }

    // Instant balance update з анімацією
    updateBalanceUI(newBalance, oldBalance) {
        const balanceEl = document.getElementById('user-tokens');
        if (!balanceEl) return;

        // Animate change
        if (oldBalance !== undefined && newBalance !== oldBalance) {
            balanceEl.classList.add(newBalance > oldBalance ? 'increase' : 'decrease');
            setTimeout(() => {
                balanceEl.classList.remove('increase', 'decrease');
            }, 1000);
        }

        balanceEl.textContent = this.formatNumber(newBalance);
    }

    // Instant coins update з анімацією
    updateCoinsUI(newCoins, oldCoins) {
        const coinsEl = document.getElementById('user-coins');
        if (!coinsEl) return;

        // Counter animation
        if (oldCoins !== undefined && Math.abs(newCoins - oldCoins) <= 1000) {
            this.animateCounter(coinsEl, oldCoins, newCoins, 300);
        } else {
            coinsEl.textContent = newCoins;
        }
    }

    // Smooth counter animation
    animateCounter(element, from, to, duration) {
        const startTime = performance.now();
        const diff = to - from;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + diff * easeOut);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    // Batch updates для кращої продуктивності
    batchUpdate(updates) {
        this.updateQueue.push(...updates);

        if (!this.isUpdating) {
            this.isUpdating = true;
            requestAnimationFrame(() => {
                this.processBatchUpdates();
            });
        }
    }

    processBatchUpdates() {
        const updates = [...this.updateQueue];
        this.updateQueue.length = 0;
        this.isUpdating = false;

        updates.forEach(({ property, value }) => {
            this.state[property] = value;
        });
    }

    // Optimistic updates
    optimisticUpdate(property, value, revertOn = null) {
        const oldValue = this.state[property];
        this.state[property] = value;

        // Auto-revert on error if specified
        if (revertOn) {
            const cleanup = () => {
                this.state[property] = oldValue;
                this.off('apiError', cleanup);
            };
            this.on('apiError', cleanup);
        }
    }

    // Cache management
    setCache(key, value, ttl = 300000) { // 5 minutes default
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expires) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    showLoading() {
        if (window.showLoading) {
            window.showLoading();
        }
    }

    hideLoading() {
        if (window.hideLoading) {
            window.hideLoading();
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = connected ? 'connected' : 'disconnected';
            statusEl.textContent = connected ? 'Online' : 'Offline';
        }
    }

    // Public API
    get user() { return this.state.user; }
    set user(value) { this.state.user = value; }

    get balance() { return this.state.balance; }
    set balance(value) { this.state.balance = value; }

    get coins() { return this.state.coins; }
    set coins(value) { this.state.coins = value; }

    get loading() { return this.state.loading; }
    set loading(value) { this.state.loading = value; }

    get connected() { return this.state.connected; }
    set connected(value) { this.state.connected = value; }
}

// Глобальний інстанс
window.WinixState = new WinixStateManager();

// Інтеграція з існуючими модулями
if (window.WinixAPI) {
    // Auto-sync з API
    window.WinixState.on('stateChange', ({ property, value }) => {
        if (['balance', 'coins'].includes(property)) {
            // Debounce sync to server
            clearTimeout(window.WinixState._syncTimeout);
            window.WinixState._syncTimeout = setTimeout(() => {
                window.WinixAPI.refreshBalance().catch(console.error);
            }, 1000);
        }
    });
}

// Telegram WebApp integration
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.onEvent('themeChanged', () => {
        window.WinixState.emit('themeChanged');
    });

    window.Telegram.WebApp.onEvent('viewportChanged', () => {
        window.WinixState.emit('viewportChanged');
    });
}

console.log('✅ WinixState: Реактивний менеджер стану ініціалізовано');