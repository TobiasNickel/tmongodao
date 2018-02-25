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
    }
})

userDao.insert({
    name: 'tobias',
    email: 'tobias@tnickel.de',
}).then(() => {
    return userDao.getOneByName('tobias');
}).then(tobias => {
    console.log('tobias:', tobias)
    return userDao.removeByName('tobias');
}).then(_ => {
    console.log('done');
    process.exit();
}).catch(err => {
    console.log(err);
    process.exit();
});