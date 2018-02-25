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
    var verifySchema = superstruct.struct(dao.schema, dao.defaults || {});
    var picker = tpicker.createPicker(dao.schema);
    dao.picker = picker;
    dao.verifySchema = verifySchema;
    dao.insert = function(item) {
        verifySchema(item);
        return collection.insert(picker(item));
    };
    //todo:dao.remove
    //todo:dao.find
    //todo:dao.where
    //todo:dao.oneWhere
    //todo:dao.search
    //todo:dao.dropTable
    //todo:indexes
    addSchemaMethods(dao, dao.schema);
    Object.keys(dao.relations || {}).forEach(relationName => {
        var relationConfig = normalizeRelationConfig(dao.relations[relationName], relationName, collectionName)
        var addName = relationName[0].toUpperCase() + relationName.slice(1).toLowerCase();
        dao['fetch' + addName] = function(entities) {
            entities = toArray(entities);
            var values = entities.map(value => value[relationConfig.localKey]);
            var findPromise;
            if (db.daos[relationConfig.collection]) {
                var collectionAddName = relationConfig.foreignKey[0].toUpperCase() + relationConfig.foreignKey.slice(1).toLowerCase();
                console.log(collectionAddName)
                findPromise = db.daos[relationConfig.collection]['getBy' + collectionAddName](values)
            } else {
                findPromise = db.db.get(relationConfig.collection).find({ $in: values })
            }
            return findPromise.then(result => {
                var resultMap = groupBy(result, relationConfig.foreignKey);
                var entitiesMap = groupBy(entities, relationConfig.localKey);
                result.forEach(r => {
                    entitiesMap[r[relationConfig.foreignKey]].forEach(entitiy => {
                        if (relationConfig.many) {
                            if (!entitiy[relationName]) entitiy[relationName] = [];
                            entitiy[relationName].push(r);
                        } else {
                            entitiy[relationName] = r;
                        }
                    });
                });
                return result;
            })

        }
    });
    return dao;
}

function normalizeRelationConfig(config, relationName, localCollectionName) {
    if (typeof(config) != 'object') config = {};
    return {
        collection: config.collection || relationName,
        localKey: config.localKey || '_id',
        foreignKey: config.foreignKey || localCollectionName,
        multiple: config.multiple != undefined ? config.multiple : true
    };
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

function groupBy(collection, propname) {
    var result = {};
    collection.forEach(item => {
        if (!result[item[propname]]) result[item[propname]] = [];
        result[item[propname]].push(item);
    })
    return result;
}

function toArray(item) {
    if (Array.isArray(item)) return item;
    return [item]
}