/**
    *
    *   采集芒果
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

    var pos = data.indexOf('type: "')
    var vtype = data.substring(pos + 7, data.indexOf('",', pos + 7)).replace(/ /g, '')
    var type
    switch(vtype){
        case 'movie':
            type = '电影'
            break
        case 'tv':
            type = '电视剧'
            break
        case 'show':
            type = '综艺'
            break
        default:
            type = vtype
    }

    pos = data.indexOf('cname: "')
    var title = data.substring(pos + 8, data.indexOf('"', pos + 8)).replace(/ /g, '')

    pos = data.indexOf('vid:')
    var vid = data.substring(pos + 5, data.indexOf(',', pos)).replace(/ /g, '')

    pos = data.indexOf('cid:')
    var cid = data.substring(pos + 5, data.indexOf(',', pos)).replace(/ /g, '')

    pos = data.indexOf('site: "')
    var site = data.substring(pos + 7, data.indexOf('",', pos + 7)).replace(/ /g, '')

    pos = data.indexOf('path:')
    var path = data.substring(pos + 6, data.indexOf(',', pos)).replace(/ /g, '')

    video.title = title
    video.type = type
    video.vid = vid
    video.cid = cid
    video.site = site
    video.path = path
    // console.log('芒果')
    // console.log(video)
    return video
}

var parseTVList = function(data){
    var $ = cheerio.load(data)
    var list_item = $('.v-list-inner').first().find('.v-item')
    var list_data = []
    list_item.each(function() {
        var tempObj = {}
        tempObj.name = $(this).children('a').attr('title')
        var url = $(this).children('a').attr('href')
        tempObj.vid = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
        list_data.push(tempObj)
    })
    return list_data
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
            var requrl = 'http://videocenter-2039197532.cn-north-1.elb.amazonaws.com.cn//dynamicinfo?vid=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('all') > -1){
                        var play = JSON.parse(body).data.all
                        var playSum = JSON.parse(body).data.all
                        cb(null, play, playSum)
                    }
                }else{
                        console.log('芒果采集' + filmId + '播放数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://comment.hunantv.com/video_comment/list/?subject_id=' + pid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /null\((.+)\)/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('total_number') > -1){
                        var comment = JSON.parse(vdata).total_number
                        var commentSum = JSON.parse(vdata).total_number
                        cb(null, play, playSum, comment, commentSum)
                    }
                }else{
                        console.log('芒果采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, comment, commentSum, cb){
          var _count
          var _id = '芒果视频' + getTodayid() + filmId
          Count.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      site: '芒果视频',
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
                  console.log('芒果' + filmId + 'exits.')
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
 * @param  {[type]} vid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧集播放，评论数量]
 */
