let usernameInput = document.getElementById("username");
let passwordInput = document.getElementById("password");
let submitButton = document.getElementById("submit");
let errorMessage = document.getElementById("errorMessage");
let successMessage = document.getElementById("successMessage");

submitButton.addEventListener("click", () => {
    var request = fetch('/login', {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });

    // making sure that request was successful
    request.then(async (response) => {
        successMessage.textContent = "";
        errorMessage.textContent = "";

        let body = await response.json();
        if (response.status >= 400) {
            errorMessage.textContent = body.error;
        }

        else {
            successMessage.textMessage = "Login successful";
        }
    })
});