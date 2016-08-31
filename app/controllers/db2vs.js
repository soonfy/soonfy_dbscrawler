/**
 * 采集豆瓣与视频网站的对应关系
 * 正确找到生成db2vs_true文件
 * 错误找到生成db2vs_false文件
 */

var fs = require('fs')
var path = require('path')

var async = require('async')
var request = require('request')
var cheerio = require('cheerio')
var iconv = new require('iconv').Iconv('UTF-8', 'GBK//IGNORE')
var json2csv = require('json2csv')
var schedule = require('node-schedule')
var iconv_lite = require('iconv-lite')


var Jumu = require('../models/jumu')
var Video = require('../models/db2vs')

/**
 * 生成剧目链接true文件
 * @param  {[object|array]} res [剧目查询结果]
 * @param  {[string]} q   [剧目名称]
 * @return {[type]}     [description]
 */
var store = function (res, q) {
  // console.log(res);
  var fields = ['filmId', 'movie_name', 'videoname', 'videosite', 'videotype', 'videourl']
  var fieldNames = ['豆瓣表_id', '需求名称', '网站名称', '视频网站', '网站类型', '网站链接']
  json2csv({data: res, fields: fields, fieldNames: fieldNames}, function (err, csv) {
      var filename = 'db2vs_true.csv';
      fs.appendFile(path.join(__dirname, 'video', filename), iconv.convert(csv + ','), 'utf8', function(err){
        if(err){
          console.log(err)
        }else{
          // console.log('剧目  ' + q + '  视频网站地址导出成功。')
        }

      })
  })
}

/**
 * 生成剧目链接fasle文件
 * @param  {[object|array]} res [剧目查询结果]
 * @param  {[string]} q   [剧目名称]
 * @return {[type]}     [description]
 */
var store_false = function (res, q) {
  console.log(res);
  var fields = ['filmId', 'movie_name', 'videosite']
  var fieldNames = ['豆瓣表_id', '需求名称', '视频网站']
  json2csv({data: res, fields: fields, fieldNames: fieldNames}, function (err, csv) {
      var filename = 'db2vs_false.csv';
      fs.appendFile(path.join(__dirname, 'video', filename), (csv + ','), 'utf8', function(err){
        if(err){
          console.log(err)
        }else{
          // console.log('剧目  ' + q + '  fasle导出成功。')
        }

      })
  })
}

/**
 * 正确结果存入mongodb
 * @param  {array} _data 正确结果结合
 * @return {[type]}       [description]
 */
var insert_true = function (_data) {
  console.log(_data);
  var site = _data.videosite
  var filmId = _data.filmId
  var _id = site + filmId
  Video.findOne({_id: _id}, {_id: 1}, function (err, res) {
    if(res === null){
      _video = new Video({
        filmId: filmId,
        site: site,
        url: _data.videourl,
        category: _data.videotype,
        _id: _id,
        createdAt: Date.now()
      })
      _video.save(function(err) {
          if (err) {
              console.log(err);
          }
      })
    }else {
      console.log(_data.videosite + '  ' + _data.movie_name + '  exits.')
    }
  })
}

//提取播放链接
var sliceUrl = function(vurl){
  var pos = vurl.indexOf('http')
  var url = vurl.substring(pos, vurl.indexOf('html', pos) + 4)
  return url
}

/**
 * 验证url正确性
 */

