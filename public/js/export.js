$(function(){

  $('.export')
        .click(function(e) {
          var target = $(e.target)
          target.attr('disabled', true)
          setTimeout(function(){
            target.attr('disabled', false)
          }, 1000 * 5)
            $.ajax({
                type: 'get',
                url: '/movie/export'
            })
            .done(function(data) {
                //console.log(data);

            })
        })

  $('.vexport')
    .click(function(e) {
      var target = $(e.target)
      target.attr('disabled', true)
      setTimeout(function(){
        target.attr('disabled', false)
      }, 1000 * 5)
        $.ajax({
            type: 'get',
            url: '/movie/vexport'
        })
        .done(function(data) {
            //console.log(data);

        })
    })
})
