const ws = require("ws");
const express = require("express");
const http = require("http");
const { Pool } = require("pg");
const cookieParser = require("cookie-parser");
const { Utils } = require("./utils.js");
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

app.get("/game.html", (req, res) => {
	if (!Utils.isAuthenticated(req, res, tokenStorage)) {
		return res.sendFile(__dirname + "/web/login.html");
	}

	return res.sendFile(__dirname + "/web/game.html");
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
	let authToken = req.headers.cookie
		?.split(";")
		.find((data) => data.startsWith("authToken="))
		?.split("=")[1];
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
			hp: 10,
			mhp: 10,
			xp: 0,
			mxp: 10,
			str: 2,
			lvl: 1,
			id: username, // Use the username as the id
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
			let clientData = clients.get(client);

			if (messageObject.messageType == "chat") {
				// adding client id
				let messageText = messageObject.messageBody;
				messageObject.messageBody = {
					id: clientData.id,
					text: messageText,
				};
				broadcast(JSON.stringify(messageObject));
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
	console.log("Broadcasting message:", message);
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
				if (
					entityAtPosition(
						entity.posX - 1,
						entity.posY,
						clientData.id
					)
				) {
					damageEntity(
						clientData.id,
						entityAtPosition(
							entity.posX - 1,
							entity.posY,
							clientData.id
						)
					);
				} else {
					entity.posX -= 1;
				}
				didAction = true;
				break;
			case "moveRight":
				if (
					entityAtPosition(
						entity.posX + 1,
						entity.posY,
						clientData.id
					)
				) {
					damageEntity(
						clientData.id,
						entityAtPosition(
							entity.posX + 1,
							entity.posY,
							clientData.id
						)
					);
				} else {
					entity.posX += 1;
				}
				didAction = true;
				break;
			case "moveUp":
				if (
					entityAtPosition(
						entity.posX,
						entity.posY - 1,
						clientData.id
					)
				) {
					damageEntity(
						clientData.id,
						entityAtPosition(
							entity.posX,
							entity.posY - 1,
							clientData.id
						)
					);
				} else {
					entity.posY -= 1;
				}
				didAction = true;
				break;
			case "moveDown":
				if (
					entityAtPosition(
						entity.posX,
						entity.posY + 1,
						clientData.id
					)
				) {
					damageEntity(
						clientData.id,
						entityAtPosition(
							entity.posX,
							entity.posY + 1,
							clientData.id
						)
					);
				} else {
					entity.posY += 1;
				}
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

function entityAtPosition(x, y, callerId) {
	for (entity of entities) {
		if (entity[0] == callerId) {
			continue;
		}
		if (entity[1].posX != x || entity[1].posY != y) {
			continue;
		}
		return entity[0];
	}
	return false;
}

function damageEntity(callerId, targetId) {
	let caller = entities.get(callerId);
	let target = entities.get(targetId);
	target.hp -= caller.str;
	caller.xp += caller.str;
	broadcast(
		JSON.stringify({
			messageType: "chat",
			messageBody: {
				id: "Server",
				text: `${callerId} deals ${caller.str} damage to ${targetId}!`,
			},
		})
	);
	if (target.hp <= 0) {
		target.posX = Math.floor(Math.random() * 8);
		target.posY = Math.floor(Math.random() * 8);
		target.hp = target.mhp;
		broadcast(
			JSON.stringify({
				messageType: "chat",
				messageBody: { id: "Server", text: `${targetId} has died!` },
			})
		);
	}
	let updateEvent = {
		messageType: "updateStatus",
		messageBody: {
			actor: targetId,
			newState: target,
		},
	};
	updateEvents.push(JSON.stringify(updateEvent));
	if (caller.xp >= caller.mxp) {
		broadcast(
			JSON.stringify({
				messageType: "chat",
				messageBody: {
					id: "Server",
					text: `${callerId} levels up! (${caller.lvl} -> ${
						caller.lvl + 1
					})`,
				},
			})
		);
		caller.xp -= caller.mxp;
		caller.mxp = Math.floor(caller.mxp * 1.2);
		caller.str += 1;
		caller.lvl += 1;
		caller.mhp += 2;
		caller.hp = caller.mhp;
		let updateEventCaller = {
			messageType: "updateStatus",
			messageBody: {
				actor: callerId,
				newState: caller,
			},
		};
		updateEvents.push(JSON.stringify(updateEventCaller));
	}
}

setInterval(handleCycle, 100);
