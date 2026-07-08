import { NextResponse } from "next/server";
import {
  buildBrokerOutreachQueueHeaderState,
  buildBrokerOutreachQueueRowUpdates,
  parseBrokerOutreachQueueTable,
} from "@/lib/lite/automation-sheet";
import { requireLiteAutomationTenantId } from "@/lib/lite/automation-auth";
import { getLiteConfig } from "@/lib/lite/config";
import { createLiteSheetAdapter } from "@/lib/lite/google-sheet";
import { sendLiteBrokerOutreachEmail } from "@/lib/lite/gmail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireLiteAutomationTenantId(request);

    const adapter = await createLiteSheetAdapter();
    const config = getLiteConfig();
    await adapter.ensureTabs([config.brokerOutreachQueueTabName]);

    const values = await adapter.readValues(config.brokerOutreachQueueTabName);
    const headerState = buildBrokerOutreachQueueHeaderState(values, config.brokerOutreachQueueTabName);
    const queueTable = parseBrokerOutreachQueueTable(values, config.brokerOutreachQueueTabName);
    const updates = [...headerState.headerUpdates];

    let sentCount = 0;
    let failedCount = 0;

    for (const row of queueTable.rows) {
      if (row.approvalStatus !== "APPROVED" || row.sendStatus !== "UNSENT") {
        continue;
      }

      try {
        const result = await sendLiteBrokerOutreachEmail({
          to: row.brokerEmail,
          subject: row.subject,
          body: row.body,
        });

        const nextRow = {
          ...row,
          sendStatus: "SENT" as const,
          gmailMessageId: result.id,
          sentAt: new Date(),
          error: null,
        };
        updates.push(
          ...buildBrokerOutreachQueueRowUpdates(
            config.brokerOutreachQueueTabName,
            row.rowNumber,
            headerState.headerIndex,
            nextRow,
          ),
        );
        sentCount += 1;
      } catch (error) {
        const nextRow = {
          ...row,
          sendStatus: "FAILED" as const,
          error: error instanceof Error ? error.message : "Unknown Gmail send failure.",
        };
        updates.push(
          ...buildBrokerOutreachQueueRowUpdates(
            config.brokerOutreachQueueTabName,
            row.rowNumber,
            headerState.headerIndex,
            nextRow,
          ),
        );
        failedCount += 1;
      }
    }

    await adapter.writeValues(updates);

    return NextResponse.json({
      sentCount,
      failedCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process approved outreach rows.",
      },
      { status: 500 },
    );
  }
}
