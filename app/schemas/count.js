/**
 * 剧目播放，评论汇总表
 * 表名albums
 */

var mongoose = require('mongoose')
var Schema = mongoose.Schema
var ObjectId = Schema.Types.ObjectId

var CountSchema = new Schema({
  filmId: {                                                          //对应世伟数据库的mongoid
      type: String
  },
  _id: {
    type: String                                                //剧目汇总存储每天不重复id，site+date+filmId
  },
  site: {
      type: String                                               //剧目网站
  },
  playSum: Number,                                           //剧目播放量
  commentSum: Number,                                           //剧目评论量
  upSum: Number,                                                      //剧目赞数
  downSum: Number,                                                     //剧目踩数
  createdAt:  {                                                    //采集时间
      type: Date
  }
})

module.exports = CountSchema
