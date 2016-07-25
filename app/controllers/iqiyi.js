/**
    *
    *   采集爱奇艺
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
    var pos = data.indexOf('sourceId:')
    var sid = data.substring(pos + 9, data.indexOf(',', pos)).replace(/ /g, '')
    pos = data.indexOf('albumId:')
    aid = data.substring(pos + 8, data.indexOf(',', pos)).replace(/ /g, '')
    pos = data.indexOf('cid:')
    cid = data.substring(pos + 4, data.indexOf(',', pos)).replace(/ /g, '')
    video.pid = sid == 0 ? aid : sid
    video.cid = cid
    list_meta.each(function(index, _meta){
        if($(_meta).attr('name') === 'irAlbumName'){
            video.title = $(_meta).attr('content')
        }
        if($(_meta).attr('name') === 'irCategory'){
            video.type = $(_meta).attr('content')
        }
    })
    // console.log('爱奇艺')
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
var parseMV = function(pid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [5, 15, 25, 35, 45, 55]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://mixer.video.iqiyi.com/jp/mixin/videos/' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /var\s+tvInfoJs=()/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('name') > -1){
                        var name = JSON.parse(vdata).name
                        var play = JSON.parse(vdata).playCount
                        var playSum = JSON.parse(vdata).playCount
                        var comment = JSON.parse(vdata).commentCount
                        var commentSum = JSON.parse(vdata).commentCount

                        cb(null, name, play, playSum, comment, commentSum)
                    }
                }else{
                    console.log('爱奇艺采集' + filmId + '播放评论数量出错。')
                }
            })
            timer.cancel()
          })
        },
        function(name, play, playSum, comment, commentSum, cb){
          var _count

          var a_id = '爱奇艺视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      site: '爱奇艺视频',
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
                  console.log('爱奇艺' + filmId + 'exits.')
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
            var requrl = 'http://cache.video.qiyi.com/jp/avlist/' + pid + '/'
            var list_page = []
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /var\s+tvInfoJs=()/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('pgt') > -1){
                        var pageMax = JSON.parse(vdata).data.pgt
                        for(var i = 1; i <= pageMax; i++){
                            list_page.push(i)
                        }
                        cb(null, list_page)
                    }
                }else{
                    console.log('爱奇艺采集' + filmId + '列表分页出错。')
                }
            })
            timer.cancel()
          })
        },
        function(list_page, cb){
          var count_iqiyi = 0
          var len_iqiyi = list_page.length
          // console.log(len_iqiyi)
          var timer_iqiyi = schedule.scheduleJob(rule, function () {
            var _page = list_page[count_iqiyi]
            if(_page != null){
              // console.log(count_iqiyi)
              var requrl = 'http://cache.video.qiyi.com/jp/avlist/' + pid + '/' + _page + '/'
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /var\s+tvInfoJs=()/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('vlist') > -1){
                          var list_data = JSON.parse(vdata).data.vlist
                          cb(null, list_data)
                      }
                  }else{
                      console.log('爱奇艺采集' + filmId + '剧集列表出错。')
                  }
              })
              count_iqiyi++
              if(count_iqiyi === len_iqiyi){
                timer_iqiyi.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_iqiyi = 0
          var len_iqiyi = list_data.length
          // console.log(len_iqiyi)
          var timer_iqiyi = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_iqiyi]
            if(_data != null){
              // console.log(count_iqiyi)
              var vid = _data.id
                //http://mixer.video.iqiyi.com/jp/mixin/videos/498189700
              var requrl = 'http://mixer.video.iqiyi.com/jp/mixin/videos/' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /var\s+tvInfoJs=()/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('name') > -1){
                          var obj_data = {}
                          obj_data.name = JSON.parse(vdata).name
                          obj_data.playSum = JSON.parse(vdata).playCount
                          obj_data.comment = JSON.parse(vdata).commentCount
                          var count = JSON.parse(vdata).videoCount
                          cb(null, obj_data, count)
                      }
                  }else{
                      console.log('爱奇艺采集' + filmId + '播放评论数量出错。')
                  }
              })
              count_iqiyi++
              if(count_iqiyi === len_iqiyi){
                timer_iqiyi.cancel()
              }
            }
          })
        },
        function(_data, count, cb){
          var name = _data.name
          var playSum = _data.playSum
          var _count
          var a_id = '爱奇艺视频' + getTodayid() + filmId
          Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      site: '爱奇艺视频',
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
                  console.log('爱奇艺' + filmId + 'exits.')
              }
          })

          var comment = _data.comment
          _id = '爱奇艺视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      comment: comment,
                      site: '爱奇艺视频',
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
                  console.log('爱奇艺' + name + 'exits.')
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
 * @param  {[type]} cid    [网站cid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧集播放，评论数量]
 */
