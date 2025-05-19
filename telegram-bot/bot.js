const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config({ path: '../.env' }); // Шукаємо .env в корені проекту

const token = process.env.TELEGRAM_BOT_TOKEN || '7566480696:AAG9F6ZIpiQZZvM6R6ZxhenzxgfGE6IX62o';
const bot = new TelegramBot(token, {polling: true});

// URL вашого бекенду (змініть на ваш актуальний URL)
const BACKEND_URL = process.env.BACKEND_URL || 'https://winixbot.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://winixbot.com';

console.log(`🤖 Запуск WINIX бота...`);
console.log(`📡 Backend URL: ${BACKEND_URL}`);
console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);

// Функция для создания пользователя в базе данных
async function createUser(telegramId, username, referrerId = null) {
  try {
    console.log(`👤 Создание пользователя: ${telegramId}, username: ${username}, реферер: ${referrerId}`);

    const response = await axios.post(`${BACKEND_URL}/api/user/create`, {
      telegram_id: telegramId.toString(),
      username: username || `User${telegramId}`,
      referrer_id: referrerId ? referrerId.toString() : null
    }, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WINIX-Bot/1.0'
      }
    });

    console.log('✅ Пользователь создан:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    return null;
  }
}

// Функция для регистрации реферального связка
async function registerReferral(referrerId, refereeId) {
  try {
    console.log(`🔗 Регистрация реферального связка: ${referrerId} -> ${refereeId}`);

    const response = await axios.post(`${BACKEND_URL}/api/referrals/register`, {
      referrer_id: parseInt(referrerId),
      referee_id: parseInt(refereeId)
    }, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WINIX-Bot/1.0'
      }
    });

    console.log('✅ Реферальный связок зарегистрирован:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка регистрации реферального связка:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return null;
  }
}

