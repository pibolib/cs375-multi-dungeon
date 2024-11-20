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

// Entities in the game world
let entities = [];

// Queue of update events
let updateEvents = [];

// Clients map
let clients = new Map();

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

	// Send current entities to the new client
	let clientUpdateMessage = {
		messageType: "refresh",
		messageBody: entities,
	};
	client.send(JSON.stringify(clientUpdateMessage));

	// Create a new entity for the player
	let newEntity = {
		entityType: "player",
		posX: Math.floor(Math.random() * 8),
		posY: Math.floor(Math.random() * 8),
	};
	let newEntityMessage = {
		messageType: "spawn",
		messageBody: newEntity,
	};
	clients.set(client, { id: entities.length, action: "none" });
	entities.push(newEntity);

	updateEvents.push(JSON.stringify(newEntityMessage));

	// Handle messages from the client
	client.on("message", (message) => {
		try {
			let messageObject = JSON.parse(message);
			console.log(`New message: ${message}`);
			let clientData = clients.get(client);

			if (messageObject.messageType == "chat") {
				broadcast(message);
			} else if (clientData) {
				switch (messageObject.messageType) {
					case "moveLeft":
						clientData.action = "moveLeft";
						break;
					case "moveRight":
						clientData.action = "moveRight";
						break;
					case "moveUp":
						clientData.action = "moveUp";
						break;
					case "moveDown":
						clientData.action = "moveDown";
						break;
				}
				console.log(`Client ${client} action: ${clientData.action}`);
			}
		} catch (error) {
			console.error("Error processing message:", error);
		}
	});

	client.on("close", () => {
		let clientData = clients.get(client);

		if (clientData) {
			let despawnMessage = {
				messageType: "despawn",
				messageBody: { id: clientData.id },
			};

			updateEvents.push(JSON.stringify(despawnMessage));
			entities[clientData.id] = {
				entityType: "none",
			};
			clients.delete(client);
		}
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
	for (let [client, clientData] of clients.entries()) {
		if (clientData.id === -1) {
			continue;
		}

		let entity = entities[clientData.id];
		let didAction = false;

		switch (clientData.action) {
			case "moveLeft":
				entity.posX -= 1;
				didAction = true;
				break;
			case "moveRight":
				entity.posX += 1;
				didAction = true;
				break;
			case "moveUp":
				entity.posY -= 1;
				didAction = true;
				break;
			case "moveDown":
				entity.posY += 1;
				didAction = true;
				break;
		}
		clientData.action = "none";
		if (didAction) {
			let actionEvent = {
				messageType: "updateStatus",
				messageBody: {
					actor: clientData.id,
					newState: entity,
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
