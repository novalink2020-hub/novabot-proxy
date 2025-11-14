import express from "express";
import requestIp from "request-ip";

const app = express();

app.get("/server-ip", (req, res) => {
  const ip = requestIp.getClientIp(req);
  res.json({ server_ip: ip });
});

// لازم Export عشان Render يفهمه
export default app;
