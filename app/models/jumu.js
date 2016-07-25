var mongoose = require('mongoose')
var JumuSchema = require('../schemas/jumu')
var Jumu = mongoose.model('film', JumuSchema)

module.exports = Jumu
