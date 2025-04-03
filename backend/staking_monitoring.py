import logging
import time
from supabase_client import get_user

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='staking_monitor.log')

logger = logging.getLogger(__name__)


def monitor_stakings(telegram_id):
    """Моніторинг стану стейкінгу"""
    user = get_user(telegram_id)
    if not user:
        logger.error(f"Користувача {telegram_id} не знайдено")
        return

    staking_data = user.get("staking_data", {})

    logger.info(f"Стан стейкінгу для {telegram_id}: " +
                f"hasActiveStaking={staking_data.get('hasActiveStaking')}, " +
                f"status={staking_data.get('status')}, " +
                f"stakingAmount={staking_data.get('stakingAmount')}")

    return staking_data

# Використання:
# Додайте виклик цієї функції з ID користувача для моніторингу
# monitor_stakings('7866583465')