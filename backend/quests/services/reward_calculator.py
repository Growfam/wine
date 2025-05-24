"""
Сервіс розрахунку винагород для системи завдань WINIX
Логіка обчислення щоденних бонусів, множників та прогресивних винагород
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from ..models.transaction import TransactionAmount as Reward
from ..models.daily_bonus import get_daily_bonus_constants

logger = logging.getLogger(__name__)


class RewardCalculator:
    """Калькулятор винагород"""

    def __init__(self):
        self.constants = get_daily_bonus_constants()

        # Базові налаштування
        self.base_winix = self.constants["BASE_WINIX_REWARD"]
        self.special_days = self.constants["SPECIAL_DAYS"]
        self.tickets_days = self.constants["TICKETS_DAYS"]
        self.max_days = self.constants["MAX_DAYS"]

        # Прогресивні множники
        self.progressive_multipliers = {
            1: 1.0,  # День 1: 20 WINIX
            2: 1.1,  # День 2: 22 WINIX
            3: 1.2,  # День 3: 24 WINIX
            4: 1.3,  # День 4: 26 WINIX
            5: 1.4,  # День 5: 28 WINIX
            6: 1.5,  # День 6: 30 WINIX
            7: 2.0,  # День 7: 40 WINIX + 1 ticket (спеціальний)
            8: 1.6,  # День 8: 32 WINIX
            9: 1.7,  # День 9: 34 WINIX
            10: 1.8,  # День 10: 36 WINIX
            11: 1.9,  # День 11: 38 WINIX
            12: 2.0,  # День 12: 40 WINIX
            13: 2.1,  # День 13: 42 WINIX
            14: 2.5,  # День 14: 50 WINIX + 2 tickets (спеціальний)
            15: 2.2,  # День 15: 44 WINIX
            16: 2.3,  # День 16: 46 WINIX
            17: 2.4,  # День 17: 48 WINIX
            18: 2.5,  # День 18: 50 WINIX
            19: 2.6,  # День 19: 52 WINIX
            20: 2.7,  # День 20: 54 WINIX
            21: 3.0,  # День 21: 60 WINIX + 3 tickets (спеціальний)
            22: 2.8,  # День 22: 56 WINIX
            23: 2.9,  # День 23: 58 WINIX
            24: 3.0,  # День 24: 60 WINIX
            25: 3.1,  # День 25: 62 WINIX
            26: 3.2,  # День 26: 64 WINIX
            27: 3.3,  # День 27: 66 WINIX
            28: 4.0,  # День 28: 80 WINIX + 5 tickets (спеціальний)
            29: 3.5,  # День 29: 70 WINIX
            30: 5.0  # День 30: 100 WINIX + 10 tickets (фінальний)
        }

        # Спеціальні винагороди для tickets
        self.tickets_rewards = {
            7: 1,  # 1 ticket на 7 день
            14: 2,  # 2 tickets на 14 день
            21: 3,  # 3 tickets на 21 день
            28: 5,  # 5 tickets на 28 день
            30: 10  # 10 tickets на 30 день (бонус)
        }

        logger.info("RewardCalculator ініціалізовано")
        logger.info(f"Базова винагорода: {self.base_winix} WINIX")
        logger.info(f"Спеціальні дні: {self.special_days}")
        logger.info(f"Дні з tickets: {list(self.tickets_rewards.keys())}")

    def calculate_daily_bonus(self, day_number: int, current_streak: int = 0,
                              user_level: int = 1, bonus_multiplier: float = 1.0) -> Reward:
        """
        Розрахунок щоденного бонусу

        Args:
            day_number: Номер дня (1-30)
            current_streak: Поточна серія
            user_level: Рівень користувача
            bonus_multiplier: Додатковий множник

        Returns:
            Reward об'єкт з винагородою
        """
        try:
            logger.info(f"=== РОЗРАХУНОК ЩОДЕННОГО БОНУСУ ===")
            logger.info(f"День: {day_number}, серія: {current_streak}, рівень: {user_level}")

            # Валідація вхідних даних
            day_number = max(1, min(day_number, self.max_days))
            current_streak = max(0, current_streak)
            user_level = max(1, user_level)
            bonus_multiplier = max(0.1, bonus_multiplier)

            # Базова винагорода WINIX
            base_multiplier = self.progressive_multipliers.get(day_number, 1.0)
            winix_amount = int(self.base_winix * base_multiplier)

            # Бонус за серію (до 50% додатково за довгу серію)
            streak_bonus = min(0.5, current_streak * 0.02)  # 2% за кожен день серії
            winix_amount = int(winix_amount * (1 + streak_bonus))

            # Бонус за рівень користувача (1% за рівень понад 1)
            level_bonus = (user_level - 1) * 0.01
            winix_amount = int(winix_amount * (1 + level_bonus))

            # Застосовуємо додатковий множник
            winix_amount = int(winix_amount * bonus_multiplier)

            # Tickets для спеціальних днів
            tickets_amount = self.tickets_rewards.get(day_number, 0)

            # Створюємо винагороду
            reward = Reward(
                winix=winix_amount,
                tickets=tickets_amount,
                flex=0
            )

            logger.info(f"Розрахована винагорода: {reward.to_dict()}")
            logger.info(
                f"Множники: base={base_multiplier}, streak={streak_bonus:.2f}, level={level_bonus:.2f}, bonus={bonus_multiplier}")

            return reward

        except Exception as e:
            logger.error(f"Помилка розрахунку щоденного бонусу: {e}", exc_info=True)
            # Повертаємо мінімальну винагороду у випадку помилки
            return Reward(winix=self.base_winix, tickets=0, flex=0)

    def get_reward_preview(self, start_day: int = 1, end_day: int = 30,
                           user_level: int = 1) -> List[Dict[str, Any]]:
        """
        Отримання попереднього перегляду винагород

        Args:
            start_day: Початковий день
            end_day: Кінцевий день
            user_level: Рівень користувача

        Returns:
            Список винагород по днях
        """
        try:
            preview = []

            for day in range(start_day, min(end_day + 1, self.max_days + 1)):
                reward = self.calculate_daily_bonus(
                    day_number=day,
                    current_streak=day,  # Припускаємо безперервну серію
                    user_level=user_level
                )

                is_special = day in self.special_days
                is_final = day == self.max_days

                day_info = {
                    "day": day,
                    "reward": reward.to_dict(),
                    "is_special": is_special,
                    "is_final": is_final,
                    "multiplier": self.progressive_multipliers.get(day, 1.0),
                    "description": self._get_day_description(day, reward, is_special, is_final)
                }

                preview.append(day_info)

            logger.info(f"Створено попередній перегляд для днів {start_day}-{end_day}")
            return preview

        except Exception as e:
            logger.error(f"Помилка створення попереднього перегляду: {e}")
            return []

    def _get_day_description(self, day: int, reward: Reward,
                             is_special: bool, is_final: bool) -> str:
        """Отримання опису дня"""
        if is_final:
            return f"🎉 Фінальний день! {reward.winix} WINIX + {reward.tickets} tickets"
        elif is_special:
            return f"⭐ Спеціальний день! {reward.winix} WINIX + {reward.tickets} tickets"
        else:
            return f"📅 День {day}: {reward.winix} WINIX"

    def calculate_streak_bonus(self, streak_length: int) -> float:
        """
        Розрахунок бонусу за серію

        Args:
            streak_length: Довжина серії

        Returns:
            Множник бонусу (0.0 - 0.5)
        """
        return min(0.5, streak_length * 0.02)

    def calculate_level_bonus(self, user_level: int) -> float:
        """
        Розрахунок бонусу за рівень

        Args:
            user_level: Рівень користувача

        Returns:
            Множник бонусу
        """
        return (user_level - 1) * 0.01

    def get_total_month_reward(self, user_level: int = 1) -> Dict[str, Any]:
        """
        Розрахунок загальної винагороди за місяць

        Args:
            user_level: Рівень користувача

        Returns:
            Інформація про загальну винагороду
        """
        try:
            total_winix = 0
            total_tickets = 0

            for day in range(1, self.max_days + 1):
                reward = self.calculate_daily_bonus(
                    day_number=day,
                    current_streak=day,
                    user_level=user_level
                )
                total_winix += reward.winix
                total_tickets += reward.tickets

            return {
                "total_winix": total_winix,
                "total_tickets": total_tickets,
                "total_value_winix_equivalent": total_winix + (total_tickets * 100),
                "average_daily_winix": total_winix // self.max_days,
                "special_days_count": len(self.special_days),
                "perfect_streak_required": True
            }

        except Exception as e:
            logger.error(f"Помилка розрахунку місячної винагороди: {e}")
            return {
                "total_winix": 0,
                "total_tickets": 0,
                "error": str(e)
            }

    def validate_claim_eligibility(self, last_claim_timestamp: Optional[int],
                                   current_timestamp: Optional[int] = None) -> Dict[str, Any]:
        """
        Перевірка можливості отримання бонусу

        Args:
            last_claim_timestamp: Timestamp останнього отримання
            current_timestamp: Поточний timestamp

        Returns:
            Інформація про можливість отримання
        """
        try:
            if current_timestamp is None:
                current_timestamp = int(datetime.now(timezone.utc).timestamp())

            if last_claim_timestamp is None:
                return {
                    "can_claim": True,
                    "reason": "first_claim",
                    "hours_remaining": 0,
                    "next_available": current_timestamp
                }

            # Мінімум 20 годин між отриманнями
            min_hours = self.constants["MIN_HOURS_BETWEEN_CLAIMS"]
            min_seconds = min_hours * 3600

            time_since_last = current_timestamp - last_claim_timestamp

            if time_since_last >= min_seconds:
                return {
                    "can_claim": True,
                    "reason": "time_passed",
                    "hours_since_last": time_since_last / 3600,
                    "next_available": current_timestamp
                }
            else:
                remaining_seconds = min_seconds - time_since_last
                hours_remaining = remaining_seconds / 3600
                next_available = last_claim_timestamp + min_seconds

                return {
                    "can_claim": False,
                    "reason": "too_early",
                    "hours_remaining": hours_remaining,
                    "next_available": next_available
                }

        except Exception as e:
            logger.error(f"Помилка перевірки можливості отримання: {e}")
            return {
                "can_claim": False,
                "reason": "error",
                "error": str(e)
            }

    def calculate_optimal_claim_times(self, timezone_offset: int = 0) -> List[Dict[str, Any]]:
        """
        Розрахунок оптимальних часів для отримання бонусів

        Args:
            timezone_offset: Зміщення часового поясу в годинах

        Returns:
            Список оптимальних часів
        """
        try:
            optimal_times = []

            # Рекомендовані часи (UTC)
            recommended_hours = [6, 12, 18, 22]  # 6:00, 12:00, 18:00, 22:00

            for hour in recommended_hours:
                local_hour = (hour + timezone_offset) % 24
                optimal_times.append({
                    "utc_hour": hour,
                    "local_hour": local_hour,
                    "description": self._get_time_description(local_hour)
                })

            return optimal_times

        except Exception as e:
            logger.error(f"Помилка розрахунку оптимальних часів: {e}")
            return []

    def _get_time_description(self, hour: int) -> str:
        """Опис часу"""
        if 5 <= hour <= 11:
            return "🌅 Ранок - хороший початок дня!"
        elif 12 <= hour <= 17:
            return "☀️ День - обідня перерва!"
        elif 18 <= hour <= 22:
            return "🌆 Вечір - час відпочинку!"
        else:
            return "🌙 Ніч - для нічних сов!"

    def get_calculator_stats(self) -> Dict[str, Any]:
        """Отримання статистики калькулятора"""
        return {
            "base_winix_reward": self.base_winix,
            "max_days": self.max_days,
            "special_days_count": len(self.special_days),
            "tickets_days_count": len(self.tickets_rewards),
            "min_hours_between_claims": self.constants["MIN_HOURS_BETWEEN_CLAIMS"],
            "max_streak_bonus": "50%",
            "level_bonus_per_level": "1%",
            "total_possible_winix": sum(
                self.calculate_daily_bonus(day, day, 1).winix
                for day in range(1, self.max_days + 1)
            ),
            "total_possible_tickets": sum(self.tickets_rewards.values())
        }


# Глобальний калькулятор
reward_calculator = RewardCalculator()


def calculate_daily_reward(day_number: int, current_streak: int = 0,
                           user_level: int = 1, bonus_multiplier: float = 1.0) -> Reward:
    """Зручна функція для розрахунку щоденної винагороди"""
    return reward_calculator.calculate_daily_bonus(
        day_number, current_streak, user_level, bonus_multiplier
    )


def get_reward_preview_for_user(user_level: int = 1) -> List[Dict[str, Any]]:
    """Зручна функція для отримання попереднього перегляду"""
    return reward_calculator.get_reward_preview(user_level=user_level)


def validate_daily_claim(last_claim_timestamp: Optional[int]) -> Dict[str, Any]:
    """Зручна функція для перевірки можливості отримання"""
    return reward_calculator.validate_claim_eligibility(last_claim_timestamp)


# Експорт
__all__ = [
    'RewardCalculator',
    'reward_calculator',
    'calculate_daily_reward',
    'get_reward_preview_for_user',
    'validate_daily_claim'
]