/**
* 豆瓣与视频网站对应表
* 表名db2vsmaps
 */

var mongoose = require('mongoose')
var schema = mongoose.Schema

var VideoSchema = new schema({
  filmId: {
    type: String,      //世伟表的mongoid
    index: true
  },
  _id: {
    type: String,     //保证不重复, site + filmId
    index: true
  },
  site: String,       //网站名称
  category: String,   //网站类型
  url: String,        //网站链接
  createdAt: Date      //以备查询排序
})
module.exports = VideoSchema
