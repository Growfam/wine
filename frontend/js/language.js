/**
 * language.js - Система багатомовності для WINIX
 * Підтримує українську (uk), англійську (en) та російську (ru) мови
 */

(function() {
    console.log("🌐 Ініціалізація системи багатомовності WINIX...");

    // Доступні мови
    const AVAILABLE_LANGUAGES = ['uk', 'en', 'ru'];

    // Мова за замовчуванням
    const DEFAULT_LANGUAGE = 'uk';

    // Поточна мова (отримуємо з localStorage або задаємо за замовчуванням)
    let currentLanguage = localStorage.getItem('userLanguage') || DEFAULT_LANGUAGE;

    // Перевіряємо валідність мови
    if (!AVAILABLE_LANGUAGES.includes(currentLanguage)) {
        currentLanguage = DEFAULT_LANGUAGE;
        localStorage.setItem('userLanguage', currentLanguage);
    }

    // Українська мова
    const DICTIONARY_UK = {
        // Загальні фрази
        "settings": "Налаштування",
        "edit_profile": "Редагувати профіль",
        "language_selection": "Вибір мови",
        "app_settings": "Налаштування додатку",
        "notifications": "Сповіщення",
        "security": "Безпека",
        "show_seed": "Показати SID фразу",
        "coins": "Жетони",
        "user_id": "ID:",

        // Загальне
        "app.name": "WINIX",
        "balance.tokens": "Токени",
        "balance.jetons": "Жетони",
        "navigation.home": "Головна",
        "navigation.earn": "Заробляй",
        "navigation.referrals": "Реферали",
        "navigation.wallet": "Гаманець",
        "navigation.general": "Загальне",

        // Навігація
        "home": "Home",
        "earn": "Earn",
        "referrals": "Referrals",
        "wallet": "Wallet",
        "general": "General",

        // Кнопки
        "btn_save": "Зберегти",
        "btn_cancel": "Скасувати",
        "btn_ok": "OK",

        // Модальні вікна
        "edit_profile_title": "Редагувати профіль",
        "username": "Ім'я користувача:",
        "new_password": "Новий пароль:",
        "password_placeholder": "Залиште порожнім, якщо не змінювати",
        "confirm_password": "Підтвердження пароля:",
        "confirm_password_placeholder": "Підтвердіть новий пароль",
        "upload_avatar": "Завантажити аватар:",
        "select_avatar": "Або виберіть аватар:",

        // Повідомлення
        "profile_updated": "Профіль оновлено",
        "settings_saved": "Налаштування збережено",
        "settings_error": "Помилка збереження",
        "navigation_error": "Помилка навігації",
        "enter_username": "Введіть ім'я користувача",
        "passwords_dont_match": "Паролі не співпадають",
        "min_8_chars": "Мінімум 8 символів",
        "min_5_letters": "Мінімум 5 літер",

        // SID фраза
        "seed_phrase": "SID Фраза",
        "your_seed_phrase": "Ваша SID Фраза",
        "save_seed": "Збережіть її в безпечному місці!",
        "copy": "Скопіювати",
        "done": "Готово",
        "copied": "Скопійовано",
        "copy_error": "Помилка копіювання",

        // Встановлення пароля
        "set_password": "Встановіть пароль",
        "password_requirements": "Мінімум 8 символів, 5 літер",
        "password": "Пароль",
        "confirm": "Підтвердження",
        "enter_password": "Введіть пароль",
        "your_password": "Ваш пароль",
        "check": "Перевірити",
        "wrong_password": "Неправильний пароль",

        // Мови
        "language_uk": "Українська",
        "language_en": "English",
        "language_ru": "Русский",

        // Сторінка заробітку (earn.html)
        "earn.daily_bonus": "Щоденний бонус",
        "earn.social_networks": "Соціальні мережі",
        "earn.get": "Отримати",
        "earn.subscribe": "Підписатись",
        "earn.verify": "Перевірити",
        "earn.referral_tasks": "Реферальні завдання",
        "earn.invite_friends": "Запроси друзів",
        "earn.invite": "Запросити друзів",
        "earn.completed": "Виконано",
        "earn.leaderboard": "Лідерська дошка",
        "earn.leaderboard.title": "Топ-10 користувачів з найбільшою кількістю запрошених друзів",
        "earn.friends_invited": "друзів запрошено",
        "earn.referrals": "рефералів",
        "earn.limited_tasks": "Обмежені за часом завдання",
        "earn.coming_soon": "Скоро",
        "earn.expect_new_tasks": "Лімітовані завдання будуть доступні найближчим часом. Не пропустіть можливість отримати додаткові нагороди!",
        "earn.partners_tasks": "Партнерські завдання",
        "earn.expect_partners": "Партнерські завдання будуть доступні найближчим часом. Слідкуйте за оновленнями!",

        // Гаманець (wallet.html)
        "wallet.balance": "Баланс $WINIX",
        "wallet.in_staking": "У стейкінгу:",
        "wallet.rewards": "Нагороди:",
        "wallet.send": "Надіслати",
        "wallet.receive": "Отримати",
        "wallet.staking": "Стейкінг",
        "wallet.recent_transactions": "Останні транзакції",
        "wallet.view_all": "Переглянути всі",
        "wallet.welcome_bonus": "Вітальний бонус",
        "wallet.staking_reward": "Нагорода за стейкінг",
        "wallet.staking_deposit": "Відправлено на стейкінг",

        // Транзакції (transactions.html)
        "transactions.title": "Історія транзакцій",
        "transactions.all": "Всі",
        "transactions.receive": "Отримання",
        "transactions.send": "Відправлення",
        "transactions.stake": "Стейкінг",
        "transactions.unstake": "Розстейкінг",
        "transactions.loading": "Завантаження транзакцій...",
        "transactions.details": "Деталі транзакції",
        "transactions.type": "Тип:",
        "transactions.amount": "Сума:",
        "transactions.date": "Дата:",
        "transactions.description": "Опис:",
        "transactions.status": "Статус:",
        "transactions.id": "ID:",
        "transactions.close": "Закрити",
        "transactions.received": "Отримано",
        "transactions.sent": "Надіслано",
        "transactions.staked": "Застейкано",
        "transactions.unstaked": "Розстейкано",
        "transactions.completed": "Завершено",
        "transactions.in_progress": "В обробці",
        "transactions.failed": "Не вдалося",

        // Отримання (receive.html)
        "receive.title": "Отримати $WINIX",
        "receive.id": "Ваш ID для отримання:",
        "receive.copy_id": "Копіювати ID",
        "receive.how_to": "Як отримати $WINIX",
        "receive.how_to_desc": "Поділіться своїм ID з відправником для отримання токенів. $WINIX можна отримувати тільки всередині цього додатку. Після підтвердження транзакції, токени будуть автоматично зараховані на ваш баланс. Транзакції зазвичай підтверджуються протягом кількох хвилин.",

        // Стейкінг (staking.html)
        "staking.title": "Стейкінг",
        "staking.amount": "Введіть суму $WINIX",
        "staking.max": "Max",
        "staking.period_7": "7 днів (4% прибутку)",
        "staking.period_14": "14 днів (9% прибутку)",
        "staking.period_28": "28 днів (15% прибутку)",
        "staking.expected_reward": "Очікувана нагорода:",
        "staking.stake_button": "Застейкати",
        "staking.details_button": "Деталі стейкінгу",
        "staking.cancel_button": "Скасувати стейкінг",
        "staking.none": "Наразі немає активних стейкінгів",

        // Деталі стейкінгу (staking-details.html)
        "staking.details.title": "Деталі Стейкінгу",
        "staking.details.amount": "Сума стейкінгу",
        "staking.details.period": "Період стейкінгу",
        "staking.details.reward_percent": "Відсоток прибутку",
        "staking.details.expected_reward": "Очікувана нагорода",
        "staking.details.days_left": "Залишилось днів",
        "staking.details.add": "Додати до стейкінгу",
        "staking.details.add_amount": "Введіть суму для додавання до стейкінгу:",

        // Налаштування (general.html)
        "settings.title": "Налаштування",
        "settings.edit_profile": "Редагувати профіль",
        "settings.language": "Вибір мови",
        "settings.lang.uk": "Українська",
        "settings.lang.en": "English",
        "settings.lang.ru": "Русский",
        "settings.app_settings": "Налаштування додатку",
        "settings.notifications": "Сповіщення",
        "settings.security": "Безпека",
        "settings.seed_phrase": "Показати SID фразу",
        "settings.profile.username": "Ім'я користувача:",
        "settings.profile.new_password": "Новий пароль:",
        "settings.profile.confirm": "Підтвердження пароля:",
        "settings.profile.avatar": "Завантажити аватар:",
        "settings.profile.choose": "Або виберіть аватар:",
        "settings.profile.save": "Зберегти",

        // Реферали (referrals.html)
        "referrals.title": "Реферальна Програма",
        "referrals.link": "Завантаження посилання...",
        "referrals.copy": "Копіювати",
        "referrals.total": "Всього рефералів",
        "referrals.earned": "Зароблено $WINIX",
        "referrals.level1": "Рівень 1: Прямі реферали",
        "referrals.level1.desc": "Отримуйте 10% від балансу прямих рефералів",
        "referrals.level2": "Рівень 2: Непрямі реферали",
        "referrals.level2.desc": "Отримуйте 5% від балансу непрямих рефералів",
        "referrals.direct": "Ваші прямі реферали (Рівень 1)",
        "referrals.indirect": "Непрямі реферали (Рівень 2)",
        "referrals.no_referrals1": "У вас ще немає рефералів 1 рівня",
        "referrals.no_referrals2": "У вас ще немає рефералів 2 рівня",

        // Папка (folder.html)
        "folder.title": "Деталі папки",
        "folder.add": "ADD FOLDER",
        "folder.verify": "Verify Subscription",

        // Статуси і повідомлення
        "status.success": "Успішно",
        "status.error": "Помилка",
        "status.loading": "Завантаження...",
        "status.copied": "Скопійовано",
        "status.insufficient_funds": "Недостатньо коштів",

        // Модальні вікна
        "modal.confirm": "Підтвердити",
        "modal.cancel": "Скасувати",
        "modal.close": "Закрити",
        "modal.yes": "Так",
        "modal.no": "Ні",

        // Інше
        "contact_support": "Зв'язок з підтримкою"
    };

    // Англійська мова
    const DICTIONARY_EN = {
        // Загальні фрази
        "settings": "Settings",
        "edit_profile": "Edit profile",
        "language_selection": "Language selection",
        "app_settings": "App settings",
        "notifications": "Notifications",
        "security": "Security",
        "show_seed": "Show SID phrase",
        "coins": "Coins",
        "user_id": "ID:",

        // Загальне
        "app.name": "WINIX",
        "balance.tokens": "Tokens",
        "balance.jetons": "Jetons",
        "navigation.home": "Home",
        "navigation.earn": "Earn",
        "navigation.referrals": "Referrals",
        "navigation.wallet": "Wallet",
        "navigation.general": "General",

        // Навігація
        "home": "Home",
        "earn": "Earn",
        "referrals": "Referrals",
        "wallet": "Wallet",
        "general": "General",

        // Кнопки
        "btn_save": "Save",
        "btn_cancel": "Cancel",
        "btn_ok": "OK",

        // Модальні вікна
        "edit_profile_title": "Edit profile",
        "username": "Username:",
        "new_password": "New password:",
        "password_placeholder": "Leave empty if not changing",
        "confirm_password": "Confirm password:",
        "confirm_password_placeholder": "Confirm new password",
        "upload_avatar": "Upload avatar:",
        "select_avatar": "Or select avatar:",

        // Повідомлення
        "profile_updated": "Profile updated",
        "settings_saved": "Settings saved",
        "settings_error": "Settings error",
        "navigation_error": "Navigation error",
        "enter_username": "Enter username",
        "passwords_dont_match": "Passwords don't match",
        "min_8_chars": "Minimum 8 characters",
        "min_5_letters": "Minimum 5 letters",

        // SID фраза
        "seed_phrase": "SID Phrase",
        "your_seed_phrase": "Your SID Phrase",
        "save_seed": "Save it in a secure place!",
        "copy": "Copy",
        "done": "Done",
        "copied": "Copied",
        "copy_error": "Copy error",

        // Встановлення пароля
        "set_password": "Set password",
        "password_requirements": "Minimum 8 characters, 5 letters",
        "password": "Password",
        "confirm": "Confirm",
        "enter_password": "Enter password",
        "your_password": "Your password",
        "check": "Check",
        "wrong_password": "Wrong password",

        // Мови
        "language_uk": "Ukrainian",
        "language_en": "English",
        "language_ru": "Russian",

        // Сторінка заробітку (earn.html)
        "earn.daily_bonus": "Daily Bonus",
        "earn.social_networks": "Social Networks",
        "earn.get": "Get",
        "earn.subscribe": "Subscribe",
        "earn.verify": "Verify",
        "earn.referral_tasks": "Referral Tasks",
        "earn.invite_friends": "Invite friends",
        "earn.invite": "Invite friends",
        "earn.completed": "Completed",
        "earn.leaderboard": "Leaderboard",
        "earn.leaderboard.title": "Top 10 users with the most invited friends",
        "earn.friends_invited": "friends invited",
        "earn.referrals": "referrals",
        "earn.limited_tasks": "Time-limited Tasks",
        "earn.coming_soon": "Coming Soon",
        "earn.expect_new_tasks": "Limited tasks will be available soon. Don't miss the opportunity to receive additional rewards!",
        "earn.partners_tasks": "Partner Tasks",
        "earn.expect_partners": "Partner tasks will be available soon. Stay tuned for updates!",

        // Гаманець (wallet.html)
        "wallet.balance": "Balance $WINIX",
        "wallet.in_staking": "In staking:",
        "wallet.rewards": "Rewards:",
        "wallet.send": "Send",
        "wallet.receive": "Receive",
        "wallet.staking": "Staking",
        "wallet.recent_transactions": "Recent Transactions",
        "wallet.view_all": "View all",
        "wallet.welcome_bonus": "Welcome bonus",
        "wallet.staking_reward": "Staking reward",
        "wallet.staking_deposit": "Sent to staking",

        // Транзакції (transactions.html)
        "transactions.title": "Transaction History",
        "transactions.all": "All",
        "transactions.receive": "Receive",
        "transactions.send": "Send",
        "transactions.stake": "Stake",
        "transactions.unstake": "Unstake",
        "transactions.loading": "Loading transactions...",
        "transactions.details": "Transaction Details",
        "transactions.type": "Type:",
        "transactions.amount": "Amount:",
        "transactions.date": "Date:",
        "transactions.description": "Description:",
        "transactions.status": "Status:",
        "transactions.id": "ID:",
        "transactions.close": "Close",
        "transactions.received": "Received",
        "transactions.sent": "Sent",
        "transactions.staked": "Staked",
        "transactions.unstaked": "Unstaked",
        "transactions.completed": "Completed",
        "transactions.in_progress": "In progress",
        "transactions.failed": "Failed",

        // Отримання (receive.html)
        "receive.title": "Receive $WINIX",
        "receive.id": "Your ID for receiving:",
        "receive.copy_id": "Copy ID",
        "receive.how_to": "How to receive $WINIX",
        "receive.how_to_desc": "Share your ID with the sender to receive tokens. $WINIX can only be received within this app. After the transaction is confirmed, tokens will be automatically credited to your balance. Transactions are usually confirmed within a few minutes.",

        // Стейкінг (staking.html)
        "staking.title": "Staking",
        "staking.amount": "Enter amount of $WINIX",
        "staking.max": "Max",
        "staking.period_7": "7 days (4% profit)",
        "staking.period_14": "14 days (9% profit)",
        "staking.period_28": "28 days (15% profit)",
        "staking.expected_reward": "Expected reward:",
        "staking.stake_button": "Stake",
        "staking.details_button": "Staking details",
        "staking.cancel_button": "Cancel staking",
        "staking.none": "No active stakings at the moment",

        // Деталі стейкінгу (staking-details.html)
        "staking.details.title": "Staking Details",
        "staking.details.amount": "Staking amount",
        "staking.details.period": "Staking period",
        "staking.details.reward_percent": "Reward percentage",
        "staking.details.expected_reward": "Expected reward",
        "staking.details.days_left": "Days left",
        "staking.details.add": "Add to staking",
        "staking.details.add_amount": "Enter the amount to add to staking:",

        // Налаштування (general.html)
        "settings.title": "Settings",
        "settings.edit_profile": "Edit profile",
        "settings.language": "Language selection",
        "settings.lang.uk": "Ukrainian",
        "settings.lang.en": "English",
        "settings.lang.ru": "Russian",
        "settings.app_settings": "App settings",
        "settings.notifications": "Notifications",
        "settings.security": "Security",
        "settings.seed_phrase": "Show SID phrase",
        "settings.profile.username": "Username:",
        "settings.profile.new_password": "New password:",
        "settings.profile.confirm": "Confirm password:",
        "settings.profile.avatar": "Upload avatar:",
        "settings.profile.choose": "Or choose avatar:",
        "settings.profile.save": "Save",

        // Реферали (referrals.html)
        "referrals.title": "Referral Program",
        "referrals.link": "Loading link...",
        "referrals.copy": "Copy",
        "referrals.total": "Total referrals",
        "referrals.earned": "Earned $WINIX",
        "referrals.level1": "Level 1: Direct referrals",
        "referrals.level1.desc": "Receive 10% from the balance of direct referrals",
        "referrals.level2": "Level 2: Indirect referrals",
        "referrals.level2.desc": "Receive 5% from the balance of indirect referrals",
        "referrals.direct": "Your direct referrals (Level 1)",
        "referrals.indirect": "Indirect referrals (Level 2)",
        "referrals.no_referrals1": "You don't have Level 1 referrals yet",
        "referrals.no_referrals2": "You don't have Level 2 referrals yet",

        // Папка (folder.html)
        "folder.title": "Folder Details",
        "folder.add": "ADD FOLDER",
        "folder.verify": "Verify Subscription",

        // Статуси і повідомлення
        "status.success": "Success",
        "status.error": "Error",
        "status.loading": "Loading...",
        "status.copied": "Copied",
        "status.insufficient_funds": "Insufficient funds",

        // Модальні вікна
        "modal.confirm": "Confirm",
        "modal.cancel": "Cancel",
        "modal.close": "Close",
        "modal.yes": "Yes",
        "modal.no": "No",

        // Інше
        "contact_support": "Contact support"
    };

    // Російська мова
    const DICTIONARY_RU = {
        // Загальні фрази
        "settings": "Настройки",
        "edit_profile": "Редактировать профиль",
        "language_selection": "Выбор языка",
        "app_settings": "Настройки приложения",
        "notifications": "Уведомления",
        "security": "Безопасность",
        "show_seed": "Показать SID фразу",
        "coins": "Жетоны",
        "user_id": "ID:",

        // Загальне
        "app.name": "WINIX",
        "balance.tokens": "Токены",
        "balance.jetons": "Жетоны",
        "navigation.home": "Главная",
        "navigation.earn": "Заработок",
        "navigation.referrals": "Рефералы",
        "navigation.wallet": "Кошелек",
        "navigation.general": "Общее",

        // Навігація
        "home": "Home",
        "earn": "Earn",
        "referrals": "Referrals",
        "wallet": "Wallet",
        "general": "General",

        // Кнопки
        "btn_save": "Сохранить",
        "btn_cancel": "Отмена",
        "btn_ok": "OK",

        // Модальні вікна
        "edit_profile_title": "Редактировать профиль",
        "username": "Имя пользователя:",
        "new_password": "Новый пароль:",
        "password_placeholder": "Оставьте пустым, если не меняете",
        "confirm_password": "Подтверждение пароля:",
        "confirm_password_placeholder": "Подтвердите новый пароль",
        "upload_avatar": "Загрузить аватар:",
        "select_avatar": "Или выберите аватар:",

        // Повідомлення
        "profile_updated": "Профиль обновлен",
        "settings_saved": "Настройки сохранены",
        "settings_error": "Ошибка сохранения",
        "navigation_error": "Ошибка навигации",
        "enter_username": "Введите имя пользователя",
        "passwords_dont_match": "Пароли не совпадают",
        "min_8_chars": "Минимум 8 символов",
        "min_5_letters": "Минимум 5 букв",

        // SID фраза
        "seed_phrase": "SID Фраза",
        "your_seed_phrase": "Ваша SID Фраза",
        "save_seed": "Сохраните её в надежном месте!",
        "copy": "Скопировать",
        "done": "Готово",
        "copied": "Скопировано",
        "copy_error": "Ошибка копирования",

        // Встановлення пароля
        "set_password": "Установите пароль",
        "password_requirements": "Минимум 8 символов, 5 букв",
        "password": "Пароль",
        "confirm": "Подтверждение",
        "enter_password": "Введите пароль",
        "your_password": "Ваш пароль",
        "check": "Проверить",
        "wrong_password": "Неправильный пароль",

        // Мови
        "language_uk": "Украинский",
        "language_en": "Английский",
        "language_ru": "Русский",

        // Сторінка заробітку (earn.html)
        "earn.daily_bonus": "Ежедневный бонус",
        "earn.social_networks": "Социальные сети",
        "earn.get": "Получить",
        "earn.subscribe": "Подписаться",
        "earn.verify": "Проверить",
        "earn.referral_tasks": "Реферальные задания",
        "earn.invite_friends": "Пригласи друзей",
        "earn.invite": "Пригласить друзей",
        "earn.completed": "Выполнено",
        "earn.leaderboard": "Таблица лидеров",
        "earn.leaderboard.title": "Топ-10 пользователей с наибольшим количеством приглашенных друзей",
        "earn.friends_invited": "друзей приглашено",
        "earn.referrals": "рефералов",
        "earn.limited_tasks": "Ограниченные по времени задания",
        "earn.coming_soon": "Скоро",
        "earn.expect_new_tasks": "Ограниченные задания будут доступны в ближайшее время. Не упустите возможность получить дополнительные награды!",
        "earn.partners_tasks": "Партнерские задания",
        "earn.expect_partners": "Партнерские задания будут доступны в ближайшее время. Следите за обновлениями!",

        // Гаманець (wallet.html)
        "wallet.balance": "Баланс $WINIX",
        "wallet.in_staking": "В стейкинге:",
        "wallet.rewards": "Награды:",
        "wallet.send": "Отправить",
        "wallet.receive": "Получить",
        "wallet.staking": "Стейкинг",
        "wallet.recent_transactions": "Последние транзакции",
        "wallet.view_all": "Просмотреть все",
        "wallet.welcome_bonus": "Приветственный бонус",
        "wallet.staking_reward": "Награда за стейкинг",
        "wallet.staking_deposit": "Отправлено на стейкинг",

        // Транзакції (transactions.html)
        "transactions.title": "История транзакций",
        "transactions.all": "Все",
        "transactions.receive": "Получение",
        "transactions.send": "Отправка",
        "transactions.stake": "Стейкинг",
        "transactions.unstake": "Вывод из стейкинга",
        "transactions.loading": "Загрузка транзакций...",
        "transactions.details": "Детали транзакции",
        "transactions.type": "Тип:",
        "transactions.amount": "Сумма:",
        "transactions.date": "Дата:",
        "transactions.description": "Описание:",
        "transactions.status": "Статус:",
        "transactions.id": "ID:",
        "transactions.close": "Закрыть",
        "transactions.received": "Получено",
        "transactions.sent": "Отправлено",
        "transactions.staked": "Застейкано",
        "transactions.unstaked": "Выведено из стейкинга",
        "transactions.completed": "Завершено",
        "transactions.in_progress": "В обработке",
        "transactions.failed": "Не удалось",

        // Отримання (receive.html)
        "receive.title": "Получить $WINIX",
        "receive.id": "Ваш ID для получения:",
        "receive.copy_id": "Копировать ID",
        "receive.how_to": "Как получить $WINIX",
        "receive.how_to_desc": "Поделитесь своим ID с отправителем для получения токенов. $WINIX можно получать только внутри этого приложения. После подтверждения транзакции, токены будут автоматически зачислены на ваш баланс. Транзакции обычно подтверждаются в течение нескольких минут.",

        // Стейкінг (staking.html)
        "staking.title": "Стейкинг",
        "staking.amount": "Введите сумму $WINIX",
        "staking.max": "Макс",
        "staking.period_7": "7 дней (4% прибыли)",
        "staking.period_14": "14 дней (9% прибыли)",
        "staking.period_28": "28 дней (15% прибыли)",
        "staking.expected_reward": "Ожидаемая награда:",
        "staking.stake_button": "Стейкинг",
        "staking.details_button": "Детали стейкинга",
        "staking.cancel_button": "Отменить стейкинг",
        "staking.none": "Сейчас нет активных стейкингов",

        // Деталі стейкінгу (staking-details.html)
        "staking.details.title": "Детали стейкинга",
        "staking.details.amount": "Сумма стейкинга",
        "staking.details.period": "Период стейкинга",
        "staking.details.reward_percent": "Процент прибыли",
        "staking.details.expected_reward": "Ожидаемая награда",
        "staking.details.days_left": "Осталось дней",
        "staking.details.add": "Добавить к стейкингу",
        "staking.details.add_amount": "Введите сумму для добавления к стейкингу:",

        // Налаштування (general.html)
        "settings.title": "Настройки",
        "settings.edit_profile": "Редактировать профиль",
        "settings.language": "Выбор языка",
        "settings.lang.uk": "Украинский",
        "settings.lang.en": "Английский",
        "settings.lang.ru": "Русский",
        "settings.app_settings": "Настройки приложения",
        "settings.notifications": "Уведомления",
        "settings.security": "Безопасность",
        "settings.seed_phrase": "Показать SID фразу",
        "settings.profile.username": "Имя пользователя:",
        "settings.profile.new_password": "Новый пароль:",
        "settings.profile.confirm": "Подтверждение пароля:",
        "settings.profile.avatar": "Загрузить аватар:",
        "settings.profile.choose": "Или выберите аватар:",
        "settings.profile.save": "Сохранить",

        // Реферали (referrals.html)
        "referrals.title": "Реферальная программа",
        "referrals.link": "Загрузка ссылки...",
        "referrals.copy": "Копировать",
        "referrals.total": "Всего рефералов",
        "referrals.earned": "Заработано $WINIX",
        "referrals.level1": "Уровень 1: Прямые рефералы",
        "referrals.level1.desc": "Получайте 10% от баланса прямых рефералов",
        "referrals.level2": "Уровень 2: Непрямые рефералы",
        "referrals.level2.desc": "Получайте 5% от баланса непрямых рефералов",
        "referrals.direct": "Ваши прямые рефералы (Уровень 1)",
        "referrals.indirect": "Непрямые рефералы (Уровень 2)",
        "referrals.no_referrals1": "У вас ещё нет рефералов 1 уровня",
        "referrals.no_referrals2": "У вас ещё нет рефералов 2 уровня",

        // Папка (folder.html)
        "folder.title": "Детали папки",
        "folder.add": "ДОБАВИТЬ ПАПКУ",
        "folder.verify": "Проверить подписку",

        // Статуси і повідомлення
        "status.success": "Успешно",
        "status.error": "Ошибка",
        "status.loading": "Загрузка...",
        "status.copied": "Скопировано",
        "status.insufficient_funds": "Недостаточно средств",

        // Модальні вікна
        "modal.confirm": "Подтвердить",
        "modal.cancel": "Отменить",
        "modal.close": "Закрыть",
        "modal.yes": "Да",
        "modal.no": "Нет",

        // Інше
        "contact_support": "Связь с поддержкой"
    };

    // Система багатомовності
    window.WinixLanguage = {
        // Поточна мова
        currentLang: currentLanguage,

        // Словники для різних мов
        texts: {
            uk: DICTIONARY_UK,
            en: DICTIONARY_EN,
            ru: DICTIONARY_RU
        },

        // Отримання перекладу за ключем
        getText: function(key) {
            const langTexts = this.texts[this.currentLang];
            if (langTexts && langTexts[key]) {
                return langTexts[key];
            }

            // Якщо ключ не знайдений в поточній мові, спробуємо знайти в українській
            if (this.currentLang !== 'uk' && this.texts['uk'] && this.texts['uk'][key]) {
                return this.texts['uk'][key];
            }

            // Якщо ніде не знайдено, повертаємо ключ
            return key;
        },

        // Зміна мови
        changeLang: function(newLang) {
            if (!AVAILABLE_LANGUAGES.includes(newLang)) {
                console.error(`Мова ${newLang} не підтримується`);
                return false;
            }

            this.currentLang = newLang;
            localStorage.setItem('userLanguage', newLang);

            // Оновлюємо всі тексти на сторінці
            this.updatePageTexts();

            // Відправляємо подію про зміну мови
            document.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: newLang }
            }));

            console.log(`Мову змінено на ${newLang}`);
            return true;
        },

        // Оновлення всіх текстів на сторінці
        updatePageTexts: function() {
            // Оновлюємо елементи з атрибутом data-lang-key
            document.querySelectorAll('[data-lang-key]').forEach(element => {
                const key = element.getAttribute('data-lang-key');
                element.textContent = this.getText(key);
            });

            // Оновлюємо title сторінки, якщо потрібно
            updatePageTitle();
        },

        // Отримання списку доступних мов
        getSupportedLanguages: function() {
            return [...AVAILABLE_LANGUAGES];
        },

        // Отримання поточної мови
        getCurrentLanguage: function() {
            return this.currentLang;
        }
    };

    // Функція для оновлення заголовка сторінки
    function updatePageTitle() {
        // Визначаємо, яка сторінка відкрита
        const path = window.location.pathname;
        const pageName = path.split('/').pop().replace('.html', '');

        // Тайтл для різних сторінок
        let titleKey = '';

        switch (pageName) {
            case '':
            case 'index':
                titleKey = 'app.name';
                break;
            case 'wallet':
                titleKey = 'wallet.balance';
                break;
            case 'staking':
                titleKey = 'staking.title';
                break;
            case 'staking-details':
                titleKey = 'staking.details.title';
                break;
            case 'transactions':
                titleKey = 'transactions.title';
                break;
            case 'receive':
                titleKey = 'receive.title';
                break;
            case 'referrals':
                titleKey = 'referrals.title';
                break;
            case 'earn':
                titleKey = 'earn.daily_bonus';
                break;
            case 'general':
                titleKey = 'settings.title';
                break;
            default:
                titleKey = 'app.name';
        }

        // Змінюємо заголовок сторінки
        if (window.WinixLanguage && titleKey) {
            document.title = `WINIX - ${window.WinixLanguage.getText(titleKey)}`;
        }
    }

    // Оновлюємо тексти після завантаження DOM
    document.addEventListener('DOMContentLoaded', function() {
        window.WinixLanguage.updatePageTexts();
    });

    // Автоматично підв'язуємося до події зміни мови
    document.addEventListener('languageChanged', function(event) {
        // Оновлюємо активні кнопки вибору мови
        const lang = event.detail.language;
        document.querySelectorAll('.language-option').forEach(option => {
            option.classList.toggle('active', option.getAttribute('data-lang') === lang);
        });
    });

    console.log(`🌐 Система багатомовності ініціалізована. Поточна мова: ${currentLanguage}`);
})();