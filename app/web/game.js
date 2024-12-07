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
}).then(async () => {
	document.body.appendChild(app.view);
	await setUp();
});

// making sure that game resizes with screen
window.addEventListener("resize", () => {
	app.renderer.resize(window.innerWidth, window.innerHeight);
});

async function setUp() {
	// adding tiles
	// const tileTexture = await PIXI.Assets.load("assets/dungeon_tile.png");
	// tileTexture.zIndex = 0;
	// const tilingSprite = new PIXI.TilingSprite(tileTexture, app.screen.width, app.screen.height);
	// tilingSprite.zIndex = 0;
	// app.stage.addChild(tilingSprite);

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
			console.log(message);
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
			let player = players.get(message.messageBody.actor);
			let newState = message.messageBody.newState;
			if (player != null) {
				player.x = newState.posX * 50;
				player.y = newState.posY * 50;
		
				// updating the health bar
				let healthBarPercentage = newState.hp / newState.mhp;
				player.healthBar.width = 50 * healthBarPercentage;
			}
			break;
		case "refresh":
			// Only remove player sprites, not the background
			players.forEach((player) => {
				app.stage.removeChild(player);
			});
			players.clear();
			for (let newEntity of message.messageBody) {
				createPlayer(newEntity);
			}
			break;
		case "despawn":
			players.delete(message.messageBody);
		// TODO!
	}
}

async function createPlayer(messageBody) {
    if (messageBody.entityType === "player") {
        let texture = await PIXI.Assets.load("assets/bunny.png");
        let sprite = players.get(messageBody.id);

        if (!sprite) {
            sprite = new PIXI.Container();
			sprite.zIndex = 1;

            let playerSprite = new PIXI.Sprite(texture);
            playerSprite.anchor.set(0.5);
            sprite.addChild(playerSprite);

            let healthBar = new PIXI.Graphics();
            healthBar.beginFill(0xFF0000);
            healthBar.drawRect(-25, -40, 50, 5);
            healthBar.endFill();
            sprite.addChild(healthBar);

            sprite.playerSprite = playerSprite;
            sprite.healthBar = healthBar;

            app.stage.addChild(sprite);
        }

        sprite.x = messageBody.posX * 50;
        sprite.y = messageBody.posY * 50;
        players.set(messageBody.id, sprite);
    }
}
