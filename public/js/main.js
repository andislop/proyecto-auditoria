$(document).ready(function(){
    // Función para el menú lateral
    $('.btn-sideBar-SubMenu').on('click', function(){
        var SubMenu=$(this).next('ul');
        var iconBtn=$(this).children('.zmdi-caret-down');
        if(SubMenu.hasClass('show-sideBar-SubMenu')){
            iconBtn.removeClass('zmdi-hc-rotate-180');
            SubMenu.removeClass('show-sideBar-SubMenu');
        }else{
            iconBtn.addClass('zmdi-hc-rotate-180');
            SubMenu.addClass('show-sideBar-SubMenu');
        }
    });

    // Función para el botón de salida (logout)
    $('.btn-exit-system').on('click', function(){
        console.log("Clic detectado en el botón de salida."); // Mensaje inicial

        swal({
            title: 'Are you sure?',
            text: "The current session will be closed",
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#03A9F4',
            cancelButtonColor: '#F44336',
            confirmButtonText: '<i class="zmdi zmdi-run"></i> Yes, Exit!',
            cancelButtonText: '<i class="zmdi zmdi-close-circle"></i> No, Cancel!',
            // --- Opciones para evitar cierres accidentales ---
            allowOutsideClick: false, // Evita cerrar el SweetAlert al hacer clic fuera
            allowEscapeKey: false,   // Evita cerrar el SweetAlert al presionar la tecla Escape
            // ------------------------------------------------
        }).then(function (result) {
            console.log("Resultado del SweetAlert:", result); // Muestra el objeto 'result' completo

            // 'result.value' es true si el botón de confirmar fue presionado en SweetAlert2
            if (result.value) {
                console.log("Confirmación de salida recibida. Redirigiendo a /..."); // Mensaje antes de redirigir
                window.location.href = "/"; // Redirige a la raíz del sitio (index.html, o lo que tu backend sirva para '/')
            } else {
                console.log("Cancelación de salida o clic fuera del SweetAlert."); // Mensaje si se cancela
            }
        }).catch(function(error) {
            console.error("Error en el SweetAlert:", error); // Captura posibles errores en el SweetAlert
        });
    });

    // Función para el menú del dashboard
    $('.btn-menu-dashboard').on('click', function(){
        var body=$('.dashboard-contentPage');
        var sidebar=$('.dashboard-sideBar');
        if(sidebar.css('pointer-events')=='none'){
            body.removeClass('no-paddin-left');
            sidebar.removeClass('hide-sidebar').addClass('show-sidebar');
        }else{
            body.addClass('no-paddin-left');
            sidebar.addClass('hide-sidebar').removeClass('show-sidebar');
        }
    });

    // Función para el área de notificaciones
    $('.btn-Notifications-area').on('click', function(){
        var NotificationsArea=$('.Notifications-area');
        if(NotificationsArea.css('opacity')=="0"){
            NotificationsArea.addClass('show-Notification-area');
        }else{
            NotificationsArea.removeClass('show-Notification-area');
        }
    });

    // Función para la barra de búsqueda
    $('.btn-search').on('click', function(){
        swal({
            title: 'What are you looking for?',
            confirmButtonText: '<i class="zmdi zmdi-search"></i>  Search',
            confirmButtonColor: '#03A9F4',
            showCancelButton: true,
            cancelButtonColor: '#F44336',
            cancelButtonText: '<i class="zmdi zmdi-close-circle"></i> Cancel',
            html: '<div class="form-group label-floating">'+
                        '<label class="control-label" for="InputSearch">write here</label>'+
                        '<input class="form-control" id="InputSearch" type="text">'+
                    '</div>'
        }).then(function () {
            swal(
                'You wrote',
                ''+$('#InputSearch').val()+'',
                'success'
            )
        });
    });

    // Función para el modal de ayuda
    $('.btn-modal-help').on('click', function(){
        $('#Dialog-Help').modal('show');
    });
});

// Inicialización de mCustomScrollbar (Malihu jQuery custom content scroller)
(function($){
    $(window).on("load",function(){
        $(".dashboard-sideBar-ct").mCustomScrollbar({
            theme:"light-thin",
            scrollbarPosition: "inside",
            autoHideScrollbar: true,
            scrollButtons: {enable: true}
        });
        $(".dashboard-contentPage, .Notifications-body").mCustomScrollbar({
            theme:"dark-thin",
            scrollbarPosition: "inside",
            autoHideScrollbar: true,
            scrollButtons: {enable: true}
        });
    });
})(jQuery);
