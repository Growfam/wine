from backend.referrals.controllers.referral_controller import ReferralController
from backend.referrals.controllers.bonus_controller import BonusController
from backend.referrals.controllers.earnings_controller import EarningsController
from backend.referrals.controllers.activity_controller import ActivityController
from backend.referrals.controllers.analytics_controller import AnalyticsController
from backend.referrals.controllers.draw_controller import DrawController
from backend.referrals.controllers.history_controller import HistoryController

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