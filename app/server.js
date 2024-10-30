const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static("web"));

let port = 12789;
let hostname = "localhost";

app.listen(port, hostname, () => {
	console.log(`Server running on http://${hostname}:${port}`);
});
