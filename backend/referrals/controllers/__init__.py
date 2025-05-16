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