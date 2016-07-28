/**
 * 剧目播放，评论汇总表
 * 表名albums
 */

var mongoose = require('mongoose')
var Schema = mongoose.Schema
var ObjectId = Schema.Types.ObjectId

var CountSchema = new Schema({
  filmId: {                                                          //对应世伟数据库的mongoid
      type: String,
      index: true
  },
  _id: {
    type: String,                                                //剧目汇总存储每天不重复id，site+date+filmId
    index: true
  },
  site: {
      type: String,                                               //剧目网站
      index: true
  },
  playSum: Number,                                           //剧目播放量
  commentSum: Number,                                           //剧目评论量
  up: Number,
  down: Number,
  createdAt:  {                                                    //采集时间
      type: Date,
      index: true
  }
})

module.exports = CountSchema
