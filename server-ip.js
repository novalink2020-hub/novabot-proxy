export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ server_ip: ip }));
}