var parseIqiyi = function(data){
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

var parseQQ = function(data, vurl){
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

var parseLetv = function(data){
    var video = {}
    var $ = cheerio.load(data)
    var list_meta = $('meta')
    var pos = data.indexOf('pid:')
    video.pid = data.substring(pos + 5, data.indexOf(',', pos)).replace(/ /g, '')
    pos = data.indexOf('cid:')
    video.cid = data.substring(pos + 5, data.indexOf(',', pos)).replace(/ /g, '')
    pos = data.indexOf('nowEpisodes:')
    video.length = data.substring(pos + 13, data.indexOf(',', pos) - 1).replace(/ /g, '')
    list_meta.each(function(index, _meta){
        if($(_meta).attr('name') === 'irAlbumName'){
            video.title = $(_meta).attr('content')
        }
        if($(_meta).attr('name') === 'irCategory'){
            video.type = $(_meta).attr('content')
        }
    })
    // console.log('乐视')
    // console.log(video)
    return video
}

var parseSohu = function(data){
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

var parseYouku = function(data){
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

var parseTudou = function(data){
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

var parseMangguo = function(data){
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


/**
 * 解析搜索结果
 */

var queryIqiyi = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.mod_result_list .list_item')
  var count = 1
  list_item.each(function(data) {
    if(count > 5){
      return false      // break the loop
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '爱奇艺视频'
    tempObject['videoname'] = $(this).attr('data-widget-searchlist-tvname')
    var type = $(this).attr('data-widget-searchlist-catageory')
    tempObject['videotype'] = type != -1 ? type : '娱乐'
    var url= $(this).find('a.album_link').attr('href') || $(this).find('a.info_play_btn').attr('href') || $(this).find('a.preview_figure').attr('href') || $(this).find('h3').find('a').attr('href')
    if(url && url.indexOf('iqiyi') > -1){
      tempObject['videourl'] = sliceUrl(url)
      list_video.push(tempObject)
      count++
    }
  })
  return list_video
}

var queryLetv = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.So-detail')
  var count = 1
  list_item.each(function() {
    if(count > 5){
      return false      // break the loop
    }
    // console.log($(this).attr('data-info'))
    var str_info = $(this).attr('data-info')
    // console.log(str_info)
    if(str_info !== undefined){
        tempObject = {}
        tempObject['filmId'] = db._id
        tempObject['movie_name'] = db.name
      var obj_info = eval('(' + str_info + ')')
      // console.log(obj_info)
      var site = obj_info.site
      var vids = obj_info.vidEpisode
      // console.log(vids)
      if(!site){
        if(vids){
          var vid = vids.substring(vids.lastIndexOf('-') + 1)
          var url = 'http://www.letv.com/ptv/vplay/' + vid + '.html'
        }else{
          var url = $(this).find('.zongyi_ul').find('a').attr('href') || $(this).find('.left').find('a').attr('href')
        }
        tempObject['videosite'] = '乐视视频'
        tempObject['videoname'] = $(this).find('h1').text().trim()
        if(obj_info.keyWord && url && url.indexOf('letv') > -1){
          tempObject['videotype'] = obj_info.keyWord.split(/\s+/).pop()
          tempObject['videourl'] = sliceUrl(url)
          list_video.push(tempObject)
          count++
        }
      }
    }
  })
  return list_video
}

var querySohu = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.ssItem')
  var count = 1
  list_item.each(function(data) {
    if(count > 5){
      return false      // break the loop
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '搜狐视频'
    tempObject['videoname'] = $(this).children('.left').children('.pic').children('a').attr('title')
    tempObject['videotype'] = $(this).children('.center').children('.infoA').children('.label-red').text().trim()
    var url
    if($(this).find('.siteSeries').children('div').first().is('.btnBox')){
      // console.log(true)
      var link = $(this).find('.siteSeries').children('.btnBox').find('a').first().attr('href')
      url = decodeURIComponent(link.substring(link.indexOf('http'), link.indexOf('html', link.indexOf('http')) + 4))
    }else if($(this).find('.siteSeries').children('div').first().is('.series')){
      // console.log(false)
      var link = $(this).find('.siteSeries').find('a').first().attr('href')
      // console.log(link)
      url = decodeURIComponent(link.substring(link.indexOf('http'), link.indexOf('html', link.indexOf('http')) + 4))
    }
    if(url && url.indexOf('sohu') > -1){
      tempObject['videourl'] = sliceUrl(url)
      list_video.push(tempObject)
      count++
    }
  })
  return list_video
}

var queryQQ = function(data, db){
  var list_video = []
  var tempObject
  var count = 1
  data.forEach(function(_data){
    if(count > 5){
      return false
    }
    var type = _data.BC.replace(/[^\u4e00-\u9fa5]/gi,"")
    var url
    if(_data.src_list){
      if(_data.src_list.vsrcarray[0].playlist[0]){
        url = _data.src_list.vsrcarray[0].playlist[0].url
      }else{
        for(var year in _data.src_list.vsrcarray[0].playlist){
          url  = _data.src_list.vsrcarray[0].playlist[year][0].url
       }
      }
    }else if(_data.prev_list){
      if(_data.prev_list.vsrcarray[0].playlist){
        url = _data.prev_list.vsrcarray[0].playlist[0].url
      }
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '腾讯视频'
    tempObject['videoname'] = _data.title
    tempObject['videotype'] = type
    if(url && url.indexOf('qq') > -1){
      tempObject['videourl'] = sliceUrl(url)
      list_video.push(tempObject)
      count++
    }
  })
  return list_video
}

var queryYouku = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.s_dir')
  var count = 1
  list_item.each(function(data) {
    if(count > 5){
      return false      // break the loop
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '优酷视频'
    tempObject['videoname'] = $(this).find('.base_name').children('a').attr('_log_title')
    tempObject['videotype'] = $(this).find('.base_type').text().trim()
    if($(this).find('a.btn_play').length > 0){
      var url = $(this).find('a.btn_play').attr('href')
    //   if(db._id == '1031'){
    //       console.log(url)
    //   }
      var urls = url.split('&')
      urls.forEach(function (_url) {
          if(_url.indexOf('/v_show/') > -1){
             url = _url.substring(_url.indexOf('http'), _url.indexOf('html', _url.indexOf('http')) + 4)
          }
      })
    //   if(db._id == '1031'){
    //       console.log(url)
    //       throw new Err()
    //   }
  }else if($(this).find('a.btn_play').length === 0){
      //
      //
    //   console.log(db.movie_name);
    //   console.log($(this).find('.s_items').first().find('a'));
      var vurl = $(this).find('.s_items').first().find('a').first().attr('href') || ''
    //   console.log(vurl)

      var url = vurl.substring(vurl.indexOf('http'), vurl.indexOf('html', vurl.indexOf('http')) + 4)
    }
    if(url && url.indexOf('youku') > -1){
        tempObject['videourl'] = sliceUrl(url)
        list_video.push(tempObject)
      count++
    }
  })
  return list_video
}

var queryTudou = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.s_dir')
  var count = 1
  list_item.each(function(data) {
    if(count > 5){
      return false      // break the loop
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '土豆视频'
    tempObject['videoname'] = $(this).find('.base_name').children('a').attr('_log_title')
    tempObject['videotype'] = $(this).find('.base_type').text().trim()
    if($(this).find('a.btn_play').length > 0){
      var url = $(this).find('a.btn_play').attr('href')
    //   if(db._id == '1031'){
    //       console.log(url)
    //   }
      var urls = url.split('&')
      urls.forEach(function (_url) {
          if(_url.indexOf('.tudou.com/albumplay/') > -1){
             url = _url.substring(_url.indexOf('http'), _url.indexOf('html', _url.indexOf('http')) + 4)
          }
      })
    //   if(db._id == '1031'){
    //       console.log(url)
    //       throw new Err()
    //   }
  }else{
      var url = $(this).find('.base_name').children('a').attr('href')
  }
      if(url && url.indexOf('tudou') > -1){
          tempObject['videourl'] = sliceUrl(url)
          list_video.push(tempObject)
          count++
      }
      })
    // console.log(list_video);
  return list_video
}

var queryMangguo = function(data, db){
  var list_video = []
  var tempObject
  var $ = cheerio.load(data)
  var list_item = $('.so-result-1')
  var count = 1
  list_item.each(function(data) {
    if(count > 5){
      return false      // break the loop
    }
    tempObject = {}
    tempObject['filmId'] = db._id
    tempObject['movie_name'] = db.name
    tempObject['videosite'] = '芒果视频'
    tempObject['videoname'] = $(this).find('img').first().attr('alt')
    var str_key = $(this).find('.result-til').text().trim()
    var list_key = str_key.split(/\s+/)
    if(list_key.length > 1){
      tempObject['videotype'] = list_key.pop()
    }else{
      tempObject['videotype'] = ''
    }
    if($(this).find('a.so-result-btn').length > 0){
      var url = $(this).find('a.so-result-btn').attr('href')
    }else{
      var url = $(this).find('.so-result-alist').first().find('a').first().attr('href')
    }
    if(url && url.indexOf('hunantv') > -1){
      tempObject['videourl'] = sliceUrl(url)
      list_video.push(tempObject)
      count++
    }
  })
  return list_video
}

/**
 * 搜索验证全过程
 */

var search_iqiyi = function (db) {
  var q = db.name
  async.waterfall([
    function (cb) {
      var title = encodeURIComponent(q)
      var requrl = 'http://so.iqiyi.com/so/q_' + title + '_site_iqiyi'
      // console.log('爱奇艺正在搜索' + q + '...')
      // console.log(requrl)
      request(requrl, function(err, res, body){
        if(!err && res.statusCode == 200){
          var ret = queryIqiyi(body, db)
          // 结果存成csv文件
          var _data = ret[0]
          cb(null, _data)
        }else{
          console.log('爱奇艺搜索  ' + q + ' 出错。')
          var w_data = {
            uid: db._id,
            movie_name: db.name,
            videosite: '爱奇艺视频'
          }
          store_false(w_data, q)
        }
      })
    },
    function (_data, cb) {
      if(_data){
        var url = _data.videourl
        request(url, function(err, res, body){
          // console.log(url)
          if(!err && res.statusCode === 200){
            var video = parseIqiyi(body)
            var title = video.title
            if(title){
              store(_data, q)
              insert_true(_data)
              // cb(null, _data)
            }else{
              var w_data = {
                uid: db._id,
                movie_name: db.name,
                videosite: '爱奇艺视频'
              }
              store_false(w_data, q)
            }
          }
        })
      }
    }
  ],function (err, res) {
    if(!err){
      // console.log(res)
    }
  })
}

var search_qq = function (db) {
  var q = db.name
  async.waterfall([
    function (cb) {
      var title = encodeURIComponent(q)
      var requrl = 'http://s.video.qq.com/search?comment=1&stype=0&plat=2&otype=json&start=0&end=20&cgi=search&plver=1&query=' + title
      // console.log('腾讯正在搜索' + q + '...')
      // console.log(requrl)
      request(requrl, function(err, res, body){
        if(!err && res.statusCode == 200){
          var reg = /QZOutputJson=(.+);/
          var _body = body.replace(reg,'$1')
          // console.log(q)
          try {
              var datalist = JSON.parse(_body).list
              var ret = queryQQ(datalist, db)
              // 结果存成csv文件
              var _data = ret[0]
              cb(null, _data)
          } catch (e) {
              console.log('腾讯解析json  ' + q + '  出错。')
              var w_data = {
                filmId: db._id,
                movie_name: db.name,
                videosite: '腾讯视频'
              }
              store_false(w_data, q)
          }
        }else{
          console.log('腾讯搜索  ' + q + '  出错。')
          var w_data = {
            filmId: db._id,
            movie_name: db.name,
            videosite: '腾讯视频'
          }
          store_false(w_data, q)
        }
      })
    },
    function (_data, cb) {
      if (_data != undefined) {
        var url = _data.videourl
        request(url, function(err, res, body){
          if(!err && res.statusCode === 200){
              var video = parseQQ(body, url)
              var title = video.title

              if(title.indexOf('utf-8') === -1 && title.indexOf('zh-cn') === -1 && title.indexOf('Content-Type') === -1){
                store(_data, q)
                //结果存mongodb
                insert_true(_data)
            }else{
              var w_data = {
                filmId: db._id,
                movie_name: db.name,
                videosite: '腾讯视频'
              }
              store_false(w_data, q)
            }
          }
        })
      }
    }
  ], function () {

  })
}

var search_letv = function (db) {
  var q = db.name
  async.waterfall([
    function (cb) {
      var title = encodeURIComponent(q)
      var requrl = 'http://so.letv.com/s?wd=' + title
      // console.log('乐视正在搜索' + q + '...')
      // console.log(requrl)
      request(requrl, function(err, res, body){
        if(!err && res.statusCode == 200){
          var ret = queryLetv(body, db)
          // 结果存成csv文件
          var _data = ret[0]
          cb(null, _data)
        }else{
          console.log('乐视搜索  ' + q + ' 出错。')
          var w_data = {
            filmId: db._id,
            movie_name: db.name,
            videosite: '乐视视频'
          }
          store_false(w_data, q)
        }
      })
    },
    function (_data, cb) {
      if (_data) {
        var url = _data.videourl
        request(url, function(err, res, body){
          if(!err && res.statusCode === 200){
              // console.log(url)
              var video = parseLetv(body)
              var type = video.type

              if(type){
                store(_data, q)
                //结果存mongodb
                insert_true(_data)
              }else{
                var w_data = {
                  filmId: db._id,
                  movie_name: db.name,
                  videosite: '乐视视频'
                }
                store_false(w_data, q)
              }
          }
        })
      }
    }
  ], function () {

  })
}

var search_sohu = function (db, boo) {
  var q = db.name
  var title = encodeURIComponent(q)
  var requrl = 'http://so.tv.sohu.com/mts?wd=' + title
  // console.log('搜狐正在搜索' + q + '...')
  // console.log(requrl)
  request(requrl, function(err, res, body){
    if(!err && res.statusCode == 200){
      var ret = querySohu(body, db)
      // 结果存成csv文件
      var _data = ret[0]


      if (_data) {
        var url = _data.videourl
        request({
        url: url,
        encoding: null}, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var vdata = iconv_lite.decode(body, 'gbk')
            var video = parseSohu(vdata)
            var type = video.type

            if(typeof type !== 'undefined'){
              store(_data, q)
              //结果存mongodb
              insert_true(_data)
            }else{
              console.log('搜狐搜索  ' + q + ' 出错。')
              var w_data = {
                filmId: db._id,
                movie_name: db.name,
                videosite: '搜狐视频'
              }
              store_false(w_data, q)
            }
        }
    })

      }
    }else{
      console.log('搜狐搜索  ' + q + ' 出错。')
      var w_data = {
        filmId: db._id,
        movie_name: db.name,
        videosite: '搜狐视频'
      }
      store_false(w_data, q)
    }
  })
}

var search_youku = function (db, boo) {
  var q = db.name
  var title = encodeURIComponent(q)
  var requrl = 'http://www.soku.com/search_video/q_' + title
  // console.log('优酷正在搜索' + q + '...')
  // console.log(requrl)
  request(requrl, function(err, res, body){
    if(!err && res.statusCode == 200){
      var ret = queryYouku(body, db)
      //结果存成csv文件
      var _data = ret[0]


      if (_data) {
        var url = _data.videourl
        request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            if(body === '\n'){
                console.log('video 200 null error')
            }else{
                var video = parseYouku(body)
                var vid = video.vid
                var title = video.title
                var type = video.type
                var curl = video.curl

                store(_data, q)
                //结果存mongodb
                insert_true(_data)

            }
        }
    })

      }
    }else{
      console.log('优酷搜索  ' + q + ' 出错。')
      var w_data = {
        filmId: db._id,
        movie_name: db.name,
        videosite: '优酷视频'
      }
      store_false(w_data, q)
    }
  })
}

var search_tudou = function (db) {
  var q = db.name
  var title = encodeURIComponent(q)
  var requrl = 'http://www.soku.com/t/nisearch/' + title
  // console.log('土豆正在搜索' + q + '...')
  // console.log(requrl)
  request(requrl, function(err, res, body){
    if(!err && res.statusCode == 200){
      var ret = queryTudou(body, db)
      // 结果存成csv文件
      var _data = ret[0]


      if (_data) {
        var url = _data.videourl
        request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var video = parseTudou(body)
            var pid = video.pid
            var vid = video.vid
            var title = video.title
            var type = video.type
            store(_data, q)
            //结果存mongodb
            insert_true(_data)
        }
    })

      }
    }else{
      console.log('土豆搜索  ' + q + ' 出错。')
      var w_data = {
        filmId: db._id,
        movie_name: db.name,
        videosite: '土豆视频'
      }
      store_false(w_data, q)
    }
  })
}

