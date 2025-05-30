"""
Сервіс розрахунку винагород для системи завдань WINIX
Логіка обчислення щоденних бонусів з новою формулою та рандомізацією білетів
"""

import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timezone
import hashlib
import random

from ..models.transaction import TransactionAmount as Reward
from ..models.daily_bonus import get_daily_bonus_constants

logger = logging.getLogger(__name__)


class RewardCalculator:
    """Калькулятор винагород з новою системою"""

    def __init__(self):
        self.constants = get_daily_bonus_constants()

        # Базові налаштування
        self.max_days = 30
        self.base_winix = 100  # Початкова винагорода
        self.winix_increment = 60  # Приріст на день (100 + (день-1) * 60)

        # Налаштування білетів
        self.tickets_per_week = 3  # Кількість днів з білетами на тиждень
        self.min_tickets = 1  # Мінімум білетів за раз
        self.max_tickets = 5  # Максимум білетів за раз
        self.monthly_tickets_limit = 40  # Максимум білетів на місяць

        logger.info("RewardCalculator ініціалізовано з новою системою винагород")

    def calculate_daily_bonus(self, user_id: int, day_number: int, current_streak: int = 0,
                              user_level: int = 1, bonus_multiplier: float = 1.0) -> Reward:
        """
        Розрахунок щоденного бонусу

        Args:
            user_id: ID користувача (для генерації детермінованих білетів)
            day_number: Номер дня (1-30)
            current_streak: Поточна серія
            user_level: Рівень користувача (не використовується в новій системі)
            bonus_multiplier: Додатковий множник (не використовується)

        Returns:
            Reward об'єкт з винагородою
        """
        try:
            logger.info(f"=== РОЗРАХУНОК ЩОДЕННОГО БОНУСУ ===")
            logger.info(f"User ID: {user_id}, День: {day_number}, серія: {current_streak}")

            # Валідація вхідних даних
            day_number = max(1, min(day_number, self.max_days))
            current_streak = max(0, current_streak)

            # Розрахунок WINIX за новою формулою: 100 + (день - 1) × 60
            winix_amount = self.base_winix + (day_number - 1) * self.winix_increment

            # Розрахунок білетів
            tickets_amount = self._calculate_tickets_for_day(user_id, day_number)

            # Створюємо винагороду
            reward = Reward(
                winix=int(winix_amount),
                tickets=tickets_amount,
                flex=0
            )

            logger.info(f"Розрахована винагорода: {reward.to_dict()}")

            return reward

        except Exception as e:
            logger.error(f"Помилка розрахунку щоденного бонусу: {e}", exc_info=True)
            # Повертаємо мінімальну винагороду у випадку помилки
            return Reward(winix=self.base_winix, tickets=0, flex=0)

    def _calculate_tickets_for_day(self, user_id: int, day_number: int) -> int:
        """
        Розраховує кількість білетів для конкретного дня користувача
        Використовує детерміновану рандомізацію на основі user_id

        Args:
            user_id: ID користувача
            day_number: Номер дня (1-30)

        Returns:
            Кількість білетів (0-5)
        """
        # Генеруємо детермінований seed для користувача
        # Додаємо поточний місяць та рік для унікальності кожного місяця
        now = datetime.now(timezone.utc)
        seed_string = f"{user_id}_{now.year}_{now.month}"
        seed_hash = int(hashlib.md5(seed_string.encode()).hexdigest(), 16)

        # Ініціалізуємо генератор з детермінованим seed
        rng = random.Random(seed_hash)

        # Генеруємо розподіл білетів для всього місяця
        ticket_days = self._generate_ticket_days(rng)

        # Генеруємо кількості білетів для кожного дня
        ticket_amounts = self._generate_ticket_amounts(rng, ticket_days)

        # Повертаємо кількість білетів для конкретного дня
        return ticket_amounts.get(day_number, 0)

    def _generate_ticket_days(self, rng: random.Random) -> Set[int]:
        """
        Генерує дні, коли будуть видані білети

        Args:
            rng: Ініціалізований генератор випадкових чисел

        Returns:
            Set з номерами днів
        """
        ticket_days = set()

        # Розбиваємо місяць на тижні
        weeks = [
            (1, 7),    # Тиждень 1
            (8, 14),   # Тиждень 2
            (15, 21),  # Тиждень 3
            (22, 28),  # Тиждень 4
            (29, 30)   # Останні дні
        ]

        # Для кожного повного тижня вибираємо 3 рандомні дні
        for start, end in weeks[:4]:  # Перші 4 тижні
            week_days = list(range(start, end + 1))
            selected_days = rng.sample(week_days, min(self.tickets_per_week, len(week_days)))
            ticket_days.update(selected_days)

        # Для останніх днів (29-30) вибираємо 1 день
        if rng.random() < 0.5:  # 50% шанс
            ticket_days.add(rng.choice([29, 30]))

        return ticket_days

    def _generate_ticket_amounts(self, rng: random.Random, ticket_days: Set[int]) -> Dict[int, int]:
        """
        Генерує кількості білетів для кожного дня з обмеженням 40 білетів на місяць

        Args:
            rng: Ініціалізований генератор випадкових чисел
            ticket_days: Дні, коли видаються білети

        Returns:
            Dict з кількістю білетів для кожного дня
        """
        ticket_amounts = {}
        total_tickets = 0

        # Сортуємо дні для послідовного розподілу
        sorted_days = sorted(ticket_days)

        for i, day in enumerate(sorted_days):
            # Розраховуємо залишок білетів
            remaining_tickets = self.monthly_tickets_limit - total_tickets
            remaining_days = len(sorted_days) - i

            if remaining_tickets <= 0:
                ticket_amounts[day] = 0
                continue

            # Розраховуємо максимум для цього дня
            max_for_day = min(
                self.max_tickets,
                remaining_tickets,
                remaining_tickets - (remaining_days - 1)  # Залишаємо хоча б 1 білет на кожен день
            )

            # Генеруємо кількість білетів
            if remaining_days == 1:
                # Останній день - даємо всі залишки
                amount = min(remaining_tickets, self.max_tickets)
            else:
                # Рандомна кількість в межах дозволеного
                min_amount = max(1, self.min_tickets)
                max_amount = max(min_amount, min(max_for_day, self.max_tickets))
                amount = rng.randint(min_amount, max_amount)

            ticket_amounts[day] = amount
            total_tickets += amount

        return ticket_amounts

    def get_reward_preview(self, user_id: int, start_day: int = 1, end_day: int = 30,
                           user_level: int = 1) -> List[Dict[str, Any]]:
        """
        Отримання попереднього перегляду винагород

        Args:
            user_id: ID користувача
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
                    user_id=user_id,
                    day_number=day,
                    current_streak=day,  # Припускаємо безперервну серію
                    user_level=user_level
                )

                is_special = False  # Більше немає спеціальних днів
                is_final = day == self.max_days

                day_info = {
                    "day": day,
                    "reward": reward.to_dict(),
                    "is_special": is_special,
                    "is_final": is_final,
                    "multiplier": 1.0,
                    "description": self._get_day_description(day, reward, is_special, is_final)
                }

                preview.append(day_info)

            logger.info(f"Створено попередній перегляд для користувача {user_id}, днів {start_day}-{end_day}")
            return preview

        except Exception as e:
            logger.error(f"Помилка створення попереднього перегляду: {e}")
            return []

    def _get_day_description(self, day: int, reward: Reward,
                             is_special: bool, is_final: bool) -> str:
        """Отримання опису дня"""
        if is_final:
            return f"🎉 Фінальний день! {reward.winix} WINIX"
        elif reward.tickets > 0:
            return f"🎟️ День {day}: {reward.winix} WINIX + {reward.tickets} tickets"
        else:
            return f"📅 День {day}: {reward.winix} WINIX"

    def calculate_streak_bonus(self, streak_length: int) -> float:
        """
        Розрахунок бонусу за серію (не використовується в новій системі)

        Args:
            streak_length: Довжина серії

        Returns:
            Множник бонусу (завжди 0 в новій системі)
        """
        return 0.0  # Немає бонусів за серію в новій системі

    def calculate_level_bonus(self, user_level: int) -> float:
        """
        Розрахунок бонусу за рівень (не використовується в новій системі)

        Args:
            user_level: Рівень користувача

        Returns:
            Множник бонусу (завжди 0 в новій системі)
        """
        return 0.0  # Немає бонусів за рівень в новій системі

    def get_total_month_reward(self, user_id: int, user_level: int = 1) -> Dict[str, Any]:
        """
        Розрахунок загальної винагороди за місяць

        Args:
            user_id: ID користувача
            user_level: Рівень користувача

        Returns:
            Інформація про загальну винагороду
        """
        try:
            total_winix = 0
            total_tickets = 0

            for day in range(1, self.max_days + 1):
                reward = self.calculate_daily_bonus(
                    user_id=user_id,
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
                "special_days_count": 0,  # Немає спеціальних днів
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

    def get_calculator_stats(self) -> Dict[str, Any]:
        """Отримання статистики калькулятора"""
        # Розраховуємо загальну суму WINIX за формулою
        total_winix = sum(self.base_winix + (day - 1) * self.winix_increment for day in range(1, 31))

        return {
            "base_winix_reward": self.base_winix,
            "winix_increment_per_day": self.winix_increment,
            "max_days": self.max_days,
            "special_days_count": 0,
            "tickets_per_week": self.tickets_per_week,
            "min_tickets_per_reward": self.min_tickets,
            "max_tickets_per_reward": self.max_tickets,
            "monthly_tickets_limit": self.monthly_tickets_limit,
            "min_hours_between_claims": self.constants["MIN_HOURS_BETWEEN_CLAIMS"],
            "streak_policy": "RESET_TO_DAY_1",
            "total_possible_winix": total_winix,
            "total_possible_tickets": self.monthly_tickets_limit
        }


# Глобальний калькулятор
reward_calculator = RewardCalculator()


def calculate_daily_reward(user_id: int, day_number: int, current_streak: int = 0,
                           user_level: int = 1, bonus_multiplier: float = 1.0) -> Reward:
    """Зручна функція для розрахунку щоденної винагороди"""
    return reward_calculator.calculate_daily_bonus(
        user_id, day_number, current_streak, user_level, bonus_multiplier
    )


def get_reward_preview_for_user(user_id: int, user_level: int = 1) -> List[Dict[str, Any]]:
    """Зручна функція для отримання попереднього перегляду"""
    return reward_calculator.get_reward_preview(user_id, user_level=user_level)


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