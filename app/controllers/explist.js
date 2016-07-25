/**
    *
    *   导出剧目汇总数据
    *
*/

var async = require('async')
var json2csv = require('json2csv')
var fs = require('fs')
var path = require('path')
var iconv = new require('iconv').Iconv('UTF-8', 'GBK//IGNORE')

var Count = require('../models/count')

//导出播放
var exportSumCount = function(fileday){

  async.parallel([
    //测试每个月13号
    function(cb){
      Count
        .find({udate: /^\d{4}\-\d{2}\-16/i}, function(err, list_data){
        //   console.log(list_data)
          cb(null, list_data)
        })
    },
    // //每个月15号
    // function(cb){
    //   Count
    //     .find({uid: {'$in': uids}, udate: /^\d{4}\-\d{2}\-15/i}, function(err, list_data){
    //     //   console.log(list_data)
    //       cb(null, list_data)
    //     })
    // },
    // //每个月30号
    // function(cb){
    //   Count
    //     .find({uid: {'$in': uids}, udate: /^\d{4}\-\d{2}\-30/i}, function(err, list_data){
    //     //   console.log(list_data)
    //       cb(null, list_data)
    //     })
    // }
  ], function(err, results){

    //二维数组转换为一维
    var list_result = []
    results.forEach(function(_result){
      list_result = list_result.concat(_result)
    })

    //数组转换为csv
    var fields = ['udate', 'uid', 'uname', 'site', 'utype', 'playSumCount', 'commentSumCount']
    var fieldNames = ['日期', 'ID', '剧目名称', '视频网站', '剧目类型', '剧目播放量', '剧目评论量']
    json2csv({data: list_result, fields: fields, fieldNames: fieldNames}, function(err, csv){
        if(err){
          console.log(err)
        }
        // console.log(csv)
        var filename = fileday + '_剧目汇总数据' + '.csv'
        fs.writeFile(path.join(__dirname, 'data', fileday, filename), iconv.convert(csv), 'utf8', function(err){
          if(err){
            console.log(err)
          }else{
            console.log(fileday +'剧目汇总数据导出成功。')
          }

        })
      })
  })
}

//点击导出剧目
exports.down = function(){
  var filetime = new Date()
  var fileyear = filetime.getFullYear()
  var filemonth = filetime.getMonth() + 1
  var filedate = filetime.getDate()
  var fileday ='' + fileyear + '-' + filemonth + '-' + filedate
  // console.log(fileday)

  //生成目录
  if(!fs.existsSync(__dirname + '/data/' + fileday)){
    fs.mkdirSync(__dirname + '/data/' + fileday)
  }

  exportSumCount(fileday)
}
