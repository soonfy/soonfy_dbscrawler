/**
		*
		*   采集乐视
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
		var catalogs, contentid, cid
		list_meta.each(function(index, _meta){
			if($(_meta).attr('name') === 'catalogs'){
				catalogs = $(_meta).attr('content')
			}
			if($(_meta).attr('name') === 'contentid'){
				contentid = $(_meta).attr('content')
			}
		})
		var title = $('div.right').find('h3').text()
		var pos = data.indexOf('sub_column_id = "')
		var temp = data.substring(pos + 17, data.indexOf('";', pos + 17)).replace(/ /g, '')
		catalogs = catalogs? catalogs: temp
		pos = data.indexOf('column_id = "')
		cid = data.substring(pos + 13, data.indexOf('";', pos + 13)).replace(/ /g, '')
		pos = data.indexOf('itemid1="')
		temp = data.substring(pos + 9, data.indexOf('";', pos + 9)).replace(/ /g, '')
		contentid = contentid? contentid: temp
		video = {
			title: title,
			contentid: contentid,
			catalogs: catalogs,
			cid: cid
		}
		// console.log('乐视')
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
var parseMV = function(pid, filmId, vid){

	var rule = new schedule.RecurrenceRule()
	var times = [5, 15, 25, 35, 45, 55]
	rule.second = times

		async.waterfall([
				function(cb){

					var timer = schedule.scheduleJob(rule, function () {
						var requrl = 'http://v.stat.letv.com/vplay/queryMmsTotalPCount?pid=' + pid
						request(requrl, function(err, res, body){
								if(!err && res.statusCode === 200){
										// console.log(requrl)
										if(body.indexOf('{') === 0 && body.indexOf('plist_play_count') > -1){
												var play = JSON.parse(body).plist_play_count
												var playSum = JSON.parse(body).plist_play_count
												var comment = JSON.parse(body).pcomm_count
												var commentSum = JSON.parse(body).pcomm_count
												cb(null, play, playSum, comment, commentSum)
										}
								}else{
												console.log('乐视采集' + filmId + '播放评论数量出错。')
										}
						})
						timer.cancel()
					})
				},
				function(play, playSum, comment, commentSum, cb){
					var timer = schedule.scheduleJob(rule, function () {
						var requrl = 'http://v.stat.letv.com/vplay/getIdsInfo?ids=' + vid
						request(requrl, function(err, res, body){
								if(!err && res.statusCode === 200){
										// console.log(requrl)
										if(body.indexOf('[') === 0 && body.indexOf('up') > -1){
												var upSum = JSON.parse(body)[0].up
												var downSum = JSON.parse(body)[0].down
												cb(null, play, playSum, comment, commentSum, upSum, downSum)
										}
								}else{
												console.log('乐视采集' + filmId + '赞踩数量出错。')
										}
						})
						timer.cancel()
					})
				},
				function(play, playSum, comment, commentSum, upSum, downSum, cb){
					var _count
					var a_id = '乐视视频' + getTodayid() + filmId
					Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
							if(result === null){
									_count = new Count({
											playSum: playSum,
											commentSum: commentSum,
											upSum: upSum,
											downSum: downSum,
											site: '乐视视频',
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
									console.log('乐视' + filmId + 'exits.')
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
 * @return {[type]}        [剧目播放，评论，剧集播放，评论数量]
 */
