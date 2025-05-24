"""
Система логування та моніторингу для WINIX
Структуроване логування, метрики, алерти та моніторинг
"""

import os
import sys
import json
import time
import logging
import asyncio
import threading
import functools
import traceback
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Callable, Union
from dataclasses import dataclass, asdict, field
from enum import Enum
from collections import defaultdict, deque
import uuid
from pathlib import Path

# Імпорти для метрик
try:
    import psutil

    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


class LogLevel(Enum):
    """Рівні логування"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class EventType(Enum):
    """Типи подій для моніторингу"""
    REQUEST = "request"
    RESPONSE = "response"
    ERROR = "error"
    SECURITY = "security"
    PERFORMANCE = "performance"
    BUSINESS = "business"
    SYSTEM = "system"
    DATABASE = "database"
    CACHE = "cache"
    EXTERNAL_API = "external_api"
    USER_ACTION = "user_action"


class AlertSeverity(Enum):
    """Рівні критичності алертів"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class LogEntry:
    """Структурований запис лога"""
    timestamp: str
    level: str
    message: str
    logger_name: str
    event_type: EventType
    context: Dict[str, Any] = field(default_factory=dict)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    duration: Optional[float] = None
    status_code: Optional[int] = None
    error_type: Optional[str] = None
    stack_trace: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str, ensure_ascii=False)


@dataclass
class MetricData:
    """Дані метрики"""
    name: str
    value: Union[int, float]
    timestamp: float
    tags: Dict[str, str] = field(default_factory=dict)
    metric_type: str = "gauge"  # gauge, counter, histogram

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Alert:
    """Алерт системи"""
    id: str
    title: str
    message: str
    severity: AlertSeverity
    event_type: EventType
    timestamp: datetime
    context: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        data['severity'] = self.severity.value
        data['event_type'] = self.event_type.value
        if self.resolved_at:
            data['resolved_at'] = self.resolved_at.isoformat()
        return data


