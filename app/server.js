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

let port = process.env.PORT || 12789;
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

// Clients map
let clients = new Map();

let rooms = {
	room1: {
		messages: [],
		entities: [],
		clients: [],
		backgroundColor: "#87a96b",
		backgroundTexture: "assets/background.png",
		updateEvents: [],
		clientsNeedRefresh: false,
	},
	room2: {
		messages: [],
		entities: [],
		clients: [],
		backgroundColor: "#87a96b",
		backgroundTexture: "assets/background2.png",
		updateEvents: [],
		clientsNeedRefresh: false,
	},
	room3: {
		messages: [],
		entities: [],
		clients: [],
		backgroundColor: "#4a5d23",
		backgroundTexture: "assets/background3.png",
		updateEvents: [],
		clientsNeedRefresh: false,
	},
};

const defaultRoom = "room1";

// tells you how each room are connected with each other
const MAP = {
	room1: {
		North: "room2",
		South: "room2",
		East: "room2",
		West: "room2",
	},
	room2: {
		North: "room3",
		South: "room3",
		East: "room1",
		West: "room1",
	},
	room3: {
		North: "room2",
		South: "room2",
		East: "room1",
		West: "room1",
	},
};

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
app.use(express.static(__dirname + "/web/"));

// Create HTTP server and attach the WebSocket server to it
const server = http.createServer(app);
server.listen(port, () => {
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
			id: username, // Use the username as the id,
			room: defaultRoom,
		};
		let newEntityMessage = {
			messageType: "spawn",
			messageBody: newEntity,
		};
		clients.set(client, { id: username, action: "none" });
		entities.set(username, newEntity); // Add new entity to the Map

		// adding entity and  client to the room
		rooms[defaultRoom].entities.push(newEntity);
		rooms[defaultRoom].clients.push(client);

		rooms[defaultRoom].updateEvents.push(JSON.stringify(newEntityMessage));
	}

	// getting the entity
	let entity = entities.get(username);
	refresh(entity, client);

	// Handle messages from the client
	client.on("message", (message) => {
		try {
			let messageObject = JSON.parse(message);
			let clientData = clients.get(client);
			let entity = entities.get(clientData.id);
			let room = rooms[entity.room];

			if (messageObject.messageType == "chat") {
				// adding client id
				let messageText = `${clientData.id}: ${messageObject.messageBody.text}`;
				messageObject.messageBody = {
					text: messageText,
				};

				rooms[entity.room].messages.push(messageText);

				broadcast(JSON.stringify(messageObject), room);
			} else if (messageObject.messageType == "getRoomMessages") {
				let room = messageObject.messageBody.room;
				let messages = roomMessages[room] || [];
				messageObject = {
					messageType: "roomMessages",
					messageBody: messages,
				};
				client.send(JSON.stringify(messageObject));
			} else if (messageObject.messageType == "refresh") {
				let entity = entities.get(clientData.id);
				refresh(entity, client);
			} else if (clientData) {
				let isValidAction = false;
				switch (messageObject.messageType) {
					case "moveLeft":
						clientData.action = "moveLeft";
						isValidAction = true;
						break;
					case "moveRight":
						clientData.action = "moveRight";
						isValidAction = true;
						break;
					case "moveUp":
						clientData.action = "moveUp";
						isValidAction = true;
						break;
					case "moveDown":
						clientData.action = "moveDown";
						isValidAction = true;
						break;
				}

				if (isValidAction) {
					clientData.app = messageObject.app;
				}
			}
		} catch (error) {
			console.error("Error processing message:", error);
		}
	});

	client.on("close", () => {
		let clientData = clients.get(client);

		if (clientData) {
			let entity = entities.get(clientData.id);
			let room = rooms[entity.room];

			let despawnMessage = {
				messageType: "despawn",
				messageBody: { id: clientData.id },
			};

			room.updateEvents.push(JSON.stringify(despawnMessage));
			// remove client and entity
			room.clients = room.clients.filter((c) => c != client);
			room.entities = room.entities.filter((e) => e.id != clientData.id);

			clients.delete(client); // Remove client from the Map
			entities.delete(clientData.id); // Remove entity from the Map
		}
	});
});

function refresh(entity, client) {
	let refreshMessage = {
		messageType: "refresh",
		messageBody: rooms[entity.room]?.entities || [],
	};

	client.send(JSON.stringify(refreshMessage));
}

