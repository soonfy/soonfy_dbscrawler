var mongoose = require('mongoose')
var DB2VSSchema = require('../schemas/db2vs')
var Db2vs = mongoose.model('db2vsmap', DB2VSSchema)

module.exports = Db2vs
