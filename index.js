const monk = require('monk');
const superstruct = require("superstruct");
const tpicker = require("tpicker");
const tcacher = require('tcacher');


module.exports = function db(config) {
    const db = {
        daos: config.registry || {},
        defaultPageSize: config.pageSize || 20,
        db: config.db || monk(config.uri),
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
    dao.map = dao.map || (_=>_);
    console.assert(typeof dao.map === 'function', 'map is not a function')
    dao.promiseMap = function(p) {
        return p.then(function(items) {
            if (typeof items !== 'object') return items;
            if (Array.isArray(items)) {
                var res = items.map(dao.map);
                res.resultCount = items.resultCount;
                res.pageCount = items.pageCount;
                return res;
            } else {
                //one item
                return dao.map(items)
            }
        });
    };
    
    proxyMonkCollectionMethods(dao);
    addGeneralDaoMethods(dao);
    addSchemaMethods(dao, dao.schema);
    addFetchSchemaMethods(dao);
    return dao;
}

function addGeneralDaoMethods(dao) {
    const picker = dao.picker;
    const verifySchema = dao.verifySchema;
    const collection = dao.collection;
    const map = dao.map;
    dao.insert = function(item) {
        if (Array.isArray(item))
            return Promise.all(item.map(dao.insert));
        const storeItem = picker(item);
        verifySchema(storeItem);
        return collection.insert(storeItem);
    };
    dao.save = function(item) {
        if (Array.isArray(item))
            return Promise.all(item.map(dao.save));
        if (!item._id)
            return dao.insert(item);
        const storeItem = picker(item);
        verifySchema(storeItem);
        return collection.update({ _id: item._id }, storeItem);
    };
    dao.remove = function(items) {
        if (!Array.isArray(items))
            items = [items];
        const ids = items.map(item => item._id);
        return collection.remove({ _id: { $in: ids } });
    };
    dao.find = (...args)=> ((...args) => {
        if (typeof(args[args.length - 1]) === 'number') {
            var pagesize = dao.db.defaultPageSize;
            if (typeof(args[args.length - 2]) === 'number') {
                pagesize = args.pop();
            }
            var page = args.pop();
            var finder = collection.find(...args);
            if (!finder.skip) {
                // mongo-mock does not have this method
                return finder.then(items=>items.slice(pagesize * page, pagesize * (page+1)));
            }
            finder = finder.skip(pagesize * page);
            finder = finder.limit(pagesize);
            return finder.then(d=>d);
        } else {
            return collection.find(...args).then(d=>d);
        }
    })(...args).then(items=>Promise.all(items.map(map)));

    var schemaFields = searchFieldsFromSchema(dao.schema);
    dao.search =  (...args)=> (function(word, filter, order, page, pagesize) {
        var query = {}
        if (word) {
            query.$text = {
                $search: word,
                $caseSensitive: false,
                $diacriticSensitive: false
            };
        }
        if (filter) {
            Object.keys(filter).forEach(propName => {
                if (schemaFields.indexOf(propName) === -1) {
                    return;
                }
                const prop = filter[propName];
                const value = filter[propName];
                if (prop[0] == '<') {
                    query[propName] = { $lt: prop.substr(1) };
                } else if (prop[0] == '>') {
                    query[propName] = { $gt: prop.substr(1) };
                } else if (prop[0] == '!') {
                    query[propName] = { $not: prop.substr(1) };
                } else if (value.indexOf('<>') > 0) {
                    var values = value.split('<>');
                    values.sort(function(a, b) {
                        if (a < b) {
                            return -1;
                        } else {
                            return 1;
                        }
                    });
                    query[propName] = {
                        $lt: values[1],
                        $gt: values[0],
                    };
                } else {
                    query[propName] = { $in: filter[propName] };
                }
            });
        }

        var finder = collection.find(query);
        if (order) {
            finder = finder.sort({ order: 1 });
        }
        if (page !== undefined) {
            if (!pagesize) pagesize = dao.db.pageSize;
            if (!finder.skip) {
                finder = finder.then(items => items.slice(page*pagesize, (page*pagesize)+pagesize))
            } else {
                finder = finder.skip(pagesize * page)
                finder = finder.limit(pagesize)
            }
        }
        return finder;
    })(...args).then(items=>Promise.all(items.map(map)));

    dao.findOne = function(...args) {
        return collection.findOne(...args).then(map);
    };

    dao.update = function (query, updateSet, options) {
        // TODO: verify update set
        collection.update(query, updateSet, options)
    }
}

function searchFieldsFromSchema(schema, prefix = '', list = []) {
    Object.keys(schema).forEach(propName => {
        if (typeof(schema[propName]) == 'object') {
            if (Array.isArray(schema[propName])) {
                if (typeof(schema[propName][0]) == 'object') {
                    searchFieldsFromSchema(schema[propName], prefix + propName + '.', list);
                } else {
                    list.push(prefix + propName)
                }
            } else {
                searchFieldsFromSchema(schema[propName], prefix + propName + '.', list)
            }
        } else {
            list.push(prefix + propName)
        }
    });
    return list;
}

function proxyMonkCollectionMethods(dao) {
    const collection = dao.collection;
    Object.keys(collection)
        .filter(propname => typeof(collection[propname]) == 'function')
        .forEach(prop => { dao[prop] = (...args) => collection[prop](...args) } );
}

const flatten = data => [].concat.apply([], data);

function addFetchSchemaMethods(dao) {
    const db = dao.db;
    Object.keys(dao.relations || {}).forEach(relationName => {
        const relationConfig = normalizeRelationConfig(dao.relations[relationName], relationName, dao.collectionName);
        const addName = relationName[0].toUpperCase() + relationName.slice(1).toLowerCase();
        dao['fetch' + addName] = function(entities) {
            entities = toArray(entities);
            const values = flatten(entities.map(value => value[relationConfig.localKey]));
            var findPromise;
            if (db.daos[relationConfig.collection]) {
                var collectionAddName = relationConfig.foreignKey[0].toUpperCase() + relationConfig.foreignKey.slice(1).toLowerCase();
                findPromise = db.daos[relationConfig.collection]['getBy' + collectionAddName](values.map(v=>v.toString()));
            } else {
                findPromise = db.db.get(relationConfig.collection).find({ $in: values });
            }
            return findPromise.then(result => {
                var entitiesMap = groupBy(entities, relationConfig.localKey);
                result.forEach(r => {
                    entitiesMap[r[relationConfig.foreignKey]].forEach(entitiy => {
                        if (relationConfig.multiple) {
                            if (!entitiy[relationName])
                                entitiy[relationName] = [];
                            entitiy[relationName].push(r);
                        } else {
                            entitiy[relationName] = r;
                        }
                    });
                });
                return result;
            });
        };
    });
}

function normalizeRelationConfig(config, relationName, localCollectionName) {
    if (typeof(config) !== 'object') config = {};
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
    dao['getBy' + addName] = tcacher.toCachingFunction((value, page, pageSize) => {
        var finder = dao.collection.find({
            [propName]: { $in: toArray(value) }
        });
        if (page) {
            pagesize = pagesize || dao.db.defaultPageSize;
            finder = finder.skip(pagesize * page);
            finder = finder.limit(pagesize);
        }
        return finder.then(items=>Promise.all(items.map(dao.map)));
    }, { resultProp: propName });
    
    dao['getOneBy' + addName] = (value, page, pageSize) =>
        dao['getBy' + addName](value).then(r => r[0]);
    
    dao['removeBy' + addName] = (value, connection) =>
        dao.collection.remove({
            [propName]: { $in: toArray(value) }
        });
    
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

//todo: find solution fo validate updates with $set, $inc 
//and other updateOperators: https://docs.mongodb.com/manual/reference/operator/update/#id1

// function schemaAllOptional(schema) {
//     var newSchema = {};
//     Object.keys(schema).forEach(prop => {
//         if (typeof(schema[prop]) == 'object') {
//             if (Array.isArray(schema[prop])) {
//                 if (typeof(schema[prop][0] == 'object')) {
//                     newSchema[prop] = superstruct.struct.optional([schemaAllOptional(schema[prop][0])]);
//                 } else {
//                     newSchema[prop] = superstruct.struct.optional([schema[prop]]);
//                 }
//             } else {
//                 newSchema[prop] = superstruct.struct.optional(schemaAllOptional(schema[prop]));
//             }
//         } else {
//             newSchema[prop] = superstruct.struct.optional(schema[prop]);
//         }
//     });
// };