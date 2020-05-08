const expect = require('expect');
const tmongodao = require('../index');
const tfilemonk = require('tfilemonk');
const fs = require('fs');

const filename = 'testdata.js';
//try{fs.unlinkSync(filename);}catch(err){}
tfilemonk({ filename });

var mongoDao = tmongodao({
    uri: 'mongodb://localhost:27017/tmongodaotest'
});

const userDao = mongoDao.prepareDao({
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
        pictures: { collection: 'picture', localKey: '_id', foreignKey: 'uploaderId', multiple: true },
        myPictureComments:  { collection: 'pictureComment', localKey: '_id', foreignKey: 'senderId', multiple: true },
        allPictureComments: { type:'indirect', path:'picture.comments'},
    }
});
// console.log(Object.keys(userDao))
const pictureDao = mongoDao.prepareDao({
    collectionName: 'picture',
    schema: {
        name: 'string?',
        url: 'string',
        uploaderId: 'string?',
        tags: ['string?']
    },
    defaults: {

    },
    relations: {
        // to load pictures from a pictures dao or collection
        uploader: { collection: 'user', localKey: 'uploaderId', foreignKey: '_id', multiple: false },
        comments: { collection: 'pictureComment', localKey: '_id', foreignKey: 'pictureId', multiple: true },
        latestComments: { collection: 'pictureComment', localKey: '_id', foreignKey: 'pictureId', multiple: true },
    }
});

const pictureCommentDao = mongoDao.prepareDao({
    collectionName: 'pictureComment',
    schema: {
        text: 'string',
        pictureId: 'string',
        senderId: 'string',
    },
    defaults: {

    },
    relations: {
        // to load pictures from a pictures dao or collection
        picture: { collection: 'picture', localKey: 'pictureId', foreignKey: '_id', multiple: false },
        sender: { collection: 'user', localKey: 'senderId', foreignKey: '_id', multiple: false },
    }
});

after(() => {
    fs.unlinkSync(filename);
    process.exit();

});

describe('prepareDao', () => {
    it('can initialize new db', () => {
        mongoDao = tmongodao({
            uri: 'mongodb://localhost:27017/' + parseInt(Math.random() * Math.pow(2, 51))
        });
    })
    it('verify the dao', () => {
        var dao = {
            collectionName: 'somecollection1',
            schema: {
                name: 'string?',
            },
            defaults: {

            },
            relations: {
                // to load pictures from a pictures dao or collection
                uploader: { collection: 'user', localKey: 'uploaderId', foreignKey: "_id", multiple: true }
            }
        };
        mongoDao.prepareDao(dao);
        expect(()=>{
            delete mongoDao.registry.somecollection1
            mongoDao.prepareDao(dao);
        }).toThrow('dao already has collection');
        expect(()=>{
            delete mongoDao.registry.somecollection1
            delete dao.collection;
            mongoDao.prepareDao(dao);
        }).toThrow('dao already has picker');
        expect(()=>{
            delete mongoDao.registry.somecollection1
            delete dao.collection;
            delete dao.picker;
            mongoDao.prepareDao(dao);
        }).toThrow('dao already has verifySchema');
        expect(()=>{
            delete mongoDao.registry.somecollection1
            delete dao.collection;
            delete dao.picker;
            delete dao.verifySchema;
            mongoDao.prepareDao(dao);
        }).toThrow('dao already has db');
        expect(()=>{
            delete mongoDao.registry.somecollection1
            delete dao.collection;
            delete dao.picker;
            delete dao.db;
            mongoDao.prepareDao(dao);
        }).not.toThrow();
    })
    it('fail when two times the same dao is registered to registry', () => {
        mongoDao.prepareDao({
            collectionName: 'somecollection',
            schema: {
                name: 'string?',
            },
            defaults: {

            },
            relations: {
                // to load pictures from a pictures dao or collection
                uploader: { collection: 'user', localKey: 'uploaderId', foreignKey: "_id", multiple: true }
            }
        });
        var wasFailed = false;
        var wasFinished = false;
        try {
            mongoDao.prepareDao({
                collectionName: 'somecollection',
                schema: {
                    name: 'string?',
                },
                defaults: {

                },
                relations: {
                    // to load pictures from a pictures dao or collection
                    uploader: { collection: 'user', localKey: 'uploaderId', foreignKey: "_id", multiple: true }
                }
            });
            wasFinished = true;
        } catch (err) {
            wasFailed = true
        }
        expect(wasFailed).toBe(true);
        expect(wasFinished).toBe(false);
    })
});
describe('mongoDao', () => {
    it('should work', async () => {
        try{
        await userDao.insert({
            name: 'tobias',
            email: 'business@tnickel.de',
        });
        var tobias = await userDao.getOneByName('tobias');
        tobias.something = 'not interesting';
        await userDao.save(tobias);
        await pictureDao.insert({
            name: 'profilePicture',
            url: 'http://localhost:80/asdfsf.jpg',
            uploaderId: tobias._id,
            tags: ['tobias']
        });
        await userDao.fetchPictures(tobias);

        await userDao.removeBy_id(tobias._id);
        await pictureDao.removeByUploaderId(tobias._id);
    }catch(err){
        console.log(err)
        throw err;
    }
    })
})
