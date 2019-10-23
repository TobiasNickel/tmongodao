var ObjectID = require('bson-objectid');

module.exports = {
  "localhost:27017": {
    "databases": {
      "tmysqldaotest": {
        "collections": [
          {
            "name": "system.namespaces",
            "documents": [
              {
                "name": "system.indexes"
              },
              {
                "name": "user"
              },
              {
                "name": "pictures"
              }
            ]
          },
          {
            "name": "system.indexes",
            "documents": [
              {
                "v": 1,
                "key": {
                  "_id": 1
                },
                "ns": "tmysqldaotest.user",
                "name": "_id_",
                "unique": true
              },
              {
                "v": 1,
                "key": {
                  "_id": 1
                },
                "ns": "tmysqldaotest.pictures",
                "name": "_id_",
                "unique": true
              }
            ]
          },
          {
            "name": "user",
            "documents": []
          },
          {
            "name": "pictures",
            "documents": []
          }
        ]
      }
    }
  }
}