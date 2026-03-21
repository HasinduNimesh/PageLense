import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    const parsedUrl = new URL(url);
    
    // Quick timeout fetch just to verify connection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(parsedUrl.toString(), { 
        method: 'HEAD',
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok && res.status !== 405 && res.status !== 403) {
      // Some servers block HEAD with 405/403, we still count those as reachable.
      // But if it's 404, the page doesn't exist.
      if (res.status === 404) {
         return NextResponse.json({ error: "Page not found (404). Please check the URL." }, { status: 404 });
      }
    }
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    const raw = error.message ? error.message.toLowerCase() : "";
    if (raw.includes("enotfound") || raw.includes("getaddrinfo") || raw.includes("fetch failed")) {
      return NextResponse.json({ error: "Could not reach this website. The domain may not exist or DNS lookup failed." }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to connect to website. Please check the URL and try again." }, { status: 502 });
  }
}
