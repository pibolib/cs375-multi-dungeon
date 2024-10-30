const express = require("express");
const app = express();
app.use(express.json());

let port = 12789;
let hostname = "localhost";

app.listen(port, hostname, () => {
	console.log(`Server running on http://${hostname}:${port}`);
});
