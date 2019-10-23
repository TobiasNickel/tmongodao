# tmongodao
 - dao library implementing the dao interface for mongodb.
 - compatible with tmysqlpromisedao

# details
 - uses superstruct for schema definition
 - you can extend objects, without mess up your database
 - proxy monk methods
 - follow the dao-pattern described [here](https://www.npmjs.com/package/tmysqlpromisedao)
 - get-methods batch queries
 - verified partial updates
 - schema is applied and objects are cleaned before insert or update
 - get and find methods support queries by sub documents

# todo:
 - testing
 - validate updates
 - update and save events
 - update log based on the events