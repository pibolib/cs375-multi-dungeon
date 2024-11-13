let usernameInput = document.getElementById("username");
let passwordInput = document.getElementById("password");
let submitButton = document.getElementById("submit");
let errorMessage = document.getElementById("errorMessage");
let successMessage = document.getElementById("successMessage");

submitButton.addEventListener("click", () => {
    var request = fetch('/register', {
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
        if (response.status >= 400) {
            let body = await response.json();
            let errors = body.error;
            if (errors.hasOwnProperty("usernameErrors") && errors.usernameErrors.length > 0) {
                for (let error of errors.usernameErrors) {
                    let errorDiv = document.createElement("div");
                    errorDiv.textContent = error;
                    errorMessage.append(errorDiv);
                }
            }
            if (errors.hasOwnProperty("passwordErrors") && errors.passwordErrors.length > 0) {
                for (let error of errors.passwordErrors) { 
                    let errorDiv = document.createElement("div");
                    errorDiv.textContent = error;
                    errorMessage.append(errorDiv);
                }
            }
            if (typeof errors == "string") {
                errorMessage.textContent = errors;
            }
        }

        else {
            console.log("Success");
            successMessage.textContent = "Registered successful";
            window.location.replace("/login.html");   
        }
    })
});