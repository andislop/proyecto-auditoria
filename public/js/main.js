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
  // Asegúrate de que este código se coloque en tu main.js

// Asegúrate de que este código se coloque en tu main.js

		$(document).ready(function() {


            // ** Lógica para cerrar sesión **
            const logoutButton = document.getElementById('logoutBtn');
            const customConfirmModal = document.getElementById('customConfirmModal');
            const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
            const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');

            // Función para mostrar el modal personalizado
            function showCustomConfirmModal() {
                customConfirmModal.classList.add('active');
            }

            // Función para ocultar el modal personalizado
            function hideCustomConfirmModal() {
                customConfirmModal.classList.remove('active');
            }

            // Event listener para el botón de cerrar sesión
            logoutButton.addEventListener('click', function(event) {
                event.preventDefault(); // Evita la redirección inmediata del <a>
                showCustomConfirmModal();
            });

            // Event listener para el botón "Sí, cerrar sesión" del modal
            confirmLogoutBtn.addEventListener('click', async function() {
                hideCustomConfirmModal(); // Oculta el modal

                try {
                    const response = await fetch('/api/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        // Si el backend confirma el cierre de sesión, redirige
                        window.location.href = '/'; // Redirige a la página de inicio/login
                    } else {
                        // Manejar errores si el servidor responde con un status diferente de 200
                        const errorData = await response.json();
                        // Si SweetAlert2 no está cargado, usamos el alert nativo.
                        // Lo importante es que aquí ya no hay un Swal.fire para evitar el doble modal
                        console.error('Error al cerrar sesión:', errorData.message);
                        alert('Error al cerrar sesión: ' + (errorData.message || 'Hubo un problema.'));
                    }
                } catch (error) {
                    console.error('Error de red al intentar cerrar sesión:', error);
                    alert('Error de conexión al cerrar sesión. Inténtalo de nuevo.');
                }
            });

            // Event listener para el botón "Cancelar" del modal
            cancelLogoutBtn.addEventListener('click', function() {
                hideCustomConfirmModal(); // Simplemente oculta el modal
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
