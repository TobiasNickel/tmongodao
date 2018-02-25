var tmongodao = require('../index');

var db = tmongodao({
    uri: 'mongodb://localhost:27017/tmysqldaotest'
});

var userDao = db.prepareDao({
    collectionName: 'user',
    schema: {
        name: 'string',
        email: 'string',
        age: 'number?'
    },
    defaults: {

    },
    relations: {
        // to load pictures from a pictures dao or collection
        pictures: { collection: 'pictures', localKey: '_id', foreignKey: "uploader", many: true }
    }
});
console.log(Object.keys(userDao))
var pictureDao = db.prepareDao({
    collectionName: 'pictures',
    schema: {
        name: 'string?',
        url: 'string',
        uploader: 'string?',
        tags: ['string?']
    },
    defaults: {

    },
    relations: {
        // to load pictures from a pictures dao or collection
        uploader: { collection: 'user', localKey: 'uploader', foreignKey: "_id", many: true }
    }
});

(async function() {
    await userDao.insert({
        name: 'tobias',
        email: 'tobias@tnickel.de',
    });
    var tobias = await userDao.getOneByName('tobias');
    tobias.something = 'not interesting';
    await userDao.save(tobias);
    await pictureDao.insert({
        name: 'profilePicture',
        url: 'http://localhost:80/asdfsf.jpg',
        uploader: tobias._id,
        tags: ['tobias']
    })
    await userDao.fetchPictures(tobias);
    console.log('tobias:', tobias)

    await userDao.removeBy_id(tobias._id);
    await pictureDao.removeByUploader(tobias._id);
    console.log('done');
    process.exit();
})().catch(err => {
    console.log(err);
    process.exit();
});