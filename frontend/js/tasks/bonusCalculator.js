/**
 * Калькулятор бонусів для системи завдань WINIX
 * Розрахунок щоденних винагород та прогресивних бонусів
 */

window.BonusCalculator = (function() {
    'use strict';

    console.log('🧮 [BonusCalculator] ===== ІНІЦІАЛІЗАЦІЯ КАЛЬКУЛЯТОРА БОНУСІВ =====');

    // Конфігурація з констант
    const config = window.TasksConstants?.DAILY_BONUS || {
        BASE_REWARD: { winix: 20 },
        PROGRESSIVE_REWARDS: {
            1: { winix: 20 },
            7: { winix: 50 },
            14: { winix: 100 },
            21: { winix: 200 },
            30: { winix: 500 }
        },
        MAX_DAILY_WINIX: 2000,
        TICKET_CONFIG: {
            days_per_week: 3,
            min_tickets: 1,
            max_tickets: 5,
            progressive_multiplier: 0.5
        }
    };

    console.log('⚙️ [BonusCalculator] Завантажена конфігурація:', config);

    /**
     * Розрахувати винагороду для конкретного дня
     */
    function calculateDailyReward(dayNumber) {
        console.log(`💰 [BonusCalculator] === РОЗРАХУНОК ВИНАГОРОДИ ДЛЯ ДНЯ ${dayNumber} ===`);

        // Валідація
        if (!window.TasksUtils.validate.isPositiveNumber(dayNumber)) {
            console.error('❌ [BonusCalculator] Невірний номер дня:', dayNumber);
            return { winix: 0, tickets: 0 };
        }

        // Базова винагорода
        let winixAmount = config.BASE_REWARD.winix;
        console.log('📊 [BonusCalculator] Базова винагорода:', winixAmount);

        // Перевіряємо спеціальні дні
        if (config.PROGRESSIVE_REWARDS[dayNumber]) {
            winixAmount = config.PROGRESSIVE_REWARDS[dayNumber].winix;
            console.log(`🎯 [BonusCalculator] Спеціальний день! Винагорода: ${winixAmount}`);
        } else {
            // Прогресивна формула
            winixAmount = calculateProgressiveReward(dayNumber);
            console.log(`📈 [BonusCalculator] Прогресивна винагорода: ${winixAmount}`);
        }

        // Обмеження максимумом
        if (winixAmount > config.MAX_DAILY_WINIX) {
            console.log(`⚠️ [BonusCalculator] Перевищено максимум, обмежуємо до ${config.MAX_DAILY_WINIX}`);
            winixAmount = config.MAX_DAILY_WINIX;
        }

        const result = {
            winix: Math.floor(winixAmount),
            tickets: 0 // Квитки розраховуються окремо
        };

        console.log('✅ [BonusCalculator] Фінальна винагорода:', result);
        return result;
    }

    /**
     * Розрахувати прогресивну винагороду
     */
    function calculateProgressiveReward(dayNumber) {
        console.log('📈 [BonusCalculator] Розрахунок прогресивної винагороди...');

        // Знаходимо найближчі віхи
        const milestones = Object.keys(config.PROGRESSIVE_REWARDS)
            .map(Number)
            .sort((a, b) => a - b);

        let prevMilestone = 1;
        let prevReward = config.BASE_REWARD.winix;
        let nextMilestone = 30;
        let nextReward = config.MAX_DAILY_WINIX;

        for (let i = 0; i < milestones.length; i++) {
            if (milestones[i] <= dayNumber) {
                prevMilestone = milestones[i];
                prevReward = config.PROGRESSIVE_REWARDS[milestones[i]].winix;
            }
            if (milestones[i] > dayNumber && i > 0) {
                nextMilestone = milestones[i];
                nextReward = config.PROGRESSIVE_REWARDS[milestones[i]].winix;
                break;
            }
        }

        console.log('📊 [BonusCalculator] Інтерполяція між віхами:', {
            попередня: `День ${prevMilestone}: ${prevReward} winix`,
            наступна: `День ${nextMilestone}: ${nextReward} winix`
        });

        // Лінійна інтерполяція
        const progress = (dayNumber - prevMilestone) / (nextMilestone - prevMilestone);
        const reward = prevReward + (nextReward - prevReward) * progress;

        // Додаємо невеликий бонус за послідовність
        const streakBonus = Math.floor(dayNumber / 7) * 10;
        const finalReward = reward + streakBonus;

        console.log('📊 [BonusCalculator] Розрахунок:', {
            прогрес: `${(progress * 100).toFixed(1)}%`,
            базоваВинагорода: Math.floor(reward),
            бонусЗаСерію: streakBonus,
            фінальнаВинагорода: Math.floor(finalReward)
        });

        return finalReward;
    }

    /**
     * Розрахувати кількість квитків
     */
    function calculateTicketAmount(dayNumber) {
        console.log(`🎟️ [BonusCalculator] === РОЗРАХУНОК КВИТКІВ ДЛЯ ДНЯ ${dayNumber} ===`);

        const { min_tickets, max_tickets, progressive_multiplier } = config.TICKET_CONFIG;

        // Базова кількість
        let tickets = min_tickets;

        // Прогресивне збільшення
        const weekNumber = Math.ceil(dayNumber / 7);
        const progressBonus = Math.floor((weekNumber - 1) * progressive_multiplier);

        tickets += progressBonus;

        // Обмеження максимумом
        tickets = Math.min(tickets, max_tickets);

        console.log('📊 [BonusCalculator] Розрахунок квитків:', {
            день: dayNumber,
            тиждень: weekNumber,
            базоваКількість: min_tickets,
            прогресивнийБонус: progressBonus,
            фінальнаКількість: tickets
        });

        return tickets;
    }

    /**
     * Розрахувати загальну винагороду за період
     */
    function calculatePeriodReward(fromDay, toDay) {
        console.log(`📊 [BonusCalculator] === РОЗРАХУНОК ЗА ПЕРІОД ${fromDay}-${toDay} ===`);

        let totalWinix = 0;
        let totalTickets = 0;

        for (let day = fromDay; day <= toDay; day++) {
            const dailyReward = calculateDailyReward(day);
            totalWinix += dailyReward.winix;

            // Припускаємо 3 дні з квитками на тиждень
            if (shouldHaveTickets(day)) {
                totalTickets += calculateTicketAmount(day);
            }
        }

        const result = {
            winix: totalWinix,
            tickets: totalTickets,
            days: toDay - fromDay + 1
        };

        console.log('✅ [BonusCalculator] Загальна винагорода за період:', result);
        return result;
    }

    /**
     * Визначити чи повинні бути квитки в цей день (для прогнозу)
     */
    function shouldHaveTickets(dayNumber) {
        // Простий алгоритм: квитки в дні 2, 4, 6 кожного тижня
        const dayOfWeek = (dayNumber - 1) % 7 + 1;
        return [2, 4, 6].includes(dayOfWeek);
    }

    /**
     * Отримати прогноз винагород
     */
    function getRewardsForecast(currentDay, daysAhead = 7) {
        console.log(`🔮 [BonusCalculator] === ПРОГНОЗ ВИНАГОРОД ===`);
        console.log(`📊 [BonusCalculator] Поточний день: ${currentDay}, прогноз на ${daysAhead} днів`);

        const forecast = [];

        for (let i = 1; i <= daysAhead; i++) {
            const day = currentDay + i;
            const reward = calculateDailyReward(day);
            const hasTickets = shouldHaveTickets(day);

            forecast.push({
                day: day,
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
                winix: reward.winix,
                tickets: hasTickets ? calculateTicketAmount(day) : 0,
                isSpecialDay: !!config.PROGRESSIVE_REWARDS[day]
            });
        }

        console.log('✅ [BonusCalculator] Прогноз:', forecast);
        return forecast;
    }

    /**
     * Розрахувати винагороду за серію днів
     */
    function calculateStreakBonus(streakDays) {
        console.log(`🔥 [BonusCalculator] === РОЗРАХУНОК БОНУСУ ЗА СЕРІЮ ===`);
        console.log(`📊 [BonusCalculator] Дні в серії: ${streakDays}`);

        let bonusMultiplier = 1;

        // Бонуси за тривалість серії
        if (streakDays >= 30) {
            bonusMultiplier = 2.0;
        } else if (streakDays >= 21) {
            bonusMultiplier = 1.5;
        } else if (streakDays >= 14) {
            bonusMultiplier = 1.25;
        } else if (streakDays >= 7) {
            bonusMultiplier = 1.1;
        }

        const bonusPercent = Math.floor((bonusMultiplier - 1) * 100);

        console.log('✅ [BonusCalculator] Бонус за серію:', {
            днів: streakDays,
            множник: bonusMultiplier,
            бонус: `+${bonusPercent}%`
        });

        return {
            multiplier: bonusMultiplier,
            bonusPercent: bonusPercent
        };
    }

    /**
     * Отримати статистику винагород
     */
    function getRewardStatistics() {
        console.log('📊 [BonusCalculator] === СТАТИСТИКА ВИНАГОРОД ===');

        // Розраховуємо статистику для всього місяця
        const monthReward = calculatePeriodReward(1, 30);

        // Середня винагорода
        const avgDailyWinix = Math.floor(monthReward.winix / 30);

        // Мінімальна та максимальна
        const minReward = config.BASE_REWARD.winix;
        const maxReward = config.MAX_DAILY_WINIX;

        // Віхи
        const milestones = Object.entries(config.PROGRESSIVE_REWARDS)
            .map(([day, reward]) => ({
                day: parseInt(day),
                winix: reward.winix
            }))
            .sort((a, b) => a.day - b.day);

        const stats = {
            totalMonthlyWinix: monthReward.winix,
            totalMonthlyTickets: monthReward.tickets,
            averageDailyWinix: avgDailyWinix,
            minDailyReward: minReward,
            maxDailyReward: maxReward,
            milestones: milestones,
            estimatedTicketsPerWeek: config.TICKET_CONFIG.days_per_week
        };

        console.log('✅ [BonusCalculator] Статистика:', stats);
        return stats;
    }

    /**
     * Валідація конфігурації
     */
    function validateConfig() {
        console.log('🔍 [BonusCalculator] Валідація конфігурації...');

        const errors = [];

        // Перевірка базової винагороди
        if (!config.BASE_REWARD || !config.BASE_REWARD.winix) {
            errors.push('Відсутня базова винагорода');
        }

        // Перевірка прогресивних винагород
        if (!config.PROGRESSIVE_REWARDS || Object.keys(config.PROGRESSIVE_REWARDS).length === 0) {
            errors.push('Відсутні прогресивні винагороди');
        }

        // Перевірка конфігурації квитків
        if (!config.TICKET_CONFIG) {
            errors.push('Відсутня конфігурація квитків');
        }

        if (errors.length > 0) {
            console.error('❌ [BonusCalculator] Помилки конфігурації:', errors);
            return false;
        }

        console.log('✅ [BonusCalculator] Конфігурація валідна');
        return true;
    }

    /**
     * Ініціалізація
     */
    function init() {
        console.log('🚀 [BonusCalculator] Ініціалізація калькулятора');

        // Валідуємо конфігурацію
        if (!validateConfig()) {
            console.error('❌ [BonusCalculator] Неможливо ініціалізувати з невалідною конфігурацією');
            return false;
        }

        // Виводимо статистику
        const stats = getRewardStatistics();
        console.log('📊 [BonusCalculator] Загальна статистика системи винагород:', {
            місячнийПотенціал: `${window.TasksUtils.formatNumber(stats.totalMonthlyWinix)} WINIX`,
            середняВинагорода: `${stats.averageDailyWinix} WINIX/день`,
            квиткиНаТиждень: `~${stats.estimatedTicketsPerWeek} tickets`
        });

        console.log('✅ [BonusCalculator] Калькулятор готовий до роботи');
        return true;
    }

    // Автоматична ініціалізація
    init();

    console.log('✅ [BonusCalculator] Модуль калькулятора бонусів готовий');

    // Публічний API
    return {
        calculateDailyReward,
        calculateTicketAmount,
        calculatePeriodReward,
        calculateStreakBonus,
        getRewardsForecast,
        getRewardStatistics,
        // Константи для зовнішнього використання
        config: config
    };

})();

console.log('✅ [BonusCalculator] Модуль експортовано глобально');