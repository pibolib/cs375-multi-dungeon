const ws = new WebSocket(`ws://${window.document.location.host}`);
const players = [];
const app = new PIXI.Application();

app.init({
    backgroundColor: "#1099bb",
    resizeTo: window
})
.then(() => {
    document.body.appendChild(app.view);
    setUp();
});

function setUp() {
    // Sending an update to the server when an arrow key is pressed
    document.addEventListener("keydown", (event) => {
        const key = event.key;
        let message = {
            messageType: "chat",
        };

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

        ws.send(JSON.stringify(message));
    });

    ws.addEventListener("message", (event) => {
        let message = JSON.parse(event.data);
        if (message != null) {
            updateGame(message);
        }
        console.log(message);
    });
}

function updateGame(message) {
    console.log("Message received:", message);
    switch (message.messageType) {
        case "spawn":
            console.log("Spawning player:", message.messageBody);
            createPlayer(message.messageBody);
            break;
    }
}

async function createPlayer(messageBody) {
    if (messageBody.entityType === "player") {
        console.log("yes");
        let sprite = new PIXI.Sprite(PIXI.Texture.from("images/bunny.png"));
        sprite.anchor.set(0.5);
        sprite.x = messageBody.posX * 50;
        sprite.y = messageBody.posY * 50;
        app.stage.addChild(sprite);
        players.push(sprite);
    }
}