var search_mgtv = function (db) {
  var q = db.name
  var title = encodeURIComponent(q)
  var requrl = 'http://so.hunantv.com/so/k-' + title
  // console.log('芒果正在搜索' + q + '...')
  // console.log(requrl)
  request(requrl, function(err, res, body){
    if(!err && res.statusCode == 200){
      var ret = queryMangguo(body, db)

      // 结果存成csv文件
      var _data = ret[0]


      if (_data) {
        var url = _data.videourl
        request(url, function(err, res, body){
        if(!err && res.statusCode === 200){
            // console.log(url)
            var video = parseMangguo(body)
            var site = video.site

            if(site.indexOf('湖南卫视') === -1){
                store(_data, q)
                //结果存mongodb
                insert_true(_data)
            }else{
              var w_data = {
                filmId: db._id,
                movie_name: db.name,
                videosite: '芒果视频'
              }
              store_false(w_data, q)
            }
        }
    })

      }
    }else{
      console.log('芒果搜索  ' + q + ' 出错。')
      var w_data = {
        filmId: db._id,
        movie_name: db.name,
        videosite: '芒果视频'
      }
      store_false(w_data, q)
    }
  })
}

//搜索剧目信息
var search = function(db){

  async.parallel([
    //爱奇艺
    function (cb) {
      search_iqiyi(db)
      cb(null)
    },
    //腾讯
    function (cb) {
      search_qq(db)
      cb(null)
    },
    //乐视
    function (cb) {
      search_letv(db)
      cb(null)
    },
    //搜狐
    function (cb) {
      search_sohu(db)
      cb(null)
    },
    //优酷
    function (cb) {
      search_youku(db)
      cb(null)
    },
    //土豆
    function (cb) {
      search_tudou(db)
      cb(null)
    },
    //芒果
    function (cb) {
      search_mgtv(db)
      cb(null)
    }
  ], function(err, results){

  })
}

