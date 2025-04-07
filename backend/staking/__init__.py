"""
Модуль для управління стейкінгом.
Забезпечує функціональність для створення, зміни та скасування стейкінгу.
"""

# Імпортуємо для зручності використання модуля
from .services import (
    check_active_staking,
    create_staking,
    add_to_staking,
    cancel_staking,
    finalize_staking,
    get_staking_history,
    calculate_staking_reward,
    reset_and_repair_staking,
    deep_repair_staking
)

from .controllers import (
    get_user_staking,
    create_user_staking,
    update_user_staking,
    add_to_staking as add_to_staking_controller,
    cancel_user_staking,
    finalize_user_staking,
    get_user_staking_history,
    calculate_staking_reward_api,
    repair_user_staking,
    reset_and_repair_staking as reset_repair_controller,
    deep_repair_user_staking
)

# Для сумісності з існуючим кодом
from .utils import (
    calculate_staking_reward as utils_calculate_reward,
    STAKING_REWARD_RATES,
    STAKING_CANCELLATION_FEE
)