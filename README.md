# tmongodao
 - dao library implementing the dao interface for mongodb.
 - compatible with tmysqlpromisedao

# details
 - uses superstruct or schema
 - you can extend objects, without mess up your database
 - proxy monk methods
 - follow the dao-schema described [here](https://www.npmjs.com/package/tmysqlpromisedao)
 - getMethods betch queries
 - save method uses mongodb's update as mongodb's update is depricated
 - schema is applied and objects are cleaned before insert or update
 - get and find methods have pathing


# todo:
 - search
 - validate updates