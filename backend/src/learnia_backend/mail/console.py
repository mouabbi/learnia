import logging

from learnia_backend.mail.base import EmailSender

logger = logging.getLogger("learnia_backend.mail")


class ConsoleEmailSender(EmailSender):
    """Development sender: nothing leaves the machine, the email is logged."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL (console) to=%s subject=%r\n%s", to, subject, body)
