const ws = new WebSocket(`ws://${window.document.location.host}`);
let players = new Map();
const app = new PIXI.Application();

// Chat attributes
const messageDisplay = document.getElementById("messageDisplay");
const messageInput = document.getElementById("message");
const button = document.getElementById("submit");

app.init({
	backgroundColor: "#1099bb",
	width: window.innerWidth,
	height: window.innerHeight,
}).then(() => {
	document.body.appendChild(app.view);
	setUp();
});

// making sure that game resizes with screen
window.addEventListener("resize", () => {
	app.renderer.resize(window.innerWidth, window.innerHeight);
});

function setUp() {
	// Sending an update to the server when an arrow key is pressed
	document.addEventListener("keydown", (event) => {
		const key = event.key;
		let message = {};

		switch (key) {
			case "ArrowLeft":
				message.messageType = "moveLeft";
				break;
			case "ArrowRight":
				message.messageType = "moveRight";
				break;
			case "ArrowUp":
				message.messageType = "moveUp";
				break;
			case "ArrowDown":
				message.messageType = "moveDown";
				break;
		}

		if (message.hasOwnProperty("messageType")) {
			ws.send(JSON.stringify(message));
		}
	});

	ws.addEventListener("message", (event) => {
		console.log(event);
		let message = JSON.parse(event.data);
		if (message != null) {
			updateGame(message);
		}
	});

	// Chat
	button.addEventListener("click", (event) => {
		event.preventDefault();
		let message = {
			messageType: "chat",
			messageBody: messageInput.value,
		};
		ws.send(JSON.stringify(message));
		messageInput.value = "";
	});
}

function updateGame(message) {
	switch (message.messageType) {
		case "chat":
			let newMessage = document.createElement("div");
			let messageText =
				message.messageBody.id + ": " + message.messageBody.text;
			newMessage.textContent = messageText;
			messageDisplay.append(newMessage);
		case "spawn":
			createPlayer(message.messageBody);
			break;
		case "updateStatus":
			players.get(message.messageBody.actor).x =
				message.messageBody.newState.posX * 50;
			players.get(message.messageBody.actor).y =
				message.messageBody.newState.posY * 50;
			// display the new information???
			break;
		case "refresh":
			app.stage.removeChildren();
			players = new Map();
			for (let newEntity of message.messageBody) {
				createPlayer(newEntity);
			}

		// TODO!
	}
}

async function createPlayer(messageBody) {
	if (messageBody.entityType === "player") {
		let texture = await PIXI.Assets.load("assets/bunny.png");
		let sprite = players.get(messageBody.id);

		if (!sprite) {
			sprite = new PIXI.Sprite(texture);
			sprite.anchor.set(0.5);
			app.stage.addChild(sprite);
		}

		sprite.x = messageBody.posX * 50;
		sprite.y = messageBody.posY * 50;
		players.set(messageBody.id, sprite);
	}
}
