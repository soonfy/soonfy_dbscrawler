var Index = require('../app/controllers/index')
var Movie = require('../app/controllers/db2vs')                       //对应关系
var Movie = require('../app/controllers/movie')                       //采集数据
var Count = require('../app/controllers/count')                       //汇总数据
var Expshows = require('../app/controllers/explist')                 //导出剧目
var Expshow = require('../app/controllers/expshow')                 //导出剧集
var File = require('../app/controllers/file')

module.exports = function(app) {

    // index
    app.get('/', Index.index)
    app.get('/index/ip', Index.getIp)
    app.post('/', Index.upload)

    // movie model
    app.get('/movie/search', Movie.search)
    app.get('/movie/list', Movie.list)
    app.delete('/movie/list', Movie.del)
    // app.get('/movie/export', Expshows.down)                  //导出剧目
    app.get('/movie/vexport', Expshow.down)                 //导出剧集

    //下载文件
    app.get(/\/download(\/\w)?/, File.download)
    app.get(/^\/([\d-]+\/)(\w+\.csv)?/, File.download)

}
