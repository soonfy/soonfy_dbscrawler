/**
 * jquery 需要1.6以上
 */
$(function() {
    // 删除跟踪任务
    $('.del')
        .click(function(e) {
            var target = $(e.target)
            var id = target.data('id')
            var tr

            if (id !== undefined) {
                tr = $('.item-id-' + id)
            } else {
                var ids = []
                var trs = []
                $("input[name='subBox']")
                    .each(function() {
                        if ($(this).prop('checked') === true) {
                            var item = $(this)
                                        .parents('tr')
                                        .attr('class')
                                        .replace(/item-id-/, '')
                            ids.push(item)
                            trs.push($('.item-id-' + item))
                        }
                    })
            }
            id = id || ids.join(',')
            tr = tr || trs
            $.ajax({
                    type: 'DELETE',
                    url: '/movie/list?id=' + id
                })
                .done(function(results) {
                    if (tr.length > 0) {
                        $.each(tr, function(index, ele) {
                            $(ele).remove()
                        })
                    }
                })
        })
          
    // 批量操作
    $('.all')
        .click(function() {
            var checked = $(this).children().prop('checked')
            // input有属性时，用双引号，其他内部没有的用单引号
            $("input[name='subBox']").each(function() {
                $(this).prop('checked', checked)
            })
        })
    var $subBox = $("input[name='subBox']")
    $subBox
        .click(function() {
            $('.all')
                .prop('checked', $subBox.length == $("input[name='subBox']:checked").length ? true : false)
        })
})
