const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./util/FBAuth');

const cors = require('cors');
app.use(cors());

const {db} = require('./util/admin');

const { getAllScreams,
        postOneScream,
        getScream,
        deleteScream,
        likeScream,
        unlikeScream,
        commentOnScream        
} = require('./handlers/screams');
const { signup, 
        login, 
        uploadImage, 
        addUserDetails, 
        getAuthenticatedUser,
        getUserDetails,
        markNotificationsRead
} = require('./handlers/users');

//=============Scream route===========
// get all scream route
app.get('/screams', getAllScreams)
// Post one scream
app.post('/scream', FBAuth, postOneScream)
app.get('/scream/:screamId', getScream);
// delete scream
app.delete('/scream/:screamId', FBAuth, deleteScream);
// like a scream
app.get('/scream/:screamId/like', FBAuth, likeScream);
// unlike a scream
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
// comment on scream
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

// ==============user routes====================
//Signup route
app.post('/signup', signup);
// login route
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

//https://baseurl.com/api/ === api prefix

// ==========Creating functions in firebase======================= 

exports.api = functions.region('asia-east2').https.onRequest(app);

exports.createNotificationOnLike = functions.region('asia-east2')
.firestore.document('likes/{id}')
.onCreate((snapshot) => {
    console.log(`ScreamID: ${snapshot.data().screamId}`)
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
    .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                screamId: doc.id
            });
        }
    })
    .catch(err => {
        console.error(err);
    })
})

exports.deleteNotificationOnUnlike = functions.region('asia-east2')
.firestore.document('likes/{id}')
.onDelete((snapshot) => {
   return db.doc(`/notifications/${snapshot.id}`)
   .delete()
   .catch((err) => {
       console.error(err);
       return;
   })
})

exports.createNotificationOnComment = functions.region('asia-east2')
.firestore.document('comments/{id}')
.onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
    .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                screamId: doc.id
            });
        }
    })
    .catch(err => {
        console.error(err);
        return;
    })
})

exports.onUserImageChange = functions.region('asia-east2')
.firestore.document('/users/{userId}')
.onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    const batch = db.batch();
    if(change.before.data().imageUrl !== change.after.data().imageUrl){
        console.log("image has changed");
        return db.collection('screams')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
            data.forEach(doc => {
                const scream = db.doc(`/screams/${doc.id}`);
                batch.update(scream, {userImage: change.after.data().imageUrl});
            })
            return batch.commit();
        })
    } else {
        return true;
    }    
});


exports.onScreamDelete =  functions.region('asia-east2')
.firestore.document('/screams/{screamId}')
.onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db.collection('comments').where('screamId', '==', screamId).get()
        .then(data => {
            data.forEach(doc => {
                batch.delete(db.doc(`/comments/${doc.id}`));
            })
            return db.collection('likes').where('screamId', '==', screamId).get();
        })
        .then(data => {
            data.forEach(doc => {
                batch.delete(db.doc(`/likes/${doc.id}`));
            })
            return db.collection('notifications').where('screamId', '==', screamId).get();
        })
        .then(data => {
            data.forEach(doc => {
                batch.delete(db.doc(`/notifications/${doc.id}`));
            })
            return batch.commit();
        })
        .catch(err => console.error(err))
})