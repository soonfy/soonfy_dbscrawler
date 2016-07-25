var mongoose = require('mongoose')
var MovieSchema = require('../schemas/movie')
var Movie = mongoose.model('movie', MovieSchema)

module.exports = Movie
