const { Utils } = require("./utils.js");
const argon2 = require("argon2");
const crypto = require("crypto");

/* returns a random 32 byte string */
function makeToken() {
	return crypto.randomBytes(32).toString("hex");
}

// must use same cookie options when setting/deleting a given cookie with res.cookie and res.clearCookie
// or else the cookie won't actually delete
// remember that the token is essentially a password that must be kept secret
let cookieOptions = {
	httpOnly: true, // client-side JS can't access this cookie; important to mitigate cross-site scripting attack damage
	secure: true, // cookie will only be sent over HTTPS connections (and localhost); important so that traffic sniffers can't see it even if our user tried to use an HTTP version of our site, if we supported that
	sameSite: "strict", // browser will only include this cookie on requests to this domain, not other domains; important to prevent cross-site request forgery attacks
};

function validateNewCreds(body) {
    let usernameErrors = validateUsername(body.username);
    let passwordErrors = validatePassword(body.password);

    if (usernameErrors.length == 0 && passwordErrors.length == 0) {
        return {}
    }

    return {usernameErrors: usernameErrors, passwordErrors: passwordErrors}
}

function validateUsername(username) {
    let errors = [];

    // length
    if (username.length < 4 || username.length > 20) {
        errors.push("Username should be 4 to 20 characters long");
    }

    return errors;
}

function validatePassword(password) {
    let errors = [];
    const minLength = 8;
    const maxLength = 50;
    const hasUpperCase = /[A-Z]/;
    const hasLowerCase = /[a-z]/;
    const hasNumber = /[0-9]/;
    const hasSpecialChar = /[!@#&*_]/;

    // length
    if (password.length < minLength || password.length > maxLength) {
        errors.push("Password should be 8 to 50 characters long.");
    }

    if (!hasUpperCase.test(password)) {
        errors.push("Password must contain at least one uppercase letter.");
    }
    if (!hasLowerCase.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
    }
    if (!hasNumber.test(password)) {
    errors.push("Password must contain at least one number.");
    }
    if (!hasSpecialChar.test(password)) {
    errors.push("Password must contain at least one of the following special character: !@#&*_");
    }

    return errors;
}

async function usernameExists(username, pool) {
    try {
        let result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.log("SELECT FAILED", error);
        return true;
    }
}

function redirectIfAuthenticated(req, res, tokenStorage) {
    let authToken = req.cookies.authToken;
    if (authToken) {
        return res.redirect("/game.html");
    }
    return null;
}

exports.LoginLogout = (app, pool, tokenStorage) => {

    // overriding the default get handling for login.html and register.html
    // making sure that the user only sees these pages if they are not logged in

    app.get("/login.html", (req, res) => {
        console.log(req.cookies);
        if (redirectIfAuthenticated(req, res, tokenStorage)) {
            return;
        }

        return res.sendFile(__dirname + "/web/login.html");
    });

    app.get("/register.html", (req, res) => {
        console.log("register");
        console.log(req.cookies);
        if (redirectIfAuthenticated(req, res, tokenStorage)) {
            return;
        }

        return res.sendFile(__dirname + "/web/register.html");
    });

    app.post("/register", async (req, res) => {
        let { body } = req;

        // validating the credentials
        let credValidationErrors = validateNewCreds(body);
        if (!Utils.isEmpty(credValidationErrors)) {
            res.statusCode = 400;
            return res.json({error: credValidationErrors});
        }

        let { username, password } = body;
        console.log(username, password);

        // making sure that the username does not exist
        let usernameTaken = await usernameExists(username, pool);
        if (usernameTaken) {
            res.statusCode = 400;
            return res.json({"error": "Username taken! Please choose a different username."});
        }

        // TODO: check if credentials meet requirements

        let hash;
        try {
            hash = await argon2.hash(password);
        }
        catch (error) {
            console.log("Hash Failed", error);
            res.statusCode = 500;
            return res.json({"error": "Internal server error: Hash failed. Please try again later."});
        }

        console.log(hash);

        try {
            await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hash]);
        }
        catch (error) {
            console.log("INSERT FAILED", error);
            res.statusCode = 500;
            return res.json({"error": "An error occured while creating your profile. Please try again later."});
        }

        // TODO log in people automatically
        return res.status(200).send();
    });

    app.post("/login", async (req, res) => {
        let { body } = req;

        // validate login

        let { username , password } = body;

        let result; 

        try {
            result = await pool.query(
                "SELECT password FROM users WHERE username = $1",
                [username],
            );
        }
        catch (error) {
            console.log("SELECT FAILED", error);
            res.statusCode = 500;
            return res.json({"error": "An internal error occured while fetching the user data. Please try again later."});
        }

        // username does not exist
        if (result.rows.length == 0) {
            res.statusCode = 400;
            return res.json({error: "An account with the given username does not exist."});
        }

        let hash  = result.rows[0].password;
        console.log(username, password, hash);
        
        let verifyResult;
        try {
            verifyResult = await argon2.verify(hash, password);
        }
        catch (error) {
            console.log("VERIFY FAILED", error);
            res.statusCode = 500;
            return res.json({error: "An internal error occured. Please try again later."});
        }

        // passwords did not match
        console.log(verifyResult);
        if (!verifyResult) {
            res.statusCode = 400;
            res.json({error: "The credentials did not match. Please enter the correct credentials or create a new account."});
        }

        let token = makeToken(crypto);
        tokenStorage[token] = username;
        return res.cookie("authToken", token, cookieOptions).send();
    });

    app.post("/logout", (req, res) => {
        let { token } = req.cookies;
      
        if (token === undefined) {
          console.log("Already logged out");
          return res.sendStatus(400); // TODO
        }
      
        if (!tokenStorage.hasOwnProperty(token)) {
          console.log("Token doesn't exist");
          return res.sendStatus(400); // TODO
        }
      
        console.log("Before", tokenStorage);
        delete tokenStorage[token];
        console.log("Deleted", tokenStorage);
      
        return res.clearCookie("authToken", cookieOptions).send();
    });
}