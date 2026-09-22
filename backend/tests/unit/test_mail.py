import logging

from learnia_backend.config import settings
from learnia_backend.mail import get_email_sender
from learnia_backend.mail.console import ConsoleEmailSender
from learnia_backend.mail.smtp import SmtpEmailSender


def test_factory_picks_sender_from_config(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "console")
    assert isinstance(get_email_sender(), ConsoleEmailSender)
    monkeypatch.setattr(settings, "email_backend", "smtp")
    assert isinstance(get_email_sender(), SmtpEmailSender)


def test_console_sender_logs_the_email(caplog):
    with caplog.at_level(logging.INFO, logger="learnia_backend.mail"):
        ConsoleEmailSender().send(to="a@b.com", subject="Hi", body="link here")
    assert "a@b.com" in caplog.text and "link here" in caplog.text


def test_smtp_sender_uses_starttls_login_and_sends(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            calls.append(("starttls",))

        def login(self, user, password):
            calls.append(("login", user, password))

        def send_message(self, message):
            calls.append(("send", message["To"], message["Subject"]))

    monkeypatch.setattr("learnia_backend.mail.smtp.smtplib.SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "smtp_username", "me")
    monkeypatch.setattr(settings, "smtp_password", "secret")

    SmtpEmailSender().send(to="a@b.com", subject="Hi", body="body")

    assert calls == [
        ("connect", "smtp.test", 587),
        ("starttls",),
        ("login", "me", "secret"),
        ("send", "a@b.com", "Hi"),
    ]
