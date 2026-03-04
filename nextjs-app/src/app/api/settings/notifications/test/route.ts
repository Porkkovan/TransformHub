import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const { organizationId, channelType } = body;

    if (!organizationId || !channelType) {
      return NextResponse.json(
        { error: "organizationId and channelType are required" },
        { status: 400 }
      );
    }

    // Fetch the channel config for this org
    const config = await prisma.notificationConfig.findFirst({
      where: { organizationId, channel: channelType },
    });

    const channelConfig = config
      ? (config.config as { channelConfig?: Record<string, string> })?.channelConfig ?? {}
      : {};

    switch (channelType) {
      case "email": {
        // Log test email (actual email sending requires SMTP config)
        console.log(
          `[TEST] Sending test email to: ${channelConfig.recipients || "(no recipients configured)"}`
        );
        return NextResponse.json({
          success: true,
          message: "Test email logged (SMTP not configured)",
        });
      }

      case "slack": {
        const webhookUrl = channelConfig.webhookUrl;
        if (!webhookUrl) {
          return NextResponse.json(
            { success: false, error: "Slack webhook URL not configured" },
            { status: 400 }
          );
        }

        try {
          const slackRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: "Test notification from TransformHub Admin Console",
              channel: channelConfig.channel || undefined,
            }),
          });

          if (!slackRes.ok) {
            return NextResponse.json(
              { success: false, error: `Slack returned status ${slackRes.status}` },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message: "Test Slack message sent",
          });
        } catch (err) {
          return NextResponse.json(
            { success: false, error: `Failed to reach Slack: ${err instanceof Error ? err.message : "Unknown error"}` },
            { status: 500 }
          );
        }
      }

      case "webhook": {
        const url = channelConfig.url;
        if (!url) {
          return NextResponse.json(
            { success: false, error: "Webhook endpoint URL not configured" },
            { status: 400 }
          );
        }

        try {
          const method = channelConfig.method || "POST";
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (channelConfig.secret) {
            headers["X-Webhook-Secret"] = channelConfig.secret;
          }

          const webhookRes = await fetch(url, {
            method,
            headers,
            body: JSON.stringify({
              event: "test",
              message: "Test notification from TransformHub Admin Console",
              timestamp: new Date().toISOString(),
            }),
          });

          if (!webhookRes.ok) {
            return NextResponse.json(
              { success: false, error: `Webhook returned status ${webhookRes.status}` },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message: "Test webhook sent",
          });
        } catch (err) {
          return NextResponse.json(
            { success: false, error: `Failed to reach webhook: ${err instanceof Error ? err.message : "Unknown error"}` },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown channel type: ${channelType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to send test notification:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
