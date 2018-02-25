const monk = require('monk');
const superstruct = require("superstruct");
const tpicker = require("tpicker");
const tcacher = require('tcacher');

module.exports = function db(config) {
    const db = {
        daos: config.registry || {},
        defaultPageSize: config.pageSize || 20,
        db: monk(config.uri),
        prepareDao: function(dao) {
            db.daos[dao.collectionName] = dao;
            return prepareDAO(dao, db);
        }
    };
    return db;
}

function prepareDAO(dao, db) {
    if (dao.collection)
        throw new Error('dao already has collection');
    if (dao.picker)
        throw new Error('dao already has picker');
    if (dao.verifySchema)
        throw new Error('dao already has verifySchema');
    if (dao.db)
        throw new Error('dao already has db');
    var collectionName = dao.collectionName;
    var collection = db.db.get(collectionName);
    dao.collection = collection;
    dao.schema._id = 'string?';
    dao.db = db;
    var verifySchema = superstruct.struct(dao.schema);
    var picker = tpicker.createPicker(dao.schema);
    dao.picker = picker;
    dao.verifySchema = verifySchema;
    dao.insert = function(item) {
        verifySchema(item);
        return collection.insert(picker(item));
    };
    addSchemaMethods(dao, dao.schema);
    return dao;
}

function addSchemaMethods(dao, schema, prefix = '') {
    Object.keys(schema).forEach(propName => {
        var addName = prefix + propName[0].toUpperCase() + propName.slice(1).toLowerCase();
        if (typeof(schema[propName]) === 'object') {
            if (Array.isArray(schema[propName])) {
                if (typeof(schema[propName][0]) == 'object') {
                    addSchemaMethods(dao, schema[propName], addName);
                } else {
                    addschemaPropertyMethods(dao, addName, propName);
                }
            } else {
                addSchemaMethods(dao, schema[propName], addName);
            }
        } else {
            addschemaPropertyMethods(dao, addName, propName);
        }
    });
}

function addschemaPropertyMethods(dao, addName, propName) {
    dao['getBy' + addName] = tcacher.toCachingFunction(function(value, page, pageSize) {
        var finder = dao.collection.find({
            [propName]: { $in: toArray(value) }
        });
        if (page) {
            pagesize = pagesize || dao.db.defaultPageSize;
            console.log('skip', page, pagesize);
            finder = finder.skip(pagesize * page);
            finder = finder.limit(pagesize);
        }
        return finder.then(a => {
            //console.log(a)
            return a.map(a => a);
        });
    }, { resultProp: propName });
    dao['getOneBy' + addName] = function(value, page, pageSize) {
        return dao['getBy' + addName](value).then(r => r[0]);
    };
    dao['removeBy' + addName] = function(value, connection) {
        return dao.collection.remove({
            [propName]: { $in: toArray(value) }
        });
    };
}

function toArray(item) {
    if (Array.isArray(item)) return item;
    return [item]
}