var parseTV = function(url, title, contentid, catalogs, cid, filmId){

	var rule = new schedule.RecurrenceRule()
	var times = [7, 17, 27, 37, 47, 57]
	rule.second = times

		async.waterfall([
				function(cb){

					var timer = schedule.scheduleJob(rule, function () {
						var requrl = 'http://ia.apps.cntv.cn/act/platform/showMsg_utf8.jsp?url=' + url + '&articleId=' + contentid + '&title=' + title + '&type=VIDA&sorts=' + catalogs + ',' + cid +  ',VIDA&sysSource=tv'
						request(requrl, function(err, res, body){
							if(!err && res.statusCode === 200){
								// console.log(requrl)
								if(body.indexOf('clickNum') > -1){
									var playSum = parseInt(body.replace(/\D/g, ''))
									console.log(playSum)
									var _count
									var p_id = '央视网' + getTodayid() + filmId
									Count.findOne({_id: p_id}, {_id: 1}, function(err, result){
										if(result === null){
											_count = new Count({
												playSum: playSum,
												site: '央视网',
												createdAt: Date.now(),
												filmId: filmId,
												_id: p_id
											})
											_count.save(function(err) {
												if (err) {
													console.log(err);
												}
											})
											cb(null)
										}else {
											console.log('央视' + filmId + 'exits.')
										}
									})
								}
							}else{
								console.log('央视采集' + filmId + '播放评论数量出错。')
							}
						})
						timer.cancel()
					})
				},
				function(cb){

					var timer = schedule.scheduleJob(rule, function () {
						var requrl = 'http://newcomment.cntv.cn/comment/gettree/app/cms_tvlm/itemid/' + cid  + '_' + contentid + '/itemtype/2/page/1/prepage/20/'
						request(requrl, function(err, res, body){
								if(!err && res.statusCode === 200){
										// console.log(requrl)
										if(body.indexOf('{') === 0 && body.indexOf('total') > -1){
												var data = JSON.parse(body)
												var commentSum = data.data.total
												console.log(commentSum)
												// cb(null, commentSum)
												var _count
												var c_id = '央视网' + getTodayid() + filmId
												Count.findOne({_id: c_id}, {_id: 1}, function(err, result){
													if(result === null){
														_count = new Count({
															commentSum: commentSum,
															site: '央视网',
															createdAt: Date.now(),
															filmId: filmId,
															_id: c_id
														})
														_count.save(function(err) {
															if (err) {
																console.log(err);
															}
														})
														cb(null)
													}else {
														console.log('央视' + filmId + 'exits.')
														result.commentSum = commentSum
														result.save(function(err) {
															if (err) {
																console.log(err);
															}
														})
														cb(null)
													}
												})
										}
								}else{
												console.log('央视采集' + filmId + '播放评论数量出错。')
										}
						})
						timer.cancel()
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
 * @return {[type]}        [剧目播放，评论，剧集播放，评论数量]
 */
var parseZY = function(pid, cid, filmId){

	var rule = new schedule.RecurrenceRule()
	var times = [0, 10, 20, 30, 40, 50]
	rule.second = times

		async.waterfall([
				function(cb){

					var timer = schedule.scheduleJob(rule, function () {
						var list_year = []
						var requrl = 'http://api.letv.com/mms/out/album/videos?id=' + pid +'&cid=' + cid + '&platform=pc&relvideo=1'
						request(requrl, function(err, res, body){
								if(!err && res.statusCode === 200){
										// console.log(requrl)
										if(body.indexOf('{') === 0 && body.indexOf('data') > -1){
												var vdata = JSON.parse(body).data
												for(var year in vdata){
														for(var month in vdata[year]){
																list_year.push(year + '&*' + month)
														}
												}
												cb(null, list_year)
										}
								}else{
												console.log('乐视采集' + filmId + '年代列表出错。')
										}
						})
						timer.cancel()
					})
				},
				function(list_year, cb){

					var count_letv = 0
					var len_letv = list_year.length
					// console.log(len_letv)
					var timer_letv = schedule.scheduleJob(rule, function () {
						var _year = list_year[count_letv]
						if(_year != null){
							// console.log(count_letv)
							var year = _year.split('&*')[0]
							var month = _year.split('&*')[1]
							var requrl = 'http://api.letv.com/mms/out/album/videos?id=' + pid + '&cid=' + cid + '&platform=pc&relvideo=1&year=' + year + '&month=' + month
							request(requrl, function(err, res, body){
									if(!err && res.statusCode === 200){
											// console.log(requrl)
											if(body.indexOf('{') === 0 && body.indexOf('data') > -1){
												try {
													var list_data = JSON.parse(body).data[year][month]
												} catch (e) {
													var list_data = []
												}
													cb(null, list_data)
											}
									}else{
											console.log('乐视采集' + filmId + '剧集列表出错。')
									}
							})
							count_letv++
							if(count_letv === len_letv){
								timer_letv.cancel()
							}
						}
					})
				},
				function(list_data, cb){

					var count_letv = 0
					var len_letv = list_data.length
					// console.log(len_letv)
					var timer_letv = schedule.scheduleJob(rule, function () {
						var _data = list_data[count_letv]
						if(_data != null){
							// console.log(count_letv)
							var vid = _data.vid
							var name = _data.title
							var requrl = 'http://v.stat.letv.com/vplay/queryMmsTotalPCount?pid=' + pid + '&vid=' + vid
							request(requrl, function(err, res, body){
									if(!err && res.statusCode === 200){
											// console.log(requrl)
											var obj_data = {}
											obj_data.name = name
											if(body.indexOf('{') === 0 && body.indexOf('plist_play_count') > -1){
													obj_data.play = JSON.parse(body).media_play_count
													obj_data.playSum = JSON.parse(body).plist_play_count
													obj_data.comment = JSON.parse(body).vcomm_count
													obj_data.commentSum = JSON.parse(body).pcomm_count
													obj_data.up = JSON.parse(body).up
													obj_data.down = JSON.parse(body).down
													cb(null, obj_data)
											}
									}else{
											console.log('乐视采集' + filmId + '播放评论数量出错。')
									}
							})
							count_letv++
							if(count_letv === len_letv){
								timer_letv.cancel()
							}
						}
					})
				},
				function(_data, cb){
					var name = _data.name
					var playSum = _data.playSum
					var commentSum = _data.commentSum
					var _count
					var a_id = '乐视视频' + getTodayid() + filmId
					Count.findOne({_id: a_id}, {_id: 1}, function(err, result){
							if(result === null){
									_count = new Count({
											playSum: playSum,
											commentSum: commentSum,
											site: '乐视视频',
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
									console.log('乐视视频' + filmId + 'exits.')
							}
					})

					var play = _data.play
					var comment = _data.comment
					var up = _data.up
					var down = _data.down
					var _id = '乐视视频' + getTodayid() + filmId + name
					var _movie
					Movie.findOne({_id: _id}, {_id: 1}, function(err, result){
							if(result === null){
									_movie = new Movie({
											name: name,
											play: play,
											comment: comment,
											up: up,
											down: down,
											site: '乐视视频',
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
									console.log('乐视视频' + name + 'exits.')
							}
					})
				}
		], function(err, result){
				// console.log(err)
		})
}

exports.parseCNTVData = function(filmId, url, type) {
	console.log(type)
	if(['电视剧', '综艺'].indexOf(type) > -1){
		request(url, function (err, res, body) {
			if(!err && res.statusCode === 200){
				var video = parseVideo(body)
				console.log(video)
				var title = video.title
				var contentid = video.contentid
				var catalogs = video.catalogs
				var cid = video.cid
				var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
				fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
					//
					if(!err){
						console.log(title + ' is appended.') ;
					}
				})
				parseTV(url, title, contentid, catalogs, cid, filmId)
			}else{
				
			}
		})
	}else if(['电影'].indexOf(type) > -1){

	}else{
		throw new Error(filmId + ' ' + url + ' ' + type)
	}
		// request(url, function(err, res, body){
		//     if(!err && res.statusCode === 200){
		//         // console.log(url)
		//         var video = parseVideo(body)
		//         var pid = video.pid
		//         var vid = video.vid
		//         var title = video.title
		//         var type = video.type
		//         var cid = video.cid
		//         var length = video.length

		//         if(type){
		//           var str = filmId + ',' + title + ',' + type + ',' + url + '\r\n'
		//           fs.appendFile(path.join(__dirname, 'video', 'videodata_true.csv'), str, function (err) {
		//               //
		//               if(!err){
		//                   console.log(title + ' is appended.') ;
		//               }
		//           })
		//           switch(type){
		//               case '电影':
		//                   parseMV(pid, filmId, vid)
		//                   break
		//               case '电视剧':
		//                   parseTV(pid, cid, length, filmId)
		//                   break
		//               case '综艺':
		//               case '资讯':
		//               // case '财经':
		//               case '纪录片':
		//               case '音乐':
		//               // case '动漫':
		//                   parseZY(pid, cid, filmId)
		//                   break
		//               default:
		//                 parseZY(pid, cid, filmId)
		//                 // throw new Error('乐视剧目[ ' + title + ' ][ ' + url + '    ]类型 [ ' + type + ' ] 有错误。')
		//           }
		//         }else{
		//           var str = filmId + ',' + 'title' + ',' + 'type' + ',' + url + ','
		//           fs.appendFile(path.join(__dirname, 'video', 'videodata_false.csv'), str, function (err) {
		//             if(!err){
		//                 console.log('the false message is appended.') ;
		//             }
		//           })
		//         }

		//     }
		// })
}
