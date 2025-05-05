"""
Модуль з виключеннями для реферальної системи.
"""

class ReferralException(Exception):
    """Базове виключення для реферальної системи"""
    def __init__(self, message, code=None, details=None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(self.message)


class InvalidReferralCodeException(ReferralException):
    """Виключення для невалідного реферального коду"""
    def __init__(self, code, details=None):
        super().__init__(f"Невалідний реферальний код: {code}", code="invalid_code", details=details)


class ReferralAlreadyExistsException(ReferralException):
    """Виключення, коли реферальний запис вже існує"""
    def __init__(self, referee_id, details=None):
        super().__init__(f"Реферальний запис для користувача {referee_id} вже існує",
                         code="referral_exists", details=details)


class SelfReferralException(ReferralException):
    """Виключення при спробі запросити самого себе"""
    def __init__(self, user_id, details=None):
        super().__init__(f"Користувач {user_id} не може запросити сам себе",
                         code="self_referral", details=details)


class ReferralRewardAlreadyPaidException(ReferralException):
    """Виключення, коли винагорода вже була виплачена"""
    def __init__(self, referral_id, details=None):
        super().__init__(f"Винагорода за реферальний запис {referral_id} вже виплачена",
                         code="reward_already_paid", details=details)


class ReferralTaskAlreadyClaimedException(ReferralException):
    """Виключення, коли винагорода за завдання вже була отримана"""
    def __init__(self, task_id, details=None):
        super().__init__(f"Винагорода за реферальне завдання {task_id} вже отримана",
                         code="task_already_claimed", details=details)


class ReferralTaskNotCompletedException(ReferralException):
    """Виключення, коли завдання не виконане"""
    def __init__(self, task_id, current, required, details=None):
        super().__init__(f"Недостатньо рефералів для завершення завдання {task_id}. " 
                         f"Потрібно {required}, наявно {current}",
                         code="task_not_completed", details=details)