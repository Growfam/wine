import logging
import os
import sys

# Додаємо шляхи до системного шляху пошуку
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(parent_dir)

# Додаємо всі можливі шляхи для імпорту
paths_to_add = [
    current_dir,
    parent_dir,
    root_dir,
    os.path.join(root_dir, 'backend'),
    os.path.join(parent_dir, 'controllers')
]

for path in paths_to_add:
    if os.path.exists(path) and path not in sys.path:
        sys.path.append(path)

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')

from referrals.controllers.referral_controller import ReferralController
from referrals.controllers.bonus_controller import BonusController
from referrals.controllers.earnings_controller import EarningsController
from referrals.controllers.activity_controller import ActivityController
from referrals.controllers.analytics_controller import AnalyticsController
from referrals.controllers.draw_controller import DrawController
from referrals.controllers.history_controller import HistoryController

# Для зручного імпорту контролерів
__all__ = [
    'ReferralController',
    'BonusController',
    'EarningsController',
    'ActivityController',
    'AnalyticsController',
    'DrawController',
    'HistoryController'
]