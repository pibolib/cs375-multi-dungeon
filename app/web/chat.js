const ws = new WebSocket(`ws://${window.document.location.host}`);
ws.binaryType = "blob";

const messageDisplay = document.getElementById("messageDisplay");
const messageInput = document.getElementById("message");
const button = document.getElementById("submit");

const gamestateDisplay = document.getElementById("gamestateDisplay");

let gamestate = {};

button.addEventListener("click", () => {
	let message = {
		messageType: "chat",
		messageBody: messageInput.value,
	};
	ws.send(JSON.stringify(message));
	messageInput.value = "";
});

ws.addEventListener("open", () => {
	console.log("Web socket connection opened");
});

ws.addEventListener("close", () => {
	console.log("Web socket connection closed");
});

ws.addEventListener("message", (event) => {
	let eventObject = JSON.parse(event.data);
	if (eventObject.messageType == "chat") {
		let newMessage = document.createElement("div");
		newMessage.textContent = eventObject.messageBody;
		messageDisplay.append(newMessage);
	} else if (eventObject.messageType == "refresh") {
		gamestate = eventObject.messageBody;
		gamestateDisplay.textContent = JSON.stringify(gamestate);
	} else if (eventObject.messageType == "spawn") {
		gamestate.push(eventObject.messageBody);
		gamestateDisplay.textContent = JSON.stringify(gamestate);
	} else if (eventObject.messageType == "despawn") {
		gamestate[eventObject.messageBody] = {
			entityType: "none",
		};
		gamestateDisplay.textContent = JSON.stringify(gamestate);
	}

	/*
    if (event.data instanceof Blob) {
        reader = new FileReader();
        reader.addEventListener("load", () => {
            newMessage.textContent = reader.result;
            messageDisplay.append(newMessage);
        });
        reader.readAsText(event.data);
    }
    else {
    }
    */
});
