const admin = require('firebase-admin');
require('dotenv').config();

admin.initializeApp({
    credential: admin.credential.cert(require('./socialAppCredential.json')),
    storageBucket: process.env.STORAGEBUCKET
});

const db = admin.firestore();

module.exports = {admin, db};
