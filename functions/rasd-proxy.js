const UPSTREAM_BASE = "https://rsd.sfda.gov.sa/sop";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);
    // بنشيل "/rasd-proxy" من أول المسار قبل ما نضيفه لرابط SFDA
    const path = url.pathname.replace(/^\/rasd-proxy/, "");
    const upstreamUrl = `${UPSTREAM_BASE}${path}`;

    const bodyText = await request.text();
    const contentType = request.headers.get("Content-Type") || "application/soap+xml; charset=utf-8";

    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bodyText,
    });

    const responseText = await upstreamRes.text();

    return new Response(responseText, {
      status: upstreamRes.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": upstreamRes.headers.get("Content-Type") || "text/xml; charset=utf-8",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Proxy error: " + e.message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