// Sends message to every client that is currently active
function broadcast(message, room) {
	for (let client of room.clients) {
		if (client.readyState === ws.OPEN) {
			client.send(message);
		}
	}
}

function handleCycle() {
	let room = rooms[defaultRoom];
	for (let [client, clientData] of clients.entries()) {
		if (!clientData || !entities.has(clientData.id)) {
			continue;
		}

		let entity = entities.get(clientData.id);
		room = rooms[entity.room];
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

			// checking if player entered a new room
			if (
				checkIfPlayerInNewRoom(
					entity,
					client,
					clientData.app.width,
					clientData.app.height
				)
			) {
				actionEvent.messageBody.newRoom = rooms[entity.room];

				// updating the room
				room = rooms[entity.room];
			}

			room.updateEvents.push(JSON.stringify(actionEvent));
		}
	}

	// going through each room and broadcasting the update events
	for (let roomName in rooms) {
		let room = rooms[roomName];
		broadcastUpdateEvents(room);
	}
}

function broadcastUpdateEvents(room) {
	for (let i = 0; i < room.updateEvents.length; i++) {
		broadcast(room.updateEvents[i], room);
	}

	// going through refresh
	if (room.clientsNeedRefresh) {
		for (let client of room.clients) {
			let entity = entities.get(clients.get(client).id);
			refresh(entity, client);
		}
		room.clientsNeedRefresh = false;
	}

	room.updateEvents = [];
}

function checkIfPlayerInNewRoom(entity, client, appWidth, appHeight) {
	// offseting by factor of 50 to match the scaling of how we send the player position on key movement
	appWidth = appWidth / 50;
	appHeight = appHeight / 50;

	let newRoomDirection = undefined;

	// Check if the player has reached the edge of the screen
	if (
		entity.posX < 0 ||
		entity.posX > appWidth ||
		entity.posY < 0 ||
		entity.posY > appHeight
	) {
		// Reset player position to the opposite edge of the new room
		if (entity.posX < 0) {
			entity.posX = appWidth;
			newRoomDirection = "West";
		} else if (entity.posX > appWidth) {
			entity.posX = 0;
			newRoomDirection = "East";
		}

		if (entity.posY < 0) {
			entity.posY = appHeight;
			newRoomDirection = "North";
		} else if (entity.posY > appHeight) {
			entity.posY = 0;
			newRoomDirection = "South";
		}
	}

	if (newRoomDirection) {
		console.log("old", rooms);
		// removing entity from rooms entities list
		let oldRoom = rooms[entity.room];
		let roomEntities = oldRoom.entities;
		let index = roomEntities.findIndex((e) => e.id == entity.id);
		roomEntities.splice(index, 1);

		// removing client from rooms clients list
		let roomClients = oldRoom.clients;
		let clientIndex = roomClients.findIndex((c) => c == client);
		roomClients.splice(clientIndex, 1);

		// needs refresh
		oldRoom.clientsNeedRefresh = true;

		let newRoom = MAP[entity.room][newRoomDirection];
		entity.room = newRoom;

		// adding entity and client to new room entities list
		rooms[newRoom].entities.push(entity);
		rooms[newRoom].clients.push(client);
		rooms[newRoom].clientsNeedRefresh = true;
		console.log("new", rooms);

		return true;
	}

	return false;
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
	let room = rooms[caller.room];
	target.hp -= caller.str;
	caller.xp += caller.str;
	broadcast(
		JSON.stringify({
			messageType: "chat",
			messageBody: {
				id: "Server",
				text: `${callerId} deals ${caller.str} damage to ${targetId}!`,
			},
		}),
		room
	);
	if (target.hp <= 0) {
		target.posX = Math.floor(Math.random() * 8);
		target.posY = Math.floor(Math.random() * 8);
		target.hp = target.mhp;
		broadcast(
			JSON.stringify({
				messageType: "chat",
				messageBody: { id: "Server", text: `${targetId} has died!` },
			}),
			room
		);
	}
	let updateEvent = {
		messageType: "updateStatus",
		messageBody: {
			actor: targetId,
			newState: target,
		},
	};
	room.updateEvents.push(JSON.stringify(updateEvent));
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
			}),
			room
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
		room.updateEvents.push(JSON.stringify(updateEventCaller));
	}
}

setInterval(handleCycle, 100);
