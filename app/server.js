const ws = require("ws");
const express = require("express");
const http = require("http");
const { Pool } = require("pg");
let argon2 = require("argon2");
let cookieParser = require("cookie-parser");
let crypto = require("crypto");
let env = require("../env.json");

let { LoginLogout } = require("./loginLogout.js");

const pool = new Pool(env);
const app = express();
app.use(express.json());
app.use(express.static("web"));
app.use(cookieParser());

let port = 12789;
let hostname = "localhost";

// global object for storing tokens
// in a real app, we'd save them to a db so even if the server exits
// users will still be logged in when it restarts
let tokenStorage = {};

pool.connect().then(() => {
	console.log("Connected to the database!");
})

let currentEntityIndex = 1;
let entities = [
	{
		entityType: "dummy",
		posX: 4,
		posY: 5,
	},
];

app.post("/test", (req, res) => {
	console.log(req.body);
});

LoginLogout(app, argon2, cookieParser, crypto, pool, tokenStorage);

// Create HTTP server and attach the WebSocket server to it
const server = http.createServer(app);
server.listen(port, hostname, () => {
	console.log(`Server running on http://${hostname}:${port}`);
});

// Set up the WebSocket server
const wss = new ws.WebSocketServer({ server });
wss.on("connection", (client) => {
	console.log("New client connected!");
	let clientUpdateMessage = {
		messageType: "refresh",
		messageBody: entities,
	};
	client.send(JSON.stringify(clientUpdateMessage));
	let newEntity = {
		entityType: "player",
		posX: Math.floor(Math.random() * 8),
		posY: Math.floor(Math.random() * 8),
	};
	let newEntityMessage = {
		messageType: "spawn",
		messageBody: newEntity,
	};
	entities.push(newEntity);
	broadcast(JSON.stringify(newEntityMessage));
	client.on("message", (message) => {
		console.log(`New message: ${message}`);
		broadcast(message);
	});
});

// Sends message to every client that is currently active
function broadcast(message) {
	for (let client of wss.clients) {
		if (client.readyState === ws.OPEN) {
			client.send(message);
		}
	}
}