/**
    *
    *   采集优酷
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
    var pos = data.indexOf('videoId = \'')
    var vid = data.substring(pos + 11, data.indexOf('\';', pos + 11)).replace(/ /g, '')
    list_meta.each(function(index, _meta){
        if($(_meta).attr('name') === 'irAlbumName'){
            title = $(_meta).attr('content')
        }
        if($(_meta).attr('name') === 'irCategory'){
            type = $(_meta).attr('content')
        }
    })
    pos = data.indexOf('var showid_en=\"')
    var requrl = 'http://www.youku.com/show_page/id_z' + data.substring(pos + 15, data.indexOf('\";', pos + 15)) + '.html'
    var url = $('h1').children('a').attr('href') || requrl

    video.type = type
    video.title = title
    video.vid = vid
    video.curl = url
    // console.log('优酷')
    // console.log(video)
    return video
}

var parseVid = function(data){
    var pos = data.indexOf('videoId = \'')
    var vid = data.substring(pos + 11, data.indexOf('\';', pos + 11)).replace(/ /g, '')
    return vid
}

var parseSectionData = function(data) {
    var $ = cheerio.load(data)
    var list_item = $('ul')
    var list_data = []
    list_item.each(function() {
        var tempObj = {}
        tempObj.url = $(this).children('li').children('a').attr('href')
        tempObj.name = $(this).children('li').children('a').attr('title')
        if(tempObj.url){
            list_data.push(tempObj)
        }
    })
    return list_data
}

/**
 * 采集电影
 * @method function
 * @param  {[type]} vid    [网站pid]
 * @param  {[type]} filmId [剧目filmId]
 * @return {[type]}        [剧目播放，评论数量]
 */
