/**
 * Контролер для управління всіма динамічними даними реферальної системи
 * Централізоване завантаження та оновлення даних з сервера
 */

class DynamicDataController {
    constructor(userId) {
        console.log('🎮 [DynamicData] Створення контролера для користувача:', userId);
        this.userId = userId;
        this.config = null;
        this.data = {
            user: null,
            referrals: {
                level1: [],
                level2: [],
                statistics: null
            },
            badges: null,
            bonusHistory: [],
            activityData: null
        };
        this.updateIntervals = {};
        this.isInitialized = false;
    }

    /**
     * Ініціалізація контролера
     */
    async initialize() {
        console.log('🚀 [DynamicData] Початок ініціалізації...');

        try {
            // 1. Завантажуємо конфігурацію
            await this.loadConfiguration();

            // 2. Завантажуємо дані користувача
            await this.loadUserData();

            // 3. Оновлюємо UI початковими даними
            this.updateAllUI();

            // 4. Встановлюємо інтервали оновлення
            this.setupAutoUpdates();

            this.isInitialized = true;
            console.log('✅ [DynamicData] Ініціалізація завершена');

        } catch (error) {
            console.error('❌ [DynamicData] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантаження конфігурації з сервера
     */
    async loadConfiguration() {
        console.log('📋 [DynamicData] Завантаження конфігурації...');

        try {
            // Спробуємо завантажити з сервера
            if (window.ReferralAPI && window.ReferralAPI.getConfig) {
                const response = await window.ReferralAPI.getConfig();
                if (response.success) {
                    this.config = response.data;
                    console.log('✅ [DynamicData] Конфігурація завантажена з сервера:', this.config);
                    return;
                }
            }
        } catch (error) {
            console.warn('⚠️ [DynamicData] Не вдалося завантажити конфігурацію з сервера:', error);
        }

        // Дефолтна конфігурація
        this.config = {
            rewards: {
                directBonus: 50,
                level1Percentage: 10,
                level2Percentage: 5
            },
            badges: {
                BRONZE: { name: 'Сміливець', threshold: 25, reward: 2500 },
                SILVER: { name: 'Новатор', threshold: 50, reward: 5000 },
                GOLD: { name: 'Легенда', threshold: 100, reward: 10000 },
                PLATINUM: { name: 'Візіонер', threshold: 500, reward: 20000 }
            },
            activityCriteria: {
                minDraws: 3,
                minInvited: 1
            }
        };

        console.log('📋 [DynamicData] Використовується дефолтна конфігурація:', this.config);
    }

    /**
     * Завантаження даних користувача
     */
    async loadUserData() {
        console.log('👤 [DynamicData] Завантаження даних користувача...');

        try {
            // Баланси користувача
            await this.updateBalances();

            // Реферальне посилання
            await this.updateReferralLink();

            // Статистика рефералів
            await this.updateReferralStatistics();

            // Бейджі
            await this.updateBadges();

            // Історія бонусів
            await this.updateBonusHistory();

            // Активність рефералів
            await this.updateActivityData();

        } catch (error) {
            console.error('❌ [DynamicData] Помилка завантаження даних:', error);
        }
    }

    /**
     * Оновлення балансів користувача
     */
    async updateBalances() {
        console.log('💰 [DynamicData] Оновлення балансів...');

        try {
            if (window.ReferralAPI && window.ReferralAPI.getUserBalance) {
                const response = await window.ReferralAPI.getUserBalance(this.userId);
                if (response.success) {
                    document.getElementById('user-coins').textContent = response.data.coins || 0;
                    document.getElementById('user-tokens').textContent = response.data.tokens || 0;
                    return;
                }
            }
        } catch (error) {
            console.warn('⚠️ [DynamicData] Помилка оновлення балансів:', error);
        }

        // Дефолтні значення
        document.getElementById('user-coins').textContent = '0';
        document.getElementById('user-tokens').textContent = '0';
    }

    /**
     * Оновлення реферального посилання
     */
    async updateReferralLink() {
        console.log('🔗 [DynamicData] Оновлення реферального посилання...');

        const linkDisplay = document.querySelector('.link-display');
        if (!linkDisplay) return;

        try {
            const baseUrl = 'https://t.me/winix_tap_bot?start=';
            const referralLink = baseUrl + this.userId;
            linkDisplay.textContent = referralLink;
            console.log('✅ [DynamicData] Реферальне посилання оновлено');
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення посилання:', error);
            linkDisplay.textContent = 'Помилка завантаження';
        }
    }

    /**
     * Оновлення всіх елементів UI
     */
    updateAllUI() {
        console.log('🎨 [DynamicData] Оновлення всіх елементів UI...');

        // Оновлення конфігураційних значень
        this.updateConfigValues();

        // Оновлення статистики
        this.updateStatisticsUI();

        // Оновлення списків
        this.updateListsUI();
    }

    /**
     * Оновлення значень з конфігурації
     */
    updateConfigValues() {
        // Винагороди
        this.updateElementsBySelector('[data-value="direct-bonus"]', this.config.rewards.directBonus);
        this.updateElementsBySelector('[data-value="level1-percentage"]', this.config.rewards.level1Percentage);
        this.updateElementsBySelector('[data-value="level2-percentage"]', this.config.rewards.level2Percentage);

        // Критерії активності
        this.updateElementsBySelector('[data-criteria="min-draws"]', this.config.activityCriteria.minDraws);
        this.updateElementsBySelector('[data-criteria="min-invited"]', this.config.activityCriteria.minInvited);
    }

    /**
     * Оновлення статистики рефералів
     */
    async updateReferralStatistics() {
        console.log('📊 [DynamicData] Оновлення статистики рефералів...');

        try {
            if (window.ReferralStore) {
                const state = window.ReferralStore.getState();

                // Загальна статистика
                const totalReferrals = state.statistics?.totalReferrals || 0;
                const activeReferrals = state.statistics?.activeReferrals || 0;
                const inactiveReferrals = totalReferrals - activeReferrals;
                const conversionRate = totalReferrals > 0 ?
                    Math.round((activeReferrals / totalReferrals) * 100) : 0;

                // Оновлюємо статистику активності
                document.getElementById('active-referrals-count').textContent = activeReferrals;
                document.getElementById('inactive-referrals-count').textContent = inactiveReferrals;
                document.getElementById('conversion-rate').textContent = conversionRate + '%';

                // Оновлюємо структуру рефералів
                document.querySelectorAll('.total-referrals-count').forEach(el => {
                    el.textContent = totalReferrals;
                });
                document.querySelectorAll('.active-referrals-count').forEach(el => {
                    el.textContent = activeReferrals;
                });
                document.querySelectorAll('.conversion-rate').forEach(el => {
                    el.textContent = conversionRate + '%';
                });

                this.data.referrals.statistics = {
                    total: totalReferrals,
                    active: activeReferrals,
                    inactive: inactiveReferrals,
                    conversionRate: conversionRate
                };
            }
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення статистики:', error);
        }
    }

    /**
     * Оновлення бейджів
     */
    async updateBadges() {
        console.log('🏆 [DynamicData] Оновлення бейджів...');

        try {
            if (window.ReferralStore) {
                const state = window.ReferralStore.getState();
                const badges = state.badges || {};
                const totalReferrals = state.statistics?.totalReferrals || 0;

                // Підрахунок статистики бейджів
                let earnedCount = 0;
                let totalCount = 0;
                let nextBadge = null;

                const badgesList = document.getElementById('badges-list');
                if (badgesList) {
                    badgesList.innerHTML = '';

                    for (const [badgeType, badgeConfig] of Object.entries(this.config.badges)) {
                        totalCount++;
                        const badge = badges[badgeType] || { claimed: false, eligible: false };

                        if (badge.claimed) earnedCount++;

                        // Визначаємо наступний бейдж
                        if (!badge.claimed && !nextBadge) {
                            nextBadge = {
                                type: badgeType,
                                ...badgeConfig,
                                progress: totalReferrals,
                                eligible: totalReferrals >= badgeConfig.threshold
                            };
                        }

                        // Створюємо елемент бейджа
                        const badgeElement = this.createBadgeElement(badgeType, badgeConfig, badge, totalReferrals);
                        badgesList.appendChild(badgeElement);
                    }
                }

                // Оновлюємо статистику бейджів
                document.getElementById('earned-badges-count').textContent = earnedCount;
                document.getElementById('total-badges-count').textContent = totalCount;
                document.getElementById('remaining-badges-count').textContent = totalCount - earnedCount;

                // Оновлюємо інформацію про наступний бейдж
                this.updateNextBadgeInfo(nextBadge);

                this.data.badges = { earned: earnedCount, total: totalCount, next: nextBadge };
            }
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення бейджів:', error);
        }
    }

    /**
     * Створення елемента бейджа
     */
    createBadgeElement(badgeType, badgeConfig, badgeData, totalReferrals) {
        const progress = Math.min(100, (totalReferrals / badgeConfig.threshold) * 100);
        const statusClass = badgeData.claimed ? 'claimed' :
                           (badgeData.eligible ? 'eligible' : 'not-eligible');

        const iconClass = badgeType.toLowerCase() + '-icon';
        const progressClass = badgeType.toLowerCase() + '-progress';

        const div = document.createElement('div');
        div.className = `badge-item ${statusClass}`;
        div.innerHTML = `
            <div class="badge-icon ${iconClass}"></div>
            <div class="badge-info">
                <div class="badge-title">${badgeConfig.name}</div>
                <div class="badge-description">Залучіть ${badgeConfig.threshold} рефералів</div>
                <div class="badge-reward">Винагорода: ${badgeConfig.reward} winix</div>
                <div class="badge-progress-container">
                    <div class="badge-progress-bar">
                        <div class="badge-progress-fill ${progressClass}" style="width: ${progress}%"></div>
                    </div>
                    <div class="badge-progress-text">${Math.round(progress)}% (${totalReferrals}/${badgeConfig.threshold})</div>
                </div>
                ${this.createBadgeButton(badgeType, badgeData)}
            </div>
        `;

        return div;
    }

    /**
     * Створення кнопки для бейджа
     */
    createBadgeButton(badgeType, badgeData) {
        if (badgeData.claimed) {
            return '<div class="badge-status claimed">Отримано</div>';
        } else if (badgeData.eligible) {
            return `<button class="claim-badge-button" data-badge="${badgeType}">Отримати винагороду</button>`;
        } else {
            return '<button class="claim-badge-button" data-badge="' + badgeType + '" disabled>Недоступно</button>';
        }
    }

    /**
     * Оновлення інформації про наступний бейдж
     */
    updateNextBadgeInfo(nextBadge) {
        const container = document.getElementById('next-badge-container');
        if (!container) return;

        if (nextBadge) {
            container.style.display = 'block';
            document.getElementById('next-badge-title').textContent = `Наступний бейдж: ${nextBadge.name}`;

            const progress = Math.min(100, (nextBadge.progress / nextBadge.threshold) * 100);
            document.getElementById('next-badge-progress').style.width = progress + '%';
            document.getElementById('next-badge-progress-text').textContent =
                `${Math.round(progress)}% (${nextBadge.progress}/${nextBadge.threshold})`;

            const remaining = Math.max(0, nextBadge.threshold - nextBadge.progress);
            document.getElementById('next-badge-remaining').textContent =
                `Залишилось: ${remaining} рефералів`;
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Оновлення історії бонусів
     */
    async updateBonusHistory() {
        console.log('📜 [DynamicData] Оновлення історії бонусів...');

        const container = document.getElementById('bonus-history-items');
        if (!container) return;

        try {
            if (window.ReferralStore) {
                const state = window.ReferralStore.getState();
                const history = state.bonusHistory || [];

                if (history.length === 0) {
                    container.innerHTML = '<p style="color: #888; text-align: center;">Поки що немає історії бонусів</p>';
                    return;
                }

                container.innerHTML = '';
                history.forEach(item => {
                    const element = this.createBonusHistoryItem(item);
                    container.appendChild(element);
                });

                this.data.bonusHistory = history;
            }
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення історії:', error);
            container.innerHTML = '<p style="color: #888; text-align: center;">Помилка завантаження історії</p>';
        }
    }

    /**
     * Створення елемента історії бонусів
     */
    createBonusHistoryItem(item) {
        const div = document.createElement('div');
        div.className = 'bonus-history-item';

        const date = new Date(item.date).toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });

        const typeText = this.getBonusTypeText(item.type);

        div.innerHTML = `
            <div class="history-date">${date}</div>
            <div class="history-info">
                <div class="history-type">${typeText}</div>
                ${item.referralId ? `<div class="history-user-id">ID: ${item.referralId}</div>` : ''}
            </div>
            <div class="history-amount">+${item.amount} winix</div>
        `;

        return div;
    }

    /**
     * Отримання тексту типу бонусу
     */
    getBonusTypeText(type) {
        const types = {
            'DIRECT_BONUS': 'Бонус за реферала',
            'LEVEL1_PERCENTAGE': 'Відсоток від 1-го рівня',
            'LEVEL2_PERCENTAGE': 'Відсоток від 2-го рівня',
            'BADGE_REWARD': 'Винагорода за бейдж',
            'TASK_REWARD': 'Винагорода за завдання'
        };
        return types[type] || type;
    }

    /**
     * Оновлення даних активності
     */
    async updateActivityData() {
        console.log('📈 [DynamicData] Оновлення даних активності...');

        const tableBody = document.getElementById('activity-table-body');
        if (!tableBody) return;

        try {
            if (window.ReferralStore) {
                const state = window.ReferralStore.getState();
                const referrals = [...(state.level1Referrals || []), ...(state.level2Referrals || [])];

                if (referrals.length === 0) {
                    tableBody.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Немає даних про рефералів</p>';
                    return;
                }

                tableBody.innerHTML = '';
                referrals.forEach(referral => {
                    const row = this.createActivityTableRow(referral);
                    tableBody.appendChild(row);
                });

                // Оновлюємо рекомендації
                this.updateActivityRecommendations(referrals);
            }
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення активності:', error);
            tableBody.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Помилка завантаження даних</p>';
        }
    }

    /**
     * Створення рядка таблиці активності
     */
    createActivityTableRow(referral) {
        const div = document.createElement('div');
        div.className = 'activity-table-row';

        const isActive = referral.participatedDraws >= this.config.activityCriteria.minDraws ||
                        referral.invitedReferrals >= this.config.activityCriteria.minInvited;

        div.innerHTML = `
            <div class="activity-table-data activity-data-id">${referral.id}</div>
            <div class="activity-table-data activity-data-draws">${referral.participatedDraws || 0}</div>
            <div class="activity-table-data activity-data-invited">${referral.invitedReferrals || 0}</div>
            <div class="activity-table-data activity-data-status">
                <span class="activity-status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                    ${isActive ? 'Активний' : 'Неактивний'}
                </span>
            </div>
        `;

        return div;
    }

    /**
     * Оновлення рекомендацій щодо активності
     */
    updateActivityRecommendations(referrals) {
        const container = document.getElementById('activity-recommendations');
        if (!container) return;

        const inactiveCount = referrals.filter(r =>
            r.participatedDraws < this.config.activityCriteria.minDraws &&
            r.invitedReferrals < this.config.activityCriteria.minInvited
        ).length;

        container.innerHTML = '';

        if (inactiveCount > 0) {
            const recommendation = document.createElement('p');
            recommendation.style.color = 'white';
            recommendation.style.marginBottom = '10px';
            recommendation.textContent = `У вас ${inactiveCount} неактивних рефералів. ` +
                `Заохочуйте їх брати участь у розіграшах (мінімум ${this.config.activityCriteria.minDraws}) ` +
                `або запрошувати інших користувачів (мінімум ${this.config.activityCriteria.minInvited}).`;
            container.appendChild(recommendation);
        } else if (referrals.length > 0) {
            const recommendation = document.createElement('p');
            recommendation.style.color = 'white';
            recommendation.textContent = 'Чудово! Всі ваші реферали активні. Продовжуйте запрошувати нових користувачів.';
            container.appendChild(recommendation);
        } else {
            const recommendation = document.createElement('p');
            recommendation.style.color = 'white';
            recommendation.textContent = 'Почніть запрошувати друзів за вашим реферальним посиланням!';
            container.appendChild(recommendation);
        }
    }

    /**
     * Оновлення UI статистики
     */
    updateStatisticsUI() {
        console.log('📊 [DynamicData] Оновлення UI статистики...');

        // Статистика вже оновлена в updateReferralStatistics
        // Тут можна додати додаткові оновлення якщо потрібно
    }

    /**
     * Оновлення списків рефералів
     */
    updateListsUI() {
        console.log('📋 [DynamicData] Оновлення списків рефералів...');

        try {
            if (window.ReferralStore) {
                const state = window.ReferralStore.getState();

                // Оновлення списку 1-го рівня
                this.updateReferralList('level1-list', state.level1Referrals || [], 1);

                // Оновлення списку 2-го рівня
                this.updateReferralList('level2-list', state.level2Referrals || [], 2);

                // Оновлення ієрархії
                this.updateReferralHierarchy(state);
            }
        } catch (error) {
            console.error('❌ [DynamicData] Помилка оновлення списків:', error);
        }
    }

    /**
     * Оновлення списку рефералів
     */
    updateReferralList(containerId, referrals, level) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (referrals.length === 0) {
            container.innerHTML = `<p style="color: #888; text-align: center;">Немає рефералів ${level}-го рівня</p>`;
            return;
        }

        container.innerHTML = '';
        referrals.forEach(referral => {
            const element = this.createReferralListItem(referral, level);
            container.appendChild(element);
        });
    }

    /**
     * Створення елемента списку рефералів
     */
    createReferralListItem(referral, level) {
        const div = document.createElement('div');
        div.className = `referral-item level-${level}`;

        const date = new Date(referral.registrationDate).toLocaleDateString('uk-UA');
        const isActive = referral.participatedDraws >= this.config.activityCriteria.minDraws ||
                        referral.invitedReferrals >= this.config.activityCriteria.minInvited;

        div.innerHTML = `
            <div class="referral-info">
                <div class="referral-id">${referral.id}</div>
                <div class="referral-date">Приєднався: ${date}</div>
            </div>
            <div class="referral-stats">
                <div class="referral-earnings">${referral.earned || 0} winix</div>
                <div class="referral-status ${isActive ? 'active' : 'inactive'}">
                    ${isActive ? 'Активний' : 'Неактивний'}
                </div>
            </div>
        `;

        div.addEventListener('click', () => this.showReferralDetails(referral));

        return div;
    }

    /**
     * Оновлення ієрархії рефералів
     */
    updateReferralHierarchy(state) {
        const container = document.getElementById('referral-hierarchy');
        if (!container) return;

        const hasReferrals = (state.level1Referrals?.length || 0) + (state.level2Referrals?.length || 0) > 0;

        if (!hasReferrals) {
            container.innerHTML = '<p style="color: #888; text-align: center;">Немає рефералів для відображення ієрархії</p>';
            return;
        }

        container.innerHTML = '';

        // Відображаємо рефералів 1-го рівня
        (state.level1Referrals || []).forEach(ref1 => {
            const node1 = this.createHierarchyNode(ref1, 1);
            container.appendChild(node1);

            // Шукаємо рефералів 2-го рівня від цього реферала
            const level2FromRef1 = (state.level2Referrals || []).filter(ref2 =>
                ref2.invitedBy === ref1.id
            );

            level2FromRef1.forEach(ref2 => {
                const node2 = this.createHierarchyNode(ref2, 2);
                container.appendChild(node2);
            });
        });
    }

    /**
     * Створення вузла ієрархії
     */
    createHierarchyNode(referral, level) {
        const div = document.createElement('div');
        div.className = `hierarchy-node level-${level}`;

        if (level === 2) {
            const connector = document.createElement('div');
            connector.className = 'hierarchy-connector';
            div.appendChild(connector);
        }

        const date = new Date(referral.registrationDate).toLocaleDateString('uk-UA');
        const isActive = referral.participatedDraws >= this.config.activityCriteria.minDraws ||
                        referral.invitedReferrals >= this.config.activityCriteria.minInvited;

        div.innerHTML += `
            <div class="hierarchy-user-id">ID: ${referral.id}</div>
            <div class="hierarchy-registration-date">Приєднався: ${date}</div>
            <div class="hierarchy-active-badge ${isActive ? 'active' : 'inactive'}">
                ${isActive ? 'Активний' : 'Неактивний'}
            </div>
        `;

        return div;
    }

    /**
     * Показ деталей реферала
     */
    showReferralDetails(referral) {
        const detailsContainer = document.getElementById('referral-details');
        if (!detailsContainer) return;

        document.getElementById('detail-id').textContent = referral.id;
        document.getElementById('detail-date').textContent =
            new Date(referral.registrationDate).toLocaleDateString('uk-UA');

        const isActive = referral.participatedDraws >= this.config.activityCriteria.minDraws ||
                        referral.invitedReferrals >= this.config.activityCriteria.minInvited;

        document.getElementById('detail-status').textContent = isActive ? 'Активний' : 'Неактивний';
        document.getElementById('detail-earnings').textContent = (referral.earned || 0) + ' winix';
        document.getElementById('detail-last-activity').textContent =
            referral.lastActivity ? new Date(referral.lastActivity).toLocaleDateString('uk-UA') : 'Немає даних';
        document.getElementById('detail-referral-count').textContent = referral.invitedReferrals || 0;
        document.getElementById('detail-draws').textContent = referral.participatedDraws || 0;
        document.getElementById('detail-invited').textContent = referral.invitedReferrals || 0;

        // Причина активності
        let activityReason = 'Не виконані критерії';
        if (referral.participatedDraws >= this.config.activityCriteria.minDraws) {
            activityReason = `Участь в ${referral.participatedDraws} розіграшах`;
        } else if (referral.invitedReferrals >= this.config.activityCriteria.minInvited) {
            activityReason = `Запросив ${referral.invitedReferrals} користувачів`;
        }
        document.getElementById('detail-activity-reason').textContent = activityReason;

        detailsContainer.classList.add('show');
    }

    /**
     * Оновлення елементів за селектором
     */
    updateElementsBySelector(selector, value) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.textContent = value;
        });
    }

    /**
     * Налаштування автоматичних оновлень
     */
    setupAutoUpdates() {
        console.log('⏰ [DynamicData] Налаштування автоматичних оновлень...');

        // Оновлення балансів кожні 30 секунд
        this.updateIntervals.balances = setInterval(() => {
            this.updateBalances();
        }, 30000);

        // Оновлення статистики кожну хвилину
        this.updateIntervals.statistics = setInterval(() => {
            this.updateReferralStatistics();
            this.updateBadges();
        }, 60000);

        // Оновлення історії кожні 2 хвилини
        this.updateIntervals.history = setInterval(() => {
            this.updateBonusHistory();
        }, 120000);

        // Додаємо обробник подій від ReferralStore
        if (window.ReferralStore) {
            window.ReferralStore.subscribe(() => {
                console.log('📡 [DynamicData] Отримано оновлення з ReferralStore');
                this.updateAllUI();
            });
        }
    }

    /**
     * Очищення інтервалів
     */
    destroy() {
        console.log('🧹 [DynamicData] Очищення контролера...');

        Object.values(this.updateIntervals).forEach(interval => {
            clearInterval(interval);
        });

        this.updateIntervals = {};
    }
}

// Експортуємо клас
window.DynamicDataController = DynamicDataController;