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
let entities = new Map();

// Queue of update events
let updateEvents = [];

// Clients map
let clients = new Map();

// redirecting users to login.html as the base landing page
app.get("/", (req, res) => {
	return res.sendFile(__dirname + "/web/login.html");
});

LoginLogout(app, pool, tokenStorage);

// moved this below all the other route matching so that our predefined routes for files takes precedence
// we need to have such override to add middleware authentication that only shows login and registration page when the user is not logged in already
app.use(express.static("web"));

// Create HTTP server and attach the WebSocket server to it
const server = http.createServer(app);
server.listen(port, hostname, () => {
	console.log(`Server running on http://${hostname}:${port}`);
});

// Set up the WebSocket server
const wss = new ws.WebSocketServer({ server });
wss.on("connection", (client, req) => {
	console.log("New client connected!");
	let authToken = req.headers.cookie?.split(";").find((data) => data.startsWith("authToken="))?.split("=")[1];
	let username = tokenStorage[authToken];

	// Send current entities to the new client
	let clientUpdateMessage = {
		messageType: "refresh",
		messageBody: Array.from(entities.values()), // Convert Map values to array
	};
	client.send(JSON.stringify(clientUpdateMessage));

	// Check if the player already exists
	if (entities.has(username)) {
		// Update the existing entity
		let existingEntity = entities.get(username);
		existingEntity.client = client;
		clients.set(client, { id: username, action: "none" });
	} else {
		// Create a new entity for the player
		let newEntity = {
			entityType: "player",
			posX: Math.floor(Math.random() * 8),
			posY: Math.floor(Math.random() * 8),
			id: username // Use the username as the id
		};
		let newEntityMessage = {
			messageType: "spawn",
			messageBody: newEntity,
		};
		clients.set(client, { id: username, action: "none" });
		entities.set(username, newEntity); // Add new entity to the Map

		updateEvents.push(JSON.stringify(newEntityMessage));
	}

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
			 entities.delete(clientData.id); // Remove entity from the Map
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
	for (let [, clientData] of clients.entries()) {
		if (!clientData || !entities.has(clientData.id)) {
			continue;
		}
		
		let entity = entities.get(clientData.id);
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
