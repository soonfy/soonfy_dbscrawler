/**
    *
    *   采集搜狐
    *
*/
var fs = require('fs')
var path = require('path')

var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var iconv = require('iconv-lite')
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
    var pos = data.indexOf('playlistId="')
    var pid = data.substring(pos + 12, data.indexOf('";', pos + 12)).replace(/ /g, '')
    pos = data.indexOf('vid="')
    var vid = data.substring(pos + 5, data.indexOf('";', pos + 5)).replace(/ /g, '')
    var title
    var type
    list_meta.each(function(index, _meta){
        if($(_meta).attr('name') === 'album'){
            title = $(_meta).attr('content')
        }
        if($(_meta).attr('name') === 'category'){
            type = $(_meta).attr('content')
        }
    })

    video.pid = pid
    video.vid = vid
    video.title = title
    video.type = type
    // console.log('搜狐')
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
var parseMV = function(pid, vid, url, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [5, 15, 25, 35, 45, 55]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://count.vrs.sohu.com/count/queryext.action?plids=' + pid + '&vids=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var pos = body.indexOf('total":')
                    var playSum = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                    pos = body.lastIndexOf('total":')
                    var play = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                    cb(null, play, playSum)
                }else{
                        console.log('搜狐采集' + filmId + '播放数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://changyan.sohu.com/api/2/topic/load?client_id=cyqyBluaj&topic_url=' + url + '&topic_source_id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('cmt_sum') > -1){
                        var comment = JSON.parse(body).cmt_sum
                        var commentSum = JSON.parse(body).cmt_sum
                        cb(null, play, playSum, comment, commentSum)
                    }
                }else{
                        console.log('搜狐采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, comment, commentSum, cb){
          var _count
          var a_id = '搜狐视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      site: '搜狐视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: a_id
                  })
                  _count.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  console.log('搜狐' + filmId + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
    })
}

/**
 * 采集电视剧
 * @method function
 * @param  {[type]} pid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧目播放，剧集播放，评论数量]
 */
var parseTV = function(pid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [7, 17, 27, 37, 47, 57]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://pl.hd.sohu.com/videolist?playlistid=' + pid
            request({
                url: requrl,
                encoding: null}, function(err, res, body){
                    if(!err && res.statusCode === 200){
                        // console.log(requrl)
                        var vdata = iconv.decode(body, 'gbk')
                        if(vdata.indexOf('{') === 0 && vdata.indexOf('videos') > -1){
                            var list_data = JSON.parse(vdata).videos
                            cb(null, list_data)
                        }
                    }else{
                        console.log('搜狐采集' + filmId + '剧集列表出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(list_data, cb){

          var count_sohu = 0
          var len_sohu = list_data.length
          // console.log(len_sohu)
          var timer_sohu = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_sohu]
            if(_data != null){
              // console.log(count_sohu)
              var vid = _data.vid
              var name = _data.name
              var url = _data.pageUrl
              var requrl = 'http://count.vrs.sohu.com/count/queryext.action?plids=' + pid + '&vids=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var pos = body.indexOf('total":')
                      var playSum = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                      pos = body.lastIndexOf('total":')
                      var play = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                      var obj_data = {}
                      obj_data.url = url
                      obj_data.vid = vid
                      obj_data.name = name
                      obj_data.play = play
                      obj_data.playSum = playSum
                      cb(null, obj_data)
                  }else{
                      console.log('搜狐采集' + filmId + '播放数量出错。')
                  }
              })
              count_sohu++
              if(count_sohu === len_sohu){
                timer_sohu.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var url = _data.url
            var vid = _data.vid
            var name = _data.name
            var play = _data.play
            var playSum = _data.playSum
            var requrl = 'http://changyan.sohu.com/api/2/topic/load?client_id=cyqyBluaj&topic_url=' + url + '&topic_source_id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('cmt_sum') > -1){
                        var comment = JSON.parse(body).cmt_sum
                        var obj_data = {}
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.playSum = playSum
                        obj_data.comment = comment
                        cb(null, obj_data)
                    }
                }else{
                        console.log('搜狐采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var playSum = _data.playSum
          var _count
          var a_id = '搜狐视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      site: '搜狐视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: a_id
                  })
                  _count.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  console.log('搜狐' + filmId + 'exits.')
              }
          })

          var play = _data.play
          var comment = _data.comment
          var _id = '搜狐视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '搜狐视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: _id
                  })
                  _movie.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  console.log('搜狐' + name + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
    })
}

/**
 * 采集综艺
 * @method function
 * @param  {[type]} pid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧目播放，剧集播放，评论数量]
 */
