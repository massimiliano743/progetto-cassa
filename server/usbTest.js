const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Funzione per ottenere la lista delle stampanti
function getPrinterList() {
    return new Promise((resolve, reject) => {
        exec('lpstat -e', (error, stdout, stderr) => {
            if (error) {
                console.error('Errore lpstat:', error);
                return reject(error);
            }

            const printers = [];
            const lines = stdout.split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();
                // Prende solo righe non vuote
                if (trimmed) {
                    console.log('Stampante trovata:', trimmed);
                    printers.push(trimmed);
                }
            });

            if (printers.length === 0) {
                console.warn('Nessuna stampante trovata in lpstat -e');
                console.log('Output completo:', stdout);
            }

            resolve(printers);
        });
    });
}

// Funzione per stampare con una specifica stampante
function printWithPrinter(printerName) {
    return new Promise((resolve, reject) => {
        // Dati ESC/POS per la stampa
        const escposCommands = Buffer.concat([
            Buffer.from('\x1B\x40'), // Init
            Buffer.from('\x1B\x61\x01'), // Centra testo
            Buffer.from('STAMPA DI PROVA\n\n'),
            Buffer.from(`Stampante: ${printerName}\n\n`),
            Buffer.from('\x1B\x61\x00'), // Allinea a sinistra
            Buffer.from('Data: ' + new Date().toLocaleString() + '\n'),
            Buffer.from('\n\n\n\n\n'),
            Buffer.from('\x1D\x56\x41\x03') // Taglia carta
        ]);

        const tempFile = `print_${Date.now()}.bin`;
        fs.writeFileSync(tempFile, escposCommands);

        exec(`lpr -o raw ${tempFile} -P "${printerName}"`, (error) => {
            fs.unlinkSync(tempFile);
            if (error) reject(error);
            else resolve();
        });
    });
}

// Interfaccia per selezione utente
async function selectPrinterAndPrint() {
    try {
        const printers = await getPrinterList();

        if (printers.length === 0) {
            console.log('Nessuna stampante trovata!');
            console.log('1. Verifica la connessione della stampante');
            console.log('2. Controlla con: lpstat -p');
            return;
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\nStampanti disponibili:');
        printers.forEach((printer, index) => {
            console.log(`${index + 1}. ${printer}`);
        });

        rl.question('\nSeleziona il numero della stampante: ', async (answer) => {
            const choice = parseInt(answer);

            if (isNaN(choice) || choice < 1 || choice > printers.length) {
                console.error('Selezione non valida');
                rl.close();
                return;
            }

            const selectedPrinter = printers[choice - 1];
            console.log(`\nSto stampando su: ${selectedPrinter}...`);

            try {
                await printWithPrinter(selectedPrinter);
                console.log('Stampato con successo!');
            } catch (printError) {
                console.error('Errore di stampa:', printError.message);
                console.log('Suggerimenti:');
                console.log('- Verifica che la stampante sia accesa e connessa');
                console.log('- Prova a ricollegare la stampante USB');
                console.log('- Controlla i permessi con: cupsctl --remote-admin');
            }

            rl.close();
        });
    } catch (error) {
        console.error('Errore:', error.message);
    }
}

// Esegui il processo
selectPrinterAndPrint();
