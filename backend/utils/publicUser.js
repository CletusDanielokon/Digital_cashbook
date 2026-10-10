// The only user fields the browser is ever sent.
// Never includes the password hash or reset tokens.
module.exports = function publicUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        mobile: user.mobile,
        email: user.email,
        book: user.book,
        picture: user.picture || "",
        emailVerified: Boolean(user.emailVerified),
        mobileVerified: Boolean(user.mobileVerified),
        hasPassword: Boolean(user.password),
        hasGoogle: Boolean(user.googleId)
    };
};
