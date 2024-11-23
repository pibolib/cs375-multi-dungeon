let usernameInput = document.getElementById("username");
let passwordInput = document.getElementById("password");
let submitButton = document.getElementById("submit");
let errorMessage = document.getElementById("errorMessage");
let successMessage = document.getElementById("successMessage");

submitButton.addEventListener("click", async (event) => {
    event.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";

    try {
        let response = await fetch('/login', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
        });

        if (response.status >= 400) {
            let body = await response.json();
            errorMessage.textContent = body.error;
        } else {
            successMessage.textContent = "Login successful!";
            window.location.replace("/game.html");
        }
    } catch (error) {
        errorMessage.textContent = "Something went wrong. Please try again later.";
        console.error("Login Error:", error);
    }
});
