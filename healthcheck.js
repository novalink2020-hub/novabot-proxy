const fetch = require("node-fetch");

(async () => {
  try {
    const res = await fetch("http://localhost:3000/api/health");
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Health check failed:", err.message);
  }
})();
