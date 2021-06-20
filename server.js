const https = require("https");
const http = require("http");
// const fs = require("fs");
//const key = fs.readFileSync("../certs/cert.key").toString();
//const cert = fs.readFileSync("../certs/cert.crt").toString();

const app = require("./app");
//const credentials = { key: key, cert: cert };

const port = process.env.PORT || 8000;
// const port = 8000;
app.set("port", port);
//const secure_server = https.createServer(credentials, app);
const server = http.createServer(app);
//secure_server.listen(s_port, () => {
//  console.log("Listening on secure port: ", s_port);
//});
server.listen(port, () => {
  console.log("cleaford running on port: ", port);
});
