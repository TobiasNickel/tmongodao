const monk = require('monk');
const superstruct = require("superstruct");
const tpicker = require("tpicker");

module.exports = function db(config) {
    const db = {
        daos: config.registry || {},
        db: monk(config.uri),
        prepareDao: function(dao) {
            var collectionName = dao.collectionName;
            var collection = db.db.get(collectionName);
            dao.schema._id = 'string?';
            var verifySchema = superstruct.struct(dao.schema);
            var picker = tpicker.createPicker(dao.schema);
            dao.insert = function(item) {
                verifySchema(item)
                return collection.insert(picker(item));
            };
            Object.keys(dao.schema).forEach(propName => {
                var addName = propName[0].toUpperCase() + propName.slice(1).toLowerCase();
                dao['getBy' + addName] = function(value, page, pageSize) {
                    return collection.find({
                        [propName]: value
                    });
                };
                dao['getOneBy' + addName] = function(value, page, pageSize) {
                    return collection.findOne({
                        [propName]: value
                    });
                };
            });
            return dao
        }
    };
    return db;
}