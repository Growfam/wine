# Імпортуємо всі моделі для зручного використання
from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from models.activity import ReferralActivity
from models.badge import UserBadge
from models.task import UserTask
from models.draw import Draw, DrawParticipant


# Функція для ініціалізації моделей бази даних
def init_db(app, db):
    """
    Ініціалізація моделей бази даних

    Args:
        app: Екземпляр Flask-додатку
        db: Екземпляр SQLAlchemy
    """
    with app.app_context():
        # Створення всіх таблиць бази даних
        db.create_all()