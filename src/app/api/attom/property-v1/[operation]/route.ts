import { NextResponse } from "next/server";
import { attomGet, attomPaths, type PropertyV1Endpoint } from "@/lib/attom/client";

interface Params {
  params: Promise<{ operation: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { operation } = await params;
    if (!isPropertyOperation(operation)) {
      return NextResponse.json(
        { error: `Unsupported operation '${operation}'` },
        { status: 400 },
      );
    }

    const search = new URL(request.url).searchParams;
    const query: Record<string, string> = {};
    for (const [key, value] of search.entries()) {
      query[key] = value;
    }

    const payload = await attomGet(attomPaths.propertyV1[operation], query);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATTOM proxy error";
    if (message.includes("ATTOM_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // ATTOM frequently returns non-2xx for invalid partial inputs while users are typing.
    // Return a safe empty result so the UI can recover immediately on the next valid query.
    return NextResponse.json({ property: [], error: message, status: { code: -1, msg: "UpstreamError" } });
  }
}

function isPropertyOperation(value: string): value is PropertyV1Endpoint {
  return value in attomPaths.propertyV1;
}
