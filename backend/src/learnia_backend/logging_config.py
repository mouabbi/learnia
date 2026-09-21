"""
Logging setup for the backend.

Why: Python's `print()` statements disappear once the terminal is closed and
give no severity level or timestamp. The `logging` module lets us write
structured, leveled (INFO/WARNING/ERROR) messages to both the console (for
dev) and a rotating log file (so logs survive restarts and don't grow forever).
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "app.log"


def configure_logging() -> None:
    """Call once, at app startup (see main.py), before anything else logs."""
    LOG_DIR.mkdir(exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler: what you see while `uvicorn --reload` is running.
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Rotating file handler: keeps up to 5 files of 1MB each, then discards
    # the oldest — so `logs/app.log` never grows unbounded.
    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=1_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
