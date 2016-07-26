/**
 * 豆瓣表的schema
 */

var mongoose = require('mongoose')
var schema = mongoose.Schema

var jumuSchema = new schema({
  _id: String,
  doubanId: String, // 豆瓣id #i
  name: String, //豆瓣名字 #i
  // targetId: String, //研究文件id
  category: String,  // #i 类别「 1 电影 2 电视剧，3 网剧 4 民生、新闻节目 5 综艺 」
  keywords: Array, //研究关键字
  doubanTags: Array, // 豆瓣成员常用的标签
  moviePic: String, //豆瓣剧目头像url
  year: String, //年份 #i
  directorIds: Array, //导演 #i
  screenwriterIds: Array, //编剧 #i
  actorIds: Array, //演员 #i
  doubanTypes: Array, //类型 #i 
  releaseDate: Array, //发布时间
  duration: Number, //电影时长
  rank: Number, //平均得分 #i
  rankCount: Number, //评分人数 #i
  betterThan: Array, //好于同类百分比
  intro: String, //简介
  stars: Array, //得分分数分布
  // longComments:Array, //影评 #doubanReview
  // shortComments:Array,//短评 #doubanComments
  pics: Array, //图片
  awards: Array, //获奖情况
})

module.exports = jumuSchema