// Функция для получения данных пользователя
async function getUser(telegramId) {
  try {
    console.log(`🔍 Получение пользователя: ${telegramId}`);

    const response = await axios.get(`${BACKEND_URL}/api/user/${telegramId}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'WINIX-Bot/1.0'
      }
    });

    console.log('✅ Пользователь найден:', response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`ℹ️ Пользователь ${telegramId} не найден в базе данных`);
      return null;
    }
    console.error('❌ Ошибка получения пользователя:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return null;
  }
}

// Start command с обработкой реферального параметра
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || `User${telegramId}`;

  console.log(`\n🚀 Команда /start от пользователя ${telegramId} (${username})`);
  console.log(`💬 Полная команда: ${msg.text}`);

  // Извлекаем параметр из команды /start
  const startParam = match[1] ? match[1].trim() : '';
  let referrerId = null;

  if (startParam) {
    // Убираем возможные лишние символы и пробелы
    const cleanParam = startParam.replace(/\s+/g, '');
    if (cleanParam && cleanParam !== telegramId.toString()) {
      referrerId = cleanParam;
      console.log(`🔗 Обнаружен реферальный параметр: ${referrerId}`);
    }
  }

  try {
    // Проверяем, существует ли пользователь в базе данных
    let user = await getUser(telegramId);
    let isNewUser = false;

    if (!user || !user.data) {
      // Создаем нового пользователя
      console.log(`🆕 Создание нового пользователя ${telegramId} с реферером ${referrerId}`);
      user = await createUser(telegramId, username, referrerId);
      isNewUser = true;

      if (user && user.success) {
        // Если указан реферер, регистрируем реферальный связок
        if (referrerId) {
          const referralResult = await registerReferral(referrerId, telegramId);
          if (referralResult && referralResult.success) {
            // Отправляем уведомление новому пользователю о успешной регистрации по реферальной ссылке
            const bonusText = referralResult.bonus_awarded
              ? `\n\n💰 За регистрацию по реферальной ссылке вы получили ${referralResult.bonus?.amount || 50} WINIX!`
              : '\n\n💰 За регистрацию вы получите бонус!';

            await bot.sendMessage(chatId, `🎉 Поздравляем! Вы зарегистрированы по реферальной ссылке пользователя WX${referrerId}!${bonusText}`);

            // Опционально: отправляем уведомление рефереру
            try {
              const referrerBonusText = referralResult.bonus_awarded
                ? `\n💰 Вы получили ${referralResult.bonus?.amount || 50} WINIX за приглашение!`
                : '\n💰 Вы получили бонус за приглашение!';

              await bot.sendMessage(referrerId, `🎊 У вас новый реферал!\n👤 Пользователь WX${telegramId} зарегистрировался по вашей ссылке.${referrerBonusText}`);
            } catch (error) {
              console.log(`⚠️ Не удалось отправить уведомление рефереру ${referrerId}:`, error.message);
            }
          }
        }
      } else {
        console.error('❌ Не удалось создать пользователя в базе данных');
        await bot.sendMessage(chatId, '❌ Произошла ошибка при регистрации. Попробуйте позже.');
        return;
      }
    } else {
      console.log(`ℹ️ Пользователь ${telegramId} уже существует в базе данных`);
    }
  } catch (error) {
    console.error('💥 Критическая ошибка при обработке команды /start:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    return;
  }

  // Отправляем приветственное сообщение
  const welcomeText = referrerId
    ? `🎉 Добро пожаловать в WINIX!

👥 Вы присоединились по приглашению пользователя WX${referrerId}!

🎁 Розыгрыши токенов, TON, стикеров, кэша, NFT и бейджей!
👥 Уникальная двухуровневая реферальная система  
🚀 Первый такой бот в Telegram!

Нажми кнопку ниже, чтобы начать участвовать в розыгрышах!`
    : `🎉 Добро пожаловать в WINIX!

🎁 Розыгрыши токенов, TON, стикеров, кэша, NFT и бейджей!
👥 Уникальная двухуровневая реферальная система  
🚀 Первый такой бот в Telegram!

Нажми кнопку ниже, чтобы начать участвовать в розыгрышах!`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '🎁 OPEN GIVEAWAY',
          web_app: { url: `${FRONTEND_URL}?userId=${telegramId}` }
        }
      ],
      [
        {
          text: '👥 Поделиться с друзьями',
          switch_inline_query: ''
        }
      ]
    ]
  };

  await bot.sendMessage(chatId, welcomeText, { reply_markup: keyboard });
});

// App command
bot.onText(/\/app/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  console.log(`📱 Команда /app от пользователя ${telegramId}`);

  const keyboard = {
    inline_keyboard: [[
      {
        text: '🎁 OPEN GIVEAWAY',
        web_app: { url: `${FRONTEND_URL}?userId=${telegramId}` }
      }
    ]]
  };

  await bot.sendMessage(chatId, '🎁 Открывайте Giveaway!', {
    reply_markup: keyboard
  });
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  console.log(`❓ Команда /help от пользователя ${telegramId}`);

  const helpText = `❓ Как работает WINIX:

1️⃣ Нажми "🎁 OPEN GIVEAWAY"
2️⃣ Участвуй в розыгрышах на сайте  
3️⃣ Приглашай друзей по реферальной ссылке
4️⃣ Выигрывай призы каждый день!

🌐 Сайт: ${FRONTEND_URL}
📞 Поддержка: @winix_support

📊 Для получения вашей реферальной ссылки откройте веб-приложение.

🔗 Ваша реферальная ссылка:
https://t.me/WINIX_Official_bot?start=${telegramId}`;

  await bot.sendMessage(chatId, helpText);
});

// Обработка inline query для реферальных ссылок
bot.on('inline_query', async (query) => {
  const userId = query.from.id;
  const referralLink = `https://t.me/WINIX_Official_bot?start=${userId}`;

  console.log(`🔗 Inline query от пользователя ${userId}`);

  const results = [
    {
      type: 'article',
      id: '1',
      title: '🎁 Пригласить в WINIX',
      description: 'Поделитесь своей реферальной ссылкой и получайте бонусы!',
      input_message_content: {
        message_text: `🎉 Присоединяйся к WINIX!

🎁 Розыгрыши токенов, TON, стикеров, кэша, NFT и бейджей!
👥 Двухуровневая реферальная система
🚀 Первый такой бот в Telegram!

👆 Нажми на ссылку, чтобы начать выигрывать:
${referralLink}`
      },
      thumb_url: `${FRONTEND_URL}/assets/winix-logo.png`
    }
  ];

  try {
    await bot.answerInlineQuery(query.id, results, {
      cache_time: 300,
      is_personal: true
    });
  } catch (error) {
    console.error('❌ Ошибка обработки inline query:', error);
  }
});

// Команда для получения реферальной ссылки
bot.onText(/\/referral/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  console.log(`🔗 Команда /referral от пользователя ${telegramId}`);

  const referralLink = `https://t.me/WINIX_Official_bot?start=${telegramId}`;

  const text = `🔗 Ваша реферальная ссылка:

${referralLink}

📊 Поделитесь этой ссылкой с друзьями и получайте:
• 🥇 10% от заработка рефералов первого уровня
• 🥈 5% от заработка рефералов второго уровня
• 🎁 Прямые бонусы за каждого приглашенного

📱 Используйте кнопку "Поделиться с друзьями" для быстрой отправки!`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '👥 Поделиться с друзьями',
          switch_inline_query: ''
        }
      ],
      [
        {
          text: '📊 Статистика рефералов',
          web_app: { url: `${FRONTEND_URL}/referrals?userId=${telegramId}` }
        }
      ]
    ]
  };

  await bot.sendMessage(chatId, text, { reply_markup: keyboard });
});

// Команда для статистики пользователя
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  console.log(`📊 Команда /stats от пользователя ${telegramId}`);

  try {
    const user = await getUser(telegramId);

    if (user && user.data) {
      const userData = user.data;
      const text = `📊 Ваша статистика:

💰 Баланс: ${userData.balance || 0} WINIX
🪙 Жетоны: ${userData.coins || 0}
🎫 Участий в розыгрышах: ${userData.participations_count || 0}
🏆 Побед: ${userData.wins_count || 0}

🏅 Бейджи:
${userData.badge_beginner ? '✅' : '❌'} Начинающий
${userData.badge_rich ? '✅' : '❌'} Богач  
${userData.badge_winner ? '✅' : '❌'} Победитель

🔗 Реферальная ссылка:
https://t.me/WINIX_Official_bot?start=${telegramId}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎁 OPEN GIVEAWAY',
              web_app: { url: `${FRONTEND_URL}?userId=${telegramId}` }
            }
          ]
        ]
      };

      await bot.sendMessage(chatId, text, { reply_markup: keyboard });
    } else {
      await bot.sendMessage(chatId, '❌ Не удалось получить статистику. Убедитесь, что вы зарегистрированы в системе.');
    }
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при получении статистики.');
  }
});

// Обработка ошибок
bot.on('error', (error) => {
  console.error('💥 Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
  console.error('📡 Ошибка polling:', error);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

console.log('✅ WINIX бот запущен и готов к работе!');
console.log(`🔧 Конфигурация:
  - Token: ${token ? '✅ Настроен' : '❌ Отсутствует'}
  - Backend: ${BACKEND_URL}
  - Frontend: ${FRONTEND_URL}
`);

// Экспорт для использования в других модулях
module.exports = bot;