/**
    *
    *   采集腾讯
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

//提取播放链接
var sliceUrl = function(vurl){
  var pos = vurl.indexOf('http')
  var url = vurl.substring(pos, vurl.indexOf('html', pos) + 4)
  return url
}

//qq typeid
//2电视剧，1电影，10综艺

var parseVideo = function(data, vurl){
    var video = {}
    var $ = cheerio.load(data)
    var list_meta = $('meta')
    var pos = data.indexOf('typeid:')
    var typeid = data.substring(pos + 7, data.indexOf(',', pos + 7)).replace(/ /g, '')
    var vtype = typeid === '1' ? '电影' : typeid === '2' ? '电视剧' : typeid === '10' ? '综艺' : '综艺'
    var type = $('div.breadcrumb').children('a').first().attr('title')
    var url = $('div.breadcrumb').children('a').last().attr('href') || sliceUrl(vurl)
    var pid = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.')).replace(/ /g, '')

    //时尚
    var furl = $('div.breadcrumb').children('a').eq(1).attr('href') || ''
    var fid = furl.substring(furl.lastIndexOf('/') + 1, furl.lastIndexOf('.')).replace(/ /g, '')
    var ftitle = $('div.breadcrumb').children('a').eq(1).attr('title') || ''
    var infoindex = data.indexOf('COVER_INFO')
    var nameindex = data.indexOf('"', infoindex)
    var lastindex = data.indexOf('"', nameindex + 1)
    var info = data.substring(nameindex + 1, lastindex).replace(/ /g, '')
    var title = $('.breadcrumb').children('a').last().attr('title') || info

    video.type = type
    video.pid = pid
    video.title = title
    video.fid = fid
    video.ftitle = ftitle
    video.url = vurl
    // console.log('腾讯')
    // console.log(video)
    return video
}

/**
 * 采集电影
 * @method function
 * @param  {[type]} pid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧目评论，播放数量]
 */
