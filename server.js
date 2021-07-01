require('dotenv').config();
const https = require("https");
const http = require("http");
<<<<<<< HEAD
 const fs = require("fs");
const key = fs.readFileSync("../certs/cert.key").toString();
const cert = fs.readFileSync("../certs/cert.crt").toString();

const app = require("./app");
const credentials = { key: key, cert: cert };
console.log("test: ",process.env.PORT);
=======
const fs = require("fs");
const key = fs.readFileSync("/var/certs/cert.key").toString();
const cert = fs.readFileSync("/var/certs/cert.pem").toString();

const app = require("./app");
const credentials = { key: key, cert: cert };

>>>>>>> 0f3b18a8f530e7d73705d9def335201c5f4c7c81
const port = process.env.PORT;
// const port = 8000;
app.set("port", port);
const secure_server = https.createServer(credentials, app);
//const server = http.createServer(app);
secure_server.listen(port, () => {
	console.log("Listening on secure port: ", port);
});

//server.listen(port, () => {
  //console.log("cleaford running on port: ", port);
//});
