<script setup>
import { ref } from 'vue'

const urlServer = window.location.hostname;
const selectedImage = ref(null)
const imagePreview = ref('')
const isUploading = ref(false)

function handleImageChange(event) {
    const file = event.target.files[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('Solo PNG o JPEG sono accettati.')
        return
    }
    selectedImage.value = file
    imagePreview.value = URL.createObjectURL(file)
}

async function uploadImage() {
    if (!selectedImage.value) return
    isUploading.value = true
    const formData = new FormData()
    formData.append('image', selectedImage.value)
    try {
        const response = await fetch(`http://${urlServer}:3000/upload-image`, {
            method: 'POST',
            body: formData
        })
        if (!response.ok) throw new Error('Upload fallito')
        alert('Immagine caricata con successo!')
    } catch (err) {
        alert('Errore nel caricamento: ' + err.message)
    } finally {
        isUploading.value = false
    }
}

const testText = ref('Testo di esempio')
const fontFamily = ref('Arial')
const fontSize = ref(24)
const fontColor = ref('#000000')
const fontBold = ref(false)
const fontItalic = ref(false)
const fontUnderline = ref(false)
const textAlign = ref('left')
const canvasImage = ref('')

// SOLO FONT DI SISTEMA, COMPATIBILI OFFLINE
// Nota: solo questi font funzionano sempre offline su Windows/macOS/Linux
const fontFamilies = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS', 'Calibri',
    'Lucida Sans', 'Lucida Console', 'Monaco', 'Consolas', 'Comic Sans MS', 'Impact', 'Palatino', 'Garamond',
    'Bookman', 'Arial Black', 'Geneva', 'Optima', 'Candara', 'Franklin Gothic Medium', 'Copperplate', 'Futura',
    'Baskerville', 'Didot', 'American Typewriter', 'Andale Mono', 'Century Gothic', 'Gill Sans', 'Rockwell',
    'Bodoni', 'Segoe UI', 'MS Sans Serif', 'MS Serif', 'Charcoal', 'Chicago', 'Lucida Bright', 'Lucida Fax',
    'Brush Script MT', 'Apple Chancery', 'Bradley Hand', 'Perpetua', 'Courier', 'Symbol', 'Zapfino'
]

// Funzione per word wrap e canvas proporzionato 80mm
function generateImageFromText() {
    const DPI = 96 // standard browser DPI
    const mmToPx = mm => Math.round(mm * DPI / 25.4)
    const canvasWidth = mmToPx(80) // 80mm = ~302px
    const maxWidth = canvasWidth - 20 // padding
    let style = ''
    if (fontBold.value) style += 'bold '
    if (fontItalic.value) style += 'italic '
    style += `${fontSize.value}px ${fontFamily.value}, Arial, sans-serif`
    // Crea canvas temporaneo per misurare testo
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.font = style
    // Word wrap manuale
    const words = testText.value.split(' ')
    let lines = []
    let currentLine = ''
    for (let word of words) {
        let testLine = currentLine ? currentLine + ' ' + word : word
        let testWidth = tempCtx.measureText(testLine).width
        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = testLine
        }
    }
    if (currentLine) lines.push(currentLine)
    // Calcola altezza canvas
    const lineHeight = fontSize.value * 1.2
    const canvasHeight = Math.ceil(lines.length * lineHeight + 20)
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    // SFONDO BIANCO
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font = style
    ctx.textAlign = textAlign.value
    ctx.fillStyle = '#000000'
    // Disegna ogni riga
    lines.forEach((line, i) => {
        let y = 10 + (i + 1) * lineHeight
        let x = canvas.width / 2
        if (textAlign.value === 'left') x = 10
        if (textAlign.value === 'right') x = canvas.width - 10
        ctx.fillText(line, x, y)
        if (fontUnderline.value) {
            const textWidth = ctx.measureText(line).width
            let underlineX = x
            if (textAlign.value === 'center') underlineX = x - textWidth / 2
            if (textAlign.value === 'right') underlineX = x - textWidth
            ctx.beginPath()
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 2
            ctx.moveTo(underlineX, y + 4)
            ctx.lineTo(underlineX + textWidth, y + 4)
            ctx.stroke()
        }
    })
    // PNG con sfondo bianco
    canvasImage.value = canvas.toDataURL('image/png')
    uploadCanvasImage(canvasImage.value)
}

