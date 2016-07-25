/**
    *
    *   汇总剧目信息
    *
*/

var async = require('async')
var schedule = require('node-schedule')

var Movie = require('../models/movie')
var Count = require('../models/count')

//采集时间2016-7-9 00:00:00格式化2016-07-09
var countdate = function (day) {
    var year = day.getFullYear()
    var month = day.getMonth() + 1 > 9 ? day.getMonth() + 1 : '0' + (day.getMonth() + 1)
    var date = day.getDate() > 9 ? day.getDate() : '' + day.getDate()
    var today ='' + year + '-' + month + '-' + date
    return today
}

/**
 * 汇总昨天采集数据
 * @method function
 * @return {[type]} [description]
 */
var countSum = function(){

    var date = new Date()
    var time = date.getTime()
    // console.log(time);
    var today = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' 00:00:00'
    // console.log(todayid)
    // console.log(today)
    var lasttime = new Date(time - 86400000)
    var lastdate = new Date(lasttime)
    var lastday = lastdate.getFullYear() + '-' + (lastdate.getMonth() + 1) + '-' + lastdate.getDate() + ' 00:00:00'
    // console.log(lastday)
    //
    // 测试汇总
    // today = '2016-7-26 00:00:00'
    // lastday = '2016-7-25 00:00:00'

    var monthid = (date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1)
    var dayid = date.getDate() > 9 ? date.getDate() : '0' + date.getDate()
    var todayid = '' + date.getFullYear() +  monthid + dayid

  async.parallel([

    //爱奇艺非电影类剧目播放，评论
    function(cb){
      Movie
        .find({site: {'$in': ['爱奇艺视频']}, createdAt: {'$gte': lastday, '$lt': today}}, {filmId: 1, name: 1, play: 1, comment: 1, createdAt: 1, site: 1, _id: 0}, function(err, list_data){
          // console.log(list_data)
          var filmIds = []
          var results = []
          list_data.forEach(function (_data) {
              if(filmIds.indexOf(_data.site + _data.filmId) === -1){
                  filmIds.push(_data.site + _data.filmId)
                  var temp = _data
                  if(_data.play){
                    temp.playSum = _data.play
                  }
                  temp.commentSum = _data.comment
                  temp._id = _data.site + countdate(_data.createdAt) + _data.filmId
                  results.push(temp)
              }else{
                  var temp2 = {}
                  results.forEach(function (_result, _index) {
                      if(_result.filmId === _data.filmId && _result.site === _data.site){
                          temp2 = _result
                          results.splice(_index, 1)
                      }
                  })
                  if(_data.play){
                    temp2.playSum += _data.play
                  }
                  temp2.commentSum += _data.comment
                  results.push(temp2)
              }
          })
          // console.log(results)
          cb(null, results)
        })
    },

    //腾讯，搜狐非电影类剧目评论
    function(cb){
      Movie
        .find({site: {'$in': ['腾讯视频', '搜狐视频']}, createdAt: {'$gte': lastday, '$lt': today}}, {filmId: 1, name: 1, comment: 1, createdAt: 1, site: 1, _id: 0}, function(err, list_data){
        //   console.log(list_data)
          var filmIds = []
          var results = []
          list_data.forEach(function (_data) {
              if(filmIds.indexOf(_data.site + _data.filmId) === -1){
                  filmIds.push(_data.site + _data.filmId)
                  var temp = _data
                  temp.commentSum = _data.comment
                  temp._id = _data.site + countdate(_data.createdAt) + _data.filmId
                  results.push(temp)
              }else{
                  var temp2 = {}
                  results.forEach(function (_result, _index) {
                      if(_result.filmId === _data.filmId && _result.site === _data.site){
                          temp2 = _result
                          results.splice(_index, 1)
                      }
                  })
                  temp2.commentSum += _data.comment
                  results.push(temp2)
              }
          })
          // console.log(results)
          cb(null, results)
        })
    },

    //优酷，土豆,芒果非电影类剧目播放，评论
    function(cb){
      Movie
        .find({site: {'$in': ['优酷视频', '芒果视频', '土豆视频']}, createdAt: {'$gte': lastday, '$lt': today}}, {filmId: 1, name: 1, play: 1, comment: 1, createdAt: 1, site: 1, _id: 0}, function(err, list_data){
        //   console.log(list_data)
          var filmIds = []
          var results = []
          list_data.forEach(function (_data) {
              if(filmIds.indexOf(_data.site + _data.filmId) === -1){
                  filmIds.push(_data.site + _data.filmId)
                  var temp = _data
                  temp.playSum = _data.play
                  temp.commentSum = _data.comment
                  temp._id = _data.site + countdate(_data.createdAt) + _data.filmId
                  results.push(temp)
              }else{
                  var temp2 = {}
                  results.forEach(function (_result, _index) {
                      if(_result.filmId === _data.filmId && _result.site === _data.site){
                          temp2 = _result
                          results.splice(_index, 1)
                      }
                  })
                  temp2.playSum += _data.play
                  temp2.commentSum += _data.comment
                  results.push(temp2)
              }
          })
          // console.log(results)
          cb(null, results)
        })
    }
  ], function(err, res){
      if(!err){

          //合并3次统计
          var counts = []
          res.forEach(function (_res, _index) {
            counts = counts.concat(_res)
          })
        //   console.log(counts)

          //写入数据库
          counts.forEach(function (_data) {
              Count.findOne({_id: _data._id}, {_id: 1}, function (err, res) {
                  //未存入剧目播放，插入剧目播放，评论
                  if(res === null){
                      var _count
                      _count = new Count({
                          playSum: _data.playSum,
                          commentSum: _data.commentSum,
                          site: _data.site,
                          createdAt: _data.createdAt,
                          _id: _data._id,
                          filmId: _data.filmId
                      })
                      _count.save(function(err) {
                          if (err) {
                              console.log(err);
                          }
                      })
                  }else{
                    //已存入剧目播放，更新剧目评论
                    res.commentSum = _data.commentSum
                    res.save(function(err) {
                        if (err) {
                            console.log(err);
                        }
                    })
                  }
              })
          })
      }
  })
}

// countSum()

/**
 * 定时任务，每天1点汇总一次
 * @method RecurrenceRule
 */
var rule = new schedule.RecurrenceRule()
var timer = schedule.scheduleJob('0 0 1 */1 * *', function () {
  countSum()
})
