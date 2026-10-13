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
        // When the account was created. Older accounts without a createdAt fall back to the
        // time stored inside their _id, which is also the moment they were created.
        createdAt: user.createdAt || (user._id && user._id.getTimestamp ? user._id.getTimestamp() : null),
        hasGoogle: Boolean(user.googleId)
    };
};
