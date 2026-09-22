"""Factory: builds the EmailSender selected by EMAIL_BACKEND."""

from learnia_backend.config import settings
from learnia_backend.mail.base import EmailSender
from learnia_backend.mail.console import ConsoleEmailSender
from learnia_backend.mail.smtp import SmtpEmailSender

_SENDERS: dict[str, type[EmailSender]] = {
    "console": ConsoleEmailSender,
    "smtp": SmtpEmailSender,
}


def get_email_sender() -> EmailSender:
    return _SENDERS[settings.email_backend]()
