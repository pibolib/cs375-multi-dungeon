const ws = new WebSocket(`ws://${window.document.location.host}`);
ws.binaryType = "blob";

const messageDisplay = document.getElementById("messageDisplay");
const messageInput = document.getElementById("message");
const button = document.getElementById("submit");

button.addEventListener("click", () => {
    let message = messageInput.value;
    ws.send(message);
    messageInput.value = "";
});

ws.addEventListener("open", () => {
    console.log("Web socket connection opened");
});

ws.addEventListener("close", () => {
    console.log("Web socket connection closed");
});

ws.addEventListener("message", (event) => {
    console.log('works');
    let newMessage = document.createElement("div");
    if (event.data instanceof Blob) {
        reader = new FileReader();
        reader.addEventListener("load", () => {
            newMessage.textContent = reader.result;
            messageDisplay.append(newMessage);
        });
        reader.readAsText(event.data);
    }
    else {
        newMessage.textContentc = event.data;
        messageDisplay.append(newMessage);
    }
});