var mongoose = require('mongoose')
var CountSchema = require('../schemas/count')
var connection = mongoose.createConnection('mongodb://normal:Joke123@ant09.idatage.com:27021/tarantula')

module.exports = connection.model('vs_counts', CountSchema)

// var Count = mongoose.model('vs_counts', CountSchema)

// module.exports = Count
