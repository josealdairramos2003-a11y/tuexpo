// 1. CONFIGURACIÓN PROTEGIDA
const SUPABASE_URL = "https://pyrbzjksidcxrciehttw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z635wk3Q47p8wJNJRRZwrg_s5CXGRYt"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. UTILIDAD ANTI-INYECCIÓN (XSS PROTECTION)
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// 3. ELEMENTOS
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const btnUpload = document.getElementById('btn-upload');
const btnAddLink = document.getElementById('btn-add-link');
const fileInput = document.getElementById('file-input');
const linkNameInput = document.getElementById('link-name');
const linkUrlInput = document.getElementById('link-url');
const filesList = document.getElementById('files-list');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// 4. AUTENTICACIÓN SEGURA
btnLogin.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if(!email || !password) return alert("Por favor, completa todos los campos.");

    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Credenciales incorrectas o error de red.");
    else mostrarApp();
});

btnRegister.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (password.length < 6) return alert("La contraseña debe ser de al menos 6 caracteres por seguridad.");

    const { error } = await _supabase.auth.signUp({ email, password });
    if (error) alert("Error en el registro: " + error.message);
    else alert("Registro completado. Ya puedes ingresar.");
});

btnLogout.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    location.reload();
});

async function mostrarApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    await cargarContenido();
}

// 5. SUBIDA SEGURA DE ARCHIVOS
btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return alert("Selecciona un archivo válido.");

    // Validación básica de extensión
    const extensionesPermitidas = /(\.pdf|\.docx|\.pptx|\.jpg|\.png)$/i;
    if(!extensionesPermitidas.exec(file.name)) {
        return alert("Tipo de archivo no permitido.");
    }

    btnUpload.innerText = "Protegiendo y subiendo...";
    btnUpload.disabled = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if(!user) throw new Error("Sesión expirada.");

        const fileName = `${Date.now()}_${user.id.substring(0,5)}_${file.name.replace(/\s/g, '_')}`;

        const { error: sError } = await _supabase.storage.from('archivos-expo').upload(fileName, file);
        if (sError) throw sError;

        const { data: urlData } = _supabase.storage.from('archivos-expo').getPublicUrl(fileName);

        await _supabase.from('presentaciones').insert([{ 
            name: file.name, 
            url: urlData.publicUrl,
            user_id: user.id 
        }]);

        fileInput.value = "";
        await cargarContenido();
    } catch (err) {
        alert("Error de seguridad o servidor: " + err.message);
    } finally {
        btnUpload.innerText = "Subir Archivo";
        btnUpload.disabled = false;
    }
});

// 6. ADICIÓN SEGURA DE LINKS
btnAddLink.addEventListener('click', async () => {
    const name = linkNameInput.value.trim();
    const url = linkUrlInput.value.trim();

    if (!name || !url) return alert("Los campos no pueden estar vacíos.");

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if(!user) return;

        const { error } = await _supabase.from('presentaciones').insert([{ 
            name: `🔗 ${name}`, 
            url: url,
            user_id: user.id 
        }]);

        if (error) throw error;

        linkNameInput.value = "";
        linkUrlInput.value = "";
        await cargarContenido();
    } catch (err) {
        alert("Error al procesar el enlace.");
    }
});

// 7. CARGA CON FILTRO DE PRIVACIDAD (RLS)
async function cargarContenido() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await _supabase
        .from('presentaciones')
        .select('*')
        .eq('user_id', user.id) // <--- Seguridad a nivel de base de datos
        .order('created_at', { ascending: false });

    if (error) return;

    filesList.innerHTML = "";
    
    if (data.length === 0) {
        filesList.innerHTML = '<p class="text-gray-400 italic text-center">Tu espacio está seguro y vacío.</p>';
        return;
    }

    data.forEach(item => {
        // Usamos escapeHTML para los nombres de archivos/links por seguridad
        const nombreSeguro = escapeHTML(item.name);
        
        filesList.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                <div>
                    <p class="font-bold text-gray-800">${nombreSeguro}</p>
                    <p class="text-xs text-gray-400">${new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div class="flex gap-2 items-center">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                        ABRIR
                    </a>
                    <button onclick="eliminarItem('${item.id}', '${item.url}')" class="text-red-400 hover:text-red-600 p-2">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
}

// 8. ELIMINACIÓN VALIDADA
async function eliminarItem(id, url) {
    if (!confirm("Esta acción eliminará el recurso permanentemente. ¿Continuar?")) return;

    try {
        if (url.includes('supabase.co')) {
            const fileName = url.split('/').pop().split('?')[0];
            await _supabase.storage.from('archivos-expo').remove([fileName]);
        }

        const { error } = await _supabase.from('presentaciones').delete().eq('id', id);
        if (error) throw error;

        await cargarContenido();
    } catch (e) {
        alert("No se pudo completar la operación.");
    }
}