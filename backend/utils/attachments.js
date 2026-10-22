const mongoose = require("mongoose");
const Attachment = require("../models/Attachment");

// An error that carries the HTTP status the route should answer with
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// What a request may say about an attachment:
//   undefined      -> not mentioned (leave things as they are)
//   null or ""     -> remove it
//   an id          -> use that picture (it must belong to this user)
// Returns undefined, null, or the id.
async function ownedAttachmentId(userId, value) {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    if (!mongoose.isValidObjectId(value)) {
        throw new HttpError(400, "That attached picture is not valid.");
    }

    const found = await Attachment.exists({ _id: value, user: userId });
    if (!found) throw new HttpError(400, "That attached picture was not found.");

    return String(value);
}

// Deletes a picture (ignores empty ids)
async function removeAttachment(userId, id) {
    if (!id) return;
    await Attachment.deleteOne({ _id: id, user: userId });
}

// Makes an independent copy, so a transaction and a debt payment can each own one
async function cloneAttachment(userId, id) {
    if (!id) return null;

    const original = await Attachment.findOne({ _id: id, user: userId });
    if (!original) return null;

    const copy = await Attachment.create({
        user: userId,
        mime: original.mime,
        data: original.data,
        size: original.size
    });

    return copy._id;
}

module.exports = { HttpError, ownedAttachmentId, removeAttachment, cloneAttachment };
