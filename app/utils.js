class Utils {
    static isEmpty(obj) {
        return Object.keys(obj).length == 0;
    }

    static isAuthenticated(req, res, tokenStorage) {
        let authToken = req.cookies.authToken;
        return authToken && tokenStorage[authToken];
    }

    static redirectIfAuthenticated(req, res, tokenStorage, redirectTo) {
        if (this.isAuthenticated(req, res, tokenStorage)) {
            return res.redirect(redirectTo);
        }
        
        return null;
    }
    
}

module.exports = { Utils }