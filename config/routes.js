var Index = require('../app/controllers/index')
var DB2vs = require('../app/controllers/db2vs')                       //对应关系
var Movie = require('../app/controllers/movie')                       //采集数据
var Count = require('../app/controllers/count')                       //汇总数据

module.exports = function(app) {

    // index
    app.get('/', Index.index)
    app.get('/index/ip', Index.getIp)
    app.post('/', Index.upload)

    // movie model
    app.get('/movie/search', Movie.search)
    app.get('/movie/list', Movie.list)
    app.delete('/movie/list', Movie.del)

}
