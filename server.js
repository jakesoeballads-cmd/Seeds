const config = require('./src/config');
const app = require('./src/app');

app.listen(config.port, () => {
  console.log(`Benih berjalan di ${config.appUrl} (port ${config.port})`);
  if (config.midtrans.simulated) {
    console.log('Pembayaran: mode simulasi (MIDTRANS_SERVER_KEY kosong).');
  }
});
