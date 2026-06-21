"use client";

import { useEffect } from "react";

function LiteOpenedBeacon({ token }: { token: string }) {
  useEffect(() => {
    const url = `/api/lite/links/${token}/opened`;
    const beaconSent =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(url, new Blob([], { type: "application/json" }));

    if (!beaconSent) {
      void fetch(url, {
        method: "POST",
        keepalive: true,
      }).catch(() => {
        // Best effort only.
      });
    }
  }, [token]);

  return null;
}

export { LiteOpenedBeacon };
