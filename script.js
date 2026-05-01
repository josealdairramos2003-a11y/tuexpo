// 1. CONFIGURACIÓN
const SUPABASE_URL = "https://pyrbzjksidcxrciehttw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z635wk3Q47p8wJNJRRZwrg_s5CXGRYt"; 

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. ELEMENTOS
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const btnUpload = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');
const filesList = document.getElementById('files-list');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// 3. AUTH
btnRegister.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const { error } = await _supabase.auth.signUp({ email, password });
    if (error) alert("Error: " + error.message);
    else alert("¡Registro exitoso! Ya puedes iniciar sesión.");
});

btnLogin.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error: " + error.message);
    else mostrarApp();
});

btnLogout.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    location.reload();
});

function mostrarApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    cargarArchivos();
}

// 4. GESTIÓN DE ARCHIVOS
btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return alert("Selecciona un archivo.");

    btnUpload.innerText = "Subiendo...";
    btnUpload.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        const fileName = `${Date.now()}_${file.name}`;
        const { error: sError } = await _supabase.storage
            .from('archivos-expo')
            .upload(fileName, file);

        if (sError) throw sError;

        const { data: urlData } = _supabase.storage.from('archivos-expo').getPublicUrl(fileName);

        const { error: insertError } = await _supabase
            .from('presentaciones')
            .insert([{ 
                name: file.name, 
                url: urlData.publicUrl,
                user_id: user.id 
            }]);

        if (insertError) throw insertError;

        fileInput.value = "";
        cargarArchivos();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btnUpload.innerText = "Subir ahora";
        btnUpload.disabled = false;
    }
});

// 5. CARGA Y LIMPIEZA AUTOMÁTICA
async function cargarArchivos() {
    const { data, error } = await _supabase
        .from('presentaciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return;

    filesList.innerHTML = "";
    
    const ahora = new Date();

    data.forEach(async (archivo) => {
        const fechaArchivo = new Date(archivo.created_at);
        const diferenciaHoras = (ahora - fechaArchivo) / (1000 * 60 * 60);

        // Limpieza automática: Si tiene más de 24 horas, se borra solo
        if (diferenciaHoras > 24) {
            eliminarArchivoSilencioso(archivo.id, archivo.url);
            return;
        }

        filesList.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <p class="font-bold text-gray-800">${archivo.name}</p>
                    <p class="text-xs text-gray-400">${fechaArchivo.toLocaleString()}</p>
                </div>
                <div class="flex gap-2 text-center items-center">
                    <a href="${archivo.url}" target="_blank" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                        EXPONER
                    </a>
                    <button onclick="eliminarArchivoManual('${archivo.id}', '${archivo.url}')" class="text-red-400 hover:text-red-600 p-2">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
}

// 6. FUNCIONES DE ELIMINACIÓN
// Reemplaza tus funciones de eliminación por estas:

async function eliminarArchivoManual(id, url) {
    if (!confirm("¿Eliminar este archivo definitivamente?")) return;
    
    try {
        await ejecutarEliminacion(id, url);
        alert("Archivo borrado de la nube y la lista.");
        // Forzamos la recarga de la lista
        await cargarArchivos(); 
    } catch (e) {
        alert("No se pudo borrar: " + e.message);
    }
}

async function ejecutarEliminacion(id, url) {
    // 1. Extraer el nombre del archivo correctamente
    const fileName = url.split('/').pop().split('?')[0]; 

    // 2. Intentar borrar del Storage
    const { error: storageError } = await _supabase.storage
        .from('archivos-expo')
        .remove([fileName]);

    if (storageError) {
        console.error("Error en Storage:", storageError.message);
        // Si el archivo no existe en storage, igual intentamos borrar el registro de la DB
    }

    // 3. Borrar de la base de datos (Esto es lo que quita la tarjeta de la pantalla)
    const { error: dbError } = await _supabase
        .from('presentaciones')
        .delete()
        .eq('id', id);

    if (dbError) throw dbError;
}