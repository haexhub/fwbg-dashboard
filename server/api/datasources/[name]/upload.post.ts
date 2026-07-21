const FWBG_API_URL = process.env.FWBG_API_URL || "http://localhost:8420";
const FWBG_API_KEY = process.env.FWBG_API_KEY || "";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;

  // Forward the raw multipart request to fwbg
  const req = event.node.req;
  const contentType = req.headers["content-type"] ?? "";

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });

  const body = Buffer.concat(chunks);

  const res = await fetch(`${FWBG_API_URL}/api/datasources/${name}/upload`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      ...(FWBG_API_KEY ? { "X-API-Key": FWBG_API_KEY } : {}),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw createError({ statusCode: res.status, statusMessage: text });
  }

  return res.json();
});