var parseMV = function(pid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [5, 15, 25, 35, 45, 55]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://s.video.qq.com/loadplaylist?type=6&plname=qq&otype=json&id=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /QZOutputJson=(.+);/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('playlist') > -1){
                        var list_data = JSON.parse(vdata).video_play_list.playlist
                        cb(null, list_data)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '剧集列表出错。')
                }
            })
            timer.cancel()
          })
        },
        function(list_data, cb){

          var count_qq = 0
          var len_qq = list_data.length
          // console.log(len_qq)
          var timer_qq = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_qq]
            if(_data != null){
              // console.log(count_qq)
              var name = _data.title
              var requrl = 'http://data.video.qq.com/fcgi-bin/data?tid=70&appid=10001007&appkey=e075742beb866145&otype=json&idlist=' + pid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /QZOutputJson=(.+);/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('allnumc') > -1){
                          var play = JSON.parse(vdata).results[0].fields.allnumc
                          var playSum = JSON.parse(vdata).results[0].fields.allnumc
                          cb(null, name, play, playSum)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '播放数量出错。')
                  }
              })
              count_qq++
              if(count_qq === len_qq){
                timer_qq.cancel()
              }
            }
          })
        },
        function(name, play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://sns.video.qq.com/fcgi-bin/video_comment_id?otype=json&op=3&cid=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /QZOutputJson=(.+);/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('comment_id') > -1){
                        var cid = JSON.parse(vdata).comment_id
                        cb(null, cid, name, play, playSum)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '评论cid出错。')
                }
            })
            timer.cancel()
          })
        },
        function(cid, name, play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://coral.qq.com/article/' + cid + '/commentnum'
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('commentnum') > -1){
                        var comment = JSON.parse(body).data.commentnum
                        var commentSum = JSON.parse(body).data.commentnum
                        cb(null, name, play, playSum, comment, commentSum)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '评论数量出错。')
                }
            })
            timer.cancel()
          })
        },
        function(name, play, playSum, comment, commentSum,cb){
          var _count
          var a_id = '腾讯视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      site: '腾讯视频',
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
                  console.log('腾讯' + filmId + 'exits.')
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
 * @return {[type]}        [剧目播放，剧集评论数量]
 */
var parseTV = function(pid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [7, 17, 27, 37, 47, 57]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://s.video.qq.com/loadplaylist?type=6&plname=qq&otype=json&id=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /QZOutputJson=(.+);/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('playlist') > -1){
                        var list_data = JSON.parse(vdata).video_play_list.playlist
                        cb(null, list_data)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '剧集列表出错。')
                }
            })
            timer.cancel()
          })
        },
        function(list_data, cb){

          var count_qq = 0
          var len_qq = list_data.length
          // console.log(len_qq)
          var timer_qq = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_qq]
            if(_data != null){
              var vid = _data.id
              var name = _data.title
              var requrl = 'http://data.video.qq.com/fcgi-bin/data?tid=70&appid=10001007&appkey=e075742beb866145&otype=json&idlist=' + pid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /QZOutputJson=(.+);/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('allnumc') > -1){
                           var obj_data = {}
                          obj_data.vid = vid
                          obj_data.name = name
                          obj_data.playSum = JSON.parse(vdata).results[0].fields.allnumc
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '播放数量出错。')
                  }
              })
              count_qq++
              if(count_qq === len_qq){
                timer_qq.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var vid = _data.vid
            var name = _data.name
            var playSum = _data.playSum
            var requrl = 'http://sns.video.qq.com/fcgi-bin/video_comment_id?otype=json&op=3&vid=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /QZOutputJson=(.+);/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('comment_id') > -1){
                        var cid = JSON.parse(vdata).comment_id
                        var obj_data = {}
                        obj_data.cid = cid
                        obj_data.name = name
                        obj_data.playSum = playSum
                        cb(null, obj_data)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '评论cid出错。')
                }
            })
            timer.cancel()
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var cid = _data.cid
            var name = _data.name
            var playSum = _data.playSum
            var requrl = 'http://coral.qq.com/article/' + cid + '/commentnum'
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('commentnum') > -1){
                        var comment = JSON.parse(body).data.commentnum
                        var obj_data = {}
                        obj_data.comment = comment
                        obj_data.name = name
                        obj_data.playSum = playSum
                        cb(null, obj_data)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '评论数量出错。')
                }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var playSum = _data.playSum
          var _count
          var a_id = '腾讯视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSumCount: playSum,
                      site: '腾讯视频',
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
                  console.log('腾讯视频' + filmId + 'exits.')
              }
          })

          var comment = _data.comment
          var _id = '腾讯视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      comment: comment,
                      site: '腾讯视频',
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
                  console.log('腾讯视频' + name + 'exits.')
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
            var requrl = 'http://s.video.qq.com/loadplaylist?type=6&plname=qq&otype=json&id=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /QZOutputJson=(.+);/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('year') > -1){
                        var list_year = JSON.parse(vdata).video_play_list.year
                        cb(null, list_year)
                    }
                }else{
                    console.log('腾讯采集' + filmId + '年代列表出错。')
                }
            })
            timer.cancel()
          })
        },
        function(list_year, cb){

          var count_qq = 0
          var len_qq = list_year.length
          // console.log(len_qq)
          var timer_qq = schedule.scheduleJob(rule, function () {
            var _year = list_year[count_qq]
            if(_year != null){
              // console.log(count_qq)
              var requrl = 'http://s.video.qq.com/loadplaylist?type=4&plname=qq&otype=json&id=' + pid + '&year=' + _year
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /QZOutputJson=(.+);/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('playlist') > -1){
                          var list_data = JSON.parse(vdata).video_play_list.playlist
                          cb(null, list_data)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '剧集列表出错。')
                  }
              })
              count_qq++
              if(count_qq === len_qq){
                timer_qq.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_qq = 0
          var len_qq = list_data.length
          // console.log(len_qq)
          var timer_qq = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_qq]
            if(_data != null){
              // console.log(count_qq)
              var vid = _data.id
              var name = _data.title
              var requrl = 'http://data.video.qq.com/fcgi-bin/data?tid=70&appid=10001007&appkey=e075742beb866145&otype=json&idlist=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /QZOutputJson=(.+);/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('c_allnumc') > -1){
                          var obj_data = {}
                          obj_data.vid = vid
                          obj_data.name = name
                          obj_data.play = JSON.parse(vdata).results[0].fields.allnumc
                          obj_data.playSum = JSON.parse(vdata).results[0].fields.column.c_column_view.c_allnumc
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '播放数量出错。')
                  }
              })
              count_qq++
              if(count_qq === len_qq){
                timer_qq.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer_qq = schedule.scheduleJob(rule, function () {
              var vid = _data.vid
              var name = _data.name
              var play = _data.play
              var playSum = _data.playSum
              var requrl = 'http://sns.video.qq.com/fcgi-bin/video_comment_id?otype=json&op=3&cid=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /QZOutputJson=(.+);/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('comment_id') > -1){
                          var obj_data = {}
                          obj_data.name = name
                          obj_data.play = play
                          obj_data.playSum = playSum
                          obj_data.cid = JSON.parse(vdata).comment_id
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '评论cid出错。')
                  }
              })
            timer_qq.cancel()
          })
        },
        function(_data, cb){

          var cid = _data.cid
          var name = _data.name
          var play = _data.play
          var playSum = _data.playSum
          var timer_qq = schedule.scheduleJob(rule, function () {
              var requrl = 'http://coral.qq.com/article/' + cid + '/commentnum'
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      if(body.indexOf('{') === 0 && body.indexOf('commentnum') > -1){
                          var comment = JSON.parse(body).data.commentnum
                          var obj_data = {}
                          obj_data.name = name
                          obj_data.play = play
                          obj_data.playSum = playSum
                          obj_data.comment = comment
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('腾讯采集' + filmId + '评论数量出错。')
                  }
              })
            timer_qq.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var playSum = _data.playSum
          var _count
          var a_id = '腾讯视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      site: '腾讯视频',
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
                  console.log('腾讯' + filmId + 'exits.')
              }
          })

          var play = _data.play
          var comment = _data.comment
          _id = '腾讯视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '腾讯视频',
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
                  console.log('腾讯视频' + name + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
    })
}

