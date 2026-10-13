// ==========================================================================
// CONFIGURACIÓN SEGURA: SE CARGAN DESDE LA MEMORIA DEL NAVEGADOR
// ==========================================================================
// Si no existen, el sistema te las pedirá de forma segura la primera vez
let WEB_APP_URL = localStorage.getItem('CRM_WEB_APP_URL') || "";
let HF_TOKEN = localStorage.getItem('CRM_HF_TOKEN') || "";

// Función para configurar las llaves la primera vez desde la página
function configurarCredenciales() {
    if (!WEB_APP_URL || !HF_TOKEN) {
        const urlInput = prompt("Introduce tu URL de Google Apps Script:", WEB_APP_URL);
        const tokenInput = prompt("Introduce tu Token de Hugging Face (hf_...):", HF_TOKEN);
        
        if (urlInput && tokenInput) {
            localStorage.setItem('CRM_WEB_APP_URL', urlInput.trim());
            localStorage.setItem('CRM_HF_TOKEN', tokenInput.trim());
            WEB_APP_URL = urlInput.trim();
            HF_TOKEN = tokenInput.trim();
            alert("🔑 Credenciales guardadas localmente con éxito. ¡Ya puedes usar la app!");
        } else {
            alert("⚠️ Se requieren ambas llaves para que el sistema funcione.");
        }
    }
}


// Captura de elementos visuales
const dropZone = document.getElementById('drop-zone');
const dropZoneContent = document.querySelector('.drop-zone-content');
const previewImg = document.getElementById('preview-img');
const inputName = document.getElementById('client-name');
const inputPhone = document.getElementById('client-phone');
const btnSave = document.getElementById('btn-save');
const contactsBody = document.getElementById('contacts-body');
const fileInput = document.getElementById('file-input');

document.addEventListener('DOMContentLoaded', () => {
    btnSave.textContent = "💾 Guardar Contacto en Base de Datos";
    btnSave.disabled = true;
    
    // Si faltan las llaves en la memoria, las solicita de inmediato
    if (!WEB_APP_URL || !HF_TOKEN) {
        configurarCredenciales();
    }
});


// 1. CAPTURA LOCAL DESDE LA COMPUTADORA (CTRL + V)
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.indexOf('image') !== -1) {
            analizarImagenLocal(item.getAsFile());
        }
    }
});

// 2. CAPTURA LOCAL DESDE EL MÓVIL (AL TOCAR EL CUADRO VERDE)
dropZone.addEventListener('click', () => { fileInput.click(); });
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        analizarImagenLocal(e.target.files[0]);
    }
});

// 3. LA IA ANALIZA LA IMAGEN DIRECTAMENTE EN TU DISPOSITIVO
function analizarImagenLocal(file) {
    const reader = new FileReader();
    
    // Cambiar estados visuales de carga
    dropZoneContent.classList.add('hidden');
    previewImg.classList.remove('hidden');
    btnSave.disabled = true;
    btnSave.textContent = "🧠 La IA está leyendo la captura localmente...";
    inputName.value = "";
    inputPhone.value = "";

    reader.onload = function(event) {
        previewImg.src = event.target.result; // Mostrar previsualización local
        const base64Clean = event.target.result.split(',')[1]; // Extraer texto base64 limpio
        
        // Llamar a Hugging Face enviándole la imagen local directamente desde el navegador
        const apiUrl = "https://huggingface.co";
        const payload = {
            "model": "Qwen/Qwen2.5-VL-7B-Instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": "Extract the contact Name and Phone number from this WhatsApp profile screenshot. Return ONLY a raw JSON object with this format, no markdown, no extra text: {\"nombre\": \"Name here\", \"telefono\": \"Phone here\"}" },
                        { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64Clean}` } }
                    ]
                }
            ]
        };

        fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(json => {
            let aiText = json.choices.message.content.trim();
            aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
            const datos = JSON.parse(aiText);
            
            // Colocar los datos extraídos en los cuadros del formulario
            inputName.value = datos.nombre;
            inputPhone.value = datos.telefono;
            
            // Habilitar botón para que confirmes el envío de texto a Google Sheets
            btnSave.disabled = false;
            btnSave.textContent = "💾 Confirmar y Guardar en Sheets";
            
            // Evento de clic para enviar ÚNICAMENTE el texto a Google
            btnSave.onclick = function() {
                btnSave.disabled = true;
                btnSave.textContent = "⚡ Guardando datos de texto...";
                
                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ nombre: datos.nombre, telefono: datos.telefono })
                })
                .then(() => {
                    btnSave.textContent = "✅ ¡Guardado con éxito!";
                    btnSave.style.backgroundColor = "#27ae60";
                    agregarClienteTabla(datos.nombre, datos.telefono);
                    setTimeout(() => restablecerInterfaz(), 3000);
                })
                .catch(() => {
                    alert("Error al conectar con Google Sheets");
                    restablecerInterfaz();
                });
            };
        })
        .catch(err => {
            console.error(err);
            alert("La IA no pudo procesar la imagen local. Verifica tu Token de Hugging Face.");
            restablecerInterfaz();
        });
    };
    
    reader.readAsDataURL(file);
}

function restablecerInterfaz() {
    btnSave.textContent = "💾 Guardar Contacto en Base de Datos";
    btnSave.style.backgroundColor = "#25d366";
    btnSave.disabled = true;
    previewImg.classList.add('hidden');
    previewImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    dropZoneContent.classList.remove('hidden');
}

function agregarClienteTabla(nombre, telefono) {
    const emptyRow = document.querySelector('.empty-row');
    if (emptyRow) emptyRow.remove();
    const newRow = document.createElement('tr');
    newRow.innerHTML = `<td><strong>${nombre}</strong></td><td>${telefono}</td><td><a href="https://wa.me{telefono.replace(/\s+/g, '')}" target="_blank" class="whatsapp-link">💬 Chat</a></td>`;
    contactsBody.insertBefore(newRow, contactsBody.firstChild);
}