// Funzione per upload diretto dell'immagine generata
async function uploadCanvasImage(dataUrl) {
    isUploading.value = true
    try {
        // Converti base64 in blob
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const formData = new FormData()
        formData.append('image', blob, 'scontrino.png')
        const response = await fetch(`http://${urlServer}:3000/upload-image`, {
            method: 'POST',
            body: formData
        })
        if (!response.ok) throw new Error('Upload fallito')
        alert('Immagine testo scontrino caricata!')
    } catch (err) {
        alert('Errore upload immagine testo: ' + err.message)
    } finally {
        isUploading.value = false
    }
}
</script>

<template>
    <div class="receipt-config-page">
        <h1>Configurazione Scontrino</h1>
        <!-- Placeholder per future configurazioni -->
        <div class="image-upload-section">
            <div class="text">
                <h2>Carica Immagine Scontrino</h2>
                <input type="file" @change="handleImageChange" accept="image/png, image/jpeg" />
                <button @click="uploadImage" :disabled="isUploading">
                    <span v-if="isUploading" class="loader"></span>
                    Carica Immagine
                </button>
            </div>
            <div v-if="imagePreview" class="image-preview">
                <img :src="imagePreview" alt="Anteprima Immagine" />
            </div>
        </div>
        <!-- Altre configurazioni qui -->
        <div class="receipt-text-config">
            <h2>Configura Testo Scontrino</h2>
            <div class="config-form">
                <label>Testo:
                    <input v-model="testText" type="text" placeholder="Scrivi qui il testo..." />
                </label>
                <label>Font:
                    <select v-model="fontFamily">
                        <option v-for="font in fontFamilies" :key="font" :value="font">{{ font }}</option>
                    </select>
                </label>
                <label>Dimensione:
                    <input v-model.number="fontSize" type="number" min="8" max="72" /> px
                </label>
                <label>Stile:
                    <span><input type="checkbox" v-model="fontBold" />Grassetto</span>
                    <span><input type="checkbox" v-model="fontItalic" />Corsivo</span>
                    <span><input type="checkbox" v-model="fontUnderline" />Sottolineato</span>
                </label>
                <label>Allineamento:
                    <select v-model="textAlign">
                        <option value="left">Sinistra</option>
                        <option value="center">Centro</option>
                        <option value="right">Destra</option>
                    </select>
                </label>
                <button @click="generateImageFromText">Genera Immagine</button>
            </div>
            <div class="text-preview" :style="{
                fontFamily,
                fontSize: fontSize + 'px',
                color: fontColor,
                fontWeight: fontBold ? 'bold' : 'normal',
                fontStyle: fontItalic ? 'italic' : 'normal',
                textDecoration: fontUnderline ? 'underline' : 'none',
                textAlign
            }">
                {{ testText }}
            </div>
            <div v-if="canvasImage" class="canvas-preview">
                <h3>Immagine generata</h3>
                <img :src="canvasImage" alt="Immagine Testo Scontrino" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.receipt-config-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: #f8f8f8;
    border-radius: 8px;
}
.image-upload-section {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
    margin-top: 2rem;
}
.text {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.image-preview {
    margin-top: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 0.5rem;
    background: #fff;
    max-width: 200px;
}
.image-preview img {
    max-width: 100%;
    border-radius: 8px;
}
.loader {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ccc;
    border-top: 2px solid #2196F3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 8px;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.receipt-text-config {
    margin-top: 2rem;
    padding: 1rem;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.config-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}
.config-form label {
    display: flex;
    flex-direction: column;
    font-weight: 500;
}
button {
    grid-column: span 2;
    padding: 0.75rem;
    background: #2196F3;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}
button:hover {
    background: #1976D2;
}
.text-preview {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid #2196F3;
    border-radius: 4px;
    background: #f0f8ff;
    font-size: 1.2rem;
}
.canvas-preview {
    margin-top: 1rem;
}
.canvas-preview img {
    max-width: 100%;
    border-radius: 8px;
}
</style>
