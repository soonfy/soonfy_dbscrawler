# soonfy_dbscrawler
read url from db, crawl videosite data

1. iqiyi test category

综艺类：综艺，资讯，动漫

1.1 parse pid, cid

1.2 test url

url = http://cache.video.qiyi.com/jp/sdlst/'cid'/'pid'/

2. qq test category

2.1 parse pid

2.2 test url

url = http://s.video.qq.com/loadplaylist?type=6&plname=qq&otype=json&id='pid'

3. le test category
综艺类：综艺，资讯，音乐

3.1 parse pid, cid

3.2 test url

url = http://api.letv.com/mms/out/album/videos?id='pid'&cid='cid'&platform=pc&relvideo=1

4. sohu test category

4.1 parse pid

4.2 test url

url = http://pl.hd.sohu.com/videolist?playlistid='pid'

5. tudou test category
综艺类：综艺，资讯，教育

5.1 parse pid

5.2 test url

url = http://www.tudou.com/tvp/getMultiTvcCodeByAreaCode.action?type=3&app=4&codes='pid'

6. mgtv test category

6.1 parse site, path, pid

6.2 test url

url = http://www.hunantv.com/'site'/'path'/'pid'/s/json.year.js

7. youku test category

综艺类：综艺，资讯，教育