class StructuredLogger:
    """Структурований логгер"""

    def __init__(self, name: str, level: LogLevel = LogLevel.INFO):
        self.name = name
        self.level = level
        self._setup_logger()

        # Контекст логгера
        self.context: Dict[str, Any] = {}

        # Буфер для batch logging
        self.log_buffer: deque = deque(maxlen=1000)
        self.buffer_lock = threading.Lock()

        # Запускаємо flush task
        self._start_flush_task()

    def _setup_logger(self):
        """Налаштування Python логгера"""
        self.logger = logging.getLogger(self.name)
        self.logger.setLevel(getattr(logging, self.level.value))

        # Видаляємо існуючі handlers
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)

        # Налаштовуємо форматер
        formatter = self._create_formatter()

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)

        # File handler
        log_file = os.getenv('LOG_FILE', f'logs/{self.name}.log')
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)

        # Error file handler
        error_file = os.getenv('ERROR_LOG_FILE', f'logs/{self.name}_errors.log')
        error_handler = logging.FileHandler(error_file, encoding='utf-8')
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        self.logger.addHandler(error_handler)

    def _create_formatter(self) -> logging.Formatter:
        """Створити форматер"""
        log_format = os.getenv('LOG_FORMAT', 'json')

        if log_format == 'json':
            return JSONFormatter()
        else:
            format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            return logging.Formatter(format_string)

    def set_context(self, **kwargs):
        """Встановити контекст для всіх логів"""
        self.context.update(kwargs)

    def clear_context(self):
        """Очистити контекст"""
        self.context.clear()

    def log(self, level: LogLevel, message: str, event_type: EventType = EventType.SYSTEM,
            **kwargs):
        """Основний метод логування"""

        # Збираємо контекст
        context = {**self.context, **kwargs.get('context', {})}

        # Створюємо запис
        entry = LogEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            level=level.value,
            message=message,
            logger_name=self.name,
            event_type=event_type,
            context=context,
            **{k: v for k, v in kwargs.items() if k != 'context'}
        )

        # Логуємо через Python logger
        log_method = getattr(self.logger, level.value.lower())

        # Формуємо повідомлення
        if context:
            full_message = f"{message} | Context: {json.dumps(context, default=str)}"
        else:
            full_message = message

        log_method(full_message, extra=entry.to_dict())

        # Додаємо в буфер для batch processing
        with self.buffer_lock:
            self.log_buffer.append(entry)

    def debug(self, message: str, **kwargs):
        """Debug лог"""
        self.log(LogLevel.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        """Info лог"""
        self.log(LogLevel.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        """Warning лог"""
        self.log(LogLevel.WARNING, message, **kwargs)

    def error(self, message: str, exception: Optional[Exception] = None, **kwargs):
        """Error лог"""
        if exception:
            kwargs['error_type'] = type(exception).__name__
            kwargs['stack_trace'] = traceback.format_exc()

        self.log(LogLevel.ERROR, message, event_type=EventType.ERROR, **kwargs)

    def critical(self, message: str, **kwargs):
        """Critical лог"""
        self.log(LogLevel.CRITICAL, message, **kwargs)

    def request(self, method: str, endpoint: str, duration: float,
                status_code: int, **kwargs):
        """Лог HTTP запиту"""
        self.log(
            LogLevel.INFO,
            f"{method} {endpoint} - {status_code} ({duration:.3f}s)",
            event_type=EventType.REQUEST,
            method=method,
            endpoint=endpoint,
            duration=duration,
            status_code=status_code,
            **kwargs
        )

    def security_event(self, event: str, severity: AlertSeverity, **kwargs):
        """Лог security події"""
        level = LogLevel.CRITICAL if severity == AlertSeverity.CRITICAL else LogLevel.WARNING

        self.log(
            level,
            f"Security event: {event}",
            event_type=EventType.SECURITY,
            tags=['security', severity.value],
            **kwargs
        )

    def business_event(self, event: str, **kwargs):
        """Лог business події"""
        self.log(
            LogLevel.INFO,
            f"Business event: {event}",
            event_type=EventType.BUSINESS,
            tags=['business'],
            **kwargs
        )

    def performance_metric(self, operation: str, duration: float, **kwargs):
        """Лог performance метрики"""
        self.log(
            LogLevel.INFO,
            f"Performance: {operation} took {duration:.3f}s",
            event_type=EventType.PERFORMANCE,
            duration=duration,
            tags=['performance'],
            **kwargs
        )

    def get_logs(self, limit: int = 100) -> List[LogEntry]:
        """Отримати останні логи з буфера"""
        with self.buffer_lock:
            return list(self.log_buffer)[-limit:]

    def _start_flush_task(self):
        """Запустити фонову задачу flush буфера"""

        def flush_logs():
            while True:
                try:
                    time.sleep(30)  # Кожні 30 секунд
                    self._flush_to_external()
                except Exception as e:
                    print(f"Log flush error: {e}")

        thread = threading.Thread(target=flush_logs, daemon=True)
        thread.start()

    def _flush_to_external(self):
        """Відправити логи в зовнішні системи"""
        # Тут можна реалізувати відправку в Elasticsearch, Loki, тощо
        pass


class JSONFormatter(logging.Formatter):
    """JSON форматер для логів"""

    def format(self, record):
        """Форматувати запис в JSON"""
        log_data = {
            'timestamp': datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }

        # Додаємо extra дані
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if hasattr(record, 'context'):
            log_data['context'] = record.context

        # Додаємо exception якщо є
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str, ensure_ascii=False)


class MetricsCollector:
    """Збірник метрик"""

    def __init__(self):
        self.metrics: Dict[str, List[MetricData]] = defaultdict(list)
        self.metrics_lock = threading.Lock()

        # Prometheus метрики
        if PROMETHEUS_AVAILABLE:
            self._setup_prometheus_metrics()

        # Системні метрики
        self.system_metrics_enabled = PSUTIL_AVAILABLE

        # Запускаємо збір системних метрик
        if self.system_metrics_enabled:
            self._start_system_metrics_collection()

    def _setup_prometheus_metrics(self):
        """Налаштування Prometheus метрик"""
        self.prom_counters = {
            'requests_total': Counter('winix_requests_total', 'Total requests', ['method', 'endpoint', 'status']),
            'errors_total': Counter('winix_errors_total', 'Total errors', ['type', 'endpoint']),
            'users_active': Gauge('winix_users_active', 'Active users'),
            'tasks_completed': Counter('winix_tasks_completed_total', 'Completed tasks', ['type']),
            'database_queries': Counter('winix_database_queries_total', 'Database queries', ['table', 'operation']),
        }

        self.prom_histograms = {
            'request_duration': Histogram('winix_request_duration_seconds', 'Request duration', ['method', 'endpoint']),
            'database_query_duration': Histogram('winix_database_query_duration_seconds', 'Database query duration',
                                                 ['table']),
            'cache_operation_duration': Histogram('winix_cache_operation_duration_seconds', 'Cache operation duration',
                                                  ['operation']),
        }

        self.prom_gauges = {
            'cpu_usage': Gauge('winix_cpu_usage_percent', 'CPU usage'),
            'memory_usage': Gauge('winix_memory_usage_bytes', 'Memory usage'),
            'cache_size': Gauge('winix_cache_size_bytes', 'Cache size'),
            'rate_limit_remaining': Gauge('winix_rate_limit_remaining', 'Rate limit remaining', ['rule']),
        }

    def record_metric(self, name: str, value: Union[int, float],
                      tags: Optional[Dict[str, str]] = None,
                      metric_type: str = "gauge"):
        """Записати метрику"""
        metric = MetricData(
            name=name,
            value=value,
            timestamp=time.time(),
            tags=tags or {},
            metric_type=metric_type
        )

        with self.metrics_lock:
            self.metrics[name].append(metric)

            # Обмежуємо кількість метрик
            if len(self.metrics[name]) > 1000:
                self.metrics[name] = self.metrics[name][-500:]

    def record_counter(self, name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """Записати counter метрику"""
        self.record_metric(name, value, tags, "counter")

        # Prometheus
        if PROMETHEUS_AVAILABLE and name in self.prom_counters:
            labels = list(tags.values()) if tags else []
            self.prom_counters[name].labels(*labels).inc(value)

    def record_gauge(self, name: str, value: Union[int, float], tags: Optional[Dict[str, str]] = None):
        """Записати gauge метрику"""
        self.record_metric(name, value, tags, "gauge")

        # Prometheus
        if PROMETHEUS_AVAILABLE and name in self.prom_gauges:
            labels = list(tags.values()) if tags else []
            self.prom_gauges[name].labels(*labels).set(value)

    def record_histogram(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Записати histogram метрику"""
        self.record_metric(name, value, tags, "histogram")

        # Prometheus
        if PROMETHEUS_AVAILABLE and name in self.prom_histograms:
            labels = list(tags.values()) if tags else []
            self.prom_histograms[name].labels(*labels).observe(value)

    def get_metrics(self, name: Optional[str] = None,
                    start_time: Optional[float] = None,
                    end_time: Optional[float] = None) -> Dict[str, List[MetricData]]:
        """Отримати метрики"""
        with self.metrics_lock:
            if name:
                metrics = {name: self.metrics.get(name, [])}
            else:
                metrics = dict(self.metrics)

            # Фільтруємо по часу
            if start_time or end_time:
                filtered_metrics = {}
                for metric_name, metric_list in metrics.items():
                    filtered_list = []
                    for metric in metric_list:
                        if start_time and metric.timestamp < start_time:
                            continue
                        if end_time and metric.timestamp > end_time:
                            continue
                        filtered_list.append(metric)
                    filtered_metrics[metric_name] = filtered_list
                metrics = filtered_metrics

            return metrics

    def get_prometheus_metrics(self) -> str:
        """Отримати метрики в форматі Prometheus"""
        if not PROMETHEUS_AVAILABLE:
            return ""

        return generate_latest()

    def _collect_system_metrics(self):
        """Збір системних метрик"""
        if not self.system_metrics_enabled:
            return

        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)
            self.record_gauge('cpu_usage', cpu_percent)

            # Memory
            memory = psutil.virtual_memory()
            self.record_gauge('memory_usage', memory.used)
            self.record_gauge('memory_percent', memory.percent)

            # Disk
            disk = psutil.disk_usage('/')
            self.record_gauge('disk_usage', disk.used)
            self.record_gauge('disk_percent', disk.percent)

            # Network (якщо потрібно)
            # network = psutil.net_io_counters()
            # self.record_counter('network_bytes_sent', network.bytes_sent)
            # self.record_counter('network_bytes_recv', network.bytes_recv)

        except Exception as e:
            print(f"System metrics collection error: {e}")

    def _start_system_metrics_collection(self):
        """Запустити збір системних метрик"""

        def collect_loop():
            while True:
                try:
                    self._collect_system_metrics()
                    time.sleep(60)  # Кожну хвилину
                except Exception as e:
                    print(f"System metrics error: {e}")
                    time.sleep(60)

        thread = threading.Thread(target=collect_loop, daemon=True)
        thread.start()


class AlertManager:
    """Менеджер алертів"""

    def __init__(self):
        self.alerts: Dict[str, Alert] = {}
        self.alert_rules: List[Callable] = []
        self.webhooks: List[str] = []

        # Налаштування з env
        webhook_url = os.getenv('ALERT_WEBHOOK_URL')
        if webhook_url:
            self.webhooks.append(webhook_url)

    def create_alert(self, title: str, message: str, severity: AlertSeverity,
                     event_type: EventType, context: Optional[Dict[str, Any]] = None) -> str:
        """Створити алерт"""
        alert_id = str(uuid.uuid4())

        alert = Alert(
            id=alert_id,
            title=title,
            message=message,
            severity=severity,
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            context=context or {}
        )

        self.alerts[alert_id] = alert

        # Відправляємо нотифікацію
        self._send_notification(alert)

        return alert_id

    def resolve_alert(self, alert_id: str):
        """Розв'язати алерт"""
        if alert_id in self.alerts:
            self.alerts[alert_id].resolved = True
            self.alerts[alert_id].resolved_at = datetime.now(timezone.utc)

    def get_active_alerts(self) -> List[Alert]:
        """Отримати активні алерти"""
        return [alert for alert in self.alerts.values() if not alert.resolved]

    def add_alert_rule(self, rule: Callable[[Dict[str, Any]], Optional[Alert]]):
        """Додати правило алерту"""
        self.alert_rules.append(rule)

    def check_alert_rules(self, metrics: Dict[str, Any]):
        """Перевірити правила алертів"""
        for rule in self.alert_rules:
            try:
                alert = rule(metrics)
                if alert:
                    self.create_alert(
                        alert.title,
                        alert.message,
                        alert.severity,
                        alert.event_type,
                        alert.context
                    )
            except Exception as e:
                print(f"Alert rule error: {e}")

    def _send_notification(self, alert: Alert):
        """Відправити нотифікацію"""
        # Відправляємо вебхуки
        for webhook_url in self.webhooks:
            try:
                self._send_webhook(webhook_url, alert)
            except Exception as e:
                print(f"Webhook notification error: {e}")

    def _send_webhook(self, url: str, alert: Alert):
        """Відправити вебхук"""
        import requests

        payload = {
            'alert': alert.to_dict(),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        requests.post(url, json=payload, timeout=10)


class MonitoringManager:
    """Головний менеджер моніторингу"""

    def __init__(self):
        self.logger = StructuredLogger('winix.monitoring')
        self.metrics = MetricsCollector()
        self.alerts = AlertManager()

        # Налаштовуємо стандартні алерти
        self._setup_default_alerts()

        # Запускаємо моніторинг
        self._start_monitoring()

    def _setup_default_alerts(self):
        """Налаштувати стандартні алерти"""

        def high_error_rate_rule(metrics: Dict[str, Any]) -> Optional[Alert]:
            """Правило для високого рівня помилок"""
            errors = metrics.get('errors_total', [])
            requests = metrics.get('requests_total', [])

            if not errors or not requests:
                return None

            recent_errors = sum(1 for e in errors if time.time() - e.timestamp < 300)  # 5 хвилин
            recent_requests = sum(1 for r in requests if time.time() - r.timestamp < 300)

            if recent_requests > 0:
                error_rate = recent_errors / recent_requests
                if error_rate > 0.1:  # 10% помилок
                    return Alert(
                        id="",
                        title="High Error Rate",
                        message=f"Error rate is {error_rate:.2%} over the last 5 minutes",
                        severity=AlertSeverity.HIGH,
                        event_type=EventType.ERROR,
                        timestamp=datetime.now(timezone.utc),
                        context={'error_rate': error_rate, 'recent_errors': recent_errors,
                                 'recent_requests': recent_requests}
                    )

            return None

        def high_cpu_usage_rule(metrics: Dict[str, Any]) -> Optional[Alert]:
            """Правило для високого навантаження CPU"""
            cpu_metrics = metrics.get('cpu_usage', [])
            if not cpu_metrics:
                return None

            recent_cpu = [m for m in cpu_metrics if time.time() - m.timestamp < 300]
            if recent_cpu:
                avg_cpu = sum(m.value for m in recent_cpu) / len(recent_cpu)
                if avg_cpu > 80:  # 80% CPU
                    return Alert(
                        id="",
                        title="High CPU Usage",
                        message=f"Average CPU usage is {avg_cpu:.1f}% over the last 5 minutes",
                        severity=AlertSeverity.MEDIUM,
                        event_type=EventType.SYSTEM,
                        timestamp=datetime.now(timezone.utc),
                        context={'cpu_usage': avg_cpu}
                    )

            return None

        self.alerts.add_alert_rule(high_error_rate_rule)
        self.alerts.add_alert_rule(high_cpu_usage_rule)

    def _start_monitoring(self):
        """Запустити моніторинг"""

        def monitoring_loop():
            while True:
                try:
                    # Перевіряємо алерти кожні 2 хвилини
                    time.sleep(120)

                    # Отримуємо метрики
                    metrics = self.metrics.get_metrics()

                    # Перевіряємо правила алертів
                    self.alerts.check_alert_rules(metrics)

                except Exception as e:
                    print(f"Monitoring loop error: {e}")

        thread = threading.Thread(target=monitoring_loop, daemon=True)
        thread.start()

    def get_system_status(self) -> Dict[str, Any]:
        """Отримати статус системи"""
        # Останні метрики
        recent_metrics = self.metrics.get_metrics(start_time=time.time() - 300)  # 5 хвилин

        # Активні алерти
        active_alerts = self.alerts.get_active_alerts()

        # Загальний стан
        health_status = "healthy"
        if any(alert.severity in [AlertSeverity.HIGH, AlertSeverity.CRITICAL] for alert in active_alerts):
            health_status = "unhealthy"
        elif active_alerts:
            health_status = "degraded"

        return {
            'status': health_status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'active_alerts': len(active_alerts),
            'alerts': [alert.to_dict() for alert in active_alerts[:10]],  # Топ 10
            'metrics_summary': {
                name: len(metrics) for name, metrics in recent_metrics.items()
            }
        }


# Глобальні екземпляри
monitoring_manager = MonitoringManager()
logger = monitoring_manager.logger
metrics = monitoring_manager.metrics
alerts = monitoring_manager.alerts


# Декоратори для моніторингу
def monitor_performance(operation_name: Optional[str] = None):
    """Декоратор для моніторингу продуктивності"""

    def decorator(func: Callable) -> Callable:
        name = operation_name or f"{func.__module__}.{func.__name__}"

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)

                duration = time.time() - start_time
                metrics.record_histogram('operation_duration', duration, {'operation': name})
                logger.performance_metric(name, duration)

                return result
            except Exception as e:
                duration = time.time() - start_time
                metrics.record_counter('operation_errors', 1, {'operation': name, 'error_type': type(e).__name__})
                logger.error(f"Operation {name} failed", exception=e, duration=duration)
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def log_function_calls(include_args: bool = False, include_result: bool = False):
    """Декоратор для логування викликів функцій"""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__name__}"

            # Логуємо виклик
            log_data = {'function': func_name}
            if include_args:
                log_data['args'] = str(args)
                log_data['kwargs'] = str(kwargs)

            logger.debug(f"Calling {func_name}", context=log_data)

            try:
                result = func(*args, **kwargs)

                if include_result:
                    logger.debug(f"Function {func_name} returned", context={'result': str(result)})

                return result
            except Exception as e:
                logger.error(f"Function {func_name} raised exception", exception=e, context=log_data)
                raise

        return wrapper

    return decorator


# Flask middleware
def flask_monitoring_middleware(app):
    """Flask middleware для моніторингу"""

    @app.before_request
    def before_request():
        """Початок запиту"""
        from flask import g, request

        g.start_time = time.time()
        g.request_id = str(uuid.uuid4())

        # Встановлюємо контекст логгера
        logger.set_context(
            request_id=g.request_id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', ''),
            endpoint=request.endpoint
        )

    @app.after_request
    def after_request(response):
        """Кінець запиту"""
        from flask import g, request

        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time

            # Логуємо запит
            logger.request(
                method=request.method,
                endpoint=request.path,
                duration=duration,
                status_code=response.status_code,
                request_id=getattr(g, 'request_id', None)
            )

            # Записуємо метрики
            metrics.record_counter('requests_total', 1, {
                'method': request.method,
                'endpoint': request.endpoint or 'unknown',
                'status': str(response.status_code)
            })

            metrics.record_histogram('request_duration', duration, {
                'method': request.method,
                'endpoint': request.endpoint or 'unknown'
            })

            # Лічимо помилки
            if response.status_code >= 400:
                metrics.record_counter('errors_total', 1, {
                    'type': 'http_error',
                    'endpoint': request.endpoint or 'unknown',
                    'status': str(response.status_code)
                })

        # Очищаємо контекст
        logger.clear_context()

        return response


# Експорт
__all__ = [
    'LogLevel',
    'EventType',
    'AlertSeverity',
    'StructuredLogger',
    'MetricsCollector',
    'AlertManager',
    'MonitoringManager',
    'monitoring_manager',
    'logger',
    'metrics',
    'alerts',
    'monitor_performance',
    'log_function_calls',
    'flask_monitoring_middleware'
]