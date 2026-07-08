import { getLiteConfig } from "@/lib/lite/config";
import { isMockAgenticFlowEnabled } from "@/lib/testing/mock-agentic-flow";

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGmailAccessToken(): Promise<string> {
  const config = getLiteConfig();
  if (!config.gmailOauthClientId || !config.gmailOauthClientSecret || !config.gmailOauthRefreshToken) {
    throw new Error(
      "Gmail OAuth is not configured. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REFRESH_TOKEN.",
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.gmailOauthClientId,
      client_secret: config.gmailOauthClientSecret,
      refresh_token: config.gmailOauthRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Gmail OAuth token: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Gmail OAuth refresh response did not include access_token.");
  }

  return payload.access_token;
}

export async function sendLiteBrokerOutreachEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const config = getLiteConfig();
  const fromEmail = config.gmailFromEmail;
  const senderName = config.gmailSenderName || "TenantMatch";

  if (!fromEmail) {
    throw new Error("GMAIL_FROM_EMAIL is not configured.");
  }

  if (isMockAgenticFlowEnabled()) {
    return {
      id: `mock_gmail_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  const accessToken = await getGmailAccessToken();
  const rawMessage = [
    `From: ${senderName} <${fromEmail}>`,
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    args.body,
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      raw: encodeBase64Url(rawMessage),
    }),
  });

  if (!response.ok) {
    throw new Error(`Gmail send failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { id?: string };
  return {
    id: payload.id ?? "sent",
  };
}
