/* returns a random 32 byte string */
function makeToken(crypto) {
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

function validateLogin(body) {
    return true; 
}

function doesUsernameExists(username) {
    return false;
}

exports.LoginLogout = (app, argon2, cookieParser, crypto, pool, tokenStorage) => {
    app.post("/create", async (req, res) => {
        let { body } = req;
        
        console.log(req.body);

        // validate login details
        if (!validateLogin(body)) {
            return res.sendStatus(400);
        }

        let { username, password } = body;
        console.log(username, password);

        if (doesUsernameExists(username)) {
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
        return res.cookie("token", token, cookieOptions).send();
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
      
        return res.clearCookie("token", cookieOptions).send();
    });
}