import smtplib
from email.message import EmailMessage

from learnia_backend.config import settings
from learnia_backend.mail.base import EmailSender


class SmtpEmailSender(EmailSender):
    """Real delivery through any SMTP server (Gmail app password, Brevo, ...)."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = settings.email_from
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()  # upgrade to an encrypted connection before logging in
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
