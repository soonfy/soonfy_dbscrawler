/*
    *
    *   采集土豆
    *
*/
var fs = require('fs')
var path = require('path')

var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var schedule = require('node-schedule')

var Movie = require('../models/movie')
var Count = require('../models/count')

var getTodayid = function () {
    var date = new Date()
    var monthid = (date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1)
    var dayid = date.getDate() > 9 ? date.getDate() : '0' + date.getDate()
    var todayid = '' + date.getFullYear() + '-' +  monthid + '-' + dayid
    return todayid
}

var parseVideo = function(data){
    var video = {}
    var $ = cheerio.load(data)
    var list_meta = $('meta')
    var type
    var title
    var pos = data.indexOf('iid: ')
    var pid = data.substring(pos + 5, data.indexOf('\r\n', pos + 5)).replace(/ /g, '')
    pos = data.indexOf('icode: \'')
    var vid = data.substring(pos + 8, data.indexOf('\'', pos + 8)).replace(/ /g, '')
    list_meta.each(function(index, _meta){
        if($(_meta).attr('name') === 'irAlbumName'){
            title = $(_meta).attr('content')
        }
        if($(_meta).attr('name') === 'irCategory'){
            type = $(_meta).attr('content')
        }
    })
    video.pid = pid
    video.type = type
    video.title = title
    video.vid = vid
    // console.log('土豆')
    // console.log(video)
    return video
}

/**
 * 采集电影
 * @method function
 * @param  {[type]} pid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧目播放，评论数量]
 */
var parseMV = function(pid, vid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [5, 15, 25, 35, 46, 56]
  rule.second = times

    async.waterfall([
        function(cb){

        var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://dataapi.youku.com/getData?num=200001&icode=' + vid
            request(requrl, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('vv') > -1){
                        var vdata =  JSON.parse(body)
                        var play = vdata.result.vv
                        var playSum = vdata.result.vv
                        cb(null, play, playSum)
                    }
                } else {
                    console.log(error);
                }
            })
            timer.cancel()
        })
        },
        function(play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://www.tudou.com/crp/itemSum.action?uabcdefg=0&iabcdefg=' + pid
            request(requrl, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('playNum') > -1){
                        var vdata =  JSON.parse(body)
                        var comment = vdata.commentNum
                        var commentSum = vdata.commentNum
                        var upSum = vdata.digNum
                        cb(null, play, playSum, comment, commentSum, upSum)
                    }
                } else {
                    console.log(error);
                }
            })
            timer.cancel()
          })
        },
        function(play, playSum, comment, commentSum, upSum, cb){
          var _count
          var _id = '土豆视频' + getTodayid() + filmId
          Count.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      upSum: upSum,
                      site: '土豆视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: _id
                  })
                  _count.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  // console.log('土豆' + filmId + 'exits.')
              }
          })
        }
    ], function(err, result){

    })
}

/**
 * 采集非电影
 * @method function
 * @param  {[type]} url    [网站链接]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧集播放，评论数量]
 */
var parseTV = function(url, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [0, 10, 20, 30, 40, 50]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var fpos = url.indexOf('albumplay/') + 10
            var lpos = url.indexOf('/', url.indexOf('albumplay/') + 10)
            if(lpos > fpos){
                var pid = url.substring(fpos, lpos)
            }else{
                var pid = url.substring(fpos, url.indexOf('.', url.indexOf('albumplay/') + 10))
            }

            var requrl = 'http://www.tudou.com/tvp/getMultiTvcCodeByAreaCode.action?type=3&app=4&codes=' + pid
            request(requrl, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('message') > -1){
                        var list_tvid =  JSON.parse(body).message
                        cb(null, list_tvid)
                    }
                } else {
                    console.log(error);
                }
            })
            timer.cancel()
          })
        },
        function(list_tvid, cb) {

          var count_tudou = 0
          var len_tudou = list_tvid.length
          // console.log(len_tudou)
          var timer_tudou = schedule.scheduleJob(rule, function () {
            var _data = list_tvid[count_tudou]
            if(_data != null){
              // console.log(count_tudou)
              var vid = _data.iid
              var name = _data.title
              var requrl = 'http://www.tudou.com/crp/itemSum.action?uabcdefg=0&iabcdefg=' + vid
              request(requrl, function(error, response, body) {
                  if (!error && response.statusCode == 200) {
                      // console.log(requrl)
                      if(body.indexOf('{') === 0 && body.indexOf('playNum') > -1){
                          var vdata =  JSON.parse(body)
                          var play = vdata.playNum
                          var comment = vdata.commentNum
                          var upSum = vdata.digNum
                          var obj_data = {}
                          obj_data.name = name
                          obj_data.play = play
                          obj_data.comment = comment
                          obj_data.upSum = upSum
                          cb(null, obj_data)
                      }
                  } else {
                      console.log(error);
                  }
              })
              count_tudou++
              if(count_tudou === len_tudou){
                timer_tudou.cancel()
              }
            }
          })
        },
        function(_data, cb) {
          var name = _data.name
          var play = _data.play
          var comment = _data.comment
          _id = '土豆视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '土豆视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: _id
                  })
                  _movie.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
              }else {
                  // console.log('土豆' + name + 'exits.')
              }
          })

          var upSum = _data.upSum
          up_id = '土豆视频' + getTodayid() + filmId
          var _count
          Count.findOne({_id: up_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      upSum: upSum,
                      site: '土豆视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: up_id
                  })
                  _count.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
              }else {
                  // console.log('土豆' + filmId + 'exits.')
              }
          })
        }
    ], function(err, result){

    })
}

exports.parseTudouData = function(filmId, url) {
    request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var video = parseVideo(body)
            var pid = video.pid
            var vid = video.vid
            var title = video.title
            var type = video.type

            var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
            fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
                //
                if(!err){
                    // console.log(title + ' is appended.') ;
                }
            })

            switch(type){
                case '电影':
                    parseMV(pid, vid, filmId)
                    break
                case '电视剧':
                case '综艺':
                // case '原创':
                case '资讯':
                // case '纪实':
                case '教育':
                    parseTV(url, filmId)
                    break
                default:
                  parseTV(url, filmId)
                    // throw new Error('土豆剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
            }
        }
    })
}
