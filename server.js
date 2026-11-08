const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function forwardToDigiflazz(path, body, callback) {
  const data = JSON.stringify(body);
  const options = {
    hostname: "api.digiflazz.com",
    port: 443,
    path: "/v1" + path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };
  const req = https.request(options, (res) => {
    let raw = "";
    res.on("data", (chunk) => (raw += chunk));
    res.on("end", () => {
      try { callback(null, JSON.parse(raw)); }
      catch (e) { callback(new Error("Invalid JSON: " + raw)); }
    });
  });
  req.on("error", callback);
  req.write(data);
  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method === "GET" && req.url === "/") {
    return sendJson(res, 200, { status: "ok", service: "Digiflazz Proxy" });
  }

  if (req.method === "GET" && req.url === "/myip") {
    https.get("https://api.ipify.org?format=json", (ipRes) => {
      let raw = "";
      ipRes.on("data", (chunk) => (raw += chunk));
      ipRes.on("end", () => {
        try { sendJson(res, 200, { ip: JSON.parse(raw).ip }); }
        catch(e) { sendJson(res, 200, { ip: raw }); }
      });
    }).on("error", (e) => sendJson(res, 500, { error: e.message }));
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const allowed = ["/price-list", "/transaction", "/cek-saldo"];
  const digiPath = allowed.includes(req.url) ? req.url : null;
  if (!digiPath) {
    return sendJson(res, 404, { error: "Route not found" });
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let parsed;
    try { parsed = JSON.parse(body); }
    catch (e) { return sendJson(res, 400, { error: "Invalid JSON" }); }

    forwardToDigiflazz(digiPath, parsed, (err, result) => {
      if (err) return sendJson(res, 502, { error: err.message });
      sendJson(res, 200, result);
    });
  });
});

server.listen(PORT, () => console.log("Proxy running on port " + PORT));
