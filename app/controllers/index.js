var request = require('request')
var formidable = require('formidable')
var util = require('util')
var path = require('path')
var fs = require('fs')
var querystring = require('querystring')

exports.index = function(req, res) {
    res.render('index', {
        title: '首页'
    })
}

exports.getIp = function(req, res) {
  var ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
    // console.log(ip)
    // console.log(req.headers['x-forwarded-for'])
    // console.log(req.connection.remoteAddress)
    // console.log(req.socket.remoteAddress)
    // console.log(req.connection.socket.remoteAddress)

    ip = ip.substring(ip.lastIndexOf(':') + 1)

    var vip = ip
    var requrl = 'http://int.dpool.sina.com.cn/iplookup/iplookup.php?format=json&ip=' + vip
    request(requrl, function(err, vres, body){
      if(!err && vres.statusCode === 200){
        // console.log(body)
        var country = JSON.parse(body).country
        var province = JSON.parse(body).province
        var city = JSON.parse(body).city
        var location = country + '-' + province + '-' + city
        // console.log(location)

        var obj_user = {
          'ip': ip,
          'location': location
        }
        res.send(obj_user)
      }
    })
}

exports.upload = function(req, res){
    var uploadpath = path.join(__dirname, 'source')             //上传路径
    
    var form = new formidable.IncomingForm()           //创建上传表单
    form.encoding = 'utf-8'                                         //设置编辑
    form.uploadDir = uploadpath                              //设置上传目录
    form.keepExtensions = true                                   //保留后缀

    form.parse(req, function(err, fields, files) {
        if (err) {
            res.render('index', { title: '上传文件失败。' })
        }else{
            // console.log(files)
            // console.log(files.filename)
            var filename = files.filename.name                                                                 //从files解析出源文件名
            fs.renameSync(files.filename.path, path.join(uploadpath, filename))             //文件重命名
            console.log('上传文件' + filename + '成功。')
            res.render('index', { title: '首页', msg: '上传文件成功。'})
        }
    })
}
