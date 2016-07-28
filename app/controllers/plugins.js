
var Film = require('../models/jumu')

var getScore = function (_id) {
  Film
    .findOne({_id: _id}, {rank: 1, rankCount: 1, stars: 1, moviePic: 1, _id: 1}, function (err, res) {
      if(!err){
        console.log(res);
        return res
      }
    })
}

getScore('5794c5aab0b0546424ec0eee')
