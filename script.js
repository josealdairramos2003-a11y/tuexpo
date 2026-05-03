/**
 * TU Expo - Lógica de Aplicación
 * Desarrollado por: ADeN
 * Versión: 2.0 (Seguridad Reforzada)
 */

// 1. CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://pyrbzjksidcxrciehttw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z635wk3Q47p8wJNJRRZwrg_s5CXGRYt"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. UTILIDADES DE SEGURIDAD (Prevención de XSS)
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// 3. NAVEGACIÓN ENTRE VISTAS (Login / Registro)
function switchCard(view) {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    
    // Limpiar campos al cambiar de vista
    document.querySelectorAll('input').forEach(input => input.value = '');

    if(view === 'register') {
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
    } else {
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
    }
}

// 4. ELEMENTOS DEL DOM
const authContainer = document.getElementById('auth-container');
const appSection = document.getElementById('app-section');
const filesList = document.getElementById('files-list');

// 5. GESTIÓN DE AUTENTICACIÓN
// Iniciar Sesión
document.getElementById('btn-do-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if(!email || !password) return alert("Ingresa tus credenciales.");

    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Error: Correo o contraseña incorrectos.");
    } else {
        mostrarDashboard();
    }
});

// Registro de Usuario
document.getElementById('btn-do-register').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (password.length < 6) {
        return alert("Por seguridad, la contraseña debe tener al menos 6 caracteres.");
    }

    const { data, error } = await _supabase.auth.signUp({ email, password });
    
    if (error) {
        alert("Error al registrar: " + error.message);
    } else {
        alert("¡Cuenta creada con éxito! Ya puedes iniciar sesión.");
        switchCard('login');
    }
});

// Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    await _supabase.auth.signOut();
    location.reload();
});

// Control de flujo visual
function mostrarDashboard() {
    authContainer.classList.add('hidden');
    appSection.classList.remove('hidden');
    cargarContenido();
}

// 6. CARGAR CONTENIDO PERSONALIZADO (Filtrado por RLS)
async function cargarContenido() {
    // Obtener usuario actual para asegurar privacidad
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    // Consulta filtrada por user_id (Invisible para otros usuarios)
    const { data, error } = await _supabase
        .from('presentaciones')
        .select('*')
        .eq('user_id', user.id) 
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        return;
    }

    filesList.innerHTML = "";
    
    if (!data || data.length === 0) {
        filesList.innerHTML = `
            <div class="bg-white p-10 rounded-2xl border-2 border-dashed border-gray-100 text-center text-gray-400">
                <p class="italic">Tu espacio está listo. Sube tu primer archivo o enlace.</p>
            </div>`;
        return;
    }

    data.forEach(item => {
        const nombreSeguro = escapeHTML(item.name);
        
        filesList.innerHTML += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition group">
                <div class="overflow-hidden mr-4">
                    <p class="font-bold text-gray-800 truncate">${nombreSeguro}</p>
                    <p class="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                        ${new Date(item.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div class="flex gap-3 items-center shrink-0">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                       class="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs shadow-lg shadow-blue-50 hover:bg-blue-700 transition">
                        ABRIR
                    </a>
                    <button onclick="eliminarItem('${item.id}', '${item.url}')" 
                            class="text-gray-200 hover:text-red-500 transition p-2">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
}

// 7. SUBIDA DE ARCHIVOS
document.getElementById('btn-upload').addEventListener('click', async () => {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) return alert("Selecciona un archivo primero.");

    const btn = document.getElementById('btn-upload');
    btn.innerText = "Subiendo de forma segura...";
    btn.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error("Sesión no válida.");

        // Crear nombre único para evitar conflictos en el storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // 1. Subir al Storage
        const { error: sError } = await _supabase.storage.from('archivos-expo').upload(fileName, file);
        if (sError) throw sError;

        // 2. Obtener URL pública
        const { data: urlData } = _supabase.storage.from('archivos-expo').getPublicUrl(fileName);

        // 3. Registrar en base de datos vinculado al usuario
        await _supabase.from('presentaciones').insert([{ 
            name: file.name, 
            url: urlData.publicUrl,
            user_id: user.id 
        }]);

        fileInput.value = "";
        cargarContenido();
        alert("Archivo guardado en tu nube.");
    } catch (err) {
        alert("Error de subida: " + err.message);
    } finally {
        btn.innerText = "Subir a mi nube";
        btn.disabled = false;
    }
});

// 8. GUARDAR ENLACES MANUALES
document.getElementById('btn-add-link').addEventListener('click', async () => {
    const nameInput = document.getElementById('link-name');
    const urlInput = document.getElementById('link-url');
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) return alert("Completa ambos campos del enlace.");

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        await _supabase.from('presentaciones').insert([{ 
            name: `🔗 ${name}`, 
            url: url,
            user_id: user.id 
        }]);

        nameInput.value = "";
        urlInput.value = "";
        cargarContenido();
    } catch (err) {
        alert("Error al guardar el enlace.");
    }
});

// 9. ELIMINACIÓN DE RECURSOS
async function eliminarItem(id, url) {
    if (!confirm("¿Seguro que deseas eliminar este recurso de tu cuenta?")) return;

    try {
        // Si es un archivo alojado en nuestro storage, lo borramos de ahí también
        if (url.includes('supabase.co/storage')) {
            const fileName = url.split('/').pop().split('?')[0];
            await _supabase.storage.from('archivos-expo').remove([fileName]);
        }

        // Borrar registro de la base de datos
        const { error } = await _supabase.from('presentaciones').delete().eq('id', id);
        if (error) throw error;

        cargarContenido();
    } catch (e) {
        alert("No se pudo eliminar el elemento.");
    }
}