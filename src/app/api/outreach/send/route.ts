import { NextResponse } from "next/server";

type SendBody = {
  to?: string;
  subject?: string;
  body?: string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function POST(request: Request) {
  const requestId = `outreach_send_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await request.json()) as SendBody;
    const to = body.to?.trim();
    const subject = body.subject?.trim();
    const emailBody = body.body?.trim();

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
    }

    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    const fromEmail = process.env.GMAIL_FROM_EMAIL;

    if (!accessToken || !fromEmail) {
      return NextResponse.json(
        {
          error:
            "Gmail is not configured. Set GMAIL_ACCESS_TOKEN and GMAIL_FROM_EMAIL in environment before sending.",
        },
        { status: 500 },
      );
    }

    const rawMessage = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailBody,
    ].join("\r\n");

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ raw: encodeBase64Url(rawMessage) }),
    });

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text();
      console.error("[outreach/send] gmail failure", {
        requestId,
        status: gmailResponse.status,
        bodyPreview: errorText.slice(0, 600),
      });
      return NextResponse.json({ error: `Gmail send failed: ${gmailResponse.status}` }, { status: 500 });
    }

    const payload = (await gmailResponse.json()) as { id?: string };
    return NextResponse.json({ ok: true, id: payload.id ?? "sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected send failure";
    console.error("[outreach/send] unexpected failure", { requestId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}