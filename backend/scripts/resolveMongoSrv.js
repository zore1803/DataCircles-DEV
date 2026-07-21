// One-off helper: resolves the Atlas SRV/TXT records via DNS-over-HTTPS
// (Cloudflare), bypassing local network DNS that blocks raw SRV lookups.
const https = require("https");

const HOST = "cluster0.iiu3mlk.mongodb.net";

function dohQuery(name, type) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    https
      .get(url, { headers: { accept: "application/dns-json" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const srv = await dohQuery(`_mongodb._tcp.${HOST}`, "SRV");
  const txt = await dohQuery(HOST, "TXT");

  console.log("--- SRV records ---");
  const hosts = (srv.Answer || []).map((a) => {
    // SRV data format: "priority weight port target"
    const parts = a.data.split(" ");
    const port = parts[2];
    const target = parts[3].replace(/\.$/, "");
    return `${target}:${port}`;
  });
  console.log(hosts);

  console.log("--- TXT records (connection options) ---");
  console.log((txt.Answer || []).map((a) => a.data));

  if (hosts.length) {
    console.log("\n--- Suggested standard connection string ---");
    console.log(
      `mongodb://rohitzore_db_user:<db_password>@${hosts.join(",")}/?ssl=true&authSource=admin&retryWrites=true&w=majority`,
    );
  }
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
