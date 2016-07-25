var mongoose = require('mongoose')
var CountSchema = require('../schemas/count')
var Count = mongoose.model('vs_counts', CountSchema)

module.exports = Count