exports.parseQQData = function(filmId, url) {
    request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var video = parseVideo(body, url)
            var pid = video.pid
            var title = video.title
            var type = video.type || 'false'
            var fid = video.fid
            var ftitle = video.ftitle

            if(title.indexOf('utf-8') === -1 && title.indexOf('zh-cn') === -1 && title.indexOf('Content-Type') === -1){
              //第一次采集并且剧目链接正确
              var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
              fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
                  //
                  if(!err){
                      console.log(title + ' is appended.') ;
                  }
              })
              switch(type){
                  case '电影':
                      parseMV(pid, filmId)
                      break
                  case '电视剧':
                  case '动漫':
                      parseTV(pid, filmId)
                      break
                  case '综艺':
                  // case '自制综艺':
                  // case '纪录片':
                      parseZY(pid, filmId)
                      break
                  // case '时尚':
                  // case '新闻':
                  //     parseZY(fid, filmId)
                  //     break
                  default:
                    parseZY(pid, filmId)
                    // throw new Error('腾讯剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
              }
          }else{
            // 第一次采集并且剧目链接错误
            var str = filmId + ',' + 'title' + ',' + 'type' + ',' + url + ','
            fs.appendFile(path.join(__dirname, 'video', 'videodata_false.csv'), str, function (err) {
              if(!err){
                  console.log('the false message is appended.') ;
              }
            })
          }
        }
    })
}
