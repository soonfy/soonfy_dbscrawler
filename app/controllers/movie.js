/**
    *
    *   视频网站采集主文件
    *
    *
*/


var fs = require('fs')
var path = require('path')

var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var schedule = require('node-schedule')

var Movie = require('../models/movie')
var db2vs = require('../models/db2vs')
var Iqiyi = require('./iqiyi')
var Letv = require('./letv')
var Sohu = require('./sohu')
var QQ = require('./qq')
var Youku = require('./youku')
var Mangguo = require('./mangguo')
var Tudou = require('./tudou')

/**
 * 采集数据
 * @method function
 * @return {[type]} [description]
 */
var parseData = function(){

  //url审核文件
  var str ='filmId' + ',' + 'name' + ',' + 'type' + ',' + 'url' + '\r\n'
  fs.writeFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, 'utf-8', function (err){

  })
  fs.writeFile(path.join(__dirname, 'video', 'videodata_false.csv'), str, 'utf-8', function (err){

  })

  //定时规则
  var rule = new schedule.RecurrenceRule()
  var times = []
  for(var i = 0; i < 60; i++){
    times.push(i)
  }
  // var times = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  rule.second = times

  async.waterfall([
    function (cb) {
      db2vs
        .find({}, {filmId: 1, url: 1, site: 1, _id: 0}, function (err, dbs) {
          if(dbs !== null){
            cb(null, dbs)
          }
        })
    },
    function(dbs, cb){
      // console.log(dbs)
      //定时采集
      var count = 0
      var len = dbs.length
      // console.log(len)
      var timer = schedule.scheduleJob(rule, function () {
        var _data = dbs[count]
        // console.log(_data)
        if(_data){
          // console.log(count)
          var site = _data.site
          switch (site) {
            case '爱奇艺视频':
              Iqiyi.parseIqiyiData(_data.filmId, _data.url)
              break;
            case '腾讯视频':
              QQ.parseQQData(_data.filmId, _data.url)
              break;
            case '乐视视频':
              Letv.parseLetvData(_data.filmId, _data.url)
              break;
            case '搜狐视频':
              Sohu.parseSohuData(_data.filmId, _data.url)
              break;
            case '优酷视频':
              Youku.parseYoukuData(_data.filmId, _data.url)
              break;
            case '土豆视频':
              Tudou.parseTudouData(_data.filmId, _data.url)
              break;
            case '芒果视频':
              Mangguo.parseMangguoData(_data.filmId, _data.url)
              break;
            default:
              throw new Error(site + '  is wrong site.')
          }
          count++
          if(count === len){
            console.log('url walk end.')
            timer.cancel()
          }
        }
      })
    }
  ], function (err, res) {

  })
}

//测试采集

// parseData()

/**
 * 定时任务，5个小时采集一次
 * @method RecurrenceRule
 */
//
//
var rule = new schedule.RecurrenceRule()
var timer = schedule.scheduleJob('0 0 */4 * * *', function () {
  parseData()
})

exports.search = function(req, res) {
    var q = req.query.q;

    if (q) {
        Movie
            .fetch(q, function(err, movies) {
                if (err) {
                    console.log(err);
                }

                res.render('movielist', {
                    title: '资源列表页',
                    movies: movies
                })
            })
    } else {
        Movie
            .fetch(null, function(err, movies) {
                if (err) {
                    console.log(err);
                }

                res.render('movielist', {
                    title: '资源列表页',
                    movies: movies
                })
            })
    }
}

exports.list = function(req, res) {
    Movie
        .fetch(null, function(err, movies) {
            if (err) {
                console.log(err);
            }

            res.render('movielist', {
                title: '资源列表页',
                movies: movies
            })
        })
}

exports.del = function(req, res) {
    var id = req.query.id.split(',')

    if (id) {
        for (var i=0; i<id.length; i++) {
            async.series([
                function(cb) {
                    Movie
                        .remove({_id: id[i]}, function(err, movie) {
                            if (err) {
                                cb('remove movie error')
                            }
                            cb(null)
                        })
                }
            ],
            function(err, results) {
                if (err) {
                    console.log(err);
                }
            })
        }
    }
    res.send()
}