var parseMV = function(vid, filmId, url){

  var rule = new schedule.RecurrenceRule()
  var times = [5, 15, 25, 35, 45, 55]
  rule.second = times

    async.waterfall([
        function(cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://v.youku.com/QVideo/~ajax/getVideoPlayInfo?type=vv&id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('vv') > -1){
                        var play = JSON.parse(body).vv
                        var playSum = JSON.parse(body).vv
                        cb(null, play, playSum)
                    }
                }else{
                        console.log('优酷采集' + filmId + '播放数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = 'http://comments.youku.com/comments/~ajax/getStatus.html?__ap=%7B%22videoid%22%3A%22' + vid + '%22%7D'
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('total') > -1){
                        var comment = JSON.parse(body).total
                        var commentSum = JSON.parse(body).total
                        cb(null, play, playSum, comment, commentSum)
                    }
                }else{
                        console.log('优酷采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, comment, commentSum, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var requrl = url
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    var $ = cheerio.load(body)
                    var upSum = parseInt($($('div.fn-up')[0]).text().replace(/,/g, ''))
                    var downSum = parseInt($($('div.fn-down')[0]).text().replace(/,/g, ''))
                    cb(null, play, playSum, comment, commentSum, upSum, downSum)
                }else{
                        console.log('优酷采集' + filmId + '赞踩数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(play, playSum, comment, commentSum, upSum, downSum, cb){
          var _count
          var _id = '优酷视频' + getTodayid() + filmId
          Count.findOne({_id: _id}, {_id: 1}, function(err, result){
              if(result === null){
                  _count = new Count({
                      playSum: playSum,
                      commentSum: commentSum,
                      upSum: playSum,
                      commentSum: commentSum,
                      site: '优酷视频',
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
                  console.log('优酷' + filmId + 'exits.')
              }
          })
        }
    ], function(err, result){
        // console.log(err)
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
            request(url, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(url)
                    cb(null, body)
                }else{
                        console.log('优酷采集' + filmId + '播放网页出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var $ = cheerio.load(data)
            if($('.pgm-list').length > 0){
                var list_data = []
                var pid = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
                var list_li = $('.pgm-list').find('li')
                var list_section = []
                list_li.each(function(index, _li){
                    list_section.push($(_li).attr('data'))
                })
                // console.log('优酷剧目' + title + '分为' + list_section.length + '个页面')
                list_section.forEach(function(_section){
                    var requrl = 'http://www.youku.com/show_episode/' + pid + '.html?dt=json&divid=' + _section
                    request(requrl, function(err, res, body){
                        if(!err && res.statusCode === 200){
                            // console.log(requrl)
                            list_data = parseSectionData(body)
                            cb(null, list_data)
                        }else{
                        console.log('优酷采集' + filmId + '剧集列表出错。')
                    }
                    })
                })
            }else{
                // console.log('优酷剧目' + title + '分为1个页面')
                var list_data = []
                var list_li = $('#episode_wrap').find('li')
                list_li.each(function(index, _li){
                    var tempObj = {}
                    tempObj.name = $(_li).children('a').attr('title')
                    tempObj.url = $(_li).children('a').attr('href')
                    if(tempObj.url){
                        list_data.push(tempObj)
                    }
                })
                cb(null, list_data)
            }
            timer.cancel()
          })
        },
        function(list_data, cb){

          var count_youku = 0
          var len_youku = list_data.length
          // console.log(len_youku)
          var timer_youku = schedule.scheduleJob(rule, function () {
            var _data = list_data[count_youku]
            if(_data != null){
              // console.log(count_youku)
              var name = _data.name
              var requrl = _data.url
              request(requrl, function(err, res, body){
                  if(!err && res.statusCode === 200){
                      // console.log(requrl)
                      if(body === '\n'){
                          console.log('videolist 200 null err')
                      }else{
                          var vid = parseVid(body)
                          var $ = cheerio.load(body)
                          var up = parseInt($($('div.fn-up')[0]).text().replace(/,/g, ''))
                          var down = parseInt($($('div.fn-down')[0]).text().replace(/,/g, ''))
                          var obj_data = {}
                          obj_data.vid = vid
                          obj_data.name = name
                          obj_data.up = up
                          obj_data.down = down
                          // console.log(obj_data);
                          // throw new Error(obj_data)
                          cb(null, obj_data)
                      }
                  }
              })
              count_youku++
              if(count_youku === len_youku){
                timer_youku.cancel()
              }
            }
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var vid = _data.vid
            var name = _data.name
            var up = _data.up
            var down = _data.down
            var requrl = 'http://v.youku.com/QVideo/~ajax/getVideoPlayInfo?type=vv&id=' + vid
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0){
                        var play = JSON.parse(body).vv
                        var obj_data = {}
                        obj_data.vid = vid
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.up = up
                        obj_data.down = down
                        cb(null, obj_data)
                    }
                }else{
                        console.log('优酷采集' + filmId + '播放数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){

          var timer = schedule.scheduleJob(rule, function () {
            var vid = _data.vid
            var name = _data.name
            var play = _data.play
            var up = _data.up
            var down = _data.down
            var requrl = 'http://comments.youku.com/comments/~ajax/getStatus.html?__ap=%7B%22videoid%22%3A%22' + vid + '%22%7D'
            request(requrl, function(err, res, body){
                if(!err && res.statusCode === 200){
                    // console.log(requrl)
                    if(body.indexOf('{') === 0 && body.indexOf('total') > -1){
                        var comment = JSON.parse(body).total
                        var obj_data = {}
                        obj_data.name = name
                        obj_data.play = play
                        obj_data.comment = comment
                        obj_data.up = up
                        obj_data.down = down
                        cb(null, obj_data)
                    }
                }else{
                        console.log('优酷采集' + filmId + '评论数量出错。')
                    }
            })
            timer.cancel()
          })
        },
        function(_data, cb){
            var name = _data.name
            var play = _data.play
            var comment = _data.comment
            var up = _data.up
            var down = _data.down
            _id = '优酷视频' + getTodayid() + filmId + name
            var _movie
            Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
                if(result === null){
                    _movie = new Movie({
                        name: name,
                        play: play,
                        comment: comment,
                        up: up,
                        down: down,
                        site: '优酷视频',
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
                    console.log('优酷' + name + 'exits.')
                }
            })
        }
    ], function(err, result){
        // console.log(err)
    })
}

exports.parseYoukuData = function(filmId, url) {
    request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            if(body === '\n'){
                console.log('video 200 null error')
            }else{
                var video = parseVideo(body)
                var vid = video.vid
                var title = video.title
                var type = video.type
                var curl = video.curl

                var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
                fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
                    //
                    if(!err){
                        console.log(title + ' is appended.') ;
                    }
                })
                switch(type){
                    case '电影':
                        parseMV(vid, filmId, url)
                        break
                    case '电视剧':
                    case '综艺':
                    // case '原创':
                    case '资讯':
                    case '教育':
                    case '纪录片':
                    // case '动漫':
                    // case '生活':
                        parseTV(curl, filmId)
                        break
                    default:
                      parseTV(curl, title, utype, type, uid, uname)
                        // throw new Error('优酷剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
                }
            }
        }
    })
}
