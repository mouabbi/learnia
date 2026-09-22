"""
EmailSender — same idea as AuthStrategy: one narrow interface, several
interchangeable implementations, picked by config (EMAIL_BACKEND).
"""

from abc import ABC, abstractmethod


class EmailSender(ABC):
    @abstractmethod
    def send(self, *, to: str, subject: str, body: str) -> None:
        """Deliver one plain-text email."""
