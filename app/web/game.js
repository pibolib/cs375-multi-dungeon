const ws = new WebSocket(`ws://${window.document.location.host}`);
let players = new Map();
const app = new PIXI.Application();

app.init({
	backgroundColor: "#1099bb",
	width: 500,
	height: 500,
}).then(() => {
	document.body.appendChild(app.view);
	setUp();
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
		let message = JSON.parse(event.data);
		if (message != null) {
			updateGame(message);
		}
	});
}

function updateGame(message) {
	console.log("message:", message);
	console.log("players:", players);
	switch (message.messageType) {
		case "spawn":
			createPlayer(message.messageBody);
			break;
		case "updateStatus":
			players.get(message.messageBody.actor).x =
				message.messageBody.newState.posX * 50;
			players.get(message.messageBody.actor).y =
				message.messageBody.newState.posY * 50;
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
		let sprite = new PIXI.Sprite(texture);
		sprite.anchor.set(0.5);
		sprite.x = messageBody.posX * 50;
		sprite.y = messageBody.posY * 50;
		app.stage.addChild(sprite);
		players.set(messageBody.id, sprite);
	}
}