var parseZY = function(pid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [0, 10, 20, 30, 40, 50]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var list_page = []
            var requrl = 'http://pl.hd.sohu.com/videolist?playlistid=' + pid
            request({
                url: requrl,
                encoding: null}, function(err, res, body){
                    if(!err && res.statusCode === 200){
                        // console.log(requrl)
                        var vdata = iconv.decode(body, 'gbk')
                        if(vdata.indexOf('{') === 0 && vdata.indexOf('size') > -1){
                            var length = JSON.parse(vdata).size
                            for(var i = 1; i <= Math.ceil(length/100); i++){
                                list_page.push(i)
                            }
                            cb(null, list_page)
                        }
                    }else{
                        console.log('搜狐采集' + filmId + '页数列表出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(list_page, cb){

          var count_sohu = 0
          var len_sohu = list_page.length
          // console.log(len_sohu)
          var timer_sohu = schedule.scheduleJob(rule, function () {
            var _page = list_page[count_sohu]
            if(_page != null){
              console.log(count_sohu)
              var requrl = 'http://pl.hd.sohu.com/videolist?playlistid=' + pid + '&pagenum=' + _page + '&pagesize=100'
              request({
                  url: requrl,
                  encoding: null}, function(err, res, body){
                      if(!err && res.statusCode === 200){
                          // console.log(requrl)
                          var vdata = iconv.decode(body, 'gbk')
                          if(vdata.indexOf('{') === 0 && vdata.indexOf('videos') > -1){
                              var list_data = JSON.parse(vdata).videos
                              cb(null, list_data)
                          }
                      }else{
                              console.log('搜狐采集' + filmId + '剧集列表出错。')
                          }
              })
              count_sohu++
              if(count_sohu === len_sohu){
                timer_sohu.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_sohu = 0
          var len_sohu = list_data.length
          // console.log(len_sohu)
          var timer_sohu = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_sohu]
            if(_data != null){
              // console.log(count_sohu)
              var vid = _data.vid
              var name = _data.name
              var url = _data.pageUrl
              var requrl = 'http://count.vrs.sohu.com/count/queryext.action?plids=' + pid + '&vids=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var pos = body.indexOf('total":')
                      var playSum = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                      pos = body.lastIndexOf('total":')
                      var play = body.substring(pos + 7, body.indexOf(',', pos)).replace(/ /g, '')
                      var obj_data = {}
                      obj_data.url = url
                      obj_data.vid = vid
                      obj_data.name = name
                      obj_data.play = play
                      obj_data.playSum = playSum
                      cb(null, obj_data)
                  }else{
                      console.log('搜狐采集' + filmId + '播放数量出错。')
                  }
              })
              count_sohu++
              if(count_sohu === len_sohu){
                timer_sohu.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var url = _data.url
            var vid = _data.vid
            var name = _data.name
            var play = _data.play
            var playSum = _data.playSum
            var requrl = 'http://changyan.sohu.com/api/2/topic/load?client_id=cyqyBluaj&topic_url=' + url + '&topic_source_id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('cmt_sum') > -1){
                        var comment = JSON.parse(body).cmt_sum
                        var obj_data = {}
                        obj_data.comment = comment
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.playSum = playSum
                        cb(null, obj_data)
                    }
                }else{
                        console.log('搜狐采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var playSum = _data.playSum
          var _count
          var a_id = '搜狐视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      site: '搜狐视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: a_id
                  })
                  _count.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  console.log('搜狐' + filmId + 'exits.')
              }
          })

          var play = _data.play
          var comment = _data.comment
          var _id = '搜狐视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '搜狐视频',
                      createdAt: Date.now(),
                      filmId: filmId,
                      _id: _id
                  })
                  _movie.save(function(err) {
                      if (err) {
                          console.log(err);
                      }
                  })
                  cb(null)
              }else {
                  console.log('搜狐' + name + 'exits.')
              }
          })
        }
    ], function(err, res, body){
        // console.log(err)
    })
}

exports.parseSohuData = function parse(filmId, url) {
    request({
        url: url,
        encoding: null}, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var vdata = iconv.decode(body, 'gbk')
            var video = parseVideo(vdata)
            var pid = video.pid
            var title = video.title
            var type = video.type
            var vid = video.vid

            if(typeof type !== 'undefined'){
                // 第一次采集并且剧目链接正确
                var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
                fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
                    //
                    if(!err){
                        console.log(title + ' is appended.') ;
                    }
                })
                switch(type){
                    case '电影':
                        parseMV(pid, vid, url, filmId)
                        break
                    case '电视剧':
                        parseTV(pid, filmId)
                        break
                    case '综艺':
                        parseZY(pid, filmId)
                        break
                    default:
                      parseZY(pid, filmId)
                        // throw new Error('搜狐剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
                }
            }else{
                // 第一次采集并且剧目链接错误
                var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
                fs.appendFile(path.join(__dirname, 'video', 'videodata_false.csv'), str, function (err) {
                    //
                    if(!err){
                        console.log('the false message is appended.') ;
                    }
                })
            }
        }
    })
}
