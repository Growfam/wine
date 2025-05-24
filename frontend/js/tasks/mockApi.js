/**
 * Mock API для тестування без бекенду
 */
window.MockAPI = (function() {
    'use strict';

    console.log('🎭 [MockAPI] Mock API активовано');

    // Імітація затримки мережі
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Mock користувач
    const mockUser = {
        id: 123456789,
        telegramId: 123456789,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        balance: {
            winix: 1000,
            tickets: 10,
            flex: 0
        }
    };

    // Mock дані
    const mockData = {
        dailyBonus: {
            currentDay: 5,
            currentStreak: 5,
            longestStreak: 10,
            canClaim: true,
            nextClaimTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            todayReward: { winix: 50, tickets: 1 }
        },
        tasks: {
            social: [
                {
                    id: 'task1',
                    type: 'social',
                    platform: 'telegram',
                    title: 'Підписатися на канал',
                    description: 'Підпишіться на наш Telegram канал',
                    reward: { winix: 100, tickets: 2 },
                    status: 'available',
                    url: 'https://t.me/testchannel'
                }
            ],
            limited: [],
            partner: []
        }
    };

    return {
        // Auth
        validateTelegram: async () => {
            await delay(500);
            return {
                valid: true,
                user: mockUser,
                token: 'mock_jwt_token_' + Date.now()
            };
        },

        // User
        getProfile: async () => {
            await delay(300);
            return mockUser;
        },

        getBalance: async () => {
            await delay(200);
            return { balance: mockUser.balance };
        },

        // Daily Bonus
        getDailyStatus: async () => {
            await delay(300);
            return mockData.dailyBonus;
        },

        claimDailyBonus: async () => {
            await delay(500);
            const reward = { winix: 50, tickets: Math.random() > 0.7 ? 1 : 0 };
            mockUser.balance.winix += reward.winix;
            mockUser.balance.tickets += reward.tickets;
            return {
                success: true,
                reward,
                currentDay: mockData.dailyBonus.currentDay + 1,
                currentStreak: mockData.dailyBonus.currentStreak + 1,
                nextClaimTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
        },

        // Tasks
        getTasks: async () => {
            await delay(400);
            return { tasks: mockData.tasks };
        },

        // Wallet
        getWalletStatus: async () => {
            await delay(200);
            return { connected: false };
        },

        // Flex
        getFlexBalance: async () => {
            await delay(300);
            return { balance: 0 };
        }
    };
})();