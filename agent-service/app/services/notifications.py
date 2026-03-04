"""
Notification service for sending alerts across multiple channels.

Supports email (via aiosmtplib), Slack (via webhook), and generic webhooks.
On pipeline completion, notifies all configured channels for the organization.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from email.message import EmailMessage
from typing import Any, Optional

import httpx

from app.core.database import db_pool

logger = logging.getLogger(__name__)


class NotificationService:
    """Send notifications via email, Slack, or webhook."""

    # ------------------------------------------------------------------
    # Email
    # ------------------------------------------------------------------

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
    ) -> bool:
        """Send an email using aiosmtplib.

        SMTP configuration is read from environment variables:
          - SMTP_HOST (default ``localhost``)
          - SMTP_PORT (default ``587``)
          - SMTP_USER
          - SMTP_PASSWORD
          - SMTP_FROM (default ``noreply@transformhub.io``)
        """
        try:
            import aiosmtplib

            host = os.environ.get("SMTP_HOST", "localhost")
            port = int(os.environ.get("SMTP_PORT", "587"))
            user = os.environ.get("SMTP_USER", "")
            password = os.environ.get("SMTP_PASSWORD", "")
            sender = os.environ.get("SMTP_FROM", "noreply@transformhub.io")

            message = EmailMessage()
            message["From"] = sender
            message["To"] = to
            message["Subject"] = subject
            message.set_content(body)

            await aiosmtplib.send(
                message,
                hostname=host,
                port=port,
                username=user or None,
                password=password or None,
                use_tls=port == 465,
                start_tls=port == 587,
            )

            await self._log_notification("email", subject, body, "sent")
            logger.info("Email sent to=%s subject=%s", to, subject)
            return True

        except Exception as exc:
            logger.error("Failed to send email to=%s: %s", to, exc)
            await self._log_notification("email", subject, body, "failed", str(exc))
            return False

    # ------------------------------------------------------------------
    # Slack
    # ------------------------------------------------------------------

    async def send_slack(
        self,
        webhook_url: str,
        message: str,
    ) -> bool:
        """Post a message to a Slack incoming webhook."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    webhook_url,
                    json={"text": message},
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()

            await self._log_notification("slack", "Slack message", message, "sent")
            logger.info("Slack message sent to webhook")
            return True

        except Exception as exc:
            logger.error("Failed to send Slack message: %s", exc)
            await self._log_notification("slack", "Slack message", message, "failed", str(exc))
            return False

    # ------------------------------------------------------------------
    # Generic webhook
    # ------------------------------------------------------------------

    async def send_webhook(
        self,
        url: str,
        payload: dict[str, Any],
    ) -> bool:
        """POST a JSON payload to an arbitrary webhook URL."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()

            body_str = json.dumps(payload, default=str)
            await self._log_notification("webhook", f"Webhook: {url}", body_str, "sent")
            logger.info("Webhook sent to url=%s", url)
            return True

        except Exception as exc:
            logger.error("Failed to send webhook to=%s: %s", url, exc)
            body_str = json.dumps(payload, default=str)
            await self._log_notification("webhook", f"Webhook: {url}", body_str, "failed", str(exc))
            return False

    # ------------------------------------------------------------------
    # Notify on completion
    # ------------------------------------------------------------------

    async def notify_on_completion(
        self,
        execution_id: str,
        agent_type: str,
        status: str,
        organization_id: Optional[str] = None,
    ) -> None:
        """Send notifications to all configured channels for the organization.

        Reads ``notification_configs`` from the database for the given org and
        dispatches to each enabled channel.
        """
        if not organization_id:
            logger.debug("No organization_id provided; skipping notifications")
            return

        configs = await db_pool.fetch(
            """
            SELECT channel, config
            FROM notification_configs
            WHERE organization_id = $1 AND enabled = true
            """,
            organization_id,
        )

        if not configs:
            logger.debug("No notification configs for org=%s", organization_id)
            return

        subject = f"[TransformHub] {agent_type} agent {status.lower()}"
        body = (
            f"Agent: {agent_type}\n"
            f"Status: {status}\n"
            f"Execution ID: {execution_id}\n"
        )

        webhook_payload = {
            "event": "agent_completion",
            "execution_id": execution_id,
            "agent_type": agent_type,
            "status": status,
            "organization_id": organization_id,
        }

        for row in configs:
            channel = row["channel"]
            config = row["config"]
            if isinstance(config, str):
                config = json.loads(config)

            if channel == "email":
                email_to = config.get("email_to", config.get("to", ""))
                if email_to:
                    await self.send_email(email_to, subject, body)

            elif channel == "slack":
                webhook_url = config.get("webhook_url", "")
                if webhook_url:
                    await self.send_slack(webhook_url, f"{subject}\n{body}")

            elif channel == "webhook":
                url = config.get("url", config.get("webhook_url", ""))
                if url:
                    await self.send_webhook(url, webhook_payload)

            else:
                logger.warning("Unknown notification channel: %s", channel)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _log_notification(
        self,
        channel: str,
        subject: str,
        body: str,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        """Persist a log entry in the ``notification_logs`` table."""
        try:
            log_id = str(uuid.uuid4())
            await db_pool.execute(
                """
                INSERT INTO notification_logs (id, channel, subject, body, status, error, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                """,
                log_id,
                channel,
                subject,
                body[:2000],  # truncate to avoid oversized payloads
                status,
                error,
            )
        except Exception as exc:
            logger.error("Failed to log notification: %s", exc)


# Module-level singleton
notification_service = NotificationService()