var parseTV = function(vid, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [7, 17, 27, 37, 47, 57]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var url = 'http://v.api.mgtv.com/list/tvlist?video_id=' + vid
            request(url, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(url)
                    var page_max = JSON.parse(body).data.total_page
                    var list_page = []
                    for(var i = 0; i < page_max; i++){
                      list_page.push(i)
                    }
                    cb(null, list_page)
                }else{
                        console.log('芒果采集' + filmId + '剧集列表出错。')
                    }
            })
            timer.cancel()
          })
        },
        function (list_page, cb) {
          var count_mangguo = 0
          var len_mangguo = list_page.length
          // console.log(len_mangguo)
          var timer_mangguo = schedule.scheduleJob(rule, function () {
            var _data = list_page[count_mangguo]
            if(_data != null){
              // console.log(count_mangguo)
              var requrl = 'http://v.api.mgtv.com/list/tvlist?video_id=' + vid + '&size=25&page=' + _data
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                     var list_tv = JSON.parse(body).data.list
                     var list_data = []
                     list_tv.forEach(function (_tv) {
                       var obj_data = {}
                       obj_data.vid = _tv.video_id
                       obj_data.name = _tv.t2
                       list_data.push(obj_data)
                     })
                    cb(null, list_data)
                  }else{
                      console.log('芒果采集' + filmId + '播放数量出错。')
                  }
              })
              count_mangguo++
              if(count_mangguo === len_mangguo){
                timer_mangguo.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_mangguo = 0
          var len_mangguo = list_data.length
          // console.log(len_mangguo)
          var timer_mangguo = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_mangguo]
            if(_data != null){
              // console.log(count_mangguo)
              var vid = _data.vid
              var name = _data.name
              var requrl = 'http://videocenter-2039197532.cn-north-1.elb.amazonaws.com.cn//dynamicinfo?vid=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      if(body.indexOf('{') === 0 && body.indexOf('all') > -1){
                           var play = JSON.parse(body).data.all
                          var obj_data = {}
                          obj_data.vid = vid
                          obj_data.name = name
                          obj_data.play = play
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('芒果采集' + filmId + '播放数量出错。')
                  }
              })
              count_mangguo++
              if(count_mangguo === len_mangguo){
                timer_mangguo.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var vid = _data.vid
            var name = _data.name
            var play = _data.play
            var requrl = 'http://comment.hunantv.com/video_comment/list/?subject_id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /null\((.+)\)/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('total_number') > -1){
                        var comment = JSON.parse(vdata).total_number
                        var obj_data = {}
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.comment = comment
                        cb(null, obj_data)
                    }
                }else{
                        console.log('芒果采集' + filmId + '播放评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var play = _data.play
          var comment = _data.comment
          _id = '芒果视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '芒果视频',
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
                  console.log('芒果' + name + 'exits.')
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
 * @param  {[type]} site   [网站site]
 * @param  {[type]} path   [网站path]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧集播放，评论数量]
 */
var parseZY = function(pid, site, path, filmId){

  var rule = new schedule.RecurrenceRule()
  var times = [0, 10, 20, 30, 40, 50]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://www.hunantv.com/' + site + '/' + path + '/' + pid + '/s/json.year.js'
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /.+(\[.+\])\)/
                    var vdata = body.replace(reg, '$1')
                    var list_year = JSON.parse(vdata)
                    cb(null, list_year)
                }else{
                        console.log('芒果采集' + filmId + '年代列表出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(list_year, cb){

          var count_mangguo = 0
          var len_mangguo = list_year.length
          // console.log(len_mangguo)
          var timer_mangguo = schedule.scheduleJob(rule, function () {
            var _year = list_year[count_mangguo]
            if(_year != null){
              // console.log(count_mangguo)
              var requrl = 'http://www.hunantv.com/' + site + '/' + path + '/' + pid + '/s/json.' + _year + '.js'
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      var reg = /[^\[]+(\[.+\])\)/
                      var vdata = body.replace(reg, '$1')
                      var list_data = JSON.parse(vdata)
                      cb(null, list_data)
                  }else{
                      console.log('芒果采集' + filmId + '剧集列表出错。')
                  }
              })
              count_mangguo++
              if(count_mangguo === len_mangguo){
                timer_mangguo.cancel()
              }
            }
          })
        },
        function(list_data, cb){

          var count_mangguo = 0
          var len_mangguo = list_data.length
          // console.log(len_mangguo)
          var timer_mangguo = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_mangguo]
            if(_data != null){
              // console.log(count_mangguo)
              var vid = _data.id
              var name = _data.stitle + _data.title
              var requrl = 'http://videocenter-2039197532.cn-north-1.elb.amazonaws.com.cn//dynamicinfo?vid=' + vid
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      if(body.indexOf('{') === 0 && body.indexOf('all') > -1){
                          var play = JSON.parse(body).data.all
                          var obj_data = {}
                          obj_data.vid =vid
                          obj_data.name = name
                          obj_data.play = play
                          cb(null, obj_data)
                      }
                  }else{
                      console.log('芒果采集' + filmId + '播放数量出错。')
                  }
              })
              count_mangguo++
              if(count_mangguo === len_mangguo){
                timer_mangguo.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var vid = _data.vid
            var name = _data.name
            var play = _data.play
            var requrl = 'http://comment.hunantv.com/video_comment/list/?subject_id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var reg = /null\((.+)\)/
                    var vdata = body.replace(reg, '$1')
                    if(vdata.indexOf('{') === 0 && vdata.indexOf('total_number') > -1){
                        var comment = JSON.parse(vdata).total_number
                        var obj_data = {}
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.comment = comment
                        cb(null, obj_data)
                    }
                }else{
                        console.log('芒果采集' + filmId + '播放评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
          var name = _data.name
          var play = _data.play
          var comment = _data.comment
          _id = '芒果视频' + getTodayid() + filmId + name
          var _movie
          Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _movie = new Movie({
                      name: name,
                      play: play,
                      comment: comment,
                      site: '芒果视频',
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
                  console.log('芒果' + name + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
    })
}

exports.parseMangguoData = function(filmId, url) {
    request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var video = parseVideo(body)
            var vid = video.vid
            var title = video.title
            var type = video.type
            var cid = video.cid
            var site = video.site
            var vpath = video.path

            if(site.indexOf('湖南卫视') === -1){
                var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
                fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
                    //
                    if(!err){
                        console.log(title + ' is appended.') ;
                    }
                })
                switch(type){
                    case '电影':
                        parseMV(vid, filmId)
                        break
                    case '电视剧':
                        parseTV(url, filmId)
                        break
                    case '综艺':
                        parseZY(cid, site, vpath, filmId)
                        break
                    default:
                      parseZY(cid, site, vpath, title, utype, type, uid, uname)
                        // throw new Error('芒果剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
                }
            }else{
                var str = filmId + ',' + 'title' + ',' + 'type' + ',' + url + '\r\n'
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
