const ws = require("ws");
const express = require("express");
const http = require("http");
const { Pool } = require("pg");
const cookieParser = require("cookie-parser");
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
});

let entities = [
	{
		entityType: "dummy",
		posX: 4,
		posY: 5,
	},
];

let updateEvents = [];

let clients = {};

app.post("/test", (req, res) => {
	console.log(req.body);
});

LoginLogout(app, pool, tokenStorage);

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
	clients[client] = { id: entities.length, action: "none" };
	entities.push(newEntity);
	updateEvents.push(JSON.stringify(newEntityMessage));

	client.on("message", (message) => {
		let messageObject = JSON.parse(message);
		console.log(`New message: ${message}`);
		if (messageObject.messageType == "chat") {
			broadcast(message);
		} else if (messageObject.messageType == "moveLeft") {
			clients[client].action = "moveLeft";
		} else if (messageObject.messageType == "moveRight") {
			clients[client].action = "moveRight";
		} else if (messageObject.messageType == "moveUp") {
			clients[client].action = "moveUp";
		} else if (messageObject.messageType == "moveDown") {
			clients[client].action = "moveDown";
		}
	});
	client.on("close", (client) => {
		let despawnMessage = {
			messageType: "despawn",
			messageBody: clients[client],
		};
		updateEvents.push(JSON.stringify(despawnMessage));
		entities[clients[client].id] = {
			entityType: "none",
		};
		clients[client] = { id: -1, action: "none" };
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

function handleCycle() {
	for (let i = 0; i < clients.length; i++) {
		if (clients[i].id == -1) {
			continue;
		}
		let didAction = false;
		switch (clients[i].action) {
			case "moveLeft":
				entities[clients[i].id].posX -= 1;
				didAction = true;
				break;
			case "moveRight":
				entities[clients[i].id].posX += 1;
				didAction = true;
				break;
			case "moveUp":
				entities[clients[i].id].posY -= 1;
				didAction = true;
				break;
			case "moveDown":
				entities[clients[i].id].posY += 1;
				didAction = true;
				break;
		}
		clients[i].action = "none";
		if (didAction) {
			let actionEvent = {
				messageType: "updateStatus",
				messageBody: {
					actor: i,
					newState: entities[clients[i].id],
				},
			};
			updateEvents.push(JSON.stringify(actionEvent));
		}
	}
	for (let i = 0; i < updateEvents.length; i++) {
		broadcast(updateEvents[i]);
	}
	updateEvents = [];
}

setInterval(handleCycle, 1000);
