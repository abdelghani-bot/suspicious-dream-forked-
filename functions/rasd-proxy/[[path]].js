const UPSTREAM_BASE = "https://rsd.sfda.gov.sa/ws";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, SOAPAction",
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
    // يشيل أول المسار "/rasd-proxy" قبل ما نضيفه لرابط SFDA
    const path = url.pathname.replace(/^\/rasd-proxy/, "");
    const upstreamUrl = `${UPSTREAM_BASE}${path}`;

    const body = await request.text();

    // بعض سيرفرات SFDA بتحمي الخدمة بـ HTTP Basic Auth على مستوى الـ container، فلازم
    // نمرر الـ Authorization header زي ما جاي من الفرونت-إند (مش بس Content-Type/SOAPAction)
    const upstreamHeaders = {
      "Content-Type": request.headers.get("Content-Type") || "text/xml; charset=utf-8",
      "SOAPAction": request.headers.get("SOAPAction") || "",
    };
    const authHeader = request.headers.get("Authorization");
    if (authHeader) upstreamHeaders["Authorization"] = authHeader;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body,
    });

    const responseBody = await upstreamResponse.text();

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": upstreamResponse.headers.get("Content-Type") || "text/xml; charset=utf-8",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy request failed", details: err.message }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}
