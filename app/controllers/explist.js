/**
    *
    *   导出剧目汇总数据
    *
*/

var Count = require('../models/count')

/**
 * 导出起止时间段的剧目汇总数据
 * @method export_vscount
 * @param  {[type]}       ids   [剧目id数组]
 * @param  {[type]}       st    [起始时间点]
 * @param  {[type]}       et    [终止时间点]
 * @param  {[type]}       sites [网站数组]
 * @return {[type]}             [导出起止时间段剧目汇总数据的数组]
 */
var export_vscount = function (ids, st, et, sites) {
  let start = typeof st === 'string' ? new Date(st) : st
  let end = typeof et === 'string' ? new Date(et) : et
  start = start.setHours(0, 0, 0) - 1000 * 60 * 60 * 24
  end = end.setHours(23, 59, 59)
  Count
    .find({filmId: {'$in': ids}, site: {'$in': sites}, createdAt: {'$gte': start, '$lte': end}}, {filmId: 1, playSum: 1, site: 1, createdAt: 1, _id: 0}, function(err, playSums){
      // console.log(playSums)
      let results = []                  //存储最后结果
      let hids = []                     //存储已处理id
      let hidsites = []                  //存储已处理id+site
      playSums.forEach(function (_playSum) {
        var id = _playSum.filmId
        var site = _playSum.site
        var playSum = _playSum.playSum
        if(hids.indexOf(id) === -1){
          // console.log(id + ' is first time.');
          //初次处理该id
          let temp = {}
          temp._id = id
          //插入keywords
          // temp.keyword = keyword
          temp.series = {}
          temp.series[site] = []
          temp.series[site].push(playSum)
          hids.push(id)
          hidsites.push(id+site)
          results.push(temp)
        }else if(hidsites.indexOf(id+site) === -1){
          // console.log(id + ' is not first time, ' + site + ' is first time.');
          //再次处理该id，初次处理该id+site
          results.forEach(function (_result, _index) {
            if(_result._id === id){
              hids.push(id)
              hidsites.push(id+site)
              _result.series[site] = []
              _result.series[site].push(playSum)
            }
          })
        }else{
          // console.log(id + ' and ' + site + ' are not first time.');
          //再次处理该id，再次处理该id+site
          results.forEach(function (_result, _index) {
            if(_result._id === id){
              for(let attr in _result.series){
                if(attr === site){
                  // console.log(site);
                  _result.series[attr].push(playSum)
                  return
                }
              }
            }
          })
        }
      })
      // console.log(results)
      // 排序并计算日播放量
      results.forEach(function (_result) {
        var sites = _result.series
        for(var site in sites){
          var temp = sites[site]
          //从小到大排序
          temp = temp.sort(function (a, b) {
            return a - b
          })
          // console.log(temp);
          var dplay = []
          //计算日播放量
          temp.forEach(function (_playSum, _index) {
            if(_index > 0){
              dplay.push(_playSum - temp[_index - 1])
            }
          })
          // console.log(dplay);
          // 覆盖网站总播放量
          sites[site] = dplay
        }
      })
      // console.log(results[1].series['爱奇艺视频'])
      // 添加keyword
      // results.forEach(function (_res) {
      //   // 读取schema_film的name属性
      //   _res.keyword = _res.film().name
      // })
      // console.log(results);
      return results
    })
}

var ids = ['57948c1fb0b0546424ec0ed6', '579488acb0b0546424ec0ed5']
var st = '2016-7-24'
var et = '2016-7-27'
var sites = ['爱奇艺视频', '腾讯视频', '乐视视频', '搜狐视频', '优酷视频', '土豆视频', '芒果视频']
//测试数据导出
// export_vscount(ids, st, et, sites)