/**
 * 从数据库读取数据查找
 * @return {[type]} [description]
 */
var dbfind = function () {

    var filename = 'db2vs_true.csv';
    fs.writeFile(path.join(__dirname, 'video', filename), '', 'utf8', function(err){
      if(err){
        console.log(err)
      }else{
        console.log('true文件新建成功。')
      }
    })
    var filename_false = 'db2vs_false.csv';
    fs.writeFile(path.join(__dirname, 'video', filename_false), '', 'utf8', function(err){
      if(err){
        console.log(err)
      }else{
        // console.log('false文件新建成功。')
      }
    })

    async.waterfall([
      function(cb){
        Jumu.find({}, {name: 1}, function (err, dbs) {
          cb(null, dbs)
        })
      },
      function (dbs, cb) {
        if(dbs.length > 0){
          //定时器
          var rule = new schedule.RecurrenceRule()
          var times = [0, 10, 20, 30, 40, 50]
          rule.second = times
          var count = 0
          var len = dbs.length
          // console.log(len)
          var timer = schedule.scheduleJob(rule, function () {
            if(dbs[count]){
              console.log(count)
              search(dbs[count])
              count++
              if(count === len){
                timer.cancel()
              }
            }
          })
          cb(null)
        }else{
          console.log('films db is empty.')
        }
      }
    ],function (err, res) {

    })
}

//测试对应数据
//
dbfind()

/**
 * 执行对应程序
 * @method dbfind
 * @return {[type]} [description]
 */

 var rule = new schedule.RecurrenceRule()
 var timer = schedule.scheduleJob('0 0 */7 * * *', function () {
   dbfind()
 })
