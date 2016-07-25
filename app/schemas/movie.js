/**
 * 剧集播放，评论表
 * 表名movies
 */

var mongoose = require('mongoose')
var Schema = mongoose.Schema
var ObjectId = Schema.Types.ObjectId

var MovieSchema = new Schema({
  filmId: {                                                          //对应世伟数据库的mongoid
      type: String,
      index: true
  },
  _id: {
    type: String,                                                //剧集存储每天不重复id，site+date+filmId+name
    index: true
  },
  name: {
    type: String                                                  //剧集名称
  },
  site: {
      type: String,                                               //视频网站
      index: true
  },
  play: Number,                                                 //剧集播放量
  comment: Number,                                              //剧集评论量
  createdAt:  {                                                    //采集时间
      type: Date,
      index: true
  }
})

MovieSchema.statics = {
    findByTitle: function(title, cb) {
        return this
            .findOne({title: title})
            .exec(cb)
    },
    fetch: function(q, cb) {
        if (q) {
            return this
                .find({'title': q})
                .limit(1000)
                .sort({'createAt': -1})
                .exec(cb)
        } else {
            return this
                .find({})
                .limit(1000)
                .sort({'createAt': -1})
                .exec(cb)
        }
    }
}

module.exports = MovieSchema