var parseZY = function(pid, cid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [0, 10, 20, 30, 40, 50]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://cache.video.qiyi.com/jp/sdlst/' + cid + '/' + pid + '/'
            var list_year = []
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /var\s+tvInfoJs=()/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') == 0 && vdata.indexOf('data') > -1){
                        var obj_year = JSON.parse(vdata).data
                        for(var year in obj_year){
                            list_year.push(year)
                        }
                        cb(null, list_year)
                    }
                }else{
                    console.log('爱奇艺采集' + filmId + '年代列表出错。')
                }
            })
            timer.cancel()
          })
        },
        function(list_year, cb){

          var count_iqiyi = 0
          var len_iqiyi = list_year.length
          // console.log(len_iqiyi)
          var timer_iqiyi = schedule.scheduleJob(rule, function () {
            var _year = list_year[count_iqiyi]
            if(_year != null){
              // console.log(count_iqiyi)
              var requrl = 'http://cache.video.qiyi.com/jp/sdvlst/' + cid + '/' + pid + '/' + _year + '/'
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /var\s+tvInfoJs=()/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('data') > -1){
                          var list_data = JSON.parse(vdata).data
                          cb(null, list_data)
                      }
                  }else{
                      console.log('爱奇艺采集' + filmId + '剧集列表出错。')
                  }
              })
              count_iqiyi++
              if(count_iqiyi === len_iqiyi){
                timer_iqiyi.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_iqiyi = 0
          var len_iqiyi = list_data.length
          // console.log(len_iqiyi)
          var timer_iqiyi = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_iqiyi]
            if(_data != null){
              // console.log(count_iqiyi)
              var vid = _data.tvId
              var requrl = 'http://mixer.video.iqiyi.com/jp/mixin/videos/' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /var\s+tvInfoJs=()/
                      var vdata = body.replace(reg, '$1')
                      if(vdata.indexOf('{') === 0 && vdata.indexOf('name') > -1){
                          var obj_data = {}
                          obj_data.name = JSON.parse(vdata).name
                          obj_data.play = JSON.parse(vdata).playCount
                          obj_data.comment = JSON.parse(vdata).commentCount
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('爱奇艺采集' + filmId + '播放评论数量出错。')
                  }
              })
              count_iqiyi++
              if(count_iqiyi === len_iqiyi){
                timer_iqiyi.cancel()
              }
            }
          })
        },
        function(_data, cb){
          var name = _data.name
          var play = _data.play
          var comment = _data.comment
          var _id = '爱奇艺视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '爱奇艺视频',
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
                  console.log('爱奇艺' + name + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
    })
}

/**
 * 判断url，提取剧目信息，采集数据
 * @method function
 * @param  {[type]} filmId [剧目filmId]
 * @param  {[type]} url    [剧目url]
 * @return {[type]}        [csv/mongo]
 */
exports.parseIqiyiData = function(filmId, url) {
  request(url, function(err, res, body){
    // console.log(url)
    if(!err && res.statusCode === 200){
      var video = parseVideo(body)
      var pid = video.pid
      var title = video.title
      var type = video.type
      var cid = video.cid

      // console.log(title);

      //url is right
      if(title){
        var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
        fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
          if(!err){
              console.log(title + ' is appended.') ;
          }
        })
        switch(type){
          case '电影':
            parseMV(pid, filmId)
            break
          case '电视剧':
            parseTV(pid, filmId)
            break
          case '综艺':
          case '资讯':
          case '动漫':
          case '纪录片':
            parseZY(pid, cid, filmId)
            break
          default:
            parseZY(pid, cid, filmId)
            // throw new Error('爱奇艺剧目[ ' + filmId + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
        }
      }else{
        // 第一次采集并且剧目链接错误
        var str = filmId + ',' + 'title' + ',' + 'type' + ',' + url + ','
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
