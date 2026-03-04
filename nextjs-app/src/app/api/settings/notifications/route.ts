import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

const DEFAULT_SETTINGS = {
  channels: [
    { type: "email", enabled: false, config: { recipients: "" } },
    { type: "slack", enabled: false, config: { webhookUrl: "", channel: "" } },
    { type: "webhook", enabled: false, config: { url: "", secret: "", method: "POST" } },
  ],
  events: {
    agentCompleted: true,
    agentFailed: true,
    pipelineCompleted: true,
    driftDetected: true,
    securityAlert: true,
    approvalRequired: true,
  },
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const configs = await prisma.notificationConfig.findMany({
      where: { organizationId },
    });

    if (configs.length === 0) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    // Reconstruct the settings shape from individual NotificationConfig records
    const channels = DEFAULT_SETTINGS.channels.map((defaultChannel) => {
      const dbConfig = configs.find((c) => c.channel === defaultChannel.type);
      if (dbConfig) {
        const configData = dbConfig.config as Record<string, unknown>;
        return {
          type: defaultChannel.type,
          enabled: dbConfig.enabled,
          config: (configData.channelConfig as Record<string, string>) ?? defaultChannel.config,
        };
      }
      return defaultChannel;
    });

    // Events are stored in a config record with channel "events"
    const eventsConfig = configs.find((c) => c.channel === "events");
    const events = eventsConfig
      ? (eventsConfig.config as typeof DEFAULT_SETTINGS.events)
      : DEFAULT_SETTINGS.events;

    return NextResponse.json({ channels, events });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch notification settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const { organizationId, channels, events } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Upsert each channel config
    if (Array.isArray(channels)) {
      for (const channel of channels) {
        const existing = await prisma.notificationConfig.findFirst({
          where: { organizationId, channel: channel.type },
        });

        if (existing) {
          await prisma.notificationConfig.update({
            where: { id: existing.id },
            data: {
              enabled: channel.enabled,
              config: { channelConfig: channel.config },
            },
          });
        } else {
          await prisma.notificationConfig.create({
            data: {
              organizationId,
              channel: channel.type,
              enabled: channel.enabled,
              config: { channelConfig: channel.config },
            },
          });
        }
      }
    }

    // Upsert events config
    if (events) {
      const existingEvents = await prisma.notificationConfig.findFirst({
        where: { organizationId, channel: "events" },
      });

      if (existingEvents) {
        await prisma.notificationConfig.update({
          where: { id: existingEvents.id },
          data: { config: events },
        });
      } else {
        await prisma.notificationConfig.create({
          data: {
            organizationId,
            channel: "events",
            enabled: true,
            config: events,
          },
        });
      }
    }

    return NextResponse.json({ channels, events });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to save notification settings:", error);
    return NextResponse.json(
      { error: "Failed to save notification settings" },
      { status: 500 }
    );
  }
}
