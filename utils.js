// =======================================================
// utils.js – General Helpers
// =======================================================

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

module.exports = { sleep };
